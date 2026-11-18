"""Build the Brundlefly figurine.

The model is a signed distance field on a numpy grid. OpenVDB turns the field into a
closed mesh. Blender stores the mesh, the vertex colours, and the master file.

Run headless, with absolute paths:
  flatpak run org.blender.Blender -b --factory-startup \
    --python /abs/build_model.py -- --out /abs/dir --voxel 0.2

Pose: the standing, hunched pose of assets/brand/character.png.

Units: the anatomy uses design units. The script scales the mesh so that the total
height is HEIGHT_MM. One Blender unit is one millimetre. Z is up. The figure faces -Y.
Sides: s = +1 is the figure's left (+X). s = -1 is the figure's right (-X).
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

HEIGHT_MM = 80.0
SCALE_GUESS = 0.706  # design unit to millimetre for the print build; main() fails if the real scale drifts
BIG = 6.0

# Minimum sizes in millimetres ("Design to" column of the plan).
MIN_LIMB_R = 1.25
MIN_TIP_R = 0.75
MIN_WING_T = 2.0

FLESH, CHITIN, EYE, WING, SLIME, CLAW, BRUISE, PLATE, BELLY = 1, 2, 3, 4, 5, 6, 7, 8, 9
PALETTE = {
    0: "#AA604B",
    FLESH: "#AA604B",
    CHITIN: "#343C3B",
    EYE: "#0B1420",
    WING: "#A4B5A0",
    SLIME: "#777648",
    CLAW: "#1E1F1D",
    BRUISE: "#69404B",
    PLATE: "#343C3B",
    BELLY: "#6A5A38",
}
ZG = 3.0  # nominal top of the base under the feet


def V(*a):
    return np.array(a, dtype=np.float64)


def unit(v):
    return v / np.linalg.norm(v)


PRINT = True   # False for the web variant: thin parts keep their drawn size


def limb_r(r):
    return max(r, MIN_LIMB_R / SCALE_GUESS) if PRINT else r * 0.72


def tip_r(r):
    return max(r, MIN_TIP_R / SCALE_GUESS) if PRINT else r * 0.45


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def sd_round_cone(X, Y, Z, a, b, r1, r2):
    """Exact distance to a capsule with two radii (after Inigo Quilez)."""
    bax, bay, baz = (float(c) for c in (b - a))
    l2 = bax * bax + bay * bay + baz * baz
    pax = X - a[0]
    pay = Y - a[1]
    paz = Z - a[2]
    rr = r1 - r2
    a2 = l2 - rr * rr
    if l2 < 1e-9 or a2 <= 1e-9:
        r = max(r1, r2)
        c = a if r1 >= r2 else b
        return np.sqrt((X - c[0]) ** 2 + (Y - c[1]) ** 2 + (Z - c[2]) ** 2) - r
    il2 = 1.0 / l2
    y = pax * bax + pay * bay + paz * baz
    z = y - l2
    qx = pax * l2 - bax * y
    qy = pay * l2 - bay * y
    qz = paz * l2 - baz * y
    x2 = qx * qx + qy * qy + qz * qz
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d = (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
    d = np.where(np.sign(y) * a2 * y2 < k, np.sqrt(x2 + y2) * il2 - r1, d)
    d = np.where(np.sign(z) * a2 * z2 > k, np.sqrt(x2 + z2) * il2 - r2, d)
    return d


def sd_ellipsoid(X, Y, Z, c, r, rot=None):
    dx = X - c[0]
    dy = Y - c[1]
    dz = Z - c[2]
    if rot is not None:
        lx = rot[0, 0] * dx + rot[1, 0] * dy + rot[2, 0] * dz
        ly = rot[0, 1] * dx + rot[1, 1] * dy + rot[2, 1] * dz
        lz = rot[0, 2] * dx + rot[1, 2] * dy + rot[2, 2] * dz
        dx, dy, dz = lx, ly, lz
    k0 = np.sqrt((dx / r[0]) ** 2 + (dy / r[1]) ** 2 + (dz / r[2]) ** 2)
    k1 = np.sqrt((dx / r[0] ** 2) ** 2 + (dy / r[1] ** 2) ** 2 + (dz / r[2] ** 2) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sd_polygon(U, W, poly):
    d = (U - poly[0][0]) ** 2 + (W - poly[0][1]) ** 2
    s = np.ones_like(d)
    n = len(poly)
    j = n - 1
    for i in range(n):
        ex = poly[j][0] - poly[i][0]
        ey = poly[j][1] - poly[i][1]
        wx = U - poly[i][0]
        wy = W - poly[i][1]
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0.0, 1.0)
        bx = wx - ex * t
        by = wy - ey * t
        d = np.minimum(d, bx * bx + by * by)
        c1 = W >= poly[i][1]
        c2 = W < poly[j][1]
        c3 = ex * wy > ey * wx
        s = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -s, s)
        j = i
    return s * np.sqrt(d)


def rot_xyz(rx, ry, rz):
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


def catmull(pts, rads, n=4):
    """Smooth a polyline. Returns denser points and radii."""
    pts = [np.asarray(p, dtype=np.float64) for p in pts]
    if len(pts) < 3:
        return pts, list(rads)
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out_p, out_r = [], []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out_p.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            out_r.append(rads[i] + (rads[i + 1] - rads[i]) * t)
    out_p.append(pts[-1])
    out_r.append(rads[-1])
    return out_p, out_r


class Field:
    def __init__(self, lo, hi, h):
        self.h = float(h)
        self.lo = np.array(lo, dtype=np.float64)
        self.n = (np.ceil((np.array(hi) - self.lo) / h).astype(int) + 1)
        self.F = np.full(self.n, BIG, dtype=np.float32)
        self.M = np.zeros(self.n, dtype=np.uint8)
        self.S = np.zeros(self.n, dtype=np.uint8)      # segment id, for surface detail
        self.segs = {}
        self.ax = [(self.lo[i] + h * np.arange(self.n[i])).astype(np.float32) for i in range(3)]

    def box(self, lo, hi, pad):
        i0 = np.maximum(np.floor((np.asarray(lo) - pad - self.lo) / self.h).astype(int), 0)
        i1 = np.minimum(np.ceil((np.asarray(hi) + pad - self.lo) / self.h).astype(int) + 1, self.n)
        sl = tuple(slice(int(a), int(b)) for a, b in zip(i0, i1))
        X = self.ax[0][sl[0]][:, None, None]
        Y = self.ax[1][sl[1]][None, :, None]
        Z = self.ax[2][sl[2]][None, None, :]
        return sl, X, Y, Z

    def add(self, d, sl, k, mat, seg=None):
        cur = self.F[sl]
        closer = d < cur
        if mat is not None:
            self.M[sl][closer] = mat
        self.S[sl][closer] = 0 if seg is None else seg
        self.F[sl] = smin(cur, d.astype(np.float32), k)

    def seg_id(self, name, a, b, kind):
        sid = len(self.segs) + 1
        self.segs[sid] = (name, np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64), kind)
        return sid

    def cut(self, d, sl, k):
        self.F[sl] = smax(self.F[sl], -d.astype(np.float32), k)

    # Primitives -------------------------------------------------------------
    def tube(self, pts, rads, k=1.0, mat=FLESH, smooth=0, seg=None):
        if smooth:
            pts, rads = catmull(pts, rads, smooth)
        pts = [np.asarray(p, dtype=np.float64) for p in pts]
        rmax = max(rads)
        lo = np.min(pts, axis=0) - rmax
        hi = np.max(pts, axis=0) + rmax
        sl, X, Y, Z = self.box(lo, hi, k + 3 * self.h)
        d = None
        for i in range(len(pts) - 1):
            di = sd_round_cone(X, Y, Z, pts[i], pts[i + 1], rads[i], rads[i + 1])
            d = di if d is None else np.minimum(d, di)
        self.add(d, sl, k, mat, seg)

    def blob(self, c, r, k=1.5, mat=FLESH, rot=None, seg=None):
        c = np.asarray(c, dtype=np.float64)
        r = np.asarray(r, dtype=np.float64)
        ext = r if rot is None else np.full(3, r.max())
        sl, X, Y, Z = self.box(c - ext, c + ext, k + 3 * self.h)
        self.add(sd_ellipsoid(X, Y, Z, c, r, rot), sl, k, mat, seg)

    def paint(self, c, r, mat, rot=None, keep=()):
        """Change the material inside an ellipsoid. The shape does not change."""
        c = np.asarray(c, dtype=np.float64)
        r = np.asarray(r, dtype=np.float64)
        ext = r if rot is None else np.full(3, r.max())
        sl, X, Y, Z = self.box(c - ext, c + ext, 2 * self.h)
        inside = sd_ellipsoid(X, Y, Z, c, r, rot) < 0
        cur = self.M[sl]
        for other in (EYE, WING, CLAW, SLIME) + tuple(keep):
            inside = inside & (cur != other)
        cur[inside & (cur != 0)] = mat

    def carve_blob(self, c, r, k=0.5, rot=None):
        c = np.asarray(c, dtype=np.float64)
        r = np.asarray(r, dtype=np.float64)
        ext = r if rot is None else np.full(3, r.max())
        sl, X, Y, Z = self.box(c - ext, c + ext, k + 3 * self.h)
        self.cut(sd_ellipsoid(X, Y, Z, c, r, rot), sl, k)

    def carve_tube(self, pts, rads, k=0.3):
        pts = [np.asarray(p, dtype=np.float64) for p in pts]
        rmax = max(rads)
        sl, X, Y, Z = self.box(np.min(pts, axis=0) - rmax, np.max(pts, axis=0) + rmax, k + 3 * self.h)
        d = None
        for i in range(len(pts) - 1):
            di = sd_round_cone(X, Y, Z, pts[i], pts[i + 1], rads[i], rads[i + 1])
            d = di if d is None else np.minimum(d, di)
        self.cut(d, sl, k)

    def plate(self, origin, u, v, poly, thick, k=0.8, mat=WING, rnd=0.5):
        """A flat plate. poly is in (u, v) coordinates from origin. w = u x v is the normal."""
        origin = np.asarray(origin, dtype=np.float64)
        u = unit(np.asarray(u, dtype=np.float64))
        v = unit(v - u * np.dot(u, v))
        w = np.cross(u, v)
        corners = [origin + u * p[0] + v * p[1] for p in poly]
        lo = np.min(corners, axis=0) - thick
        hi = np.max(corners, axis=0) + thick
        sl, X, Y, Z = self.box(lo, hi, k + 3 * self.h)
        dx = X - origin[0]
        dy = Y - origin[1]
        dz = Z - origin[2]
        U = dx * u[0] + dy * u[1] + dz * u[2]
        Vv = dx * v[0] + dy * v[1] + dz * v[2]
        Wn = dx * w[0] + dy * w[1] + dz * w[2]
        d2 = sd_polygon(U, Vv, poly) + rnd
        qy = np.abs(Wn) - (thick / 2 - rnd)
        d = np.minimum(np.maximum(d2, qy), 0.0) + np.sqrt(np.maximum(d2, 0.0) ** 2 + np.maximum(qy, 0.0) ** 2) - rnd
        self.add(d, sl, k, mat)
        return u, v, w

    def sample(self, p):
        i = np.clip(np.rint((np.asarray(p) - self.lo) / self.h).astype(int), 0, self.n - 1)
        return float(self.F[i[0], i[1], i[2]])


    def front_surface_y(self, x, z):
        """Y of the first surface that a ray from the front (-Y) meets at (x, z)."""
        i = int(np.clip(round((x - self.lo[0]) / self.h), 0, self.n[0] - 1))
        k = int(np.clip(round((z - self.lo[2]) / self.h), 0, self.n[2] - 1))
        col = self.F[i, :, k]
        inside = np.nonzero(col < 0)[0]
        if len(inside) == 0:
            return None
        j = int(inside[0])
        if j == 0:
            return float(self.ax[1][0])
        a, b = float(col[j - 1]), float(col[j])
        return float(self.ax[1][j - 1]) + a / (a - b) * self.h

    def raycast(self, origin, direction, max_dist=60.0):
        """First point inside the surface along a ray, or None."""
        d = unit(np.asarray(direction, dtype=np.float64))
        step = self.h * 0.5
        ts = np.arange(int(max_dist / step)) * step
        P = np.asarray(origin, dtype=np.float64)[None, :] + ts[:, None] * d[None, :]
        idx = np.rint((P - self.lo) / self.h).astype(int)
        ok = np.all((idx >= 0) & (idx < self.n), axis=1)
        vals = np.full(len(ts), BIG, dtype=np.float32)
        vals[ok] = self.F[idx[ok, 0], idx[ok, 1], idx[ok, 2]]
        hit = np.nonzero(vals < 0)[0]
        return None if len(hit) == 0 else P[hit[0]]

    def wrap(self, starts, direction, rads, embed=0.3, k=0.6, mat=FLESH, smooth=3, toward=None):
        """A tube that lies on the surface. Each start point is projected along the ray."""
        pts, out_r = [], []
        for p, r in zip(starts, rads):
            d = unit(np.asarray(toward) - p) if toward is not None else unit(np.asarray(direction, dtype=np.float64))
            hit = self.raycast(p, d)
            if hit is None:
                continue
            pts.append(hit + d * r * embed)
            out_r.append(r)
        if len(pts) >= 2:
            self.tube(pts, out_r, k=k, mat=mat, smooth=smooth)


# ---------------------------------------------------------------------------
# Anatomy. Pose: the standing, hunched pose of assets/brand/character.png.
# Segment lengths follow the character sheet and the rig armature.
# Print changes: the mouthparts lie on the chest, the small-arm claws touch the
# thighs, and both feet join an integrated base. The long-arm hands hang free.
# ---------------------------------------------------------------------------
G = ZG
HIP = {-1: V(-6.5, 6.5, G + 46.0), 1: V(6.5, 6.5, G + 46.0)}
KNEE = {-1: V(-14.5, -3.6, G + 31.7), 1: V(13.5, -2.6, G + 31.0)}
ANKLE = {-1: V(-20.0, 10.4, G + 10.5), 1: V(18.5, 9.8, G + 10.0)}
SHOULDER = {-1: V(-20.5, -9.5, G + 80.5), 1: V(20.0, -9.5, G + 80.0)}
ELBOW = {-1: V(-31.5, 1.0, G + 57.5), 1: V(30.5, 2.0, G + 58.5)}
WRIST = {-1: V(-36.0, -12.5, G + 41.0), 1: V(34.0, -13.0, G + 42.5)}
KNUCKLE = {-1: V(-37.0, -15.8, G + 33.6), 1: V(34.8, -16.3, G + 35.0)}
HEAD = V(0.6, -23.5, G + 87.5)


def rot_to(d):
    """Rotation whose local Z axis points along d."""
    d = unit(np.asarray(d, dtype=np.float64))
    up = V(0, 0, 1) if abs(d[2]) < 0.9 else V(1, 0, 0)
    x = unit(np.cross(up, d))
    y = np.cross(d, x)
    return np.stack([x, y, d], axis=1)


def bulge(f, a, b, t, r_side, r_along, k=1.0, mat=FLESH, offset=None, seg=None):
    """A muscle belly on the segment a to b."""
    c = a + (b - a) * t
    if offset is not None:
        c = c + offset
    f.blob(c, V(r_side, r_side, r_along), k=k, mat=mat, rot=rot_to(b - a), seg=seg)


def drape(f, x0, x1, z0, z1, r0, r1, n=7, wave=0.3, phase=0.0, embed=0.3, k=0.45, mat=FLESH):
    """A tapered tube that lies on the front surface, from top to bottom."""
    pts, rads = [], []
    for i in range(n):
        t = i / (n - 1)
        z = z0 + (z1 - z0) * t
        x = x0 + (x1 - x0) * t + wave * math.sin(phase + t * 5.0)
        r = r0 + (r1 - r0) * t
        y = f.front_surface_y(x, z)
        if y is None:
            continue
        sink = embed if i < n - 1 else 1.15     # the tip sinks into the surface
        pts.append(V(x, y + r * sink, z))
        rads.append(r)
    f.tube(pts, rads, k=k, mat=mat, smooth=2)


def build_torso(f):
    torso = f.seg_id("torso", V(0, 6.5, G + 47), V(0, -10.9, G + 79.7), "torso")
    f.blob(V(0, 6.5, G + 47.0), V(9.5, 7.5, 7.5), k=0, mat=FLESH, seg=torso)               # pelvis
    f.blob(V(0, 2.0, G + 56.5), V(8.2, 7.6, 8.5), k=3.0, mat=FLESH, seg=torso)             # belly
    f.blob(V(0, -4.5, G + 67.5), V(12.0, 10.0, 11.0), k=3.0, mat=FLESH, rot=rot_xyz(math.radians(28), 0, 0), seg=torso)
    f.tube([V(-16.0, -9.5, G + 79.5), V(16.0, -9.5, G + 79.2)], [5.6, 5.3], k=3.0, mat=FLESH, seg=torso)   # shoulder girdle
    f.blob(V(-0.8, -1.5, G + 82.5), V(13.0, 9.8, 8.8), k=3.0, mat=FLESH, seg=torso)        # hump, rises behind the head
    f.blob(SHOULDER[-1], V(6.4, 6.0, 5.8), k=2.0, mat=FLESH, seg=torso)                    # right shoulder, larger
    f.blob(SHOULDER[1], V(5.6, 5.4, 5.2), k=2.0, mat=FLESH, seg=torso)


def paint_regions(f):
    """Flush colour and texture regions. They add no volume."""
    f.paint(V(0, -6.5, G + 55.0), V(7.0, 6.0, 9.5), BELLY)                 # segmented belly, front
    f.paint(V(-9.0, 2.0, G + 57.0), V(4.5, 7.5, 9.0), CHITIN)              # right flank
    f.paint(V(-0.5, 8.5, G + 80.5), V(7.5, 6.5, 11.5), PLATE)              # upper back plates, between the wings
    f.paint(V(0, 13.5, G + 53.0), V(6.5, 6.0, 10.5), PLATE)                # lower back plate
    f.paint(V(-3.0, -19.0, G + 99.5), V(8.5, 8.0, 4.5), CHITIN)            # crown
    f.paint(SHOULDER[-1] + V(-0.5, 2.0, 4.5), V(6.5, 6.0, 4.0), CHITIN)    # right shoulder
    f.paint(SHOULDER[1] + V(1.0, 2.5, 4.3), V(4.2, 4.0, 3.2), CHITIN)      # left shoulder
    f.paint(V(12.5, -1.5, G + 39.0), V(3.4, 3.8, 4.8), CHITIN)             # patch on the flesh thigh
    f.paint(V(-34.5, -7.0, G + 48.5), V(3.0, 3.4, 5.0), CHITIN)            # patch on the right forearm
    for s in (-1, 1):                                                      # bruised lids
        f.paint(V(s * 7.3 + 0.5, -36.0, G + 83.5), V(6.6, 3.0, 4.4), BRUISE, keep=(EYE,))


def build_leg(f, s):
    chitin = s < 0
    mat = CHITIN if chitin else FLESH
    hip, knee, ankle = HIP[s], KNEE[s], ANKLE[s]
    thigh = f.seg_id("thigh", hip, knee, "chitin" if chitin else "limb")
    shin = f.seg_id("shin", knee, ankle, "chitin" if chitin else "limb")
    f.tube([hip, knee], [5.5, 4.1], k=2.0, mat=mat, seg=thigh)
    bulge(f, hip, knee, 0.42, 5.5, 6.5, k=1.2, mat=mat, offset=V(s * 0.8, -0.8, 0), seg=thigh)
    f.blob(knee, V(4.6, 4.6, 4.6) if chitin else V(4.3, 4.4, 4.2), k=1.0, mat=mat)
    f.tube([knee, ankle], [3.9, 2.7], k=1.0, mat=mat, seg=shin)
    bulge(f, knee, ankle, 0.3, 4.2, 5.8, k=0.9, mat=mat, offset=V(0, 1.6, 0), seg=shin)
    f.blob(ankle, V(3.1, 3.1, 3.0), k=0.6, mat=mat)
    heel = V(ankle[0], ankle[1] + 3.2, G + 2.4)
    ball = V(ankle[0] + s * 2.8, ankle[1] - 10.0, G + 2.3)
    f.tube([ankle, heel], [2.8, 2.7], k=0.8, mat=mat)
    f.tube([ankle, ball], [2.8, 2.7], k=0.8, mat=mat)
    f.tube([heel, ball], [2.6, 2.6], k=0.8, mat=mat)
    fwd = unit(V(s * 0.3, -1.0, 0))
    if chitin:
        for ang, ln in ((-36, 6.4), (0, 7.4), (36, 6.2)):
            a = math.radians(ang) * s
            d = V(fwd[0] * math.cos(a) - fwd[1] * math.sin(a), fwd[0] * math.sin(a) + fwd[1] * math.cos(a), 0)
            mid = ball + d * ln * 0.55 + V(0, 0, 1.6)
            tip = ball + d * ln + V(0, 0, -(ball[2] - G) - 0.4)
            f.tube([ball, mid], [2.4, limb_r(2.0)], k=0.6, mat=CHITIN)
            f.blob(mid, V(2.2, 2.2, 2.0), k=0.3, mat=CHITIN)
            f.tube([mid, tip], [limb_r(1.9), tip_r(1.0)], k=0.3, mat=CLAW)
        spur = heel + V(-s * 1.2, 4.8, -(heel[2] - G) - 0.3)
        f.tube([heel, spur], [2.2, tip_r(1.1)], k=0.5, mat=CLAW)
    else:
        for off in (-2.9, -1.0, 1.0, 2.9):
            root = ball + V(off * 0.95, 0, 0)
            tip = root + fwd * (4.6 - abs(off) * 0.4) + V(0, 0, -(ball[2] - G) - 0.2)
            f.tube([root, tip], [limb_r(1.8), tip_r(1.2)], k=0.5, mat=FLESH)


def build_arm(f, s):
    sh, el, wr, kn = SHOULDER[s], ELBOW[s], WRIST[s], KNUCKLE[s]
    upper = f.seg_id("upper_arm", sh, el, "limb")
    fore = f.seg_id("forearm", el, wr, "limb")
    f.tube([sh, el], [4.0, 2.9], k=1.5, mat=FLESH, seg=upper)
    bulge(f, sh, el, 0.36, 4.3, 6.5, k=1.0, offset=V(0, -0.9, 0.4), seg=upper)
    f.blob(el, V(3.4, 3.4, 3.4), k=0.8, mat=FLESH)
    f.tube([el, el + V(s * 1.6, 2.2, 1.4)], [2.7, 1.9], k=0.6, mat=FLESH)                    # elbow point, upward
    f.tube([el, wr], [3.0, limb_r(2.0)], k=0.8, mat=FLESH, seg=fore)
    bulge(f, el, wr, 0.28, 3.5, 5.2, k=0.9, offset=V(s * 0.6, 0, 0), seg=fore)
    f.blob(wr, V(2.7, 2.6, 2.6), k=0.6, mat=FLESH)
    down = unit(kn - wr)
    side = V(s, 0, 0)                           # knuckle line, away from the body centre
    curl = unit(V(-s * 0.35, 0.9, 0.0))         # claws hook toward the palm
    f.blob((wr + kn) / 2 + V(0, 0.3, 0), V(5.0, 2.3, 5.0), k=0.8, mat=FLESH)   # palm
    for i, (off, ang, ln) in enumerate(((1.5, 40, 0.86), (0.5, 14, 1.0), (-0.5, -10, 1.06), (-1.5, -34, 0.9))):
        a = math.radians(ang)
        d = unit(down * math.cos(a) + side * math.sin(a))
        K = kn + side * off * 2.8
        f.tube([wr + side * off * 1.1, K], [limb_r(1.5), limb_r(1.7)], k=0.6, mat=FLESH)      # tendon on the back of the hand
        J = K + unit(d + curl * 0.12) * 5.4 * ln
        P = J + unit(d * 0.9 + curl * 0.35) * 4.5 * ln
        M = P + unit(d * 0.85 + curl * 0.45) * 3.0 * ln
        T = P + unit(d * 0.45 + curl * 0.95) * 6.0 * ln
        f.tube([K, J, P], [limb_r(1.8), limb_r(1.74), limb_r(1.74)], k=0.5, mat=FLESH)
        f.blob(K, V(1.0, 1.0, 1.0) * (limb_r(1.8) + 0.4), k=0.4, mat=FLESH)
        f.blob(J, V(1.0, 1.0, 1.0) * (limb_r(1.74) + 0.35), k=0.3, mat=FLESH)
        f.tube([P, M, T], [limb_r(1.7), limb_r(1.4) if PRINT else 0.9, tip_r(1.0)], k=0.3, mat=CLAW, smooth=4)
    d = unit(down * 0.55 - side * 0.85)         # thumb, toward the body centre
    B = wr + down * 2.2 - side * 2.8
    J = B + d * 4.8
    P = J + unit(d * 0.8 + curl * 0.4 + down * 0.4) * 3.8
    T = P + unit(down * 0.5 + curl * 0.9) * 5.2
    f.tube([B, J, P], [limb_r(1.9), limb_r(1.8), limb_r(1.74)], k=0.5, mat=FLESH)
    f.blob(J, V(2.0, 2.0, 1.9), k=0.3, mat=FLESH)
    f.tube([P, T], [limb_r(1.7), tip_r(1.0)], k=0.3, mat=CLAW)


def build_small_arm(f, s):
    root = V(s * 8.5, -12.0, G + 62.5)
    elbow = V(s * 14.0, -16.5, G + 53.0) if s < 0 else V(s * 13.4, -16.0, G + 53.8)
    wrist = V(s * 11.5, -10.5, G + 47.0) if s < 0 else V(s * 11.0, -10.2, G + 47.6)
    f.tube([root, elbow], [2.4, limb_r(1.9)], k=1.0, mat=FLESH)
    f.blob(elbow + V(0, 0, 0.5), V(2.1, 2.1, 1.9), k=0.4, mat=FLESH)
    f.tube([elbow, wrist], [limb_r(1.9), limb_r(1.74)], k=0.5, mat=FLESH)
    f.blob(wrist + V(0, 0.8, -0.4), V(2.5, 2.4, 2.0), k=0.5, mat=FLESH)
    for off in (-1.9, 0.0, 1.9):
        a = wrist + V(off, 1.2, -0.8)
        start = V(a[0] + off * 0.4, -40.0, wrist[2] - 4.2 - abs(off) * 0.3)
        hit = f.raycast(start, V(0, 1, 0))
        b = hit + V(0, 1.2, 0) if hit is not None else a + V(0, 5.0, -4.0)
        f.tube([a, b], [limb_r(1.74), tip_r(1.1)], k=0.35, mat=CLAW)


def build_head(f):
    c = HEAD
    head = f.seg_id("head", c, c + V(0, 0, 1), "head")
    dewlap = f.seg_id("dewlap", V(0, -25.5, G + 77.0), V(0, -10.5, G + 62.0), "dewlap")
    f.tube([V(0, -10.5, G + 80.0), c], [9.0, 9.5], k=2.5, mat=FLESH, seg=head)               # neck
    f.blob(c, V(13.8, 12.6, 12.6), k=2.0, mat=FLESH, seg=head)                               # skull
    f.blob(V(-8.0, -26.0, G + 78.6), V(6.4, 7.2, 6.2), k=2.0, mat=FLESH, seg=head)           # jowls
    f.blob(V(7.6, -26.0, G + 78.9), V(6.0, 6.9, 5.9), k=2.0, mat=FLESH, seg=head)
    f.tube([V(0, -25.5, G + 77.0), V(0, -10.5, G + 62.0)], [7.0, 6.2], k=2.5, mat=FLESH, seg=dewlap)
    f.tube([V(0.5, -34.6, G + 90.0), V(0.4, -36.6, G + 84.5), V(0.3, -36.3, G + 80.0)], [2.0, 2.4, 2.5], k=1.0, mat=FLESH, smooth=3)
    f.eyes = []
    for s, scale in ((-1, 1.12), (1, 0.93)):
        e = V(s * 7.3 + 0.5, -32.4, G + 83.5)
        f.eyes.append((e, scale))
        f.carve_blob(e + V(0, -1.6, 0), V(4.8, 3.0, 3.2) * scale, k=0.7)
        f.blob(e, V(4.0, 3.7, 3.5) * scale, k=0, mat=EYE)

        def arc(a, b, deg0, deg1, n):
            return [V(e[0] + s * math.cos(math.radians(deg0 + (deg1 - deg0) * i / (n - 1))) * a * scale, -56.0,
                      e[2] + math.sin(math.radians(deg0 + (deg1 - deg0) * i / (n - 1))) * b * scale) for i in range(n)]

        # Heavy lids make the eye narrow. The outer folds repeat the shape.
        f.wrap(arc(5.7, 3.0, 5, 175, 7), V(0, 1, 0), [1.2, 1.5, 1.8, 1.9, 1.8, 1.5, 1.2], embed=0.05, k=0.7)     # heavy upper lid
        f.wrap(arc(5.5, 3.5, 190, 350, 7), V(0, 1, 0), [1.0, 1.1, 1.2, 1.25, 1.2, 1.1, 1.0], embed=0.25, k=0.6)   # lower lid
        f.wrap(arc(8.0, 6.2, 25, 155, 7), V(0, 1, 0), [1.1, 1.3, 1.4, 1.4, 1.4, 1.3, 1.1], embed=0.45, k=0.8)
        f.wrap(arc(7.6, 6.0, 215, 325, 5), V(0, 1, 0), [1.0, 1.2, 1.3, 1.2, 1.0], embed=0.5, k=0.8)
    # Mouthparts: tapered folds that hang from the face and lie on the dewlap and chest.
    for s in (-1, 1):
        drape(f, s * 1.9 + 0.3, s * 3.0, G + 80.0, G + 56.0 + s * 1.5, 2.3, limb_r(1.74), n=9, phase=s * 1.0)
        drape(f, s * 6.3 + 0.3, s * 7.2, G + 78.6, G + 63.5 + s * 1.4, 2.0, limb_r(1.74), n=7, phase=2.0 + s)
        drape(f, s * 10.4 + 0.3, s * 11.0, G + 77.5, G + 68.5 - s * 1.2, 1.9, limb_r(1.74), n=5, phase=4.0 + s)
    drape(f, -4.3, -4.9, G + 77.0, G + 67.0, 1.8, limb_r(1.74), n=5, phase=0.5)


def build_wing(f, s):
    if s < 0:
        root, tip_dir, length, width = V(-8.0, 3.0, G + 87.0), unit(V(-0.70, 0.25, 0.66)), 27.0, 15.0
        normal_hint = V(-0.2, -0.95, 0.1)
    else:
        root, tip_dir, length, width = V(7.5, 3.0, G + 86.5), unit(V(0.78, 0.25, 0.57)), 19.5, 11.5
        normal_hint = V(0.2, -0.95, 0.1)
    u = tip_dir
    w = unit(normal_hint - u * np.dot(u, normal_hint))
    v = np.cross(w, u)                     # in-plane, toward the upper edge
    if v[2] < 0:
        v = -v
    L, W = length, width
    poly = [(-2.0, -2.0), (-2.0, 2.2), (0.16 * L, 0.62 * W), (0.42 * L, 0.92 * W), (0.70 * L, 0.80 * W), (0.92 * L, 0.42 * W), (L, 0.05 * W),
            (0.86 * L, -0.03 * W), (0.78 * L, 0.17 * W), (0.62 * L, -0.08 * W), (0.52 * L, 0.14 * W), (0.36 * L, -0.09 * W),
            (0.27 * L, 0.09 * W), (0.12 * L, -0.07 * W)]
    thick = MIN_WING_T / SCALE_GUESS + 0.15
    f.plate(root, u, v, poly, thick, k=0.6, mat=WING)
    half = thick / 2
    P = lambda a, b: root + u * a * L + v * b * W
    f.tube([P(-0.05, 0.1), P(0.2, 0.55), P(0.45, 0.86), P(0.72, 0.76), P(0.96, 0.2)],
           [half + 1.0, half + 0.8, half + 0.65, half + 0.55, half + 0.4], k=0.4, mat=WING, smooth=3)
    for end in ((0.84, 0.05), (0.60, 0.0), (0.34, 0.0)):
        f.tube([P(0.02, 0.15), P(end[0] * 0.6, 0.25 + end[1]), P(end[0], end[1] + 0.05)], [half + 0.55, half + 0.5, half + 0.4], k=0.3, mat=WING, smooth=2)
    f.tube([root + V(0, -3.0, -3.5), root + u * 3.0], [4.0, 3.0], k=1.5, mat=FLESH)  # root fillet


def build_base(f):
    # The front lobes reach forward of the head, so the centre of mass stays well inside the footprint.
    lobes = [(0, 2, 33, 21), (-22, 2, 14, 17), (21, 2, 13, 16.5), (0, 13, 15, 10), (-8, -15, 15, 11), (11, -16, 11, 9), (2, -13, 17, 10)]
    for x, y, rx, ry in lobes:
        f.blob(V(x, y, 1.0), V(rx, ry, 2.2), k=3.5, mat=SLIME)


# ---------------------------------------------------------------------------
# Surface detail. One material prints no colour, so texture is relief.
# ---------------------------------------------------------------------------
def mm(value):
    return value / SCALE_GUESS


def worley_gap(x, y, z, cell):
    """F2 - F1 of a cellular noise. Small values are the borders between cells."""
    gx, gy, gz = np.floor(x / cell), np.floor(y / cell), np.floor(z / cell)
    f1 = np.full(x.shape, 1e9)
    f2 = np.full(x.shape, 1e9)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                cx, cy, cz = gx + dx, gy + dy, gz + dz
                h1 = np.sin(cx * 127.1 + cy * 311.7 + cz * 74.7) * 43758.5453
                h2 = np.sin(cx * 269.5 + cy * 183.3 + cz * 246.1) * 43758.5453
                h3 = np.sin(cx * 113.5 + cy * 271.9 + cz * 124.6) * 43758.5453
                px = (cx + h1 - np.floor(h1)) * cell
                py = (cy + h2 - np.floor(h2)) * cell
                pz = (cz + h3 - np.floor(h3)) * cell
                d = np.sqrt((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2)
                closer = d < f1
                f2 = np.where(closer, f1, np.minimum(f2, d))
                f1 = np.where(closer, d, f1)
    return f2 - f1


def add_detail(f):
    near = np.nonzero(np.abs(f.F) < 1.5)
    x = f.ax[0][near[0]].astype(np.float64)
    y = f.ax[1][near[1]].astype(np.float64)
    z = f.ax[2][near[2]].astype(np.float64)
    m = f.M[near]
    sg = f.S[near]
    disp = np.zeros(x.shape, dtype=np.float64)
    two_pi = 2 * math.pi
    flesh = (m == FLESH) | (m == BRUISE)

    # Soft organic lumps on all flesh and slime.
    lump = np.sin(x * 0.61 + 1.3) * np.sin(y * 0.53 + 0.4) * np.sin(z * 0.57 + 2.1) + 0.6 * np.sin(x * 1.13 + z * 0.71 + 0.9) * np.sin(y * 1.07 - z * 0.4)
    disp += np.where(flesh | (m == SLIME), mm(0.16) * lump, 0.0)

    for sid, (name, a, b, kind) in f.segs.items():
        sel = (sg == sid)
        if not sel.any():
            continue
        xs, ys, zs = x[sel], y[sel], z[sel]
        if kind in ("limb", "chitin"):
            u = unit(b - a)
            length = float(np.linalg.norm(b - a))
            px, py, pz = xs - a[0], ys - a[1], zs - a[2]
            t = px * u[0] + py * u[1] + pz * u[2]
            e1 = unit(np.cross(u, V(0, 0, 1) if abs(u[2]) < 0.9 else V(1, 0, 0)))
            e2 = np.cross(u, e1)
            theta = np.arctan2(px * e2[0] + py * e2[1] + pz * e2[2], px * e1[0] + py * e1[1] + pz * e1[2])
            if kind == "limb":
                rings = np.cos(two_pi * t / 2.6) * (np.exp(-(t / 2.6) ** 2) + np.exp(-((t - length) / 2.6) ** 2))
                fibres = np.cos(5 * theta + 0.5 * np.sin(t * 0.45)) * np.sin(math.pi * np.clip(t / length, 0, 1))
                d = mm(0.20) * rings + mm(0.24) * fibres
                d = np.where(flesh[sel], d, 0.0)
            else:
                phase = (t / 4.2) % 1.0                                 # plate edges along the limb
                d = -mm(0.45) * np.exp(-((phase - 0.5) / 0.08) ** 2) + mm(0.14) * np.cos(3 * theta)
            disp[sel] += d
        elif kind in ("torso", "dewlap"):
            wave = zs + 0.35 * ys + 1.7 * np.sin(xs * 0.42) + 0.9 * np.sin(ys * 0.31 + 1.0)
            fade = 0.55 + 0.45 * np.sin(xs * 0.23 + zs * 0.17)           # folds come and go
            d = mm(0.27) * np.cos(two_pi * wave / (3.6 if kind == "torso" else 3.0)) * fade
            disp[sel] += np.where(flesh[sel], d, 0.0)
        elif kind == "head":
            d = np.zeros(xs.shape)
            front = ys < a[1] + 2.0
            r_eye = np.full(xs.shape, 1e9)
            for e, scale in f.eyes:
                r_eye = np.minimum(r_eye, np.sqrt(((xs - e[0]) / 1.3) ** 2 + (zs - e[2]) ** 2) / scale)
            window = np.clip((r_eye - 5.5) / 2.0, 0, 1) * np.clip((12.5 - r_eye) / 3.0, 0, 1)
            d += np.where(front, mm(0.28) * np.cos(two_pi * (r_eye - 5.5) / 3.2) * window, 0.0)
            top = np.clip((zs - (a[2] + 4.5)) / 3.0, 0, 1)
            d += np.where(front, mm(0.24) * np.cos(two_pi * (xs + 0.9 * np.sin(zs * 0.5)) / 3.4) * np.maximum(top, 0.35) * (1 - window), 0.0)
            d += np.where(~front, mm(0.18) * np.cos(two_pi * (zs + 1.2 * np.sin(xs * 0.4)) / 3.8), 0.0)
            disp[sel] += np.where(flesh[sel], d, 0.0)

    # Chitin patches: a cell pattern with grooves between the plates.
    chit = (m == CHITIN) & ~np.isin(sg, [sid for sid, seg in f.segs.items() if seg[3] == "chitin"])
    if chit.any():
        gap = worley_gap(x[chit], y[chit], z[chit], 3.4)
        disp[chit] += mm(0.12) - mm(0.50) * (1 - np.clip(gap / 0.9, 0, 1)) ** 2
    # Belly and back plates: horizontal segments, as on the character sheet.
    band = (m == BELLY) | (m == PLATE)
    if band.any():
        phase = ((z[band] + 0.22 * np.abs(x[band])) / 4.4) % 1.0
        disp[band] += mm(0.14) - mm(0.50) * np.exp(-((phase - 0.5) / 0.09) ** 2)

    f.F[near] = (f.F[near] - disp).astype(np.float32)
    f.shade = np.zeros(f.n, dtype=np.float32)        # relief depth, for crease shading in the vertex colours
    f.shade[near] = disp.astype(np.float32)


def add_bristle_dimples(f):
    """Pilot dimples for hand-implanted fibres. Returns positions and outward directions in design units."""
    head = HEAD
    hump = V(-0.8, -1.5, G + 82.5)
    chest = V(0, -4.5, G + 67.5)
    spots = [(head, d) for d in ((-0.6, -0.1, 0.8), (-0.2, 0.3, 0.93), (0.3, -0.1, 0.95), (0.65, 0.2, 0.73), (0, 0.75, 0.66),
                                 (-0.8, 0.4, 0.45), (0.85, 0.45, 0.28), (-0.95, 0.1, 0.3), (0.5, 0.8, 0.33), (-0.45, 0.85, 0.28))]
    for s in (-1, 1):
        spots += [(SHOULDER[s], d) for d in ((s * 0.5, 0.2, 0.85), (s * 0.85, 0.3, 0.42), (s * 0.3, 0.7, 0.65))]
        spots += [((SHOULDER[s] + ELBOW[s]) / 2, d) for d in ((s * 0.9, 0.3, 0.3), (s * 0.7, -0.6, 0.4))]
        spots += [((HIP[s] + KNEE[s]) / 2, d) for d in ((s * 0.9, 0.2, 0.3), (s * 0.5, -0.8, 0.3))]
        spots += [(chest, (s * 0.95, -0.15, 0.25))]
    spots += [(hump, d) for d in ((-0.5, 0.75, 0.45), (0.5, 0.75, 0.45), (-0.25, 0.95, 0.1), (0.3, 0.95, -0.1))]
    out = []
    radius, depth, need = mm(0.6), mm(2.0), mm(4.0)
    for centre, d in spots:
        d = unit(V(*d))
        hit = f.raycast(centre + d * 45.0, -d)
        if hit is None or f.sample(hit - d * need) > -0.3:
            continue                      # too thin behind this point
        f.carve_tube([hit + d * 0.8, hit - d * depth], [radius, radius], k=0.0)
        out.append((hit, d))
    return out


def build(voxel_mm, detail=True, variant="print"):
    global PRINT
    PRINT = variant == "print"
    h = voxel_mm / SCALE_GUESS
    f = Field((-52.0, -48.0, -1.2), (52.0, 34.0, 116.0), h)
    build_torso(f)
    for s in (-1, 1):
        build_leg(f, s)
    build_head(f)
    for s in (-1, 1):
        build_arm(f, s)
        build_small_arm(f, s)
        build_wing(f, s)
    paint_regions(f)
    if variant == "print":
        build_base(f)                     # the web variant has no base and no dimples
    f.dimples = []
    if detail:
        add_detail(f)
        if variant == "print":
            f.dimples = add_bristle_dimples(f)
    # Flat underside: keep z > 0 only.
    Z = f.ax[2][None, None, :]
    f.F = np.maximum(f.F, -Z).astype(np.float32)
    return f


# ---------------------------------------------------------------------------
# Field to Blender mesh
# ---------------------------------------------------------------------------

def srgb_to_linear(hexcol):
    c = np.array([int(hexcol[i:i + 2], 16) / 255.0 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def shade_colours(f, pts, idx, mats, lut):
    """Vertex colours with baked shading: dark creases, ambient occlusion, and mottled tissue.

    A flat palette colour looks like plastic in a real-time scene. The field already knows
    where the grooves are and how enclosed each point is, so the shading costs no texture.
    """
    colours = lut[mats].copy()
    hi = np.array(f.n) - 1
    colour_fn = getattr(f, "colour_fn", None)        # optional: colours projected from artwork

    def at(grid, p):
        i = np.clip(np.rint(p).astype(int), 0, hi)
        return grid[i[:, 0], i[:, 1], i[:, 2]]

    # Outward normal from the field gradient.
    grad = np.stack([at(f.F, pts + e) - at(f.F, pts - e) for e in np.eye(3)], axis=1).astype(np.float64)
    normal = grad / np.maximum(np.linalg.norm(grad, axis=1, keepdims=True), 1e-9)
    # Ambient occlusion: how much free space lies along the normal at two distances.
    occlusion = np.zeros(len(pts))
    for reach in (1.3, 3.2):
        occlusion += np.clip(at(f.F, pts + normal * (reach / f.h)) / reach, 0.0, 1.0)
    occlusion = 0.42 + 0.58 * (occlusion / 2)
    if colour_fn is not None:
        occlusion = 0.72 + 0.28 * (occlusion - 0.42) / 0.58       # the artwork is already shaded
    # Creases: the relief depth is negative in a groove.
    crease = np.clip(1.0 + 0.6 * at(f.shade, pts) / mm(0.3), 0.42, 1.15) if hasattr(f, "shade") else 1.0

    xyz = pts * f.h + f.lo
    x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    mottle = 0.5 + 0.5 * (np.sin(x * 0.37 + 1.1) * np.sin(y * 0.41 + 0.3) * np.sin(z * 0.33 + 2.0)
                          + 0.5 * np.sin(x * 0.9 + z * 0.8) * np.sin(y * 0.85 - z * 0.3))
    flesh = mats == FLESH
    if colour_fn is not None:
        colours[flesh, :3] = colour_fn(xyz[flesh], normal[flesh])
    else:
        blend = (np.clip(mottle, 0, 1) * 0.45)[:, None]
        colours[flesh, :3] = (colours[flesh, :3] * (1 - blend[flesh]) + lut[BRUISE, :3] * blend[flesh])
    wing = mats == WING                                 # thin membrane lighter, veins darker
    colours[wing, :3] *= (0.78 + 0.3 * np.clip(mottle[wing], 0, 1))[:, None]

    shade = (occlusion * crease)[:, None]
    keep = (mats == EYE)[:, None]
    colours[:, :3] = np.where(keep, colours[:, :3], colours[:, :3] * shade)
    return colours.astype(np.float32)


def field_to_mesh(f, name="Brundlefly"):
    grid = vdb.FloatGrid(BIG)
    grid.copyFromArray(np.ascontiguousarray(f.F))
    pts, tris, quads = grid.convertToPolygons(0.0, 0.0)
    verts = pts.astype(np.float64) * f.h + f.lo
    idx = np.clip(np.rint(pts).astype(int), 0, f.n - 1)
    mats = f.M[idx[:, 0], idx[:, 1], idx[:, 2]]

    zmin, zmax = verts[:, 2].min(), verts[:, 2].max()
    scale = HEIGHT_MM / (zmax - zmin)
    f.mesh_zmin = float(zmin)                         # callers convert their own points with this
    verts[:, 2] -= zmin
    verts *= scale
    to_mm = lambda p: [round(float(c), 3) for c in (np.asarray(p, dtype=np.float64) - V(0, 0, zmin)) * scale]
    # Positions that the website uses: eyeballs, anchors, and the point under the pelvis.
    f.site_mm = {
        "eyes": [{"centre_mm": to_mm(e + V(0, -0.2, 0)), "radii_mm": [round(r * s_eye * scale, 3) for r in (4.0, 3.7, 3.5)]} for e, s_eye in f.eyes],
        "anchors": {"anchor-face": to_mm(HEAD + V(0, -13.5, -4.0)), "anchor-left-hand": to_mm(KNUCKLE[-1]), "anchor-right-hand": to_mm(KNUCKLE[1])},
        "pelvis_xy_mm": [round(float(c * scale), 3) for c in (0.0, 6.5)],
    }
    f.bristles_mm = [{"position_mm": [round(float(c), 2) for c in (p - V(0, 0, zmin)) * scale],
                      "direction": [round(float(c), 3) for c in d]} for p, d in getattr(f, "dimples", [])]

    me = bpy.data.meshes.new(name)
    nq, nt = len(quads), len(tris)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    me.loops.add(nq * 4 + nt * 3)
    me.polygons.add(nq + nt)
    me.loops.foreach_set("vertex_index", np.concatenate([quads.ravel(), tris.ravel()]).astype(np.int32))
    starts = np.concatenate([np.arange(nq) * 4, nq * 4 + np.arange(nt) * 3]).astype(np.int32)
    me.polygons.foreach_set("loop_start", starts)
    me.update()
    me.validate()

    lut = np.zeros((256, 4), dtype=np.float32)
    lut[:, 3] = 1.0
    for mid, hexcol in PALETTE.items():
        lut[mid, :3] = srgb_to_linear(hexcol)
    lut[10:, :3] = lut[FLESH, :3]
    colours = shade_colours(f, pts, idx, mats, lut)
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    col.data.foreach_set("color", colours.ravel())
    me.color_attributes.active_color = col

    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)

    bm = bmesh.new()
    bm.from_mesh(me)
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    # Keep the largest shell only, and report the rest.
    seen = set()
    shells = []
    for vert in bm.verts:
        if vert.index in seen:
            continue
        stack, comp = [vert], []
        while stack:
            cur = stack.pop()
            if cur.index in seen:
                continue
            seen.add(cur.index)
            comp.append(cur)
            stack.extend(e.other_vert(cur) for e in cur.link_edges)
        shells.append(comp)
    shells.sort(key=len, reverse=True)
    extra = [len(s) for s in shells[1:]]
    for comp in shells[1:]:
        bmesh.ops.delete(bm, geom=comp, context="VERTS")
    bmesh.ops.triangulate(bm, faces=bm.faces)
    volume = bm.calc_volume(signed=True)
    bm.to_mesh(me)
    bm.free()
    me.update()

    mat = bpy.data.materials.new("BrundleflyVertexColour")
    mat.use_nodes = True
    nt_ = mat.node_tree
    bsdf = next(n for n in nt_.nodes if n.type == "BSDF_PRINCIPLED")
    attr = nt_.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt_.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.42      # wet tissue, not matte plastic
    me.materials.append(mat)
    return ob, scale, volume, extra


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--voxel", type=float, default=0.2, help="voxel size in millimetres")
    ap.add_argument("--no-detail", action="store_true", help="skip the surface relief and the bristle dimples")
    ap.add_argument("--variant", choices=("print", "web"), default="print", help="web: no base, no dimples")
    args, _ = ap.parse_known_args(argv)
    os.makedirs(args.out, exist_ok=True)

    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 0.001
    sc.unit_settings.length_unit = "MILLIMETERS"

    f = build(args.voxel, detail=not args.no_detail, variant=args.variant)
    t1 = time.time()
    ob, scale, volume, extra = field_to_mesh(f)
    d = ob.dimensions
    stats = {
        "voxel_mm": args.voxel,
        "grid": [int(n) for n in f.n],
        "scale_mm_per_unit": round(float(scale), 4),
        "dimensions_mm": [round(float(d.x), 2), round(float(d.y), 2), round(float(d.z), 2)],
        "volume_cm3": round(volume / 1000.0, 2),
        "vertices": len(ob.data.vertices),
        "triangles": len(ob.data.polygons),
        "extra_shells_removed": extra,
        "seconds_field": round(t1 - t0, 1),
        "seconds_total": round(time.time() - t0, 1),
    }
    if args.variant == "print" and abs(scale - SCALE_GUESS) / SCALE_GUESS > 0.005:
        raise SystemExit(f"SCALE_GUESS is {SCALE_GUESS}, but the build scale is {scale:.4f}. Update SCALE_GUESS: the minimum sizes depend on it.")
    stats["site"] = f.site_mm
    stats["bristle_dimples"] = len(f.bristles_mm)
    with open(os.path.join(args.out, "bristle-map.json"), "w") as fh:
        json.dump({"units": "mm", "dimple_diameter_mm": 1.2, "dimple_depth_mm": 2.0, "dimples": f.bristles_mm}, fh, indent=1)
    print("BUILD " + json.dumps(stats))
    with open(os.path.join(args.out, "build-stats.json"), "w") as fh:
        json.dump(stats, fh, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.out, "brundlefly-work.blend"), compress=True)


if __name__ == "__main__":
    main()
