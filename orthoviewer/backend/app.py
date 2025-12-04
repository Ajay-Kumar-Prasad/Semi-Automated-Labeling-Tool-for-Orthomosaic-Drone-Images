# backend/app.py
import os
import uuid
import json
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from skimage import io
from skimage.segmentation import slic
import numpy as np
import cv2
from PIL import Image        # <-- For TIFF → PNG conversion
from helpers import segments_to_polygons, compute_superpixel_features
from flask_cors import CORS

# Config
UPLOAD_FOLDER = "uploads"
SEG_FOLDER = "segments"
LABEL_FOLDER = "labels"
ALLOWED = {"png", "jpg", "jpeg", "tif", "tiff"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SEG_FOLDER, exist_ok=True)
os.makedirs(LABEL_FOLDER, exist_ok=True)

app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


def allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify({"error": "no image file"}), 400
    f = request.files["image"]

    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400
    if not allowed(f.filename):
        return jsonify({"error": "bad ext"}), 400

    filename = secure_filename(f.filename)
    image_id = str(uuid.uuid4())
    save_name = f"{image_id}_{filename}"
    save_path = os.path.join(UPLOAD_FOLDER, save_name)

    # Save original
    f.save(save_path)

    # --- TIFF FIX: Convert TIFF → PNG for browser preview ---
    if filename.lower().endswith((".tif", ".tiff")):
        png_name = save_name + ".png"
        png_path = os.path.join(UPLOAD_FOLDER, png_name)

        img = Image.open(save_path)
        img.save(png_path)

        # Use PNG instead of TIFF going forward
        save_name = png_name
        save_path = png_path

    return jsonify({"image_id": image_id, "filename": save_name, "path": save_path})


@app.route("/segment", methods=["POST"])
def segment():
    data = request.json or {}
    image_filename = data.get("image_filename")
    if not image_filename:
        return jsonify({"error": "image_filename required"}), 400

    n_segments = int(data.get("n_segments", 800))
    compactness = float(data.get("compactness", 10.0))

    image_path = os.path.join(UPLOAD_FOLDER, image_filename)
    if not os.path.exists(image_path):
        return jsonify({"error": "image not found"}), 404

    img = io.imread(image_path)

    # ensure RGB
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    if img.shape[-1] > 3:
        img = img[..., :3]

    # --- HUGE IMAGE FIX: Downscale if too large ---
    MAX_SIZE = 3000
    h, w = img.shape[:2]
    max_dim = max(h, w)

    if max_dim > MAX_SIZE:
        scale = MAX_SIZE / max_dim
        new_w = int(w * scale)
        new_h = int(h * scale)
        print("Downscaling:", (h, w), "→", (new_h, new_w))
        img = cv2.resize(img, (new_w, new_h))

    img_float = img.astype(np.float32) / 255.0

    segments = slic(img_float, n_segments=n_segments, compactness=compactness, start_label=1,slic_zero=True)

    polygons, meta = segments_to_polygons(segments)
    features = compute_superpixel_features(img, segments)

    image_id = image_filename.split("_")[0]
    out = {
        "image_id": image_id,
        "image_filename": image_filename,
        "image_shape": list(img.shape),
        "n_segments": int(np.max(segments)),
        "polygons": polygons,
        "meta": meta,
        "features": features
    }

    seg_path = os.path.join(SEG_FOLDER, f"{image_id}_segments.json")
    with open(seg_path, "w") as fh:
        json.dump(out, fh)

    return jsonify(out)


@app.route("/segments/<image_id>", methods=["GET"])
def get_segments(image_id):
    seg_path = os.path.join(SEG_FOLDER, f"{image_id}_segments.json")
    if not os.path.exists(seg_path):
        return jsonify({"error": "segments not found"}), 404
    with open(seg_path, "r") as fh:
        data = json.load(fh)
    return jsonify(data)


@app.route("/save_label", methods=["POST"])
def save_label():
    data = request.json or {}
    image_id = data.get("image_id")
    spid = data.get("superpixel_id")
    label = data.get("label")
    user = data.get("user", "anonymous")

    if not image_id or spid is None or label is None:
        return jsonify({"error": "image_id, superpixel_id, label required"}), 400

    label_file = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")
    if os.path.exists(label_file):
        with open(label_file, "r") as fh:
            labels = json.load(fh)
    else:
        labels = {}

    import time
    labels[str(spid)] = {"label": label, "user": user, "ts": int(time.time())}
    with open(label_file, "w") as fh:
        json.dump(labels, fh)

    return jsonify({"status": "ok", "written": True})


@app.route("/labels/<image_id>", methods=["GET"])
def get_labels(image_id):
    label_file = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")
    if not os.path.exists(label_file):
        return jsonify({})
    with open(label_file, "r") as fh:
        labels = json.load(fh)
    return jsonify(labels)


@app.route("/uploads/<path:filename>")
def serve_uploads(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)

# # backend/app.py
# import os
# import uuid
# import json
# from flask import Flask, request, jsonify, send_from_directory
# from werkzeug.utils import secure_filename
# from skimage import io
# from skimage.segmentation import slic
# import numpy as np
# import cv2
# from helpers import segments_to_polygons, compute_superpixel_features
# from flask_cors import CORS   # <-- ADDED

# # Config
# UPLOAD_FOLDER = "uploads"
# SEG_FOLDER = "segments"
# LABEL_FOLDER = "labels"
# ALLOWED = {"png", "jpg", "jpeg", "tif", "tiff"}
# os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# os.makedirs(SEG_FOLDER, exist_ok=True)
# os.makedirs(LABEL_FOLDER, exist_ok=True)

# app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
# CORS(app, resources={r"/*": {"origins": "*"}})   # <-- CORS FIX ADDED HERE
# app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


# def allowed(filename):
#     return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED


# @app.route("/health", methods=["GET"])
# def health():
#     return jsonify({"status": "ok"})


# @app.route("/upload", methods=["POST"])
# def upload():
#     if "image" not in request.files:
#         return jsonify({"error": "no image file"}), 400
#     f = request.files["image"]
#     if f.filename == "":
#         return jsonify({"error": "empty filename"}), 400
#     if not allowed(f.filename):
#         return jsonify({"error": "bad ext"}), 400

#     filename = secure_filename(f.filename)
#     image_id = str(uuid.uuid4())
#     save_name = f"{image_id}_{filename}"
#     save_path = os.path.join(UPLOAD_FOLDER, save_name)
#     f.save(save_path)
#     return jsonify({"image_id": image_id, "filename": save_name, "path": save_path})


# @app.route("/segment", methods=["POST"])
# def segment():
#     data = request.json or {}
#     image_filename = data.get("image_filename")
#     if not image_filename:
#         return jsonify({"error": "image_filename required"}), 400

#     n_segments = int(data.get("n_segments", 800))
#     compactness = float(data.get("compactness", 10.0))

#     image_path = os.path.join(UPLOAD_FOLDER, image_filename)
#     if not os.path.exists(image_path):
#         return jsonify({"error": "image not found"}), 404

#     img = io.imread(image_path)
#     if img.ndim == 2:
#         img = np.stack([img] * 3, axis=-1)
#     if img.shape[-1] > 3:
#         img = img[..., :3]

#     img_float = img.astype(np.float32) / 255.0

#     segments = slic(img_float, n_segments=n_segments, compactness=compactness, start_label=1)

#     polygons, meta = segments_to_polygons(segments)

#     features = compute_superpixel_features(img, segments)

#     image_id = image_filename.split("_")[0]
#     out = {
#         "image_id": image_id,
#         "image_filename": image_filename,
#         "image_shape": list(img.shape),
#         "n_segments": int(np.max(segments)),
#         "polygons": polygons,
#         "meta": meta,
#         "features": features
#     }

#     seg_path = os.path.join(SEG_FOLDER, f"{image_id}_segments.json")
#     with open(seg_path, "w") as fh:
#         json.dump(out, fh)

#     return jsonify(out)


# @app.route("/segments/<image_id>", methods=["GET"])
# def get_segments(image_id):
#     seg_path = os.path.join(SEG_FOLDER, f"{image_id}_segments.json")
#     if not os.path.exists(seg_path):
#         return jsonify({"error": "segments not found"}), 404
#     with open(seg_path, "r") as fh:
#         data = json.load(fh)
#     return jsonify(data)


# @app.route("/save_label", methods=["POST"])
# def save_label():
#     data = request.json or {}
#     image_id = data.get("image_id")
#     spid = data.get("superpixel_id")
#     label = data.get("label")
#     user = data.get("user", "anonymous")

#     if not image_id or spid is None or label is None:
#         return jsonify({"error": "image_id, superpixel_id, label required"}), 400

#     label_file = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")
#     if os.path.exists(label_file):
#         with open(label_file, "r") as fh:
#             labels = json.load(fh)
#     else:
#         labels = {}

#     import time
#     labels[str(spid)] = {"label": label, "user": user, "ts": int(time.time())}
#     with open(label_file, "w") as fh:
#         json.dump(labels, fh)

#     return jsonify({"status": "ok", "written": True})


# @app.route("/labels/<image_id>", methods=["GET"])
# def get_labels(image_id):
#     label_file = os.path.join(LABEL_FOLDER, f"{image_id}_labels.json")
#     if not os.path.exists(label_file):
#         return jsonify({})
#     with open(label_file, "r") as fh:
#         labels = json.load(fh)
#     return jsonify(labels)


# @app.route("/uploads/<path:filename>")
# def serve_uploads(filename):
#     return send_from_directory(UPLOAD_FOLDER, filename)


# @app.route("/", defaults={"path": ""})
# @app.route("/<path:path>")
# def serve_frontend(path):
#     if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
#         return send_from_directory(app.static_folder, path)
#     return send_from_directory(app.static_folder, "index.html")


# if __name__ == "__main__":
#     app.run(debug=True, port=5000)
