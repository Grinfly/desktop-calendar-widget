import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

import "./TaskImagePreview.css";

interface PreviewImage {
  src: string;
  index: number;
  count: number;
}

export function TaskImagePreview({ onClose }: { onClose?: () => void }) {
  const [image, setImage] = useState<PreviewImage | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [zoomWidth, setZoomWidth] = useState<number | null>(null);
  const [activeEdge, setActiveEdge] = useState<"left" | "right" | null>(null);
  const [panning, setPanning] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const zoomAnchor = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    let active = true;
    void invoke<PreviewImage>("load_task_image_preview").then(
      (next) => { if (active) setImage(next); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, []);

  const changeImage = useCallback(async (step: number) => {
    if (!image || image.count < 2 || loading) return;
    const index = (image.index + step + image.count) % image.count;
    setLoading(true);
    try {
      const next = await invoke<PreviewImage>("load_task_image_preview", { index });
      zoomAnchor.current = null;
      setZoomWidth(null);
      setError(false);
      setImage(next);
      viewport.current?.scrollTo(0, 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [image, loading]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onClose) {
          event.stopImmediatePropagation();
          onClose();
        } else {
          void getCurrentWindow().close();
        }
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        void changeImage(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKeyDown, Boolean(onClose));
    return () => window.removeEventListener("keydown", onKeyDown, Boolean(onClose));
  }, [changeImage, onClose]);

  useEffect(() => {
    const area = viewport.current;
    if (!area) return;
    const onWheel = (event: WheelEvent) => {
      const img = picture.current;
      if (!img?.naturalWidth || !event.deltaY) return;
      event.preventDefault();
      const rect = img.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
      const delta = Math.min(240, Math.max(-240, event.deltaY * unit));
      const next = Math.min(img.naturalWidth * 8, Math.max(
        Math.min(32, rect.width),
        rect.width * Math.exp(-delta / 500),
      ));
      if (Math.abs(rect.width - next) < 0.1) return;
      zoomAnchor.current = {
        x: event.clientX,
        y: event.clientY,
        left: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        top: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      };
      setZoomWidth(next);
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, []);

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    const rect = picture.current?.getBoundingClientRect();
    if (anchor && rect) {
      viewport.current?.scrollBy(
        rect.left + anchor.left * rect.width - anchor.x,
        rect.top + anchor.top * rect.height - anchor.y,
      );
    }
    zoomAnchor.current = null;
  }, [zoomWidth]);

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    const area = event.currentTarget;
    if (event.button !== 0 || event.target !== picture.current ||
      (area.scrollWidth <= area.clientWidth && area.scrollHeight <= area.clientHeight)) return;
    event.preventDefault();
    area.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: area.scrollLeft,
      top: area.scrollTop,
    };
    setActiveEdge(null);
    setPanning(true);
  };

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.currentTarget.scrollTo(
      start.left + start.x - event.clientX,
      start.top + start.y - event.clientY,
    );
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setPanning(false);
  };

  const revealEdge = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const edgeWidth = Math.min(112, bounds.width * 0.22);
    const x = event.clientX - bounds.left;
    setActiveEdge(x < edgeWidth ? "left" : x > bounds.width - edgeWidth ? "right" : null);
  };

  return (
    <main className="image-viewer" aria-label="图片预览">
      <header className="image-viewer-toolbar">
        {image && image.count > 1 && (
          <span className="image-viewer-count" aria-live="polite">{image.index + 1} / {image.count}</span>
        )}
        <div className="image-viewer-actions image-viewer-tools">
          <button
            type="button"
            disabled={!image || error}
            onClick={() => setZoomWidth(zoomWidth === null ? picture.current?.naturalWidth || null : null)}
          >
            {zoomWidth === null ? "原始大小" : "适应窗口"}
          </button>
          {onClose && <button type="button" onClick={onClose}>关闭</button>}
        </div>
      </header>
      <div
        className="image-viewer-stage"
        data-edge={panning ? undefined : activeEdge ?? undefined}
        onPointerEnter={revealEdge}
        onPointerMove={revealEdge}
        onPointerLeave={() => setActiveEdge(null)}
      >
        <div
          className={`image-viewer-content${zoomWidth === null ? "" : " zoomed"}${panning ? " panning" : ""}`}
          ref={viewport}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onLostPointerCapture={endPan}
        >
          {error ? <p role="status">无法加载图片</p> : image && (
            <img
              ref={picture}
              src={image.src}
              alt={`备注图片 ${image.index + 1}`}
              draggable={false}
              style={zoomWidth === null ? undefined : { width: zoomWidth }}
              onError={() => setError(true)}
            />
          )}
        </div>
        {image && image.count > 1 && (
          <button
            type="button"
            className="image-viewer-arrow previous"
            aria-label="上一张"
            disabled={loading}
            onClick={() => void changeImage(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
          </button>
        )}
        {image && image.count > 1 && (
          <button
            type="button"
            className="image-viewer-arrow next"
            aria-label="下一张"
            disabled={loading}
            onClick={() => void changeImage(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        )}
      </div>
    </main>
  );
}
