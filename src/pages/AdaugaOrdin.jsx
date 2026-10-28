import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, FilePlus2, FileText, Hash, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";
import "./AdaugaOrdin.css";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";
  if (file.type?.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (/\\.docx?$/i.test(file.name || "")) return "word";
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
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
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
        toast.warning("Ordinul a fost creată, dar serverul nu a returnat ID-ul. Verifică lista.");
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
        toast.warning(`Ordinul a fost creată, dar nu s-au salvat: ${failed.join(", ")}.`);
      } else {
        toast.success("Ordinul a fost salvată cu succes.");
      }
      navigate("/ordine");
    } catch (requestError) {
      console.error("Eroare salvare ordin:", requestError);
      setError(
        requestError.response?.data?.message ||
          "Ordinul nu a putut fi salvată."
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
        <button type="button" className="adauga-ordin-back" onClick={() => navigate("/ordine")}>
          <ArrowLeft size={17} /> Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-ordin-page">
      <header className="adauga-ordin-header">
        <div>
          <span className="adauga-ordin-eyebrow">GESTIONARE CONȚINUT</span>
          <h1>Adaugă ordin</h1>
          <p>Înregistrează un ordin intern nou și atașează materialele aferente.</p>
        </div>
        <button
          type="button"
          className="adauga-ordin-back"
          onClick={() => navigate("/ordine")}
          disabled={saving}
        >
          <ArrowLeft size={17} /> Înapoi la listă
        </button>
      </header>

      <form className="adauga-ordin-form" onSubmit={handleSubmit}>
        <div className="adauga-ordin-form-header">
          <span className="adauga-ordin-header-icon"><FilePlus2 size={24} /></span>
          <div>
            <h2>Ordin intern nou</h2>
            <p>Completează informațiile și adaugă documentele necesare.</p>
          </div>
        </div>

        <div className="adauga-ordin-form-body">
          {error && <div className="adauga-ordin-error" role="alert">{error}</div>}

          <div className="adauga-ordin-grid">
            <div className="adauga-ordin-field">
              <label htmlFor="new-order-number">Număr ordin</label>
              <div className="adauga-ordin-input-wrap">
                <Hash size={18} aria-hidden="true" />
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
              <div className="adauga-ordin-input-wrap">
                <CalendarDays size={18} aria-hidden="true" />
                <input
                  id="new-order-date"
                  name="orderDate"
                  type="date"
                  value={formData.orderDate}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="adauga-ordin-field">
            <label htmlFor="new-order-title">Denumirea ordinului <span>*</span></label>
            <div className="adauga-ordin-input-wrap">
              <FileText size={18} aria-hidden="true" />
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

          <section className="adauga-ordin-attachments">
            <div className="adauga-ordin-attachments-heading">
              <span className="adauga-ordin-header-icon"><FileText size={21} /></span>
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

        <footer className="adauga-ordin-actions">
          <button type="button" className="adauga-ordin-cancel" disabled={saving} onClick={() => navigate("/ordine")}>
            Anulează
          </button>
          <button type="submit" className="adauga-ordin-submit" disabled={saving}>
            {saving ? <LoaderCircle size={18} className="adauga-ordin-spin" /> : <Save size={18} />}
            {saving ? "Se salvează..." : "Salvează ordinul"}
          </button>
        </footer>
      </form>
    </main>
  );
}

export default AdaugaOrdin;
