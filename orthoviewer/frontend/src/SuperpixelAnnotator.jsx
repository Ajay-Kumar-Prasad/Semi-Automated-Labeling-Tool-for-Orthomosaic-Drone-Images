import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const LABEL_COLORS = {
  good: "rgba(120, 255, 154, 0.45)",
  moderate: "rgba(255, 179, 71, 0.45)",
  bad: "rgba(255, 99, 99, 0.45)"
};

export default function SuperpixelAnnotator({ imageUrl, segmentsMeta }) {
  const [labels, setLabels] = useState({});
  const [hoverId, setHoverId] = useState(null);
  const [currentLabel, setCurrentLabel] = useState("good");


  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  useEffect(() => {
    async function loadLabels() {
      try {
        const res = await axios.get(`http://127.0.0.1:5000/labels/${segmentsMeta.image_id}`);
        setLabels(res.data || {});
      } catch (e) {}
    }
    loadLabels();
  }, [segmentsMeta.image_id]);

  // Save to backend helper
  function postLabel(id, label) {
    axios.post("http://127.0.0.1:5000/save_label", {
      image_id: segmentsMeta.image_id,
      superpixel_id: id,
      label,
      user: "web_user"
    });
  }

  // ==== ACTION RECORDING WRAPPER ====
  function recordAction(id, prevLabel, newLabel) {
    setUndoStack((stack) => [...stack, { id, prevLabel, newLabel }]);
    setRedoStack([]); // clear redo on new action
  }

  function applyLabel(id, label) {
    const prevLabel = labels[id]?.label ?? "unlabeled";
    const newLabel = label;

    recordAction(id, prevLabel, newLabel);

    const newLabels = { ...labels, [id]: { label, ts: Date.now() } };
    setLabels(newLabels);
    postLabel(id, label);
  }

  function removeLabel(id) {
    const prevLabel = labels[id]?.label ?? "unlabeled";
    const newLabel = "unlabeled";

    recordAction(id, prevLabel, newLabel);

    const newLabels = { ...labels };
    delete newLabels[id];
    setLabels(newLabels);

    postLabel(id, "unlabeled");
  }

  // ==== UNDO ====
  function undo() {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    const { id, prevLabel, newLabel } = action;

    // Move to redo stack
    setRedoStack((stack) => [...stack, action]);
    setUndoStack((stack) => stack.slice(0, -1));

    // Apply previous label
    const updated = { ...labels };
    if (prevLabel === "unlabeled") delete updated[id];
    else updated[id] = { label: prevLabel, ts: Date.now() };

    setLabels(updated);
    postLabel(id, prevLabel);
  }

  // ==== REDO ====
  function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    const { id, prevLabel, newLabel } = action;

    setUndoStack((stack) => [...stack, action]);
    setRedoStack((stack) => stack.slice(0, -1));

    const updated = { ...labels };
    if (newLabel === "unlabeled") delete updated[id];
    else updated[id] = { label: newLabel, ts: Date.now() };

    setLabels(updated);
    postLabel(id, newLabel);
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

        {/* ==== UNDO/REDO BUTTONS ==== */}
        <button
          onClick={undo}
          style={{ marginLeft: 20, padding: "6px 10px" }}
          disabled={undoStack.length === 0}
        >
          Undo
        </button>

        <button
          onClick={redo}
          style={{ marginLeft: 6, padding: "6px 10px" }}
          disabled={redoStack.length === 0}
        >
          Redo
        </button>

        <span style={{ marginLeft: 12, color: "#b388ff" }}>
          Selected: <strong>{currentLabel.toUpperCase()}</strong>
        </span>
      </div>

      {/* ZOOM + PAN */}
      <TransformWrapper minScale={0.5} maxScale={10} wheel={{ step: 0.2 }} doubleClick={{ disabled: true }}>
        <TransformComponent>
          <div style={{ position: "relative", display: "inline-block" }}>
            <img src={imageUrl} alt="orthomosaic" style={{ display: "block", width: "100%", height: "auto" }} />

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
            setUndoStack([]);
            setRedoStack([]);
          }}
        >
          Reload labels
        </button>
      </div>
    </div>
  );
}
