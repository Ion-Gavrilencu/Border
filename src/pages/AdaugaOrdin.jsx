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
import "./AdaugaOrdin.css";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (/\.docx?$/i.test(file.name || "")) return "word";
  return "other";
};

function AdaugaOrdin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    number: "",
    orderDate: "",
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
      setError("Denumirea ordinului este obligatorie.");
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
      const response = await api.post("/ordine", {
        ...formData,
        title,
        number: formData.number.trim(),
      });
      const order = response.data?.order || response.data?.ordin;
      if (!order?.id) {
        toast.warning(
          "Ordinul a fost creat, dar serverul nu a returnat ID-ul. Verifică lista.",
        );
        navigate("/ordine");
        return;
      }

      const failed = [];
      for (const file of selectedFiles) {
        try {
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "ordine");
          data.append("entityId", String(order.id));
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
            entityType: "ordine",
            entityId: order.id,
            name: order.title,
            url,
          });
        } catch (linkError) {
          console.error("Eroare salvare link:", linkError);
          failed.push("linkul");
        }
      }

      if (failed.length) {
        toast.warning(
          `Ordinul a fost creat, dar nu s-au salvat: ${failed.join(", ")}.`,
        );
      } else {
        toast.success("Ordinul a fost salvat cu succes.");
      }
      navigate("/ordine");
    } catch (requestError) {
      console.error("Eroare salvare ordin:", requestError);
      setError(
        requestError.response?.data?.message || "Ordinul nu a putut fi salvat.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="adauga-ordin-page">
        <h1>Acces restricționat</h1>
        <p>Nu ai permisiunea de a adăuga ordine.</p>
        <button
          type="button"
          className="adauga-ordin-back"
          onClick={() => navigate("/ordine")}
        >
          <ArrowLeft size={19} /> Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-ordin-page">
      <header className="adauga-ordin-header">
        <div className="adauga-ordin-heading-content">
          <span className="adauga-ordin-eyebrow">GESTIONARE CONȚINUT</span>
          <h1>Adaugă ordin</h1>
          <p>
            Înregistrează un ordin intern nou și atașează materialele aferente.
          </p>
        </div>
        <div className="adauga-ordin-illustration" aria-hidden="true">
          <div className="adauga-ordin-illustration-halo" />
          <div className="adauga-ordin-illustration-sheet sheet-back">
            <span />
            <span />
            <span />
          </div>
          <div className="adauga-ordin-illustration-sheet sheet-front">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="adauga-ordin-illustration-plus">+</div>
        </div>
      </header>

      <button
        type="button"
        className="adauga-ordin-back"
        onClick={() => navigate("/ordine")}
        disabled={saving}
      >
        <ArrowLeft size={21} /> Înapoi la listă
      </button>

      <form className="adauga-ordin-form" onSubmit={handleSubmit}>
        {error && (
          <div className="adauga-ordin-error" role="alert">
            {error}
          </div>
        )}
        <div className="adauga-ordin-panel-grid">
          <section
            className="adauga-ordin-info-panel"
            aria-labelledby="order-info-heading"
          >
            <div className="adauga-ordin-form-header">
              <span className="adauga-ordin-header-icon">
                <FilePlus2 size={29} strokeWidth={1.9} />
              </span>
              <div>
                <h2 id="order-info-heading">Ordin intern nou</h2>
                <p>Completează informațiile și adaugă documentele necesare.</p>
              </div>
            </div>
            <div className="adauga-ordin-form-body">
              <div className="adauga-ordin-field">
                <label htmlFor="new-order-number">Număr ordin</label>
                <div className="adauga-ordin-input-wrap">
                  <Hash size={24} aria-hidden="true" />
                  <input
                    id="new-order-number"
                    name="number"
                    type="text"
                    value={formData.number}
                    onChange={handleChange}
                    placeholder="Ex.: 125/2026"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="adauga-ordin-field">
                <label htmlFor="new-order-date">Data ordinului</label>
                <div className="adauga-ordin-input-wrap adauga-ordin-date-wrap">
                  <CalendarDays size={24} aria-hidden="true" />
                  <input
                    id="new-order-date"
                    name="orderDate"
                    type="date"
                    value={formData.orderDate}
                    onChange={handleChange}
                    disabled={saving}
                    aria-label="Data ordinului"
                  />
                  {!formData.orderDate && (
                    <span
                      className="adauga-ordin-date-placeholder"
                      aria-hidden="true"
                    >
                      Selectează data
                    </span>
                  )}
                  <ChevronDown
                    className="adauga-ordin-date-chevron"
                    size={19}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div className="adauga-ordin-field">
                <label htmlFor="new-order-title">
                  Denumirea ordinului <span>*</span>
                </label>
                <div className="adauga-ordin-input-wrap">
                  <FileText size={24} aria-hidden="true" />
                  <input
                    id="new-order-title"
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Introduceți denumirea ordinului"
                    required
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </section>

          <section
            className="adauga-ordin-attachments"
            aria-labelledby="order-attachments-heading"
          >
            <div className="adauga-ordin-attachments-heading">
              <span className="adauga-ordin-header-icon">
                <Paperclip size={29} strokeWidth={2.1} />
              </span>
              <div>
                <h2 id="order-attachments-heading">
                  Documente și materiale atașate
                </h2>
                <p>Adaugă fotografii, PDF, Word, videoclipuri sau un link.</p>
              </div>
              <span
                className="adauga-ordin-info-icon"
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
        <footer className="adauga-ordin-actions">
          <button
            type="submit"
            className="adauga-ordin-submit"
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle size={23} className="adauga-ordin-spin" />
            ) : (
              <Save size={23} />
            )}
            {saving ? "Se salvează..." : "Salvează ordinul"}
          </button>
          <button
            type="button"
            className="adauga-ordin-cancel"
            disabled={saving}
            onClick={() => navigate("/ordine")}
          >
            Anulează
          </button>
        </footer>
      </form>
    </main>
  );
}

export default AdaugaOrdin;
