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
  const [loading, setLoading] = useState(false);

  // Vite-safe API base
  const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

  function onFileChange(e) {
    if (!e.target.files?.length) return;
    setFile(e.target.files[0]);
  }

  async function upload() {
    if (!file) {
      alert("Please select an image file first.");
      return;
    }

    if (loading) return;

    setLoading(true);
    setSegmentsMeta(null);
    setImageUrl(null);

    try {
      const fd = new FormData();
      fd.append("image", file);

      // Upload (backend returns PREVIEW filename)
      const uploadRes = await axios.post(`${BASE}/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const previewFilename = uploadRes.data.filename;

      // IMPORTANT: frontend always uses preview image
      setImageUrl(`${BASE}/uploads/${previewFilename}`);

      // Segment using the same preview image
      const segRes = await axios.post(`${BASE}/segment`, {
        image_filename: previewFilename,
        n_segments: nSegments,
        compactness: compactness,
      });

      setSegmentsMeta(segRes.data);
    } catch (err) {
      console.error(err);
      alert("Upload or segmentation failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoad() {
    if (!loadId.trim() || loading) return;

    setLoading(true);

    try {
      const res = await axios.get(`${BASE}/segments/${loadId}`);
      setSegmentsMeta(res.data);

      // Loaded sessions also use preview images
      setImageUrl(`${BASE}/uploads/${res.data.image_filename}`);
    } catch (err) {
      console.error(err);
      alert("Failed to load session. Invalid image_id?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1 className="app-title">Orthomosaic Superpixel Annotator</h1>
      <p className="app-subtitle">
        Semi-automated crop health patch labeling tool
      </p>

      {/* ================= TOP CONTROLS ================= */}
      <div className="top-controls">

        {/* Upload */}
        <div className="control-card">
          <div className="control-title">Upload Image</div>

          <div className="field-row">
            <div className="field-label">Choose file</div>
            <input
              type="file"
              className="field-input"
              accept=".tif,.tiff,.png,.jpg,.jpeg"
              onChange={onFileChange}
              disabled={loading}
            />
          </div>

          <button onClick={upload} disabled={loading}>
            {loading ? "Processing…" : "Upload & Segment"}
          </button>
        </div>

        {/* Segmentation */}
        <div className="control-card">
          <div className="control-title">Segmentation Settings</div>

          <div className="field-row">
            <div className="field-label">Segments</div>
            <input
              type="number"
              className="field-input"
              value={nSegments}
              onChange={(e) => setNSegments(Number(e.target.value))}
              disabled={loading}
            />
          </div>

          <div className="field-row">
            <div className="field-label">Compactness</div>
            <input
              type="number"
              className="field-input"
              value={compactness}
              onChange={(e) => setCompactness(Number(e.target.value))}
              disabled={loading}
            />
          </div>
        </div>

        {/* Load Session */}
        <div className="control-card">
          <div className="control-title">Load Previous Session</div>

          <div className="load-controls">
            <input
              className="field-input"
              placeholder="Enter image_id"
              value={loadId}
              onChange={(e) => setLoadId(e.target.value)}
              disabled={loading}
            />

            <button
              className="secondary"
              onClick={handleLoad}
              disabled={loading}
            >
              Load
            </button>
          </div>
        </div>

      </div>

      {/* ================= ANNOTATOR ================= */}
      {imageUrl && segmentsMeta ? (
        <SuperpixelAnnotator
          imageUrl={imageUrl}
          segmentsMeta={segmentsMeta}
        />
      ) : (
        <div className="empty-state">
          Upload an orthomosaic image to begin annotation.
        </div>
      )}
    </div>
  );
}
