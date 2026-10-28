
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FilePlus2, Save } from "lucide-react";
import { toast } from "sonner";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";

import "./AdaugaInformatiiUtile.css";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (/\.(doc|docx)$/i.test(file.name)) return "word";
  return "other";
};

function AdaugaInformatiiUtile() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");

  const canEdit =
    user?.role === "ADMIN" || user?.role === "EDITOR";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || saving) return;

    const title = formData.title.trim();
    const category = formData.category.trim();
    const content = formData.content.trim();
    const url = linkUrl.trim();

    if (!title) {
      toast.error("Titlul este obligatoriu.");
      return;
    }

    if (!content && selectedFiles.length === 0 && !url) {
      toast.error("Adaugă text, un fișier sau un link.");
      return;
    }

    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Protocol invalid");
        }
      } catch {
        toast.error("Introdu un link HTTP sau HTTPS valid.");
        return;
      }
    }

    setSaving(true);

    try {
      const response = await api.post("/informatii-utile", {
        title,
        category,
        content,
      });

      const itemId = response.data?.informatie?.id;

      if (!itemId) {
        toast.warning(
          "Informația a fost creată, dar serverul nu a returnat ID-ul."
        );
        navigate("/informatii-utile");
        return;
      }

      const failed = [];

      for (const file of selectedFiles) {
        try {
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "informatii_utile");
          data.append("entityId", String(itemId));
          data.append("fileCategory", getFileCategory(file));

          await api.post("/attachments/upload", data);
        } catch (error) {
          console.error("Eroare upload:", error);
          failed.push(file.name);
        }
      }

      if (url) {
        try {
          await api.post("/attachments/link", {
            entityType: "informatii_utile",
            entityId: itemId,
            name: title,
            url,
          });
        } catch (error) {
          console.error("Eroare link:", error);
          failed.push("linkul");
        }
      }

      if (failed.length > 0) {
        toast.warning(
          `Informația a fost creată, dar nu s-au încărcat: ${failed.join(", ")}.`
        );
      } else {
        toast.success("Informația a fost publicată cu succes.");
      }

      navigate("/informatii-utile");
    } catch (error) {
      console.error("Eroare creare informație:", error);
      toast.error(
        error.response?.data?.message ||
          "Informația nu a putut fi publicată."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="adauga-info-page">
        <h2>Acces restricționat</h2>
        <p>Nu ai permisiunea de a adăuga informații.</p>
      </main>
    );
  }

  return (
    <main className="adauga-info-page">
      <header className="adauga-info-header">
        <div>
          <span className="adauga-info-label">
            CENTRU DE RESURSE
          </span>
          <h1>Adaugă informație</h1>
          <p>
            Publică proceduri, ghiduri și materiale utile
            pentru activitatea de serviciu.
          </p>
        </div>

        <button
          type="button"
          className="adauga-info-back"
          onClick={() => navigate("/informatii-utile")}
          disabled={saving}
        >
          <ArrowLeft size={17} />
          Înapoi la listă
        </button>
      </header>

      <form className="adauga-info-form" onSubmit={handleSubmit}>
        <div className="adauga-info-form-header">
          <span className="adauga-info-icon">
            <FilePlus2 size={22} />
          </span>
          <div>
            <h2>Informație nouă</h2>
            <p>Completează datele pentru publicare.</p>
          </div>
        </div>

        <div className="adauga-info-body">
          <div className="adauga-info-fields">
            <div className="adauga-info-group">
              <label htmlFor="info-title">Titlu *</label>
              <input
                id="info-title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Ex.: Ghid pentru verificarea documentelor"
                required
                disabled={saving}
              />
            </div>

            <div className="adauga-info-group">
              <label htmlFor="info-category">Categorie</label>
              <input
                id="info-category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="Ex.: Proceduri, Ghiduri, Contacte"
                disabled={saving}
              />
            </div>
          </div>

          <div className="adauga-info-group">
            <label htmlFor="info-content">
              Conținut (opțional dacă atașezi materiale)
            </label>
            <textarea
              id="info-content"
              name="content"
              rows={7}
              value={formData.content}
              onChange={handleChange}
              placeholder="Scrie informațiile care trebuie să fie disponibile colegilor..."
              disabled={saving}
            />
          </div>

          <section className="adauga-info-attachments">
            <h3>Documente și materiale atașate</h3>
            <p>
              Fotografii, videoclipuri, documente Word,
              PDF și linkuri.
            </p>

            <DocumentUploader
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              linkUrl={linkUrl}
              onLinkChange={setLinkUrl}
              disabled={saving}
              allowMixed
              onError={(error) => {
                if (error) toast.error(error);
              }}
            />
          </section>
        </div>

        <div className="adauga-info-actions">
          <button
            type="button"
            className="adauga-info-cancel"
            onClick={() => navigate("/informatii-utile")}
            disabled={saving}
          >
            Anulează
          </button>

          <button
            type="submit"
            className="adauga-info-save"
            disabled={saving}
          >
            <Save size={17} />
            {saving ? "Se publică..." : "Publică informația"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default AdaugaInformatiiUtile;
