"""Render preview views of the Brundlefly model with the Workbench engine.

Run after build_model.py in the same Blender process, or pass --blend:
  flatpak run org.blender.Blender -b --factory-startup \
    --python /abs/render_previews.py -- --out /abs/dir --blend /abs/brundlefly.blend

Writes one PNG per view and one contact sheet per shading mode.
"""
import argparse
import json
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

VIEWS = {
    "front": (0.0, -1.0, 0.08),
    "three-quarter": (-0.62, -0.75, 0.22),
    "side": (-1.0, 0.0, 0.05),
    "back": (0.0, 1.0, 0.08),
    "top": (0.0, -0.12, 1.0),
    "three-quarter-left": (0.62, -0.75, 0.22),
    "front-low": (0.0, -1.0, -0.5),
    "back-low": (0.0, 1.0, -0.5),
    "side-low": (-1.0, 0.0, -0.5),
    "left-low": (1.0, -0.3, -0.5),
}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--blend")
    ap.add_argument("--object", default="Brundlefly")
    ap.add_argument("--res", type=int, default=640)
    ap.add_argument("--modes", default="clay,colour")
    ap.add_argument("--views", default="front,three-quarter,side,back")
    ap.add_argument("--prefix", default="")
    ap.add_argument("--bristles", help="bristle-map.json: adds a red marker at each dimple for the mode 'bristles'")
    args, _ = ap.parse_known_args(argv)
    return args


def sheet(paths, out_path, cols=2):
    tiles = []
    for p in paths:
        img = bpy.data.images.load(p)
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        tiles.append(px.reshape(h, w, 4))
        bpy.data.images.remove(img)
    h, w = tiles[0].shape[:2]
    rows = (len(tiles) + cols - 1) // cols
    canvas = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    canvas[..., 3] = 1.0
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * h          # image rows run bottom to top
        canvas[y0:y0 + h, c * w:(c + 1) * w] = t
    out = bpy.data.images.new("sheet", cols * w, rows * h, alpha=False)
    out.pixels.foreach_set(canvas.ravel())
    out.filepath_raw = out_path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)


def main():
    args = parse()
    if args.blend:
        bpy.ops.wm.open_mainfile(filepath=args.blend)
    ob = bpy.data.objects[args.object]
    sc = bpy.context.scene
    os.makedirs(args.out, exist_ok=True)

    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x = args.res
    sc.render.resolution_y = args.res
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sh.cavity_ridge_factor = 1.0
    sh.cavity_valley_factor = 1.5
    sh.curvature_ridge_factor = 1.0
    sh.curvature_valley_factor = 1.5
    sh.show_shadows = False
    sh.show_object_outline = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new("PreviewWorld")
    sc.world.color = (0.012, 0.016, 0.012)

    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = (lo + hi) / 2
    size = max(hi - lo)

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size * 1.08
    cam_data.clip_start = 1.0
    cam_data.clip_end = size * 20
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam

    names = [v.strip() for v in args.views.split(",") if v.strip()]
    for mode in [m.strip() for m in args.modes.split(",") if m.strip()]:
        markers = []
        if mode == "clay":
            sh.color_type = "SINGLE"
            sh.single_color = (0.80, 0.77, 0.72)
        elif mode == "bristles":
            sh.color_type = "OBJECT"
            ob.color = (0.78, 0.76, 0.72, 1.0)
            with open(args.bristles) as fh:
                dimples = json.load(fh)["dimples"]
            ball = bpy.data.meshes.new("BristleMarker")
            import bmesh
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.1)
            bm.to_mesh(ball)
            bm.free()
            for d in dimples:
                marker = bpy.data.objects.new("BristleMarker", ball)
                marker.location = Vector(d["position_mm"]) + Vector(d["direction"]) * 0.9
                marker.color = (0.9, 0.05, 0.05, 1.0)
                sc.collection.objects.link(marker)
                markers.append(marker)
        elif mode == "texture":
            sh.color_type = "TEXTURE"
        else:
            sh.color_type = "VERTEX"
        paths = []
        for name in names:
            direction = Vector(VIEWS[name]).normalized()
            cam.location = centre + direction * size * 5
            cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
            path = os.path.join(args.out, f"{args.prefix}{name}-{mode}.png")
            sc.render.filepath = path
            bpy.ops.render.render(write_still=True)
            paths.append(path)
        sheet(paths, os.path.join(args.out, f"{args.prefix}sheet-{mode}.png"))
        for marker in markers:
            bpy.data.objects.remove(marker)
        print("RENDERED", mode, names)

    bpy.data.objects.remove(cam)
    bpy.data.cameras.remove(cam_data)


if __name__ == "__main__":
    main()
