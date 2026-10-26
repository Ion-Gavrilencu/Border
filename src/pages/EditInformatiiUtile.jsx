import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Paperclip } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";
import "./EditInformatiiUtile.css";

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
          "Introdu un link valid, care începe cu https:// sau http://.",
        );
        return;
      }
    }
    // Ștergerea atașamentelor este permisă doar pentru ADMIN în backend.
    // Nu încărcăm materiale noi dacă nu le putem înlocui pe cele vechi.
    if (
      hasReplacement &&
      existingAttachments.length > 0 &&
      user?.role !== "ADMIN"
    ) {
      setMessageType("error");
      setMessage(
        "Înlocuirea atașamentelor existente necesită rolul ADMIN. Poți modifica doar textul sau poți solicita unui administrator să înlocuiască materialele.",
      );
      return;
    }

    setSaving(true);
    setMessage("");
    const newAttachmentIds = [];
    try {
      // Încărcăm mai întâi materialele noi, ca să nu pierdem materialele vechi dacă uploadul eșuează.
      if (hasReplacement) {
        for (const file of selectedFiles) {
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "informatii_utile");
          data.append("entityId", String(id));
          data.append("fileCategory", getFileCategory(file));
          const response = await api.post("/attachments/upload", data);
          if (response.data?.attachment?.id)
            newAttachmentIds.push(response.data.attachment.id);
        }
        if (url) {
          const response = await api.post("/attachments/link", {
            entityType: "informatii_utile",
            entityId: id,
            name: title,
            url,
          });
          if (response.data?.attachment?.id)
            newAttachmentIds.push(response.data.attachment.id);
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
            "Materialele noi au fost salvate, dar unele atașamente vechi nu au putut fi șterse: " +
              deletionFailures.join(", ") +
              ". Verifică permisiunile și încearcă să le ștergi separat.",
          );
          return;
        }
      }

      navigate("/informatii-utile");
    } catch (error) {
      console.error("Eroare la actualizarea informației:", error);
      // Curățăm doar atașamentele noi create în această încercare.
      // Nu atingem atașamentele existente.
      const cleanupFailures = [];
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
      <div className="edit-informatii-page">
        <div className="edit-informatii-loading">
          <div className="edit-informatii-spinner" />
          <span>Se încarcă informația...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-informatii-page">
      <div className="edit-informatii-header">
        <div>
          <span className="edit-informatii-label">GESTIONARE CONȚINUT</span>
          <h1>Editează informația utilă</h1>
          <p>Modifică datele informației și înlocuiește materialele atașate.</p>
        </div>
      </div>

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
          <h2>Date informație</h2>
          <p>Actualizează câmpurile necesare și salvează modificările.</p>
        </div>
        <div className="edit-informatii-form-body">
          <div className="edit-informatii-form-group">
            <label htmlFor="title">Titlu *</label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Introduceți titlul informației"
              required
              disabled={saving}
            />
          </div>
          <div className="edit-informatii-form-group">
            <label htmlFor="category">Categorie</label>
            <input
              id="category"
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Ex.: Proceduri, Contacte, General"
              disabled={saving}
            />
          </div>
          <div className="edit-informatii-form-group">
            <label htmlFor="content">Conținut</label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows={12}
              placeholder="Introduceți conținutul informației..."
              disabled={saving}
            />
          </div>
          <div className="edit-informatii-attachments">
            <div className="edit-informatii-attachments-header">
              <div className="edit-informatii-attachments-icon">
                <Paperclip size={20} />
              </div>
              <div>
                <h3>Materiale și documente</h3>
                <p>Adaugă fotografii, PDF, Word, videoclipuri sau linkuri.</p>
              </div>
            </div>
            {existingAttachments.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <strong>
                  Materiale existente ({existingAttachments.length})
                </strong>
                <ul style={{ marginTop: 8, paddingLeft: 22 }}>
                  {existingAttachments.map((item) => (
                    <li
                      key={item.id}
                      style={{ marginBottom: 5, overflowWrap: "anywhere" }}
                    >
                      {item.attachment_type === "link"
                        ? item.url || item.name
                        : item.original_name || item.name}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 13, color: "#64748b" }}>
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
          </div>
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
            {saving ? "Se salvează..." : "Salvează modificările"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditInformatiiUtile;
