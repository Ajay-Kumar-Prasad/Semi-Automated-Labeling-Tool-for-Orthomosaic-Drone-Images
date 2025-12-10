import React, { useState } from "react";
import axios from "axios";
import SuperpixelAnnotator from "./SuperpixelAnnotator";
import "./App.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [segmentsMeta, setSegmentsMeta] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [nSegments, setNSegments] = useState(800);
  const [compactness, setCompactness] = useState(10);
  const [loadId, setLoadId] = useState("");

  const BASE = "http://127.0.0.1:5000";

  function onFileChange(e) {
    setFile(e.target.files[0]);
  }

  async function upload() {
    if (!file) return alert("Please select an image file first.");

    const fd = new FormData();
    fd.append("image", file);

    const res = await axios.post(`${BASE}/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const savedFilename = res.data.filename;
    setImageUrl(`${BASE}/uploads/${savedFilename}`);

    const segRes = await axios.post(`${BASE}/segment`, {
      image_filename: savedFilename,
      n_segments: nSegments,
      compactness,
    });

    setSegmentsMeta(segRes.data);
  }

  async function handleLoad() {
    if (!loadId.trim()) return;

    const res = await axios.get(`${BASE}/segments/${loadId}`);
    setSegmentsMeta(res.data);

    setImageUrl(`${BASE}/uploads/${res.data.image_filename}`);
  }

  return (
    <div className="app">
      <h1 className="app-title">Orthomosaic Superpixel Annotator</h1>
      <p className="app-subtitle">Semi-automated crop health patch labeling tool</p>

      {/* ===========================================================
          TOP CONTROL PANEL
      =========================================================== */}
      <div className="top-controls">

        {/* Upload Card */}
        <div className="control-card">
          <div className="control-title">Upload Image</div>

          <div className="field-row">
            <div className="field-label">Choose file</div>
            <input type="file" className="field-input" onChange={onFileChange} />
          </div>

          <button onClick={upload}>Upload & Segment</button>
        </div>

        {/* Segmentation Card */}
        <div className="control-card">
          <div className="control-title">Segmentation Settings</div>

          <div className="field-row">
            <div className="field-label">Segments</div>
            <input
              type="number"
              className="field-input"
              value={nSegments}
              onChange={(e) => setNSegments(e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field-label">Compactness</div>
            <input
              type="number"
              className="field-input"
              value={compactness}
              onChange={(e) => setCompactness(e.target.value)}
            />
          </div>
        </div>

        {/* Load Session Card */}
        <div className="control-card">
          <div className="control-title">Load Previous Session</div>

          <div className="load-controls">
            <input
              className="field-input"
              placeholder="Enter image_id"
              value={loadId}
              onChange={(e) => setLoadId(e.target.value)}
            />

            <button className="secondary" onClick={handleLoad}>Load</button>
          </div>
        </div>

      </div>

      {/* ===========================================================
          ANNOTATOR
      =========================================================== */}
      {imageUrl && segmentsMeta ? (
        <SuperpixelAnnotator imageUrl={imageUrl} segmentsMeta={segmentsMeta} />
      ) : (
        <div className="empty-state">Upload an orthomosaic image to begin annotation.</div>
      )}
    </div>
  );
}
