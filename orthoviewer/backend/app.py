import os
import uuid
import json
import time
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from skimage import io
from skimage.segmentation import slic
import numpy as np
import cv2
from PIL import Image
from helpers import segments_to_polygons, compute_superpixel_features
from flask_cors import CORS

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------
UPLOAD_FOLDER = "uploads"
SEG_FOLDER = "segments"
LABEL_FOLDER = "labels"
PATCH_FOLDER = "patches"
ALLOWED = {"png", "jpg", "jpeg", "tif", "tiff"}

for f in [UPLOAD_FOLDER, SEG_FOLDER, LABEL_FOLDER, PATCH_FOLDER]:
    os.makedirs(f, exist_ok=True)

app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
CORS(app, resources={r"/*": {"origins": "*"}})


def allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED


# -------------------------------------------------------------------
# HEALTH CHECK
# -------------------------------------------------------------------
@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# -------------------------------------------------------------------
# UPLOAD + TIFF FIX
# -------------------------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify({"error": "no file"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400

    if not allowed(file.filename):
        return jsonify({"error": "bad extension"}), 400

    filename = secure_filename(file.filename)
    image_id = str(uuid.uuid4())
    base, ext = os.path.splitext(filename)

    # always store original
    stored_name = f"{image_id}_{base}{ext}"
    stored_path = os.path.join(UPLOAD_FOLDER, stored_name)
    file.save(stored_path)

    # Convert TIFF → PNG cleanly
    if ext.lower() in [".tif", ".tiff"]:
        png_name = f"{image_id}_{base}.png"
        png_path = os.path.join(UPLOAD_FOLDER, png_name)
        try:
            Image.open(stored_path).save(png_path)
            stored_name = png_name
            stored_path = png_path
        except Exception as e:
            print("TIFF conversion failed:", e)

    return jsonify({
        "image_id": image_id,
        "filename": stored_name
    })


# -------------------------------------------------------------------
# SEGMENT IMAGE (uses scaled image for SLIC)
# -------------------------------------------------------------------
@app.route("/segment", methods=["POST"])
def segment():
    data = request.json or {}
    image_filename = data.get("image_filename")

    if not image_filename:
        return jsonify({"error": "image_filename required"}), 400

    path = os.path.join(UPLOAD_FOLDER, image_filename)
    if not os.path.exists(path):
        return jsonify({"error": "image missing"}), 404

    n_segments = int(data.get("n_segments", 800))
    compactness = float(data.get("compactness", 10))

    # load original
    img = io.imread(path)
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    if img.shape[-1] > 3:
        img = img[..., :3]

    orig_h, orig_w = img.shape[:2]
    scale = 1.0

    # Resize if too large
    MAX_DIM = 3000
    max_dim = max(orig_h, orig_w)
    if max_dim > MAX_DIM:
        scale = MAX_DIM / max_dim
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)
        img_small = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        img_small = img.copy()

    seg_h, seg_w = img_small.shape[:2]
    img_float = img_small.astype(np.float32) / 255.0

    # SLIC Superpixels
    segments = slic(
        img_float,
        n_segments=n_segments,
        compactness=compactness,
        slic_zero=True,
        start_label=1
    )

    polygons, meta = segments_to_polygons(segments)
    features = compute_superpixel_features(img_small, segments)

    image_id = image_filename.split("_")[0]

    out = {
        "image_id": image_id,
        "image_filename": image_filename,
        "orig_shape": [orig_h, orig_w, 3],
        "seg_shape": [seg_h, seg_w, 3],
        "scale": scale,
        "n_segments": int(segments.max()),
        "polygons": polygons,
        "features": features
    }

    # Save segmentation
    json.dump(out, open(os.path.join(SEG_FOLDER, f"{image_id}_segments.json"), "w"), indent=2)
    np.save(os.path.join(SEG_FOLDER, f"{image_id}_segments.npy"), segments)

    # preview for UI
    preview_rgb = cv2.cvtColor(img_small, cv2.COLOR_RGB2BGR)
    cv2.imwrite(os.path.join(SEG_FOLDER, f"{image_id}_preview.png"), preview_rgb)

    return jsonify(out)


# -------------------------------------------------------------------
# SAVE LABEL + HIGH-RES PATCH
# -------------------------------------------------------------------
@app.route("/save_label", methods=["POST"])
def save_label():
    data = request.json or {}
    image_id = data.get("image_id")
    label = data.get("label")
    spid = data.get("superpixel_id")
    user = data.get("user", "web_user")

    if not image_id or label is None or spid is None:
        return jsonify({"error": "missing params"}), 400

    spid = int(spid)

    seg_path = os.path.join(SEG_FOLDER, f"{image_id}_segments.npy")
    meta_path = os.path.join(SEG_FOLDER, f"{image_id}_segments.json")

    if not os.path.exists(seg_path):
        return jsonify({"error": "segments missing"}), 500

    segments = np.load(seg_path)
    meta = json.load(open(meta_path))

    # load original image
    orig_path = os.path.join(UPLOAD_FOLDER, meta["image_filename"])
    orig = io.imread(orig_path)
    if orig.ndim == 2:
        orig = np.stack([orig] * 3, axis=-1)
    if orig.shape[-1] > 3:
        orig = orig[..., :3]

    scale = meta["scale"]

    # Extract mask
    mask = (segments == spid)
    ys, xs = np.where(mask)

    if len(xs) == 0:
        return jsonify({"error": "superpixel not found"}), 400

    # Scaled bounding box → original resolution
    xmin = int(xs.min() / scale)
    xmax = int(xs.max() / scale)
    ymin = int(ys.min() / scale)
    ymax = int(ys.max() / scale)

    pad = 8
    xmin = max(0, xmin - pad)
    ymin = max(0, ymin - pad)
    xmax = min(orig.shape[1] - 1, xmax + pad)
    ymax = min(orig.shape[0] - 1, ymax + pad)

    patch = orig[ymin:ymax+1, xmin:xmax+1]

    # Load label JSON
    label_file = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")
    labels = json.load(open(label_file)) if os.path.exists(label_file) else {}

    # Remove old patch if relabeling
    if str(spid) in labels:
        old_path = labels[str(spid)]["patch_path"]
        if os.path.exists(old_path):
            os.remove(old_path)

    # Handle erase
    if label == "unlabeled":
        if str(spid) in labels:
            del labels[str(spid)]
        json.dump(labels, open(label_file, "w"), indent=2)
        return jsonify({"status": "removed"})

    # Save high-res patch
    out_dir = os.path.join(PATCH_FOLDER, image_id, label)
    os.makedirs(out_dir, exist_ok=True)

    patch_path = os.path.join(out_dir, f"{spid}.png")
    cv2.imwrite(patch_path, cv2.cvtColor(patch, cv2.COLOR_RGB2BGR))

    ts = int(time.time())

    labels[str(spid)] = {
        "label": label,
        "patch_path": patch_path,
        "bbox": [xmin, ymin, xmax, ymax],
        "ts": ts,
        "user": user
    }

    json.dump(labels, open(label_file, "w"), indent=2)

    return jsonify({"status": "ok", "patch_path": patch_path})


# -------------------------------------------------------------------
# LOAD LABELS
# -------------------------------------------------------------------
@app.route("/labels/<image_id>")
def get_labels(image_id):
    f = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")
    return jsonify(json.load(open(f))) if os.path.exists(f) else jsonify({})
# -------------------------------------------------------------------
# SERVE UPLOADED IMAGES
# -------------------------------------------------------------------
@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# -------------------------------------------------------------------
# STATIC FRONTEND
# -------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    full_path = os.path.join(app.static_folder, path)
    if path != "" and os.path.exists(full_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
