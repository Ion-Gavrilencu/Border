import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import api from "../services/api";
import "./TelegramGallery.css";

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

  useEffect(() => {
    let active = true;
    const urls = [];

    async function loadPhotos() {
      setLoading(true);
      setError("");
      setPhotos([]);
      try {
        if (
          !["telegrame", "ordine", "legislatie", "informatii_utile"].includes(
            entityType,
          ) ||
          !documentId
        ) {
          throw new Error("Tipul documentului sau ID-ul este invalid.");
        }
        const response = await api.get(
          `/attachments/${entityType}/${documentId}`,
        );
        const images = (response.data.attachments || []).filter(
          (item) =>
            item.attachment_type === "file" &&
            (item.file_category === "image" ||
              item.mime_type?.startsWith("image/")),
        );

        // Fișierele sunt private; Axios transmite tokenul de autentificare.
        const loaded = await Promise.all(
          images.map(async (item) => {
            try {
              const fileResponse = await api.get(
                `/attachments/file/${item.id}`,
                {
                  responseType: "blob",
                },
              );
              const url = URL.createObjectURL(fileResponse.data);
              urls.push(url);
              return { ...item, previewUrl: url };
            } catch (err) {
              console.error("Eroare fotografie:", item.id, err);
              return null;
            }
          }),
        );

        if (!active) return;
        const available = loaded.filter(Boolean);
        setPhotos(available);
        const initialIndex = available.findIndex(
          (photo) => String(photo.id) === String(initialAttachmentId),
        );
        setIndex(initialIndex >= 0 ? initialIndex : 0);
        if (images.length && !available.length) {
          setError("Fotografiile nu au putut fi deschise.");
        }
      } catch (err) {
        console.error("Eroare încărcare galerie:", err);
        if (active) setError("Fotografiile nu au putut fi încărcate.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPhotos();
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documentId, entityType, initialAttachmentId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setIndex((current) =>
          photos.length ? (current + 1) % photos.length : 0,
        );
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) =>
          photos.length ? (current - 1 + photos.length) % photos.length : 0,
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos.length, onClose]);

  const currentPhoto = photos[index];

  return (
    <div
      className="telegram-gallery-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Galerie foto"}
    >
      <div className="telegram-gallery">
        <div className="telegram-gallery-header">
          <div>
            <h2>{title || "Fotografii"}</h2>
            <span>
              {photos.length
                ? `${index + 1} din ${photos.length} fotografii`
                : "Galerie foto"}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Închide">
            <X size={22} />
          </button>
        </div>
        <div className="telegram-gallery-content">
          {loading ? (
            <p>Se încarcă fotografiile...</p>
          ) : error ? (
            <p>{error}</p>
          ) : !currentPhoto ? (
            <p>Nu există fotografii.</p>
          ) : (
            <>
              {photos.length > 1 && (
                <button
                  type="button"
                  className="telegram-gallery-arrow"
                  onClick={() =>
                    setIndex(
                      (current) =>
                        (current - 1 + photos.length) % photos.length,
                    )
                  }
                  aria-label="Fotografia anterioară"
                >
                  <ChevronLeft size={28} />
                </button>
              )}
              <img
                src={currentPhoto.previewUrl}
                alt={
                  currentPhoto.original_name ||
                  currentPhoto.name ||
                  `Fotografia ${index + 1}`
                }
              />
              {photos.length > 1 && (
                <button
                  type="button"
                  className="telegram-gallery-arrow"
                  onClick={() =>
                    setIndex((current) => (current + 1) % photos.length)
                  }
                  aria-label="Fotografia următoare"
                >
                  <ChevronRight size={28} />
                </button>
              )}
            </>
          )}
        </div>
        {currentPhoto && (
          <div className="telegram-gallery-footer">
            {currentPhoto.original_name ||
              currentPhoto.name ||
              `Fotografia ${index + 1}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default TelegramGallery;
