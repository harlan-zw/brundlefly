"""Export the print files and the preview from the working Blender file.

Run headless, with absolute paths:
  flatpak run org.blender.Blender -b --factory-startup \
    --python /abs/export_model.py -- --blend /abs/brundlefly-work.blend --out /abs/dir

Writes brundlefly.blend, brundlefly-80mm.stl, brundlefly-100mm.stl, and brundlefly-preview.glb.
"""
import argparse
import heapq
import json
import os
import sys

import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_from_mesh as bfm  # noqa: E402  (the sheet projection lives there)
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

# The texture grows dark inside each eye socket: from this many eyeball radii inward. The socket is
# 1.09 to 1.16 eyeball radii on the website model, so this covers its wall and its rim.
EYE_DARK_SCALE = 1.3
# How dark the deepest part of a socket is, as a share of the skin's own colour.
SOCKET_SHADE = 0.22
# A painted eye socket is looked for within this many radii of the larger eye, around each eye.
PAINTED_SOCKET_RADII = 1.9
# The filled paint of a socket is darkened by this factor, to the tone of the skin around the rim.
PAINTED_SOCKET_TONE = 0.72
# The face patches of the jaw, the cheeks, and the brows reach this far behind the eyeball centres, in millimetres.
FACE_DEPTH_MM = 6.0
# The reach of the fold shadow, in millimetres, and the share of it that also darkens the base colour.
FOLD_SHADOW_MM = 2.0
FOLD_SHADOW_IN_COLOUR = 0.25
# The share of solid above one half at which a fold is fully in shadow.
FOLD_SHADOW_SPAN = 0.22
# The broad shadow: under the chin, in the armpits, behind the mouthparts. Its reach in millimetres, how far
# above the skin it is measured, the shares of solid there at which it starts and is full, and its strength.
BROAD_SHADOW_MM = 6.4
BROAD_SHADOW_LIFT_MM = 4.0
BROAD_SHADOW_SHARE = (0.05, 0.32)
BROAD_SHADOW_STRENGTH = 0.7
# How strongly the fine detail of the texture turns the surface normal, for the relief map.
RELIEF_STRENGTH = 4.0
# How far the mouthparts take the flesh colour of the face, from 0 (their painted colour) to 1.
MOUTHPART_FLESH = 0.7
# The skin patch for surfaces that no view sees: its scale on the model, in build millimetres for each pixel, and its strength.
DETAIL_MM_PER_PIXEL = 0.07
DETAIL_AMOUNT = 1.0
# The close shot of a conversation frames the head and the shoulders. That part of the website model
# gets more triangles and more of the texture. The centre lies between the head joint and the face,
# in the millimetres of the working mesh. The focus is 1 within the first distance and 0 past the second.
CLOSE_SHOT_CENTRE = (0.0, -14.0, 60.0)
CLOSE_SHOT_FULL_MM = 14.0
CLOSE_SHOT_REACH_MM = 22.0
# How strongly the decimation spares the close shot. 0.08 leaves about 2.4 times the triangles for each square millimetre there.
CLOSE_SHOT_TRIANGLES = 0.08
# How much larger a UV island in the close shot is than one elsewhere, along each side.
CLOSE_SHOT_TEXELS = 1.6
# The oblique paintings of the head colour the skull only: fully within the first distance of its
# centre, in the millimetres of the working mesh, and not at all past the second.
SKULL_CENTRE = (0.0, -13.0, 61.0)
SKULL_FULL_MM = 11.0
SKULL_REACH_MM = 14.0
# An oblique painting colours a surface that faces it at least this squarely, and fully from the second value.
OBLIQUE_FACING = (0.3, 0.6)
# The close painting of the head fades in over this share of its width from each border.
DETAIL_FEATHER = 0.09
# Linear colour, base radius, and longest length of a bristle hair on the website model.
BRISTLE_COLOUR = (0.115, 0.030, 0.022)
BRISTLE_RADIUS_MM = 0.17
BRISTLE_MAX_MM = 2.2


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--object", default="Brundlefly")
    ap.add_argument("--tris", type=int, default=390000, help="triangle budget for each STL")
    ap.add_argument("--glb-tris", type=int, default=160000)
    ap.add_argument("--web", action="store_true", help="write brundlefly-web.glb only, from a web-variant build")
    ap.add_argument("--no-rig", action="store_true", help="web model without the skeleton")
    ap.add_argument("--no-stance", action="store_true", help="web model in the straight stand, without source/stance.json")
    ap.add_argument("--no-texture", action="store_true", help="web model with vertex colours and no texture")
    ap.add_argument("--texture-size", type=int, default=2048)
    ap.add_argument("--image-quality", type=int, default=88, help="JPEG quality of the website model's textures")
    ap.add_argument("--relief-size", type=int, default=0, help="side of the normal map made from the texture's fine detail. It must divide the texture size. 0 writes none.")
    args, _ = ap.parse_known_args(argv)
    return args


def self_intersections(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    tree = BVHTree.FromBMesh(bm, epsilon=0.0)
    faces = bm.faces
    faces.ensure_lookup_table()
    count = 0
    for a, b in tree.overlap(tree):
        if a < b and not ({v.index for v in faces[a].verts} & {v.index for v in faces[b].verts}):
            count += 1
    bm.free()
    return count


def close_shot_focus(points):
    """From 0 to 1 for each point of the working mesh: how far it belongs to the close shot of the head."""
    distance = np.linalg.norm(np.asarray(points, dtype=np.float64) - np.array(CLOSE_SHOT_CENTRE), axis=1)
    return smooth_step((CLOSE_SHOT_REACH_MM - distance) / (CLOSE_SHOT_REACH_MM - CLOSE_SHOT_FULL_MM))


def clean_decimated(ob, target, name, focus=None):
    """Decimate, and lower the budget in small steps until no faces intersect."""
    for step in range(8):
        copy = decimated(ob, int(target * (1 - 0.015 * step)), name, focus)
        hits = self_intersections(copy.data)
        if hits == 0:
            return copy
        print(f"DECIMATE {len(copy.data.polygons)} triangles: {hits} intersecting face pairs, retrying")
        mesh = copy.data
        bpy.data.objects.remove(copy)
        bpy.data.meshes.remove(mesh)
    raise SystemExit("Decimation left intersecting faces at every budget.")


def decimated(ob, target, name, focus=None):
    """A new object with at most target triangles. Vertex colours survive.

    focus gives each vertex a value from 0 to 1. The decimation keeps more triangles where it is high.
    """
    count = len(ob.data.polygons)
    copy = ob.copy()
    copy.data = ob.data.copy()
    copy.name = name
    bpy.context.scene.collection.objects.link(copy)
    if count > target:
        mod = copy.modifiers.new("Decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = target / count
        if focus is not None:
            # The modifier collapses an edge later when the weights of its two vertices are low.
            group = copy.vertex_groups.new(name="decimate")
            levels = np.rint((1.0 - 0.5 * np.asarray(focus)) * 20).astype(int)
            for level in np.unique(levels):
                group.add(np.nonzero(levels == level)[0].tolist(), level / 20.0, "REPLACE")
            mod.vertex_group = group.name
            mod.vertex_group_factor = CLOSE_SHOT_TRIANGLES
        deps = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(copy.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
        copy.modifiers.clear()
        old = copy.data
        copy.data = mesh
        bpy.data.meshes.remove(old)
        # The new mesh carries the weights of the group. Removing the group here removes them too,
        # so the first skin group of the skeleton does not inherit them.
        for group in list(copy.vertex_groups):
            copy.vertex_groups.remove(group)
    bm = bmesh.new()
    bm.from_mesh(copy.data)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(copy.data)
    bm.free()
    copy.data.update()
    return copy


# The skeleton the site names: bone, parent, joint at the head, joint at the tail.
def bone_spec():
    spec = [("pelvis", None, "pelvis", "chest"), ("chest", "pelvis", "chest", "head"), ("head", "chest", "head", "head-end")]
    for i in range(4):          # the four face tentacles, two bones each
        spec += [(f"mouthpart-{i}", "head", f"mouthpart-{i}", f"mouthpart-{i}-tip"), (f"mouthpart-{i}-tip", f"mouthpart-{i}", f"mouthpart-{i}-tip", f"mouthpart-{i}-tip-end")]
    for s in ("left", "right"):
        spec += [
            (f"{s}-shoulder", "chest", f"{s}-shoulder", f"{s}-elbow"), (f"{s}-elbow", f"{s}-shoulder", f"{s}-elbow", f"{s}-hand"),
            (f"{s}-hand", f"{s}-elbow", f"{s}-hand", f"{s}-hand-end"),
            (f"{s}-rib", "chest", f"{s}-rib", f"{s}-small-elbow"), (f"{s}-small-elbow", f"{s}-rib", f"{s}-small-elbow", f"{s}-small-hand"),
            (f"{s}-small-hand", f"{s}-small-elbow", f"{s}-small-hand", f"{s}-small-hand-end"),
            (f"{s}-wing", "chest", f"{s}-wing", f"{s}-wing-tip"), (f"{s}-wing-tip", f"{s}-wing", f"{s}-wing-tip", f"{s}-wing-tip-end"),
            (f"{s}-hip", "pelvis", f"{s}-hip", f"{s}-knee"), (f"{s}-knee", f"{s}-hip", f"{s}-knee", f"{s}-foot"),
            (f"{s}-foot", f"{s}-knee", f"{s}-foot", f"{s}-foot-end"),
        ]
    return spec


def distance_weights(body, segments):
    """Fallback skin weights from the distance to each bone. Used only if heat weighting fails."""
    co = np.empty(len(body.data.vertices) * 3, dtype=np.float64)
    body.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    dist = np.empty((len(co), len(segments)))
    for j, (_, a, b) in enumerate(segments):
        a, b = np.array(a), np.array(b)
        ab = b - a
        t = np.clip(((co - a) @ ab) / (ab @ ab), 0.0, 1.0)
        dist[:, j] = np.linalg.norm(co - (a + t[:, None] * ab), axis=1)
    weight = 1.0 / (dist + 0.3) ** 6
    for name, _, _ in segments:
        if name not in body.vertex_groups:
            body.vertex_groups.new(name=name)
    top = np.argsort(-weight, axis=1)[:, :4]
    for j, (name, _, _) in enumerate(segments):
        group = body.vertex_groups[name]
        for vi in np.nonzero((top == j).any(axis=1))[0]:
            total = weight[vi, top[vi]].sum()
            group.add([int(vi)], float(weight[vi, j] / total), "REPLACE")


def eye_reach(points, eye):
    """Distance of each point from an eyeball centre, in eyeball radii. 1.0 is the eyeball surface."""
    local = (points - np.array(eye["centre_mm"])) / np.array(eye["radii_mm"])
    return np.sqrt((local ** 2).sum(axis=1))


def rigid_eye_sockets(body, eyes, inner=2.4, outer=4.0):
    """Weight the skin around each eyeball to the head bone only.

    The eyeball nodes follow the head bone rigidly. Heat weights give the skin beside them a
    share of other bones, so the skin slides past the eyeball in a pose and shows as a rim.
    Inside `inner` eye radii the skin is rigid on the head. The change fades out by `outer`.
    """
    co = np.empty(len(body.data.vertices) * 3)
    body.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    reach = np.full(len(co), np.inf)
    for eye in eyes:
        reach = np.minimum(reach, eye_reach(co, eye))
    t = np.clip((outer - reach) / (outer - inner), 0.0, 1.0)
    rigid = t * t * (3.0 - 2.0 * t)
    head = body.vertex_groups["head"]
    changed = 0
    for index in np.nonzero(rigid > 0.0)[0]:
        vertex, share = body.data.vertices[int(index)], float(rigid[index])
        for g in vertex.groups:
            if g.group != head.index:
                g.weight *= 1.0 - share
        others = sum(g.weight for g in vertex.groups if g.group != head.index)
        head.add([int(index)], 1.0 - others, "REPLACE")
        changed += 1
    return changed


FACE_JOINTS = ("face-jaw", "face-cheek-left", "face-cheek-right", "face-brow-0", "face-brow-1")


def smooth_step(value):
    t = np.clip(value, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def rig_face(body, J, eyes):
    """Rig the face with firm mouthparts and with a jaw, two cheeks, and two brows. Returns the new joint positions.

    Automatic weights smear each mouthpart along its length and into the skin of the face,
    so a swing of one mouthpart stretches the texture around it. Here each mouthpart is a
    jointed rod. The automatic weights still say which skin belongs to which mouthpart, because
    they follow the shape. Along the mouthpart the weights are firm: a short blend at the root
    and at the middle joint, and nothing else. Skin with only a trace of a mouthpart loses it.
    The jaw, the cheeks, and the brows have the names of the site's relief rig, so the site can
    drive them with that rig's face code. Their weights are smooth patches on the face, and
    the eye sockets stay rigid on the head. The mouthparts hang from the jaw.
    """
    co = np.empty(len(body.data.vertices) * 3)
    body.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    index_of = {g.name: g.index for g in body.vertex_groups}
    for name in FACE_JOINTS:
        if name not in index_of:
            index_of[name] = body.vertex_groups.new(name=name).index
    mouth = {index_of[f"mouthpart-{i}"] for i in range(4)} | {index_of[f"mouthpart-{i}-tip"] for i in range(4)}

    # 1. Each mouthpart: which skin it owns, from the automatic weights, and the position of each
    #    vertex along its line, in millimetres from the root joint.
    part_of = {index_of[f"mouthpart-{i}"]: i for i in range(4)} | {index_of[f"mouthpart-{i}-tip"]: i for i in range(4)}
    held = np.zeros((len(co), 4))
    for vertex in body.data.vertices:
        for g in vertex.groups:
            if g.group in part_of:
                held[vertex.index, part_of[g.group]] += g.weight
    owner = held.argmax(axis=1)
    share = smooth_step((held.sum(axis=1) - 0.2) / 0.5)              # 0 for a trace of a mouthpart, 1 for its own skin
    along = np.zeros(len(co))
    lengths = []
    for i in range(4):
        root, middle, end = (np.array(J[n]) for n in (f"mouthpart-{i}", f"mouthpart-{i}-tip", f"mouthpart-{i}-tip-end"))
        first, second = middle - root, end - middle
        lengths.append(float(np.linalg.norm(first)))
        on_first = (co - root) @ (first / lengths[i])
        on_second = (co - middle) @ (second / np.linalg.norm(second))
        mine = owner == i
        along[mine] = np.where(on_second[mine] > 0.0, lengths[i] + on_second[mine], np.minimum(on_first[mine], lengths[i]))
    member = share > 0.0
    on_part = smooth_step((along + 1.5) / 2.0)                        # 0 above the root, 1 just below it
    on_tip = smooth_step((along - (np.array(lengths)[owner] - 0.8)) / 1.6)

    # 2. Where the face joints sit.
    eye_centres = [np.array(eye["centre_mm"]) for eye in eyes]
    eye_radii = [np.array(eye["radii_mm"]) for eye in eyes]
    roots = np.array([J[f"mouthpart-{i}"] for i in range(4)])
    jaw_centre = roots.mean(axis=0)
    places = {
        "face-jaw": jaw_centre + np.array([0.0, 2.5, 1.5]),
        "face-cheek-left": eye_centres[0] + np.array([-eye_radii[0][0], 0.5, -2.6]),
        "face-cheek-right": eye_centres[1] + np.array([eye_radii[1][0] * 1.2, 0.5, -2.4]),
        "face-brow-0": eye_centres[0] + np.array([0.0, -0.3, eye_radii[0][2] * 1.6 + 0.4]),
        "face-brow-1": eye_centres[1] + np.array([0.0, -0.3, eye_radii[1][2] * 1.6 + 0.4]),
    }

    # 3. Smooth patches on the front of the face. A point takes its two largest patches.
    def patch(centre, across, height, power, peak):
        return np.clip(1.0 - ((co[:, 0] - centre[0]) / across) ** 2 - ((co[:, 2] - centre[2]) / height) ** 2, 0.0, 1.0) ** power * peak
    front = smooth_step((min(c[1] for c in eye_centres) + FACE_DEPTH_MM - co[:, 1]) / 2.0)
    clear = np.ones(len(co))
    for eye in eyes:
        clear *= smooth_step((eye_reach(co, eye) - 1.3) / 0.5)        # the sockets stay rigid on the head
    patches = np.stack([
        patch(jaw_centre + np.array([0.0, 0.0, -1.0]), 6.0, 4.5, 1.3, 0.93),
        patch(places["face-cheek-left"], 1.9, 3.2, 2.0, 0.5),
        patch(places["face-cheek-right"], 1.9, 3.2, 2.0, 0.5),
        patch(eye_centres[0] + np.array([0.0, 0.0, eye_radii[0][2] * 1.16]), eye_radii[0][0] * 1.6, 1.5, 2.0, 0.78),
        patch(eye_centres[1] + np.array([0.0, 0.0, eye_radii[1][2] * 1.16]), eye_radii[1][0] * 1.6, 1.5, 2.0, 0.78),
    ], axis=1) * (front * clear)[:, None]
    order = np.argsort(-patches, axis=1)[:, :2]
    kept = np.take_along_axis(patches, order, axis=1)
    kept *= np.minimum(1.0, 0.96 / np.maximum(kept.sum(axis=1), 1e-9))[:, None]

    jaw, head, changed = index_of["face-jaw"], index_of["head"], 0
    for vertex in body.data.vertices:
        i = vertex.index
        part, face = float(share[i]), float(kept[i].sum())
        had_trace = any(g.group in mouth for g in vertex.groups)
        if part <= 0.0 and face < 0.002 and not had_trace:
            continue
        for g in list(vertex.groups):
            if g.group in mouth:
                body.vertex_groups[g.group].remove([i])
        rest = sum(g.weight for g in vertex.groups)
        if rest < 1e-6:
            body.vertex_groups[head].add([i], 1.0, "REPLACE")
            rest = 1.0
        # The skin that is not a mouthpart: its old joints, and the face patches.
        for g in vertex.groups:
            g.weight *= (1.0 - part) * (1.0 - face) / rest
        wanted = {}
        for column in range(2):
            if kept[i, column] > 0.001:
                wanted[index_of[FACE_JOINTS[order[i, column]]]] = (1.0 - part) * float(kept[i, column])
        # The mouthpart: the jaw above its root, then its two joints.
        if part > 0.0:
            down, tip = float(on_part[i]), float(on_tip[i])
            wanted[jaw] = wanted.get(jaw, 0.0) + part * (1.0 - down)
            wanted[index_of[f"mouthpart-{owner[i]}"]] = part * down * (1.0 - tip)
            wanted[index_of[f"mouthpart-{owner[i]}-tip"]] = part * down * tip
        for group, weight in wanted.items():
            if weight > 0.001:
                body.vertex_groups[group].add([i], weight, "REPLACE")
        changed += 1
    return {name: Vector(place) for name, place in places.items()}, changed


def rig_fingers(body, J):
    """Give each finger of the two long hands two joints of its own. Returns the joints.

    The fingers are found in the mesh: past the knuckles, the skin of a hand falls apart into one
    piece for each finger. Each piece gets a joint at its base and one at its middle, along its
    own line. Its skin follows them, with a short blend at the base, so the palm does not move.
    The rest shape does not change: the generated fingers already curve as claws.
    Each entry of the result is name -> (position, parent, hinge). A turn about the hinge curls
    the finger toward the palm. The hinge is in model axes, for the straight stand.
    """
    mesh = body.data
    co = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    neighbours = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        neighbours[a].append(b)
        neighbours[b].append(a)
    out = {}
    for side in ("left", "right"):
        hand = body.vertex_groups[f"{side}-hand"]
        wrist, end = np.array(J[f"{side}-hand"]), np.array(J[f"{side}-hand-end"])
        length = float(np.linalg.norm(end - wrist))
        unit = (end - wrist) / length
        held = np.zeros(len(co))
        for vertex in mesh.vertices:
            for g in vertex.groups:
                if g.group == hand.index:
                    held[vertex.index] = g.weight
        along_hand = (co - wrist) @ unit / length
        # Distance over the skin from the wrist. A straight cut across the hand does not part the
        # fingers, because they spread and curl. A cut at one distance over the skin does.
        in_hand = held > 0.3
        far = np.full(len(co), np.inf)
        queue = [(0.0, int(i)) for i in np.nonzero(in_hand & (along_hand < 0.12))[0]]
        for _, i in queue:
            far[i] = 0.0
        heapq.heapify(queue)
        while queue:
            d, cur = heapq.heappop(queue)
            if d > far[cur]:
                continue
            for other in neighbours[cur]:
                if in_hand[other]:
                    step = d + float(np.linalg.norm(co[other] - co[cur]))
                    if step < far[other]:
                        far[other] = step
                        heapq.heappush(queue, (step, other))
        reached = np.isfinite(far)
        if not reached.any():
            continue
        longest = float(far[reached].max())

        def pieces_past(cut):
            pool = set(np.nonzero(reached & (far > cut * longest))[0].tolist())
            found, seen = [], set()
            for start in pool:
                if start in seen:
                    continue
                stack, piece = [start], []
                seen.add(start)
                while stack:
                    cur = stack.pop()
                    piece.append(cur)
                    for other in neighbours[cur]:
                        if other in pool and other not in seen:
                            seen.add(other)
                            stack.append(other)
                if len(piece) >= 12:
                    found.append(np.array(piece))
            return found
        # The knuckle line: the first cut that parts the most fingers.
        fingers = []
        for cut in np.arange(0.20, 0.80, 0.03):
            found = pieces_past(float(cut))
            if len(found) > len(fingers) and len(found) <= 6:
                fingers = found
        if len(fingers) < 4:
            fingers = []
        if not fingers:
            continue
        spread = co[held > 0.5] - co[held > 0.5].mean(axis=0)
        palm = np.linalg.eigh(spread.T @ spread)[1][:, 0]             # the flat direction of the hand
        across = np.cross(unit, palm)
        inward = np.array([-np.sign(wrist[0]), 0.6, 0.0])            # the claws hook toward the body and the back
        order = sorted(range(len(fingers)), key=lambda k: float((co[fingers[k]].mean(axis=0) - wrist) @ across))
        for number, k in enumerate(order):
            piece = fingers[k]
            points = co[piece]
            centred = points - points.mean(axis=0)
            line = np.linalg.eigh(centred.T @ centred)[1][:, 2]       # the long direction of the finger
            if line @ unit < 0:
                line = -line
            reach = centred @ line
            base = points.mean(axis=0) + line * reach.min()
            span = float(reach.max() - reach.min())
            hinge = np.cross(line, palm)
            hinge /= np.linalg.norm(hinge)
            if np.cross(hinge, line) @ inward < 0:
                hinge = -hinge
            names = (f"{side}-finger-{number}", f"{side}-finger-{number}-tip")
            groups = [body.vertex_groups.get(name) or body.vertex_groups.new(name=name) for name in names]
            t = (points - base) @ line / span
            on_finger = smooth_step(t / 0.22)
            on_tip = smooth_step((t - 0.40) / 0.22)
            for index, a, b in zip(piece.tolist(), on_finger.tolist(), on_tip.tolist()):
                weight = float(held[index])
                hand.add([index], weight * (1.0 - a), "REPLACE")
                for group, share in zip(groups, (a * (1.0 - b), a * b)):
                    if share > 0.001:
                        group.add([index], weight * share, "REPLACE")
            out[names[0]] = (Vector(base), f"{side}-hand", Vector(hinge))
            out[names[1]] = (Vector(base + line * span * 0.5), names[0], Vector(hinge))
    return out


def add_skeleton(body, joints, shift, eyes=()):
    """Bind the body to the skeleton (25 body bones and 8 face tentacle bones) and add an idle clip."""
    scene = bpy.context.scene
    J = {n: Vector(p) - Vector((shift[0], shift[1], 0.0)) for n, p in joints.items()}
    data = bpy.data.armatures.new("Brundlefly-skeleton")
    arm = bpy.data.objects.new("Brundlefly-skeleton", data)
    scene.collection.objects.link(arm)
    for o in scene.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    spec = bone_spec()

    # 1. Bones along the limbs, for the weights.
    bpy.ops.object.mode_set(mode="EDIT")
    for name, parent, head, tail in spec:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = J[head], J[tail]
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")

    body.select_set(True)
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    used = {g.group for v in body.data.vertices for g in v.groups if g.weight > 0}
    bound = len(used) >= len(spec) - 2 and all(len(v.groups) > 0 for v in body.data.vertices)
    method = "heat"
    if not bound:
        method = "distance"
        for group in list(body.vertex_groups):
            body.vertex_groups.remove(group)
        distance_weights(body, [(name, J[head], J[tail]) for name, _, head, tail in spec])
        if not any(m.type == "ARMATURE" for m in body.modifiers):
            body.modifiers.new("Armature", "ARMATURE").object = arm
            body.parent = arm
    for o in scene.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    face_joints = {}
    finger_joints = rig_fingers(body, J)
    print(f"RIG fingers: {len(finger_joints) // 2} fingers with joints")
    if eyes:
        print(f"RIG eye sockets rigid on the head: {rigid_eye_sockets(body, eyes)} vertices")
    if len(eyes) == 2:
        face_joints, changed = rig_face(body, J, eyes)
        bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
        bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
        print(f"RIG face: {len(face_joints)} joints, {changed} vertices")

    # 2. Point every bone straight up. Each joint then has an identity rest rotation:
    #    +X is screen right, +Y is up, +Z is toward the viewer, for every bone.
    body.select_set(False)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in data.edit_bones:
        bone.use_connect = False
    # The face joints come after the automatic weights: their weights are set by rig_face.
    for name, place in face_joints.items():
        joint = data.edit_bones.new(name)
        joint.head = place
        joint.tail = place + Vector((0.0, 0.0, 4.0))
        joint.parent = data.edit_bones["head"]
    for name, (place, parent, _) in finger_joints.items():
        joint = data.edit_bones.new(name)
        joint.head = place
        joint.tail = place + Vector((0.0, 0.0, 4.0))
        joint.parent = data.edit_bones[parent]
    if "face-jaw" in face_joints:
        for i in range(4):
            data.edit_bones[f"mouthpart-{i}"].parent = data.edit_bones["face-jaw"]
    for bone in data.edit_bones:
        bone.tail = bone.head + Vector((0.0, 0.0, 4.0))
        bone.roll = 0.0
    bpy.ops.object.mode_set(mode="OBJECT")
    for name, (_, _, hinge) in finger_joints.items():
        data.bones[name]["hinge_model"] = [float(c) for c in hinge]

    # 3. Idle clip: slow breathing, a small head turn, twitching small arms, fluttering wings.
    deg = math.radians
    motion = {   # bone: [(axis, amplitude, cycles, phase)]
        "chest": [(0, deg(1.6), 1, 0.0), (2, deg(0.8), 1, 1.0)],
        "head": [(0, deg(2.2), 1, 0.6), (1, deg(3.0), 1, 2.0)],
    }
    for s, sign in (("left", -1), ("right", 1)):
        motion[f"{s}-shoulder"] = [(2, sign * deg(2.5), 1, 0.4), (0, deg(1.5), 1, 1.2)]
        motion[f"{s}-elbow"] = [(0, deg(3.0), 1, 2.0)]
        motion[f"{s}-hand"] = [(0, deg(4.0), 2, 0.3)]
        motion[f"{s}-rib"] = [(0, deg(5.0), 2, 0.5 + sign)]
        motion[f"{s}-small-elbow"] = [(0, deg(6.0), 2, 1.5 + sign)]
        motion[f"{s}-wing"] = [(2, sign * deg(6.0), 2, 0.0)]
        motion[f"{s}-wing-tip"] = [(2, sign * deg(8.0), 2, 0.7)]
    for i in range(4):          # the face tentacles sway out of step with each other
        motion[f"mouthpart-{i}"] = [(0, deg(7.0), 2, 0.9 * i), (2, deg(4.0), 1, 1.7 * i)]
        motion[f"mouthpart-{i}-tip"] = [(0, deg(9.0), 2, 0.9 * i + 0.8)]
    action = bpy.data.actions.new("Brundlefly-idle")
    arm.animation_data_create().action = action
    frames, fps = 96, 24
    scene.render.fps = fps
    scene.frame_start, scene.frame_end = 1, frames + 1
    for name, terms in motion.items():
        pose = arm.pose.bones[name]
        pose.rotation_mode = "XYZ"
        for frame in range(1, frames + 2, 4):
            t = (frame - 1) / frames
            angles = [0.0, 0.0, 0.0]
            for axis, amplitude, cycles, phase in terms:
                angles[axis] += amplitude * math.sin(2 * math.pi * cycles * t + phase)
            pose.rotation_euler = angles
            pose.keyframe_insert("rotation_euler", frame=frame)
    scene.frame_set(1)
    for pose in arm.pose.bones:
        pose.rotation_euler = (0.0, 0.0, 0.0)
    print(f"RIG bones {len(data.bones)} weights {method} groups from the automatic weights {len(used)}")
    return arm


def behind_nearest(across, height, depth, surface_across, surface_height, surface_depth, cell=0.4):
    """How far each point lies behind the nearest surface on its line of sight, in millimetres.

    across and height place a point in the picture, and depth grows away from the viewer. The
    surface arrays hold a dense set of points on the model, in the same three measures.
    """
    low_u, low_v = surface_across.min(), surface_height.min()
    su = np.floor((surface_across - low_u) / cell).astype(int)
    sv = np.floor((surface_height - low_v) / cell).astype(int)
    shape = (int(su.max()) + 1, int(sv.max()) + 1)
    nearest = np.full(shape[0] * shape[1], np.inf)
    np.minimum.at(nearest, su * shape[1] + sv, surface_depth)
    u = np.clip(np.floor((across - low_u) / cell).astype(int), 0, shape[0] - 1)
    v = np.clip(np.floor((height - low_v) / cell).astype(int), 0, shape[1] - 1)
    flat = u * shape[1] + v
    # A neighbour cell can hold the true nearest surface at the edge of a part.
    grid = nearest.reshape(shape)
    spread = grid.copy()
    spread[1:] = np.minimum(spread[1:], grid[:-1]); spread[:-1] = np.minimum(spread[:-1], grid[1:])
    spread[:, 1:] = np.minimum(spread[:, 1:], grid[:, :-1]); spread[:, :-1] = np.minimum(spread[:, :-1], grid[:, 1:])
    return depth - spread.reshape(-1)[flat]


def hidden_from_views(points, known, joints, surface):
    """For each sheet view, how far it cannot see each surface point: 0 is in plain view, 1 is hidden.

    The sheet views are flat pictures. A projection paints every surface along a line of sight,
    so a mouthpart or an arm in front of the body is also painted on the body behind it. When
    the part moves, its painted copy stays, and the texture seems to slide. Two tests find the
    surfaces that must not take the sharp picture:
    1. Depth. A point that lies more than a millimetre behind the nearest surface on its line
       of sight is hidden in that view.
    2. The mouth. The sheet draws the mouthparts longer than the model has them, so their
       ends are painted on the chest with nothing in front. The skin under and behind the
       mouthparts is hidden from the front view, except the mouthparts themselves.
    points are in millimetres of the straight stand. known marks the points that exist.
    surface is a dense set of points on the model, also in millimetres: the vertices of the
    full mesh. The depth comes from it and not from the texels, because the texels in the
    margin around each texture island hold blended positions that lie in mid-air.
    """
    cell, slack = 0.4, 1.0
    out = {}
    for name, setup in bfm.VIEW_SETUP.items():
        across = setup["axis"]                       # the axis that runs across the picture
        depth_axis, toward = setup["facing"]         # the surface normal that faces the view
        depth = points[:, depth_axis] * -toward      # larger is farther from the viewer
        behind = behind_nearest(points[:, across], points[:, 2], depth, surface[:, across], surface[:, 2], surface[:, depth_axis] * -toward, cell)
        out[name] = np.where(known & np.isfinite(behind), smooth_step((behind - slack) / 0.6), 0.0)
    under = {}
    if joints and "front" in out:
        def rods_of(names):
            return [(np.array(joints[a]), np.array(joints[b])) for a, b in zip(names, names[1:])]
        mouth = [rod for i in range(4) for rod in rods_of([f"mouthpart-{i}", f"mouthpart-{i}-tip", f"mouthpart-{i}-tip-end"])]
        small = [rod for side in ("left", "right") for rod in rods_of([f"{side}-rib", f"{side}-small-elbow", f"{side}-small-hand", f"{side}-small-hand-end"])]

        def from_rods(rods, flat):
            """Distance of each point from the nearest rod, and how far it lies behind that rod. flat measures in the picture plane only."""
            best, behind = np.full(len(points), np.inf), np.zeros(len(points))
            for a, b in rods:
                step = b - a
                keep = np.array([1.0, 0.0, 1.0]) if flat else np.ones(3)
                t = np.clip(((points - a) * keep) @ step / ((step * keep) @ step), 0.0, 1.0)
                on_rod = a + t[:, None] * step
                distance = np.linalg.norm((points - on_rod) * keep, axis=1)
                closer = distance < best
                best[closer], behind[closer] = distance[closer], (points[:, 1] - on_rod[:, 1])[closer]
            return best, behind
        ends = np.array([p for rod in mouth for p in rod])
        zone = (smooth_step((points[:, 0] - (ends[:, 0].min() - 3.5)) / 1.5) * smooth_step(((ends[:, 0].max() + 3.5) - points[:, 0]) / 1.5)
                * smooth_step((points[:, 2] - (ends[:, 2].min() - 10.0)) / 2.0) * smooth_step(((ends[:, 2].max() - 0.5) - points[:, 2]) / 1.5)
                * (points[:, 1] < ends[:, 1].max() + 14.0))
        own = 1.0 - smooth_step((from_rods(mouth, False)[0] - 1.3) / 0.8)           # 1 on a mouthpart, 0 away from it
        below = zone * (1.0 - own)
        # The skin behind a small arm: inside the arm's outline in the picture, and behind the arm.
        across, behind = from_rods(small, True)
        below = np.maximum(below, (1.0 - smooth_step((across - 2.0) / 1.0)) * smooth_step((behind - 1.6) / 0.8))
        below = np.where(known, below, 0.0)
        out["front"] = np.maximum(out["front"], below)
        under["front"] = below
        ring = from_rods(mouth, False)[0]
        return out, under, np.where(known, own, 0.0), known & (ring > 2.6) & (ring < 5.5)
    return out, under, np.zeros(len(points)), np.zeros(len(points), dtype=bool)


def skin_detail(view, side=192):
    """A square of fine skin detail from a painted view, as a factor around 1, that repeats without a seam.

    The square is the window of the view that is most evenly flesh: all inside the figure, with
    the least change in colour. Its broad tone is divided out, so only pores and wrinkles stay.
    It is mirrored into a square of twice the size, so its edges meet themselves.
    """
    figure, linear = view["figure"], view["linear"]
    best, place = None, None
    for row in range(0, figure.shape[0] - side, 24):
        for col in range(0, figure.shape[1] - side, 24):
            if not figure[row:row + side, col:col + side].all():
                continue
            window = linear[row:row + side:4, col:col + side:4]
            red = window[..., 0] / np.maximum(window.sum(axis=2), 1e-6)
            score = float(window.reshape(-1, 3).std(axis=0).sum()) - float(red.mean())      # even, and red
            if best is None or score < best:
                best, place = score, (row, col)
    if place is None:
        return None
    tone = linear[place[0]:place[0] + side, place[1]:place[1] + side] @ np.array([0.30, 0.59, 0.11])
    broad = tone.copy()
    for _ in range(3):
        for axis in (0, 1):
            broad = sum(np.roll(broad, k, axis) for k in range(-6, 7)) / 13.0
    fine = np.clip(tone / np.maximum(broad, 1e-6), 0.6, 1.5)
    top = np.concatenate([fine, fine[:, ::-1]], axis=1)
    return np.concatenate([top, top[::-1]], axis=0)


def fold_shadow(field_path, points, normals, known, size, small):
    """Soft shadow on the model, as two images of side `small`: 1 is open skin, lower is shadow.

    The first image is the shadow in the folds. The second is the broad shadow where another part
    of the body stands close over the skin: under the chin, in the armpits, behind the mouthparts.
    Both come from the solid shape, not from rays. Around a point on flat skin, half of a small
    ball is solid. In a crease more than half is solid, and on a ridge less. So the share of solid
    near each texel says how deep in a fold it lies. For the broad shadow the ball is larger and
    sits above the skin, along the normal: over open skin it is almost empty, and the solid it
    holds is what stands in the way of the light. A ray bake on the decimated mesh gave noise
    from triangle to triangle.
    points are texel positions in the build's coordinates. known marks the texels that exist.
    """
    if not os.path.exists(field_path):
        return None, None
    data = np.load(field_path)
    shape = tuple(int(n) for n in data["shape"])
    solid = np.unpackbits(data["solid"])[: shape[0] * shape[1] * shape[2]].reshape(shape).astype(np.float32)
    lo, h = data["lo"].astype(np.float64), float(data["h"])
    solid = solid[: shape[0] // 2 * 2, : shape[1] // 2 * 2, : shape[2] // 2 * 2]
    coarse = solid.reshape(shape[0] // 2, 2, shape[1] // 2, 2, shape[2] // 2, 2).mean(axis=(1, 3, 5))
    step = size // small

    def share_of_solid(reach_mm, at):
        """The share of solid in a soft ball around each point. Two box blurs make the ball."""
        reach = max(int(round(reach_mm / (2 * h))), 1)
        blurred = coarse
        for _ in range(2):
            for axis in range(3):
                total = np.cumsum(np.pad(blurred, [(reach + 1, reach) if a == axis else (0, 0) for a in range(3)], mode="edge"), axis=axis)
                blurred = (np.take(total, range(2 * reach + 1, total.shape[axis]), axis=axis) - np.take(total, range(0, total.shape[axis] - 2 * reach - 1), axis=axis)) / (2 * reach + 1)
        index = np.clip(np.rint((at - lo) / (2 * h) - 0.5).astype(int), 0, np.array(blurred.shape) - 1)
        return blurred[index[:, 0], index[:, 1], index[:, 2]]

    def image(value):
        return np.where(known, value, 1.0).reshape(small, step, small, step).mean(axis=(1, 3))

    fold = image(1.0 - smooth_step((share_of_solid(FOLD_SHADOW_MM, points) - 0.52) / FOLD_SHADOW_SPAN))
    above = share_of_solid(BROAD_SHADOW_MM / 2.0, points + normals * BROAD_SHADOW_LIFT_MM)
    start, full = BROAD_SHADOW_SHARE
    broad = image(1.0 - BROAD_SHADOW_STRENGTH * smooth_step((above - start) / (full - start)))
    return fold, broad


def enlarge_close_shot_islands(mesh, scale):
    """Make the UV islands of the close shot larger, each about its own centre. Returns (islands made larger, islands).

    An island grows by its share of the close shot, so an island that lies half in it grows half as much.
    The islands overlap afterward. The caller packs them again, which keeps their sizes relative to each other.
    """
    loops = len(mesh.loops)
    uv = np.empty(loops * 2)
    mesh.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    corner_vertex = np.empty(loops, dtype=np.int32)
    mesh.loops.foreach_get("vertex_index", corner_vertex)
    co = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    faces = loops // 3                                         # the mesh is triangles
    # Two triangles are in one island when they share a vertex at the same place in the UV square.
    _, corner = np.unique(np.column_stack([corner_vertex, np.rint(uv * 1e6).astype(np.int64)]), axis=0, return_inverse=True)
    corner = corner.reshape(faces, 3)
    label = np.arange(faces)
    while True:
        lowest = np.full(corner.max() + 1, faces)
        np.minimum.at(lowest, corner, label[:, None])
        merged = lowest[corner].min(axis=1)
        merged = merged[merged]                                 # follow one link, so long islands settle fast
        if (merged == label).all():
            break
        label = merged
    _, island = np.unique(label, return_inverse=True)
    a, b, c = (co[corner_vertex.reshape(faces, 3)[:, k]] for k in range(3))
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1) / 2.0
    focus = close_shot_focus((a + b + c) / 3.0)
    count = island.max() + 1
    share = np.bincount(island, area * focus, count) / np.maximum(np.bincount(island, area, count), 1e-9)
    factor = 1.0 + (scale - 1.0) * share
    loop_island = np.repeat(island, 3)
    centre = np.column_stack([np.bincount(loop_island, uv[:, k], count) for k in range(2)]) / np.bincount(loop_island, minlength=count)[:, None]
    uv = centre[loop_island] + (uv - centre[loop_island]) * factor[loop_island][:, None]
    mesh.uv_layers.active.data.foreach_set("uv", uv.ravel())
    return int((share > 0.5).sum()), int(count)


def fill_painted_sockets(view, spots, eyes, projection, pixel_mm):
    """Fill the dark socket that a painted view has at each eye with the skin around it.

    A painted view has a dark socket at each eye, and it paints both about as large as the larger one.
    The model shades its own sockets, at their true sizes. The disc is small, so the wrinkles around
    the eyes stay. spots holds the column and the row of each eye centre in the view. pixel_mm is the
    size of one pixel of the view, in build millimetres.
    """
    reach = PAINTED_SOCKET_RADII * max(eye["radii_mm"][0] for eye in eyes) / projection["mesh_scale"] / pixel_mm
    dark = np.zeros(view["figure"].shape, dtype=bool)
    rows, cols = np.mgrid[0:dark.shape[0], 0:dark.shape[1]]
    for col, row in spots:
        dark |= ((cols - col) ** 2 + (rows - row) ** 2 < reach ** 2) & view["figure"] & (view["rgb"].max(axis=2) < 0.30)
    if dark.any():
        filled = bfm.dilate(dark, max(2, int(round(0.14 / pixel_mm))))
        bfm.fill_from_edges(view, filled)
        # The fill grows from the pale rim of the painted socket, so it comes out too light.
        view["linear"][filled] *= PAINTED_SOCKET_TONE
    return int(dark.sum())


def eye_spots(to_image, eyes, projection):
    """The column and the row of each eye centre in a view that looks along Y."""
    spots = []
    for eye in eyes:
        centre = np.array(eye["centre_mm"]) / projection["mesh_scale"]
        col, row = to_image(np.array([centre[0]]), np.array([centre[2] + projection["field_zmin"]]))
        spots.append((float(col[0]), float(row[0])))
    return spots


def read_between(image, col, row):
    """The colours of an image at fractional columns and rows, blended from the four pixels around each."""
    col = np.clip(col, 0.0, image.shape[1] - 1.001)
    row = np.clip(row, 0.0, image.shape[0] - 1.001)
    c0, r0 = np.floor(col).astype(int), np.floor(row).astype(int)
    fc, fr = (col - c0)[:, None], (row - r0)[:, None]
    return (image[r0, c0] * (1 - fc) + image[r0, c0 + 1] * fc) * (1 - fr) + (image[r0 + 1, c0] * (1 - fc) + image[r0 + 1, c0 + 1] * fc) * fr


def turned(points, yaw, pivot=(0.0, 0.0)):
    """Points turned about the vertical through the pivot, so that a view from the angle yaw becomes the front view.

    After the turn, X runs across that view and Y grows away from its viewer. Positive yaw puts the viewer toward +X.
    """
    c, s = math.cos(yaw), math.sin(yaw)
    x, y = points[:, 0] - pivot[0], points[:, 1] - pivot[1]
    out = np.array(points, dtype=np.float64)
    out[:, 0] = x * c + y * s + pivot[0]
    out[:, 1] = -x * s + y * c + pivot[1]
    return out


def overlay_oblique_views(linear, position, normal, baked, surface, folder, eyes, projection, front_hidden, keep_front):
    """Lay the oblique paintings of the head over the base colour. Returns how far each texel took one, from 0 to 1.

    head-views.json lists paintings of the head from angles between the front and the sides. Each
    was painted over a render in the frame that the file gives, in the millimetres of the working
    mesh, so nothing is fitted. A texel takes the painting that it faces most squarely, if that
    painting sees it. The front painting keeps what faces the front, with a narrow blend between
    the two, because two paintings never agree wrinkle for wrinkle. keep_front marks texels that
    stay with the front painting whatever they face: the rims of the eyes and the mouthparts.
    """
    path = os.path.join(folder, "head-views.json")
    cover = np.zeros(len(position))
    if not os.path.exists(path):
        return cover
    with open(path) as fh:
        frame = json.load(fh)
    pivot, centre_z, span = frame["pivot_mm"], frame["centre_z_mm"], frame["span_mm"]
    skull = smooth_step((SKULL_REACH_MM - np.linalg.norm(position - np.array(SKULL_CENTRE), axis=1)) / (SKULL_REACH_MM - SKULL_FULL_MM))
    front_facing = np.clip(-normal[:, 1], 0.0, 1.0) * (1.0 - front_hidden)
    for entry in frame["views"]:
        yaw = math.radians(entry["yaw_degrees"])
        view = bfm.load_view(os.path.join(folder, entry["image"]))
        height, width = view["figure"].shape

        def to_image(points):                                   # working mesh millimetres in, column and row from the bottom out
            seen_from = turned(points, yaw, pivot)
            return ((seen_from[:, 0] - pivot[0]) / span + 0.5) * width - 0.5, ((seen_from[:, 2] - centre_z) / span + 0.5) * height - 0.5, seen_from[:, 1]

        rim = turned(surface, yaw, pivot)
        if eyes:
            centres = np.array([eye["centre_mm"] for eye in eyes], dtype=np.float64)
            cols, rows, depth = to_image(centres)
            hidden_eye = behind_nearest(turned(centres, yaw, pivot)[:, 0], centres[:, 2], depth, rim[:, 0], rim[:, 2], rim[:, 1])
            spots = [(float(c), float(r)) for c, r, far in zip(cols, rows, hidden_eye) if not far > 1.0]
            filled = fill_painted_sockets(view, spots, eyes, projection, span / width / projection["mesh_scale"]) if spots else 0
        col, row, depth = to_image(position)
        inside = baked & (col >= 0) & (col <= width - 1.001) & (row >= 0) & (row <= height - 1.001)
        rows_, cols_ = np.mgrid[0:height, 0:width]
        border = np.minimum(np.minimum(cols_, width - 1 - cols_) / width, np.minimum(rows_, height - 1 - rows_) / height)
        weight = smooth_step(border / DETAIL_FEATHER) * bfm.erode(view["figure"], 3)
        behind = behind_nearest(turned(position, yaw, pivot)[:, 0], position[:, 2], depth, rim[:, 0], rim[:, 2], rim[:, 1])
        seen = 1.0 - np.where(np.isfinite(behind), smooth_step((behind - 1.0) / 0.6), 0.0)
        facing = np.clip(-turned(normal, yaw)[:, 1], 0.0, 1.0)
        share = (smooth_step((facing - OBLIQUE_FACING[0]) / (OBLIQUE_FACING[1] - OBLIQUE_FACING[0])) * seen * skull
                 * smooth_step((facing - front_facing) / 0.16 + 0.5) * (1.0 - keep_front))
        share[~inside] = 0.0
        index = np.nonzero(share > 0.0)[0]
        share[index] *= weight[np.rint(row[index]).astype(int), np.rint(col[index]).astype(int)]
        source = np.where(view["figure"][..., None], view["linear"], view["spread"])
        take = np.maximum(share[index] - cover[index], 0.0) / np.maximum(1.0 - cover[index], 1e-6)   # a later view only adds what is left
        linear[index] = linear[index] * (1.0 - take[:, None]) + read_between(source, col[index], row[index]) * take[:, None]
        cover[index] = np.maximum(cover[index], share[index])
        print(f"TEXTURE oblique painting {entry['image']}: {float((share[baked] > 0.5).mean()):.3f} of the surface, {filled if eyes else 0} dark socket pixels filled")
    return cover


def load_detail_view(folder, projection, eyes):
    """The close painting of the head, if the folder has one: (view name, image data, to_image, weight).

    head.json gives the frame of the painting in the millimetres of the working mesh. The painting was
    made over a render in that frame, so nothing is fitted. The weight is 1 where the painting replaces
    the view it belongs to, and it falls to 0 at the borders of the painting and at the outline of the figure.
    """
    path = os.path.join(folder, "head.json")
    if not os.path.exists(path):
        return None
    with open(path) as fh:
        frame = json.load(fh)
    view = bfm.load_view(os.path.join(folder, frame["image"]))
    height, width = view["figure"].shape
    scale, zmin = projection["mesh_scale"], projection["field_zmin"]
    (cx, cz), span = frame["centre_mm"], frame["span_mm"]

    def to_image(u, z):                                         # build coordinates in, column and row from the bottom out
        return ((np.asarray(u) * scale - cx) / span + 0.5) * width - 0.5, (((np.asarray(z) - zmin) * scale - cz) / span + 0.5) * height - 0.5

    pixel_mm = span / width / scale
    if eyes:
        print(f"TEXTURE close painting: {fill_painted_sockets(view, eye_spots(to_image, eyes, projection), eyes, projection, pixel_mm)} dark socket pixels filled")
    rows, cols = np.mgrid[0:height, 0:width]
    border = np.minimum(np.minimum(cols, width - 1 - cols) / width, np.minimum(rows, height - 1 - rows) / height)
    weight = smooth_step(border / DETAIL_FEATHER) * bfm.erode(view["figure"], 3)
    return frame["view"], view, to_image, weight


def bake_sheet_texture(body, projection, views_dir, size, eyes, joints, surface, relief_size=0, field_path=None):
    """Replace the vertex colours with a texture that carries the sheet at its own resolution.

    Vertex colours can only be as sharp as the mesh is dense. A texture keeps every pixel
    of the artwork. Cycles bakes the position and the normal of each texel, and the same
    projection that colours the vertices then colours the texels.
    """
    scene = bpy.context.scene
    for o in scene.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(78), island_margin=0.002)   # fewer islands, fewer split vertices
    bpy.ops.object.mode_set(mode="OBJECT")
    grown = enlarge_close_shot_islands(body.data, CLOSE_SHOT_TEXELS)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=False, scale=True, margin_method="FRACTION", margin=0.002, shape_method="CONCAVE")
    bpy.ops.object.mode_set(mode="OBJECT")
    print(f"TEXTURE {grown[0]} of {grown[1]} UV islands are larger for the close shot")

    material = body.data.materials[0]
    nodes = material.node_tree.nodes
    target = nodes.new("ShaderNodeTexImage")
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    passes = {}
    for kind in ("POSITION", "NORMAL"):
        image = bpy.data.images.new(f"bake-{kind}", size, size, alpha=True, float_buffer=True, is_data=True)
        target.image = image
        nodes.active = target
        if kind == "NORMAL":
            bpy.ops.object.bake(type="NORMAL", normal_space="OBJECT", margin=12)
        else:
            bpy.ops.object.bake(type="POSITION", margin=12)
        px = np.empty(size * size * 4, dtype=np.float32)
        image.pixels.foreach_get(px)
        passes[kind] = px.reshape(size * size, 4)[:, :3].astype(np.float64)
        bpy.data.images.remove(image)
    position, normal = passes["POSITION"], passes["NORMAL"] * 2.0 - 1.0
    baked = np.abs(position).sum(axis=1) > 1e-6

    z_low, z_high = projection["blend_z"]
    paint = projection.get("paint")
    if paint and paint["views"]:
        # Painted views: each was painted over a render of this mesh, and none has painted eyes.
        views_dir = os.path.join(views_dir, paint["folder"])
        views = {name: (bfm.load_view(os.path.join(views_dir, fit["image"])), bfm.blended_fit(fit["body"], fit["head"], z_low, z_high))
                 for name, fit in paint["views"].items()}
        if "front" in views and eyes:
            fill_painted_sockets(views["front"][0], eye_spots(views["front"][1], eyes, projection), eyes, projection, paint["views"]["front"]["body"]["s"])
        detail = load_detail_view(views_dir, projection, eyes)
        if detail is not None and detail[0] in views:
            views[detail[0]][0]["detail"] = detail[1:]
    else:
        views = {name: (bfm.load_view(os.path.join(views_dir, fit["image"])), bfm.blended_fit(fit["body"], fit["head"], z_low, z_high, fit.get("head_u")))
                 for name, fit in projection["views"].items()}
        bfm.erase_all_eyes(views)
    colour = bfm.sheet_colour_fn(views)
    field = position / projection["mesh_scale"]              # texel positions, back in the build's coordinates
    field[:, 2] += projection["field_zmin"]
    linear = np.tile(bfm.bm.srgb_to_linear(bfm.bm.PALETTE[bfm.bm.FLESH]), (size * size, 1))
    hidden, under, on_mouthpart, near_mouthpart = hidden_from_views(position, baked, joints, surface)
    under_path = os.path.join(views_dir, "front-under.png")
    if "front" in views and os.path.exists(under_path):
        print(f"TEXTURE under image shares {bfm.attach_under(views['front'][0], under_path):.3f} of its figure with the front view")
    linear[baked] = colour(field[baked], normal[baked], {name: value[baked] for name, value in hidden.items()}, {name: value[baked] for name, value in under.items()})
    # How much of each texel's colour is the blurred fallback: no view both faces it and sees it.
    seen = np.zeros(len(position))
    weight = np.zeros(len(position))
    for name, value in hidden.items():
        component, direction = bfm.VIEW_SETUP[name]["facing"]
        facing = np.clip(normal[:, component] * direction, 0.0, 1.0) ** 2
        below = under.get(name, 0.0) if "under" in views.get(name, ({},))[0] else 0.0
        seen += facing * (1.0 - value * (1.0 - below))
        weight += facing
        front_on = baked & (normal[:, component] * direction > 0.7)
        print(f"TEXTURE {name}: {float(value[front_on].mean()):.3f} of the surface that faces it is hidden behind another part")
    plain = np.where(baked, 1.0 - seen / np.maximum(weight, 1e-6), 0.0)
    plain[weight < 1e-6] = 1.0
    if paint and paint["views"] and "front" in hidden:
        # The mouthparts and the rim of each eye stay with the front painting. The skin beside and
        # under the mouthparts does not: an oblique painting leaves out what it cannot see.
        keep_front = on_mouthpart.copy()
        for eye in eyes:
            keep_front = np.maximum(keep_front, 1.0 - smooth_step((eye_reach(position, eye) - 1.2) / 0.6))
        took = overlay_oblique_views(linear, position, normal, baked, surface, views_dir, eyes, projection, hidden["front"], keep_front)
        plain *= 1.0 - took

    # The mouthparts take the flesh colour of the face around their roots and keep their own light and dark.
    # The painted ones are a pale yellow, which reads as tusks. A share of their own colour stays, toward the tips.
    if near_mouthpart.any():
        tone = np.array([0.30, 0.59, 0.11])
        flesh = linear[near_mouthpart & (plain < 0.3)].mean(axis=0) if (near_mouthpart & (plain < 0.3)).any() else linear[near_mouthpart].mean(axis=0)
        own = linear[baked & (on_mouthpart > 0.9)]
        level = float((own @ tone).mean()) if len(own) else 1.0
        share = (on_mouthpart * MOUTHPART_FLESH)[:, None]
        tinted = flesh * ((linear @ tone) / max(level, 1e-6))[:, None]
        linear[baked] = (linear * (1.0 - share) + tinted * share)[baked]

    # Skin that no view sees is a plain blur. It takes the fine detail of the painted skin: one patch
    # of it, laid on from three sides, so the belly, the inner thighs, and the skin under the chin
    # have pores and wrinkles too.
    detail = skin_detail(views["front"][0]) if "front" in views else None
    if detail is not None:
        pixel = DETAIL_MM_PER_PIXEL
        span = detail.shape[0]
        def sample(a, b):
            return detail[np.rint(a / pixel).astype(int) % span, np.rint(b / pixel).astype(int) % span]
        lean = np.abs(normal) ** 4
        lean /= np.maximum(lean.sum(axis=1, keepdims=True), 1e-6)
        grain = (sample(field[:, 1], field[:, 2]) * lean[:, 0] + sample(field[:, 0], field[:, 2]) * lean[:, 1] + sample(field[:, 0], field[:, 1]) * lean[:, 2])
        linear[baked] = (linear * (1.0 + (grain - 1.0) * plain * DETAIL_AMOUNT)[:, None])[baked]
        print(f"TEXTURE {float((plain[baked] > 0.5).mean()):.3f} of the surface takes its detail from the skin patch")
    # Inside each eye socket the texture is dark, so the gap around the eye reads as shadow.
    # Inside a socket the skin keeps its own colour and grows dark toward the eyeball: a shadowed
    # fold of flesh, not a black hole. A black socket showed as a crescent under an open eye.
    for eye in eyes:
        reach = eye_reach(position, eye)
        shade = SOCKET_SHADE + (1.0 - SOCKET_SHADE) * smooth_step((reach - 0.9) / (EYE_DARK_SCALE - 0.9))
        inside = baked & (reach < EYE_DARK_SCALE)
        linear[inside] *= shade[inside][:, None]
    # One block of texels that no surface uses takes the bristle colour. Every hair maps to it.
    # The block lines up with the 8 pixel grid of the JPEG, so the colour does not bleed.
    used = baked.reshape(size, size)
    free = ~used.reshape(size // 8, 8, size // 8, 8).any(axis=(1, 3))
    free[1:-1, 1:-1] &= free[:-2, 1:-1] & free[2:, 1:-1] & free[1:-1, :-2] & free[1:-1, 2:]     # neighbours are free too
    free[0], free[-1], free[:, 0], free[:, -1] = False, False, False, False
    rows, cols = np.nonzero(free)
    hair_uv = None
    block = linear.reshape(size, size, 3)
    if len(rows):
        row, col = int(rows[0]) * 8, int(cols[0]) * 8
        block[row - 8:row + 16, col - 8:col + 16] = BRISTLE_COLOUR
        hair_uv = ((col + 4) / size, (row + 4) / size)
    srgb = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.clip(linear, 0, None) ** (1 / 2.4) - 0.055)

    relief = None
    if relief_size:
        # Surface relief from the painting: dark creases lie deep and pale ridges stand up. The
        # texture's own fine detail becomes a tangent-space normal map, so light catches it.
        # Broad patches of pigment are not relief, so the height keeps only the fine part.
        step = size // relief_size
        tone = (srgb @ np.array([0.30, 0.59, 0.11])).reshape(size, size)
        known = baked.reshape(size, size)
        tone = tone.reshape(relief_size, step, relief_size, step).mean(axis=(1, 3))
        known = known.reshape(relief_size, step, relief_size, step).all(axis=(1, 3))
        broad = tone.copy()
        for _ in range(3):
            for axis in (0, 1):
                broad = (np.roll(broad, 2, axis) + np.roll(broad, 1, axis) + broad + np.roll(broad, -1, axis) + np.roll(broad, -2, axis)) / 5.0
        height = tone - broad
        du = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
        dv = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
        inside = known & np.roll(known, 1, 0) & np.roll(known, -1, 0) & np.roll(known, 1, 1) & np.roll(known, -1, 1)
        normals = np.stack([-du * RELIEF_STRENGTH * inside, -dv * RELIEF_STRENGTH * inside, np.ones_like(du)], axis=2)
        normals /= np.linalg.norm(normals, axis=2, keepdims=True)
        relief = bpy.data.images.new("Brundlefly-relief", relief_size, relief_size, alpha=False, is_data=True)
        relief.pixels.foreach_set(np.concatenate([normals * 0.5 + 0.5, np.ones((relief_size, relief_size, 1))], axis=2).astype(np.float32).ravel())
        relief.pack()

    surface_map = None
    fold, broad = fold_shadow(field_path, field, normal, baked, size, relief_size) if relief is not None and field_path else (None, None)
    if relief is not None and fold is not None:
        step = size // relief_size
        small = linear.reshape(relief_size, step, relief_size, step, 3).mean(axis=(1, 3))
        red, green, blue = small[..., 0], small[..., 1], small[..., 2]
        light = small @ np.array([0.30, 0.59, 0.11])
        # Roughness by material, read from the colour: chitin and claws are dark and not red, and
        # they shine. Wings are pale and green-grey, and they are dull. Skin is damp, and wetter in its creases.
        chitin = smooth_step((0.075 - light) / 0.05)
        wing = smooth_step((green - red * 0.85) / 0.10) * smooth_step((light - 0.12) / 0.08)
        skin = np.clip(0.52 - (1.0 - fold) * 0.16, 0.34, 0.6)    # damp skin, wetter where it folds
        rough = skin * (1 - chitin) * (1 - wing) + 0.26 * chitin + 0.62 * wing * (1 - chitin)
        for axis in (0, 1):                                     # material edges are soft
            rough = (np.roll(rough, 1, axis) + rough * 2.0 + np.roll(rough, -1, axis)) / 4.0
        # A wing is a thin sheet: it has no folds to shade. The broad shadow of the body still falls on it.
        shade = (1.0 - (1.0 - fold) * (1.0 - wing)) * broad
        surface_map = bpy.data.images.new("Brundlefly-surface", relief_size, relief_size, alpha=False, is_data=True)
        surface_map.pixels.foreach_set(np.stack([shade, rough, np.zeros_like(shade), np.ones_like(shade)], axis=2).astype(np.float32).ravel())
        surface_map.pack()
        # A share of the fold shadow also goes into the base colour, so it shows under any light.
        deep = np.repeat(np.repeat(shade, step, axis=0), step, axis=1).reshape(-1)
        srgb = srgb * (1.0 - FOLD_SHADOW_IN_COLOUR * (1.0 - deep))[:, None]

    albedo = bpy.data.images.new("Brundlefly-albedo", size, size, alpha=False)
    albedo.pixels.foreach_set(np.concatenate([srgb, np.ones((size * size, 1))], axis=1).astype(np.float32).ravel())
    albedo.pack()
    target.image = albedo
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    for link in list(bsdf.inputs["Base Color"].links):
        material.node_tree.links.remove(link)
    material.node_tree.links.new(target.outputs["Color"], bsdf.inputs["Base Color"])
    if relief is not None:
        bump_image = nodes.new("ShaderNodeTexImage")
        bump_image.image = relief
        bump_image.image.colorspace_settings.name = "Non-Color"
        bump = nodes.new("ShaderNodeNormalMap")
        material.node_tree.links.new(bump_image.outputs["Color"], bump.inputs["Color"])
        material.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if surface_map is not None:
        # glTF packs occlusion in red, roughness in green, and metal in blue, in one image.
        packed = nodes.new("ShaderNodeTexImage")
        packed.image = surface_map
        packed.image.colorspace_settings.name = "Non-Color"
        split = nodes.new("ShaderNodeSeparateColor")
        material.node_tree.links.new(packed.outputs["Color"], split.inputs["Color"])
        material.node_tree.links.new(split.outputs["Green"], bsdf.inputs["Roughness"])
        material.node_tree.links.new(split.outputs["Blue"], bsdf.inputs["Metallic"])
        group = bpy.data.node_groups.get("glTF Material Output") or bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        if "Occlusion" not in [item.name for item in group.interface.items_tree]:
            group.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        output = nodes.new("ShaderNodeGroup")
        output.node_tree = group
        material.node_tree.links.new(split.outputs["Red"], output.inputs["Occlusion"])
    for attribute in list(body.data.color_attributes):
        body.data.color_attributes.remove(attribute)
    return int(baked.sum()), hair_uv, views


def add_bristle_hairs(body, bristles, uv):
    """Put a thin hair where each bristle spike stood. Returns the number of hairs.

    Each hair is a three-sided spike. It takes the skin weights of the nearest body vertex,
    so it moves with the skin under it, and it maps to the bristle texel block.
    """
    mesh = bmesh.new()
    mesh.from_mesh(body.data)
    mesh.verts.ensure_lookup_table()
    deform = mesh.verts.layers.deform.verify()
    uv_layer = mesh.loops.layers.uv.verify()
    tree = KDTree(len(mesh.verts))
    for vertex in mesh.verts:
        tree.insert(vertex.co, vertex.index)
    tree.balance()
    skin = [dict(vertex[deform]) for vertex in mesh.verts]
    count = 0
    for bristle in bristles:
        root, tip = Vector(bristle["root_mm"]), Vector(bristle["tip_mm"])
        length = min((tip - root).length, BRISTLE_MAX_MM)
        if length < 0.3:
            continue
        along = (tip - root).normalized()
        side = along.orthogonal().normalized()
        other = along.cross(side)
        base = root - along * 0.3                    # the base sits inside the skin
        weights = skin[tree.find(root)[1]]
        ring = []
        for k in range(3):
            angle = k * 2.0 * math.pi / 3.0
            ring.append(mesh.verts.new(base + (side * math.cos(angle) + other * math.sin(angle)) * BRISTLE_RADIUS_MM))
        apex = mesh.verts.new(base + along * (length + 0.3))
        for vertex in ring + [apex]:
            for group, weight in weights.items():
                vertex[deform][group] = weight
        for k in range(3):
            face = mesh.faces.new((ring[k], ring[(k + 1) % 3], apex))
            face.normal_update()
            if face.normal.dot(face.calc_center_median() - (base + along * (length / 2))) < 0:
                face.normal_flip()
            for loop in face.loops:
                loop[uv_layer].uv = uv
        count += 1
    mesh.to_mesh(body.data)
    mesh.free()
    return count


def pose_skeleton(arm, stance):
    """Turn the joints of the skeleton into a stance. Returns the rotation mode that each turned joint had.

    The print build poses its solid with this function too, so the two models take one stance.
    """
    modes = {}
    for name, (x, y, z, w) in stance["rotations"].items():
        bone = arm.pose.bones[name]
        modes[name] = bone.rotation_mode
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Quaternion((w, x, y, z))       # bone axes are the site's axes: X right, Y up, Z to the viewer
    arm.pose.bones["pelvis"].location = Vector(stance["pelvis_offset_mm"])
    bpy.context.view_layer.update()
    return modes


def bake_stance(body, arm, stance, followers):
    """Make the stance the rest shape of the website model. Returns the height of the figure.

    The skeleton is posed into the stance. The posed skin becomes the mesh, and the posed
    joints become the rest pose. Every bone then points straight up again, so every joint
    keeps an identity rest rotation and the site's pose code works as on its own rig.
    followers are the objects that ride on a bone: they keep their place on the posed figure.
    """
    scene = bpy.context.scene
    action = arm.animation_data.action if arm.animation_data else None
    if action:
        arm.animation_data.action = None
    modes = pose_skeleton(arm, stance)
    # A finger's hinge turns with its hand. The site reads it in the joint's own axes: X right, Y up, Z forward.
    for bone in arm.pose.bones:
        if "hinge_model" in bone.bone:
            turned = (bone.matrix @ bone.bone.matrix_local.inverted()).to_3x3() @ Vector(bone.bone["hinge_model"])
            bone.bone["hinge"] = [round(turned.x, 4), round(turned.z, 4), round(-turned.y, 4)]
    placed = {o: o.matrix_world.copy() for o in followers}

    for o in scene.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    for modifier in [m for m in body.modifiers if m.type == "ARMATURE"]:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    body.select_set(False)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in arm.data.edit_bones:
        bone.use_connect = False
    for bone in arm.data.edit_bones:
        bone.tail = bone.head + Vector((0.0, 0.0, 4.0))
        bone.roll = 0.0
    bpy.ops.object.mode_set(mode="OBJECT")
    for name, mode in modes.items():
        bone = arm.pose.bones[name]
        bone.rotation_mode = mode
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.rotation_quaternion = Quaternion()
        bone.location = (0.0, 0.0, 0.0)
    body.modifiers.new("Armature", "ARMATURE").object = arm
    bpy.context.view_layer.update()
    for o, world in placed.items():
        o.matrix_world = world
    if action:
        arm.animation_data.action = action
    bpy.context.view_layer.update()
    heights = [(body.matrix_world @ v.co).z for v in body.data.vertices]
    floor = min(heights)
    if abs(floor) > 0.05:
        raise SystemExit(f"The stance lifts or sinks the soles by {floor:.2f} mm. Both soles must stay on the floor.")
    return max(heights) - floor


def lid_skin_image(view, to_image, eye, mesh_scale, field_zmin, size=256):
    """A square patch of the head skin for the eyelids that the site builds. Returns a packed image.

    The site's lids show the middle 44 percent of the patch. So the patch is as wide as a lid
    divided by 0.44, and its middle lies on real skin: the brow just above the eye socket in
    the front view that colours the texture.
    """
    across, depth, height = (r / mesh_scale for r in eye["radii_mm"])
    centre = np.array(eye["centre_mm"]) / mesh_scale + np.array([0.0, 0.0, field_zmin])
    side_mm = 2.0 * across * 1.055 / 0.44
    brow = centre[2] + height * 1.25 + 0.22 * side_mm           # the middle of the patch, above the socket
    grid = (np.arange(size) + 0.5) / size - 0.5
    x, z = np.meshgrid(centre[0] + grid * side_mm, brow + grid * side_mm)
    col, row = to_image(x.ravel(), z.ravel())
    # Outside the figure the patch takes the nearest drawn colour. The patch is larger than the
    # part of the view it shows, so it blends between pixels: nearest pixels showed as blocks on a lid.
    source = np.where(view["figure"][..., None], view["linear"], view["spread"])
    col = np.clip(col, 0.0, source.shape[1] - 1.001)
    row = np.clip(row, 0.0, source.shape[0] - 1.001)
    c0, r0 = np.floor(col).astype(int), np.floor(row).astype(int)
    fc, fr = (col - c0)[:, None], (row - r0)[:, None]
    linear = ((source[r0, c0] * (1 - fc) + source[r0, c0 + 1] * fc) * (1 - fr) + (source[r0 + 1, c0] * (1 - fc) + source[r0 + 1, c0 + 1] * fc) * fr).reshape(size, size, 3)
    srgb = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.clip(linear, 0, None) ** (1 / 2.4) - 0.055)
    image = bpy.data.images.new("Brundlefly-lid-skin", size, size, alpha=False)
    image.pixels.foreach_set(np.concatenate([srgb, np.ones((size, size, 1))], axis=2).astype(np.float32).ravel())
    image.pack()
    return image


def split_wing_material(body):
    """Give the wing membranes their own material, so the site can light them apart from the skin. Returns the face count.

    A face is wing when every one of its vertices follows a wing joint more than any other joint.
    The material is a copy of the skin material, so it uses the same textures. It has no
    transmission: a viewer draws the whole scene a second time for a transmissive material.
    """
    wing_groups = {g.index for g in body.vertex_groups if "wing" in g.name}
    on_wing = [bool(v.groups) and max(v.groups, key=lambda g: g.weight).group in wing_groups for v in body.data.vertices]
    wing = body.data.materials[0].copy()
    wing.name = "Brundlefly-wing"
    body.data.materials.append(wing)
    slot = len(body.data.materials) - 1
    count = 0
    for polygon in body.data.polygons:
        if all(on_wing[i] for i in polygon.vertices):
            polygon.material_index = slot
            count += 1
    return count


def export_web(src, args):
    """The website model. One root node, Y up after export, face toward +Z, soles at height zero.

    Children: the body, two eyeball nodes, and three anchor nodes. The contract is in PRINTING.md.
    """
    with open(os.path.join(os.path.dirname(args.blend), "build-stats.json")) as fh:
        stats = json.load(fh)
    site = stats["site"]
    px, py = site["pelvis_xy_mm"]
    scene = bpy.context.scene

    src.name = "Brundlefly-source"                   # frees the root node name
    src.data.name = "Brundlefly-source"
    surface = np.empty(len(src.data.vertices) * 3)
    src.data.vertices.foreach_get("co", surface)
    surface = surface.reshape(-1, 3)
    body = clean_decimated(src, args.glb_tris, "Brundlefly-body", close_shot_focus(surface))
    body.data.name = "Brundlefly-body"
    skin = body.data.materials[0]
    skin.name = "Brundlefly-skin"
    skin.use_backface_culling = True                 # exports as doubleSided false

    joints_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source", "rig-joints.json")
    rig_joints = None
    if os.path.exists(joints_path):
        with open(joints_path) as fh:
            rig_joints = json.load(fh)["joints_mm"]
    textured = "sheet_projection" in stats and not args.no_texture
    if textured:
        texels, hair_uv, colour_views = bake_sheet_texture(body, stats["sheet_projection"], os.path.join(os.path.dirname(os.path.abspath(__file__)), "source", "views"), args.texture_size, site["eyes"], rig_joints, surface, args.relief_size, os.path.join(os.path.dirname(args.blend), "field.npz"))
        print(f"TEXTURE {args.texture_size} px, {texels} texels on the surface")

    root = bpy.data.objects.new("Brundlefly", None)
    scene.collection.objects.link(root)
    body.location = (-px, -py, 0.0)
    body.parent = root
    parts = [root, body]

    # The eye markers carry the skin for the lids that the site builds on them. The site hides the markers.
    eye_mat = bpy.data.materials.new("Brundlefly-lid")
    eye_mat.use_nodes = True
    eye_mat.use_backface_culling = True
    bsdf = next(n for n in eye_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.42
    if textured and site["eyes"]:
        skin_patch = eye_mat.node_tree.nodes.new("ShaderNodeTexImage")
        front_view, front_to_image = colour_views["front"]
        if "detail" in front_view:                    # the close painting of the head is sharper
            front_view, front_to_image = front_view["detail"][:2]
        skin_patch.image = lid_skin_image(front_view, front_to_image, site["eyes"][0], stats["sheet_projection"]["mesh_scale"], stats["sheet_projection"]["field_zmin"])
        eye_mat.node_tree.links.new(skin_patch.outputs["Color"], bsdf.inputs["Base Color"])
    for index, eye in enumerate(site["eyes"]):        # 0 is screen left and larger
        mesh = bpy.data.meshes.new(f"Brundlefly-eye-{index}")
        bm = bmesh.new()
        # The lid material is textured, so glTF requires UVs even on hidden markers.
        bm.loops.layers.uv.verify()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0, calc_uvs=True)
        # The sphere's poles turn to the front and the back, so the rings of vertices run around the
        # line of sight and the pupil and the iris come out round.
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0.0, 0.0, 0.0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))
        for face in bm.faces:
            face.smooth = True
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(eye_mat)
        ob = bpy.data.objects.new(f"Brundlefly-eye-{index}", mesh)
        scene.collection.objects.link(ob)
        cx, cy, cz = eye["centre_mm"]
        ob.location = (cx - px, cy - py, cz)
        ob.scale = list(eye["radii_mm"])
        ob.parent = root
        parts.append(ob)
    for name, (ax, ay, az) in site["anchors"].items():
        anchor = bpy.data.objects.new(name, None)
        scene.collection.objects.link(anchor)
        anchor.location = (ax - px, ay - py, az)
        anchor.parent = root
        parts.append(anchor)

    joints_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source", "rig-joints.json")
    rigged = os.path.exists(joints_path) and not args.no_rig
    if rigged:
        with open(joints_path) as fh:
            arm = add_skeleton(body, json.load(fh)["joints_mm"], (px, py), site["eyes"])
        arm.parent = root
        parts.append(arm)
        # The eyeballs and the face anchor ride on the head bone, so they follow a head turn.
        bpy.context.view_layer.update()
        for o in parts:
            if o.name.startswith("Brundlefly-eye") or o.name == "anchor-face":
                world = o.matrix_world.copy()
                o.parent, o.parent_type, o.parent_bone = arm, "BONE", "head"
                bpy.context.view_layer.update()
                o.matrix_world = world

    if textured and hair_uv is not None and site.get("bristles"):
        print(f"BRISTLES {add_bristle_hairs(body, site['bristles'], hair_uv)} hairs")
    if rigged and textured:
        print(f"WINGS {split_wing_material(body)} faces take the wing material")
    stance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source", "stance.json")
    if rigged and os.path.exists(stance_path) and not args.no_stance:
        with open(stance_path) as fh:
            stance = json.load(fh)
        height = bake_stance(body, arm, stance, [o for o in parts if o.parent_type == "BONE"])
        root.rotation_euler = (0.0, 0.0, stance.get("root_yaw_radians", 0.0))   # the body's turn, for the site to change
        print(f"STANCE baked, figure height {height:.2f} mm, root yaw {stance.get('root_yaw_radians', 0.0)} rad")

    root.scale = (0.001, 0.001, 0.001)               # millimetres to glTF metres
    for o in scene.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(args.out, "brundlefly-web.glb")
    # The exporter gives joints no extras, so the finger hinges go on the root node, by joint name.
    hinges = {}
    for bone in (arm.data.bones if rigged else ()):
        if "hinge_model" in bone:
            if "hinge" not in bone:                       # no stance: the hinge is as measured
                x, y, z = bone["hinge_model"]
                bone["hinge"] = [round(x, 4), round(z, 4), round(-y, 4)]
            hinges[bone.name] = [float(c) for c in bone["hinge"]]
    if hinges:
        root["finger_hinges"] = hinges
    kwargs = dict(filepath=path, export_extras=True, export_format="GLB", use_selection=True, export_apply=not rigged, export_cameras=False, export_lights=False,
                  export_animations=rigged, export_skins=rigged)
    if textured:
        kwargs.update(export_image_format="JPEG", export_image_quality=args.image_quality)
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", **kwargs)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    return {"path": path, "bytes": os.path.getsize(path), "triangles": len(body.data.polygons)}


def only(ob):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def main():
    args = parse()
    bpy.ops.wm.open_mainfile(filepath=args.blend)
    os.makedirs(args.out, exist_ok=True)
    src = bpy.data.objects[args.object]

    out = {}
    if args.web:
        out["web"] = export_web(src, args)
        print("EXPORT " + json.dumps(out))
        return
    stl_ob = clean_decimated(src, args.tris, "Brundlefly-print")
    only(stl_ob)
    for label, scale in (("80mm", 1.0), ("100mm", 1.25)):
        path = os.path.join(args.out, f"brundlefly-{label}.stl")
        bpy.ops.wm.stl_export(filepath=path, export_selected_objects=True, global_scale=scale)
        out[label] = {"path": path, "bytes": os.path.getsize(path), "triangles": len(stl_ob.data.polygons)}

    glb_ob = decimated(src, args.glb_tris, "Brundlefly-preview")
    glb_ob.scale = (0.001, 0.001, 0.001)          # glTF uses metres
    only(glb_ob)
    glb = os.path.join(args.out, "brundlefly-preview.glb")
    kwargs = dict(filepath=glb, export_format="GLB", use_selection=True, export_apply=True)
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", **kwargs)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    out["glb"] = {"path": glb, "bytes": os.path.getsize(glb), "triangles": len(glb_ob.data.polygons)}
    bpy.data.objects.remove(glb_ob)

    # Master file: the print mesh only. The full-resolution field mesh is rebuilt by build_model.py.
    bpy.data.objects.remove(src)
    stl_ob.name = "Brundlefly"
    bpy.context.scene.render.filepath = "//"        # keep machine paths out of the master file
    for block in (bpy.data.meshes, bpy.data.cameras, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    master = os.path.join(args.out, "brundlefly.blend")
    bpy.ops.wm.save_as_mainfile(filepath=master, compress=True)
    out["blend"] = {"path": master, "bytes": os.path.getsize(master)}
    print("EXPORT " + json.dumps(out))


if __name__ == "__main__":
    main()
