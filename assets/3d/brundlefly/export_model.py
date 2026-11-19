"""Export the print files and the preview from the working Blender file.

Run headless, with absolute paths:
  flatpak run org.blender.Blender -b --factory-startup \
    --python /abs/export_model.py -- --blend /abs/brundlefly-work.blend --out /abs/dir

Writes brundlefly.blend, brundlefly-80mm.stl, brundlefly-100mm.stl, and brundlefly-preview.glb.
"""
import argparse
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

# The texture is dark inside each eye socket: out to this many eyeball radii from the eyeball centre.
# The socket is 1.16 to 1.24 eyeball radii, so this covers its wall and its rim.
EYE_DARK_SCALE = 1.3
# Linear colours of an eyeball node. The eye is a dark, wet globe, as on the site's relief rig: the
# iris is a dark teal that grows lighter toward its edge, and the highlight does most of the work.
# A pale iris hides the highlight and reads as a doll's eye.
EYE_RIM = (0.005, 0.006, 0.008)
EYE_IRIS_INNER = (0.008, 0.022, 0.024)
EYE_IRIS_OUTER = (0.030, 0.078, 0.082)
EYE_PUPIL = (0.002, 0.002, 0.003)
# The pupil and the iris ring on the front of the eyeball: their angles from the front, in radians.
EYE_PUPIL_ANGLE = 0.15
EYE_IRIS_ANGLE = 0.40
# The face patches of the jaw, the cheeks, and the brows reach this far behind the eyeball centres, in millimetres.
FACE_DEPTH_MM = 6.0
# Where the two finger joints lie along a hand, from the wrist (0) to the fingertips (1).
FINGER_JOINTS = (0.40, 0.70)
# The hinge axis of each finger joint, in model axes. add_skeleton fills it for bake_stance.
FINGER_HINGES = {}
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


def clean_decimated(ob, target, name):
    """Decimate, and lower the budget in small steps until no faces intersect."""
    for step in range(8):
        copy = decimated(ob, int(target * (1 - 0.015 * step)), name)
        hits = self_intersections(copy.data)
        if hits == 0:
            return copy
        print(f"DECIMATE {len(copy.data.polygons)} triangles: {hits} intersecting face pairs, retrying")
        mesh = copy.data
        bpy.data.objects.remove(copy)
        bpy.data.meshes.remove(mesh)
    raise SystemExit("Decimation left intersecting faces at every budget.")


def decimated(ob, target, name):
    """A new object with at most target triangles. Vertex colours survive."""
    count = len(ob.data.polygons)
    copy = ob.copy()
    copy.data = ob.data.copy()
    copy.name = name
    bpy.context.scene.collection.objects.link(copy)
    if count > target:
        mod = copy.modifiers.new("Decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = target / count
        deps = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(copy.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
        copy.modifiers.clear()
        old = copy.data
        copy.data = mesh
        bpy.data.meshes.remove(old)
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
    """Give each long hand two joints across its fingers, so the fingers can curl. Returns the joints.

    The generated hands have stiff, spread fingers. One joint lies across the knuckles and one
    across the middle of the fingers, and all fingers of a hand follow them together. The
    stance curls them, so the hands hang as loose claws. Each entry of the result is
    name -> (position, parent, hinge axis). A turn about the hinge axis curls toward the palm.
    """
    co = np.empty(len(body.data.vertices) * 3)
    body.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    out = {}
    for side in ("left", "right"):
        hand = body.vertex_groups[f"{side}-hand"]
        wrist, end = np.array(J[f"{side}-hand"]), np.array(J[f"{side}-hand-end"])
        length = float(np.linalg.norm(end - wrist))
        unit = (end - wrist) / length
        held = np.zeros(len(co))
        for vertex in body.data.vertices:
            for g in vertex.groups:
                if g.group == hand.index:
                    held[vertex.index] = g.weight
        t = (co - wrist) @ unit / length
        fingers = held > 0.3
        # The palm is the flat direction of the hand: the axis of least spread.
        spread = co[fingers & (t > 0.2)] - co[fingers & (t > 0.2)].mean(axis=0)
        palm = np.linalg.eigh(spread.T @ spread)[1][:, 0]
        hinge = np.cross(unit, palm)
        hinge /= np.linalg.norm(hinge)
        # A positive turn about the hinge moves the fingertips along cross(hinge, unit). The claws
        # hook toward the body and toward the back.
        inward = np.array([-np.sign(wrist[0]), 0.6, 0.0])
        if np.cross(hinge, unit) @ inward < 0:
            hinge = -hinge
        tips = smooth_step((t - FINGER_JOINTS[1] + 0.09) / 0.18)
        knuckles = smooth_step((t - FINGER_JOINTS[0] + 0.09) / 0.18) * (1.0 - tips)
        names = (f"{side}-fingers", f"{side}-finger-tips")
        groups = [body.vertex_groups.get(name) or body.vertex_groups.new(name=name) for name in names]
        for index in np.nonzero((held > 0.0) & (knuckles + tips > 0.001))[0]:
            i, weight = int(index), float(held[index])
            hand.add([i], weight * (1.0 - knuckles[index] - tips[index]), "REPLACE")
            for group, share in zip(groups, (knuckles[index], tips[index])):
                if share > 0.001:
                    group.add([i], weight * float(share), "REPLACE")
        out[names[0]] = (Vector(wrist + unit * length * FINGER_JOINTS[0]), f"{side}-hand", Vector(hinge))
        out[names[1]] = (Vector(wrist + unit * length * FINGER_JOINTS[1]), names[0], Vector(hinge))
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
    FINGER_HINGES.clear()
    FINGER_HINGES.update({name: hinge for name, (_, _, hinge) in finger_joints.items()})
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
        low_u, low_v = surface[:, across].min(), surface[:, 2].min()
        su = np.floor((surface[:, across] - low_u) / cell).astype(int)
        sv = np.floor((surface[:, 2] - low_v) / cell).astype(int)
        shape = (int(su.max()) + 1, int(sv.max()) + 1)
        nearest = np.full(shape[0] * shape[1], np.inf)
        np.minimum.at(nearest, su * shape[1] + sv, surface[:, depth_axis] * -toward)
        u = np.clip(np.floor((points[:, across] - low_u) / cell).astype(int), 0, shape[0] - 1)
        v = np.clip(np.floor((points[:, 2] - low_v) / cell).astype(int), 0, shape[1] - 1)
        flat = u * shape[1] + v
        # A neighbour cell can hold the true nearest surface at the edge of a part.
        grid = nearest.reshape(shape)
        spread = grid.copy()
        spread[1:] = np.minimum(spread[1:], grid[:-1]); spread[:-1] = np.minimum(spread[:-1], grid[1:])
        spread[:, 1:] = np.minimum(spread[:, 1:], grid[:, :-1]); spread[:, :-1] = np.minimum(spread[:, :-1], grid[:, 1:])
        behind = depth - spread.reshape(-1)[flat]
        out[name] = np.where(known & np.isfinite(behind), smooth_step((behind - slack) / 0.6), 0.0)
    if joints and "front" in out:
        rods = []
        for i in range(4):
            rods += [(np.array(joints[f"mouthpart-{i}"]), np.array(joints[f"mouthpart-{i}-tip"])), (np.array(joints[f"mouthpart-{i}-tip"]), np.array(joints[f"mouthpart-{i}-tip-end"]))]
        ends = np.array([p for rod in rods for p in rod])
        from_rod = np.full(len(points), np.inf)
        for a, b in rods:
            step = b - a
            t = np.clip((points - a) @ step / (step @ step), 0.0, 1.0)
            from_rod = np.minimum(from_rod, np.linalg.norm(points - (a + t[:, None] * step), axis=1))
        zone = (smooth_step((points[:, 0] - (ends[:, 0].min() - 3.5)) / 1.5) * smooth_step(((ends[:, 0].max() + 3.5) - points[:, 0]) / 1.5)
                * smooth_step((points[:, 2] - (ends[:, 2].min() - 10.0)) / 2.0) * smooth_step(((ends[:, 2].max() - 0.5) - points[:, 2]) / 1.5)
                * (points[:, 1] < ends[:, 1].max() + 14.0))
        own = 1.0 - smooth_step((from_rod - 1.3) / 0.8)           # 1 on a mouthpart, 0 away from it
        out["front"] = np.maximum(out["front"], np.where(known, zone * (1.0 - own), 0.0))
    return out


def bake_sheet_texture(body, projection, views_dir, size, eyes, joints, surface):
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
    views = {name: (bfm.load_view(os.path.join(views_dir, fit["image"])), bfm.blended_fit(fit["body"], fit["head"], z_low, z_high, fit.get("head_u")))
             for name, fit in projection["views"].items()}
    bfm.erase_all_eyes(views)
    colour = bfm.sheet_colour_fn(views)
    field = position / projection["mesh_scale"]              # texel positions, back in the build's coordinates
    field[:, 2] += projection["field_zmin"]
    linear = np.tile(bfm.bm.srgb_to_linear(bfm.bm.PALETTE[bfm.bm.FLESH]), (size * size, 1))
    hidden = hidden_from_views(position, baked, joints, surface)
    linear[baked] = colour(field[baked], normal[baked], {name: value[baked] for name, value in hidden.items()})
    for name, value in hidden.items():
        component, direction = bfm.VIEW_SETUP[name]["facing"]
        facing = baked & (normal[:, component] * direction > 0.7)
        print(f"TEXTURE {name}: {float(value[facing].mean()):.3f} of the surface that faces it is hidden behind another part")
    # Inside each eye socket the texture is dark, so the gap around the eye reads as shadow.
    dark = bfm.bm.srgb_to_linear(bfm.bm.PALETTE[bfm.bm.EYE])
    for eye in eyes:
        linear[baked & (eye_reach(position, eye) < EYE_DARK_SCALE)] = dark
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

    albedo = bpy.data.images.new("Brundlefly-albedo", size, size, alpha=False)
    albedo.pixels.foreach_set(np.concatenate([srgb, np.ones((size * size, 1))], axis=1).astype(np.float32).ravel())
    albedo.pack()
    target.image = albedo
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    for link in list(bsdf.inputs["Base Color"].links):
        material.node_tree.links.remove(link)
    material.node_tree.links.new(target.outputs["Color"], bsdf.inputs["Base Color"])
    for attribute in list(body.data.color_attributes):
        body.data.color_attributes.remove(attribute)
    return int(baked.sum()), hair_uv


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
    modes = {}
    for name, (x, y, z, w) in stance["rotations"].items():
        bone = arm.pose.bones[name]
        modes[name] = bone.rotation_mode
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Quaternion((w, x, y, z))       # bone axes are the site's axes: X right, Y up, Z to the viewer
    arm.pose.bones["pelvis"].location = Vector(stance["pelvis_offset_mm"])
    # The fingers curl about their hinge. A bone points up at rest, so its axes are X = model X, Y = model Z, Z = -model Y.
    for name, hinge in FINGER_HINGES.items():
        angle = stance.get("finger_curl_radians", [0.0, 0.0])[1 if name.endswith("-tips") else 0]
        bone = arm.pose.bones[name]
        modes[name] = bone.rotation_mode
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Quaternion((hinge.x, hinge.z, -hinge.y), angle)
    bpy.context.view_layer.update()
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
    body = clean_decimated(src, args.glb_tris, "Brundlefly-body")
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
        texels, hair_uv = bake_sheet_texture(body, stats["sheet_projection"], os.path.join(os.path.dirname(os.path.abspath(__file__)), "source", "views"), args.texture_size, site["eyes"], rig_joints, surface)
        print(f"TEXTURE {args.texture_size} px, {texels} texels on the surface")

    root = bpy.data.objects.new("Brundlefly", None)
    scene.collection.objects.link(root)
    body.location = (-px, -py, 0.0)
    body.parent = root
    parts = [root, body]

    eye_mat = bpy.data.materials.new("Brundlefly-eye")
    eye_mat.use_nodes = True
    eye_mat.use_backface_culling = True
    bsdf = next(n for n in eye_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.12
    # The colour is in the vertices: a dark globe with a teal iris ring and a dark pupil.
    iris = eye_mat.node_tree.nodes.new("ShaderNodeVertexColor")
    iris.layer_name = "Col"
    eye_mat.node_tree.links.new(iris.outputs["Color"], bsdf.inputs["Base Color"])
    for index, eye in enumerate(site["eyes"]):        # 0 is screen left and larger
        mesh = bpy.data.meshes.new(f"Brundlefly-eye-{index}")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1.0)
        # The sphere's poles turn to the front and the back, so the rings of vertices run around the
        # line of sight and the pupil and the iris come out round.
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0.0, 0.0, 0.0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))
        for face in bm.faces:
            face.smooth = True
        bm.to_mesh(mesh)
        bm.free()
        layer = mesh.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        # The node looks along -Y here, which is +Z in the exported file: the way the head faces.
        # A dark globe, a teal iris ring, and a dark pupil. The site can turn the node to aim the eye.
        front = Vector((0.0, -1.0, 0.0))

        def band(value, edge, width=0.05):
            t = min(max((edge + width - value) / (2 * width), 0.0), 1.0)
            return t * t * (3.0 - 2.0 * t)

        for vertex in mesh.vertices:
            angle = vertex.co.normalized().angle(front)
            iris, pupil = band(angle, EYE_IRIS_ANGLE), band(angle, EYE_PUPIL_ANGLE)
            across = min(max((angle - EYE_PUPIL_ANGLE) / (EYE_IRIS_ANGLE - EYE_PUPIL_ANGLE), 0.0), 1.0)
            ring = [a + (b - a) * across ** 1.5 for a, b in zip(EYE_IRIS_INNER, EYE_IRIS_OUTER)]
            colour = [rim + (c - rim) * iris for rim, c in zip(EYE_RIM, ring)]
            layer.data[vertex.index].color = tuple(c + (dot - c) * pupil for c, dot in zip(colour, EYE_PUPIL)) + (1.0,)
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
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=not rigged, export_cameras=False, export_lights=False,
                  export_animations=rigged, export_skins=rigged)
    if textured:
        kwargs.update(export_image_format="JPEG", export_image_quality=88)
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
