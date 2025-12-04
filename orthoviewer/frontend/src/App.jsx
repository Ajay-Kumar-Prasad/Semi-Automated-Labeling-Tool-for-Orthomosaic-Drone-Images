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

  function onFileChange(e) {
    setFile(e.target.files[0]);
  }

  async function upload() {
    if (!file) return alert("Please select a file");

    const fd = new FormData();
    fd.append("image", file);

    // 1. UPLOAD TO BACKEND
    const res = await axios.post(
      "http://127.0.0.1:5000/upload",
      fd,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    const savedFilename = res.data.filename;
    const imageID = res.data.image_id;

    // Image served from backend URL
    setImageUrl(`http://127.0.0.1:5000/uploads/${savedFilename}`);

    // 2. RUN SEGMENTATION
    const segRes = await axios.post(
      "http://127.0.0.1:5000/segment",
      {
        image_filename: savedFilename,
        n_segments: nSegments,
        compactness,
      }
    );

    setSegmentsMeta(segRes.data);
  }

  async function loadSegmentsById(image_id) {
    const res = await axios.get(`http://127.0.0.1:5000/segments/${image_id}`);

    setSegmentsMeta(res.data);

    // Load image preview
    setImageUrl(`http://127.0.0.1:5000/uploads/${res.data.image_filename}`);
  }

  async function handleLoad() {
    if (!loadId) return;
    await loadSegmentsById(loadId);
  }

  return (
    <div className="app">
      <h1 style={{ color: "#b388ff" }}>Semi-automated Superpixel Labeler</h1>

      <div className="controls">
        <div className="uploader">
          <input type="file" onChange={onFileChange} />
          <button onClick={upload} style={{ marginLeft: 8 }}>
            Upload & Segment
          </button>
        </div>

        <div style={{ marginLeft: 16 }}>
          <label>n_segments: </label>
          <input
            type="number"
            value={nSegments}
            onChange={(e) => setNSegments(e.target.value)}
            style={{ width: 100 }}
          />

          <label style={{ marginLeft: 8 }}>compactness: </label>
          <input
            type="number"
            value={compactness}
            onChange={(e) => setCompactness(e.target.value)}
            style={{ width: 100 }}
          />
        </div>

        <div style={{ marginLeft: 16 }}>
          <input
            placeholder="Load image_id"
            value={loadId}
            onChange={(e) => setLoadId(e.target.value)}
          />
          <button onClick={handleLoad} style={{ marginLeft: 8 }}>
            Load by ID
          </button>
        </div>
      </div>

      {imageUrl && segmentsMeta ? (
        <SuperpixelAnnotator
          imageUrl={imageUrl}
          segmentsMeta={segmentsMeta}
        />
      ) : (
        <div style={{ marginTop: 24 }}>
          No image segmented yet. Upload a PNG/JPG/TIF to start.
        </div>
      )}
    </div>
  );
}
