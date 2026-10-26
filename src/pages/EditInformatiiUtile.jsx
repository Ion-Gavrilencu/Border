
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Paperclip,
} from "lucide-react";

import api from "../services/api";
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
  ) {
    return "word";
  }

  return "other";
};

function EditInformatiiUtile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    let active = true;

    const loadInfo = async () => {
      try {
        setLoading(true);
        setMessage("");

        const response = await api.get(
          `/informatii-utile/${id}`,
        );

        const informatie = response.data.informatie;

        if (!active) return;

        if (!informatie) {
          setMessage("Informația utilă nu a fost găsită.");
          return;
        }

        setFormData({
          title: informatie.title || "",
          category: informatie.category || "",
          content: informatie.content || "",
        });
      } catch (error) {
        if (!active) return;

        console.error(
          "Eroare la încărcarea informației:",
          error,
        );

        setMessage(
          error.response?.data?.message ||
            "Eroare la încărcarea informației utile.",
        );
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

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!formData.title.trim()) {
      setMessageType("error");
      setMessage("Titlul informației este obligatoriu.");
      return;
    }

    if (
      !formData.content.trim() &&
      selectedFiles.length === 0 &&
      !linkUrl.trim()
    ) {
      setMessageType("error");
      setMessage(
        "Adaugă un conținut, un fișier sau un link.",
      );
      return;
    }

    if (linkUrl.trim()) {
      try {
        const parsed = new URL(linkUrl.trim());

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Protocol neacceptat.");
        }
      } catch {
        setMessageType("error");
        setMessage(
          "Introdu un link valid, care începe cu https:// sau http://.",
        );
        return;
      }
    }

    try {
      setSaving(true);
      setMessage("");

      // 1. Actualizăm informația.
      await api.patch(`/informatii-utile/${id}`, {
        title: formData.title.trim(),
        category: formData.category.trim(),
        content: formData.content.trim(),
      });

      // 2. Încărcăm fișierele noi.
      const failed = [];

      for (const file of selectedFiles) {
        try {
          const data = new FormData();

          data.append("file", file);
          data.append("entityType", "informatii_utile");
          data.append("entityId", String(id));
          data.append(
            "fileCategory",
            getFileCategory(file),
          );

          await api.post("/attachments/upload", data);
        } catch (error) {
          console.error(
            "Eroare la încărcarea fișierului:",
            error,
          );

          failed.push(file.name);
        }
      }

      // 3. Adăugăm linkul, dacă există.
      if (linkUrl.trim()) {
        try {
          await api.post("/attachments/link", {
            entityType: "informatii_utile",
            entityId: id,
            name: formData.title.trim(),
            url: linkUrl.trim(),
          });
        } catch (error) {
          console.error(
            "Eroare la salvarea linkului:",
            error,
          );

          failed.push("linkul");
        }
      }

      if (failed.length > 0) {
        setMessageType("error");
        setMessage(
          `Informația a fost actualizată, dar nu s-au putut încărca: ${failed.join(", ")}.`,
        );

        // Evităm retrimiterea fișierelor salvate deja.
        setSelectedFiles((current) =>
          current.filter((file) =>
            failed.includes(file.name),
          ),
        );

        if (!failed.includes("linkul")) {
          setLinkUrl("");
        }

        return;
      }

      setMessageType("success");
      setMessage("Modificările au fost salvate.");

      navigate(`/informatii-utile/${id}`);
    } catch (error) {
      console.error(
        "Eroare la actualizarea informației:",
        error,
      );

      setMessageType("error");
      setMessage(
        error.response?.data?.message ||
          "Eroare la actualizarea informației utile.",
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
          <span className="edit-informatii-label">
            GESTIONARE CONȚINUT
          </span>

          <h1>Editează informația utilă</h1>

          <p>
            Modifică datele informației și adaugă
            documente sau materiale noi.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`edit-informatii-message ${messageType}`}
          role="status"
        >
          {messageType === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          <span>{message}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="edit-informatii-form"
      >
        <div className="edit-informatii-form-header">
          <h2>Date informație</h2>

          <p>
            Actualizează câmpurile necesare și salvează
            modificările.
          </p>
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
                <p>
                  Adaugă fotografii, PDF, Word,
                  videoclipuri sau linkuri.
                </p>
              </div>
            </div>

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
            onClick={() =>
              navigate("/informatii-utile")
            }
            disabled={saving}
          >
            Anulează
          </button>

          <button
            type="submit"
            className="edit-informatii-save-button"
            disabled={saving}
          >
            {saving
              ? "Se salvează..."
              : "Salvează modificările"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditInformatiiUtile;
