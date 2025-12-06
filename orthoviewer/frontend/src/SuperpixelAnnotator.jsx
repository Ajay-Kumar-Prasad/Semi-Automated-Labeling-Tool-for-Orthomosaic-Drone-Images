import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const LABEL_COLORS = {
  good: "rgba(120, 255, 154, 0.45)",
  moderate: "rgba(255, 179, 71, 0.45)",
  bad: "rgba(255, 99, 99, 0.45)",
};

export default function SuperpixelAnnotator({ imageUrl, segmentsMeta }) {
  const [labels, setLabels] = useState({});
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [currentLabel, setCurrentLabel] = useState("good");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

 
  useEffect(() => {
    async function loadLabels() {
      try {
        const res = await axios.get(
          `http://127.0.0.1:5000/labels/${segmentsMeta.image_id}`
        );
        setLabels(res.data || {});
      } catch (e) {}
    }
    loadLabels();
  }, [segmentsMeta.image_id]);

 
  useEffect(() => {
    const handleKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      switch (e.key.toLowerCase()) {
        case "1":
          setCurrentLabel("good");
          break;
        case "2":
          setCurrentLabel("moderate");
          break;
        case "3":
          setCurrentLabel("bad");
          break;
        case "e":
          setCurrentLabel("erase");
          break;
        case "z":
          if (e.shiftKey) redo();
          else undo();
          break;
        case "y":
          redo();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undoStack, redoStack]);


  function postLabel(id, label) {
    axios.post("http://127.0.0.1:5000/save_label", {
      image_id: segmentsMeta.image_id,
      superpixel_id: id,
      label,
      user: "web_user",
    });
  }

  function recordAction(id, prevLabel, newLabel) {
    setUndoStack((stack) => [...stack, { id, prevLabel, newLabel }]);
    setRedoStack([]);
  }

  function applyLabel(id, label) {
    const prevLabel = labels[id]?.label ?? "unlabeled";
    const newLabel = label;

    recordAction(id, prevLabel, newLabel);
    const newLabels = { ...labels, [id]: { label, ts: Date.now() } };

    setLabels(newLabels);
    setSelectedId(id);
    postLabel(id, label);
  }

  function removeLabel(id) {
    const prevLabel = labels[id]?.label ?? "unlabeled";
    recordAction(id, prevLabel, "unlabeled");

    const newLabels = { ...labels };
    delete newLabels[id];

    setLabels(newLabels);
    setSelectedId(id);
    postLabel(id, "unlabeled");
  }

  function undo() {
    if (undoStack.length === 0) return;
    const action = undoStack.at(-1);
    const { id, prevLabel } = action;

    setRedoStack((s) => [...s, action]);
    setUndoStack((s) => s.slice(0, -1));

    const updated = { ...labels };
    if (prevLabel === "unlabeled") delete updated[id];
    else updated[id] = { label: prevLabel, ts: Date.now() };

    setLabels(updated);
    postLabel(id, prevLabel);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack.at(-1);
    const { id, newLabel } = action;

    setUndoStack((s) => [...s, action]);
    setRedoStack((s) => s.slice(0, -1));

    const updated = { ...labels };
    if (newLabel === "unlabeled") delete updated[id];
    else updated[id] = { label: newLabel, ts: Date.now() };

    setLabels(updated);
    postLabel(id, newLabel);
  }

  function polygonPoints(poly) {
    return poly.map((p) => p.join(",")).join(" ");
  }


  const counts = {
    good: Object.values(labels).filter((x) => x.label === "good").length,
    moderate: Object.values(labels).filter((x) => x.label === "moderate").length,
    bad: Object.values(labels).filter((x) => x.label === "bad").length,
  };

 
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      {}
      <div
        style={{
          width: 180,
          padding: "10px 12px",
          background: "#111",
          color: "#ddd",
          borderRight: "1px solid #333",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#ccc" }}>Labels</h3>

        {["good", "moderate", "bad"].map((lbl) => (
          <div
            key={lbl}
            onClick={() => setCurrentLabel(lbl)}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              cursor: "pointer",
              marginBottom: 6,
              background:
                currentLabel === lbl ? LABEL_COLORS[lbl].replace("0.45", "1") : "#222",
              color: currentLabel === lbl ? "#000" : "#bbb",
              fontWeight: currentLabel === lbl ? "bold" : "normal",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{margin:"10px"}}>{lbl.toUpperCase()}</span>
    
            <span style={{color:" #ff0000"}} >{counts[lbl]}</span>
          </div>
        ))}

        <div
          onClick={() => setCurrentLabel("erase")}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: currentLabel === "erase" ? "#666" : "#222",
            color: currentLabel === "erase" ? "#fff" : "#bbb",
            cursor: "pointer",
            marginTop: 10,
          }}
        >
          ERASE
        </div>
      </div>

      {}
      <div style={{ flexGrow: 1, padding: 12 }}>
        {}
        <div style={{ marginBottom: 12 }}>
          <button onClick={undo} disabled={undoStack.length === 0}>Undo</button>
          <button onClick={redo} style={{ marginLeft: 6 }} disabled={redoStack.length === 0}>
            Redo
          </button>
          <span style={{ marginLeft: 12, color: "#b388ff" }}>
            Selected: <strong>{currentLabel.toUpperCase()}</strong>
          </span>
        </div>

        {}
        <TransformWrapper minScale={0.5} maxScale={10} wheel={{ step: 0.2 }} doubleClick={{ disabled: true }}>
          <TransformComponent>
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={imageUrl} style={{ display: "block", width: "100%" }} />

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
                  const isSelected = id === selectedId;
                  const isHovered = id === hoverId;

                  const stroke = isSelected
                    ? "yellow"
                    : isHovered
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(0,0,0,0.3)";
                  const strokeWidth = isSelected ? 2 : 0.7;

                  return (
                    <polygon
                      key={id}
                      points={polygonPoints(s.polygon)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      style={{ cursor: "pointer", pointerEvents: "all" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(id);
                        currentLabel === "erase"
                          ? removeLabel(id)
                          : applyLabel(id, currentLabel);
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

        {}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => {
              const payload = { image_id: segmentsMeta.image_id, labels };
              const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
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
              const res = await axios.get(
                `http://127.0.0.1:5000/labels/${segmentsMeta.image_id}`
              );
              setLabels(res.data || {});
              setUndoStack([]);
              setRedoStack([]);
              setSelectedId(null);
            }}
          >
            Reload labels
          </button>
        </div>
      </div>
    </div>
  );
}
