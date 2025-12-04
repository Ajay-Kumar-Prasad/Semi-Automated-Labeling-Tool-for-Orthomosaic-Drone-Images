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

## 🚀 Setup & Usage Guide

### 1\. Setup Backend (Flask)

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run the Flask server
python app.py
```

> 💡 Backend will run on **[http://127.0.0.1:5000](http://127.0.0.1:5000)** and handle all ML processing.

### 2\. Setup Frontend (React)

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the development server
npm start
```

> 💡 The frontend dev server will launch (typically on port 3000) and automatically proxy API calls to the Flask backend.

### 3\. Usage Flow

1.  Open the frontend in your browser.
2.  Use the interface to **upload an orthomosaic image**.
3.  The backend computes superpixels and runs the ML model to generate preliminary labels.
4.  The frontend displays the image with the predicted, color-coded **superpixel polygons**.
5.  Use the manual correction tools and keyboard shortcuts to refine the labels.
6.  Click the "Export" button to download the refined mask and/or the superpixel annotation data.

-----

## 🗺️ Feature Roadmap

### 💜 MUST-HAVE FEATURES (Basic → Usable)

  * **1. Undo / Redo:** Implement a simple action stack for immediate correction of labeling errors.
  * **2. Highlight Selected Polygon:** Clearly indicate the active superpixel with a distinct border upon selection.
  * **3. Keyboard Shortcuts:** Enable fast annotation (`1, 2, 3` for class selection, `Z` for undo).
  * **4. Sidebar Label Counts:** Display a running count for each label to track progress.
  * **5. Mini-map (Overview):** An inset map showing the user's current zoom/pan window within the large image.

### 💙 NICE-TO-HAVE FEATURES (Usable → Research-Grade)

  * **6. Brush Mode:** Allow click-and-drag painting to quickly assign a label across dozens of adjacent superpixels.
  * **7. Multi-select Polygons:** Enable `Shift + Click` to select multiple regions and assign a label to all at once.
  * **8. Auto-merge Visually Identical Polygons:** Implement clustering to merge adjacent, homogeneous regions automatically.
  * **9. Layer Visibility Controls:** Add toggles to show/hide the original image, polygons, or labels.
  * **10. Segmentation Preview Slider:** Allow users to adjust segmentation parameters (`n_segments`, `compactness`) before final computation.

### 👑 GOD-TIER FEATURES (Research-Grade → Commercial-Grade)

  * **11. AI-Assisted Auto-Labeling:** Incorporate simple heuristics (e.g., NDVI, texture analysis) for stronger initial predictions.
  * **12. Polygon Refinement (Split/Merge):** Enable manual editing to split an imperfect superpixel or merge adjacent ones.
  * **13. Advanced Mask Export:** Support a variety of ML and GIS formats: **GeoTIFF masks**, **COCO segmentation format**, and **Shapefiles**.
  * **14. Annotation Timelines (Versioning):** Store a history of labeling and segmentation versions linked to a user ID.
  * **15. Multi-User Collaboration:** Implement a database model to support team labeling with conflict detection.