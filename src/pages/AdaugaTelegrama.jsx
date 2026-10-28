import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, FilePlus2, FileText, Hash, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";
import "./AdaugaTelegrama.css";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (/\\.docx?$/i.test(file.name || "")) return "word";
  return "other";
};

function AdaugaTelegrama() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    number: "",
    telegramDate: "",
    title: "",
    content: "",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || saving) return;

    const title = formData.title.trim();
    const url = linkUrl.trim();

    if (!title) {
      setError("Denumirea telegramei este obligatorie.");
      return;
    }

    if (selectedFiles.length === 0 && !url) {
      setError("Adaugă un document, fotografii sau un link.");
      return;
    }

    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        setError("Introdu un link HTTP sau HTTPS valid.");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const response = await api.post("/telegrame", {
        ...formData,
        title,
        number: formData.number.trim(),
      });
      const telegram = response.data?.telegram;
      if (!telegram?.id) {
        toast.warning("Telegrama a fost creată, dar serverul nu a returnat ID-ul. Verifică lista.");
        navigate("/telegrame");
        return;
      }

      const failed = [];
      for (const file of selectedFiles) {
        try {
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "telegrame");
          data.append("entityId", String(telegram.id));
          data.append("fileCategory", getFileCategory(file));
          await api.post("/attachments/upload", data);
        } catch (uploadError) {
          console.error("Eroare încărcare fișier:", uploadError);
          failed.push(file.name);
        }
      }

      if (url) {
        try {
          await api.post("/attachments/link", {
            entityType: "telegrame",
            entityId: telegram.id,
            name: telegram.title,
            url,
          });
        } catch (linkError) {
          console.error("Eroare salvare link:", linkError);
          failed.push("linkul");
        }
      }

      if (failed.length) {
        toast.warning(`Telegrama a fost creată, dar nu s-au salvat: ${failed.join(", ")}.`);
      } else {
        toast.success("Telegrama a fost salvată cu succes.");
      }
      navigate("/telegrame");
    } catch (requestError) {
      console.error("Eroare salvare telegramă:", requestError);
      setError(
        requestError.response?.data?.message ||
          "Telegrama nu a putut fi salvată."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="adauga-telegrama-page">
        <h1>Acces restricționat</h1>
        <p>Nu ai permisiunea de a adăuga telegrame.</p>
        <button type="button" className="adauga-telegrama-back" onClick={() => navigate("/telegrame")}>
          <ArrowLeft size={17} /> Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-telegrama-page">
      <header className="adauga-telegrama-header">
        <div>
          <span className="adauga-telegrama-eyebrow">GESTIONARE CONȚINUT</span>
          <h1>Adaugă telegramă</h1>
          <p>Înregistrează o telegramă nouă și atașează materialele aferente.</p>
        </div>
        <button
          type="button"
          className="adauga-telegrama-back"
          onClick={() => navigate("/telegrame")}
          disabled={saving}
        >
          <ArrowLeft size={17} /> Înapoi la listă
        </button>
      </header>

      <form className="adauga-telegrama-form" onSubmit={handleSubmit}>
        <div className="adauga-telegrama-form-header">
          <span className="adauga-telegrama-header-icon"><FilePlus2 size={24} /></span>
          <div>
            <h2>Telegramă nouă</h2>
            <p>Completează informațiile și adaugă documentele necesare.</p>
          </div>
        </div>

        <div className="adauga-telegrama-form-body">
          {error && <div className="adauga-telegrama-error" role="alert">{error}</div>}

          <div className="adauga-telegrama-grid">
            <div className="adauga-telegrama-field">
              <label htmlFor="new-telegram-number">Număr telegramă</label>
              <div className="adauga-telegrama-input-wrap">
                <Hash size={18} aria-hidden="true" />
                <input
                  id="new-telegram-number"
                  name="number"
                  type="text"
                  value={formData.number}
                  onChange={handleChange}
                  placeholder="Ex.: 125/2026"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="adauga-telegrama-field">
              <label htmlFor="new-telegram-date">Data telegramei</label>
              <div className="adauga-telegrama-input-wrap">
                <CalendarDays size={18} aria-hidden="true" />
                <input
                  id="new-telegram-date"
                  name="telegramDate"
                  type="date"
                  value={formData.telegramDate}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="adauga-telegrama-field">
            <label htmlFor="new-telegram-title">Denumirea telegramei <span>*</span></label>
            <div className="adauga-telegrama-input-wrap">
              <FileText size={18} aria-hidden="true" />
              <input
                id="new-telegram-title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                placeholder="Introduceți denumirea telegramei"
                required
                disabled={saving}
              />
            </div>
          </div>

          <section className="adauga-telegrama-attachments">
            <div className="adauga-telegrama-attachments-heading">
              <span className="adauga-telegrama-header-icon"><FileText size={21} /></span>
              <div>
                <h3>Documente și materiale atașate</h3>
                <p>Adaugă fotografii, PDF, Word, videoclipuri sau un link.</p>
              </div>
            </div>
            <DocumentUploader
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              linkUrl={linkUrl}
              onLinkChange={setLinkUrl}
              disabled={saving}
              onError={(message) => setError(message || "")}
            />
          </section>
        </div>

        <footer className="adauga-telegrama-actions">
          <button type="button" className="adauga-telegrama-cancel" disabled={saving} onClick={() => navigate("/telegrame")}>
            Anulează
          </button>
          <button type="submit" className="adauga-telegrama-submit" disabled={saving}>
            {saving ? <LoaderCircle size={18} className="adauga-telegrama-spin" /> : <Save size={18} />}
            {saving ? "Se salvează..." : "Salvează telegrama"}
          </button>
        </footer>
      </form>
    </main>
  );
}

export default AdaugaTelegrama;
