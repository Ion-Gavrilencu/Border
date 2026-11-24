import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Image, Link2, ExternalLink, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import api from "../services/api";
import { useAuth } from "../context/authStore";
import DocumentUploader from "../components/DocumentUploader";
import "./EditPagesModern.css";
import "./EditTelegram.css";
const getCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (/\.docx?$/i.test(file.name)) return "word";
  return "other";
};
const isImage = (item) => item.file_category === "image" || item.mime_type?.startsWith("image/");
const isLink = (item) => item.attachment_type === "link";
function EditTelegram() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";
  const [formData, setFormData] = useState({
    title: "",
    number: "",
    telegramDate: "",
    content: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [openingId, setOpeningId] = useState(null);
  const [progress, setProgress] = useState("");
  const baseline = useRef(null);
  const mutation = useRef(false);
  const opening = useRef(false);
  const dirty =
    baseline.current !== null &&
    (JSON.stringify(formData) !== baseline.current ||
      selectedFiles.length > 0 ||
      linkUrl.trim() !== "");
  const busy = saving || deletingId !== null;
  const goBack = () => navigate("/telegrame");
  const reportError = (message) => {
    setError(message);
    toast.error(message);
  };
  const requestBack = async () => {
    if (mutation.current) return;
    if (dirty) {
      const result = await Swal.fire({
        title: "Modificări nesalvate",
        text: "Dorești să renunți la modificările nesalvate? Ștergerile deja confirmate rămân aplicate.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Renunță",
        cancelButtonText: "Continuă editarea",
      });
      if (!result.isConfirmed) return;
    }
    goBack();
  };
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    baseline.current = null;
    setSelectedFiles([]);
    setLinkUrl("");
    const loadData = async () => {
      try {
        setLoading(true);
        setLoadFailed(false);
        setError("");
        const [telegramResponse, attachmentsResponse] = await Promise.all([
          api.get(`/telegrame/${id}`, { signal: controller.signal }),
          api.get(`/attachments/telegrame/${id}`, { signal: controller.signal }),
        ]);
        if (!active) return;
        const telegram = telegramResponse.data.telegram;
        const loaded = {
          title: telegram.title || "",
          number: telegram.number || "",
          telegramDate: telegram.telegram_date ? telegram.telegram_date.split("T")[0] : "",
          content: telegram.content || "",
        };
        baseline.current = JSON.stringify(loaded);
        setFormData(loaded);
        setAttachments(attachmentsResponse.data.attachments || []);
      } catch (err) {
        console.error("Eroare încărcare telegramă:", err);
        if (active) {
          setLoadFailed(true);
          reportError(err.response?.data?.message || "Telegrama nu a putut fi încărcată.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, reload]);
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };
  const handleDeleteAttachment = async (attachment) => {
    if (!canDelete || mutation.current || loadFailed) return;
    mutation.current = true;
    setDeletingId(attachment.id);
    try {
      const result = await Swal.fire({
        title: "Ștergi atașamentul?",
        text: "Atașamentul va fi șters imediat, chiar dacă anulezi editarea telegramei.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Da, șterge",
        cancelButtonText: "Anulează",
        confirmButtonColor: "#c43b47",
      });
      if (!result.isConfirmed) return;
      setError("");
      await api.delete(`/attachments/${attachment.id}`);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      toast.success("Atașamentul a fost șters.");
    } catch (err) {
      console.error("Eroare ștergere atașament:", err);
      reportError(err.response?.data?.message || "Atașamentul nu a putut fi șters.");
    } finally {
      mutation.current = false;
      setDeletingId(null);
    }
  };
  const handleOpenAttachment = async (attachment) => {
    if (isLink(attachment)) {
      try {
        const url = new URL(attachment.url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Link invalid");
        window.open(url.href, "_blank", "noopener,noreferrer");
      } catch {
        reportError("Adresa linkului nu este validă.");
      }
      return;
    }
    if (opening.current) return;
    opening.current = true;
    setOpeningId(attachment.id);
    // Fișierele private se descarcă prin instanța Axios autentificată.
    // URL-ul blob este temporar și nu expune tokenul în adresă.
    const tab = window.open("", "_blank");
    try {
      if (tab) tab.opener = null;
      const response = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });
      const mime =
        response.headers?.["content-type"] || response.data.type || "application/octet-stream";
      const blob = new Blob([response.data], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      if (tab && !tab.closed) {
        tab.location.href = objectUrl;
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download =
          attachment.original_name || attachment.file_name || attachment.name || "document";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      if (tab && !tab.closed) tab.close();
      reportError(err.response?.data?.message || "Fișierul nu a putut fi deschis.");
    } finally {
      opening.current = false;
      setOpeningId(null);
    }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || mutation.current || loadFailed || !dirty) return;
    if (!formData.title.trim()) {
      reportError("Denumirea telegramei este obligatorie.");
      return;
    }
    if (linkUrl.trim()) {
      try {
        const url = new URL(linkUrl.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Link invalid");
        }
      } catch {
        reportError("Introdu un link HTTP sau HTTPS valid.");
        return;
      }
    }
    mutation.current = true;
    setSaving(true);
    setProgress("Se salvează datele telegramei...");
    setError("");
    try {
      await api.patch(`/telegrame/${id}`, {
        ...formData,
        title: formData.title.trim(),
      });
      baseline.current = JSON.stringify(formData);
      const failed = [];
      const remainingFiles = [];
      let completed = 0;
      for (const file of selectedFiles) {
        setProgress(`Fișier ${++completed} din ${selectedFiles.length}: ${file.name}`);
        try {
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "telegrame");
          data.append("entityId", id);
          data.append("fileCategory", getCategory(file));
          await api.post("/attachments/upload", data);
        } catch (err) {
          console.error("Eroare încărcare fișier:", err);
          failed.push(file.name);
          remainingFiles.push(file);
        }
      }
      setSelectedFiles(remainingFiles);
      if (linkUrl.trim()) {
        setProgress("Se salvează linkul...");
        try {
          await api.post("/attachments/link", {
            entityType: "telegrame",
            entityId: id,
            name: formData.title.trim(),
            url: linkUrl.trim(),
          });
          setLinkUrl("");
        } catch (err) {
          console.error("Eroare salvare link:", err);
          failed.push("Link");
        }
      }
      if (failed.length > 0) {
        try {
          const response = await api.get(`/attachments/telegrame/${id}`);
          setAttachments(response.data.attachments || []);
        } catch {
          toast.warning("Lista atașamentelor nu a putut fi actualizată.");
        }
        reportError(`Datele au fost salvate, dar nu s-au adăugat: ${failed.join(", ")}.`);
        return;
      }
      toast.success("Modificările telegramei au fost salvate.");
      goBack();
    } catch (err) {
      console.error("Eroare modificare telegramă:", err);
      reportError(err.response?.data?.message || "Telegrama nu a putut fi modificată.");
    } finally {
      mutation.current = false;
      setSaving(false);
      setProgress("");
    }
  };
  if (loading) {
    return (
      <div className="edit-telegram-page edit-telegram-v2">
        <div className="edit-telegram-loading">Se încarcă telegrama...</div>
      </div>
    );
  }
  return (
    <div className="edit-telegram-page edit-telegram-v2">
      <header className="edit-telegram-header">
        <div>
          <span className="edit-telegram-label">GESTIONARE TELEGRAME</span>
          <h1>Editează telegrama</h1>
          <p>Modifică informațiile și documentele atașate.</p>
        </div>
        <button
          type="button"
          className="edit-telegram-back-button"
          disabled={busy}
          onClick={requestBack}
        >
          <ArrowLeft size={17} />
          Înapoi
        </button>
      </header>
      {error && (
        <div className="edit-telegram-error" role="alert">
          {error}
        </div>
      )}
      {loadFailed ? (
        <div className="edit-telegram-error">
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            Încearcă din nou
          </button>
        </div>
      ) : (
        <form className="edit-telegram-form" onSubmit={handleSubmit}>
          <div className="edit-telegram-form-body">
            <section className="edit-telegram-details">
              <div className="edit-telegram-form-header">
                <h2>Datele telegramei</h2>
                <p>Actualizează informațiile și gestionează atașamentele.</p>
              </div>
              <div className="edit-telegram-fields">
                <div className="edit-telegram-form-group">
                  <label htmlFor="telegram-number">Număr telegramă</label>
                  <input
                    id="telegram-number"
                    type="text"
                    name="number"
                    value={formData.number}
                    onChange={handleChange}
                    placeholder="Ex.: 125/2026"
                    disabled={!canEdit || busy}
                  />
                </div>
                <div className="edit-telegram-form-group">
                  <label htmlFor="telegram-date">Data telegramei</label>
                  <input
                    id="telegram-date"
                    type="date"
                    name="telegramDate"
                    value={formData.telegramDate}
                    onChange={handleChange}
                    disabled={!canEdit || busy}
                  />
                </div>
                <div className="edit-telegram-form-group edit-telegram-full">
                  <label htmlFor="telegram-title">Denumirea telegramei</label>
                  <input
                    id="telegram-title"
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Denumirea telegramei"
                    required
                    disabled={!canEdit || busy}
                  />
                </div>
              </div>
            </section>
            <section className="edit-telegram-section edit-telegram-existing">
              <div className="edit-telegram-section-heading">
                <h3>Documente și linkuri existente</h3>
                <span className="edit-telegram-count">{attachments.length}</span>
              </div>
              <p className="edit-telegram-section-description">
                Materialele deja salvate pentru această telegramă.
              </p>
              {attachments.length === 0 ? (
                <p className="edit-telegram-empty">Nu există documente atașate.</p>
              ) : (
                <div className="edit-telegram-attachments">
                  {attachments.map((attachment) => {
                    const Icon = isLink(attachment)
                      ? Link2
                      : isImage(attachment)
                        ? Image
                        : FileText;
                    return (
                      <div key={attachment.id} className="edit-telegram-attachment">
                        <div className="edit-telegram-attachment-icon">
                          <Icon size={19} />
                        </div>
                        <div className="edit-telegram-attachment-name">
                          <strong>
                            {attachment.original_name ||
                              attachment.file_name ||
                              attachment.name ||
                              (isLink(attachment) ? attachment.url : "Document")}
                          </strong>
                          <span>
                            {isLink(attachment)
                              ? "LINK"
                              : isImage(attachment)
                                ? "FOTOGRAFIE"
                                : "DOCUMENT"}
                          </span>
                        </div>
                        <div className="edit-telegram-attachment-actions">
                          <button
                            type="button"
                            title="Deschide"
                            aria-label="Deschide atașamentul"
                            disabled={openingId !== null || busy}
                            onClick={() => handleOpenAttachment(attachment)}
                          >
                            <ExternalLink size={17} />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              className="edit-telegram-attachment-delete"
                              title="Șterge"
                              aria-label="Șterge atașamentul"
                              disabled={deletingId !== null || saving}
                              onClick={() => handleDeleteAttachment(attachment)}
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            {canEdit && (
              <section className="edit-telegram-section edit-telegram-new">
                <h3>Adaugă documente, fotografii sau link</h3>
                <p className="edit-telegram-section-description">
                  Încarcă fișiere noi sau adaugă un link extern. Documentele existente vor fi
                  păstrate.
                </p>
                <DocumentUploader
                  files={selectedFiles}
                  onFilesChange={setSelectedFiles}
                  linkUrl={linkUrl}
                  onLinkChange={setLinkUrl}
                  disabled={busy}
                  onError={reportError}
                  variant="telegram"
                />
              </section>
            )}
          </div>
          <div className="edit-telegram-status" role="status" aria-live="polite">
            {saving
              ? progress
              : dirty
                ? "Ai modificări nesalvate."
                : "Nu există modificări nesalvate."}
          </div>
          <div className="edit-telegram-actions">
            <button
              type="button"
              className="edit-telegram-cancel-button"
              onClick={requestBack}
              disabled={busy}
            >
              Anulează
            </button>
            {canEdit && (
              <button type="submit" className="edit-telegram-save-button" disabled={busy || !dirty}>
                <Save size={17} />
                {saving ? "Se salvează..." : "Salvează modificările"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
export default EditTelegram;
