import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FilePlus2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import DocumentUploader from "../components/DocumentUploader";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./AdaugaLegislation.css";

const getFileCategory = (file) => {
  const type = file.type || "";

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";

  if (type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return "pdf";
  }

  if (/\.docx?$/i.test(file.name)) {
    return "word";
  }

  return "other";
};

export default function AdaugaLegislation() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  const [formData, setFormData] = useState({
    title: "",
    lawNumber: "",
    lawDate: "",
    content: "",
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    if (!formData.title.trim()) {
      setError("Denumirea actului normativ este obligatorie.");
      return;
    }

    if (!selectedFiles.length && !linkUrl.trim()) {
      setError("Adaugă un document, fotografii sau un link.");
      return;
    }

    if (linkUrl.trim()) {
      try {
        const url = new URL(linkUrl.trim());

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Link invalid");
        }
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
        title: formData.title.trim(),
      });

      const legislation = response.data?.legislation;

      if (!legislation?.id) {
        throw new Error("Serverul nu a returnat ID-ul actului normativ.");
      }

      const failed = [];

      // Încărcarea documentelor
      for (const file of selectedFiles) {
        try {
          const data = new FormData();

          data.append("file", file);
          data.append("entityType", "legislatie");
          data.append("entityId", legislation.id);
          data.append("fileCategory", getFileCategory(file));

          await api.post("/attachments/upload", data);
        } catch (err) {
          console.error("Eroare încărcare document:", err);
          failed.push(file.name);
        }
      }

      // Salvarea linkului
      if (linkUrl.trim()) {
        try {
          await api.post("/attachments/link", {
            entityType: "legislatie",
            entityId: legislation.id,
            name: legislation.title,
            url: linkUrl.trim(),
          });
        } catch (err) {
          console.error("Eroare salvare link:", err);
          failed.push("linkul");
        }
      }

      if (failed.length > 0) {
        toast.warning(
          `Actul a fost creat, dar nu s-au salvat: ${failed.join(", ")}.`,
        );
      } else {
        toast.success("Actul normativ a fost adăugat cu succes.");
      }

      navigate("/legislatie");
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Actul normativ nu a putut fi salvat.";

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="adauga-act-page">
        <p>Nu ai permisiunea de a adăuga acte normative.</p>

        <button
          type="button"
          className="adauga-act-back"
          onClick={() => navigate("/legislatie")}
        >
          <ArrowLeft size={18} />
          Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-act-page">
      {/* ANTET CU BUTON ÎN DREAPTA */}
      <div className="adauga-act-top">
        <header className="adauga-act-heading">
          <span className="adauga-act-eyebrow">
            <FilePlus2 size={16} />
            GESTIONARE CONȚINUT
          </span>

          <h1>Adaugă act normativ</h1>

          <p>
            Completează datele actului și atașează documentul sau linkul
            aferent.
          </p>
        </header>

        <button
          type="button"
          className="adauga-act-back"
          onClick={() => navigate("/legislatie")}
          disabled={saving}
        >
          <ArrowLeft size={19} />
          Înapoi la listă
        </button>
      </div>

      {/* FORMULAR */}
      <form className="adauga-act-form" onSubmit={handleSubmit}>
        {error && (
          <div className="adauga-act-error" role="alert">
            {error}
          </div>
        )}

        <div className="adauga-act-fields">
          {/* NUMĂR */}
          <label>
            Număr act normativ
            <input
              type="text"
              value={formData.lawNumber}
              placeholder="Ex: 125/2026"
              onChange={(event) => update("lawNumber", event.target.value)}
              disabled={saving}
            />
          </label>

          {/* DATĂ */}
          <label>
            Data actului normativ
            <input
              type="date"
              value={formData.lawDate}
              onChange={(event) => update("lawDate", event.target.value)}
              disabled={saving}
            />
          </label>

          {/* DENUMIRE */}
          <label className="adauga-act-full">
            Denumirea actului normativ
            <input
              type="text"
              required
              value={formData.title}
              placeholder="Introduceți denumirea actului normativ"
              onChange={(event) => update("title", event.target.value)}
              disabled={saving}
            />
          </label>

          {/* DOCUMENTE ȘI LINKURI */}
          <div className="adauga-act-full">
            <label className="adauga-act-upload-label">
              Documente și linkuri
            </label>

            <DocumentUploader
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              linkUrl={linkUrl}
              onLinkChange={setLinkUrl}
              disabled={saving}
              onError={setError}
            />
          </div>
        </div>

        {/* BUTOANE FORMULAR */}
        <footer className="adauga-act-actions">
          <button
            type="button"
            className="adauga-act-cancel"
            onClick={() => navigate("/legislatie")}
            disabled={saving}
          >
            Anulează
          </button>

          <button type="submit" className="adauga-act-save" disabled={saving}>
            {saving ? (
              <>
                <LoaderCircle size={17} className="adauga-act-spin" />
                Se salvează...
              </>
            ) : (
              <>
                <FilePlus2 size={17} />
                Salvează actul
              </>
            )}
          </button>
        </footer>
      </form>
    </main>
  );
}
