
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

import "./ImageLightbox.css";

function ImageLightbox({
  attachment,
  attachments = [],
  PrivateImageComponent,
  onClose,
  onChange,
}) {
  const images = attachments.length > 0
    ? attachments
    : attachment
      ? [attachment]
      : [];

  const currentIndex = images.findIndex(
    (image) => String(image.id) === String(attachment?.id)
  );

  const hasNavigation =
    images.length > 1 && typeof onChange === "function";

  const goToImage = (direction) => {
    if (!hasNavigation) return;

    const nextIndex =
      (currentIndex + direction + images.length) % images.length;

    onChange(images[nextIndex]);
  };

  useEffect(() => {
    if (!attachment) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [attachment, onClose]);

  useEffect(() => {
    if (!attachment) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [attachment]);

  if (!attachment) return null;

  return createPortal(
    <div
      className="border-news-lightbox"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="border-news-lightbox-content"
        role="dialog"
        aria-modal="true"
        aria-label="Previzualizare fotografie"
      >
        <button
          type="button"
          className="border-news-lightbox-close"
          onClick={onClose}
          aria-label="Închide fotografia"
        >
          <X size={24} />
        </button>

        {hasNavigation && (
          <button
            type="button"
            className="border-news-lightbox-prev"
            onClick={() => goToImage(-1)}
            aria-label="Fotografia precedentă"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        <PrivateImageComponent
          attachment={attachment}
          className="border-news-lightbox-image"
        />

        {hasNavigation && (
          <button
            type="button"
            className="border-news-lightbox-next"
            onClick={() => goToImage(1)}
            aria-label="Fotografia următoare"
          >
            <ChevronRight size={28} />
          </button>
        )}

        {hasNavigation && (
          <div className="border-news-lightbox-counter">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default ImageLightbox;
