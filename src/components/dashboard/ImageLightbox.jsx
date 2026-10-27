
import { useEffect } from "react";
import { X } from "lucide-react";

function ImageLightbox({
  attachment,
  PrivateImageComponent,
  onClose,
}) {
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

  if (!attachment) return null;

  return (
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

        <PrivateImageComponent
          attachment={attachment}
          className="border-news-lightbox-image"
        />
      </div>
    </div>
  );
}

export default ImageLightbox;
