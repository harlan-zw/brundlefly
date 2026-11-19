"""Build the print model and the website model from a generated base mesh.

The base mesh comes from an image-to-3D model that read the front and back views of
the character sheet. This script turns it into a printable figure with a light touch:
it removes the bristle spikes but keeps the thin wings, grows only parts that are under
the print minimum, adds the base, and meshes the result.

Run headless, with absolute paths:
  flatpak run org.blender.Blender -b --factory-startup \
    --python /abs/build_from_mesh.py -- --source /abs/source/hunyuan3d-multiview-shape.glb --out /abs/dir

Units are millimetres. Z is up. The figure faces -Y.
"""
import argparse
import json
import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
import openvdb as vdb

sys.dont_write_bytecode = True   # keep __pycache__ out of the asset folder
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_model as bm  # noqa: E402  (the field library and the mesher)

bm.SCALE_GUESS = 1.0          # this pipeline works in millimetres directly
FIGURE_MM = 77.6              # print figure height above its lowest sole
BASE_TOP = 3.0                # nominal top of the base
SINK = 0.6                    # the soles sink this far into the base
BAND = 10                     # level set half width, in voxels
WING_VOLUME_MM3 = 60.0        # a joined thin part of this volume is a wing membrane, at the default --keep-volume
BRISTLE_MIN_MM = 0.8          # a removed spike shorter than this is not a bristle
BRISTLE_BODY_MM = 1.3         # a bristle stands on a part of the body that is at least this deep
LO = np.array([-48.0, -40.0, -1.6])
HI = np.array([48.0, 40.0, 84.0])


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voxel", type=float, default=0.2)
    ap.add_argument("--variant", choices=("print", "web"), default="print", help="web: keeps bristles and thin parts, no base")
    ap.add_argument("--open-radius", type=float, default=0.45, help="spikes thinner than twice this are removed")
    ap.add_argument("--keep-volume", type=float, default=6.0, help="a thin part larger than this many cubic millimetres is kept (wings, mouthparts)")
    ap.add_argument("--min-radius", type=float, default=0.8, help="thin parts grow to this radius")
    ap.add_argument("--max-growth", type=float, default=0.5, help="the most a thin part may grow on each side")
    ap.add_argument("--front-image", help="front view image, projected onto the vertex colours")
    ap.add_argument("--back-image", help="back view image, projected onto the vertex colours")
    ap.add_argument("--right-image", help="optional view of the figure's right side")
    ap.add_argument("--left-image", help="optional view of the figure's left side")
    ap.add_argument("--rebuild-back", action="store_true", help="replace the back with plates drawn from the character sheet")
    ap.add_argument("--dimples", action="store_true", help="add pilot dimples for hand-implanted bristles")
    ap.add_argument("--dump-field", action="store_true", help="also write field.npz, for measuring joints")
    args, _ = ap.parse_known_args(argv)
    return args


def islands(mesh):
    seen, out = set(), []
    for v in mesh.verts:
        if v.index in seen:
            continue
        stack, comp = [v], []
        while stack:
            cur = stack.pop()
            if cur.index in seen:
                continue
            seen.add(cur.index)
            comp.append(cur)
            stack.extend(e.other_vert(cur) for e in cur.link_edges)
        out.append(comp)
    return out


def load_largest_shell(path):
    """Vertices and triangles of the largest connected shell, in Blender Z-up coordinates."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in bpy.data.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh = bmesh.new()
    mesh.from_mesh(ob.data)
    bmesh.ops.triangulate(mesh, faces=mesh.faces)
    shells = sorted(islands(mesh), key=len, reverse=True)
    for comp in shells[1:]:
        bmesh.ops.delete(mesh, geom=comp, context="VERTS")
    mesh.verts.ensure_lookup_table()
    mesh.verts.index_update()
    verts = np.array([v.co[:] for v in mesh.verts], dtype=np.float64)
    tris = np.array([[v.index for v in f.verts] for f in mesh.faces], dtype=np.uint32)
    mesh.free()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return verts, tris, len(shells) - 1


def level_set(points, tris=None, quads=None, band=BAND):
    kwargs = {}
    if tris is not None and len(tris):
        kwargs["triangles"] = np.ascontiguousarray(tris, dtype=np.uint32)
    if quads is not None and len(quads):
        kwargs["quads"] = np.ascontiguousarray(quads, dtype=np.uint32)
    return vdb.FloatGrid.createLevelSetFromPolygons(np.ascontiguousarray(points, dtype=np.float32), halfWidth=float(band), **kwargs)


def dense(grid, shape):
    out = np.full(shape, float(BAND), dtype=np.float32)
    grid.copyToArray(out, ijk=(0, 0, 0))
    return out


def large_shells(points, tris, quads, min_volume):
    """The shells of a mesh whose volume is at least min_volume, as (points, triangles)."""
    mesh = bmesh.new()
    verts = [mesh.verts.new(p) for p in points.tolist()]
    for face in list(tris.tolist()) + list(quads.tolist()):
        try:
            mesh.faces.new([verts[i] for i in face])
        except ValueError:
            pass                                      # a duplicate face: skip it
    mesh.verts.index_update()
    bmesh.ops.triangulate(mesh, faces=mesh.faces)
    keep = set()
    for comp in islands(mesh):
        faces = {f for v in comp for f in v.link_faces}
        volume = abs(sum(f.verts[0].co.dot(f.verts[1].co.cross(f.verts[2].co)) for f in faces) / 6.0)
        if volume >= min_volume:
            keep.update(v.index for v in comp)
    out_tris = np.array([[v.index for v in f.verts] for f in mesh.faces if f.verts[0].index in keep], dtype=np.uint32).reshape(-1, 3)
    mesh.free()
    return points, out_tris


def without_bristles(points_idx, tris, shape, radius_vox, keep_volume_vox):
    """Remove thin spikes. Thin parts with real volume, such as wings and mouthparts, stay.

    A morphological opening removes everything thinner than twice the radius. The removed
    material is then split into shells. Small shells are bristles and claw tips. Large
    shells are wing membranes and mouthparts, and the original surface is restored there.
    """
    original = level_set(points_idx, tris=tris)
    p, t, q = original.convertToPolygons(-radius_vox, 0.0)
    p, t, q = level_set(p, tris=t, quads=q).convertToPolygons(radius_vox, 0.0)
    f_open = dense(level_set(p, tris=t, quads=q), shape)
    f_orig = dense(original, shape)
    removed = vdb.FloatGrid(float(BAND))
    removed.copyFromArray(np.maximum(f_orig, -f_open))
    rp, rt, rq = removed.convertToPolygons(0.0, 0.0)
    kp, kt = large_shells(rp, rt, rq, keep_volume_vox)
    restore = np.zeros(shape, dtype=bool)
    if len(kt):
        restore |= dense(level_set(kp, tris=kt), shape) < 1.5
    # A membrane as thick as the opening limit survives in some voxel columns and not in others.
    # The removed material is then a set of narrow stripes, each too small to count as a large
    # shell, and the membrane comes back as a comb. So the removed material is also grown by two
    # voxels. The stripes of one membrane join, and a joined part as large as a wing takes its
    # original surface back as a whole.
    joined = max_filter((f_orig < 0) & (f_open > 0.5), 2)
    blocks = vdb.FloatGrid(float(BAND))
    blocks.copyFromArray(np.where(joined, -0.5, 0.5).astype(np.float32))
    wp, wt = large_shells(*blocks.convertToPolygons(0.0, 0.0), WING_VOLUME_MM3 * keep_volume_vox / 6.0)
    if len(wt):
        restore |= dense(level_set(wp, tris=wt), shape) < 1.0
    if not restore.any():
        return f_open, 0
    return np.where(restore, f_orig, f_open), int(len(kt) + len(wt))


def thin_bristles(points_idx, tris, shape, radius_vox, keep_volume_vox, h):
    """For the website model: remove the bristle spikes only, and report where each one stood.

    The generator draws each bristle as a thick spike, and the sheet draws a hair. The export
    puts a thin hair where each spike stood. A removed part is a bristle if it is small, long
    enough, and stands on a broad part of the body. A claw tip or a mouthpart tip stands on
    a thin part, and it stays.
    Returns the field and a list of (root, tip) pairs in voxel coordinates.
    """
    original = level_set(points_idx, tris=tris)
    p, t, q = original.convertToPolygons(-radius_vox, 0.0)
    p, t, q = level_set(p, tris=t, quads=q).convertToPolygons(radius_vox, 0.0)
    f_open = dense(level_set(p, tris=t, quads=q), shape)
    f_orig = dense(original, shape)
    removed = vdb.FloatGrid(float(BAND))
    removed.copyFromArray(np.maximum(f_orig, -f_open))
    rp, rt, rq = removed.convertToPolygons(0.0, 0.0)
    depth = np.maximum(-f_open, 0.0)
    mesh = bmesh.new()
    verts = [mesh.verts.new(point) for point in rp.tolist()]
    for face in list(rt.tolist()) + list(rq.tolist()):
        try:
            mesh.faces.new([verts[i] for i in face])
        except ValueError:
            pass                                      # a duplicate face: skip it
    mesh.verts.index_update()
    bmesh.ops.triangulate(mesh, faces=mesh.faces)
    limit = np.array(shape) - 1
    reach = int(math.ceil(1.8 / h))
    hairs, spike_tris = [], []
    for comp in islands(mesh):
        faces = {f for v in comp for f in v.link_faces}
        volume = abs(sum(f.verts[0].co.dot(f.verts[1].co.cross(f.verts[2].co)) for f in faces) / 6.0)
        if volume >= keep_volume_vox:
            continue
        points = np.array([v.co[:] for v in comp])
        index = np.clip(np.rint(points).astype(int), 0, limit)
        out = f_open[index[:, 0], index[:, 1], index[:, 2]]          # voxels past the opened surface
        if out.max() < BRISTLE_MIN_MM / h:
            continue
        root = points[out <= out.min() + 1.0].mean(axis=0)
        centre = np.clip(np.rint(root).astype(int), 0, limit)
        around = tuple(slice(max(c - reach, 0), c + reach + 1) for c in centre)
        if depth[around].max() < BRISTLE_BODY_MM / h:
            continue                                  # it stands on a finger or a mouthpart
        hairs.append((root, points[int(np.argmax(out))]))
        spike_tris.extend([v.index for v in f.verts] for f in faces)
    mesh.free()
    if not hairs:
        return f_orig, []
    zone = dense(level_set(rp, tris=np.array(spike_tris, dtype=np.uint32)), shape) < 1.5
    return np.where(zone, f_open, f_orig), hairs


def max_filter(a, k):
    """Maximum over a cube of half width k, one axis at a time."""
    for axis in range(3):
        out = a.copy()
        for s in range(1, k + 1):
            lo = [slice(None)] * 3
            hi = [slice(None)] * 3
            lo[axis] = slice(s, None)
            hi[axis] = slice(None, -s)
            np.maximum(out[tuple(lo)], a[tuple(hi)], out=out[tuple(lo)])
            np.maximum(out[tuple(hi)], a[tuple(lo)], out=out[tuple(hi)])
        a = out
    return a


def box_blur(a, k, passes=2):
    for _ in range(passes):
        for axis in range(3):
            acc = a.copy()
            for s in range(1, k + 1):
                lo = [slice(None)] * 3
                hi = [slice(None)] * 3
                lo[axis] = slice(s, None)
                hi[axis] = slice(None, -s)
                acc[tuple(lo)] += a[tuple(hi)]
                acc[tuple(hi)] += a[tuple(lo)]
            a = acc / (2 * k + 1)
    return a


def thicken(f, min_radius, max_growth):
    """Grow parts whose inscribed radius is under min_radius. Thick parts do not move."""
    depth = np.maximum(-f.F, 0.0)
    reach = int(math.ceil((min_radius + 0.5) / f.h))
    inscribed = max_filter(depth, reach)
    growth = np.clip(min_radius - inscribed, 0.0, max_growth)
    growth[np.abs(f.F) > 2.0] = 0.0
    growth = box_blur(growth.astype(np.float32), 2)
    f.F = (f.F - growth).astype(np.float32)
    return float(growth.max())


def add_base(f):
    """A slime base under the soles, wide enough to hold the centre of mass."""
    solid = f.F < 0
    zi = int(round((BASE_TOP + 1.5 - f.lo[2]) / f.h))
    foot = np.nonzero(solid[:, :, :zi].any(axis=2))
    fx, fy = f.ax[0][foot[0]], f.ax[1][foot[1]]
    counts = solid.sum(axis=2).astype(np.float64)
    com_x = float((counts.sum(axis=1) * f.ax[0]).sum() / counts.sum())
    com_y = float((counts.sum(axis=0) * f.ax[1]).sum() / counts.sum())
    cx, cy = (fx.min() + fx.max()) / 2, (fy.min() + fy.max()) / 2
    rx, ry = (fx.max() - fx.min()) / 2 + 6.0, (fy.max() - fy.min()) / 2 + 6.0
    lobes = [(cx, cy, rx, ry), (com_x, com_y, 17.0, 15.0), (cx - rx * 0.45, cy, rx * 0.7, ry * 1.05), (cx + rx * 0.45, cy, rx * 0.7, ry * 1.05)]
    for x, y, a, b in lobes:
        f.blob(bm.V(x, y, 1.0), bm.V(a, b, 2.2), k=3.0, mat=bm.SLIME)
    return {"footprint_centre_mm": [round(float(cx), 2), round(float(cy), 2)], "centre_of_mass_xy_mm": [round(com_x, 2), round(com_y, 2)]}


def band_centre(f, zmax, z0, z1):
    """Centre of the solid between two heights, given as fractions of the figure height."""
    k0, k1 = (int(round((z * zmax - f.lo[2]) / f.h)) for z in (z0, z1))
    idx = np.nonzero((f.F < 0)[:, :, k0:k1])
    return bm.V(f.ax[0][idx[0]].mean(), f.ax[1][idx[1]].mean(), f.ax[2][k0:k1][idx[2]].mean())


def torso_centre_x(f, z, around, half=9.0):
    """X of the torso centre at height z. Arms and wings are outside the window."""
    k = int(round((z - f.lo[2]) / f.h))
    counts = (f.F[:, :, k] < 0).sum(axis=1).astype(np.float64)
    counts[np.abs(f.ax[0] - around) > half] = 0.0
    return float((counts * f.ax[0]).sum() / max(counts.sum(), 1.0))


def back_y(f, x, z):
    hit = f.raycast(bm.V(x, 60.0, z), bm.V(0, -1, 0), max_dist=90.0)
    return None if hit is None else float(hit[1])


def rebuild_back(f, zmax):
    """Replace the back with the plates of the character sheet's back view.

    Use this only for a base mesh that was generated from a front view alone. Such a mesh
    has an invented back. It fills the cleft and adds raised bands that hug the surface.
    """
    around = float(band_centre(f, zmax, 0.40, 0.80)[0])
    fill, radii = [], []
    for frac in np.linspace(0.30, 0.55, 9):
        z = frac * zmax
        x0 = torso_centre_x(f, z, around)
        peaks = [y for y in (back_y(f, x0 + dx, z) for dx in (-6.0, -4.0, -2.5, 2.5, 4.0, 6.0)) if y is not None]
        if not peaks:
            continue
        fill.append(bm.V(x0, max(peaks) - 3.3, z))
        radii.append(3.5)
    if len(fill) >= 2:
        f.tube(fill, radii, k=1.6, mat=bm.FLESH, smooth=2)

    def bands(z_top, z_bottom, w_top, w_bottom, step=2.3, fixed_x=None):
        heights = np.arange(z_top * zmax, z_bottom * zmax, -step)
        for i, z in enumerate(heights):
            t = i / max(len(heights) - 1, 1)
            half = (w_top + (w_bottom - w_top) * t) / 2
            x0 = fixed_x if fixed_x is not None else torso_centre_x(f, z, around)
            starts = [bm.V(x0 + u * half, 60.0, z - abs(u) * 0.7) for u in (-1.0, -0.5, 0.0, 0.5, 1.0)]
            f.wrap(starts, bm.V(0, -1, 0), [1.0, 1.3, 1.45, 1.3, 1.0], embed=0.4, k=0.25, mat=bm.PLATE, smooth=3)

    bands(0.89, 0.60, 12.0, 7.0)
    bands(0.56, 0.37, 15.0, 4.0, fixed_x=torso_centre_x(f, 0.52 * zmax, around))


def add_dimples(f, zmax):
    """Pilot dimples for hand-implanted fibres, on the head, the back, the shoulders, and the hips."""
    head = band_centre(f, zmax, 0.80, 0.97)
    chest = band_centre(f, zmax, 0.62, 0.78)
    hips = band_centre(f, zmax, 0.36, 0.50)
    spots = [(head, d) for d in ((-0.6, -0.1, 0.8), (-0.2, 0.3, 0.93), (0.3, -0.1, 0.95), (0.65, 0.2, 0.73), (0, 0.75, 0.66),
                                 (-0.8, 0.4, 0.45), (0.85, 0.45, 0.28), (-0.95, 0.1, 0.3), (0.5, 0.8, 0.33), (-0.45, 0.85, 0.28))]
    spots += [(chest, d) for d in ((-0.5, 0.8, 0.35), (0.5, 0.8, 0.35), (-0.2, 0.95, 0.2), (0.25, 0.95, 0.0), (0, 0.9, 0.45),
                                   (-0.9, 0.35, 0.3), (0.9, 0.35, 0.3), (-0.75, 0.6, 0.25), (0.75, 0.6, 0.25))]
    spots += [(hips, d) for d in ((-0.9, 0.3, 0.1), (0.9, 0.3, 0.1), (-0.3, 0.95, 0.0), (0.3, 0.95, 0.1), (-0.7, 0.7, -0.1), (0.7, 0.7, -0.1))]
    out = []
    for origin, d in spots:
        d = bm.unit(bm.V(*d))
        hit = f.raycast(origin + d * 60.0, -d, max_dist=70.0)
        if hit is None or f.sample(hit - d * 4.0) > -0.3:
            continue                                  # under 4 mm of solid behind this point
        f.carve_tube([hit + d * 0.8, hit - d * 2.0], [0.6, 0.6], k=0.0)
        out.append((hit, d))
    return out


def outer_background(dark):
    """The dark pixels that connect to the image border. Dark eyes and dark chitin are not background."""
    bg = np.zeros_like(dark)
    bg[0], bg[-1], bg[:, 0], bg[:, -1] = dark[0], dark[-1], dark[:, 0], dark[:, -1]
    for _ in range(8):
        before = int(bg.sum())
        for i in range(1, dark.shape[0]):
            bg[i] |= dark[i] & bg[i - 1]
        for i in range(dark.shape[0] - 2, -1, -1):
            bg[i] |= dark[i] & bg[i + 1]
        for j in range(1, dark.shape[1]):
            bg[:, j] |= dark[:, j] & bg[:, j - 1]
        for j in range(dark.shape[1] - 2, -1, -1):
            bg[:, j] |= dark[:, j] & bg[:, j + 1]
        if int(bg.sum()) == before:
            break
    return bg


def erode(mask, steps):
    """Shrink a pixel mask by this many pixels, with a diamond-shaped reach."""
    for _ in range(steps):
        out = mask.copy()
        out[1:] &= mask[:-1]
        out[:-1] &= mask[1:]
        out[:, 1:] &= mask[:, :-1]
        out[:, :-1] &= mask[:, 1:]
        mask = out
    return mask


def dilate(mask, steps):
    """Grow a pixel mask by this many pixels, with a diamond-shaped reach."""
    return ~erode(~mask, steps)


def outline_distance(mask, reach):
    """Distance in pixels to the edge of a mask, negative inside, limited to +-reach."""
    out = np.zeros(mask.shape, dtype=np.float32)
    grown, shrunk = mask, mask
    for _ in range(reach):
        out += ~grown
        grown = dilate(grown, 1)
        shrunk = erode(shrunk, 1)
        out -= shrunk
    return out


def load_view(path):
    """An image as linear RGB rows from bottom to top, with its figure mask and bounding box."""
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    rgb = px.reshape(h, w, 4)[..., :3]
    figure = ~outer_background(rgb.max(axis=2) <= 0.08)
    ys, xs = np.nonzero(figure)
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    # A blurred copy for surfaces that face sideways, where a sharp projection would streak.
    soft = np.where(figure[..., None], linear, linear[figure].mean(axis=0))
    for _ in range(2):
        for axis in (0, 1):
            c = np.cumsum(np.pad(soft, [(13, 12) if a == axis else (0, 0) for a in range(3)], mode="edge"), axis=axis)
            soft = (np.take(c, range(25, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 25), axis=axis)) / 25.0
    # The figure's colours, grown outward. A part of the model that reaches past the drawing,
    # such as a wing tip, takes the colour of the nearest drawn pixel. The growth starts a few
    # pixels inside the outline and from locally averaged colours, so the dark outline pixels
    # of the drawing do not streak outward.
    weight = figure.astype(np.float64)[..., None]
    local, cover = linear * weight, weight.copy()
    for axis in (0, 1):
        pad = [(4, 4) if a == axis else (0, 0) for a in range(3)]
        local = sum(np.roll(np.pad(local, pad, mode="edge"), k, axis=axis) for k in range(-4, 5))[tuple(slice(4, -4) if a == axis else slice(None) for a in range(3))]
        cover = sum(np.roll(np.pad(cover, pad, mode="edge"), k, axis=axis) for k in range(-4, 5))[tuple(slice(4, -4) if a == axis else slice(None) for a in range(3))]
    local = local / np.maximum(cover, 1e-6)
    known = erode(figure, 4)
    spread = np.where(known[..., None], local, 0.0)
    for _ in range(90):
        for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
            near_known = np.roll(known, shift, axis=axis)
            take = near_known & ~known
            spread[take] = np.roll(spread, shift, axis=axis)[take]
            known |= take
    return {"rgb": rgb, "linear": linear, "soft": soft, "spread": spread, "spread_known": known, "figure": figure,
            "box": (xs.min(), xs.max(), ys.min(), ys.max())}


def register(view, f, mirror, window=None, start=None, axis=0):
    """Fit a sheet view to the model's outline: one scale, one offset across, one in z.

    axis 0 fits a front or back view against the outline seen along Y. axis 1 fits a side
    view against the outline seen along X. The generator keeps the proportions of its
    input views, but not their exact frame. window = (u0, u1, z0, z1) limits the fit to
    one region, such as the head. The scale then stays as in start.
    """
    solid = (f.F < 0).any(axis=1 - axis)[::2, ::2]
    us, zs = f.ax[axis][::2].astype(np.float64), f.ax[2][::2].astype(np.float64)
    zin, uin = zs[solid.any(axis=0)], us[solid.any(axis=1)]
    zmin, uc = zin.min(), (uin.min() + uin.max()) / 2
    c0, c1, r0, r1 = view["box"]
    cc = (c0 + c1) / 2
    sign = -1.0 if mirror else 1.0
    mask = view["figure"]
    U, Z = np.meshgrid(us, zs, indexing="ij")
    region = np.ones_like(solid) if window is None else (U >= window[0]) & (U <= window[1]) & (Z >= window[2]) & (Z <= window[3])
    if start is None:
        best = (-1.0, (zin.max() - zmin) / (r1 - r0), 0.0, 0.0)
        passes = ((0.06, 5.0, 2.5, 9), (0.015, 1.25, 0.6, 7))
    else:
        best = (-1.0, start["s"], start["tx"], start["tz"])
        passes = ((0.0, 4.0, 2.0, 17), (0.0, 0.5, 0.25, 9))
    for span_s, span_u, span_z, steps in passes:
        _, bs, bu, bz = best
        scales = np.linspace(bs * (1 - span_s), bs * (1 + span_s), steps) if span_s else [bs]
        for s in scales:
            for tu in np.linspace(bu - span_u, bu + span_u, steps):
                for tz in np.linspace(bz - span_z, bz + span_z, steps):
                    col = np.rint(cc + sign * (U - uc - tu) / s).astype(int)
                    row = np.rint(r0 + (Z - zmin - tz) / s).astype(int)
                    ok = (col >= 0) & (col < mask.shape[1]) & (row >= 0) & (row < mask.shape[0])
                    hit = np.zeros_like(solid)
                    hit[ok] = mask[row[ok], col[ok]]
                    iou = (hit & solid & region).sum() / max(((hit | solid) & region).sum(), 1)
                    if iou > best[0]:
                        best = (iou, s, tu, tz)
    iou, s, tu, tz = best
    return {"iou": float(iou), "s": float(s), "tx": float(tu), "tz": float(tz), "xc": float(uc), "zmin": float(zmin), "cc": float(cc), "r0": float(r0), "sign": sign}


def blended_fit(body, head, z_low, z_high, head_u=None):
    """Image column and row for model points: the head fit on the head, the body fit elsewhere.

    The head fit applies above z_high and, when head_u = (centre, half width) is given, only
    that close to the head across the view. The wings and the shoulders are as high as the
    head, but they belong to the body, so they keep the body fit.
    """
    def offsets(u, z):
        w = np.clip((np.asarray(z, dtype=np.float64) - z_low) / (z_high - z_low), 0.0, 1.0)
        if head_u is not None:
            w = w * np.clip((head_u[1] + HEAD_FADE - np.abs(np.asarray(u, dtype=np.float64) - head_u[0])) / HEAD_FADE, 0.0, 1.0)
        w = w * w * (3 - 2 * w)
        return body["tx"] * (1 - w) + head["tx"] * w, body["tz"] * (1 - w) + head["tz"] * w

    def to_image(u, z):
        tu, tz = offsets(u, z)
        return body["cc"] + body["sign"] * (u - body["xc"] - tu) / body["s"], body["r0"] + (z - body["zmin"] - tz) / body["s"]

    return to_image


HEAD_FADE = 2.5   # millimetres over which the head fit gives way to the body fit, across a view

# Each view: the model axis it lies across, the normal component that faces it, and if the image is mirrored.
VIEW_SETUP = {
    "front": {"axis": 0, "facing": (1, -1.0), "mirror": False},     # the camera looks along +Y
    "back": {"axis": 0, "facing": (1, 1.0), "mirror": True},
    "right": {"axis": 1, "facing": (0, -1.0), "mirror": False},     # the figure's right side, the figure faces image left
    "left": {"axis": 1, "facing": (0, 1.0), "mirror": True},
}


def teal_mask(view):
    """The teal eye glints of a view: in the upper part of the figure, more blue and green than red."""
    rgb = view["rgb"]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    c0, c1, r0, r1 = view["box"]
    teal = (b > 0.3) & (b > r * 1.25) & (g > r * 1.05)
    teal[: r0 + int((r1 - r0) * 0.62)] = False
    teal[r0 + int((r1 - r0) * 0.93):] = False
    return teal


def erase_painted_eyes(view, reach=20):
    """Replace each painted eye with the skin colours around it.

    The model has its own eyeballs. A painted eye beside an eyeball reads as a stray patch.
    The front view finds the whole painted opening and fills it from its edge inward. A view
    with no clear opening loses a patch around the teal glint.
    """
    mask = np.zeros(view["figure"].shape, dtype=bool)
    for rows, cols in eye_openings(view):
        mask[rows, cols] = True
    if mask.any():
        mask = dilate(mask, 4)
    else:
        mask = dilate(teal_mask(view), reach)
    colour, known = view["linear"].copy(), ~mask
    for _ in range(200):
        if known.all():
            break
        total = np.zeros_like(colour)
        count = np.zeros(known.shape)
        for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
            near = np.roll(known, shift, axis=axis)
            total += np.where(near[..., None], np.roll(colour, shift, axis=axis), 0.0)
            count += near
        take = ~known & (count > 0)
        colour[take] = total[take] / count[take][:, None]
        known |= take
    view["linear"] = colour
    return int(mask.sum())


def eye_openings(view):
    """The painted eye openings of a view: the teal iris and the dark rim around it.

    Returns one (rows, cols) pair of pixel index arrays for each eye, screen left first.
    """
    teal = teal_mask(view)
    rows, cols = np.nonzero(teal)
    if len(cols) < 20:
        return []
    rgb = view["rgb"]
    r, b, value = rgb[..., 0], rgb[..., 2], rgb.max(axis=2)
    eye = teal | ((b >= r * 0.98) & (value < 0.75)) | (value < 0.22)
    window = np.zeros_like(eye)
    window[max(rows.min() - 60, 0):rows.max() + 60, max(cols.min() - 60, 0):cols.max() + 60] = True
    eye = dilate(erode(eye & window, 3), 3)         # cuts the dark skin creases that touch the rim
    reached = teal & eye
    for _ in range(120):                            # the part of the mask that connects to the iris
        grown = dilate(reached, 1) & eye
        if int(grown.sum()) == int(reached.sum()):
            break
        reached = grown
    rows, cols = np.nonzero(reached)
    split = (cols.min() + cols.max()) / 2
    return [(rows[side], cols[side]) for side in (cols < split, cols >= split) if side.sum() >= 10]


def find_eyes(view, head_fit):
    """Eye centres and half sizes in model x and z, from the sheet's front view. Screen left first."""
    fit = head_fit
    eyes = []
    for rows, cols in eye_openings(view):
        x = fit["xc"] + fit["tx"] + fit["sign"] * ((cols.min() + cols.max()) / 2 - fit["cc"]) * fit["s"]
        z = fit["zmin"] + fit["tz"] + ((rows.min() + rows.max()) / 2 - fit["r0"]) * fit["s"]
        eyes.append({"x": float(x), "z": float(z), "half_width": float((cols.max() - cols.min() + 1) * fit["s"] / 2),
                     "half_height": float((rows.max() - rows.min() + 1) * fit["s"] / 2)})
    return sorted(eyes, key=lambda e: e["x"])


def trim_small_wing(f, view, to_image, zmax, tolerance=3.0):
    """Cut the smaller wing back to its outline in the sheet's front view. Returns the volume removed.

    The generator makes the smaller wing far wider than the sheet draws it. A wing is a thin
    sheet behind the shoulders, so the cut applies to thin parts there and to nothing else.
    The larger wing stays as it is: it matches the sheet, and its tip sets the figure height.
    tolerance is in image pixels.
    """
    h = f.h
    y0, z0 = int(np.searchsorted(f.ax[1], 0.0)), int(np.searchsorted(f.ax[2], 0.70 * zmax))
    block = f.F[:, y0:, z0:]
    solid = block < 0
    k = max(int(round(1.0 / h)), 1)
    core = ~max_filter(~solid, k)                   # what a cube of about 2 mm fits inside
    thin = solid & ~max_filter(core, k + 1)
    centre = (f.ax[0][solid.any(axis=(1, 2))].min() + f.ax[0][solid.any(axis=(1, 2))].max()) / 2
    thin &= ((f.ax[0] - centre) * SMALL_WING_SIDE > 7.0)[:, None, None]
    X, Z = np.meshgrid(f.ax[0].astype(np.float64), f.ax[2][z0:].astype(np.float64), indexing="ij")
    col, row = to_image(X, Z)
    col = np.clip(np.rint(col).astype(int), 0, view["figure"].shape[1] - 1)
    row = np.clip(np.rint(row).astype(int), 0, view["figure"].shape[0] - 1)
    scale = abs(float(f.ax[0][1] - f.ax[0][0])) / max(abs(float(to_image(f.ax[0][1], 0.0)[0] - to_image(f.ax[0][0], 0.0)[0])), 1e-9)   # mm per pixel
    # A blurred copy of the figure mask falls from 1 to 0 across the outline. Near the outline
    # that fall is a smooth distance in pixels, without the steps of the pixel art.
    width = 9
    soft = view["figure"].astype(np.float64)
    for _ in range(2):
        for axis in (0, 1):
            c = np.cumsum(np.pad(soft, [(width // 2 + 1, width // 2) if a == axis else (0, 0) for a in range(2)], mode="edge"), axis=axis)
            soft = (np.take(c, range(width, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - width), axis=axis)) / width
    near = (0.5 - soft) * width - tolerance                    # pixels past the cut line, smooth, true near the line only
    steps = outline_distance(near < 0, 16)                     # pixels past the cut line, in whole steps, true farther away
    past = np.where(np.abs(steps) <= 1, near, steps)[row, col]
    # The values stay true distances for a millimetre past the cut. The thickening step for the
    # print model reads them, and a jump there would put steps on the cut edge. Farther out
    # the distance is unknown, and a large value keeps a removed part from growing back.
    outside = np.where(past >= 16, BAND * h, past * scale)[:, None, :]                                 # mm past the cut line
    cut = np.maximum(block, np.broadcast_to(outside, block.shape))
    removed = thin & (cut >= 0)
    # The cut also applies to the empty space just around the wing. The space beside a removed
    # part still holds its small distance to the old surface, and the thickening step for the
    # print model would read that as a thin part and grow a hollow copy of the removed tip.
    around = thin | (max_filter(thin, int(math.ceil(1.0 / h))) & ~solid)
    block[around] = cut[around]
    return float(removed.sum()) * h ** 3


def sheet_colour_fn(views):
    """Vertex or texel colours from the sheet views, each projected along its own axis.

    views maps a name from VIEW_SETUP to (image data, to_image function). A surface takes
    its colour from the views it faces, weighted by how squarely it faces them.
    """
    flesh = bm.srgb_to_linear(bm.PALETTE[bm.FLESH])
    has_sides = "right" in views or "left" in views

    def colour(xyz, normal, hidden=None):
        """hidden maps a view name to a value from 0 to 1 for each point: how far that view cannot
        see the point, because another part is in front of it. A hidden point takes the blurred
        colour of the view. A sharp sample there would paint the part in front onto the part behind."""
        total = np.zeros((len(xyz), 1))
        mixed = np.zeros((len(xyz), 3))
        fallback = np.zeros((len(xyz), 3))
        fallback_weight = np.zeros((len(xyz), 1))
        for name, (view, to_image) in views.items():
            setup = VIEW_SETUP[name]
            component, direction = setup["facing"]
            facing = np.clip(normal[:, component] * direction, 0.0, 1.0)
            col, row = to_image(xyz[:, setup["axis"]], xyz[:, 2])
            col = np.clip(np.rint(col).astype(int), 0, view["figure"].shape[1] - 1)
            row = np.clip(np.rint(row).astype(int), 0, view["figure"].shape[0] - 1)
            inside = view["figure"][row, col]
            if has_sides:
                sample = view["linear"][row, col]
            else:                                   # with two views only, soften what faces sideways
                sideways = np.clip(1.0 - np.abs(normal[:, 1]) / 0.55, 0.0, 1.0)[:, None]
                sample = view["linear"][row, col] * (1 - sideways) + view["soft"][row, col] * sideways
            if hidden is not None and name in hidden:
                behind = hidden[name][:, None]
                sample = sample * (1 - behind) + view["soft"][row, col] * behind
            weight = (facing ** 2 * inside)[:, None]
            mixed += sample * weight
            total += weight
            # A second choice, for points that no view both faces and covers: the nearest drawn colour.
            loose = ((facing + 0.05) ** 2 * view["spread_known"][row, col])[:, None]
            spread = view["spread"][row, col]
            if hidden is not None and name in hidden:
                spread = spread * (1 - hidden[name][:, None]) + view["soft"][row, col] * hidden[name][:, None]
            fallback += spread * loose
            fallback_weight += loose
        second = np.where(fallback_weight > 1e-6, fallback / np.maximum(fallback_weight, 1e-6), flesh)
        return np.where(total > 1e-4, mixed / np.maximum(total, 1e-4), second)

    return colour


# The eyes follow the site's relief rig. On the website the site builds that rig's own eyes and
# lids at each eye node, so the website model has an empty socket and a marker for each eye.
# The print model has its own globe and two open lids, in the same proportions.
# Radii of each globe in build millimetres, screen left first: across, in depth, and in height.
# The widths are 0.116 and 0.081 of the head width, as on the relief rig (face.ts). The head
# width is the site's measure of this model's head, 12.4 mm at the build's scale.
EYE_RADII = ((1.44, 1.13, 1.37), (1.01, 0.84, 0.82))
# The centre of a globe sits this share of its depth radius behind the skin. At this depth the
# rims of the open lids meet the skin, so the globe sits in the head and does not stand on it.
EYE_SET_BACK = 0.65
# Each lid is half of a shell around the globe, hinged at the globe centre about the X axis.
# Open, its edge is this many radians above or below the line of sight.
LID_OPEN = 0.96
# The lid shell of the relief rig, as multiples of the globe radii: across and in height, and in depth.
LID_SHELL = (1.055, 1.13)
# The print model's lid shell is round about the hinge. Its radius is this multiple of the larger of
# the globe's depth and height radii. It is thicker than the relief's, so it reads in one colour.
PRINT_LID_RADIUS = 1.22
# The socket is this much larger than the lid shell.
SOCKET_ROOM = 1.10
# The sheet draws the smaller wing on the figure's left, which is +X.
SMALL_WING_SIDE = 1.0


def add_eyes(f, eyes, solid):
    """A socket where the sheet has each eye, at the proportions of the site's relief rig.

    With solid, the socket also gets a globe and two open lids as part of the model: the
    print model has no joints, so its lids cannot move. Without it the socket stays empty:
    the site builds the relief rig's own eye and lids at each marker.
    Returns the centre and the three radii of each globe.
    """
    out = []
    for eye, (across, depth, height) in zip(eyes, EYE_RADII):
        hit = f.raycast(bm.V(eye["x"], -45.0, eye["z"]), bm.V(0, 1, 0), max_dist=60.0)
        if hit is None:
            continue
        centre = hit + bm.V(0, depth * EYE_SET_BACK, 0)
        radii = bm.V(across, depth, height)
        # The socket holds the globe and the lid shell, with a narrow groove around them. It also
        # removes the generator's own eye bump, which is larger than the smaller globe.
        shell = bm.V(across * LID_SHELL[0], depth * LID_SHELL[1], height * LID_SHELL[0])
        if solid:
            round_shell = max(depth, height) * PRINT_LID_RADIUS
            shell = bm.V(across * LID_SHELL[0], round_shell, round_shell)
        f.carve_blob(centre, shell * SOCKET_ROOM, k=0.2)
        if solid:
            sl, X, Y, Z = f.box(centre - shell, centre + shell, 3 * f.h)
            lids = bm.sd_ellipsoid(X, Y, Z, centre, shell)
            # The lids leave a wedge open in front of the globe: all points within LID_OPEN of the line of sight.
            forward, up = -(Y - centre[1]), Z - centre[2]
            wedge = (LID_OPEN - np.abs(np.arctan2(up, forward))) * np.sqrt(forward ** 2 + up ** 2)
            f.add(np.maximum(lids, wedge), sl, 0.15, bm.FLESH)
            f.blob(centre, radii, k=0, mat=bm.EYE)
        out.append({"centre": centre, "radii": radii})
    return out


def erase_all_eyes(views):
    """Every view loses its painted eyes. The eyeballs of the model replace them."""
    for view, _ in views.values():
        erase_painted_eyes(view)


def main():
    args = parse()
    os.makedirs(args.out, exist_ok=True)
    t0 = time.time()
    h = args.voxel
    printing = args.variant == "print"

    verts, tris, dropped = load_largest_shell(args.source)
    scale = FIGURE_MM / (verts[:, 2].max() - verts[:, 2].min())
    f = bm.Field(LO, HI, h)
    shape = tuple(int(n) for n in f.n)

    def place(points_mm):
        """Centre in X and Y, and put the lowest sole just inside the base."""
        mn, mx = points_mm.min(axis=0), points_mm.max(axis=0)
        shift = np.array([-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, (BASE_TOP - SINK if printing else 0.0) - mn[2]])
        return points_mm + shift

    kept_faces, hairs = 0, []
    points = place(verts * scale)
    if printing:
        # The bristles are the highest points. Remove them, then fit the height again.
        for _ in range(2):
            field, kept_faces = without_bristles((points - LO) / h, tris, shape, args.open_radius / h, args.keep_volume / h ** 3)
            heights = f.ax[2][np.nonzero((field < 0).any(axis=(0, 1)))[0]]
            centre = np.array([0.0, 0.0, points[:, 2].min()])
            points = place((points - centre) * (FIGURE_MM / (heights.max() - heights.min())) + centre)
        field, kept_faces = without_bristles((points - LO) / h, tris, shape, args.open_radius / h, args.keep_volume / h ** 3)
    else:
        field, hairs = thin_bristles((points - LO) / h, tris, shape, args.open_radius / h, args.keep_volume / h ** 3, h)
        hairs = [(root * h + LO, tip * h + LO) for root, tip in hairs]
    f.F = field * h
    f.M[f.F < 2.0] = bm.FLESH

    stats = {"source": os.path.basename(args.source), "variant": args.variant, "voxel_mm": h, "source_scale_mm_per_unit": round(float(scale), 3),
             "small_shells_dropped": dropped, "thin_part_faces_kept": kept_faces}
    f.dimples, f.eyes = [], []
    eye_spots = []
    solid_z = f.ax[2][np.nonzero((f.F < 0).any(axis=(0, 1)))[0]]
    zmax = float(solid_z.max())
    head = band_centre(f, zmax, 0.80, 0.99)
    eyes = []
    images = {"front": args.front_image, "back": args.back_image, "right": args.right_image, "left": args.left_image}
    if args.front_image and args.back_image:
        z_low, z_high = 0.58 * zmax, 0.66 * zmax
        views, record, fits = {}, {}, {}
        for name, path in images.items():
            if not path:
                continue
            setup = VIEW_SETUP[name]
            view = load_view(path)
            body = register(view, f, mirror=setup["mirror"], axis=setup["axis"])
            # The head gets its own offsets: a wing or a hand can pull the whole-body fit off the face.
            # Seen from the front or the back, the window is only as wide as the head. A wider one
            # takes in the shoulders and the wing roots, and they pull the face about 2 mm sideways.
            centre = head[setup["axis"]]
            if setup["axis"] == 0:
                window = (centre - 8.5, centre + 8.5, 0.70 * zmax, 0.995 * zmax)
            else:
                window = (centre - 14.0, centre + 14.0, 0.62 * zmax, 0.97 * zmax)
            head_fit = register(view, f, mirror=setup["mirror"], window=window, start=body, axis=setup["axis"])
            head_u = [float(centre), float(window[1] - window[0]) / 2]
            views[name] = (view, blended_fit(body, head_fit, z_low, z_high, head_u))
            record[name] = {"image": os.path.basename(path), "body": body, "head": head_fit, "head_u": head_u}
            fits[name] = (view, body, head_fit)
        stats["sheet_fit"] = {name: {"overlap": round(r["body"]["iou"], 3), "head_overlap": round(r["head"]["iou"], 3)} for name, r in record.items()}
        f.colour_fn = sheet_colour_fn(views)
        # The export bakes the same projection into a texture, so it needs the fit.
        stats["sheet_projection"] = {"views": record, "blend_z": [z_low, z_high]}
        front, _, head_front = fits["front"]
        spots = find_eyes(front, head_front)
        stats["sheet_fit"]["front"]["eyes_from_art_x"] = [round(e["x"], 2) for e in spots]
        # The sheet's head is turned a little, and the model's head is not. So the eyes keep the
        # artwork's spacing, height, and size, centred on the model's head. The front view moves
        # across the head by the same amount, so the painted lids stay around the eyeballs.
        if len(spots) == 2:
            shift = head[0] - (spots[0]["x"] + spots[1]["x"]) / 2
            for eye in spots:
                eye["x"] += shift
            head_front["tx"] += shift
            stats["sheet_fit"]["front"]["face_shift_mm"] = round(float(shift), 3)
        # The print model keeps its wing. Its membrane is rebuilt from the removed thin parts, and
        # the cut only frays the tip there: the thick leading edge is not a thin part.
        stats["wing_trim_mm3"] = round(trim_small_wing(f, front, views["front"][1], zmax), 1)
        eye_spots = spots
        erase_all_eyes(views)
    if args.rebuild_back:
        rebuild_back(f, zmax)
    if printing:
        stats["max_growth_mm"] = round(thicken(f, args.min_radius, args.max_growth), 3)
        stats["base"] = add_base(f)
        if args.dimples:
            f.dimples = add_dimples(f, zmax)
    # The eyes come after the thickening step. That step grows thin edges, and it would close the sockets.
    eyes = add_eyes(f, eye_spots, solid=printing)
    anchors = {}
    face = f.raycast(head + bm.V(0, -40.0, -2.0), bm.V(0, 1, 0), max_dist=60.0)
    if face is not None:
        anchors["anchor-face"] = face
    Z = f.ax[2][None, None, :]
    f.F = np.maximum(f.F, -Z).astype(np.float32)          # flat underside
    if args.dump_field:
        np.savez_compressed(os.path.join(args.out, "field.npz"), solid=np.packbits(f.F < 0), shape=f.n, lo=f.lo, h=f.h)

    # field_to_mesh reads these module-level joints for the website data. Replace them with measured values.
    bm.HEAD = head
    bm.KNUCKLE = {-1: head, 1: head}
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 0.001
    sc.unit_settings.length_unit = "MILLIMETERS"
    ob, mesh_scale, volume, extra = bm.field_to_mesh(f)
    if "sheet_projection" in stats:
        stats["sheet_projection"].update({"field_zmin": f.mesh_zmin, "mesh_scale": float(mesh_scale)})
    site = f.site_mm
    site["eyes"] = []
    to_mm = lambda point: [round(float(c) * mesh_scale, 3) for c in (point - bm.V(0, 0, f.mesh_zmin))]
    for eye in eyes:
        site["eyes"].append({"centre_mm": to_mm(eye["centre"]), "radii_mm": [round(float(r) * mesh_scale, 3) for r in eye["radii"]]})
    site["socket_scale"] = [LID_SHELL[0] * SOCKET_ROOM, LID_SHELL[1] * SOCKET_ROOM, LID_SHELL[0] * SOCKET_ROOM]
    # Where each bristle stood on the website model. The export puts a thin hair there.
    site["bristles"] = [{"root_mm": [round(float(c) * mesh_scale, 3) for c in (root - bm.V(0, 0, f.mesh_zmin))],
                         "tip_mm": [round(float(c) * mesh_scale, 3) for c in (tip - bm.V(0, 0, f.mesh_zmin))]} for root, tip in hairs]
    site["anchors"] = {name: [round(float(c) * mesh_scale, 3) for c in (p - bm.V(0, 0, f.mesh_zmin))] for name, p in anchors.items()}
    site["pelvis_xy_mm"] = [0.0, 0.0]
    d = ob.dimensions
    stats.update({
        "grid": [int(n) for n in f.n],
        "final_scale": round(float(mesh_scale), 4),
        "dimensions_mm": [round(float(d.x), 2), round(float(d.y), 2), round(float(d.z), 2)],
        "volume_cm3": round(volume / 1000.0, 2),
        "vertices": len(ob.data.vertices),
        "triangles": len(ob.data.polygons),
        "extra_shells_removed": extra[:10],
        "bristle_dimples": len(f.bristles_mm),
        "site": site,
        "seconds_total": round(time.time() - t0, 1),
    })
    if f.bristles_mm:
        with open(os.path.join(args.out, "bristle-map.json"), "w") as fh:
            json.dump({"units": "mm", "dimple_diameter_mm": 1.2, "dimple_depth_mm": 2.0, "dimples": f.bristles_mm}, fh, indent=1)
    with open(os.path.join(args.out, "build-stats.json"), "w") as fh:
        json.dump(stats, fh, indent=1)
    print("BUILD " + json.dumps({k: v for k, v in stats.items() if k != "site"}))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.out, "brundlefly-work.blend"), compress=True)


if __name__ == "__main__":
    main()
