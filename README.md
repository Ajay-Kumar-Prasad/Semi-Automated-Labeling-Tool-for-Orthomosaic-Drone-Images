# Superpixel-Based Orthomosaic Annotation & Dataset Generator
*A unified tool for generating machine-learning datasets for crop yield prediction and disease/stress classification.*

---

## 📌 Overview

This tool converts drone-captured **RGB orthomosaic images** into structured, ML-ready datasets for:

- **Crop Yield Prediction** (regression or classification)
- **Crop Disease / Stress Classification** (Healthy / Chlorosis / Necrosis / Others)

It provides an end-to-end workflow including image preprocessing, superpixel segmentation, interactive annotation, patch extraction, and dataset export.  
A single orthomosaic can generate **multiple datasets for different tasks**, reusing the same segmentation and patches.

---

## 🚀 Features

### ✅ 1. Orthomosaic Ingestion
- Supports PNG / JPG / TIFF inputs  
- Converts TIFF → PNG for browser compatibility  
- Automatically downsamples large images  
- Stores scale factor for future reference  

---

### ✅ 2. Superpixel Segmentation (SLIC/SLIF)
- Produces 500–1500 biologically meaningful regions  
- Extracts:
  - Polygons  
  - Centroid  
  - Area  
  - LAB color metrics  
  - Bounding boxes  
- Saves segmentation output to `segments.json`

---

### ✅ 3. Web-Based Superpixel Annotation Tool
Interactive UI for labeling segmented regions:
- Hover highlight  
- Click-to-label  
- Undo/Redo  
- Zoom, Pan, Mini-map  
- Real-time overlay of polygons  

Supports **multiple annotation modes**:

#### Yield Mode
- HighYield  
- MediumYield  
- LowYield  
*(or numeric yield values if available)*

#### Disease Mode
- Healthy  
- Chlorosis (Yellowing)  
- Necrosis (Brown/Dead Tissue)  
- Others (Soil, Shadow, Weeds)

Labels are stored separately:
- `labels_yield.json`
- `labels_disease.json`

---

### ✅ 4. Superpixel Patch Extraction
For every superpixel:
- Applies polygon mask  
- Extracts region-only RGB patch  
- Saves patch as PNG  
- Ensures consistent patch dimensions  

Stored in:
```
patches/
image_001_seg_1.png
image_001_seg_2.png
...
```


---

### ✅ 5. Dataset Export (CSV)
The tool exports **two datasets**, one for each task.

#### 📄 Yield Dataset → `dataset_yield.csv`
Columns:
```
segment_id
yield_label_or_value
centroid_x
centroid_y
area
L_mean
a_mean
b_mean
patch_path
image_id
```


#### 📄 Disease Dataset → `dataset_disease.csv`
Columns:
```
segment_id
disease_label
centroid_x
centroid_y
area
L_mean
a_mean
b_mean
patch_path
image_id
```


These formats integrate directly with:
- PyTorch DataLoaders  
- TensorFlow pipelines  
- XGBoost / RandomForest  

---

## 📁 Output Directory Structure
```
output/
image_001/
orthomosaic.png
segments.json
labels_yield.json
labels_disease.json
patches/
image_001_seg_1.png
image_001_seg_2.png
...
dataset_yield.csv
dataset_disease.csv
metadata.json
```
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
npm run dev
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

---

## 🧠 Supported Machine Learning Tasks

### 🔹 Yield Prediction
- Regression (predict numeric yield)
- Classification (High / Medium / Low)
- CNN + metadata hybrid models (patch + features)

### 🔹 Disease/Stress Classification
- Multi-class classification:
  - Healthy
  - Chlorosis
  - Necrosis
  - Others
- Binary disease detection possible

---

## 🔄 End-to-End Pipeline

1. Upload orthomosaic  
2. Preprocess image (resize, normalize, convert)  
3. Generate superpixels  
4. Annotate regions (yield or disease mode)  
5. Extract patches  
6. Export task-specific datasets  
7. Train CNN/ViT/Hybrid models  

---

## 🧩 Extensibility

- Add custom label sets  
- Plug in automatic model-based pre-labeling  
- Multi-task learning (shared backbone + multiple prediction heads)  
- Integration with GIS data (future expansion)  

---

## 📌 Applications

- Precision Agriculture  
- Yield Estimation Models  
- Crop Disease Monitoring  
- Stress Analysis  
- Research in region-based deep learning  

---

## 🤝 Contributions
Pull requests for new features, optimizations, and improvements are welcome.

--- 
