import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  FilePlus2,
  FileText,
  Hash,
  Info,
  LoaderCircle,
  Paperclip,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";
import "./AdaugaTelegrama.css";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (/\.docx?$/i.test(file.name || "")) return "word";
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
    if (error) setError("");
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
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Protocol invalid");
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
      setError(requestError.response?.data?.message || "Telegrama nu a putut fi salvată.");
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
          <ArrowLeft size={19} /> Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-telegrama-page">
      <header className="adauga-telegrama-header">
        <div className="adauga-telegrama-heading-content">
          <span className="adauga-telegrama-eyebrow">GESTIONARE CONȚINUT</span>
          <h1>Adaugă telegramă</h1>
          <p>Înregistrează o telegramă nouă și atașează materialele aferente.</p>
        </div>
        <div className="adauga-telegrama-illustration" aria-hidden="true">
          <div className="adauga-telegrama-illustration-halo" />
          <div className="adauga-telegrama-illustration-sheet sheet-back"><span /><span /><span /></div>
          <div className="adauga-telegrama-illustration-sheet sheet-front"><span /><span /><span /><span /></div>
          <div className="adauga-telegrama-illustration-plus">+</div>
        </div>
      </header>

      <button
        type="button"
        className="adauga-telegrama-back"
        onClick={() => navigate("/telegrame")}
        disabled={saving}
      >
        <ArrowLeft size={21} /> Înapoi la listă
      </button>

      <form className="adauga-telegrama-form" onSubmit={handleSubmit}>
        {error && <div className="adauga-telegrama-error" role="alert">{error}</div>}
        <div className="adauga-telegrama-panel-grid">
          <section className="adauga-telegrama-info-panel" aria-labelledby="tg-info-heading">
            <div className="adauga-telegrama-form-header">
              <span className="adauga-telegrama-header-icon"><FilePlus2 size={29} strokeWidth={1.9} /></span>
              <div>
                <h2 id="tg-info-heading">Telegramă nouă</h2>
                <p>Completează informațiile și adaugă documentele necesare.</p>
              </div>
            </div>
            <div className="adauga-telegrama-form-body">
              <div className="adauga-telegrama-field">
                <label htmlFor="new-telegram-number">Număr telegramă</label>
                <div className="adauga-telegrama-input-wrap">
                  <Hash size={24} aria-hidden="true" />
                  <input id="new-telegram-number" name="number" type="text" value={formData.number} onChange={handleChange} placeholder="Ex.: 125/2026" disabled={saving} />
                </div>
              </div>
              <div className="adauga-telegrama-field">
                <label htmlFor="new-telegram-date">Data telegramei</label>
                <div className="adauga-telegrama-input-wrap adauga-telegrama-date-wrap">
                  <CalendarDays size={24} aria-hidden="true" />
                  <input id="new-telegram-date" name="telegramDate" type="date" value={formData.telegramDate} onChange={handleChange} disabled={saving} aria-label="Data telegramei" />
                  {!formData.telegramDate && <span className="adauga-telegrama-date-placeholder" aria-hidden="true">Selectează data</span>}
                  <ChevronDown className="adauga-telegrama-date-chevron" size={19} aria-hidden="true" />
                </div>
              </div>
              <div className="adauga-telegrama-field">
                <label htmlFor="new-telegram-title">Denumirea telegramei <span>*</span></label>
                <div className="adauga-telegrama-input-wrap">
                  <FileText size={24} aria-hidden="true" />
                  <input id="new-telegram-title" name="title" type="text" value={formData.title} onChange={handleChange} placeholder="Introduceți denumirea telegramei" required disabled={saving} />
                </div>
              </div>
            </div>
          </section>

          <section className="adauga-telegrama-attachments" aria-labelledby="tg-attachments-heading">
            <div className="adauga-telegrama-attachments-heading">
              <span className="adauga-telegrama-header-icon"><Paperclip size={29} strokeWidth={2.1} /></span>
              <div>
                <h2 id="tg-attachments-heading">Documente și materiale atașate</h2>
                <p>Adaugă fotografii, PDF, Word, videoclipuri sau un link.</p>
              </div>
              <span className="adauga-telegrama-info-icon" title="Maxim 100 MB per fișier" aria-label="Maxim 100 MB per fișier"><Info size={21} /></span>
            </div>
            <DocumentUploader
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              linkUrl={linkUrl}
              onLinkChange={setLinkUrl}
              disabled={saving}
              onError={(message) => setError(message || "")}
              variant="telegram"
            />
          </section>
        </div>
        <footer className="adauga-telegrama-actions">
          <button type="submit" className="adauga-telegrama-submit" disabled={saving}>
            {saving ? <LoaderCircle size={23} className="adauga-telegrama-spin" /> : <Save size={23} />}
            {saving ? "Se salvează..." : "Salvează telegrama"}
          </button>
          <button type="button" className="adauga-telegrama-cancel" disabled={saving} onClick={() => navigate("/telegrame")}>Anulează</button>
        </footer>
      </form>
    </main>
  );
}

export default AdaugaTelegrama;
