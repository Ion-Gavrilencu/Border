import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  FileText,
  Image,
  Link2,
  ExternalLink,
  Trash2,
  Save,
} from "lucide-react";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import DocumentUploader from "../components/DocumentUploader";

import "./EditTelegram.css";
import "./EditPagesModern.css";

const getCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";

  if (file.type === "application/pdf") return "pdf";
  if (/\.docx?$/i.test(file.name)) return "word";

  return "other";
};

const isImage = (item) =>
  item.file_category === "image" || item.mime_type?.startsWith("image/");

const isLink = (item) => item.attachment_type === "link";

function EditTelegram() {
  const { id } = useParams();

  const navigate = useNavigate();

  const { user } = useAuth();

  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    title: "",

    number: "",

    telegramDate: "",

    content: "",
  });

  const [attachments, setAttachments] = useState([]);

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [linkUrl, setLinkUrl] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");

  const goBack = () => navigate("/telegrame");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);

        setError("");

        const [telegramResponse, attachmentsResponse] = await Promise.all([
          api.get(`/telegrame/${id}`),

          api.get(`/attachments/telegrame/${id}`),
        ]);

        if (!active) return;

        const telegram = telegramResponse.data.telegram;

        setFormData({
          title: telegram.title || "",

          number: telegram.number || "",

          telegramDate: telegram.telegram_date
            ? telegram.telegram_date.split("T")[0]
            : "",

          content: telegram.content || "",
        });

        setAttachments(attachmentsResponse.data.attachments || []);
      } catch (err) {
        console.error("Eroare încărcare telegramă:", err);

        if (active) {
          setError(
            err.response?.data?.message || "Telegrama nu a putut fi încărcată.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,

      [name]: value,
    }));
  };

  const handleDeleteAttachment = async (attachment) => {
    if (!canDelete || deletingId !== null || saving) return;

    const confirmed = window.confirm(
      "Sigur dorești să ștergi acest atașament?",
    );

    if (!confirmed) return;

    try {
      setDeletingId(attachment.id);

      setError("");

      await api.delete(`/attachments/${attachment.id}`);

      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
    } catch (err) {
      console.error("Eroare ștergere atașament:", err);

      setError(
        err.response?.data?.message || "Atașamentul nu a putut fi șters.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenAttachment = async (attachment) => {
    if (isLink(attachment)) {
      try {
        const url = new URL(attachment.url);
        if (!["http:", "https:"].includes(url.protocol))
          throw new Error("Link invalid");
        window.open(url.href, "_blank", "noopener,noreferrer");
      } catch {
        setError("Adresa linkului nu este validă.");
      }
      return;
    }

    // Fișierele private se descarcă prin instanța Axios autentificată.
    // URL-ul blob este temporar și nu expune tokenul în adresă.
    const tab = window.open("", "_blank");
    try {
      const response = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });
      const mime =
        response.headers?.["content-type"] ||
        response.data.type ||
        "application/octet-stream";
      const blob = new Blob([response.data], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      if (tab && !tab.closed) {
        tab.location.href = objectUrl;
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download =
          attachment.original_name ||
          attachment.file_name ||
          attachment.name ||
          "document";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      if (tab && !tab.closed) tab.close();
      setError(
        err.response?.data?.message || "Fișierul nu a putut fi deschis.",
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    if (!formData.title.trim()) {
      setError("Denumirea telegramei este obligatorie.");

      return;
    }

    if (linkUrl.trim()) {
      try {
        const url = new URL(linkUrl.trim());

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Link invalid");
        }
      } catch {
        setError("Introdu un link HTTP sau HTTPS valid.");

        return;
      }
    }

    setSaving(true);

    setError("");

    try {
      await api.patch(`/telegrame/${id}`, {
        ...formData,

        title: formData.title.trim(),
      });

      const failed = [];

      const remainingFiles = [];

      for (const file of selectedFiles) {
        try {
          const data = new FormData();

          data.append("file", file);

          data.append("entityType", "telegrame");

          data.append("entityId", id);

          data.append("fileCategory", getCategory(file));

          await api.post("/attachments/upload", data);
        } catch (err) {
          console.error("Eroare încărcare fișier:", err);

          failed.push(file.name);

          remainingFiles.push(file);
        }
      }

      setSelectedFiles(remainingFiles);

      if (linkUrl.trim()) {
        try {
          await api.post("/attachments/link", {
            entityType: "telegrame",

            entityId: id,

            name: formData.title.trim(),

            url: linkUrl.trim(),
          });

          setLinkUrl("");
        } catch (err) {
          console.error("Eroare salvare link:", err);

          failed.push("Link");
        }
      }

      if (failed.length > 0) {
        setError(
          `Datele au fost salvate, dar nu s-au adăugat: ${failed.join(", ")}.`,
        );

        return;
      }

      goBack();
    } catch (err) {
      console.error("Eroare modificare telegramă:", err);

      setError(
        err.response?.data?.message || "Telegrama nu a putut fi modificată.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-telegram-page">
        <div className="edit-telegram-loading">Se încarcă telegrama...</div>
      </div>
    );
  }

  return (
    <div className="edit-telegram-page">
      <header className="edit-telegram-header">
        <div>
          <span className="edit-telegram-label">GESTIONARE TELEGRAME</span>

          <h1>Editează telegrama</h1>

          <p>Modifică informațiile și documentele atașate.</p>
        </div>

        <button
          type="button"
          className="edit-telegram-back-button"
          onClick={goBack}
        >
          <ArrowLeft size={17} />
          Înapoi
        </button>
      </header>

      {error && (
        <div className="edit-telegram-error" role="alert">
          {error}
        </div>
      )}

      <form className="edit-telegram-form" onSubmit={handleSubmit}>
        <div className="edit-telegram-form-header">
          <h2>Datele telegramei</h2>

          <p>Actualizează informațiile și gestionează atașamentele.</p>
        </div>

        <div className="edit-telegram-form-body">
          <div className="edit-telegram-fields">
            <div className="edit-telegram-form-group">
              <label htmlFor="telegram-number">Număr telegramă</label>

              <input
                id="telegram-number"
                type="text"
                name="number"
                value={formData.number}
                onChange={handleChange}
                placeholder="Ex.: 125/2026"
                disabled={!canEdit || saving}
              />
            </div>

            <div className="edit-telegram-form-group">
              <label htmlFor="telegram-date">Data telegramei</label>

              <input
                id="telegram-date"
                type="date"
                name="telegramDate"
                value={formData.telegramDate}
                onChange={handleChange}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="edit-telegram-form-group edit-telegram-full">
              <label htmlFor="telegram-title">Denumirea telegramei</label>

              <input
                id="telegram-title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Denumirea telegramei"
                required
                disabled={!canEdit || saving}
              />
            </div>
          </div>

          <div className="edit-telegram-section">
            <h3>Documente și linkuri existente</h3>

            {attachments.length === 0 ? (
              <p className="edit-telegram-empty">
                Nu există documente atașate.
              </p>
            ) : (
              <div className="edit-telegram-attachments">
                {attachments.map((attachment) => {
                  const Icon = isLink(attachment)
                    ? Link2
                    : isImage(attachment)
                      ? Image
                      : FileText;

                  return (
                    <div
                      key={attachment.id}
                      className="edit-telegram-attachment"
                    >
                      <div className="edit-telegram-attachment-icon">
                        <Icon size={19} />
                      </div>

                      <div className="edit-telegram-attachment-name">
                        <strong>
                          {attachment.original_name ||
                            attachment.file_name ||
                            attachment.name ||
                            (isLink(attachment) ? attachment.url : "Document")}
                        </strong>

                        <span>
                          {isLink(attachment)
                            ? "LINK"
                            : isImage(attachment)
                              ? "FOTOGRAFIE"
                              : "DOCUMENT"}
                        </span>
                      </div>

                      <div className="edit-telegram-attachment-actions">
                        <button
                          type="button"
                          title="Deschide"
                          aria-label="Deschide atașamentul"
                          onClick={() => handleOpenAttachment(attachment)}
                        >
                          <ExternalLink size={17} />
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            className="edit-telegram-attachment-delete"
                            title="Șterge"
                            aria-label="Șterge atașamentul"
                            disabled={deletingId !== null || saving}
                            onClick={() => handleDeleteAttachment(attachment)}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="edit-telegram-section">
              <h3>Adaugă documente, fotografii sau link</h3>

              <p className="edit-telegram-section-description">
                Încarcă fișiere noi sau adaugă un link extern. Documentele
                existente vor fi păstrate.
              </p>

              <DocumentUploader
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                linkUrl={linkUrl}
                onLinkChange={setLinkUrl}
                disabled={saving}
                onError={setError}
                variant="telegram"
              />
            </div>
          )}
        </div>

        <div className="edit-telegram-actions">
          <button
            type="button"
            className="edit-telegram-cancel-button"
            onClick={goBack}
            disabled={saving}
          >
            Anulează
          </button>

          {canEdit && (
            <button
              type="submit"
              className="edit-telegram-save-button"
              disabled={saving}
            >
              <Save size={17} />

              {saving ? "Se salvează..." : "Salvează modificările"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default EditTelegram;
