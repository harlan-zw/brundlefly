"""Builds the office set: every prop, the room, the test chamber, and the corridor. It bakes the light and writes one GLB and one light map.

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
# The light map: pixels across, and pixels for one world unit.
LM_SIZE = 256
LUXELS = 8


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
          'metal': (0.3, 0.33, 0.29), 'laminate': (0.2, 0.07, 0.03), 'plastic': (0.5, 0.46, 0.36), 'white': (0.8, 0.8, 0.8)}

# ---------------------------------------------------------------- the kit

FACES = []
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


def emit(surface, matrix, points, uvs, tint=WHITE, kind='lit', value=None, node=None, uv1=None):
    """One flat face. `kind` says how it gets its light: 'lit' takes the bake, 'glow' and 'flicker' shine, 'glass' and 'beam' stay out of the bake."""
    FACES.append({'surface': surface, 'points': place(matrix, points), 'uv': np.asarray(uvs, float), 'uv1': None if uv1 is None else np.asarray(uv1, float),
                  'tint': np.asarray(tint, float), 'kind': kind, 'value': value, 'node': node})


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

def build_desk(prop):
    m, w, h, d = stand_of(prop)
    wood, steel = Cell('laminate', 2.0), metal()
    top, plinth = h / 2, -h / 2
    drawer_tint, dark = INK['wing'] * 1.5, INK['chitin'] * 0.7
    # The top: a laminate slab with a dark edge band, a little wider than the pedestals.
    box('atlas', m, (0, top - 0.035, 0), (w, 0.07, d), wood, step=0.3, skins={name: metal() for name in ('+z', '-z', '+x', '-x')},
        tints={name: INK['bruise'] * 0.8 for name in ('+z', '-z', '+x', '-x', '-y')})
    for side in (-1, 1):
        x = side * (w / 2 - 0.42)
        box('atlas', m, (x, plinth + 0.05, -0.02), (0.66, 0.1, d - 0.2), steel, dark, skip='+y-y')
        box('atlas', m, (x, (plinth + 0.1 + top - 0.07) / 2, -0.01), (0.74, h - 0.17, d - 0.1), steel, drawer_tint, step=0.4, skip='+y-y')
        # Drawer fronts stand proud of the pedestal. The right pedestal has three, the left has two.
        fronts = [0.3, 0.3, 0.42] if side > 0 else [0.3, 0.74]
        y = top - 0.1
        for tall in fronts:
            box('atlas', m, (x, y - tall / 2, d / 2 - 0.045), (0.68, tall - 0.03, 0.03), steel, drawer_tint * 1.08, skip='-z')
            # A bar handle on two posts.
            box('atlas', m, (x, y - 0.1, d / 2 - 0.005), (0.3, 0.025, 0.025), steel, INK['cream'] * 0.9)
            for post in (-0.12, 0.12):
                box('atlas', m, (x + post, y - 0.1, d / 2 - 0.022), (0.025, 0.025, 0.03), steel, INK['chitin'], skip='+z-z')
            y -= tall
    # The modesty panel closes the back of the kneehole.
    box('atlas', m, (0, 0.1, -d / 2 + 0.12), (w - 1.56, h - 0.5, 0.04), steel, drawer_tint * 0.9, step=0.4, skip='+x-x')


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
    blades = max(3, round(length / 0.22))
    for index in range(1, blades):
        z = -length / 2 + 0.06 + (length - 0.12) * index / blades
        box('atlas', m, (0, -0.06, z), (half * 2 - 0.1, 0.045, 0.012), steel, INK['wing'] * 1.1, skip='+y-y+x-x')
    box('atlas', m, (0, -0.06, 0), (0.012, 0.045, length - 0.12), steel, INK['wing'] * 1.1, skip='+y-y+z-z')


BUILDERS = {'Desk': build_desk, 'CeilingTube': build_tube}


def build_props():
    for prop in PLAN['props']:
        builder = BUILDERS.get(prop['_tag'])
        if builder:
            builder(prop)


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
    mesh.set_sharp_from_angle(angle=math.radians(35))
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
    direction = __import__('mathutils').Vector(tuple(to_blender(aim)))
    thing.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(thing)
    return thing


def add_lights():
    """The lights of the bake, in two groups: the steady ones, and the failing tube alone."""
    steady, failing = [], []
    tube_tint = (1.0, 0.95, 0.82)
    for prop in find('CeilingTube'):
        x, y, z = prop['position']
        length = prop['size'][2]
        light = add_light(prop['id'], 'AREA', (x, y - 0.12, z), 120 * length, tube_tint, size=(0.3, length - 0.1), spread=150)
        (failing if prop['lamp'] == 'flickering' else steady).append(light)
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
    wide[:, :LM_SIZE, :3] = encode(soften(maps['base'], 2) * scale)
    wide[:, LM_SIZE:, :3] = encode(luminance(soften(maps['failing'], 2) * scale))[:, :, None]
    image = bpy.data.images.new('office-light', LM_SIZE * 2, LM_SIZE, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(wide.ravel())
    image.filepath_raw = LIGHT_PATH
    image.file_format = 'PNG'
    image.save()


def write_glb(groups):
    """`groups` maps a node name to its surfaces. Each surface holds positions, uvs, an optional second uv set, colours as bytes, and triangle indices."""
    chunks, views, accessors, meshes, nodes, materials = [], [], [], [], [], {}
    offset = 0

    def view(data, target):
        nonlocal offset
        raw = data.tobytes()
        raw += b'\0' * (-len(raw) % 4)
        chunks.append(raw)
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data.tobytes()), 'target': target})
        offset += len(raw)
        return len(views) - 1

    def accessor(data, kind, component, target=34962, normalized=False, bounds=False):
        entry = {'bufferView': view(data, target), 'componentType': component, 'count': len(data), 'type': kind}
        if normalized:
            entry['normalized'] = True
        if bounds:
            entry['min'], entry['max'] = [float(v) for v in data.min(axis=0)], [float(v) for v in data.max(axis=0)]
        accessors.append(entry)
        return len(accessors) - 1

    for node_name, (origin, surfaces) in groups.items():
        primitives = []
        for surface, part in surfaces.items():
            if surface not in materials:
                materials[surface] = len(materials)
            attributes = {'POSITION': accessor((part['position'] - origin).astype(np.float32), 'VEC3', 5126, bounds=True),
                          'TEXCOORD_0': accessor(part['uv'].astype(np.float32), 'VEC2', 5126),
                          'COLOR_0': accessor(part['colour'].astype(np.uint8), 'VEC4', 5121, normalized=True)}
            if part['uv1'] is not None:
                attributes['TEXCOORD_1'] = accessor(part['uv1'].astype(np.float32), 'VEC2', 5126)
            small = len(part['position']) < 65536
            indices = accessor(part['index'].astype(np.uint16 if small else np.uint32), 'SCALAR', 5123 if small else 5125, target=34963)
            primitives.append({'attributes': attributes, 'indices': indices, 'material': materials[surface]})
        meshes.append({'name': node_name, 'primitives': primitives})
        nodes.append({'name': node_name, 'mesh': len(meshes) - 1, 'translation': [float(v) for v in origin]})
    document = {
        'asset': {'version': '2.0', 'generator': 'Brundlefly build_office_props.py',
                  'extras': {'light': 'COLOR_0 holds baked light: rgb is the steady light and alpha the failing tube. Decode a value as value * value * lightMax.', 'lightMax': LIGHT_MAX}},
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
        base, failing, normal = corners['base'][cursor:cursor + count] * scale, corners['failing'][cursor:cursor + count] * scale, normals[cursor:cursor + count]
        cursor += count
        for index in range(count):
            if face['kind'] == 'glow':
                light, flick = np.asarray(face['value'], float), 0.0
            elif face['kind'] == 'flicker':
                light, flick = np.asarray(face['value'], float) * 0.06, float(luminance(np.asarray(face['value'], float)))
            else:
                light, flick = base[index] * face['tint'], float(luminance(failing[index]) * luminance(face['tint']) / max(luminance(WHITE), 1e-6))
            records.append((face, face['points'][index], face['uv'][index], None, light, flick, normal[index]))
    for face in other_faces:
        for point, uv in zip(face['points'], face['uv']):
            records.append((face, point, uv, None, np.asarray(face['value'], float), None, np.zeros(3)))

    groups = {}
    cursor = 0
    buckets = {}
    for face in shell_faces + lit_faces + other_faces:
        count = len(face['points'])
        buckets.setdefault((face['node'] or 'office', face['surface']), []).append((cursor, count))
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
