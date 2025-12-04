# 🛰️ Semi-Automated Labeling Tool for Orthomosaic Drone Images

A web-based application for efficient, scalable, and accurate annotation of drone-captured agricultural orthomosaics using superpixels, machine learning, and human refinement tools.

---

## 🎯 Project Objective

The objective of this web application is to provide a semi-automated labeling tool for orthomosaic drone images, enabling faster, more consistent, and more scalable creation of segmentation datasets for agricultural analysis.

Traditional pixel-by-pixel annotation of large orthomosaic images is slow and error-prone. This tool accelerates the process by:

- Automatically generating superpixels to break the image into meaningful regions
- Extracting features for each region
- Suggesting initial class labels using a machine learning model
- Allowing the user to visually review, correct, and export the final mask

This creates an efficient human-in-the-loop labeling pipeline, where the model handles the tedious work and the human ensures accuracy.

---

## ✨ Key Features

### Image Handling
- Upload large orthomosaic drone images
- Preview and inspect images

### Automated Assistance
- Superpixel segmentation
- Feature extraction
- ML-based preliminary label prediction
- Automatic color-coded mask generation

### Manual Correction Tools
- Brush tool for editing
- Region selection
- Class picker
- Mask refinement tools

### Export Options
- Export refined masks
- Export annotation dataset
- Export superpixel metadata

---

## 🔧 High-Level Architecture

### Frontend (React)
- Image upload interface
- Mask visualization and editing
- Human-in-the-loop correction tools
- Export functionality

### Backend (Flask)
- Image upload handling
- Superpixel computation
- Feature extraction
- ML model inference
- Mask generation
- Serving output masks to frontend

### Machine Learning Pipeline
- Superpixel segmentation (SLIC)
- Feature engineering (color, variance, optional NDVI)
- Texture features (optional GLCM)
- RandomForest classifier
- Training script for generating `.joblib` model file

---

## 📁 Project Structure
```
project/
│
├── backend/
│ ├── app.py
│ ├── uploads/
│ ├── outputs/
│ └── models/
│ └── model_rf.joblib
│
├── frontend/
│ ├── src/
│ ├── public/
│ └── package.json
│
├── images/ # Training images
├── masks/ # Ground truth masks
└── train.py # Model training pipeline
```

---

# OrthoViewer - Semi-automated Superpixel Labeler

## Setup backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

Backend will run on http://127.0.0.1:5000

## Setup frontend (dev)
cd frontend
npm install
npm start
# frontend dev server runs, proxies to backend endpoints (if same origin rules apply).
# Alternatively run `npm run build` and let Flask serve build/ files (app.py contains static serving).

## Usage
1. Open the frontend.
2. Upload an orthomosaic image (png/jpg/tif).
3. On upload the backend will compute superpixels and return polygons.
4. Click polygons to label them (cycles through states). Labels are saved to backend.
5. Download labels JSON or reload stored labels.

Notes:
- For very large orthomosaics, consider tiling before segmentation.
- This is a minimal dev implementation; for production, add auth, chunked uploads, job queue for segmentation, and object storage.


💜 MUST-HAVE FEATURES (turns your tool from basic → usable)

These are the features you should add right away, especially since your images are large and complex.

1. Undo / Redo (super essential)

Users WILL mislabel polygons repeatedly.

Implement a simple stack:

const [history, setHistory] = useState([]);
const [future, setFuture] = useState([]);


Push every labeling action to history.
Undo pops from history → moves to future.
Redo pops from future → re-applies.

This is table stakes for annotators.

2. Highlight selected polygon

Right now hover works, but clicking a polygon should highlight it (thicker border).

3. Keyboard Shortcuts

For FAST annotation:

Key	Action
1	good
2	moderate
3	bad
E	erase
Z	undo
Shift+Z	redo

Annotators LOVE shortcuts → turns labeling from slow clicking into fast tagging.

4. Sidebar showing label counts

Show:

Good: 54
Moderate: 22
Bad: 11
Unlabeled: 98


This helps users know when they're “done.”

5. Mini-map (overview)

Large images require navigation help.

A tiny mini-map in the corner helps users see:

where they are in the big image

current zoom window

click mini-map to jump

This is killer for large TIFFs.

💜 NICE-TO-HAVE FEATURES (turns your tool into a research-grade annotator)
6. Brush mode (paint labels over multiple polygons)

Click-and-drag to label dozens of adjacent segments quickly.

Very useful when vegetation is homogeneous.

7. Multi-select polygons

Shift + click lets you select multiple superpixels and assign a label to all at once.

8. Auto-merge visually identical polygons

If adjacent polygons have similar color/texture → merge them into a larger region.

Reduces annotation workload by ~40%.

9. Layer visibility controls

Add toggles:

✔ Show/hide polygons
✔ Show/hide labels
✔ Show/hide image
✔ Show only unlabelled polygons

This helps reduce clutter.

10. Segmentation preview slider

Let users adjust:

n_segments

compactness

…in real-time, before final segmentation.

💜 GOD-TIER FEATURES (turns the project into a commercial-grade tool)
11. AI-Assisted Auto-Labeling

Not full training — just heuristics:

NDVI-based vegetation detection

Texture-based cluster labeling

Auto-label soil regions

Auto-mark boundaries

Even weak heuristics save hours of work.

12. Polygon refinement (split/merge)

Sometimes SLIC gives bad shapes.
Allow:

Split polygon with a line

Merge polygons

Manually draw polygon (freehand)

This turns you into CVAT-lite.

13. Mask export

Convert labels into:

PNG masks

GeoTIFF masks

COCO segmentation format

Shapefiles (for GIS)

Numpy arrays (for ML training)

This is required for ML pipelines.

14. Annotation timelines (versioning)

Store history of:

segmentation version

labeling version

annotator user ID

Useful if multiple people annotate same dataset.

15. Multi-user collaboration

Store labels in a database:

user-specific labeling

conflict detection (two users label same region differently)

admin review mode

This is enterprise-level stuff.