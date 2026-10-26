
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

import "./EditOrder.css";

const getCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (/\.docx?$/i.test(file.name)) return "word";
  return "other";
};

const isImage = (item) =>
  item.file_category === "image" ||
  item.mime_type?.startsWith("image/");

const isLink = (item) => item.attachment_type === "link";

function EditOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit =
    user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    title: "",
    number: "",
    orderDate: "",
    content: "",
  });

  const [attachments, setAttachments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const goBack = () => navigate("/ordine");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [orderResponse, attachmentsResponse] =
          await Promise.all([
            api.get(`/ordine/${id}`),
            api.get(`/attachments/ordine/${id}`),
          ]);

        if (!active) return;

        const order = orderResponse.data.order;

        setFormData({
          title: order.title || "",
          number: order.number || "",
          orderDate: order.order_date
            ? String(order.order_date).slice(0, 10)
            : "",
          content: order.content || "",
        });

        setAttachments(
          attachmentsResponse.data.attachments || []
        );
      } catch (err) {
        console.error("Eroare încărcare ordin:", err);

        if (active) {
          setError(
            err.response?.data?.message ||
              "Ordinul nu a putut fi încărcat."
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

  const handleOpenAttachment = (attachment) => {
    const url = isLink(attachment)
      ? attachment.url
      : `${api.defaults.baseURL}/attachments/file/${attachment.id}`;

    if (!/^https?:\/\//i.test(url || "")) {
      setError("Adresa atașamentului nu este validă.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDeleteAttachment = async (attachment) => {
    if (!canDelete || deletingId !== null || saving) return;

    const confirmed = window.confirm(
      "Sigur dorești să ștergi acest atașament?"
    );

    if (!confirmed) return;

    setDeletingId(attachment.id);
    setError("");

    try {
      await api.delete(`/attachments/${attachment.id}`);

      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id)
      );
    } catch (err) {
      console.error("Eroare ștergere atașament:", err);

      setError(
        err.response?.data?.message ||
          "Atașamentul nu a putut fi șters."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    if (!formData.title.trim()) {
      setError("Denumirea ordinului este obligatorie.");
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
      await api.patch(`/ordine/${id}`, {
        ...formData,
        title: formData.title.trim(),
      });

      const failed = [];
      const remainingFiles = [];

      for (const file of selectedFiles) {
        try {
          const data = new FormData();

          data.append("file", file);
          data.append("entityType", "ordine");
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
            entityType: "ordine",
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
          `Datele au fost salvate, dar nu s-au adăugat: ${failed.join(", ")}.`
        );

        const response = await api.get(
          `/attachments/ordine/${id}`
        );

        setAttachments(response.data.attachments || []);
        return;
      }

      goBack();
    } catch (err) {
      console.error("Eroare modificare ordin:", err);

      setError(
        err.response?.data?.message ||
          "Ordinul nu a putut fi modificat."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-order-page">
        <div className="edit-order-loading">
          Se încarcă ordinul...
        </div>
      </div>
    );
  }

  return (
    <div className="edit-order-page">
      <header className="edit-order-header">
        <div>
          <span className="edit-order-label">
            GESTIONARE ORDINE
          </span>

          <h1>Editează ordinul</h1>

          <p>
            Modifică informațiile și documentele atașate.
          </p>
        </div>

        <button
          type="button"
          className="edit-order-back-button"
          onClick={goBack}
        >
          <ArrowLeft size={17} />
          Înapoi
        </button>
      </header>

      {error && (
        <div className="edit-order-error" role="alert">
          {error}
        </div>
      )}

      <form
        className="edit-order-form"
        onSubmit={handleSubmit}
      >
        <div className="edit-order-form-header">
          <h2>Datele ordinului</h2>

          <p>
            Actualizează informațiile și gestionează atașamentele.
          </p>
        </div>

        <div className="edit-order-form-body">
          <div className="edit-order-fields">
            <div className="edit-order-form-group">
              <label htmlFor="order-number">
                Număr ordin
              </label>

              <input
                id="order-number"
                type="text"
                name="number"
                value={formData.number}
                onChange={handleChange}
                placeholder="Ex.: 123/2026"
                disabled={!canEdit || saving}
              />
            </div>

            <div className="edit-order-form-group">
              <label htmlFor="order-date">
                Data ordinului
              </label>

              <input
                id="order-date"
                type="date"
                name="orderDate"
                value={formData.orderDate}
                onChange={handleChange}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="edit-order-form-group edit-order-full">
              <label htmlFor="order-title">
                Denumirea ordinului
              </label>

              <input
                id="order-title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Denumirea ordinului"
                required
                disabled={!canEdit || saving}
              />
            </div>
          </div>

          <div className="edit-order-section">
            <h3>Documente și linkuri existente</h3>

            {attachments.length === 0 ? (
              <p className="edit-order-empty">
                Nu există documente atașate.
              </p>
            ) : (
              <div className="edit-order-attachments">
                {attachments.map((attachment) => {
                  const Icon = isLink(attachment)
                    ? Link2
                    : isImage(attachment)
                      ? Image
                      : FileText;

                  return (
                    <div
                      key={attachment.id}
                      className="edit-order-attachment"
                    >
                      <div className="edit-order-attachment-icon">
                        <Icon size={19} />
                      </div>

                      <div className="edit-order-attachment-name">
                        <strong>
                          {attachment.original_name ||
                            attachment.file_name ||
                            attachment.name ||
                            (isLink(attachment)
                              ? attachment.url
                              : "Document")}
                        </strong>

                        <span>
                          {isLink(attachment)
                            ? "LINK"
                            : isImage(attachment)
                              ? "FOTOGRAFIE"
                              : "DOCUMENT"}
                        </span>
                      </div>

                      <div className="edit-order-attachment-actions">
                        <button
                          type="button"
                          title="Deschide"
                          aria-label="Deschide atașamentul"
                          onClick={() =>
                            handleOpenAttachment(attachment)
                          }
                        >
                          <ExternalLink size={17} />
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            className="edit-order-attachment-delete"
                            title="Șterge"
                            aria-label="Șterge atașamentul"
                            disabled={
                              deletingId !== null || saving
                            }
                            onClick={() =>
                              handleDeleteAttachment(attachment)
                            }
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
            <div className="edit-order-section">
              <h3>
                Adaugă documente, fotografii sau link
              </h3>

              <p className="edit-order-section-description">
                Încarcă fișiere noi sau adaugă un link extern.
                Documentele existente vor fi păstrate.
              </p>

              <DocumentUploader
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                linkUrl={linkUrl}
                onLinkChange={setLinkUrl}
                disabled={saving}
                onError={setError}
              />
            </div>
          )}
        </div>

        <div className="edit-order-actions">
          <button
            type="button"
            className="edit-order-cancel-button"
            onClick={goBack}
            disabled={saving}
          >
            Anulează
          </button>

          {canEdit && (
            <button
              type="submit"
              className="edit-order-save-button"
              disabled={saving}
            >
              <Save size={17} />
              {saving
                ? "Se salvează..."
                : "Salvează modificările"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default EditOrder;
