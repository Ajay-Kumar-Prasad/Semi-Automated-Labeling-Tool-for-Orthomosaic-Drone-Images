import os
import uuid
import json
import time
from threading import Lock
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from skimage import io
from skimage.segmentation import slic
import numpy as np
import cv2
from PIL import Image
from helpers import segments_to_polygons, compute_superpixel_features
from flask_cors import CORS

Image.MAX_IMAGE_PIXELS = None

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------
UPLOAD_FOLDER = "uploads"
SEG_FOLDER = "segments"
LABEL_FOLDER = "labels"
PATCH_FOLDER = "patches"

ALLOWED = {"png", "jpg", "jpeg", "tif", "tiff"}
PREVIEW_MAX_DIM = 4096   # browser-safe

for f in [UPLOAD_FOLDER, SEG_FOLDER, LABEL_FOLDER, PATCH_FOLDER]:
    os.makedirs(f, exist_ok=True)

app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
CORS(app, resources={r"/*": {"origins": "*"}})

label_lock = Lock()

def allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED


# -------------------------------------------------------------------
# HEALTH
# -------------------------------------------------------------------
@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# -------------------------------------------------------------------
# UPLOAD (SAFE PREVIEW GENERATION)
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

    image_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    base, ext = os.path.splitext(filename)

    # Save original (TIFF kept untouched)
    orig_name = f"{image_id}_orig{ext}"
    orig_path = os.path.join(UPLOAD_FOLDER, orig_name)
    file.save(orig_path)

    # Generate preview image
    preview_name = f"{image_id}_preview.png"
    preview_path = os.path.join(UPLOAD_FOLDER, preview_name)

    with Image.open(orig_path) as img:
        img = img.convert("RGB")
        img.thumbnail((PREVIEW_MAX_DIM, PREVIEW_MAX_DIM), Image.LANCZOS)
        img.save(preview_path)

    return jsonify({
        "image_id": image_id,
        "filename": preview_name
    })


# -------------------------------------------------------------------
# SEGMENT (ON PREVIEW IMAGE)
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

    img = io.imread(path)
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    if img.shape[-1] > 3:
        img = img[..., :3]

    h, w = img.shape[:2]

    img_float = img.astype(np.float32) / 255.0

    segments = slic(
        img_float,
        n_segments=n_segments,
        compactness=compactness,
        slic_zero=True,
        start_label=1
    )

    polygons, _ = segments_to_polygons(segments)
    features = compute_superpixel_features(img, segments)

    image_id = image_filename.split("_")[0]

    meta = {
        "image_id": image_id,
        "image_filename": image_filename,
        "orig_shape": [h, w, 3],
        "seg_shape": [h, w, 3],
        "scale": 1.0,
        "n_segments": int(segments.max()),
        "polygons": polygons,
        "features": features
    }

    with open(os.path.join(SEG_FOLDER, f"{image_id}_segments.json"), "w") as f:
        json.dump(meta, f, indent=2)

    np.save(os.path.join(SEG_FOLDER, f"{image_id}_segments.npy"), segments)

    return jsonify(meta)


# -------------------------------------------------------------------
# SAVE LABEL (PATCHES FROM ORIGINAL TIFF)
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
    label_file = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")

    if not os.path.exists(seg_path):
        return jsonify({"error": "segments missing"}), 500

    segments = np.load(seg_path)

    with open(meta_path, "r") as f:
        meta = json.load(f)

    # Load ORIGINAL TIFF
    orig_tif = next(
        f for f in os.listdir(UPLOAD_FOLDER)
        if f.startswith(image_id + "_orig")
    )
    orig = io.imread(os.path.join(UPLOAD_FOLDER, orig_tif))
    if orig.ndim == 2:
        orig = np.stack([orig] * 3, axis=-1)
    if orig.shape[-1] > 3:
        orig = orig[..., :3]

    mask = segments == spid
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return jsonify({"error": "superpixel not found"}), 400

    xmin, xmax = xs.min(), xs.max()
    ymin, ymax = ys.min(), ys.max()

    scale_x = orig.shape[1] / meta["seg_shape"][1]
    scale_y = orig.shape[0] / meta["seg_shape"][0]

    xmin = int(xmin * scale_x)
    xmax = int(xmax * scale_x)
    ymin = int(ymin * scale_y)
    ymax = int(ymax * scale_y)

    pad = 8
    xmin = max(0, xmin - pad)
    ymin = max(0, ymin - pad)
    xmax = min(orig.shape[1] - 1, xmax + pad)
    ymax = min(orig.shape[0] - 1, ymax + pad)

    patch = orig[ymin:ymax + 1, xmin:xmax + 1]

    with label_lock:
        labels = {}
        if os.path.exists(label_file):
            try:
                with open(label_file) as f:
                    labels = json.load(f)
            except json.JSONDecodeError:
                pass

        if label == "unlabeled":
            labels.pop(str(spid), None)
        else:
            out_dir = os.path.join(PATCH_FOLDER, image_id, label)
            os.makedirs(out_dir, exist_ok=True)

            patch_path = os.path.join(out_dir, f"{spid}.png")
            cv2.imwrite(patch_path, cv2.cvtColor(patch, cv2.COLOR_RGB2BGR))

            labels[str(spid)] = {
                "label": label,
                "patch_path": patch_path,
                "bbox": [xmin, ymin, xmax, ymax],
                "ts": int(time.time()),
                "user": user
            }

        with open(label_file, "w") as f:
            json.dump(labels, f, indent=2)

    return jsonify({"status": "ok"})


# -------------------------------------------------------------------
# LOAD LABELS
# -------------------------------------------------------------------
@app.route("/labels/<image_id>")
def get_labels(image_id):
    f = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")
    if not os.path.exists(f):
        return jsonify({})
    try:
        with open(f) as fh:
            return jsonify(json.load(fh))
    except json.JSONDecodeError:
        return jsonify({})


# -------------------------------------------------------------------
# STATIC
# -------------------------------------------------------------------
@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    full_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(full_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
