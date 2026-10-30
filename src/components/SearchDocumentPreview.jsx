import { useEffect, useState } from "react";
import {
  X,
  Paperclip,
  ExternalLink,
  Download,
  FileText,
  LoaderCircle,
  Link2,
  Image as ImageIcon,
  Video,
  CalendarDays,
  Hash,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../services/api";
import "./SearchDocumentPreview.css";
const CONFIG = {
  telegrama: {
    endpoint: "telegrame",
    attachmentType: "telegrame",
    key: "telegram",
    label: "Telegramă",
  },
  ordin: {
    endpoint: "ordine",
    attachmentType: "ordine",
    key: "ordin",
    label: "Ordin intern",
  },
  legislatie: {
    endpoint: "legislatie",
    attachmentType: "legislatie",
    key: "legislatie",
    label: "Act normativ",
  },
  informatii: {
    endpoint: "informatii-utile",
    attachmentType: "informatii_utile",
    key: "informatie",
    label: "Informație utilă",
  },
};
const fileName = (attachment) =>
  attachment?.original_name ||
  attachment?.original_filename ||
  attachment?.file_name ||
  attachment?.filename ||
  attachment?.name ||
  `Atașament ${attachment?.id ?? ""}`;
const fileMime = (attachment) =>
  String(
    attachment?.mime_type ||
      attachment?.mimetype ||
      attachment?.file_type ||
      "",
  ).toLowerCase();
const safeUrl = (value) => {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
};
const isExternalLink = (attachment) =>
  attachment?.attachment_type === "link";
const getExternalUrl = (attachment) =>
  safeUrl(attachment?.url) ||
  safeUrl(attachment?.link) ||
  safeUrl(attachment?.external_url);
const getFileKind = (attachment) => {
  if (isExternalLink(attachment)) return "link";
  const mime = fileMime(attachment);
  const name = fileName(attachment);
  if (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(name)
  ) {
    return "image";
  }
  if (mime.includes("pdf") || /\.pdf$/i.test(name)) {
    return "pdf";
  }
  if (
    mime.startsWith("video/") ||
    /\.(mp4|webm|mov|ogg)$/i.test(name)
  ) {
    return "video";
  }
  if (
    mime.includes("word") ||
    /\.(doc|docx|odt)$/i.test(name)
  ) {
    return "word";
  }
  return "file";
};
const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("ro-RO");
};
const getFileError = (error) => {
  const status = error?.response?.status;
  if (status === 401) {
    return "Sesiunea a expirat. Autentifică-te din nou.";
  }
  if (status === 403) {
    return "Nu ai permisiunea de a accesa acest fișier.";
  }
  if (status === 404) {
    return "Fișierul nu a fost găsit.";
  }
  if (status === 410) {
    return "Fișierul nu mai este disponibil în sistemul de stocare. Este posibil să fie necesară reîncărcarea lui.";
  }
  return (
    error?.response?.data?.message ||
    "Fișierul nu a putut fi încărcat."
  );
};
function FileIcon({ kind, size = 21 }) {
  switch (kind) {
    case "link":
      return <Link2 size={size} />;
    case "image":
      return <ImageIcon size={size} />;
    case "video":
      return <Video size={size} />;
    default:
      return <FileText size={size} />;
  }
}
function AttachmentPreview({ attachment }) {
  const [blobUrl, setBlobUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const kind = getFileKind(attachment);
  const external = isExternalLink(attachment);
  const name = fileName(attachment);
  const linkUrl = external ? getExternalUrl(attachment) : "";
  useEffect(() => {
    setBlobUrl("");
    setError("");
    if (external) {
      setLoading(false);
      return;
    }
    if (!attachment?.id) {
      setLoading(false);
      setError("Fișierul nu are identificator.");
      return;
    }
    const controller = new AbortController();
    let objectUrl = "";
    setLoading(true);
    const loadFile = async () => {
      try {
        const response = await api.get(
          `/attachments/file/${attachment.id}`,
          {
            responseType: "blob",
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      } catch (err) {
        if (
          controller.signal.aborted ||
          err?.code === "ERR_CANCELED"
        ) {
          return;
        }
        setError(getFileError(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    loadFile();
    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment?.id, external]);
  const handleDownload = async () => {
    if (external || !attachment?.id || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await api.get(`/attachments/file/${attachment.id}`, {
        params: { download: 1 },
        responseType: "blob",
      });
      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    } catch (err) {
      setDownloadError(getFileError(err));
    } finally {
      setDownloading(false);
    }
  };

  const url = external ? linkUrl : blobUrl;
  return (
    <section className="sdp-preview-panel">
      <div className="sdp-preview-toolbar">
        <div className="sdp-preview-symbol">
          <FileIcon kind={kind} />
        </div>
        <div className="sdp-preview-heading">
          <strong>{name}</strong>
          <span>
            {external
              ? "Link extern"
              : kind === "image"
                ? "Imagine"
                : kind === "pdf"
                  ? "Document PDF"
                  : kind === "video"
                    ? "Videoclip"
                    : kind === "word"
                      ? "Document Word"
                      : "Fișier atașat"}
          </span>
        </div>
        {url && (
          <div className="sdp-preview-actions">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="sdp-action-primary"
            >
              <ExternalLink size={16} />
              Deschide
            </a>
            {!external && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="sdp-action-secondary"
              >
                <Download size={16} />
                {downloading ? "Se descarcă..." : "Descarcă"}
              </button>
            )}
          </div>
        )}
      </div>
      {downloadError && (
        <div className="sdp-preview-state sdp-preview-error" role="alert">
          <AlertCircle size={19} /> {downloadError}
        </div>
      )}
      {external ? (
        linkUrl ? (
          <div className="sdp-link-card">
            <Link2 size={25} />
            <div>
              <strong>Link extern disponibil</strong>
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {linkUrl}
              </a>
              <p>
                Apasă pe link pentru a deschide resursa
                într-o filă nouă.
              </p>
            </div>
          </div>
        ) : (
          <div className="sdp-preview-state sdp-preview-error">
            <AlertCircle size={20} />
            Linkul nu are o adresă validă.
          </div>
        )
      ) : loading ? (
        <div className="sdp-preview-state">
          <LoaderCircle className="sdp-spin" size={21} />
          Se încarcă fișierul...
        </div>
      ) : error ? (
        <div className="sdp-preview-state sdp-preview-error">
          <AlertCircle size={21} />
          {error}
        </div>
      ) : !blobUrl ? (
        <div className="sdp-preview-state">
          Previzualizarea nu este disponibilă.
        </div>
      ) : kind === "image" ? (
        <img
          className="sdp-image"
          src={blobUrl}
          alt={name}
        />
      ) : kind === "pdf" ? (
        <iframe
          className="sdp-frame"
          src={blobUrl}
          title={name}
        />
      ) : kind === "video" ? (
        <video
          className="sdp-video"
          src={blobUrl}
          controls
        />
      ) : (
        <div className="sdp-preview-state">
          <FileText size={23} />
          Acest format nu poate fi previzualizat direct.
          Folosește butonul Deschide sau Descarcă.
        </div>
      )}
    </section>
  );
}
export default function SearchDocumentPreview({
  item,
  onClose,
}) {
  const [data, setData] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachmentsError, setAttachmentsError] = useState("");
  const [selected, setSelected] = useState(0);
  const config = item ? CONFIG[item.type] : null;
  useEffect(() => {
    if (!item || !config) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setAttachmentsError("");
    setData(null);
    setAttachments([]);
    setSelected(0);
    const loadDocument = async () => {
      const results = await Promise.allSettled([
        api.get(
          `/${config.endpoint}/${item.id}`,
          { signal: controller.signal },
        ),
        api.get(
          `/attachments/${config.attachmentType}/${item.id}`,
          { signal: controller.signal },
        ),
      ]);
      if (controller.signal.aborted) return;
      const [details, files] = results;
      if (details.status === "fulfilled") {
        const body = details.value.data;
        setData(
          body?.[config.key] ||
            body?.data ||
            body,
        );
      } else {
        setError(
          details.reason?.response?.data?.message ||
            "Documentul nu a putut fi încărcat.",
        );
      }
      if (files.status === "fulfilled") {
        const body = files.value.data;
        const list = Array.isArray(body)
          ? body
          : body?.attachments ||
            body?.files ||
            body?.data ||
            [];
        setAttachments(Array.isArray(list) ? list : []);
      } else {
        setAttachmentsError(
          "Atașamentele nu au putut fi încărcate.",
        );
      }
      setLoading(false);
    };
    loadDocument();
    return () => controller.abort();
  }, [item?.id, item?.type]);
  useEffect(() => {
    if (!item) return;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [item, onClose]);
  if (!item || !config) return null;
  const date =
    data?.telegram_date ||
    data?.order_date ||
    data?.document_date ||
    data?.created_at;
  const content =
    data?.content ||
    data?.description ||
    data?.text ||
    "";
  const selectedAttachment = attachments[selected];
  return (
    <div
      className="sdp-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="sdp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Previzualizare ${config.label}`}
      >
        <header className="sdp-header">
          <div className="sdp-header-icon">
            <FileText size={26} />
          </div>
          <div className="sdp-header-text">
            <span className="sdp-eyebrow">
              {config.label}
            </span>
            <h2>
              {data?.title ||
                item.title ||
                "Previzualizare document"}
            </h2>
            <p>Vizualizare document și atașamente</p>
          </div>
          <button
            type="button"
            className="sdp-close"
            onClick={onClose}
            aria-label="Închide previzualizarea"
          >
            <X size={21} />
          </button>
        </header>
        <div className="sdp-body">
          {loading && (
            <p className="sdp-loading">
              <LoaderCircle
                className="sdp-spin"
                size={20}
              />
              Se încarcă documentul...
            </p>
          )}
          {error && (
            <p className="sdp-error" role="alert">
              <AlertCircle size={19} />
              {error}
            </p>
          )}
          {data && (
            <section className="sdp-section">
              <h3>
                <FileText size={19} />
                Informații document
              </h3>
              <div className="sdp-meta">
                {data.number && (
                  <div className="sdp-meta-card">
                    <Hash size={19} />
                    <div>
                      <small>Număr</small>
                      <strong>{data.number}</strong>
                    </div>
                  </div>
                )}
                {date && (
                  <div className="sdp-meta-card">
                    <CalendarDays size={19} />
                    <div>
                      <small>Data</small>
                      <strong>{formatDate(date)}</strong>
                    </div>
                  </div>
                )}
                {data.category && (
                  <div className="sdp-meta-card">
                    <FolderOpen size={19} />
                    <div>
                      <small>Categorie</small>
                      <strong>{data.category}</strong>
                    </div>
                  </div>
                )}
              </div>
              {content ? (
                <div className="sdp-content">
                  {content}
                </div>
              ) : (
                <p className="sdp-muted">
                  Nu există conținut textual disponibil.
                </p>
              )}
            </section>
          )}
          <section className="sdp-section">
            <h3>
              <Paperclip size={19} />
              Atașamente
              <span className="sdp-count">
                {attachments.length}
              </span>
            </h3>
            {attachmentsError && (
              <p className="sdp-error" role="alert">
                <AlertCircle size={19} />
                {attachmentsError}
              </p>
            )}
            {attachments.length > 0 ? (
              <>
                <div className="sdp-file-list">
                  {attachments.map((attachment, index) => {
                    const kind = getFileKind(attachment);
                    const active = selected === index;
                    return (
                      <button
                        key={attachment.id ?? index}
                        type="button"
                        className={`sdp-file-choice ${
                          active ? "sdp-file-selected" : ""
                        }`}
                        onClick={() => setSelected(index)}
                      >
                        <span
                          className={`sdp-choice-icon sdp-kind-${kind}`}
                        >
                          <FileIcon kind={kind} />
                        </span>
                        <span className="sdp-choice-text">
                          <strong>
                            {fileName(attachment)}
                          </strong>
                          <small>
                            {kind === "link"
                              ? "Link extern"
                              : "Fișier atașat"}
                          </small>
                        </span>
                        {active && (
                          <CheckCircle2
                            className="sdp-choice-check"
                            size={19}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedAttachment && (
                  <AttachmentPreview
                    key={
                      selectedAttachment.id ??
                      `attachment-${selected}`
                    }
                    attachment={selectedAttachment}
                  />
                )}
              </>
            ) : (
              !loading &&
              !attachmentsError && (
                <p className="sdp-muted">
                  Nu există atașamente.
                </p>
              )
            )}
          </section>
        </div>
        <footer className="sdp-footer">
          <button type="button" onClick={onClose}>
            <X size={17} />
            Închide
          </button>
        </footer>
      </div>
    </div>
  );
}