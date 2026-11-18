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

import bmesh
import bpy
from mathutils.bvhtree import BVHTree


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--object", default="Brundlefly")
    ap.add_argument("--tris", type=int, default=390000, help="triangle budget for each STL")
    ap.add_argument("--glb-tris", type=int, default=160000)
    ap.add_argument("--web", action="store_true", help="write brundlefly-web.glb only, from a web-variant build")
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
        web = decimated(src, args.glb_tris, "Brundlefly")
        web.scale = (0.001, 0.001, 0.001)          # glTF uses metres
        only(web)
        path = os.path.join(args.out, "brundlefly-web.glb")
        try:
            bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_vertex_color="MATERIAL")
        except TypeError:
            bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True)
        out["web"] = {"path": path, "bytes": os.path.getsize(path), "triangles": len(web.data.polygons)}
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
