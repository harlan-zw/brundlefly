"""Builds the office set: every prop, the room, and the test chamber behind the window. It bakes the light and writes one GLB and one light map.

Run it through `pnpm office:build` in website/, which writes plan.json first. Or run it by hand, with absolute paths:
  flatpak run org.blender.Blender -b --factory-startup --python build_office_props.py -- plan.json atlas.json office.glb office-light.png

Options after the four paths: `--samples N` sets the bake quality. `--only-model` skips the bake and writes flat light.

Coordinates in this file are the site's: x to screen right, y up, z toward the viewer. `to_blender` turns them for the bake.
The parts of the file: the kit that makes faces, the props, the bake, and the GLB writer.
"""
import json
import math
import random
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:]
PLAN_PATH, ATLAS_PATH, GLB_PATH, LIGHT_PATH = ARGS[:4]
OPTIONS = ARGS[4:]
SAMPLES = int(OPTIONS[OPTIONS.index('--samples') + 1]) if '--samples' in OPTIONS else 1024
ONLY_MODEL = '--only-model' in OPTIONS

with open(PLAN_PATH) as file:
    PLAN = json.load(file)
with open(ATLAS_PATH) as file:
    ATLAS = json.load(file)
ROOM = PLAN['room']
FLOOR, CEILING = ROOM['floorY'], ROOM['ceilingY']
ATLAS_W, ATLAS_H = ATLAS['size']
RNG = random.Random(1998)

# The site decodes a stored light value as value * value * LIGHT_MAX. The square root keeps the dark end fine in eight bits.
LIGHT_MAX = 4.0
# The light on the floor under a tube, after the bake is scaled.
POOL = 1.5
# The bake is physical, and a room of pale walls comes out even. This power deepens the corners and the shadows, and keeps the pool level.
CONTRAST = 1.25
# The light map: pixels across, and pixels for one world unit.
LM_SIZE = 256
LUXELS = 8
# A short corridor can show behind the door: a view, and no room he can enter. It is off: the owner wants no room past the office and the test chamber.
# With True the door stands ajar and the corridor is built. Rebuild the model after a change.
CORRIDOR = False
# The model file stores a position as whole steps of this size.
GRID = 1 / 1024


def colour(hex_code, gain=1.0):
    """A brand colour as linear red, green, and blue."""
    def linear(byte):
        value = byte / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
    return np.array([linear(int(hex_code[at:at + 2], 16)) for at in (1, 3, 5)]) * gain


WHITE = np.ones(3)
INK = {name: colour(code) for name, code in {
    'rust': '#AA604B', 'bruise': '#69404B', 'chitin': '#343C3B', 'olive': '#777648', 'teal': '#418B90',
    'cream': '#E8D4A6', 'night': '#080B08', 'wing': '#A4B5A0', 'beige': '#C9BC98'}.items()}
# How much light each texture gives back, for the bounce in the bake.
ALBEDO = {'floor': (0.33, 0.35, 0.27), 'wall': (0.55, 0.5, 0.36), 'ceiling': (0.5, 0.48, 0.4), 'concrete': (0.07, 0.08, 0.07),
          'metal': (0.3, 0.33, 0.29), 'marks': (0.7, 0.7, 0.62), 'laminate': (0.2, 0.07, 0.03), 'plastic': (0.5, 0.46, 0.36), 'white': (0.8, 0.8, 0.8)}

# ---------------------------------------------------------------- the kit

FACES = []
# The room's tubes can be off. A face that keeps its light then has its own: a screen, a small lamp, and all of the test chamber.
# The model file gives such faces a surface of their own, so the site can dim the room and leave them lit.
OWN_LIGHT = False
YAWS = {'+z': 0.0, '+x': math.pi / 2, '-z': math.pi, '-x': -math.pi / 2}


def frame(position=(0, 0, 0), yaw=0.0):
    """A place and a turn about the vertical. It matches the site's rotation about y."""
    cos, sin = math.cos(yaw), math.sin(yaw)
    matrix = np.eye(4)
    matrix[0, 0], matrix[0, 2], matrix[2, 0], matrix[2, 2] = cos, sin, -sin, cos
    matrix[:3, 3] = position
    return matrix


def turn_x(angle):
    cos, sin = math.cos(angle), math.sin(angle)
    matrix = np.eye(4)
    matrix[1, 1], matrix[1, 2], matrix[2, 1], matrix[2, 2] = cos, -sin, sin, cos
    return matrix


def turn_z(angle):
    cos, sin = math.cos(angle), math.sin(angle)
    matrix = np.eye(4)
    matrix[0, 0], matrix[0, 1], matrix[1, 0], matrix[1, 1] = cos, -sin, sin, cos
    return matrix


def place(matrix, points):
    points = np.asarray(points, float)
    return points @ matrix[:3, :3].T + matrix[:3, 3]


class Cell:
    """A texture cell of the atlas. `span` is the world size the whole cell covers when a face shows a piece of it at real scale."""

    def __init__(self, name, span=None, part=None):
        self.name, self.span, self.part = name, span, part
        self.left, self.top, self.width, self.height = ATLAS['cells'][name]

    def rect(self, width, height):
        if self.part:
            return self.part
        if not self.span:
            return (0, 0, 1, 1)
        across, up = min(1, width / self.span), min(1, height / (self.span * self.height / self.width))
        left, low = RNG.random() * (1 - across), RNG.random() * (1 - up)
        return (left, low, left + across, low + up)

    def uv(self, rect, a, b):
        s, t = rect[0] + (rect[2] - rect[0]) * a, rect[1] + (rect[3] - rect[1]) * b
        # Half a pixel of margin keeps a neighbour cell out of the edge.
        return ((self.left + 0.5 + s * (self.width - 1)) / ATLAS_W, (self.top + self.height - 0.5 - t * (self.height - 1)) / ATLAS_H)


class Tile:
    """A texture that repeats. `span` is the world size of one repeat."""

    def __init__(self, span=2.0):
        self.span = span

    def rect(self, width, height):
        return (0, 0, width / self.span, height / self.span)

    def uv(self, rect, a, b):
        return (rect[0] + (rect[2] - rect[0]) * a, 1 - (rect[1] + (rect[3] - rect[1]) * b))


class Sheet:
    """A region of the drawn marks sheet. The plan gives it with v upward, as the site's canvas has it."""

    def __init__(self, name):
        self.region = PLAN['marks'][name]

    def rect(self, width, height):
        return (0, 0, 1, 1)

    def uv(self, rect, a, b):
        u0, v0, u1, v1 = self.region
        return (u0 + (u1 - u0) * a, 1 - (v0 + (v1 - v0) * b))


def metal(span=2.0):
    return Cell('metal', span)


def emit(surface, matrix, points, uvs, tint=WHITE, kind='lit', value=None, node=None, uv1=None, own=None):
    """One flat face. `kind` says how it gets its light: 'lit' takes the bake, 'glow' and 'flicker' shine, 'glass' and 'beam' stay out of the bake.
    `own` says the face keeps its light when the room's tubes are off. Without it the face follows `OWN_LIGHT`."""
    FACES.append({'surface': surface, 'points': place(matrix, points), 'uv': np.asarray(uvs, float), 'uv1': None if uv1 is None else np.asarray(uv1, float),
                  'tint': np.asarray(tint, float), 'kind': kind, 'value': value, 'node': node, 'own': OWN_LIGHT if own is None else own})


def quad(surface, matrix, corners, skin, tint=WHITE, step=None, rect=None, **look):
    """Corners: bottom left, bottom right, top right, top left, as seen from the front. `step` cuts it into a grid, so the bake can shade across it."""
    p = np.asarray(corners, float)
    width = max(np.linalg.norm(p[1] - p[0]), np.linalg.norm(p[2] - p[3]))
    height = max(np.linalg.norm(p[3] - p[0]), np.linalg.norm(p[2] - p[1]))
    rect = rect or skin.rect(width, height)
    across = max(1, math.ceil(width / step - 1e-6)) if step else 1
    up = max(1, math.ceil(height / step - 1e-6)) if step else 1

    def at(a, b):
        return (p[0] * (1 - a) + p[1] * a) * (1 - b) + (p[3] * (1 - a) + p[2] * a) * b
    for i in range(across):
        for j in range(up):
            spots = [(i / across, j / up), ((i + 1) / across, j / up), ((i + 1) / across, (j + 1) / up), (i / across, (j + 1) / up)]
            emit(surface, matrix, [at(a, b) for a, b in spots], [skin.uv(rect, a, b) for a, b in spots], tint, **look)


def box(surface, matrix, centre, size, skin, tint=WHITE, step=None, skip='', skins=None, tints=None, **look):
    """A box. `skip` names faces to leave out, as '+y-y'. `skins` and `tints` give single faces their own look."""
    (x, y, z), (w, h, d) = centre, size
    l, r, b, t, back, front = x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2
    faces = {
        '+z': [(l, b, front), (r, b, front), (r, t, front), (l, t, front)], '-z': [(r, b, back), (l, b, back), (l, t, back), (r, t, back)],
        '+x': [(r, b, front), (r, b, back), (r, t, back), (r, t, front)], '-x': [(l, b, back), (l, b, front), (l, t, front), (l, t, back)],
        '+y': [(l, t, front), (r, t, front), (r, t, back), (l, t, back)], '-y': [(l, b, back), (r, b, back), (r, b, front), (l, b, front)],
    }
    for name, corners in faces.items():
        if name in skip:
            continue
        quad(surface, matrix, corners, (skins or {}).get(name, skin), (tints or {}).get(name, tint), step, **look)


def ring(centre, radius, sides, y, depth=None, phase=0.5):
    """Points round a vertical axis. They run the way that gives a loft outward faces."""
    return [(centre[0] + math.sin((i + phase) / sides * math.tau) * radius, y, centre[2] + math.cos((i + phase) / sides * math.tau) * (depth or radius)) for i in range(sides)]


def loft(surface, matrix, low, high, skin, tint=WHITE, rect=None, closed=True, **look):
    """Joins two rings of points with a band of faces."""
    count = len(low)
    length = sum(np.linalg.norm(np.subtract(low[(i + 1) % count], low[i])) for i in range(count if closed else count - 1))
    rect = rect or skin.rect(length, np.linalg.norm(np.subtract(high[0], low[0])))
    spans = count if closed else count - 1
    for i in range(spans):
        j = (i + 1) % count
        a0, a1 = i / spans, (i + 1) / spans
        emit(surface, matrix, [low[i], low[j], high[j], high[i]], [skin.uv(rect, a0, 0), skin.uv(rect, a1, 0), skin.uv(rect, a1, 1), skin.uv(rect, a0, 1)], tint, **look)


def cap(surface, matrix, points, skin, tint=WHITE, up=True, rect=None, **look):
    """Closes a ring with one flat face."""
    points = list(points) if up else list(reversed(points))
    array = np.asarray(points, float)
    low, size = array.min(axis=0), np.ptp(array, axis=0)
    axes = [axis for axis in range(3) if size[axis] > 1e-6][:2] or [0, 2]
    while len(axes) < 2:
        axes.append((axes[0] + 1) % 3)
    rect = rect or skin.rect(size[axes[0]], size[axes[1]])
    uvs = [skin.uv(rect, (point[axes[0]] - low[axes[0]]) / max(size[axes[0]], 1e-6), (point[axes[1]] - low[axes[1]]) / max(size[axes[1]], 1e-6)) for point in array]
    emit(surface, matrix, array, uvs, tint, **look)


def lathe(surface, matrix, centre, profile, sides, skin, tint=WHITE, caps='', depth=1.0, **look):
    """Turns a profile of (radius, height) pairs round the vertical. `caps` closes the 'b'ottom, the 't'op, or both."""
    rings = [ring(centre, radius, sides, centre[1] + height, radius * depth) for radius, height in profile]
    for low, high in zip(rings, rings[1:]):
        loft(surface, matrix, low, high, skin, tint, **look)
    if 'b' in caps:
        cap(surface, matrix, rings[0], skin, tint, up=False, **look)
    if 't' in caps:
        cap(surface, matrix, rings[-1], skin, tint, up=True, **look)


def pipe(surface, matrix, points, radius, sides, skin, tint=WHITE, **look):
    """A round pipe along a path. Each bend gets one mitred ring."""
    points = [np.asarray(point, float) for point in points]
    rings = []
    side = None
    for index, point in enumerate(points):
        before = point - points[index - 1] if index else points[1] - point
        after = points[index + 1] - point if index < len(points) - 1 else before
        before, after = before / np.linalg.norm(before), after / np.linalg.norm(after)
        along = before + after
        along = along / np.linalg.norm(along)
        seed = side if side is not None else (np.array([0.0, 1.0, 0.0]) if abs(along[1]) < 0.9 else np.array([1.0, 0.0, 0.0]))
        side = np.cross(along, seed)
        side = side / np.linalg.norm(side)
        other = np.cross(side, along)
        # A mitre is wider than the pipe, by the bend.
        stretch = 1 / max(0.5, float(np.dot(before, along)))
        rings.append([point + (side * math.sin(i / sides * math.tau) + other * math.cos(i / sides * math.tau)) * radius * stretch for i in range(sides)])
    for low, high in zip(rings, rings[1:]):
        loft(surface, matrix, low, high, skin, tint, **look)


def stand_of(prop, turn=0.0):
    """A prop's own frame: the origin is the middle of its box and +z is its front."""
    sideways = prop['facing'] in ('+x', '-x')
    size = prop['size']
    return frame(prop['position'], YAWS[prop['facing']] + turn), size[2 if sideways else 0], size[1], size[0 if sideways else 2]


# ---------------------------------------------------------------- the room

WORLD = frame()
# Where each wall, the floor, and the ceiling lie on the light map: the left and the bottom of each island, in pixels from the bottom left.
ISLANDS = {'floor': (2, 2), 'ceiling': (94, 2), 'left': (2, 158), 'right': (2, 199), 'back': (158, 158), 'front': (158, 199)}


def light_uv(island, a, b):
    left, low = ISLANDS[island]
    return ((left + a * LUXELS) / LM_SIZE, 1 - (low + b * LUXELS) / LM_SIZE)


def find(tag):
    return [prop for prop in PLAN['props'] if prop['_tag'] == tag]


def window_hole():
    pane = find('ChamberWindow')[0]
    (x, y, _), (w, h, _) = pane['position'], pane['size']
    rim = 0.2
    return (x - w / 2 + rim, x + w / 2 - rim, y - h / 2 + rim, y + h / 2 - rim)


def door_hole():
    door = find('Door')[0]
    (_, y, z), (_, h, d) = door['position'], door['size']
    return (z - d / 2, z + d / 2, y - h / 2, y + h / 2)


def build_room():
    x0, x1, z0, z1 = ROOM['minX'], ROOM['maxX'], ROOM['minZ'], ROOM['maxZ']
    height = CEILING - FLOOR
    tile = Tile(2.0)

    def flat(surface, island, y, corners):
        uvs = [(px / 2, pz / 2) for px, _, pz in corners]
        emit(surface, WORLD, corners, uvs, uv1=[light_uv(island, px - x0, pz - z0) for px, _, pz in corners])
    flat('floor', 'floor', FLOOR, [(x0, FLOOR, z1), (x1, FLOOR, z1), (x1, FLOOR, z0), (x0, FLOOR, z0)])
    flat('ceiling', 'ceiling', CEILING, [(x0, CEILING, z0), (x1, CEILING, z0), (x1, CEILING, z1), (x0, CEILING, z1)])

    def wall(side, a0, a1, y0, y1):
        if a1 - a0 < 1e-6 or y1 - y0 < 1e-6:
            return
        # The wall texture runs once from the ceiling to the floor, and repeats every two units along the wall.
        spots = [(a0, y0), (a1, y0), (a1, y1), (a0, y1)]
        if side == 'back':
            corners = [(a, y, z0) for a, y in spots]
            offset = x0
        elif side == 'front':
            corners = [(x0 + x1 - a, y, z1) for a, y in spots]
            offset = x0
        elif side == 'left':
            corners = [(x0, y, z0 + z1 - a) for a, y in spots]
            offset = z0
        else:
            corners = [(x1, y, a) for a, y in spots]
            offset = z0
        lit = [((x0 + x1 - a) if side == 'front' else (z0 + z1 - a) if side == 'left' else a) for a, _ in spots]
        emit('wall', WORLD, corners, [(a / 2, (CEILING - y) / height) for a, y in spots],
             uv1=[light_uv(side, along - offset, y - FLOOR) for along, (_, y) in zip(lit, spots)])

    def holed(side, a0, a1, hole):
        h0, h1, low, high = hole
        wall(side, a0, h0, FLOOR, CEILING)
        wall(side, h1, a1, FLOOR, CEILING)
        wall(side, h0, h1, FLOOR, low)
        wall(side, h0, h1, high, CEILING)
    holed('back', x0, x1, window_hole())
    holed('right', z0, z1, door_hole())
    wall('left', z0, z1, FLOOR, CEILING)
    wall('front', x0, x1, FLOOR, CEILING)
    _ = tile


# ---------------------------------------------------------------- the props

PLAIN = Cell('white')
METAL_AVG = np.array(ALBEDO['metal'])


def paint(name, gain=1.0):
    """A tint that brings the metal swatch to a brand colour. The swatch keeps its scratches."""
    return INK[name] * gain / METAL_AVG


def flat(name, gain=1.0):
    """A plain brand colour, for small parts on the white cell."""
    return INK[name] * gain


def wall_z(prop):
    """Where the wall behind a wall prop lies, along the prop's own z. The plan leaves some props a little off the wall."""
    x, _, z = prop['position']
    return -{'+z': z - ROOM['minZ'], '-z': ROOM['maxZ'] - z, '+x': x - ROOM['minX'], '-x': ROOM['maxX'] - x}[prop['facing']]


def rect_z(cx, cy, z, w, h):
    """A rectangle that faces along z, in the order that a loft toward -z needs."""
    return [(cx + w / 2, cy + h / 2, z), (cx + w / 2, cy - h / 2, z), (cx - w / 2, cy - h / 2, z), (cx - w / 2, cy + h / 2, z)]


def handle(m, x, y, z, length=0.3, tint=None, upright=False):
    """A bar handle on two posts, on a face that looks along +z."""
    tint = flat('cream', 0.85) if tint is None else tint
    size = (0.028, length, 0.028) if upright else (length, 0.028, 0.028)
    box('atlas', m, (x, y, z + 0.045), size, PLAIN, tint)
    for end in (-1, 1):
        offset = end * (length / 2 - 0.03)
        box('atlas', m, (x, y + offset, z + 0.02) if upright else (x + offset, y, z + 0.02), (0.024, 0.024, 0.04), PLAIN, flat('chitin', 1.2), skip='+z-z')


def label_holder(m, x, y, z, w=0.2, h=0.09):
    """A card holder: a thin frame with a blank card in it."""
    box('atlas', m, (x, y, z + 0.006), (w, h, 0.012), PLAIN, flat('chitin', 1.4), skip='-z')
    quad('atlas', m, [(x - w / 2 + 0.015, y - h / 2 + 0.015, z + 0.013), (x + w / 2 - 0.015, y - h / 2 + 0.015, z + 0.013),
                      (x + w / 2 - 0.015, y + h / 2 - 0.015, z + 0.013), (x - w / 2 + 0.015, y + h / 2 - 0.015, z + 0.013)], PLAIN, flat('cream', 0.95))


def build_desk(prop):
    m, w, h, d = stand_of(prop)
    wood, steel = Cell('laminate', 2.0), metal()
    top, plinth = h / 2, -h / 2
    body, dark = WHITE * 1.25, paint('chitin', 0.8)
    # The top: a laminate slab with a dark edge band, a little wider than the pedestals.
    box('atlas', m, (0, top - 0.035, 0), (w, 0.07, d), wood, step=0.38, skins={name: metal() for name in ('+z', '-z', '+x', '-x', '-y')},
        tints={name: paint('bruise', 0.9) for name in ('+z', '-z', '+x', '-x', '-y')})
    for side in (-1, 1):
        x = side * (w / 2 - 0.42)
        box('atlas', m, (x, plinth + 0.05, -0.02), (0.66, 0.1, d - 0.2), steel, dark, skip='+y-y')
        box('atlas', m, (x, (plinth + 0.1 + top - 0.07) / 2, -0.01), (0.74, h - 0.17, d - 0.1), steel, body, step=0.5, skip='+y-y')
        # Drawer fronts stand proud of the pedestal. The right pedestal has three, the left has two.
        fronts = [0.3, 0.3, 0.44] if side > 0 else [0.3, 0.74]
        y = top - 0.1
        for tall in fronts:
            box('atlas', m, (x, y - tall / 2, d / 2 - 0.045), (0.68, tall - 0.03, 0.03), steel, body * 1.1, skip='-z')
            handle(m, x, y - 0.1, d / 2 - 0.03)
            y -= tall
    # The modesty panel closes the back of the kneehole.
    box('atlas', m, (0, 0.1, -d / 2 + 0.12), (w - 1.56, h - 0.5, 0.04), steel, body * 0.9, step=0.5, skip='+x-x')


def build_monitor(prop):
    m, w, h, d = stand_of(prop)
    case = Cell('plastic', 1.0)
    low = -h / 2
    # The computer lies flat under the monitor, as desktop cases of the time did.
    box('atlas', m, (0, low + 0.085, 0), (0.78, 0.17, 0.74), case, skip='-y')
    front = 0.37
    box('atlas', m, (-0.17, low + 0.1, front), (0.32, 0.05, 0.012), PLAIN, flat('beige', 0.8), skip='-z')
    box('atlas', m, (0.2, low + 0.11, front), (0.2, 0.014, 0.008), PLAIN, flat('night', 2), skip='-z')
    box('atlas', m, (0.3, low + 0.05, front), (0.05, 0.03, 0.012), PLAIN, flat('beige', 0.7), skip='-z')
    quad('atlas', m, [(0.2, low + 0.04, front + 0.002), (0.225, low + 0.04, front + 0.002), (0.225, low + 0.055, front + 0.002), (0.2, low + 0.055, front + 0.002)],
         PLAIN, kind='glow', value=INK['teal'] * 3, own=True)
    # A swivel foot, then the tube: a bezel at the front and a case that narrows to the back.
    lathe('atlas', m, (0, low + 0.17, 0.02), [(0.19, 0), (0.17, 0.035), (0.09, 0.035), (0.09, 0.08)], 8, case, WHITE * 0.85)
    base, top = low + 0.25, h / 2
    middle, tall = (base + top) / 2, top - base
    box('atlas', m, (0, middle, 0.3), (0.74, tall, 0.14), case, skip='-z')
    loft('atlas', m, rect_z(0, middle, 0.23, 0.7, tall - 0.04), rect_z(0, middle - 0.02, -0.36, 0.4, tall * 0.6), case, WHITE * 0.9)
    cap('atlas', m, rect_z(0, middle - 0.02, -0.36, 0.4, tall * 0.6), case, WHITE * 0.7)
    # The glass bulges a little, inside a dark surround.
    wide, high, glass = 0.56, tall - 0.14, front + 0.003
    centre = middle + 0.025
    quad('atlas', m, [(-wide / 2 - 0.02, centre - high / 2 - 0.02, glass - 0.002), (wide / 2 + 0.02, centre - high / 2 - 0.02, glass - 0.002),
                      (wide / 2 + 0.02, centre + high / 2 + 0.02, glass - 0.002), (-wide / 2 - 0.02, centre + high / 2 + 0.02, glass - 0.002)], PLAIN, flat('night', 1.5))
    picture = Cell('screen')
    across, up = 4, 3
    for i in range(across):
        for j in range(up):
            spots = [(i / across, j / up), ((i + 1) / across, j / up), ((i + 1) / across, (j + 1) / up), (i / across, (j + 1) / up)]
            emit('atlas', m, [(-wide / 2 + wide * a, centre - high / 2 + high * b, glass + 0.022 * (1 - (2 * a - 1) ** 2) * (1 - (2 * b - 1) ** 2)) for a, b in spots],
                 [picture.uv((0, 0, 1, 1), a, b) for a, b in spots], kind='glow', value=WHITE * 1.15, own=True)
    for index in range(3):
        box('atlas', m, (0.12 + index * 0.07, base + 0.035, front), (0.04, 0.022, 0.012), PLAIN, flat('beige', 0.75), skip='-z')
    quad('atlas', m, [(-0.3, base + 0.027, front + 0.002), (-0.28, base + 0.027, front + 0.002), (-0.28, base + 0.043, front + 0.002), (-0.3, base + 0.043, front + 0.002)],
         PLAIN, kind='glow', value=INK['teal'] * 3, own=True)


def build_keyboard(prop):
    m, w, h, d = stand_of(prop)
    case = Cell('plastic', 1.0)
    low = -h / 2
    # A wedge: low at the front, higher at the back.
    front = [(-w / 2, low, d / 2), (w / 2, low, d / 2), (w / 2, low + 0.03, d / 2), (-w / 2, low + 0.03, d / 2)]
    back = [(w / 2, low, -d / 2), (-w / 2, low, -d / 2), (-w / 2, low + h, -d / 2), (w / 2, low + h, -d / 2)]
    quad('atlas', m, front, case)
    quad('atlas', m, back, case, WHITE * 0.8)
    quad('atlas', m, [front[3], front[2], back[3], back[2]], case)
    quad('atlas', m, [back[1], front[0], front[3], back[2]], case, WHITE * 0.85)
    quad('atlas', m, [front[1], back[0], back[3], front[2]], case, WHITE * 0.85)
    inset = 0.025
    lift = lambda z: low + 0.03 + (h - 0.03) * (d / 2 - z) / d + 0.004
    quad('marks', m, [(-w / 2 + inset, lift(d / 2 - inset), d / 2 - inset), (w / 2 - inset, lift(d / 2 - inset), d / 2 - inset),
                      (w / 2 - inset, lift(-d / 2 + inset), -d / 2 + inset), (-w / 2 + inset, lift(-d / 2 + inset), -d / 2 + inset)], Sheet('keys'))
    # The cable runs back to the computer.
    pipe('atlas', m, [(0.2, low + 0.02, -d / 2), (0.24, low + 0.012, -d / 2 - 0.08), (0.1, low + 0.012, -d / 2 - 0.16)], 0.012, 4, PLAIN, flat('beige', 0.6))


def build_mug(prop):
    m, w, h, d = stand_of(prop)
    radius = w * 0.36
    lathe('atlas', m, (0, 0, 0), [(radius * 0.92, -h / 2), (radius, -h / 2 + 0.03), (radius, h / 2)], 8, PLAIN, flat('rust', 1.1), caps='b')
    # The coffee sits a little under the rim.
    lathe('atlas', m, (0, 0, 0), [(radius, h / 2), (radius - 0.015, h / 2), (radius - 0.015, h / 2 - 0.03)], 8, PLAIN, flat('rust', 0.7))
    cap('atlas', m, ring((0, 0, 0), radius - 0.015, 8, h / 2 - 0.03), PLAIN, flat('bruise', 0.35))
    grip = [(radius * 0.95 + 0.065 * math.sin(step / 4 * math.pi), 0.07 * (1 - 2 * step / 4), 0) for step in range(5)]
    pipe('atlas', m, grip, 0.014, 4, PLAIN, flat('rust', 1.1))
    # The label faces the room. A name can go on it later.
    reach = radius * math.cos(math.pi / 8) + 0.003
    quad('marks', m, [(-0.04, -0.045, reach), (0.04, -0.045, reach), (0.04, 0.045, reach), (-0.04, 0.045, reach)], Sheet('label'))


def build_chair(prop):
    m, w, h, d = stand_of(prop, 0.55)
    cloth, steel = Cell('fabric', 1.0), metal()
    dark = paint('chitin', 0.9)
    low = -h / 2
    # Five legs on casters round a hub.
    for leg in range(5):
        spoke = m @ frame(yaw=leg / 5 * math.tau)
        quad('atlas', spoke, [(-0.03, low + 0.085, 0.44), (0.03, low + 0.085, 0.44), (0.035, low + 0.11, 0.05), (-0.035, low + 0.11, 0.05)], steel, dark)
        for side in (-1, 1):
            quad('atlas', spoke, [(side * 0.035, low + 0.06, 0.05), (side * 0.03, low + 0.06, 0.44), (side * 0.03, low + 0.085, 0.44), (side * 0.035, low + 0.11, 0.05)][::-side], steel, dark * 0.8)
        quad('atlas', spoke, [(-0.03, low + 0.06, 0.44), (0.03, low + 0.06, 0.44), (0.03, low + 0.085, 0.44), (-0.03, low + 0.085, 0.44)], steel, dark * 0.8)
        box('atlas', spoke, (0, low + 0.03, 0.41), (0.05, 0.06, 0.07), PLAIN, flat('night', 2.5), skip='+y')
    lathe('atlas', m, (0, low + 0.05, 0), [(0.075, 0), (0.075, 0.08), (0.04, 0.1), (0.04, 0.32), (0.028, 0.32), (0.028, 0.56)], 6, steel, dark * 1.3)
    seat = low + 0.62
    # The seat: a plate, then a cushion with a softer front edge.
    box('atlas', m, (0, seat - 0.02, 0), (0.5, 0.04, 0.5), PLAIN, flat('night', 2.5), skip='+y')
    box('atlas', m, (0, seat + 0.05, 0.02), (0.66, 0.1, 0.62), cloth, step=0.35, skip='-y')
    # The back leans a little. A steel bar carries it.
    lean = m @ frame((0, seat + 0.1, -0.3)) @ turn_x(-0.14)
    box('atlas', lean, (0, 0.2, -0.03), (0.09, 0.5, 0.03), steel, dark)
    box('atlas', lean, (0, 0.46, 0.02), (0.6, 0.56, 0.09), cloth, step=0.35)
    for side in (-1, 1):
        box('atlas', m, (side * 0.37, seat + 0.14, 0.02), (0.035, 0.24, 0.05), steel, dark, skip='+y-y')
        box('atlas', m, (side * 0.37, seat + 0.275, 0.03), (0.07, 0.035, 0.34), PLAIN, flat('night', 2.5))


def build_whiteboard(prop):
    m, w, h, d = stand_of(prop)
    rail = paint('wing', 1.3)
    face = d / 2 - 0.03
    wall = wall_z(prop)
    middle, d = (d / 2 + wall) / 2, d / 2 - wall
    # An aluminium frame, the board, and a tray with markers and an eraser.
    box('atlas', m, (0, h / 2 - 0.03, middle), (w, 0.06, d), metal(), rail, skip='-z')
    box('atlas', m, (0, -h / 2 + 0.03, middle), (w, 0.06, d), metal(), rail, skip='-z')
    for side in (-1, 1):
        box('atlas', m, (side * (w / 2 - 0.03), 0, middle), (0.06, h - 0.12, d), metal(), rail, skip='-z+y-y')
    quad('marks', m, [(-w / 2 + 0.06, -h / 2 + 0.06, face), (w / 2 - 0.06, -h / 2 + 0.06, face), (w / 2 - 0.06, h / 2 - 0.06, face), (-w / 2 + 0.06, h / 2 - 0.06, face)], Sheet('whiteboard'), WHITE * 0.82, step=0.6)
    d = prop['size'][2]
    tray = -h / 2 - 0.015
    box('atlas', m, (0, tray, d / 2 + 0.06), (w * 0.7, 0.025, 0.13), metal(), rail * 0.9)
    box('atlas', m, (0, tray + 0.02, d / 2 + 0.12), (w * 0.7, 0.03, 0.012), metal(), rail)
    for x, ink in ((-0.62, 'rust'), (-0.36, 'teal'), (0.3, 'chitin')):
        lying = m @ frame((x, tray + 0.032, d / 2 + 0.06)) @ turn_z(math.pi / 2)
        lathe('atlas', lying, (0, 0, 0), [(0.02, -0.09), (0.02, 0.05)], 6, PLAIN, flat('cream', 0.95), caps='b')
        lathe('atlas', lying, (0, 0, 0), [(0.021, 0.05), (0.021, 0.09)], 6, PLAIN, flat(ink, 1.2), caps='t')
    box('atlas', m, (0.72, tray + 0.035, d / 2 + 0.06), (0.17, 0.045, 0.07), PLAIN, flat('chitin', 1.6), tints={'-y': flat('cream')})


def build_jar_shelf(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    body = paint('olive', 0.95)
    low, top = -h / 2, h / 2
    # A lab bench: a dark plinth, a steel carcass with four doors, and a dark worktop with a low back.
    box('atlas', m, (0, low + 0.06, -0.03), (w - 0.1, 0.12, d - 0.16), steel, paint('night', 4), skip='+y-y')
    box('atlas', m, (0, (low + 0.12 + top - 0.06) / 2, -0.01), (w, h - 0.18, d - 0.06), steel, body, step=0.6, skip='+y-y')
    box('atlas', m, (0, top - 0.03, 0), (w + 0.04, 0.06, d + 0.02), steel, paint('chitin', 1.25), step=0.4)
    box('atlas', m, (0, top + 0.06, -d / 2 + 0.03), (w + 0.04, 0.12, 0.05), steel, paint('chitin', 1.25), skip='-y')
    doors = 4
    span = (w - 0.08) / doors
    for index in range(doors):
        x = -w / 2 + 0.04 + span * (index + 0.5)
        box('atlas', m, (x, 0.0, d / 2 - 0.03), (span - 0.035, h - 0.3, 0.03), steel, body * 1.12, step=0.6, skip='-z')
        handle(m, x + (0.32 if index % 2 == 0 else -0.32), 0.25, d / 2 - 0.015, 0.26, upright=True)
        label_holder(m, x, 0.48, d / 2 - 0.015)


def build_jar(prop, index):
    m, w, h, d = stand_of(prop)
    low = -h / 2
    radius = w / 2 - 0.02
    glass = Cell('glass')
    part = (0.05, 0.05, 0.95, 0.95)
    shell = [(radius * 0.9, low), (radius, low + 0.05), (radius, low + 0.36), (radius * 0.72, low + 0.45), (radius * 0.72, low + 0.49)]
    rings = [ring((0, 0, 0), r, 10, y) for r, y in shell]
    for a, b in zip(rings, rings[1:]):
        loft('glass', m, a, b, glass, rect=part, kind='glass', value=(0.02, 0.05, 0.05, 0.14))
    # The lid is steel, with a rim.
    lathe('atlas', m, (0, low + 0.47, 0), [(radius * 0.78, 0), (radius * 0.78, 0.06), (radius * 0.7, 0.075)], 10, metal(), paint('chitin', 1.3), caps='t')
    if prop['contents'] == 'empty':
        return
    # Each full jar holds a different lump in a different fluid.
    fluid = [INK['olive'], INK['rust'], INK['teal'], INK['bruise'], INK['cream']][index % 5]
    level = low + 0.33
    lathe('glass', m, (0, 0, 0), [(radius * 0.86, low + 0.02), (radius * 0.94, low + 0.06), (radius * 0.94, level)], 10, glass, kind='glass', value=(*(fluid * 0.5), 0.5))
    cap('glass', m, ring((0, 0, 0), radius * 0.94, 10, level), glass, kind='glass', value=(*(fluid * 0.8), 0.5))
    lump = m @ frame((0, low + 0.03, 0), index * 1.3)
    flesh = Cell('organic')
    tint = [WHITE, INK['cream'] * 1.4, WHITE * 0.8, INK['cream'] * 1.3, INK['rust'] * 2.2][index % 5]
    # The lump is a soft, lopsided shape: each ring has its own width, its own lean, and its own squash.
    shape = [(0.04, 0.0), (0.085 + 0.02 * (index % 2), 0.045), (0.105, 0.1), (0.09 + 0.015 * (index % 3), 0.16), (0.06, 0.21), (0.025, 0.245)]
    rings = [ring((0.012 * math.sin(level * 2.3 + index), 0, 0.01 * math.cos(level * 3.1 + index)), radius_at, 8, height, radius_at * (0.72 + 0.1 * math.sin(level * 1.7 + index)))
             for level, (radius_at, height) in enumerate(shape)]
    for below, above in zip(rings, rings[1:]):
        loft('atlas', lump, below, above, flesh, tint)
    cap('atlas', lump, rings[-1], flesh, tint)


def build_window(prop):
    m, w, h, d = stand_of(prop)
    rim = 0.2
    wall = wall_z(prop)
    back = wall - 0.3
    stripes = Cell('hazard', part=(0, 0, 1, 0.57))
    steel = metal()
    # The hazard frame stands proud of the wall. Each piece shows the stripes at their real size.

    def bar(centre, size, long):
        repeats = max(1, round(long / 0.7))
        for index in range(repeats):
            share = (index + 0.5) / repeats - 0.5
            if size[0] > size[1]:
                box('atlas', m, (centre[0] + share * size[0], centre[1], centre[2]), (size[0] / repeats, size[1], size[2]), stripes, skip='-z', skins={name: steel for name in ('+x', '-x', '+y', '-y')},
                    tints={name: paint('chitin') for name in ('+x', '-x', '+y', '-y')})
            else:
                turned = m @ frame((centre[0], centre[1] + share * size[1], centre[2])) @ turn_z(math.pi / 2)
                box('atlas', turned, (0, 0, 0), (size[1] / repeats, size[0], size[2]), stripes, skip='-z', skins={name: steel for name in ('+x', '-x', '+y', '-y')},
                    tints={name: paint('chitin') for name in ('+x', '-x', '+y', '-y')})
    bar((0, h / 2 - rim / 2, wall + 0.04), (w, rim, 0.08), w)
    bar((0, -h / 2 + rim / 2, wall + 0.04), (w, rim, 0.08), w)
    for side in (-1, 1):
        bar((side * (w / 2 - rim / 2), 0, wall + 0.04), (rim, h - rim * 2, 0.08), h - rim * 2)
    # The reveal is the thickness of the wall, in dark steel. The glass sits deep in it, with a post in the middle.
    inner_w, inner_h = w - rim * 2, h - rim * 2
    dark = paint('chitin', 0.9)
    quad('atlas', m, [(-inner_w / 2, -inner_h / 2, wall + 0.08), (inner_w / 2, -inner_h / 2, wall + 0.08), (inner_w / 2, -inner_h / 2, back), (-inner_w / 2, -inner_h / 2, back)], steel, dark, step=1.0)
    quad('atlas', m, [(-inner_w / 2, inner_h / 2, back), (inner_w / 2, inner_h / 2, back), (inner_w / 2, inner_h / 2, wall + 0.08), (-inner_w / 2, inner_h / 2, wall + 0.08)], steel, dark, step=1.0)
    quad('atlas', m, [(-inner_w / 2, -inner_h / 2, wall + 0.08), (-inner_w / 2, -inner_h / 2, back), (-inner_w / 2, inner_h / 2, back), (-inner_w / 2, inner_h / 2, wall + 0.08)], steel, dark)
    quad('atlas', m, [(inner_w / 2, -inner_h / 2, back), (inner_w / 2, -inner_h / 2, wall + 0.08), (inner_w / 2, inner_h / 2, wall + 0.08), (inner_w / 2, inner_h / 2, back)], steel, dark)
    box('atlas', m, (0, -inner_h / 2 - 0.02, wall + 0.11), (inner_w + 0.2, 0.04, 0.1), steel, paint('wing', 1.1))
    pane = Cell('glass')
    for half in (0, 1):
        x0, x1 = -inner_w / 2 + inner_w / 2 * half, inner_w / 2 * half
        quad('glass', m, [(x0, -inner_h / 2, wall - 0.14), (x1, -inner_h / 2, wall - 0.14), (x1, inner_h / 2, wall - 0.14), (x0, inner_h / 2, wall - 0.14)], pane,
             kind='glass', value=(0.01, 0.035, 0.04, 0.1))


def build_clock(prop):
    m, w, h, d = stand_of(prop)
    # A deep rim round a recessed face. The rim lies on its side, so its open end faces the room.
    flatways = m @ turn_x(math.pi / 2)
    lathe('atlas', flatways, (0, 0, 0), [(w / 2, wall_z(prop)), (w / 2, d / 2), (w / 2 - 0.035, d / 2), (w / 2 - 0.035, d / 2 - 0.04)], 12, metal(), paint('chitin', 1.3))
    face = d / 2 - 0.04
    quad('marks', m, [(-w / 2 + 0.03, -h / 2 + 0.03, face), (w / 2 - 0.03, -h / 2 + 0.03, face), (w / 2 - 0.03, h / 2 - 0.03, face), (-w / 2 + 0.03, h / 2 - 0.03, face)], Sheet('clock'))
    # The two slow hands are fixed. The second hand is its own part: the site turns it with scene time.
    for angle, length in ((-1.05, 0.11), (1.9, 0.16)):
        box('atlas', m @ turn_z(-angle), (0, length / 2, face + 0.008), (0.028, length, 0.006), PLAIN, flat('night', 2), skip='-z')
    origin = place(m, [(0, 0, face + 0.016)])[0]
    NODE_ORIGINS['second-hand'] = origin
    quad('atlas', m, [(-0.008, -0.03, face + 0.016), (0.008, -0.03, face + 0.016), (0.008, 0.19, face + 0.016), (-0.008, 0.19, face + 0.016)], PLAIN, flat('rust', 1.3), node='second-hand')


def build_cabinet(prop, index):
    m, w, h, d = stand_of(prop)
    steel = metal()
    body = WHITE * 1.2
    low = -h / 2
    box('atlas', m, (0, low + 0.04, -0.02), (w - 0.06, 0.08, d - 0.08), steel, paint('night', 4), skip='+y-y')
    box('atlas', m, (0, 0.04, -0.015), (w, h - 0.08, d - 0.03), steel, body, step=0.6, skip='-y')
    drawers = 4
    tall = (h - 0.14) / drawers
    for drawer in range(drawers):
        y = low + 0.1 + tall * (drawer + 0.5)
        # One drawer of the second cabinet stands a little open.
        out = 0.14 if index == 1 and drawer == 2 else 0
        face = d / 2 - 0.005 + out
        box('atlas', m, (0, y, face - 0.015 - out / 2), (w - 0.06, tall - 0.03, 0.03 + out), steel, body * 1.1, step=0.6, skip='-z')
        handle(m, 0, y - 0.1, face, 0.34)
        label_holder(m, 0, y + 0.14, face)
    box('atlas', m, (w / 2 - 0.1, h / 2 - 0.12, d / 2 + 0.002), (0.045, 0.045, 0.014), PLAIN, flat('cream', 0.7), skip='-z')


def build_door(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    frame_tint = paint('wing', 0.75)
    wall = wall_z(prop)
    far = wall - 0.3
    low = -h / 2
    # The frame lines the hole through the wall and stands a little proud of it.
    for side in (-1, 1):
        box('atlas', m, (side * (w / 2 + 0.03), 0, (wall + 0.06 + far) / 2), (0.22, h, wall + 0.06 - far), steel, frame_tint, step=1.2, skip='+y-y')
    box('atlas', m, (0, h / 2 + 0.03, (wall + 0.06 + far) / 2), (w + 0.28, 0.22, wall + 0.06 - far), steel, frame_tint, skip='+y')
    box('atlas', m, (0, low + 0.012, (wall + far) / 2), (w - 0.16, 0.024, 0.34), steel, paint('wing', 0.9), skip='-y')
    # The leaf hangs on the far jamb. It stands ajar into the room when the corridor is built. A shut door has a dark panel behind its gaps.
    if not CORRIDOR:
        quad('atlas', m, [(-w / 2, low, far), (w / 2, low, far), (w / 2, h / 2, far), (-w / 2, h / 2, far)], PLAIN, flat('night'))
    # A shut leaf sits near the room's face of the wall, where the tubes still reach it.
    swing = m @ frame((-w / 2 + 0.08, 0, wall - (0.1 if CORRIDOR else 0.02)), -math.radians(12 if CORRIDOR else 0))
    leaf_w, leaf_h = w - 0.18, h - 0.1
    art = Cell('door')
    box('atlas', swing, (leaf_w / 2, -0.03, 0), (leaf_w, leaf_h, 0.07), art, step=1.0, skins={name: steel for name in ('+x', '-x', '+y', '-y')},
        tints={name: paint('bruise', 1.1) for name in ('+x', '-x', '+y', '-y')})
    for face in (1, -1):
        z = face * 0.035
        box('atlas', swing, (leaf_w - 0.13, -0.38, z + face * 0.008), (0.08, 0.24, 0.016), steel, paint('wing', 1.2))
        box('atlas', swing, (leaf_w - 0.13, -0.33, z + face * 0.04), (0.03, 0.03, 0.06), PLAIN, flat('chitin', 1.5))
        box('atlas', swing, (leaf_w - 0.2, -0.33, z + face * 0.065), (0.18, 0.032, 0.026), steel, paint('wing', 1.3))
    for y in (-1.3, 0, 1.3):
        lathe('atlas', swing, (-0.02, y - 0.03, 0.04), [(0.03, -0.09), (0.03, 0.09)], 6, steel, paint('chitin', 1.4), caps='bt')
    # A lamp over the door, the sign plate beside it, and a keypad on a conduit.
    box('atlas', m, (0, h / 2 + 0.3, wall + 0.05), (0.56, 0.18, 0.1), steel, frame_tint)
    quad('atlas', m, [(-0.24, h / 2 + 0.24, wall + 0.102), (0.24, h / 2 + 0.24, wall + 0.102), (0.24, h / 2 + 0.36, wall + 0.102), (-0.24, h / 2 + 0.36, wall + 0.102)],
         PLAIN, kind='glow', value=INK['teal'] * 2.2, own=True)
    side = w / 2 + 0.62
    # The plan places the keypad: it is the switch of the room's tubes, and he walks to it. The door's frame turns the plan's place into its own.
    plate_x, plate_y = (np.linalg.inv(m) @ np.array([*PLAN['lightSwitch'], 1.0]))[:2]
    box('atlas', m, (side, 0.5, wall + 0.015), (0.62, 0.3, 0.03), steel, frame_tint, skip='-z')
    quad('marks', m, [(side - 0.28, 0.395, wall + 0.032), (side + 0.28, 0.395, wall + 0.032), (side + 0.28, 0.605, wall + 0.032), (side - 0.28, 0.605, wall + 0.032)], Sheet('sign'))
    box('atlas', m, (plate_x, plate_y, wall + 0.03), (0.3, 0.3, 0.06), steel, paint('wing', 1.1), skip='-z', skins={'+z': Cell('keypad')}, tints={'+z': WHITE})
    pipe('atlas', m, [(plate_x, plate_y + 0.15, wall + 0.03), (plate_x, 0.3, wall + 0.03)], 0.02, 5, steel, paint('wing', 1.2))
    pipe('atlas', m, [(plate_x, 0.7, wall + 0.03), (plate_x, CEILING - prop['position'][1], wall + 0.03)], 0.02, 5, steel, paint('wing', 1.2))


def build_vending(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    body = paint('bruise', 1.6)
    low = -h / 2
    box('atlas', m, (0, low + 0.06, -0.02), (w - 0.08, 0.12, d - 0.1), steel, paint('night', 4), skip='+y-y')
    box('atlas', m, (0, 0.06, -0.01), (w, h - 0.12, d - 0.02), steel, body, step=0.8, skip='-y+z')
    # The front is one picture of the machine. Its window shines, and the rest takes the room's light.
    front = d / 2 - 0.02
    art = Cell('vending')
    left, right, bottom, top = -w / 2 + 0.03, w / 2 - 0.03, low + 0.14, h / 2 - 0.03

    def piece(s0, t0, s1, t1, z, **look):
        quad('atlas', m, [(left + (right - left) * s0, bottom + (top - bottom) * t0, z), (left + (right - left) * s1, bottom + (top - bottom) * t0, z),
                          (left + (right - left) * s1, bottom + (top - bottom) * t1, z), (left + (right - left) * s0, bottom + (top - bottom) * t1, z)], art, rect=(s0, t0, s1, t1), **look)
    window = (0.03, 0.22, 0.735, 0.98)
    piece(0, 0, 1, window[1], front, step=0.8)
    piece(0, window[3], 1, 1, front)
    piece(0, window[1], window[0], window[3], front)
    piece(window[2], window[1], 1, window[3], front, step=0.8)
    piece(*window, front - 0.01, kind='glow', value=WHITE * 1.05, own=True)
    # The buttons and the coin plate stand proud. Each shows its own piece of the picture, so the two agree.
    def proud(s, t, across, up, depth):
        rect = (s - across / 2, t - up / 2, s + across / 2, t + up / 2)
        box('atlas', m, (left + (right - left) * s, bottom + (top - bottom) * t, front + depth / 2), ((right - left) * across, (top - bottom) * up, depth), steel, body * 0.9,
            skip='-z', skins={'+z': Cell('vending', part=rect)}, tints={'+z': WHITE})
    for row in range(5):
        for column in (0.83, 0.93):
            proud(column, 0.689 - row * 0.05, 0.075, 0.037, 0.022)
    proud(0.885, 0.875, 0.16, 0.1, 0.03)
    box('atlas', m, (0, low + 0.2, front + 0.02), (w - 0.1, 0.04, 0.04), steel, body * 0.8)


def build_lamp(prop):
    m, w, h, d = stand_of(prop)
    low = -h / 2
    dark = flat('chitin', 1.5)
    lathe('atlas', m, (0, low, 0), [(0.13, 0), (0.12, 0.025), (0.03, 0.035)], 8, PLAIN, dark, caps='b')
    elbow, head = (-0.02, low + 0.34, -0.1), (0.1, low + 0.46, 0.08)
    pipe('atlas', m, [(0, low + 0.03, 0), elbow, head], 0.013, 4, PLAIN, flat('cream', 0.8))
    # The shade tips toward the desk, with the bulb inside.
    shade = m @ frame(head) @ turn_x(0.5) @ turn_z(-0.25)
    lathe('atlas', shade, (0, 0, 0), [(0.11, -0.1), (0.05, 0.02), (0.035, 0.05)], 8, PLAIN, flat('rust', 1.2))
    cap('atlas', shade, ring((0, 0, 0), 0.035, 8, 0.05), PLAIN, flat('rust', 1.2))
    cap('atlas', shade, ring((0, 0, 0), 0.1, 8, -0.085), PLAIN, up=False, kind='glow', value=INK['cream'] * 2.4, own=True)


def build_papers(prop):
    m, w, h, d = stand_of(prop)
    sheet = Cell('paper')
    # A rust folder, a stack of paper on it, and one loose sheet at an angle.
    box('atlas', m, (0.02, -h / 2 + 0.008, 0), (w, 0.016, d), PLAIN, flat('rust', 1.0), skip='-y')
    box('atlas', m, (-0.03, -h / 2 + 0.03, 0.01), (w - 0.1, 0.03, d - 0.06), PLAIN, flat('cream', 0.9), skip='-y', skins={'+y': sheet}, tints={'+y': WHITE})
    loose = m @ frame((0.05, -h / 2 + 0.048, 0.0), 0.3)
    quad('atlas', loose, [(-0.2, 0, 0.15), (0.2, 0, 0.15), (0.2, 0, -0.15), (-0.2, 0, -0.15)], sheet)


def build_extinguisher(prop):
    m, w, h, d = stand_of(prop)
    low = -h / 2
    red = paint('rust', 1.25)
    steel = metal(1.0)
    z = 0.0
    box('atlas', m, (0, 0.05, -d / 2 + 0.01), (0.18, 0.5, 0.02), steel, paint('chitin', 1.2), skip='-z')
    lathe('atlas', m, (0, low, z), [(0.1, 0), (0.115, 0.03), (0.115, 0.26), (0.117, 0.26), (0.117, 0.42), (0.115, 0.42), (0.115, 0.55), (0.085, 0.63), (0.04, 0.66), (0.04, 0.7)], 10, steel, red, caps='b')
    # A blank label band, then the valve, the lever, the gauge, and the hose.
    lathe('atlas', m, (0, low, z), [(0.1175, 0.27), (0.1175, 0.41)], 10, PLAIN, flat('cream', 0.9))
    box('atlas', m, (0, low + 0.725, z), (0.07, 0.05, 0.07), PLAIN, flat('chitin', 1.3))
    box('atlas', m @ frame((0, low + 0.765, z)) @ turn_z(0.0), (0.05, 0, 0), (0.2, 0.02, 0.035), PLAIN, flat('night', 2.5))
    box('atlas', m @ frame((0, low + 0.72, z)) @ turn_z(-0.25), (0.07, 0, 0), (0.16, 0.018, 0.03), PLAIN, flat('night', 2.5))
    lathe('atlas', m @ frame((0, low + 0.72, z + 0.05)) @ turn_x(math.pi / 2), (0, 0, 0), [(0.03, -0.012), (0.03, 0.012)], 6, PLAIN, flat('cream', 0.9), caps='t')
    pipe('atlas', m, [(-0.04, low + 0.72, z), (-0.13, low + 0.7, z + 0.02), (-0.15, low + 0.45, z + 0.03), (-0.14, low + 0.2, z + 0.03)], 0.017, 5, PLAIN, flat('night', 2.2))


def build_locker(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    body = paint('olive', 1.5)
    low = -h / 2
    art = Cell('locker')
    # Two doors, one over the other, under a sloped top.
    box('atlas', m, (0, low + 0.05, 0), (w - 0.06, 0.1, d - 0.06), steel, paint('night', 4), skip='+y-y')
    straight = h - 0.1 - 0.22
    box('atlas', m, (0, low + 0.1 + straight / 2, 0), (w, straight, d), steel, body, step=1.0, skip='+y-y')
    top = low + 0.1 + straight
    quad('atlas', m, [(-w / 2, top, d / 2), (w / 2, top, d / 2), (w / 2, top + 0.22, -d / 2), (-w / 2, top + 0.22, -d / 2)], steel, body * 1.1)
    for side in (-1, 1):
        emit('atlas', m, [(side * w / 2, top, d / 2), (side * w / 2, top, -d / 2), (side * w / 2, top + 0.22, -d / 2)][::side], [steel.uv((0, 0, 0.3, 0.1), a, b) for a, b in ((0, 0), (1, 0), (1, 1))][::side], body)
    tall = straight / 2
    for tier in range(2):
        y = low + 0.1 + tall * (tier + 0.5)
        box('atlas', m, (0, y, d / 2 + 0.008), (w - 0.04, tall - 0.03, 0.016), art, WHITE * 1.5, step=1.0, skip='-z', skins={name: steel for name in ('+x', '-x', '+y', '-y')},
            tints={name: body for name in ('+x', '-x', '+y', '-y')})


def build_corkboard(prop):
    m, w, h, d = stand_of(prop)
    box('atlas', m, (0, 0, 0), (w, h, d), Cell('corkboard'), step=0.8, skip='-z', skins={name: metal() for name in ('+x', '-x', '+y', '-y')},
        tints={name: paint('wing', 1.2) for name in ('+x', '-x', '+y', '-y')})


def build_chart(prop):
    m, w, h, d = stand_of(prop)
    # The paper hangs a little off the wall at the bottom, where it has curled.
    quad('atlas', m, [(-w / 2, -h / 2, d / 2 + 0.02), (w / 2, -h / 2, d / 2 + 0.02), (w / 2, h / 2, -d / 2 + 0.005), (-w / 2, h / 2, -d / 2 + 0.005)], Cell('chart'), step=0.7)


def build_wall_panel(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    box('atlas', m, (0, 0, 0), (w, h, d), steel, WHITE * 1.1, skip='-z', skins={'+z': Cell('panel')}, tints={'+z': WHITE})
    # Conduits leave it for the ceiling and the floor.
    for x in (-0.2, 0.1):
        pipe('atlas', m, [(x, h / 2, 0), (x, CEILING - prop['position'][1], 0)], 0.028, 5, steel, paint('wing', 1.2))
    pipe('atlas', m, [(0.2, -h / 2, 0), (0.2, FLOOR - prop['position'][1], 0)], 0.028, 5, steel, paint('wing', 1.2))
    for y in (h / 2 + 0.5, -h / 2 - 0.6):
        box('atlas', m, (0.2 if y < 0 else -0.05, y, -0.01), (0.12 if y < 0 else 0.42, 0.03, 0.07), steel, paint('chitin', 1.3), skip='-z')


def build_vent(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    box('atlas', m, (0, 0, 0), (w, h, d), steel, paint('wing', 1.4), skip='+y-y')
    quad('atlas', m, [(-w / 2, -h / 2, -d / 2), (w / 2, -h / 2, -d / 2), (w / 2, -h / 2, d / 2), (-w / 2, -h / 2, d / 2)], Cell('grille'))


def build_duct(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    tin = paint('wing', 1.25)
    # A sheet-metal duct under the ceiling, with a flange at each joint, straps to the ceiling, and one grille.
    box('atlas', m, (0, -0.03, 0), (w - 0.08, h - 0.1, d), steel, tin, step=1.4, skip='+y')
    joints = max(2, round(d / 1.4))
    for joint in range(joints + 1):
        z = -d / 2 + 0.03 + (d - 0.06) * joint / joints
        box('atlas', m, (0, -0.03, z), (w, h - 0.02, 0.05), steel, tin * 0.85, skip='+y')
        if joint % 2 == 1:
            for side in (-1, 1):
                box('atlas', m, (side * (w / 2 - 0.02), h / 2 - 0.03, z + 0.2), (0.02, 0.1, 0.06), steel, paint('chitin', 1.4), skip='+y-y')
    side = w / 2 - 0.04 + 0.004
    quad('atlas', m, [(side, -0.2, 0.9), (side, -0.2, 0.3), (side, 0.12, 0.3), (side, 0.12, 0.9)], Cell('grille'))


def build_pipe_run(prop):
    m, w, h, d = stand_of(prop)
    steel = metal()
    # Two pipes along the top of the wall: a thick rust one with flanges, and a thin one under it. Brackets hold them.
    for y, z, radius, tint, joints in ((0.02, 0, 0.075, paint('rust', 0.95), 5), (-0.07, 0.07, 0.03, paint('chitin', 1.5), 0)):
        cuts = 8
        pipe('atlas', m, [(-w / 2 + w * cut / cuts, y, z) for cut in range(cuts + 1)], radius, 6, steel, tint)
        for joint in range(joints):
            x = -w / 2 + w * (joint + 0.5) / joints
            lying = m @ frame((x, y, z)) @ turn_z(math.pi / 2)
            lathe('atlas', lying, (0, 0, 0), [(radius, -0.05), (radius + 0.035, -0.05), (radius + 0.035, 0.05), (radius, 0.05)], 6, steel, tint * 1.15)
    for bracket in range(6):
        x = -w / 2 + w * (bracket + 0.5) / 6 + 0.5
        box('atlas', m, (x, -0.02, -d / 2 + 0.03), (0.05, 0.2, 0.06), steel, paint('chitin', 1.2), skip='-z')


def build_bin(prop):
    m, w, h, d = stand_of(prop)
    lathe('atlas', m, (0, 0, 0), [(w * 0.36, -h / 2), (w * 0.46, h / 2), (w * 0.43, h / 2), (w * 0.4, h / 2 - 0.1)], 8, metal(1.0), paint('chitin', 1.3), caps='b')
    cap('atlas', m, ring((0, 0, 0), w * 0.4, 8, h / 2 - 0.1), PLAIN, flat('night', 3))
    # Crumpled paper shows over the rim.
    for x, z, turn in ((0.04, 0.02, 0.4), (-0.06, -0.05, 1.3)):
        box('atlas', m @ frame((x, h / 2 - 0.06, z), turn), (0, 0, 0), (0.11, 0.09, 0.1), Cell('paper', 0.6), WHITE * 0.95, skip='-y')


def build_storage_box(prop):
    m, w, h, d = stand_of(prop)
    card = Cell('cardboard')
    box('atlas', m, (0, -0.03, 0), (w - 0.03, h - 0.06, d - 0.03), card, skip='-y+y')
    box('atlas', m, (0, h / 2 - 0.05, 0), (w, 0.1, d), card, WHITE * 1.05, skip='-y', skins={'+y': Cell('cardboard', 1.2)})


def build_trim():
    """Skirting and a rail along the walls the camera sees. They give the wall's foot and its wainscot a real edge."""
    x0, x1, z0 = ROOM['minX'], ROOM['maxX'], ROOM['minZ']
    near = 6.0
    d0, d1, _, _ = door_hole()
    steel = metal()
    runs = [(frame((0, 0, z0)), x0, x1), (frame((x0, 0, 0), math.pi / 2), -near, -z0), (frame((x1, 0, 0), -math.pi / 2), z0, d0 - 0.14), (frame((x1, 0, 0), -math.pi / 2), d1 + 0.14, near)]
    for m, start, end in runs:
        pieces = max(1, round((end - start) / 2.2))
        for piece in range(pieces):
            a, b = start + (end - start) * piece / pieces, start + (end - start) * (piece + 1) / pieces
            box('atlas', m, ((a + b) / 2, FLOOR + 0.06, 0.015), (b - a, 0.12, 0.03), PLAIN, flat('night', 3), skip='-z-y+x-x')
            box('atlas', m, ((a + b) / 2, FLOOR + 1.0, 0.02), (b - a, 0.06, 0.04), steel, paint('rust', 0.85), skip='-z+x-x')


def build_chamber():
    """The test chamber behind the window: two transport pods on striped plinths, a control cabinet with the warning light, a gantry, and cables."""
    hx0, hx1, hy0, hy1 = window_hole()
    left, right, front, back = hx0 - 1.45, hx1 + 1.3, ROOM['minZ'] - 0.3, ROOM['minZ'] - 5.6
    deck, top = -1.0, 2.9
    rock = Tile(2.0)
    grey = WHITE * 1.3
    quad('concrete', WORLD, [(left, deck, back), (right, deck, back), (right, top, back), (left, top, back)], rock, grey, step=1.3)
    quad('concrete', WORLD, [(left, deck, front), (left, deck, back), (left, top, back), (left, top, front)], rock, grey, step=1.3)
    quad('concrete', WORLD, [(right, deck, back), (right, deck, front), (right, top, front), (right, top, back)], rock, grey, step=1.3)
    quad('concrete', WORLD, [(left, top, back), (right, top, back), (right, top, front), (left, top, front)], rock, grey * 0.8, step=2.0)
    quad('concrete', WORLD, [(left, deck, front), (right, deck, front), (right, deck, back), (left, deck, back)], rock, grey, step=1.3)
    steel = metal()
    stripes = Cell('hazard')
    # A hazard band crosses the far wall at the height of the window.
    count = round((right - left) / 0.8)
    for index in range(count):
        a, b = left + (right - left) * index / count, left + (right - left) * (index + 1) / count
        quad('atlas', WORLD, [(a, 0.28, back + 0.02), (b, 0.28, back + 0.02), (b, 0.68, back + 0.02), (a, 0.68, back + 0.02)], stripes, WHITE * 0.9)
    middle = (hx0 + hx1) / 2
    pod_z = back + 2.5
    art = Cell('pod')
    sides = 12
    for x in (middle - 1.12, middle + 1.12):
        spot = frame((x, 0, pod_z))
        # The plinth, with stripes round its top edge.
        lathe('atlas', spot, (0, 0, 0), [(0.98, deck), (0.98, 0.04)], sides, steel, paint('chitin', 0.9))
        low, high = ring((0, 0, 0), 0.98, sides, 0.04), ring((0, 0, 0), 0.98, sides, 0.3)
        for index in range(sides):
            after = (index + 1) % sides
            emit('atlas', spot, [low[index], low[after], high[after], high[index]], [stripes.uv((0, 0, 1, 1), a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])
        cap('atlas', spot, ring((0, 0, 0), 0.98, sides, 0.3), steel, paint('chitin', 1.1))
        # The capsule. The three faces toward the window carry the door.
        radius, foot, shoulder = 0.74, 0.3, 2.2
        low, high = ring((0, 0, 0), radius, sides, foot, phase=0.5), ring((0, 0, 0), radius, sides, shoulder, phase=0.5)
        hull = paint('chitin', 0.75)
        for index in range(sides):
            after = (index + 1) % sides
            # Faces 11, 0, and 1 look toward +z.
            door = {sides - 2: 0, sides - 1: 1, 0: 2}.get(index)
            if door is None:
                rect = steel.rect(0.38, shoulder - foot)
                emit('atlas', spot, [low[index], low[after], high[after], high[index]], [steel.uv(rect, a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))], hull)
            else:
                emit('atlas', spot, [low[index], low[after], high[after], high[index]], [art.uv((door / 3, 0, (door + 1) / 3, 1), a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])
        lathe('atlas', spot, (0, 0, 0), [(radius, shoulder), (radius * 0.86, shoulder + 0.22), (radius * 0.5, shoulder + 0.4), (radius * 0.2, shoulder + 0.45)], sides, steel, hull, caps='t')
        lathe('atlas', spot, (0, 0, 0), [(radius + 0.04, 1.02), (radius + 0.04, 1.1)], sides, steel, paint('chitin', 1.5))
        # The porthole shines.
        reach = radius * math.cos(math.pi / sides) + 0.012
        quad('atlas', spot, [(-0.16, 1.52, reach), (0.16, 1.52, reach), (0.16, 1.86, reach), (-0.16, 1.86, reach)], art, rect=(0.36, 0.64, 0.64, 0.82), kind='glow', value=WHITE * 1.5)
        # A thick cable hangs from the capsule to the cabinet between the pods.
        toward = 1 if x < middle else -1
        cable = [(x + toward * 0.72, 1.95, pod_z), (x + toward * 0.86, 1.62, pod_z + 0.3), (x + toward * 0.9, 1.4, pod_z + 0.75), (middle - toward * 0.2, 1.3, pod_z + 1.1)]
        pipe('atlas', WORLD, cable, 0.05, 5, PLAIN, flat('night', 2.5))
        # Cables on the deck run from each pod to the wall.
        pipe('atlas', WORLD, [(x - toward * 0.9, deck + 0.05, pod_z + 0.2), (x - toward * 1.4, deck + 0.05, pod_z + 0.9), (x - toward * 1.5, deck + 0.05, front - 0.6), (x - toward * 1.9, deck + 0.05, front - 0.2)],
             0.05, 4, PLAIN, flat('night', 2.5))
    # The control cabinet stands between the pods, nearer the window. Its warning light turns.
    cabinet = frame((middle, 0, pod_z + 1.15))
    box('atlas', cabinet, (0, (deck + 1.3) / 2, 0), (0.8, 1.3 - deck, 0.5), steel, paint('chitin', 1.2), step=1.2, skip='-y')
    box('atlas', cabinet, (0, 0.9, 0.26), (0.62, 0.62, 0.03), Cell('panel'), skip='-z')
    lathe('atlas', cabinet, (0, 1.3, 0), [(0.1, 0), (0.1, 0.06), (0.03, 0.06), (0.03, 0.12)], 8, steel, paint('chitin', 1.5))
    origin = np.array([middle, 1.5, pod_z + 1.15])
    NODE_ORIGINS['beacon'] = origin
    lamp = frame(origin)
    red = np.array([1.0, 0.1, 0.06])
    lathe('atlas', lamp, (0, 0, 0), [(0.09, -0.08), (0.09, 0.06), (0.05, 0.1)], 8, PLAIN, caps='t', kind='glow', value=red * 1.3, node='beacon')
    # Two beams of red light turn with it. They fade toward their far end.
    for side in (0.7, 0.7 + math.pi):
        beam = lamp @ frame(yaw=side)
        for order in (1, -1):
            emit('beam', beam, [(0, 0, 0.09), (0.16, 0, 1.2), (-0.16, 0, 1.2)][::order], [(0, 0), (0, 0), (0, 0)], kind='beam',
                 value=[(*(red * 0.16), 1), (0, 0, 0, 1), (0, 0, 0, 1)][::order], node='beacon')
    # A gantry beam crosses the chamber near the top of the window's view, with pipes on the far wall.
    box('atlas', WORLD, (middle, 1.92, pod_z - 0.9), (right - left, 0.2, 0.26), steel, paint('rust', 0.8), step=1.6, skip='+x-x')
    for x in (left + 0.5, right - 0.45):
        pipe('atlas', WORLD, [(x, deck, back + 0.16), (x, 1.2, back + 0.16), (x, top, back + 0.16)], 0.1, 6, steel, paint('wing', 0.9))
        lathe('atlas', frame((x, 1.2, back + 0.16)), (0, 0, 0), [(0.1, -0.05), (0.15, -0.05), (0.15, 0.05), (0.1, 0.05)], 6, steel, paint('wing', 1.0))


def build_corridor():
    """The corridor behind the door: lockers on its far wall, a pipe under its ceiling, and one caged lamp."""
    near, far = ROOM['maxX'] + 0.3, ROOM['maxX'] + 2.9
    z0, z1 = -10.5, 0.6
    top = 1.95
    rock = Tile(2.0)
    quad('concrete', WORLD, [(near, FLOOR, z1), (far, FLOOR, z1), (far, FLOOR, z0), (near, FLOOR, z0)], rock, WHITE * 2.2, step=1.6)
    quad('concrete', WORLD, [(far, FLOOR, z0), (far, FLOOR, z1), (far, top, z1), (far, top, z0)], rock, WHITE * 2.6, step=1.4)
    quad('concrete', WORLD, [(near, top, z0), (far, top, z0), (far, top, z1), (near, top, z1)], rock, WHITE * 2.0, step=2.4)
    quad('concrete', WORLD, [(near, FLOOR, z0), (far, FLOOR, z0), (far, top, z0), (near, top, z0)], rock, WHITE * 2.2, step=1.4)
    quad('concrete', WORLD, [(far, FLOOR, z1), (near, FLOOR, z1), (near, top, z1), (far, top, z1)], rock, WHITE * 2.2, step=1.4)
    for index in range(5):
        build_locker({'position': [far - 0.36, FLOOR + 1.4, -8.3 + index * 0.62], 'size': [0.7, 2.8, 0.6], 'facing': '-x'})
    steel = metal()
    run = [(far - 0.2, top - 0.25, z) for z in (z0, -8.5, -6.5, -4.5, -2.5, z1)]
    pipe('atlas', WORLD, run, 0.09, 6, steel, paint('rust', 0.9))
    for z in (-7.5, -5.5, -3.5):
        lathe('atlas', frame((far - 0.2, top - 0.25, z)) @ turn_x(math.pi / 2), (0, 0, 0), [(0.09, -0.05), (0.13, -0.05), (0.13, 0.05), (0.09, 0.05)], 6, steel, paint('rust', 1.05))
    # The lamp hangs on the far wall, past the lockers.
    lamp = frame((far - 0.08, 1.2, -4.9), -math.pi / 2)
    box('atlas', lamp, (0, 0, 0), (0.3, 0.2, 0.16), steel, paint('chitin', 1.3), skip='-z')
    quad('atlas', lamp, [(-0.11, -0.07, 0.082), (0.11, -0.07, 0.082), (0.11, 0.07, 0.082), (-0.11, 0.07, 0.082)], Cell('diffuser'), kind='glow', value=INK['cream'] * 2.6)


def build_tube(prop):
    m, _, _, length = stand_of(prop)
    failing = prop['lamp'] == 'flickering'
    steel = metal()
    shell_tint = INK['wing'] * 1.6
    half = 0.2
    # The housing hangs under the ceiling: two long sides, two ends, and a rim round the diffuser.
    box('atlas', m, (0, 0.01, 0), (half * 2 + 0.04, 0.12, length), steel, shell_tint, skip='+y-y')
    for side in (-1, 1):
        box('atlas', m, (side * (half - 0.01), -0.05, 0), (0.06, 0.012, length), steel, shell_tint * 0.9, skip='+y')
    for end in (-1, 1):
        box('atlas', m, (0, -0.05, end * (length / 2 - 0.03)), (half * 2 - 0.08, 0.012, 0.06), steel, shell_tint * 0.9, skip='+y')
    # The diffuser shines. The failing tube takes its level from the site.
    glow = INK['cream'] * 2.6
    corners = [(-half + 0.04, -0.035, -length / 2 + 0.06), (half - 0.04, -0.035, -length / 2 + 0.06), (half - 0.04, -0.035, length / 2 - 0.06), (-half + 0.04, -0.035, length / 2 - 0.06)]
    quad('atlas', m, corners, Cell('diffuser'), kind='flicker' if failing else 'glow', value=glow)
    # A grille of thin blades hangs under the diffuser.
    blades = max(3, round(length / 0.36))
    lit = INK['cream'] * (0.5 if failing else 1.1)
    for index in range(1, blades):
        z = -length / 2 + 0.06 + (length - 0.12) * index / blades
        box('atlas', m, (0, -0.05, z), (half * 2 - 0.1, 0.028, 0.014), PLAIN, skip='+y+x-x', kind='glow', value=lit)
    box('atlas', m, (0, -0.05, 0), (0.014, 0.028, length - 0.12), PLAIN, skip='+y+z-z', kind='glow', value=lit)


BUILDERS = {
    'Desk': build_desk, 'CeilingTube': build_tube, 'Monitor': build_monitor, 'Keyboard': build_keyboard, 'Mug': build_mug, 'Chair': build_chair,
    'Whiteboard': build_whiteboard, 'JarShelf': build_jar_shelf, 'ChamberWindow': build_window, 'WallClock': build_clock, 'Door': build_door,
    'VendingMachine': build_vending, 'DeskLamp': build_lamp, 'Papers': build_papers, 'FireExtinguisher': build_extinguisher, 'Locker': build_locker,
    'Corkboard': build_corkboard, 'Chart': build_chart, 'WallPanel': build_wall_panel, 'CeilingVent': build_vent, 'Duct': build_duct, 'PipeRun': build_pipe_run,
    'WasteBin': build_bin, 'StorageBox': build_storage_box,
}
INDEXED = {'Jar': build_jar, 'FilingCabinet': build_cabinet}


def build_props():
    counts = {}
    for index, prop in enumerate(PLAN['props']):
        tag = prop['_tag']
        if tag in INDEXED:
            INDEXED[tag](prop, counts.get(tag, 0))
            counts[tag] = counts.get(tag, 0) + 1
        elif tag in BUILDERS:
            BUILDERS[tag](prop)
        else:
            raise ValueError(f'The plan has a prop this script cannot build: {tag}')
    build_trim()
    # The test chamber and the corridor are not the office. Their lights stay on when the office is dark.
    global OWN_LIGHT
    OWN_LIGHT = True
    build_chamber()
    if CORRIDOR:
        build_corridor()
    OWN_LIGHT = False


# ---------------------------------------------------------------- the bake

def to_blender(points):
    points = np.asarray(points, float)
    return np.stack([points[..., 0], -points[..., 2], points[..., 1]], axis=-1)


def bake_material(name, albedo):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    shader = nodes.new('ShaderNodeBsdfDiffuse')
    shader.inputs['Color'].default_value = (*albedo, 1)
    output = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    return material


def face_albedo(face):
    base = ALBEDO.get(face['surface'])
    if base is None:
        base = ALBEDO['metal']
    return tuple(np.clip(np.asarray(base) * np.minimum(face['tint'], 1.5), 0, 0.9).round(2))


def make_object(name, faces):
    """One mesh from a list of faces. Corners at one place share a vertex, so round shapes shade smoothly."""
    index_of, vertices, polygons, albedos = {}, [], [], []
    for face in faces:
        polygon = []
        for point in to_blender(face['points']):
            key = tuple(np.round(point, 4))
            if key not in index_of:
                index_of[key] = len(vertices)
                vertices.append(tuple(point))
            polygon.append(index_of[key])
        if len(set(polygon)) != len(polygon):
            raise ValueError(f'A face of {name} has two corners at one place.')
        polygons.append(polygon)
        albedos.append(face_albedo(face))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], polygons)
    mesh.update()
    slots = {}
    for albedo in albedos:
        if albedo not in slots:
            slots[albedo] = len(slots)
            mesh.materials.append(bake_material(f'{name}-{len(slots)}', albedo))
    mesh.polygons.foreach_set('material_index', [slots[albedo] for albedo in albedos])
    mesh.polygons.foreach_set('use_smooth', [True] * len(polygons))
    mesh.set_sharp_from_angle(angle=math.radians(50))
    thing = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(thing)
    return thing


def add_light(name, kind, position, power, tint, size=None, aim=(0, -1, 0), spread=None, spot=None):
    """A light at a site position that shines along a site direction."""
    data = bpy.data.lights.new(name, kind)
    data.energy = power
    data.color = tuple(tint)
    if kind == 'AREA':
        data.shape = 'RECTANGLE'
        data.size, data.size_y = size
        if spread:
            data.spread = math.radians(spread)
    if kind == 'SPOT':
        data.spot_size = math.radians(spot or 60)
        data.spot_blend = 0.6
        data.shadow_soft_size = 0.1
    if kind == 'POINT':
        data.shadow_soft_size = size or 0.1
    thing = bpy.data.objects.new(name, data)
    thing.location = tuple(to_blender(position))
    direction = Vector(tuple(to_blender(aim)))
    thing.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(thing)
    return thing


def add_lights():
    """The lights of the bake, in two groups: the steady ones, and the failing tube alone."""
    steady, failing = [], []
    tube_tint = (0.96, 1.0, 0.95)
    for prop in find('CeilingTube'):
        x, y, z = prop['position']
        length = prop['size'][2]
        light = add_light(prop['id'], 'AREA', (x, y - 0.14, z), 120 * length, tube_tint, size=(0.3, length - 0.1), spread=130)
        (failing if prop['lamp'] == 'flickering' else steady).append(light)
    # The test chamber: one cold light over the pods, the glow of each porthole, and the red of the warning light.
    hx0, hx1, _, _ = window_hole()
    middle, pod_z = (hx0 + hx1) / 2, ROOM['minZ'] - 5.6 + 2.5
    steady.append(add_light('chamber', 'AREA', (middle, 2.8, pod_z + 0.7), 300, (0.6, 0.92, 1.0), size=(2.4, 1.6), spread=140))
    for x in (middle - 1.12, middle + 1.12):
        steady.append(add_light('porthole', 'POINT', (x, 1.7, pod_z + 0.95), 12, (0.3, 1.0, 0.9), size=0.08))
    steady.append(add_light('beacon', 'POINT', NODE_ORIGINS['beacon'] + np.array([0, 0.14, 0]), 26, (1.0, 0.08, 0.04), size=0.05))
    # The corridor's lamp. Its light falls through the door that stands ajar.
    if CORRIDOR:
        steady.append(add_light('corridor', 'POINT', (ROOM['maxX'] + 2.55, 1.2, -4.9), 400, (1.0, 0.86, 0.62), size=0.12))
    # The small lights of the room: the screen, the vending machine's window, the desk lamp, and the lamp over the door.
    for prop in find('Monitor'):
        x, y, z = prop['position']
        steady.append(add_light('screen', 'AREA', (x, y + 0.14, z + prop['size'][2] / 2 + 0.03), 5, (0.45, 1.0, 0.85), size=(0.5, 0.36), aim=(0, 0, 1)))
    for prop in find('VendingMachine'):
        x, y, z = prop['position']
        steady.append(add_light('vending', 'AREA', (x - prop['size'][0] / 2 - 0.03, y + 0.3, z - 0.2), 24, (1.0, 0.92, 0.75), size=(0.9, 1.9), aim=(-1, 0, 0)))
    for prop in find('DeskLamp'):
        x, y, z = prop['position']
        steady.append(add_light('desk-lamp', 'SPOT', (x + 0.1, y + 0.12, z + 0.09), 70, (1.0, 0.85, 0.6), aim=(0.15, -1, 0.5), spot=95))
    for prop in find('Door'):
        x, y, z = prop['position']
        steady.append(add_light('door-lamp', 'POINT', (x - 0.1, y + prop['size'][1] / 2 + 0.3, z), 4, (0.3, 0.9, 0.9), size=0.05))
    return steady, failing


def bake(target, kind):
    scene = bpy.context.scene
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    scene.render.bake.target = kind
    scene.render.bake.use_clear = True
    scene.render.bake.margin = 3
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target=kind, margin=3, use_clear=True)


def read_corners(thing, name):
    attribute = thing.data.color_attributes[name]
    values = np.zeros(len(attribute.data) * 4, np.float32)
    attribute.data.foreach_get('color', values)
    return values.reshape(-1, 4)[:, :3].astype(float)


def run_bake(shell_faces, lit_faces):
    """Bakes the light. Returns the light map (base and failing, as arrays with the first row at the bottom) and each lit corner's base and failing light."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = SAMPLES
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 3
    scene.cycles.use_denoising = True
    world = bpy.data.worlds.new('office')
    world.use_nodes = True
    background = next(node for node in world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (0.5, 0.55, 0.5, 1)
    background.inputs['Strength'].default_value = 0.004
    scene.world = world

    shell = make_object('shell', shell_faces)
    layer = shell.data.uv_layers.new(name='light')
    uvs = np.concatenate([face['uv1'] for face in shell_faces])
    layer.data.foreach_set('uv', np.stack([uvs[:, 0], 1 - uvs[:, 1]], axis=1).ravel())
    image = bpy.data.images.new('light', LM_SIZE, LM_SIZE, alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in shell.data.materials:
        node = material.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        material.node_tree.nodes.active = node
    props = make_object('props', lit_faces)
    for name in ('base', 'failing'):
        props.data.color_attributes.new(name, 'FLOAT_COLOR', 'CORNER')
    steady, failing = add_lights()

    def read_image():
        pixels = np.zeros(LM_SIZE * LM_SIZE * 4, np.float32)
        image.pixels.foreach_get(pixels)
        return pixels.reshape(LM_SIZE, LM_SIZE, 4)[:, :, :3].astype(float)
    maps, corners = {}, {}
    for name, on, off in (('base', steady, failing), ('failing', failing, steady)):
        for light in on:
            light.hide_render = False
        for light in off:
            light.hide_render = True
        bake(shell, 'IMAGE_TEXTURES')
        maps[name] = read_image()
        props.data.color_attributes.active_color = props.data.color_attributes[name]
        bake(props, 'VERTEX_COLORS')
        corners[name] = read_corners(props, name)
        print(f'OFFICE baked {name}: map mean {maps[name].mean():.4f}, corner mean {corners[name].mean():.4f}', flush=True)
    normals = np.zeros(len(props.data.loops) * 3, np.float32)
    props.data.corner_normals.foreach_get('vector', normals)
    return maps, corners, normals.reshape(-1, 3)


# ---------------------------------------------------------------- the GLB writer

def luminance(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def grade(light):
    """Deepens the dark end of scaled light. A value at the pool level stays where it is."""
    level = np.maximum(luminance(light), 1e-6)
    return light * ((level / POOL) ** (CONTRAST - 1))[..., None]


def encode(light):
    return np.clip(np.sqrt(np.clip(light, 0, None) / LIGHT_MAX), 0, 1)


def soften(grid, rounds=1):
    """A small blur that takes the last grain out of the light map. Light is smooth, so it loses nothing."""
    for _ in range(rounds):
        padded = np.pad(grid, ((1, 1), (1, 1), (0, 0)), mode='edge')
        grid = (padded[:-2, 1:-1] + padded[2:, 1:-1] + padded[1:-1, :-2] + padded[1:-1, 2:] + padded[1:-1, 1:-1] * 4) / 8
    return grid


def write_light_map(maps, scale):
    """The light map file: the steady light on the left half, the failing tube's light on the right half."""
    wide = np.ones((LM_SIZE, LM_SIZE * 2, 4), np.float32)
    wide[:, :LM_SIZE, :3] = encode(grade(soften(maps['base'], 2) * scale))
    wide[:, LM_SIZE:, :3] = encode(luminance(soften(maps['failing'], 2) * scale))[:, :, None]
    image = bpy.data.images.new('office-light', LM_SIZE * 2, LM_SIZE, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(wide.ravel())
    # Light is smooth, so a lossy picture holds it in a tenth of the bytes.
    image.filepath_raw = LIGHT_PATH
    image.file_format = 'WEBP'
    image.save(quality=92)


def write_glb(groups):
    """`groups` maps a node name to its surfaces. Each surface holds positions, uvs, an optional second uv set, colours as bytes, and triangle indices."""
    chunks, views, accessors, meshes, nodes, materials = [], [], [], [], [], {}
    offset = 0

    def view(data, target, stride=None):
        nonlocal offset
        raw = data.tobytes()
        raw += b'\0' * (-len(raw) % 4)
        chunks.append(raw)
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data.tobytes()), 'target': target, **({'byteStride': stride} if stride else {})})
        offset += len(raw)
        return len(views) - 1

    def accessor(data, kind, component, target=34962, normalized=False, bounds=False, stride=None):
        entry = {'bufferView': view(data, target, stride), 'componentType': component, 'count': len(data), 'type': kind}
        if normalized:
            entry['normalized'] = True
        if bounds:
            entry['min'], entry['max'] = [int(v) for v in data[:, :3].min(axis=0)], [int(v) for v in data[:, :3].max(axis=0)]
        accessors.append(entry)
        return len(accessors) - 1

    def texcoord(uv):
        # A uv inside the picture fits 16 bits. A uv that repeats keeps its float.
        if uv.min() >= 0 and uv.max() <= 1:
            return accessor(np.round(uv * 65535).astype(np.uint16), 'VEC2', 5123, normalized=True)
        return accessor(uv.astype(np.float32), 'VEC2', 5126)

    for node_name, (origin, surfaces) in groups.items():
        primitives = []
        for surface, part in surfaces.items():
            if surface not in materials:
                materials[surface] = len(materials)
            # Positions are whole steps of GRID, as 16 bit numbers with two bytes of padding. The node's scale turns them back into world units.
            steps = np.zeros((len(part['position']), 4), np.int16)
            steps[:, :3] = np.round((part['position'] - origin) / GRID)
            attributes = {'POSITION': accessor(steps, 'VEC3', 5122, bounds=True, stride=8),
                          'TEXCOORD_0': texcoord(part['uv']),
                          'COLOR_0': accessor(part['colour'].astype(np.uint8), 'VEC4', 5121, normalized=True)}
            if part['uv1'] is not None:
                attributes['TEXCOORD_1'] = texcoord(part['uv1'])
            small = len(part['position']) < 65536
            indices = accessor(part['index'].astype(np.uint16 if small else np.uint32), 'SCALAR', 5123 if small else 5125, target=34963)
            primitives.append({'attributes': attributes, 'indices': indices, 'material': materials[surface]})
        meshes.append({'name': node_name, 'primitives': primitives})
        nodes.append({'name': node_name, 'mesh': len(meshes) - 1, 'translation': [float(v) for v in origin], 'scale': [GRID] * 3})
    document = {
        'asset': {'version': '2.0', 'generator': 'Brundlefly build_office_props.py',
                  'extras': {'light': 'COLOR_0 holds baked light: rgb is the steady light and alpha the failing tube. Decode a value as value * value * lightMax. A surface named <name>-own has its own light: it stays lit when the tubes of the room are off.', 'lightMax': LIGHT_MAX}},
        'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
        'materials': [{'name': name} for name in materials], 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': offset}],
    }
    text = json.dumps(document, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    binary = b''.join(chunks)
    with open(GLB_PATH, 'wb') as file:
        file.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(binary)))
        file.write(struct.pack('<II', len(text), 0x4E4F534A) + text)
        file.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


def assemble(shell_faces, lit_faces, other_faces, corners, normals, scale):
    """Joins every face into the surfaces of each node. Corners that agree in place, uv, and facing share one vertex and one light."""
    records = []
    # Shell faces take their light from the light map. Their colour stays white.
    for face in shell_faces:
        for point, uv, uv1 in zip(face['points'], face['uv'], face['uv1']):
            records.append((face, point, uv, uv1, np.ones(3), 0.0, np.zeros(3)))
    cursor = 0
    for face in lit_faces:
        count = len(face['points'])
        base, failing, normal = grade(corners['base'][cursor:cursor + count] * scale), corners['failing'][cursor:cursor + count] * scale, normals[cursor:cursor + count]
        cursor += count
        for index in range(count):
            if face['kind'] == 'glow':
                light, flick = np.asarray(face['value'], float), 0.0
            elif face['kind'] == 'flicker':
                light, flick = np.asarray(face['value'], float) * 0.06, float(luminance(np.asarray(face['value'], float)))
            else:
                light, flick = base[index] * face['tint'], float(luminance(failing[index]) * luminance(face['tint']) / max(luminance(WHITE), 1e-6))
            records.append((face, face['points'][index], face['uv'][index], None, light, flick, normal[index]))
    # Glass and beams carry their own colour and opacity: one value for the face, or one for each corner.
    for face in other_faces:
        values = np.asarray(face['value'], float)
        for index, (point, uv) in enumerate(zip(face['points'], face['uv'])):
            records.append((face, point, uv, None, values[index] if values.ndim == 2 else values, None, np.zeros(3)))

    groups = {}
    cursor = 0
    buckets = {}
    for face in shell_faces + lit_faces + other_faces:
        count = len(face['points'])
        # A face with its own light joins the surface `<name>-own`. Glass and beams have looks of their own on the site.
        own = face['own'] and face['kind'] not in ('glass', 'beam')
        buckets.setdefault((face['node'] or 'office', face['surface'] + '-own' if own else face['surface']), []).append((cursor, count))
        cursor += count
    origins = {name: np.zeros(3) for name, _ in buckets}
    origins.update(NODE_ORIGINS)
    for (node, surface), spans in buckets.items():
        keys, index = {}, []
        sums = []
        for start, count in spans:
            ids = []
            for at in range(start, start + count):
                face, point, uv, uv1, light, flick, normal = records[at]
                key = (tuple(np.round(point, 4)), tuple(np.round(uv, 5)), tuple(np.round(normal, 2)), None if uv1 is None else tuple(np.round(uv1, 5)), face['kind'] in ('glass', 'beam'))
                if key not in keys:
                    keys[key] = len(sums)
                    sums.append([point, uv, uv1, np.zeros(4), 0])
                entry = sums[keys[key]]
                if flick is None:
                    entry[3] += np.asarray(light, float)
                else:
                    entry[3] += np.array([*encode(light), math.sqrt(min(1.0, max(0.0, flick) / LIGHT_MAX))])
                entry[4] += 1
                ids.append(keys[key])
            for corner in range(1, count - 1):
                index.extend([ids[0], ids[corner], ids[corner + 1]])
        part = {'position': np.array([entry[0] for entry in sums]), 'uv': np.array([entry[1] for entry in sums]),
                'uv1': np.array([entry[2] for entry in sums]) if sums[0][2] is not None else None,
                'colour': np.round(np.clip(np.array([entry[3] / entry[4] for entry in sums]), 0, 1) * 255), 'index': np.array(index)}
        groups.setdefault(node, (origins[node], {}))[1][surface] = part
    return groups


NODE_ORIGINS = {}


def main():
    build_room()
    build_props()
    shell_faces = [face for face in FACES if face['uv1'] is not None]
    lit_faces = [face for face in FACES if face['uv1'] is None and face['kind'] in ('lit', 'glow', 'flicker')]
    other_faces = [face for face in FACES if face['kind'] in ('glass', 'beam')]
    print(f'OFFICE faces: shell {len(shell_faces)}, lit {len(lit_faces)}, other {len(other_faces)}', flush=True)
    count = sum(len(face['points']) for face in lit_faces)
    if ONLY_MODEL:
        maps = {'base': np.full((LM_SIZE, LM_SIZE, 3), 1.0), 'failing': np.zeros((LM_SIZE, LM_SIZE, 3))}
        corners, normals, scale = {'base': np.ones((count, 3)), 'failing': np.zeros((count, 3))}, np.zeros((count, 3)), 1.0
    else:
        maps, corners, normals = run_bake(shell_faces, lit_faces)
        # The floor island sets the scale: its brightest part becomes the pool level.
        left, low = ISLANDS['floor']
        floor = maps['base'][low:low + 152, left:left + 88]
        scale = POOL / max(np.percentile(luminance(floor), 99), 1e-6)
        print(f'OFFICE light scale {scale:.4f}', flush=True)
    write_light_map(maps, scale)
    groups = assemble(shell_faces, lit_faces, other_faces, corners, normals, scale)
    write_glb(groups)
    triangles = sum(len(part['index']) // 3 for _, surfaces in groups.values() for part in surfaces.values())
    vertices = sum(len(part['position']) for _, surfaces in groups.values() for part in surfaces.values())
    print(f'OFFICE wrote {GLB_PATH}: {triangles} triangles, {vertices} vertices, {len(groups)} nodes', flush=True)


main()
