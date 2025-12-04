# backend/helpers.py
import numpy as np
import cv2
from skimage.measure import regionprops
from skimage.color import rgb2lab

def segments_to_polygons(segments):
    """
    Convert integer segment map -> list of polygons per segment id.
    Returns polygons: [{id: int, polygon: [[x,y],[x,y],...]], ...]
    meta contains bounding box sizes.
    """
    max_label = int(segments.max())
    polygons = []
    meta = {"labels_found": max_label}
    h, w = segments.shape
    for label in range(1, max_label + 1):
        mask = (segments == label).astype('uint8') * 255
        if mask.sum() == 0:
            continue
        # find contours using OpenCV: need single-channel uint8
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        # choose the largest contour
        contour = max(contours, key=lambda c: cv2.contourArea(c))
        # approximate polygon to reduce vertex count
        epsilon = 0.01 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        # convert to list of [x,y]
        poly = [[int(pt[0][0]), int(pt[0][1])] for pt in approx]
        polygons.append({"id": int(label), "polygon": poly})

    return polygons, meta


def compute_superpixel_features(img, segments):
    """
    Compute very small set of features per superpixel:
    - centroid (x,y)
    - area (pixels)
    - mean Lab color (L,a,b)
    Returns dict keyed by segment id: { id: {centroid: [x,y], area: int, lab_mean: [L,a,b]} }
    """
    img_rgb = img
    if img_rgb.dtype != np.uint8:
        # assume floats 0..1
        img_rgb = (img_rgb * 255).astype(np.uint8)
    h, w = segments.shape
    props = regionprops(segments)
    lab = rgb2lab(img_rgb)
    features = {}
    for p in props:
        sid = int(p.label)
        cy, cx = p.centroid
        area = int(p.area)
        mask = (segments == sid)
        meanL = float(lab[..., 0][mask].mean()) if area > 0 else 0.0
        meana = float(lab[..., 1][mask].mean()) if area > 0 else 0.0
        meanb = float(lab[..., 2][mask].mean()) if area > 0 else 0.0
        features[sid] = {"centroid": [float(cx), float(cy)], "area": area, "lab_mean": [meanL, meana, meanb]}
    return features
