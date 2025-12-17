import numpy as np
import cv2
from skimage.measure import regionprops
from skimage.color import rgb2lab


# -------------------------------------------------------------------
# CLOCKWISE SORT – ROBUST AGAINST DEGENERATE POLYGONS
# -------------------------------------------------------------------
def sort_polygon_clockwise(points):
    pts = np.array(points, dtype=np.float32)

    if pts.shape[0] <= 2:
        return pts.tolist()

    # Degenerate polygon guard
    if np.abs(cv2.contourArea(pts.reshape(-1, 1, 2))) < 1e-2:
        return pts.tolist()

    cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
    angles = np.arctan2(pts[:, 1] - cy, pts[:, 0] - cx)

    order = np.argsort(angles)
    return pts[order].tolist()


# -------------------------------------------------------------------
# SLIC SUPERPIXELS → POLYGONS
# -------------------------------------------------------------------
def segments_to_polygons(segments):
    segments = segments.astype(np.int32)
    max_id = int(segments.max())

    polygons = []
    meta = {"labels_found": max_id}

    for sid in range(1, max_id + 1):
        mask = (segments == sid).astype(np.uint8)
        if mask.sum() == 0:
            continue

        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        if not contours:
            continue

        contour = max(contours, key=cv2.contourArea)

        if contour.shape[0] < 4:
            continue

        # Robust epsilon (avoid collapse)
        peri = cv2.arcLength(contour, True)
        epsilon = max(1.5, 0.008 * peri)

        approx = cv2.approxPolyDP(contour, epsilon, True)
        if approx.shape[0] < 3:
            continue

        pts = [[int(x), int(y)] for [[x, y]] in approx]
        pts = sort_polygon_clockwise(pts)

        polygons.append({
            "id": int(sid),
            "polygon": pts
        })

    return polygons, meta


# -------------------------------------------------------------------
# SUPERPIXEL FEATURES
# -------------------------------------------------------------------
def compute_superpixel_features(img, segments):
    """
    NOTE:
    All spatial features (centroid) are in SEGMENTED IMAGE SPACE.
    Color features are scale invariant.
    """

    # Normalize image safely for Lab
    if img.dtype == np.uint8:
        img_norm = img.astype(np.float32) / 255.0
    else:
        img_norm = img.astype(np.float32)
        if img_norm.max() > 1.0:
            img_norm /= 255.0

    lab = rgb2lab(img_norm)

    props = regionprops(segments.astype(np.int32))
    features = {}

    for region in props:
        sid = int(region.label)
        cy, cx = region.centroid
        area = int(region.area)

        mask = (segments == sid)

        if area > 0:
            lab_mean = [
                float(lab[..., 0][mask].mean()),
                float(lab[..., 1][mask].mean()),
                float(lab[..., 2][mask].mean())
            ]
        else:
            lab_mean = [0.0, 0.0, 0.0]

        features[sid] = {
            "centroid": [float(cx), float(cy)],
            "area": area,
            "lab_mean": lab_mean
        }

    return features
