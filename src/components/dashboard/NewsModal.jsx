import { Download, File as FileIcon, X, ZoomIn } from "lucide-react";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ro-RO");
};

const getFileName = (attachment) =>
  attachment.original_name || attachment.name || "Document";

const formatFileSize = (bytes) => {
  const size = Number(bytes);
  return Number.isFinite(size) ? `${(size / 1024 / 1024).toFixed(2)} MB` : "";
};

const isImageAttachment = (attachment) =>
  attachment.attachment_type === "file" && attachment.file_category === "image";

function NewsModal({
  article,
  attachments = [],
  loading = false,
  PrivateImageComponent,
  onClose,
  onPreviewImage,
  onDownloadAttachment,
}) {
  if (!article) return null;

  const images = attachments
    .filter(isImageAttachment)
    .sort((a, b) => Number(a.id) - Number(b.id));

  const documents = attachments.filter(
    (attachment) =>
      attachment.attachment_type === "file" &&
      attachment.file_category !== "image",
  );

  return (
    <div className="border-news-modal-overlay" onClick={onClose}>
      <div
        className="border-news-modal"
        role="dialog"
        aria-modal="true"
        aria-label={article.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-news-modal-header">
          <div>
            <small>{formatDate(article.created_at)}</small>
            <h2>{article.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Închide">
            <X size={22} />
          </button>
        </div>

        <div className="border-news-modal-content">
          <p style={{ whiteSpace: "pre-wrap" }}>{article.content}</p>
          {loading && <p>Se încarcă atașamentele...</p>}

          {images.length > 0 && (
            <div className="border-news-private-section">
              <h3>Fotografii ({images.length})</h3>
              <div className="border-news-private-gallery">
                {images.map((attachment, index) => (
                  <div className="border-news-private-gallery-item" key={attachment.id}>
                    <button
                      type="button"
                      className="border-news-image-preview-button"
                      onClick={() => onPreviewImage(attachment)}
                      title="Mărește fotografia"
                    >
                      <PrivateImageComponent
                        attachment={attachment}
                        className="border-news-private-gallery-image"
                      />
                      <span className="border-news-image-zoom-label">
                        <ZoomIn size={18} />
                        Mărește fotografia
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownloadAttachment(attachment)}
                    >
                      <Download size={16} />
                      {index === 0
                        ? "Descarcă fotografia principală"
                        : `Descarcă fotografia ${index + 1}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {documents.length > 0 && (
            <div className="border-news-private-section">
              <h3>Documente atașate</h3>
              <div className="border-news-private-documents">
                {documents.map((attachment) => (
                  <div className="border-news-private-document" key={attachment.id}>
                    <FileIcon size={23} />
                    <div>
                      <strong>{getFileName(attachment)}</strong>
                      <small>{formatFileSize(attachment.file_size)}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDownloadAttachment(attachment)}
                    >
                      <Download size={17} />
                      Descarcă
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewsModal;
