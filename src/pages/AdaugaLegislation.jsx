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
import { useAuth } from "../context/authStore";
import DocumentUploader from "../components/DocumentUploader";
import "./AdaugaLegislation.css";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || ""))
    return "pdf";
  if (/\.docx?$/i.test(file.name || "")) return "word";
  return "other";
};

function AdaugaLegislation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    lawNumber: "",
    lawDate: "",
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
      setError("Denumirea actului normativ este obligatorie.");
      return;
    }
    if (selectedFiles.length === 0 && !url) {
      setError("Adaugă un document, fotografii sau un link.");
      return;
    }
    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol))
          throw new Error("Protocol invalid");
      } catch {
        setError("Introdu un link HTTP sau HTTPS valid.");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const response = await api.post("/legislatie", {
        ...formData,
        title,
        lawNumber: formData.lawNumber.trim(),
      });
      const legislation = response.data?.legislation;
      if (!legislation?.id) {
        toast.warning(
          "Actul normativ a fost creat, dar serverul nu a returnat ID-ul. Verifică lista.",
        );
        navigate("/legislatie");
        return;
      }

      const failed = [];
      for (const file of selectedFiles) {
        try {
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "legislatie");
          data.append("entityId", String(legislation.id));
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
            entityType: "legislatie",
            entityId: legislation.id,
            name: legislation.title,
            url,
          });
        } catch (linkError) {
          console.error("Eroare salvare link:", linkError);
          failed.push("linkul");
        }
      }

      if (failed.length) {
        toast.warning(
          `Actul normativ a fost creat, dar nu s-au salvat: ${failed.join(", ")}.`,
        );
      } else {
        toast.success("Actul normativ a fost salvat cu succes.");
      }
      navigate("/legislatie");
    } catch (requestError) {
      console.error("Eroare salvare act normativ:", requestError);
      setError(
        requestError.response?.data?.message ||
          "Actul normativ nu a putut fi salvat.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="adauga-act-page">
        <h1>Acces restricționat</h1>
        <p>Nu ai permisiunea de a adăuga acte normative.</p>
        <button
          type="button"
          className="adauga-act-back"
          onClick={() => navigate("/legislatie")}
        >
          <ArrowLeft size={19} /> Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-act-page">
      <header className="adauga-act-header">
        <div className="adauga-act-heading-content">
          <span className="adauga-act-eyebrow">GESTIONARE CONȚINUT</span>
          <h1>Adaugă act normativ</h1>
          <p>
            Completează datele actului și atașează documentul sau linkul
            aferent.
          </p>
        </div>
        <div className="adauga-act-illustration" aria-hidden="true">
          <div className="adauga-act-illustration-halo" />
          <div className="adauga-act-illustration-sheet sheet-back">
            <span />
            <span />
            <span />
          </div>
          <div className="adauga-act-illustration-sheet sheet-front">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="adauga-act-illustration-plus">+</div>
        </div>
      </header>

      <button
        type="button"
        className="adauga-act-back"
        onClick={() => navigate("/legislatie")}
        disabled={saving}
      >
        <ArrowLeft size={21} /> Înapoi la listă
      </button>

      <form className="adauga-act-form" onSubmit={handleSubmit}>
        {error && (
          <div className="adauga-act-error" role="alert">
            {error}
          </div>
        )}
        <div className="adauga-act-panel-grid">
          <section
            className="adauga-act-info-panel"
            aria-labelledby="law-info-heading"
          >
            <div className="adauga-act-form-header">
              <span className="adauga-act-header-icon">
                <FilePlus2 size={29} strokeWidth={1.9} />
              </span>
              <div>
                <h2 id="law-info-heading">Act normativ nou</h2>
                <p>Completează informațiile și adaugă documentele necesare.</p>
              </div>
            </div>
            <div className="adauga-act-form-body">
              <div className="adauga-act-field">
                <label htmlFor="new-law-number">Număr act normativ</label>
                <div className="adauga-act-input-wrap">
                  <Hash size={24} aria-hidden="true" />
                  <input
                    id="new-law-number"
                    name="lawNumber"
                    type="text"
                    value={formData.lawNumber}
                    onChange={handleChange}
                    placeholder="Ex.: 125/2026"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="adauga-act-field">
                <label htmlFor="new-law-date">Data actului normativ</label>
                <div className="adauga-act-input-wrap adauga-act-date-wrap">
                  <CalendarDays size={24} aria-hidden="true" />
                  <input
                    id="new-law-date"
                    name="lawDate"
                    type="date"
                    value={formData.lawDate}
                    onChange={handleChange}
                    disabled={saving}
                    aria-label="Data actului normativ"
                  />
                  {!formData.lawDate && (
                    <span
                      className="adauga-act-date-placeholder"
                      aria-hidden="true"
                    >
                      Selectează data
                    </span>
                  )}
                  <ChevronDown
                    className="adauga-act-date-chevron"
                    size={19}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div className="adauga-act-field">
                <label htmlFor="new-law-title">
                  Denumirea actului normativ <span>*</span>
                </label>
                <div className="adauga-act-input-wrap">
                  <FileText size={24} aria-hidden="true" />
                  <input
                    id="new-law-title"
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Introduceți denumirea actului normativ"
                    required
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </section>

          <section
            className="adauga-act-attachments"
            aria-labelledby="law-attachments-heading"
          >
            <div className="adauga-act-attachments-heading">
              <span className="adauga-act-header-icon">
                <Paperclip size={29} strokeWidth={2.1} />
              </span>
              <div>
                <h2 id="law-attachments-heading">
                  Documente și materiale atașate
                </h2>
                <p>Adaugă fotografii, PDF, Word, videoclipuri sau un link.</p>
              </div>
              <span
                className="adauga-act-info-icon"
                title="Maxim 100 MB per fișier"
                aria-label="Maxim 100 MB per fișier"
              >
                <Info size={21} />
              </span>
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
        <footer className="adauga-act-actions">
          <button type="submit" className="adauga-act-submit" disabled={saving}>
            {saving ? (
              <LoaderCircle size={23} className="adauga-act-spin" />
            ) : (
              <Save size={23} />
            )}
            {saving ? "Se salvează..." : "Salvează actul"}
          </button>
          <button
            type="button"
            className="adauga-act-cancel"
            disabled={saving}
            onClick={() => navigate("/legislatie")}
          >
            Anulează
          </button>
        </footer>
      </form>
    </main>
  );
}

export default AdaugaLegislation;
