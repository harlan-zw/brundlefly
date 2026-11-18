"""Measure thin features of an STL with a voxel distance transform.

Python is used here because trimesh and scipy have no TypeScript equivalent.
Run in an isolated environment:
  uv run --no-project --with trimesh --with scipy --with networkx --with numpy \
    python check_thickness.py /abs/model.stl /abs/report.json

Method: a morphological opening. A region that disappears when the solid is eroded by r
and grown back by r is thinner than 2 r. The report lists the volume of such regions.
"""
import json
import sys

import numpy as np
import trimesh
from scipy import ndimage
from scipy.spatial import ConvexHull

PITCH = 0.25                                  # millimetres
CHECKS = {"tip_1.5mm": 0.75, "limb_2.5mm": 1.25, "wall_1.6mm": 0.8}


def stability(mesh):
    """Centre of mass against the footprint on the bed. The margin is positive when the figure stands."""
    com = mesh.center_mass
    foot = mesh.vertices[mesh.vertices[:, 2] < 0.05][:, :2]
    hull = foot[ConvexHull(foot).vertices]            # counter-clockwise
    margins = []
    for i in range(len(hull)):
        a, b = hull[i], hull[(i + 1) % len(hull)]
        edge = b - a
        outward = np.array([edge[1], -edge[0]]) / np.linalg.norm(edge)
        margins.append(-float(np.dot(com[:2] - a, outward)))
    margin = min(margins)
    return {
        "centre_of_mass_mm": [round(float(c), 2) for c in com],
        "footprint_x_mm": [round(float(foot[:, 0].min()), 1), round(float(foot[:, 0].max()), 1)],
        "footprint_y_mm": [round(float(foot[:, 1].min()), 1), round(float(foot[:, 1].max()), 1)],
        "margin_to_footprint_edge_mm": round(margin, 2),
        "tip_angle_degrees": round(float(np.degrees(np.arctan2(margin, com[2]))), 1),
        "stands": bool(margin > 0),
    }


def main():
    stl, out = sys.argv[1], sys.argv[2]
    mesh = trimesh.load(stl)
    vox = mesh.voxelized(PITCH).fill()
    solid = np.pad(vox.matrix, 6)
    origin = vox.translation - 6 * PITCH
    inside = ndimage.distance_transform_edt(solid) * PITCH
    report = {"file": stl, "pitch_mm": PITCH, "solid_volume_cm3": round(float(solid.sum()) * PITCH ** 3 / 1000, 2),
              "stability": stability(mesh), "checks": {}}
    for name, r in CHECKS.items():
        core = inside > r
        regrown = ndimage.distance_transform_edt(~core) * PITCH <= r + PITCH * 0.87
        thin = solid & ~regrown
        # Ignore the one-voxel skin that rounding leaves on every convex edge.
        thin = ndimage.binary_opening(thin, iterations=1)
        labels, count = ndimage.label(thin)
        clusters = []
        if count:
            sizes = ndimage.sum(thin, labels, range(1, count + 1))
            for idx in np.argsort(sizes)[::-1][:8]:
                if sizes[idx] * PITCH ** 3 < 0.5:
                    continue
                centre = np.array(ndimage.center_of_mass(thin, labels, idx + 1)) * PITCH + origin
                clusters.append({"volume_mm3": round(float(sizes[idx]) * PITCH ** 3, 2), "centre_mm": [round(float(c), 1) for c in centre]})
        report["checks"][name] = {
            "diameter_mm": 2 * r,
            "thin_volume_mm3": round(float(thin.sum()) * PITCH ** 3, 2),
            "largest_regions": clusters,
        }
    with open(out, "w") as fh:
        json.dump(report, fh, indent=1)
    print("THICKNESS " + json.dumps(report))


if __name__ == "__main__":
    main()
