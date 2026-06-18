import React, { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";

const DR_LABELS = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"];
const DR_ICONS = ["✅", "🟡", "🟠", "🔴", "🚨"];
const BAR_COLORS = ["#2d6a9f", "#2d6a9f", "#6a7a2d", "#d4a47a", "#d47a7a"];
const DIAG_BORDER = ["#2d6a9f", "#2d6a9f", "#6a7a2d", "#7a4e2d", "#7a2d2d"];

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png"];

function isAllowedType(file) {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = "." + file.name.split(".").pop().toLowerCase();
  return ALLOWED_EXTS.includes(ext);
}

async function verifyFundusImage(file) {
  const fd = new FormData();
  fd.append("file", file);

  try {
    const res = await axios.post(`${process.env.REACT_APP_API_URL}/verify`, fd);

    return res.data;
  } catch {
    return {
      is_fundus: true,
      reason: "Verification unavailable — proceeding.",
    };
  }
}

// ─── Toast component ──────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const ext = toast.filename
    ? "." + toast.filename.split(".").pop().toUpperCase()
    : "file";

  return (
    <div style={s.toast}>
      <div style={s.toastIcon}>
        <span style={{ fontSize: 20 }}>🚫</span>
      </div>
      <div style={s.toastBody}>
        <div style={s.toastTitle}>Unsupported file type</div>
        <div style={s.toastMsg}>
          <span style={s.toastExt}>{ext}</span> files are not accepted. Please
          upload a <span style={s.toastAccent}>JPG</span> or{" "}
          <span style={s.toastAccent}>PNG</span> image.
        </div>
        {toast.filename && <div style={s.toastFile}>"{toast.filename}"</div>}
      </div>
      <button style={s.toastClose} onClick={onDismiss}>
        ✕
      </button>
      <div style={s.toastProgress}>
        <div style={s.toastProgressBar} />
      </div>
    </div>
  );
}

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState(null);
  const inputRef = useRef();
  const isMobile = useIsMobile();

  const showToast = (filename) => setToast({ filename });
  const dismissToast = useCallback(() => setToast(null), []);

  const loadFile = useCallback(
    (f) => {
      if (!f) return;
      if (!isAllowedType(f)) {
        showToast(f.name);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      if (preview) URL.revokeObjectURL(preview);
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setError(null);
      setStatus("idle");
    },
    [preview],
  );

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    loadFile(e.dataTransfer.files[0]);
  };

  const predict = async () => {
    if (!file || status === "verifying" || status === "predicting") return;

    setStatus("verifying");
    setError(null);
    const verification = await verifyFundusImage(file);
    if (!verification.is_fundus) {
      setStatus("error");
      setError(verification.reason);
      return;
    }

    setStatus("predicting");
    const fd = new FormData();
    fd.append("file", file);
    try {
      console.log("API URL:", process.env.REACT_APP_API_URL);
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/predict`,
        fd,
      );
      setResult(res.data);
      setStatus("done");
    } catch(err) {
      console.log(err)
      setStatus("error");
      setError(err.response?.data?.error || err.message);
      // setError("Backend prediction failed. Is the Flask server running?");
    }
  };

  const isBusy = status === "verifying" || status === "predicting";
  const maxIdx = result
    ? result.probabilities.indexOf(Math.max(...result.probabilities))
    : -1;

  // ── Dynamic overrides based on viewport ──────────────────────────────────
  const uploadRow = isMobile
    ? { ...s.uploadRow, flexDirection: "column" }
    : s.uploadRow;
  const runBtn = isMobile
    ? { ...s.btn, minHeight: 48, width: "100%", fontSize: 15 }
    : s.btn;
  const gridStyle = isMobile
    ? { display: "flex", flexDirection: "column", gap: 12 }
    : s.grid;

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { transform: translateY(-6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes shrink    { from { width: 100%; } to { width: 0%; } }
      `}</style>

      <div style={s.app}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={s.header}>
          <div style={s.eye}>👁</div>
          <div>
            <div style={{ ...s.h1, fontSize: isMobile ? 16 : 19 }}>
              Diabetic Retinopathy Classification
            </div>
            <div style={s.sub}>Grad-CAM assisted fundus image analysis</div>
          </div>
        </div>

        {/* ── Upload row ─────────────────────────────────────────────────── */}
        <div style={uploadRow}>
          <div
            style={{ ...s.dropzone, ...(drag ? s.dropzoneActive : {}) }}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onClick={() => !file && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="*"
              style={{ display: "none" }}
              onChange={(e) => loadFile(e.target.files[0])}
            />
            <div style={s.uploadIco}>📁</div>
            <div style={s.uploadTxt}>
              <strong
                style={{ color: "#b0bdd0", display: "block", marginBottom: 3 }}
              >
                {file ? "Image loaded" : "Tap to upload"}
              </strong>
              <span style={s.badge}>JPG / PNG only</span>
              {file && <div style={s.fname}>{file.name}</div>}
            </div>
            {file && (
              <button
                style={s.removeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  clearImage();
                }}
                title="Remove image"
              >
                ✕
              </button>
            )}
          </div>

          <button
            style={{
              ...runBtn,
              ...(!file || isBusy ? s.btnOff : {}),
            }}
            onClick={predict}
            disabled={!file || isBusy}
          >
            {status === "verifying" ? (
              <>
                <span style={s.spinner} /> Verifying…
              </>
            ) : status === "predicting" ? (
              <>
                <span style={s.spinner} /> Analyzing…
              </>
            ) : file ? (
              "Run prediction"
            ) : (
              "Upload first"
            )}
          </button>
        </div>

        {/* ── File-type toast ─────────────────────────────────────────────── */}
        {toast && <Toast toast={toast} onDismiss={dismissToast} />}

        {/* ── Backend / fundus error banner ────────────────────────────────── */}
        {error && (
          <div style={s.errorBanner}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Three panels (stacked on mobile) ─────────────────────────────── */}
        <div style={gridStyle}>
          {/* Panel 1 – Original */}
          <Panel step={1} title="Original image" isMobile={isMobile}>
            {preview ? (
              <div style={{ position: "relative" }}>
                <div style={s.imgBox}>
                  <img src={preview} alt="fundus" style={s.img} />
                </div>
                <button
                  style={s.imgRemoveBtn}
                  onClick={clearImage}
                  title="Remove image"
                >
                  ✕
                </button>
              </div>
            ) : (
              <Placeholder icon="🖼" label="No image" />
            )}
            {file && <div style={s.dimLabel}>{file.name}</div>}
          </Panel>

          {/* Panel 2 – Grad-CAM */}
          <Panel step={2} title="Grad-CAM heatmap" isMobile={isMobile}>
            {result?.gradcam ? (
              <div style={s.imgBox}>
                <img
                  src={`data:image/jpeg;base64,${result.gradcam}`}
                  alt="gradcam"
                  style={s.img}
                />
              </div>
            ) : (
              <Placeholder
                icon="🔥"
                label={
                  status === "verifying"
                    ? "Verifying image…"
                    : status === "predicting"
                      ? "Generating…"
                      : status === "error"
                        ? "Unavailable"
                        : "After prediction"
                }
              />
            )}
            {result?.gradcam && (
              <div style={s.dimLabel}>224 × 224 px · Grad-CAM</div>
            )}
          </Panel>

          {/* Panel 3 – Classification result */}
          <Panel step={3} title="Classification result" isMobile={isMobile}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DR_LABELS.map((lbl, i) => {
                const pct = result
                  ? (result.probabilities[i] * 100).toFixed(1)
                  : null;
                const isMax = result && i === maxIdx;
                return (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        ...s.barLbl,
                        color: isMax ? "#b0bdd0" : "#8892a4",
                      }}
                    >
                      {lbl}
                    </span>
                    <div style={s.barTrack}>
                      <div
                        style={{
                          ...s.barFill,
                          width: pct ? `${pct}%` : "0%",
                          background: isMax ? BAR_COLORS[maxIdx] : "#2a3a52",
                          transition: "width .8s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        ...s.barPct,
                        color: isMax ? "#6a9fd8" : "#3d5470",
                      }}
                    >
                      {pct !== null ? `${pct}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                ...s.diagBox,
                borderColor: result ? DIAG_BORDER[maxIdx] : "#1e2d42",
              }}
            >
              <div style={s.diagTitle}>
                {result
                  ? `${DR_ICONS[maxIdx]} ${DR_LABELS[maxIdx]} DR`
                  : status === "error"
                    ? "⚠️ Invalid image"
                    : "Awaiting prediction"}
              </div>
              <div style={s.diagSub}>
                {result
                  ? maxIdx === 0
                    ? "No signs of DR detected"
                    : `Consistent with ${DR_LABELS[maxIdx].toLowerCase()} DR — consult specialist`
                  : error || "Run prediction to see classification"}
              </div>
              {result && (
                <div style={s.confPill}>
                  <div style={s.dotSmall} />
                  {(
                    result.confidence ?? result.probabilities[maxIdx] * 100
                  ).toFixed(1)}
                  % confidence
                </div>
              )}
            </div>
          </Panel>
        </div>

        <p style={s.note}>
          For clinical reference only · not a substitute for professional
          diagnosis
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Panel({ step, title, children, isMobile }) {
  // On mobile, make the image panels side-by-side
  return (
    <div style={s.panel}>
      <div style={s.phead}>
        <div style={s.snum}>{step}</div>
        <span style={s.ptitle}>{title}</span>
      </div>
      <div style={s.pbody}>{children}</div>
    </div>
  );
}

function Placeholder({ icon, label }) {
  return (
    <div style={s.placeholder}>
      <span style={{ fontSize: 28, opacity: 0.35 }}>{icon}</span>
      <span style={{ fontSize: 12, color: "#3d5470" }}>{label}</span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: {
    background: "#0a0e1a",
    minHeight: "100vh",
    fontFamily: "'DM Sans', Arial, sans-serif",
    color: "#e8eaf0",
  },
  app: { maxWidth: 960, margin: "0 auto", padding: "clamp(1rem, 4vw, 1.5rem)" },

  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: "1.25rem",
  },
  eye: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#1a3a5c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },
  h1: { fontWeight: 500, color: "#e8eaf0", letterSpacing: "-0.2px" },
  sub: { fontSize: 12, color: "#8892a4", marginTop: 1 },

  // uploadRow flex-direction is set dynamically
  uploadRow: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
    marginBottom: "1rem",
  },

  dropzone: {
    flex: 1,
    border: "1.5px dashed #2a3a52",
    borderRadius: 12,
    padding: "1rem 1.25rem",
    cursor: "pointer",
    background: "#0f1628",
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    transition: "border-color .2s",
    minHeight: 64,
  },
  dropzoneActive: { borderColor: "#3d7abf" },
  uploadIco: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#141e30",
    border: "1px solid #2a3a52",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  },
  uploadTxt: { fontSize: 13, color: "#8892a4", flex: 1 },
  badge: {
    fontSize: 10,
    fontFamily: "monospace",
    background: "#141e30",
    border: "1px solid #2a3a52",
    color: "#8892a4",
    padding: "2px 7px",
    borderRadius: 5,
  },
  fname: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#6a9fd8",
    marginTop: 4,
    wordBreak: "break-all",
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#3a1a1a",
    border: "1px solid #7a2d2d",
    color: "#d47a7a",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 1,
    padding: 0,
  },

  // btn base — width/height overridden dynamically on mobile
  btn: {
    padding: "0 1.5rem",
    minHeight: 64,
    background: "#1a4a7a",
    border: "none",
    borderRadius: 12,
    color: "#e8eaf0",
    fontSize: 14,
    fontFamily: "inherit",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
  },
  btnOff: { opacity: 0.4, cursor: "not-allowed" },
  spinner: {
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,.2)",
    borderTopColor: "#6a9fd8",
    borderRadius: "50%",
    animation: "spin .7s linear infinite",
    flexShrink: 0,
    display: "inline-block",
  },

  errorBanner: {
    background: "#1e0f0f",
    border: "1px solid #7a2d2d",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: "1rem",
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    fontSize: 13,
    color: "#d47a7a",
  },

  toast: {
    position: "relative",
    width: "100%",
    background: "#0f1628",
    border: "1px solid #7a2d2d",
    borderRadius: 10,
    padding: "12px 14px 20px 14px",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: "1rem",
    animation: "slideDown .25s ease forwards",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "#2a1010",
    border: "1px solid #5a2020",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toastBody: { flex: 1, minWidth: 0 },
  toastTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e8d0d0",
    marginBottom: 4,
  },
  toastMsg: { fontSize: 12, color: "#a08080", lineHeight: 1.5 },
  toastExt: {
    fontFamily: "monospace",
    background: "#2a1010",
    border: "1px solid #5a2020",
    color: "#d47a7a",
    padding: "1px 5px",
    borderRadius: 4,
    fontSize: 11,
  },
  toastAccent: { color: "#6a9fd8", fontWeight: 500 },
  toastFile: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#5a4040",
    marginTop: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  toastClose: {
    background: "none",
    border: "none",
    color: "#5a4040",
    cursor: "pointer",
    fontSize: 13,
    padding: "0 0 0 4px",
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 1,
  },
  toastProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    background: "#2a1010",
  },
  toastProgressBar: {
    height: "100%",
    background: "#7a2d2d",
    animation: "shrink 4s linear forwards",
  },

  // grid columns set dynamically
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },

  panel: {
    borderRadius: 12,
    border: "1px solid #1e2d42",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  phead: {
    background: "#0f1628",
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid #1e2d42",
  },
  snum: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#1a3a5c",
    fontSize: 11,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6a9fd8",
    fontFamily: "monospace",
    flexShrink: 0,
  },
  ptitle: { fontSize: 12, fontWeight: 500, color: "#b0bdd0" },
  pbody: {
    background: "#0a0f1e",
    padding: 10,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  imgBox: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 8,
    overflow: "hidden",
    background: "#0f1628",
    border: "1px solid #1e2d42",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    imageRendering: "pixelated",
  },
  dimLabel: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#3d5470",
    textAlign: "center",
    wordBreak: "break-all",
  },
  placeholder: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 8,
    background: "#0f1628",
    border: "1px solid #1e2d42",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imgRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(58,26,26,0.9)",
    border: "1px solid #7a2d2d",
    color: "#d47a7a",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    lineHeight: 1,
    padding: 0,
  },

  barLbl: { fontSize: 10, width: 72, flexShrink: 0, fontFamily: "monospace" },
  barTrack: {
    flex: 1,
    height: 6,
    background: "#1e2d42",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  barPct: {
    fontSize: 10,
    fontFamily: "monospace",
    width: 36,
    textAlign: "right",
    flexShrink: 0,
  },

  diagBox: {
    borderRadius: 8,
    padding: 10,
    background: "#0f1628",
    border: "1.5px solid #1e2d42",
    marginTop: "auto",
  },
  diagTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#e8eaf0",
    marginBottom: 3,
  },
  diagSub: { fontSize: 11, color: "#8892a4", lineHeight: 1.4 },
  confPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "#1a3a5c",
    border: "1px solid #2d5a7a",
    borderRadius: 20,
    padding: "3px 9px",
    fontSize: 10,
    fontFamily: "monospace",
    color: "#6a9fd8",
    marginTop: 6,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#6a9fd8",
    flexShrink: 0,
  },

  note: {
    fontSize: 10,
    color: "#4a5a6a",
    textAlign: "center",
    marginTop: "1.25rem",
    fontFamily: "monospace",
  },
};
