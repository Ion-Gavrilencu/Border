import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FilePlus2,
  FileText,
  FolderOpen,
  AlignLeft,
  Info,
  LoaderCircle,
  Paperclip,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";
import "./AdaugaInformatiiUtile.css";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) return "pdf";
  if (/\.docx?$/i.test(file.name || "")) return "word";
  return "other";
};

function AdaugaInformatiiUtile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    title: "",
    category: "",
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
      setError("Titlul este obligatoriu.");
      return;
    }
    if (!formData.content.trim() && selectedFiles.length === 0 && !url) {
      setError("Adaugă text, un fișier sau un link.");
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
      const response = await api.post("/informatii-utile", {
        title,
        category: formData.category.trim(),
        content: formData.content.trim(),
      });
      const itemId = response.data?.informatie?.id;
      if (!itemId) {
        toast.warning("Informația a fost creată, dar serverul nu a returnat ID-ul. Verifică lista.");
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
        } catch (uploadError) {
          console.error("Eroare încărcare fișier:", uploadError);
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
        } catch (linkError) {
          console.error("Eroare salvare link:", linkError);
          failed.push("linkul");
        }
      }

      if (failed.length) {
        toast.warning(`Informația a fost creată, dar nu s-au salvat: ${failed.join(", ")}.`);
      } else {
        toast.success("Informația a fost publicată cu succes.");
      }
      navigate("/informatii-utile");
    } catch (requestError) {
      console.error("Eroare publicare informație:", requestError);
      setError(requestError.response?.data?.message || "Informația nu a putut fi publicată.");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="adauga-info-page">
        <h1>Acces restricționat</h1>
        <p>Nu ai permisiunea de a adăuga informații.</p>
        <button type="button" className="adauga-info-back" onClick={() => navigate("/informatii-utile")}>
          <ArrowLeft size={19} /> Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-info-page">
      <header className="adauga-info-header">
        <div className="adauga-info-heading-content">
          <span className="adauga-info-eyebrow">CENTRU DE RESURSE</span>
          <h1>Adaugă informație</h1>
          <p>Publică proceduri, ghiduri și materiale utile pentru activitatea de serviciu.</p>
        </div>
        <div className="adauga-info-illustration" aria-hidden="true">
          <div className="adauga-info-illustration-halo" />
          <div className="adauga-info-illustration-sheet sheet-back"><span /><span /><span /></div>
          <div className="adauga-info-illustration-sheet sheet-front"><span /><span /><span /><span /></div>
          <div className="adauga-info-illustration-plus">+</div>
        </div>
      </header>

      <button
        type="button"
        className="adauga-info-back"
        onClick={() => navigate("/informatii-utile")}
        disabled={saving}
      >
        <ArrowLeft size={21} /> Înapoi la listă
      </button>

      <form className="adauga-info-form" onSubmit={handleSubmit}>
        {error && <div className="adauga-info-error" role="alert">{error}</div>}
        <div className="adauga-info-panel-grid">
          <section className="adauga-info-info-panel" aria-labelledby="tg-info-heading">
            <div className="adauga-info-form-header">
              <span className="adauga-info-header-icon"><FilePlus2 size={29} strokeWidth={1.9} /></span>
              <div>
                <h2 id="tg-info-heading">Informație nouă</h2>
                <p>Completează datele pentru publicare.</p>
              </div>
            </div>
            <div className="adauga-info-form-body">
              <div className="adauga-info-field">
                <label htmlFor="info-title">Titlu <span>*</span></label>
                <div className="adauga-info-input-wrap">
                  <FileText size={24} aria-hidden="true" />
                  <input id="info-title" name="title" type="text" value={formData.title} onChange={handleChange} placeholder="Ex.: Ghid pentru verificarea documentelor" required disabled={saving} />
                </div>
              </div>
              <div className="adauga-info-field">
                <label htmlFor="info-category">Categorie</label>
                <div className="adauga-info-input-wrap">
                  <FolderOpen size={24} aria-hidden="true" />
                  <input id="info-category" name="category" type="text" value={formData.category} onChange={handleChange} placeholder="Ex.: Proceduri, Ghiduri, Contacte" disabled={saving} />
                </div>
              </div>
              <div className="adauga-info-field">
                <label htmlFor="info-content">Conținut (opțional dacă atașezi materiale)</label>
                <div className="adauga-info-textarea-wrap">
                  <AlignLeft size={23} aria-hidden="true" />
                  <textarea id="info-content" name="content" rows={6} value={formData.content} onChange={handleChange} placeholder="Scrie informațiile care trebuie să fie disponibile colegilor..." disabled={saving} />
                </div>
              </div>
            </div>
          </section>

          <section className="adauga-info-attachments" aria-labelledby="tg-attachments-heading">
            <div className="adauga-info-attachments-heading">
              <span className="adauga-info-header-icon"><Paperclip size={29} strokeWidth={2.1} /></span>
              <div>
                <h2 id="tg-attachments-heading">Documente și materiale atașate</h2>
                <p>Adaugă fotografii, PDF, Word, videoclipuri sau un link.</p>
              </div>
              <span className="adauga-info-info-icon" title="Maxim 100 MB per fișier" aria-label="Maxim 100 MB per fișier"><Info size={21} /></span>
            </div>
            <DocumentUploader
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              linkUrl={linkUrl}
              onLinkChange={setLinkUrl}
              disabled={saving}
              onError={(message) => setError(message || "")}
              variant="telegram"
              allowMixed
            />
          </section>
        </div>
        <footer className="adauga-info-actions">
          <button type="submit" className="adauga-info-submit" disabled={saving}>
            {saving ? <LoaderCircle size={23} className="adauga-info-spin" /> : <Save size={23} />}
            {saving ? "Se publică..." : "Publică informația"}
          </button>
          <button type="button" className="adauga-info-cancel" disabled={saving} onClick={() => navigate("/informatii-utile")}>Anulează</button>
        </footer>
      </form>
    </main>
  );
}

export default AdaugaInformatiiUtile;
