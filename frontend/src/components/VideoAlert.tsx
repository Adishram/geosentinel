import { useEffect, useRef, useState } from "react";
interface Detection {
  detected: boolean;
  image: string | null;
  confidence: number | null;
  timestamp_seconds: number | null;
  message: string;
  frames_checked: number;
}
export default function VideoAlert({
  village,
  close,
}: {
  village: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled)",
        ) ?? [],
      );
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [close]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Detection | null>(null);
  async function analyse() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(
        `/api/video-detection?village=${encodeURIComponent(village)}`,
        {
          method: "POST",
          body: file,
          headers: { "Content-Type": "application/octet-stream" },
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Video analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video analysis failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="video-backdrop">
      <section
        ref={dialog}
        className={
          result?.detected ? "video-dialog video-phone" : "video-dialog"
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-title"
      >
        <button
          autoFocus
          onClick={close}
          className="video-close"
          aria-label="Close video analysis"
        >
          ×
        </button>
        <small>GEOSENTINEL · CLASSROOM DEMO</small>
        <h2 id="video-title">
          {result?.detected
            ? "Elephant found in village territory"
            : `Camera footage · ${village}`}
        </h2>
        {result?.detected ? (
          <>
            <p>
              <strong>{village}</strong> · Elephant detection alert
            </p>
            {result.image && (
              <img
                src={result.image}
                alt={`Detected elephant in footage assigned to ${village}`}
              />
            )}
            <p>
              Elephant identified at {result.timestamp_seconds}s with{" "}
              {((result.confidence ?? 0) * 100).toFixed(1)}% model confidence.
            </p>
            <p>
              Stay clear of the forest edge. Notify the responsible forest team.
            </p>
            <small>
              Uploaded video assigned to this village for demonstration.
              Location is not verified and no real notification was sent.
            </small>
            <button
              onClick={() => {
                setResult(null);
                setFile(null);
              }}
            >
              Analyse another clip
            </button>
          </>
        ) : (
          <>
            <p>
              Upload a video as this village’s simulated CCTV feed. MP4
              recommended, up to 100 MB and 2 minutes. The detector samples one
              frame per second.
            </p>
            <input
              aria-label="Upload village CCTV video"
              type="file"
              accept="video/*"
              disabled={busy}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                setResult(null);
                setError(
                  next && next.size > 100 * 1024 * 1024
                    ? "Choose a video smaller than 100 MB."
                    : "",
                );
              }}
            />
            <button
              disabled={!file || busy || file.size > 100 * 1024 * 1024}
              onClick={analyse}
            >
              {busy
                ? "Recognising elephants… first run may download the model"
                : "Analyse video"}
            </button>
            {error && <p role="alert">{error}</p>}
            {result && (
              <p role="status">
                {result.message} Checked {result.frames_checked} frames.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
