import { useEffect, useState } from "react";
import {
  FileText,
  File,
  FileImage,
  FileVideo,
  Link as LinkIcon,
  Upload,
  ExternalLink,
  Trash2,
  Download,
  X,
  Plus,
} from "lucide-react";
import api from "../services/api";
import "./Attachments.css";

const getFileCategory = (attachment) => {
  if (attachment.file_category) {
    return attachment.file_category;
  }

  if (attachment.mime_type?.startsWith("image/")) {
    return "image";
  }

  if (attachment.mime_type?.startsWith("video/")) {
    return "video";
  }

  if (attachment.mime_type === "application/pdf") {
    return "pdf";
  }

  if (
    attachment.mime_type === "application/msword" ||
    attachment.mime_type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }

  return "other";
};

const getFileIcon = (attachment) => {
  if (attachment.attachment_type === "link") {
    return <LinkIcon size={20} />;
  }

  const category = getFileCategory(attachment);

  switch (category) {
    case "image":
      return <FileImage size={20} />;

    case "video":
      return <FileVideo size={20} />;

    case "pdf":
      return <FileText size={20} />;

    case "word":
      return <FileText size={20} />;

    default:
      return <File size={20} />;
  }
};

const getCategoryLabel = (attachment) => {
  if (attachment.attachment_type === "link") {
    return "LINK";
  }

  switch (getFileCategory(attachment)) {
    case "image":
      return "IMAGINE";

    case "video":
      return "VIDEO";

    case "pdf":
      return "PDF";

    case "word":
      return "WORD";

    default:
      return "FIȘIER";
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (date) => {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function Attachments({
  entityType,
  entityId,
  canEdit = false,
  canDelete = false,
}) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showMenu, setShowMenu] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileCategory, setFileCategory] = useState("");

  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);

  const loadAttachments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/attachments/${entityType}/${entityId}`);

      setAttachments(response.data.attachments || []);
    } catch (error) {
      console.error("Eroare încărcare atașamente:", error);

      setError(
        error.response?.data?.message ||
          "Atașamentele nu au putut fi încărcate.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!entityType || !entityId) {
      return;
    }

    loadAttachments();
  }, [entityType, entityId]);

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleFileChange = (event) => {
    resetMessages();

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const maxSize = 100 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("Fișierul este prea mare. Dimensiunea maximă este de 100 MB.");

      event.target.value = "";
      return;
    }

    let category = "other";

    if (file.type.startsWith("image/")) {
      category = "image";
    } else if (file.type.startsWith("video/")) {
      category = "video";
    } else if (file.type === "application/pdf") {
      category = "pdf";
    } else if (
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      category = "word";
    }

    setSelectedFile(file);
    setFileCategory(category);
    setShowMenu(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    try {
      setUploading(true);
      resetMessages();

      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      formData.append("fileCategory", fileCategory);

      await api.post("/attachments/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSelectedFile(null);
      setFileCategory("");

      const fileInput = document.getElementById(
        `attachment-file-${entityType}-${entityId}`,
      );

      if (fileInput) {
        fileInput.value = "";
      }

      setSuccess("Fișierul a fost încărcat cu succes.");

      await loadAttachments();
    } catch (error) {
      console.error("Eroare încărcare fișier:", error);

      setError(
        error.response?.data?.message || "Fișierul nu a putut fi încărcat.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAddLink = async (event) => {
    event.preventDefault();

    if (!linkName.trim() || !linkUrl.trim()) {
      setError("Completează denumirea și linkul.");
      return;
    }

    try {
      setAddingLink(true);
      resetMessages();

      await api.post("/attachments/link", {
        entityType,
        entityId,
        name: linkName.trim(),
        url: linkUrl.trim(),
      });

      setLinkName("");
      setLinkUrl("");
      setShowLinkForm(false);

      setSuccess("Linkul a fost adăugat cu succes.");

      await loadAttachments();
    } catch (error) {
      console.error("Eroare adăugare link:", error);

      setError(
        error.response?.data?.message || "Linkul nu a putut fi adăugat.",
      );
    } finally {
      setAddingLink(false);
    }
  };

  const handleDelete = async (attachment) => {
    const confirmed = window.confirm(
      `Sigur dorești să ștergi "${attachment.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      resetMessages();

      await api.delete(`/attachments/${attachment.id}`);

      setSuccess("Atașamentul a fost șters cu succes.");

      await loadAttachments();
    } catch (error) {
      console.error("Eroare ștergere atașament:", error);

      setError(
        error.response?.data?.message || "Atașamentul nu a putut fi șters.",
      );
    }
  };

  // Deschide fișiere private prin Axios, cu cookie-ul de autentificare.
  const handleOpenAttachment = async (attachment) => {
    if (attachment.attachment_type === "link") {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
      return;
    }

    // Deschidem fila în timpul clicului pentru a evita blocarea popup-urilor.
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Se încarcă documentul...";
      previewWindow.document.body.textContent = "Se încarcă documentul...";
    }

    try {
      resetMessages();
      const response = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });
      const blob = response.data;
      const objectUrl = URL.createObjectURL(blob);

      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.replace(objectUrl);
      } else {
        // În cazul în care browserul blochează fila, oferim descărcarea.
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download =
          attachment.original_name || attachment.name || "document";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      // Lăsăm timp browserului să încarce conținutul din URL-ul temporar.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      if (previewWindow && !previewWindow.closed) previewWindow.close();
      console.error("Eroare deschidere atașament:", error);
      setError(
        error.response?.data?.message || "Fișierul nu a putut fi deschis.",
      );
    }
  };

  // ?download=1 permite backend-ului să înregistreze acțiunea „download”.
  const handleDownload = async (attachment) => {
    if (attachment.attachment_type !== "file") return;

    try {
      resetMessages();
      const response = await api.get(
        `/attachments/file/${attachment.id}?download=1`,
        { responseType: "blob" },
      );

      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.original_name || attachment.name || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      console.error("Eroare descărcare atașament:", error);
      setError(
        error.response?.data?.message || "Fișierul nu a putut fi descărcat.",
      );
    }
  };

  return (
    <section className="attachments-section">
      <div className="attachments-header">
        <div className="attachments-title-section">
          <h2 className="attachments-title">Documente și atașamente</h2>

          <span className="attachments-count">{attachments.length}</span>
        </div>

        {canEdit && (
          <div className="attachments-add-wrapper">
            <button
              type="button"
              className="attachments-add-button"
              onClick={() => {
                setShowMenu((current) => !current);
                setShowLinkForm(false);
              }}
            >
              <Plus size={18} />
              Adaugă
            </button>

            {showMenu && (
              <div className="attachments-add-menu">
                <label
                  htmlFor={`attachment-file-${entityType}-${entityId}`}
                  className="attachments-menu-item"
                >
                  <Upload size={17} />
                  Adaugă fișier
                </label>

                <input
                  id={`attachment-file-${entityType}-${entityId}`}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  hidden
                />

                <button
                  type="button"
                  className="attachments-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    setShowLinkForm(true);
                    resetMessages();
                  }}
                >
                  <LinkIcon size={17} />
                  Adaugă link
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="attachments-message attachments-message-error">
          {error}
        </div>
      )}

      {success && (
        <div className="attachments-message attachments-message-success">
          {success}
        </div>
      )}

      {selectedFile && canEdit && (
        <div className="attachments-selected-file">
          <div className="attachments-selected-file-info">
            {getFileIcon({
              attachment_type: "file",
              file_category: fileCategory,
              mime_type: selectedFile.type,
            })}

            <div>
              <strong>{selectedFile.name}</strong>

              <span>{formatFileSize(selectedFile.size)}</span>
            </div>
          </div>

          <div className="attachments-selected-actions">
            <button
              type="button"
              className="attachments-upload-button"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "Se încarcă..." : "Încarcă"}
            </button>

            <button
              type="button"
              className="attachments-cancel-button"
              onClick={() => {
                setSelectedFile(null);
                setFileCategory("");
              }}
              disabled={uploading}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      {showLinkForm && canEdit && (
        <form className="attachments-link-form" onSubmit={handleAddLink}>
          <div className="attachments-link-form-header">
            <h3>Adaugă link</h3>

            <button type="button" onClick={() => setShowLinkForm(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="attachments-link-fields">
            <div className="attachments-form-group">
              <label>Denumire</label>

              <input
                type="text"
                className="attachments-input"
                placeholder="Ex: Instrucțiuni de serviciu"
                value={linkName}
                onChange={(event) => setLinkName(event.target.value)}
              />
            </div>

            <div className="attachments-form-group">
              <label>Link</label>

              <input
                type="url"
                className="attachments-input"
                placeholder="https://..."
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
              />
            </div>
          </div>

          <div className="attachments-link-actions">
            <button
              type="button"
              className="attachments-cancel-link-button"
              onClick={() => setShowLinkForm(false)}
              disabled={addingLink}
            >
              Anulează
            </button>

            <button
              type="submit"
              className="attachments-save-link-button"
              disabled={addingLink}
            >
              {addingLink ? "Se salvează..." : "Salvează link"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="attachments-loading">
          <div className="attachments-spinner" />
          <span>Se încarcă atașamentele...</span>
        </div>
      ) : attachments.length === 0 ? (
        <div className="attachments-empty">
          <File size={30} />

          <strong>Nu există atașamente</strong>

          <span>
            Documentele, imaginile, videoclipurile și linkurile asociate vor
            apărea aici.
          </span>
        </div>
      ) : (
        <div className="attachments-list">
          {attachments.map((attachment) => (
            <div className="attachment-item" key={attachment.id}>
              <div className="attachment-icon">{getFileIcon(attachment)}</div>

              <div className="attachment-info">
                <strong className="attachment-name" title={attachment.name}>
                  {attachment.name}
                </strong>

                <div className="attachment-meta">
                  <span>{getCategoryLabel(attachment)}</span>

                  {attachment.file_size && (
                    <>
                      <span className="attachment-separator">•</span>

                      <span>{formatFileSize(attachment.file_size)}</span>
                    </>
                  )}

                  {attachment.created_at && (
                    <>
                      <span className="attachment-separator">•</span>

                      <span>{formatDate(attachment.created_at)}</span>
                    </>
                  )}

                  {attachment.uploaded_by_name && (
                    <>
                      <span className="attachment-separator">•</span>

                      <span>{attachment.uploaded_by_name}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="attachment-actions">
                <button
                  type="button"
                  className="attachment-action-button"
                  onClick={() => handleOpenAttachment(attachment)}
                  title={
                    attachment.attachment_type === "link"
                      ? "Deschide link"
                      : "Deschide fișier"
                  }
                >
                  <ExternalLink size={17} />
                </button>

                {attachment.attachment_type === "file" && (
                  <button
                    type="button"
                    className="attachment-action-button"
                    onClick={() => handleDownload(attachment)}
                    title="Descarcă"
                  >
                    <Download size={17} />
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    className="attachment-action-button attachment-delete-button"
                    onClick={() => handleDelete(attachment)}
                    title="Șterge"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Attachments;
