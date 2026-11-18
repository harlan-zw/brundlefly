"""Check a delivered STL in Blender. The file is imported again, so the checks see what a printer sees.

Run headless, with absolute paths:
  flatpak run org.blender.Blender -b --python /abs/validate_mesh.py -- --stl /abs/brundlefly-80mm.stl --out /abs/report.json

The script enables the 3D Print Toolbox extension if it is installed.
"""
import argparse
import json
import sys

import bmesh
import bpy
from mathutils.bvhtree import BVHTree


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--stl", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--expect-height", type=float, default=80.0)
    ap.add_argument("--min-wall", type=float, default=1.2)
    args, _ = ap.parse_known_args(argv)
    return args


def shells(bm):
    seen, count = set(), 0
    for vert in bm.verts:
        if vert.index in seen:
            continue
        count += 1
        stack = [vert]
        while stack:
            cur = stack.pop()
            if cur.index in seen:
                continue
            seen.add(cur.index)
            stack.extend(e.other_vert(cur) for e in cur.link_edges)
    return count


def self_intersections(bm):
    tree = BVHTree.FromBMesh(bm, epsilon=0.0)
    faces = bm.faces
    faces.ensure_lookup_table()
    count = 0
    for a, b in tree.overlap(tree):
        if a >= b:
            continue
        va = {v.index for v in faces[a].verts}
        if va & {v.index for v in faces[b].verts}:
            continue                      # neighbours share a vertex and always touch
        count += 1
    return count


def islands(bm, cluster_mm=2.5):
    """Places where a print starts in mid-air: local minima in Z whose surface faces down."""
    found = []
    for v in bm.verts:
        if v.co.z < 0.6 or v.normal.z > -0.5:
            continue
        if all(e.other_vert(v).co.z > v.co.z for e in v.link_edges):
            found.append(v.co.copy())
    clusters = []
    for p in sorted(found, key=lambda c: c.z):
        for c in clusters:
            if (c - p).length < cluster_mm:
                break
        else:
            clusters.append(p)
    return [[round(c.x, 1), round(c.y, 1), round(c.z, 1)] for c in clusters]


def toolbox_report(ob, min_wall):
    """Run the 3D Print Toolbox, if it is installed. Returns its text lines, or None."""
    if "print3d_check_all" not in dir(bpy.ops.mesh):
        try:
            bpy.ops.preferences.addon_enable(module="bl_ext.blender_org.print3d_toolbox")
        except Exception:
            return None
    if "print3d_check_all" not in dir(bpy.ops.mesh):
        return None
    sc = bpy.context.scene
    sc.print3d_toolbox.thickness_min = min_wall
    sc.print3d_toolbox.angle_overhang = 0.7854      # 45 degrees
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.mesh.print3d_check_all()
    from bl_ext.blender_org.print3d_toolbox import report
    return {item[0]: item[1] for item in report.get()}


def main():
    args = parse()
    bpy.ops.wm.read_homefile(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 0.001
    bpy.ops.wm.stl_import(filepath=args.stl)
    ob = bpy.context.selected_objects[0]

    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    d = ob.dimensions
    result = {
        "file": args.stl,
        "dimensions_mm": [round(d.x, 2), round(d.y, 2), round(d.z, 2)],
        "min_z_mm": round(min(v.co.z for v in bm.verts), 3),
        "triangles": len(bm.faces),
        "volume_cm3": round(bm.calc_volume(signed=True) / 1000.0, 2),
        "non_manifold_edges": sum(1 for e in bm.edges if not e.is_manifold),
        "boundary_edges": sum(1 for e in bm.edges if e.is_boundary),
        "degenerate_faces": sum(1 for f in bm.faces if f.calc_area() < 1e-8),
        "loose_vertices": sum(1 for v in bm.verts if not v.link_edges),
        "shells": shells(bm),
        "self_intersecting_face_pairs": self_intersections(bm),
        "mid_air_islands_mm": islands(bm),
    }
    bm.free()
    result["height_ok"] = abs(result["dimensions_mm"][2] - args.expect_height) < 0.05
    result["print3d_toolbox"] = toolbox_report(ob, args.min_wall)
    result["passes_mesh_checks"] = bool(
        result["non_manifold_edges"] == 0 and result["boundary_edges"] == 0 and result["degenerate_faces"] == 0
        and result["loose_vertices"] == 0 and result["shells"] == 1 and result["volume_cm3"] > 0
        and result["self_intersecting_face_pairs"] == 0 and result["height_ok"]
    )
    with open(args.out, "w") as fh:
        json.dump(result, fh, indent=1)
    print("VALIDATE " + json.dumps(result))


if __name__ == "__main__":
    main()
