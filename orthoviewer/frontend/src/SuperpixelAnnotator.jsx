import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "./App.css";

const LABEL_COLORS = {
  green: "rgba(120, 255, 154, 0.45)",
  yellow: "rgba(255, 255, 100, 0.45)",
  others: "rgba(79, 40, 2, 0.45)",
};

export default function SuperpixelAnnotator({ imageUrl, segmentsMeta }) {
  const [zoom, setZoom] = useState(1);
  const [labels, setLabels] = useState({});
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [currentLabel, setCurrentLabel] = useState("green");

  const wrapperRef = useRef(null);
  const imgRef = useRef(null);

  const segH = segmentsMeta.seg_shape?.[0] ?? segmentsMeta.image_shape?.[0];
  const segW = segmentsMeta.seg_shape?.[1] ?? segmentsMeta.image_shape?.[1];

  /* LOAD EXISTING LABELS */
  useEffect(() => {
    axios
      .get(`http://127.0.0.1:5000/labels/${segmentsMeta.image_id}`)
      .then((res) => setLabels(res.data || {}))
      .catch(() => {});
  }, [segmentsMeta.image_id]);

  /* SAVE LABEL */
  function postLabel(id, label) {
    axios.post("http://127.0.0.1:5000/save_label", {
      image_id: segmentsMeta.image_id,
      superpixel_id: id,
      label,
      user: "web_user",
    });
  }

  function applyLabel(id, label) {
    const updated = { ...labels, [id]: { label, ts: Date.now() } };
    setLabels(updated);
    setSelectedId(id);
    postLabel(id, label);
  }

  function removeLabel(id) {
    const updated = { ...labels };
    delete updated[id];
    setLabels(updated);
    setSelectedId(id);
    postLabel(id, "unlabeled");
  }

  function polygonPoints(poly) {
    return poly.map((p) => p.join(",")).join(" ");
  }

  const counts = {
    green: Object.values(labels).filter((x) => x.label === "green").length,
    yellow: Object.values(labels).filter((x) => x.label === "yellow").length,
    others: Object.values(labels).filter((x) => x.label === "others").length,
  };

  /* AUTO-FIT IMAGE */
  useEffect(() => {
    if (!imgRef.current || !wrapperRef.current) return;

    setTimeout(() => {
      const imgWidth = imgRef.current.naturalWidth;
      const imgHeight = imgRef.current.naturalHeight;

      const container = imgRef.current.closest(".annotator-main");
      if (!container) return;

      const scale = Math.min(
        container.clientWidth / imgWidth,
        container.clientHeight / imgHeight
      );

      wrapperRef.current.setTransform(0, 0, scale);
      setZoom(scale);
    }, 150);
  }, [imageUrl]);

  /* FIXED handleZoom — INSIDE component */
  function handleZoom(value) {
    const newZoom = parseFloat(value);
    setZoom(newZoom);

    if (wrapperRef.current) {
      const state = wrapperRef.current.state;
      wrapperRef.current.setTransform(state.positionX, state.positionY, newZoom);
    }
  }

  return (
    <div className="annotator-layout">
      {/* SIDEBAR */}
      <div className="annotator-sidebar">
        <h3>Labels</h3>

        {["green", "yellow", "others"].map((lbl) => (
          <div
            key={lbl}
            className={`label-box label-${lbl} ${
              currentLabel === lbl ? "active" : ""
            }`}
            onClick={() => setCurrentLabel(lbl)}
          >
            <span>{lbl.toUpperCase()}</span>
            <span>{counts[lbl]}</span>
          </div>
        ))}

        <div
          className={`label-erase ${currentLabel === "erase" ? "active" : ""}`}
          onClick={() => setCurrentLabel("erase")}
        >
          ERASE
        </div>

        <hr />

        <button
          className="side-btn"
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify({ image_id: segmentsMeta.image_id, labels }, null, 2)],
              { type: "application/json" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${segmentsMeta.image_id}_labels.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download Labels JSON
        </button>
      </div>

      {/* MAIN VIEWER */}
      <div className="annotator-main">
        <div className="zoom-tools">
          <button onClick={() => wrapperRef.current.zoomIn()}>+</button>

          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={zoom}
            onChange={(e) => handleZoom(e.target.value)}
            className="zoom-slider"
          />

          <button onClick={() => wrapperRef.current.zoomOut()}>-</button>

          <button
            onClick={() => {
              wrapperRef.current.resetTransform();
              setZoom(1);
            }}
          >
            Reset
          </button>
        </div>

        <TransformWrapper
          ref={wrapperRef}
          minScale={0.1}
          maxScale={20}
          wheel={{ step: 0.15 }}
          onTransformed={(ref) => setZoom(ref.state.scale)}
        >
          <TransformComponent>
            <div className="img-container">
              <img ref={imgRef} src={imageUrl} className="annotator-img" />

              <svg
                className="annotator-svg"
                viewBox={`0 0 ${segW} ${segH}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {segmentsMeta.polygons.map((s) => {
                  const id = s.id;
                  const labelName = labels[id]?.label;

                  return (
                    <polygon
                      key={id}
                      points={polygonPoints(s.polygon)}
                      fill={LABEL_COLORS[labelName] || "rgba(0,0,0,0)"}
                      stroke={
                        selectedId === id
                          ? "yellow"
                          : hoverId === id
                          ? "white"
                          : "rgba(255,255,255,0.25)"
                      }
                      strokeWidth={selectedId === id ? 2 : 0.6}
                      onMouseEnter={() => setHoverId(id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        currentLabel === "erase"
                          ? removeLabel(id)
                          : applyLabel(id, currentLabel);
                      }}
                    />
                  );
                })}
              </svg>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}
