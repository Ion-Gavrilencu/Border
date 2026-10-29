import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FilePenLine,
  FileText,
  FolderOpen,
  Paperclip,
  Save,
} from "lucide-react";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import DocumentUploader from "../components/DocumentUploader";

import "./EditInformatiiUtile.css";
import "./EditPagesModern.css";

const getFileCategory = (file) => {
  const type = file.type || "";

  const name = file.name || "";

  if (type.startsWith("image/")) return "image";

  if (type.startsWith("video/")) return "video";

  if (type === "application/pdf") return "pdf";

  if (
    /\.(doc|docx)$/i.test(name) ||
    type.includes("wordprocessingml") ||
    type === "application/msword"
  )
    return "word";

  return "other";
};

const errorText = (error, fallback) =>
  error.response?.data?.message || fallback;

function EditInformatiiUtile() {
  const { id } = useParams();

  const navigate = useNavigate();

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState("error");

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
  });

  const [existingAttachments, setExistingAttachments] = useState([]);

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    let active = true;

    const loadInfo = async () => {
      setLoading(true);

      setMessage("");

      try {
        const [infoResponse, attachmentResponse] = await Promise.all([
          api.get(`/informatii-utile/${id}`),

          api.get(`/attachments/informatii_utile/${id}`),
        ]);

        if (!active) return;

        const info = infoResponse.data.informatie;

        if (!info) throw new Error("Informația utilă nu a fost găsită.");

        setFormData({
          title: info.title || "",

          category: info.category || "",

          content: info.content || "",
        });

        setExistingAttachments(attachmentResponse.data.attachments || []);
      } catch (error) {
        if (active) {
          console.error("Eroare la încărcarea informației:", error);

          setMessage(
            errorText(
              error,
              error.message || "Informația nu a putut fi încărcată.",
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInfo();

    return () => {
      active = false;
    };
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const title = formData.title.trim();

    const content = formData.content.trim();

    const url = linkUrl.trim();

    const hasReplacement = selectedFiles.length > 0 || Boolean(url);

    if (!title) {
      setMessageType("error");

      setMessage("Titlul informației este obligatoriu.");

      return;
    }

    if (!content && !hasReplacement && existingAttachments.length === 0) {
      setMessageType("error");

      setMessage("Adaugă un conținut, un fișier sau un link.");

      return;
    }

    if (url) {
      try {
        const parsed = new URL(url);

        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        setMessageType("error");

        setMessage(
          "Introdu un link valid, care începe cu https\:// sau http\://.",
        );

        return;
      }
    }

    // Înlocuirea materialelor existente necesită permisiuni ADMIN în backend.

    if (
      hasReplacement &&
      existingAttachments.length > 0 &&
      user?.role !== "ADMIN"
    ) {
      setMessageType("error");

      setMessage(
        "Înlocuirea atașamentelor existente necesită rolul ADMIN. " +
          "Poți modifica doar textul sau solicita administratorului înlocuirea materialelor.",
      );

      return;
    }

    setSaving(true);

    setMessage("");

    const newAttachmentIds = [];

    try {
      // Încărcăm materialele noi înainte de a le șterge pe cele vechi.

      if (hasReplacement) {
        for (const file of selectedFiles) {
          const data = new FormData();

          data.append("file", file);

          data.append("entityType", "informatii_utile");

          data.append("entityId", String(id));

          data.append("fileCategory", getFileCategory(file));

          const response = await api.post("/attachments/upload", data);

          if (response.data?.attachment?.id) {
            newAttachmentIds.push(response.data.attachment.id);
          }
        }

        if (url) {
          const response = await api.post("/attachments/link", {
            entityType: "informatii_utile",

            entityId: id,

            name: title,

            url,
          });

          if (response.data?.attachment?.id) {
            newAttachmentIds.push(response.data.attachment.id);
          }
        }
      }

      await api.patch(`/informatii-utile/${id}`, {
        title,

        category: formData.category.trim(),

        content,
      });

      if (hasReplacement) {
        const deletionFailures = [];

        for (const old of existingAttachments) {
          try {
            await api.delete(`/attachments/${old.id}`);
          } catch (error) {
            console.error(
              "Nu s-a putut șterge atașamentul vechi:",
              old.id,
              error,
            );

            deletionFailures.push(old.name || `#${old.id}`);
          }
        }

        if (deletionFailures.length) {
          const response = await api.get(`/attachments/informatii_utile/${id}`);

          setExistingAttachments(response.data.attachments || []);

          setSelectedFiles([]);

          setLinkUrl("");

          setMessageType("error");

          setMessage(
            "Materialele noi au fost salvate, dar unele atașamente vechi " +
              "nu au putut fi șterse: " +
              deletionFailures.join(", ") +
              ". Verifică permisiunile și încearcă să le ștergi separat.",
          );

          return;
        }
      }

      navigate("/informatii-utile");
    } catch (error) {
      console.error("Eroare la actualizarea informației:", error);

      const cleanupFailures = [];

      // La eșec curățăm doar atașamentele create în această încercare.

      for (const newId of newAttachmentIds) {
        try {
          await api.delete(`/attachments/${newId}`);
        } catch (cleanupError) {
          console.error("Curățare atașament nou eșuată:", newId, cleanupError);

          cleanupFailures.push(newId);
        }
      }

      setMessageType("error");

      setMessage(
        errorText(error, "Modificările nu au putut fi salvate.") +
          (cleanupFailures.length
            ? " Unele materiale noi au rămas încărcate; verifică atașamentele înainte de o nouă încercare."
            : " Materialele vechi au fost păstrate."),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="edit-informatii-page">
        <div className="edit-informatii-loading" role="status">
          <div className="edit-informatii-spinner" aria-hidden="true" />

          <span>Se încarcă informația...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="edit-informatii-page">
      <header className="edit-informatii-header">
        <div>
          <span className="edit-informatii-label">
            <BookOpen size={14} aria-hidden="true" />
            CENTRU DE RESURSE
          </span>

          <h1>Editează informația utilă</h1>

          <p>Modifică datele informației și înlocuiește materialele atașate.</p>
        </div>

        <button
          type="button"
          className="edit-informatii-back"
          onClick={() => navigate("/informatii-utile")}
          disabled={saving}
        >
          <ArrowLeft size={17} />
          Înapoi la listă
        </button>
      </header>

      {message && (
        <div className={`edit-informatii-message ${messageType}`} role="status">
          {messageType === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="edit-informatii-form">
        <div className="edit-informatii-form-header">
          <span className="edit-informatii-form-header-icon">
            <FilePenLine size={24} />
          </span>

          <div>
            <h2>Date informație</h2>

            <p>Actualizează câmpurile necesare și salvează modificările.</p>
          </div>
        </div>

        <div className="edit-informatii-form-body">
          <div className="edit-informatii-fields-grid">
            <div className="edit-informatii-form-group">
              <label htmlFor="edit-info-title">
                Titlu <span className="edit-informatii-required">*</span>
              </label>

              <div className="edit-informatii-field">
                <FileText className="edit-informatii-field-icon" size={19} />

                <input
                  id="edit-info-title"
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Introduceți titlul informației"
                  required
                  disabled={saving}
                />
              </div>
            </div>

            <div className="edit-informatii-form-group">
              <label htmlFor="edit-info-category">Categorie</label>

              <div className="edit-informatii-field">
                <FolderOpen className="edit-informatii-field-icon" size={19} />

                <input
                  id="edit-info-category"
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Ex.: Proceduri, Contacte, General"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="edit-informatii-form-group">
            <label htmlFor="edit-info-content">Conținut</label>

            <div className="edit-informatii-field">
              <FileText className="edit-informatii-field-icon" size={19} />

              <textarea
                id="edit-info-content"
                name="content"
                value={formData.content}
                onChange={handleChange}
                rows={7}
                placeholder="Introduceți conținutul informației..."
                disabled={saving}
              />
            </div>
          </div>

          <section className="edit-informatii-attachments">
            <div className="edit-informatii-attachments-header">
              <span className="edit-informatii-attachments-icon">
                <Paperclip size={22} />
              </span>

              <div>
                <h3>Materiale și documente</h3>

                <p>Adaugă fotografii, PDF, Word, videoclipuri sau linkuri.</p>
              </div>
            </div>

            {existingAttachments.length > 0 && (
              <div className="edit-informatii-existing">
                <strong>
                  Materiale existente ({existingAttachments.length})
                </strong>

                <ul>
                  {existingAttachments.map((item) => (
                    <li key={item.id}>
                      {item.attachment_type === "link"
                        ? item.url || item.name
                        : item.original_name || item.name}
                    </li>
                  ))}
                </ul>

                <p>
                  {user?.role === "ADMIN"
                    ? "Dacă adaugi materiale noi, acestea vor înlocui toate materialele existente. Dacă nu adaugi nimic, cele existente rămân neschimbate."
                    : "Doar administratorul poate înlocui materialele existente. Modificarea textului nu le afectează."}
                </p>
              </div>
            )}

            <DocumentUploader
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              linkUrl={linkUrl}
              onLinkChange={setLinkUrl}
              disabled={saving}
              allowMixed
              onError={(error) => {
                if (!error) return;

                setMessageType("error");

                setMessage(error);
              }}
            />
          </section>
        </div>

        <div className="edit-informatii-actions">
          <button
            type="button"
            className="edit-informatii-cancel-button"
            onClick={() => navigate("/informatii-utile")}
            disabled={saving}
          >
            Anulează
          </button>

          <button
            type="submit"
            className="edit-informatii-save-button"
            disabled={saving}
          >
            <Save size={17} />

            {saving ? "Se salvează..." : "Salvează modificările"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default EditInformatiiUtile;
