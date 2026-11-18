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

PITCH = 0.25                                  # millimetres
CHECKS = {"tip_1.5mm": 0.75, "limb_2.5mm": 1.25, "wall_1.6mm": 0.8}


def main():
    stl, out = sys.argv[1], sys.argv[2]
    mesh = trimesh.load(stl)
    vox = mesh.voxelized(PITCH).fill()
    solid = np.pad(vox.matrix, 6)
    origin = vox.translation - 6 * PITCH
    inside = ndimage.distance_transform_edt(solid) * PITCH
    report = {"file": stl, "pitch_mm": PITCH, "solid_volume_cm3": round(float(solid.sum()) * PITCH ** 3 / 1000, 2), "checks": {}}
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
