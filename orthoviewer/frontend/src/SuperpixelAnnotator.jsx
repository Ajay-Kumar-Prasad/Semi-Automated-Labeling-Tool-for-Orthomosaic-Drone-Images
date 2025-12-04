import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

/*
 Props:
  - imageUrl: "http://127.0.0.1:5000/uploads/<filename>"
  - segmentsMeta: object returned by /segment (polygons, features, image_shape)
*/

const LABEL_COLORS = {
  good: "rgba(120, 255, 154, 0.45)",
  moderate: "rgba(255, 179, 71, 0.45)",
  bad: "rgba(255, 99, 99, 0.45)"
};

export default function SuperpixelAnnotator({ imageUrl, segmentsMeta }) {
  const [labels, setLabels] = useState({});
  const [hoverId, setHoverId] = useState(null);
  const [currentLabel, setCurrentLabel] = useState("good"); // good | moderate | bad | erase

  useEffect(() => {
    async function loadLabels() {
      try {
        const res = await axios.get(`http://127.0.0.1:5000/labels/${segmentsMeta.image_id}`);
        setLabels(res.data || {});
      } catch (e) {}
    }
    loadLabels();
  }, [segmentsMeta.image_id]);

  function applyLabel(id, label) {
    const newLabels = { ...labels };
    newLabels[id] = { label, ts: Date.now() };
    setLabels(newLabels);

    axios.post("http://127.0.0.1:5000/save_label", {
      image_id: segmentsMeta.image_id,
      superpixel_id: id,
      label,
      user: "web_user"
    });
  }

  function removeLabel(id) {
    const newLabels = { ...labels };
    delete newLabels[id];
    setLabels(newLabels);

    axios.post("http://127.0.0.1:5000/save_label", {
      image_id: segmentsMeta.image_id,
      superpixel_id: id,
      label: "unlabeled",
      user: "web_user"
    });
  }

  function polygonPoints(polygon) {
    return polygon.map((p) => p.join(",")).join(" ");
  }

  return (
    <div style={{ position: "relative", maxWidth: "100%", background: "#000", padding: 8 }}>
      
      {/* LABEL BUTTONS */}
      <div style={{ marginBottom: 12 }}>
        {["good", "moderate", "bad"].map((lbl) => (
          <button
            key={lbl}
            onClick={() => setCurrentLabel(lbl)}
            style={{
              padding: "6px 12px",
              marginRight: 6,
              borderRadius: "6px",
              cursor: "pointer",
              background: currentLabel === lbl
                ? (lbl === "good" ? "#78ff9a" : lbl === "moderate" ? "#ffb347" : "#ff6363")
                : "#222",
              color: currentLabel === lbl ? "#000" : "#ddd",
              border: "1px solid #444",
            }}
          >
            {lbl.charAt(0).toUpperCase() + lbl.slice(1)}
          </button>
        ))}

        {/* ERASE TOOL */}
        <button
          onClick={() => setCurrentLabel("erase")}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            background: currentLabel === "erase" ? "#555" : "#222",
            color: currentLabel === "erase" ? "#fff" : "#aaa",
            border: "1px solid #444",
            cursor: "pointer",
            marginLeft: 6
          }}
        >
          Erase
        </button>

        <span style={{ marginLeft: 12, color: "#b388ff" }}>
          Selected: <strong>{currentLabel.toUpperCase()}</strong>
        </span>
      </div>

      {/* ZOOM + PAN WRAPPER */}
      <TransformWrapper
        minScale={0.5}
        maxScale={10}
        wheel={{ step: 0.2 }}
        doubleClick={{ disabled: true }}
        pinch={{ disabled: false }}
      >
        <TransformComponent>
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={imageUrl}
              alt="orthomosaic"
              style={{ display: "block", width: "100%", height: "auto" }}
            />

            <svg
              viewBox={`0 0 ${segmentsMeta.image_shape[1]} ${segmentsMeta.image_shape[0]}`}
              preserveAspectRatio="xMinYMin meet"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >

              {segmentsMeta.polygons.map((s) => {
                const id = s.id;
                const labelObj = labels[id];
                const fill = labelObj ? LABEL_COLORS[labelObj.label] : "rgba(0,0,0,0)";
                const stroke = hoverId === id ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)";

                return (
                  <polygon
                    key={id}
                    points={polygonPoints(s.polygon)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.7}
                    style={{ cursor: "pointer", pointerEvents: "all" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentLabel === "erase") removeLabel(id);
                      else applyLabel(id, currentLabel);
                    }}
                    onMouseEnter={() => setHoverId(id)}
                    onMouseLeave={() => setHoverId(null)}
                  />
                );
              })}
            </svg>
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* DOWNLOAD + RELOAD */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={async () => {
            const payload = { image_id: segmentsMeta.image_id, labels };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
              type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${segmentsMeta.image_id}_labels.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download labels JSON
        </button>

        <button
          style={{ marginLeft: 8 }}
          onClick={async () => {
            const res = await axios.get(`http://127.0.0.1:5000/labels/${segmentsMeta.image_id}`);
            setLabels(res.data || {});
          }}
        >
          Reload labels
        </button>
      </div>
    </div>
  );
}
