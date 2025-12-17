import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "./App.css";

const LABEL_COLORS = {
  green: "rgba(120, 255, 154, 0.45)",
  yellow: "rgba(255, 255, 100, 0.45)",
  others: "rgba(79, 40, 2, 0.45)",
};

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export default function SuperpixelAnnotator({ imageUrl, segmentsMeta }) {
  const [zoom, setZoom] = useState(1);
  const [labels, setLabels] = useState({});
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [currentLabel, setCurrentLabel] = useState("green");
  const [saving, setSaving] = useState(false);

  const wrapperRef = useRef(null);
  const imgRef = useRef(null);
  const saveTimer = useRef(null);

  const segH = segmentsMeta.seg_shape?.[0];
  const segW = segmentsMeta.seg_shape?.[1];

  /* -------------------------------------------------------
     LOAD EXISTING LABELS
  ------------------------------------------------------- */
  useEffect(() => {
    let alive = true;

    axios
      .get(`${BASE}/labels/${segmentsMeta.image_id}`)
      .then((res) => {
        if (alive) setLabels(res.data || {});
      })
      .catch(() => {
        if (alive) setLabels({});
      });

    return () => {
      alive = false;
    };
  }, [segmentsMeta.image_id]);

  /* -------------------------------------------------------
     DEBOUNCED SAVE (SAFE)
  ------------------------------------------------------- */
  function postLabel(spid, label) {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await axios.post(`${BASE}/save_label`, {
          image_id: segmentsMeta.image_id,
          superpixel_id: spid,
          label,
          user: "web_user",
        });
      } catch (err) {
        console.error("Save failed:", err);
        alert("Label save failed. Please retry.");
      } finally {
        setSaving(false);
      }
    }, 150);
  }

  function applyLabel(id, label) {
    const sid = String(id);

    setLabels((prev) => ({
      ...prev,
      [sid]: {
        ...(prev[sid] || {}),
        label,
        ts: Date.now(),
        user: "web_user",
      },
    }));

    setSelectedId(sid);
    postLabel(sid, label);
  }

  function removeLabel(id) {
    const sid = String(id);

    setLabels((prev) => {
      const copy = { ...prev };
      delete copy[sid];
      return copy;
    });

    setSelectedId(sid);
    postLabel(sid, "unlabeled");
  }

  function polygonPoints(poly) {
    return poly.map((p) => `${p[0]},${p[1]}`).join(" ");
  }

  const counts = {
    green: Object.values(labels).filter((x) => x.label === "green").length,
    yellow: Object.values(labels).filter((x) => x.label === "yellow").length,
    others: Object.values(labels).filter((x) => x.label === "others").length,
  };

  /* -------------------------------------------------------
     AUTO-FIT IMAGE (PREVIEW SAFE)
  ------------------------------------------------------- */
  useEffect(() => {
    if (!imgRef.current || !wrapperRef.current) return;

    const timer = setTimeout(() => {
      const imgW = imgRef.current.naturalWidth;
      const imgH = imgRef.current.naturalHeight;

      const container = imgRef.current.closest(".annotator-main");
      if (!container) return;

      const scale = Math.min(
        container.clientWidth / imgW,
        container.clientHeight / imgH
      );

      wrapperRef.current.setTransform(0, 0, scale);
      setZoom(scale);
    }, 150);

    return () => clearTimeout(timer);
  }, [imageUrl]);

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
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
          disabled={saving}
          onClick={() => {
            const blob = new Blob(
              [
                JSON.stringify(
                  { image_id: segmentsMeta.image_id, labels },
                  null,
                  2
                ),
              ],
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
        <TransformWrapper
          ref={wrapperRef}
          minScale={0.1}
          maxScale={20}
          wheel={{ step: 0.15 }}
          onTransformed={(ref) => setZoom(ref.state.scale)}
        >
          <TransformComponent>
            <div className="img-container">
              <img
                ref={imgRef}
                src={imageUrl}
                className="annotator-img"
                draggable={false}
              />

              <svg
                className="annotator-svg"
                viewBox={`0 0 ${segW} ${segH}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {segmentsMeta.polygons.map((s) => {
                  const sid = String(s.id);
                  const labelName = labels[sid]?.label;

                  return (
                    <polygon
                      key={sid}
                      points={polygonPoints(s.polygon)}
                      fill={LABEL_COLORS[labelName] || "transparent"}
                      stroke={
                        selectedId === sid
                          ? "yellow"
                          : hoverId === sid
                          ? "white"
                          : "rgba(255,255,255,0.25)"
                      }
                      strokeWidth={selectedId === sid ? 2 : 0.6}
                      onMouseEnter={() => setHoverId(sid)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        currentLabel === "erase"
                          ? removeLabel(sid)
                          : applyLabel(sid, currentLabel);
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
