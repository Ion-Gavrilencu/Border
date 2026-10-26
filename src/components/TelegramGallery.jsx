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
}) {
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Compatibilitate cu utilizarea veche din Telegrame.
  const documentId = entityId ?? telegramId;

  useEffect(() => {
    let active = true;

    const loadPhotos = async () => {
      try {
        setLoading(true);
        setError("");

        if (!["telegrame", "ordine", "legislatie"].includes(entityType) || !documentId) {
          throw new Error("Tip de document sau ID invalid.");
        }

        const response = await api.get(
          `/attachments/${entityType}/${documentId}`,
        );

        const images = (response.data.attachments || []).filter(
          (item) =>
            item.attachment_type !== "link" &&
            (item.file_category === "image" ||
              item.mime_type?.startsWith("image/")),
        );

        if (active) {
          setPhotos(images);
          setIndex(0);
        }
      } catch (err) {
        console.error("Eroare încărcare galerie:", err);

        if (active) {
          setError("Fotografiile nu au putut fi încărcate.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPhotos();

    return () => {
      active = false;
    };
  }, [documentId, entityType]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }

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

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
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
            <h2>{title}</h2>

            <span>
              {photos.length > 0
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
                src={`${api.defaults.baseURL}/attachments/file/${currentPhoto.id}`}
                alt={currentPhoto.name || `Fotografia ${index + 1}`}
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
            {currentPhoto.name || `Fotografia ${index + 1}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default TelegramGallery;
