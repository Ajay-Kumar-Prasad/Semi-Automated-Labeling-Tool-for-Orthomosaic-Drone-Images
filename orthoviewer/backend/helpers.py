import numpy as np
import cv2
from skimage.measure import regionprops
from skimage.color import rgb2lab


# -------------------------------------------------------------------
# CLOCKWISE SORT – STABLE FOR POLYGONS WITH REPEATED OR NEARLY COLLINEAR POINTS
# -------------------------------------------------------------------
def sort_polygon_clockwise(points):
    """
    Sort polygon corner points clockwise around centroid.
    Ensures stable SVG rendering at all zoom levels.
    """
    pts = np.array(points, dtype=np.float32)

    if pts.shape[0] <= 2:
        return pts.tolist()

    cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
    angles = np.arctan2(pts[:, 1] - cy, pts[:, 0] - cx)

    order = np.argsort(angles)
    return pts[order].tolist()


# -------------------------------------------------------------------
# SLIC SUPERPIXELS → CLEAN, SIMPLIFIED POLYGONS FOR FRONTEND
# -------------------------------------------------------------------
def segments_to_polygons(segments):
    """
    Convert segmentation array → polygon boundaries for React SVG rendering.

    Returns:
        polygons = [
            { "id": int, "polygon": [[x,y], [x,y], ...] },
            ...
        ]

        meta = { "labels_found": int }
    """

    segments = segments.astype(np.int32)
    max_id = int(segments.max())

    polygons = []
    meta = {"labels_found": max_id}

    for sid in range(1, max_id + 1):

        mask = (segments == sid).astype(np.uint8)
        if mask.sum() == 0:
            continue

        # Find external contour (superpixel boundary)
        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        if not contours:
            continue

        contour = max(contours, key=cv2.contourArea)

        if contour.shape[0] < 4:
            continue

        # Polygon simplification (ε scales with perimeter)
        epsilon = 0.008 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)

        pts = [[int(x), int(y)] for [[x, y]] in approx]

        pts = sort_polygon_clockwise(pts)

        polygons.append({
            "id": int(sid),
            "polygon": pts
        })

    return polygons, meta


# -------------------------------------------------------------------
# SUPERPIXEL FEATURE EXTRACTION – ML READY FEATURES
# -------------------------------------------------------------------
def compute_superpixel_features(img, segments):
    """
    Extract interpretable, ML-useful features per superpixel:
        • centroid (x, y)
        • area (px count)
        • mean Lab color (perceptually uniform)
    
    Returns:
        { sid: {
              "centroid": [x, y],
              "area": int,
              "lab_mean": [L, a, b]
        } }
    """

    # -------------------------------------------------------------------
    # Ensure RGB uint8 for Lab conversion
    # -------------------------------------------------------------------
    if img.dtype != np.uint8:
        img_uint8 = (img * 255).astype(np.uint8)
    else:
        img_uint8 = img

    # Convert once → avoid recomputing Lab for each region
    lab = rgb2lab(img_uint8)

    props = regionprops(segments.astype(np.int32))
    features = {}

    for region in props:
        sid = int(region.label)

        cy, cx = region.centroid
        area = int(region.area)

        mask = (segments == sid)

        if area == 0:
            lab_mean = [0.0, 0.0, 0.0]
        else:
            L = float(lab[..., 0][mask].mean())
            a = float(lab[..., 1][mask].mean())
            b = float(lab[..., 2][mask].mean())
            lab_mean = [L, a, b]

        features[sid] = {
            "centroid": [float(cx), float(cy)],
            "area": area,
            "lab_mean": lab_mean
        }

    return features
