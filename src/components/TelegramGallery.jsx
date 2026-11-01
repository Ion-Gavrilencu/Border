import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Images,
  LoaderCircle,
} from "lucide-react";
import api from "../services/api";
import "./TelegramGallery.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isImage = (item) =>
  item.attachment_type === "file" &&
  (item.file_category === "image" || item.mime_type?.startsWith("image/"));

function TelegramGallery({
  telegramId,
  entityId,
  entityType = "telegrame",
  title,
  onClose,
  initialAttachmentId,
}) {
  const documentId = entityId ?? telegramId;
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const stageRef = useRef(null);
  const dialogRef = useRef(null);
  const thumbsRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const zoomRef = useRef(zoom);
  const positionRef = useRef(position);
  const indexRef = useRef(index);
  const countRef = useRef(photos.length);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    countRef.current = photos.length;
  }, [photos.length]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setDragging(false);
    pointersRef.current.clear();
    gestureRef.current = null;
  }, []);

  const goTo = useCallback(
    (nextIndex) => {
      const count = countRef.current;
      if (!count) return;
      setIndex(((nextIndex % count) + count) % count);
      resetView();
    },
    [resetView],
  );

  const changeZoom = useCallback((nextZoom) => {
    const value = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setZoom(value);
    if (value === 1) setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    let active = true;
    const urls = [];
    const controller = new AbortController();

    async function loadPhotos() {
      setLoading(true);
      setError("");
      setPhotos([]);
      resetView();
      try {
        if (
          !["telegrame", "ordine", "legislatie", "informatii_utile", "news"].includes(entityType) ||
          !documentId
        ) {
          throw new Error("Tipul documentului sau ID-ul este invalid.");
        }
        const response = await api.get(`/attachments/${entityType}/${documentId}`, {
          signal: controller.signal,
        });
        const images = (response.data?.attachments || []).filter(isImage);
        const loaded = await Promise.all(
          images.map(async (item) => {
            try {
              const fileResponse = await api.get(`/attachments/file/${item.id}`, {
                responseType: "blob",
                signal: controller.signal,
              });
              if (!active) return null;
              const previewUrl = URL.createObjectURL(fileResponse.data);
              urls.push(previewUrl);
              return { ...item, previewUrl };
            } catch (err) {
              if (!controller.signal.aborted) console.error("Eroare fotografie:", item.id, err);
              return null;
            }
          }),
        );
        if (!active) return;
        const available = loaded.filter(Boolean);
        setPhotos(available);
        const initial = available.findIndex(
          (photo) => String(photo.id) === String(initialAttachmentId),
        );
        setIndex(initial >= 0 ? initial : 0);
        if (images.length && !available.length) setError("Fotografiile nu au putut fi deschise.");
      } catch (err) {
        if (active && !controller.signal.aborted) {
          console.error("Eroare încărcare galerie:", err);
          setError(err.message || "Fotografiile nu au putut fi încărcate.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPhotos();
    return () => {
      active = false;
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documentId, entityType, initialAttachmentId, resetView]);

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (document.fullscreenElement === dialogRef.current) {
          document.exitFullscreen?.().catch(() => {});
        } else onCloseRef.current?.();
        return;
      }
      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(indexRef.current + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(indexRef.current - 1);
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeZoom(zoomRef.current + 0.25);
      }
      if (event.key === "-") {
        event.preventDefault();
        changeZoom(zoomRef.current - 0.25);
      }
      if (event.key === "0") {
        event.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goTo, changeZoom, resetView]);

  useEffect(() => {
    const handleFullscreenChange = () =>
      setFullscreen(document.fullscreenElement === dialogRef.current);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const currentThumb = thumbsRef.current?.querySelector('[aria-current="true"]');
    currentThumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [index, photos.length, showThumbnails]);

  const currentPhoto = photos[index];
  const currentName =
    currentPhoto?.original_name || currentPhoto?.name || `Fotografia ${index + 1}`;

  const downloadPhoto = async () => {
    if (!currentPhoto || downloading) return;
    setDownloading(true);
    try {
      // Folosim fișierul deja încărcat și autentificat, fără o nouă cerere către server.
      const link = document.createElement("a");
      link.href = currentPhoto.previewUrl;
      link.download = currentName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDownloading(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === dialogRef.current) {
        await document.exitFullscreen();
      } else if (dialogRef.current?.requestFullscreen) {
        await dialogRef.current.requestFullscreen();
      }
    } catch (err) {
      console.warn("Modul ecran complet nu este disponibil:", err);
    }
  };

  const handleWheel = (event) => {
    if (!currentPhoto) return;
    event.preventDefault();
    changeZoom(zoomRef.current + (event.deltaY < 0 ? 0.2 : -0.2));
  };

  const handlePointerDown = (event) => {
    if (!currentPhoto) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const points = [...pointersRef.current.values()];
    if (points.length === 2) {
      gestureRef.current = {
        kind: "pinch",
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        zoom: zoomRef.current,
      };
    } else if (points.length === 1) {
      gestureRef.current = {
        kind: "drag",
        startX: event.clientX,
        startY: event.clientY,
        x: positionRef.current.x,
        y: positionRef.current.y,
      };
      if (zoomRef.current > 1) setDragging(true);
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const gesture = gestureRef.current;
    if (points.length === 2 && gesture?.kind === "pinch") {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      changeZoom(gesture.zoom * (distance / Math.max(1, gesture.distance)));
    } else if (points.length === 1 && gesture?.kind === "drag" && zoomRef.current > 1) {
      setPosition({
        x: gesture.x + event.clientX - gesture.startX,
        y: gesture.y + event.clientY - gesture.startY,
      });
    }
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    setDragging(false);
    const points = [...pointersRef.current.values()];
    if (points.length === 1) {
      gestureRef.current = {
        kind: "drag",
        startX: points[0].x,
        startY: points[0].y,
        x: positionRef.current.x,
        y: positionRef.current.y,
      };
    } else if (points.length === 0) gestureRef.current = null;
  };

  return (
    <div
      className="telegram-gallery-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className="telegram-gallery"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Galerie foto"}
        tabIndex={-1}
      >
        <header className="telegram-gallery-header">
          <div className="telegram-gallery-heading">
            <div className="telegram-gallery-heading-icon">
              <Images size={21} />
            </div>
            <div className="telegram-gallery-heading-copy">
              <h2 title={title || "Fotografii"}>{title || "Fotografii"}</h2>
              <span>
                {photos.length ? `${index + 1} din ${photos.length} fotografii` : "Galerie foto"}
              </span>
            </div>
          </div>
          <div className="telegram-gallery-header-actions">
            <button
              type="button"
              className="tg-icon-button tg-download"
              onClick={downloadPhoto}
              disabled={!currentPhoto || downloading}
              title="Descarcă fotografia"
              aria-label="Descarcă fotografia"
            >
              <Download size={19} />
              <span>Descarcă</span>
            </button>
            <button
              type="button"
              className="tg-icon-button"
              onClick={toggleFullscreen}
              title={fullscreen ? "Ieși din ecran complet" : "Ecran complet"}
              aria-label={fullscreen ? "Ieși din ecran complet" : "Ecran complet"}
            >
              {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              type="button"
              className="tg-icon-button tg-close"
              onClick={onClose}
              title="Închide"
              aria-label="Închide galeria"
            >
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="telegram-gallery-stage" ref={stageRef} onWheel={handleWheel}>
          {loading ? (
            <div className="tg-empty">
              <LoaderCircle className="tg-spinner" size={32} />
              <p>Se încarcă fotografiile...</p>
            </div>
          ) : error ? (
            <div className="tg-empty tg-error">
              <p>{error}</p>
            </div>
          ) : !currentPhoto ? (
            <div className="tg-empty">
              <Images size={34} />
              <p>Nu există fotografii.</p>
            </div>
          ) : (
            <>
              <div
                className={`telegram-gallery-image-area ${zoom > 1 ? "is-zoomed" : ""} ${dragging ? "is-dragging" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onDoubleClick={() => changeZoom(zoomRef.current > 1 ? 1 : 2)}
              >
                <img
                  src={currentPhoto.previewUrl}
                  alt={currentName}
                  draggable={false}
                  style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom})`,
                  }}
                />
              </div>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="telegram-gallery-arrow tg-prev"
                    onClick={() => goTo(index - 1)}
                    aria-label="Fotografia anterioară"
                  >
                    <ChevronLeft size={26} />
                  </button>
                  <button
                    type="button"
                    className="telegram-gallery-arrow tg-next"
                    onClick={() => goTo(index + 1)}
                    aria-label="Fotografia următoare"
                  >
                    <ChevronRight size={26} />
                  </button>
                </>
              )}
              <div className="telegram-gallery-zoom" aria-label="Comenzi mărire fotografie">
                <button
                  type="button"
                  onClick={() => changeZoom(zoom - 0.25)}
                  disabled={zoom <= MIN_ZOOM}
                  title="Micșorează"
                  aria-label="Micșorează"
                >
                  <ZoomOut size={19} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => changeZoom(zoom + 0.25)}
                  disabled={zoom >= MAX_ZOOM}
                  title="Mărește"
                  aria-label="Mărește"
                >
                  <ZoomIn size={19} />
                </button>
                <span className="tg-zoom-divider" />
                <button
                  type="button"
                  onClick={resetView}
                  title="Resetează zoom"
                  aria-label="Resetează zoom"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {currentPhoto && (
          <footer className="telegram-gallery-footer">
            <div className="tg-file-details">
              <span className="tg-filename" title={currentName}>
                {currentName}
              </span>
              <span className="tg-help">
                Dublu clic pentru zoom · Rotița mouse-ului sau două degete pe telefon
              </span>
            </div>
            {photos.length > 1 && (
              <button
                type="button"
                className="tg-thumbnails-toggle"
                onClick={() => setShowThumbnails((value) => !value)}
                aria-expanded={showThumbnails}
              >
                <Images size={17} /> {showThumbnails ? "Ascunde miniaturile" : "Arată miniaturile"}
              </button>
            )}
          </footer>
        )}
        {photos.length > 1 && showThumbnails && !loading && (
          <div
            className="telegram-gallery-thumbnails"
            ref={thumbsRef}
            aria-label="Miniaturi fotografii"
          >
            {photos.map((photo, photoIndex) => (
              <button
                key={photo.id}
                type="button"
                className={`tg-thumbnail ${index === photoIndex ? "is-active" : ""}`}
                onClick={() => goTo(photoIndex)}
                aria-label={`Fotografia ${photoIndex + 1}: ${photo.original_name || photo.name || "Fotografie"}`}
                aria-current={index === photoIndex ? "true" : undefined}
                title={photo.original_name || photo.name || `Fotografia ${photoIndex + 1}`}
              >
                <img src={photo.previewUrl} alt="" loading="lazy" />
                <span>{photoIndex + 1}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default TelegramGallery;
