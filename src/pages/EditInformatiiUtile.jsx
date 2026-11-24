import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Image, Link2, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import api from "../services/api";
import { useAuth } from "../context/authStore";
import DocumentUploader from "../components/DocumentUploader";
import "./EditPagesModern.css";
import "./EditInformatiiUtile.css";
const getCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (
    /\.docx?$/i.test(file.name) ||
    file.type.includes("wordprocessingml") ||
    file.type === "application/msword"
  )
    return "word";
  return "other";
};
const isImage = (item) => item.file_category === "image" || item.mime_type?.startsWith("image/");
const isLink = (item) => item.attachment_type === "link";
function EditInformatiiUtile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [openingId, setOpeningId] = useState(null);
  const [progress, setProgress] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const baseline = useRef(null);
  const mutation = useRef(false);
  const opening = useRef(false);
  const dirty =
    baseline.current !== null &&
    (JSON.stringify(formData) !== baseline.current ||
      selectedFiles.length > 0 ||
      linkUrl.trim() !== "");
  const busy = saving;
  const goBack = () => navigate("/informatii-utile");
  const reportError = (message) => {
    setError(message);
    toast.error(message);
  };
  const requestBack = async () => {
    if (mutation.current) return;
    if (dirty) {
      const result = await Swal.fire({
        title: "Modificări nesalvate",
        text: "Dorești să renunți la modificările nesalvate?",
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
    setNeedsReload(false);
    setSelectedFiles([]);
    setLinkUrl("");
    const loadData = async () => {
      try {
        setLoading(true);
        setLoadFailed(false);
        setError("");
        const [infoResponse, attachmentsResponse] = await Promise.all([
          api.get(`/informatii-utile/${id}`, { signal: controller.signal }),
          api.get(`/attachments/informatii_utile/${id}`, { signal: controller.signal }),
        ]);
        if (!active) return;
        const info = infoResponse.data.informatie;
        if (!info) throw new Error("Informația nu a fost găsită.");
        const loaded = {
          title: info.title || "",
          category: info.category || "",
          content: info.content || "",
        };
        baseline.current = JSON.stringify(loaded);
        setFormData(loaded);
        setAttachments(attachmentsResponse.data.attachments || []);
      } catch (err) {
        console.error("Eroare încărcare informație:", err);
        if (active) {
          setLoadFailed(true);
          reportError(err.response?.data?.message || "Informația nu a putut fi încărcată.");
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
    if (!canEdit || mutation.current || loadFailed || needsReload || !dirty) return;
    const title = formData.title.trim();
    const content = formData.content.trim();
    const url = linkUrl.trim();
    const replacing = selectedFiles.length > 0 || Boolean(url);
    const oldAttachments = [...attachments];
    if (!title) {
      reportError("Titlul informației este obligatoriu.");
      return;
    }
    if (!content && !replacing && !oldAttachments.length) {
      reportError("Adaugă un conținut, un fișier sau un link.");
      return;
    }
    if (url) {
      try {
        if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
      } catch {
        reportError("Introdu un link HTTP sau HTTPS valid.");
        return;
      }
    }
    if (replacing && oldAttachments.length && !canDelete) {
      reportError("Doar administratorul poate înlocui atașamentele existente.");
      return;
    }
    mutation.current = true;
    setSaving(true);
    setError("");
    const newIds = [];
    let committed = false;
    let uploadAttempted = false;
    try {
      if (replacing && oldAttachments.length) {
        const confirmation = await Swal.fire({
          title: "Înlocuiești materialele existente?",
          text: "Materialele vechi vor fi șterse după încărcarea celor noi și salvarea informației.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Înlocuiește",
          cancelButtonText: "Anulează",
        });
        if (!confirmation.isConfirmed) return;
      }
      if (replacing) {
        let n = 0;
        for (const file of selectedFiles) {
          setProgress(`Fișier ${++n} din ${selectedFiles.length}: ${file.name}`);
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "informatii_utile");
          data.append("entityId", String(id));
          data.append("fileCategory", getCategory(file));
          uploadAttempted = true;
          const response = await api.post("/attachments/upload", data);
          if (response.data?.attachment?.id != null) newIds.push(response.data.attachment.id);
          else throw new Error("Serverul nu a confirmat identificatorul noului atașament.");
        }
        if (url) {
          setProgress("Se salvează linkul...");
          uploadAttempted = true;
          const response = await api.post("/attachments/link", {
            entityType: "informatii_utile",
            entityId: id,
            name: title,
            url,
          });
          if (response.data?.attachment?.id != null) newIds.push(response.data.attachment.id);
          else throw new Error("Serverul nu a confirmat identificatorul noului link.");
        }
      }
      setProgress("Se salvează datele informației...");
      await api.patch(`/informatii-utile/${id}`, {
        title,
        category: formData.category.trim(),
        content,
      });
      committed = true;
      baseline.current = JSON.stringify(formData);
      setSelectedFiles([]);
      setLinkUrl("");
      const failures = [];
      if (replacing) {
        let n = 0;
        for (const old of oldAttachments) {
          setProgress(`Se înlocuiește materialul ${++n} din ${oldAttachments.length}...`);
          try {
            await api.delete(`/attachments/${old.id}`);
          } catch {
            failures.push(old.original_name || old.name || `#${old.id}`);
          }
        }
      }
      if (failures.length) {
        setNeedsReload(true);
        try {
          const response = await api.get(`/attachments/informatii_utile/${id}`);
          setAttachments(response.data.attachments || []);
        } catch {
          toast.warning("Lista materialelor nu a putut fi actualizată.");
        }
        reportError(
          `Datele și materialele noi au fost salvate. Unele materiale vechi nu au putut fi șterse: ${failures.join(", ")}. Verifică lista înainte de alte modificări.`,
        );
        return;
      }
      toast.success("Modificările informației au fost salvate.");
      goBack();
    } catch (err) {
      console.error("Eroare modificare informație:", err);
      if (!committed && canDelete) {
        for (const newId of newIds) {
          try {
            await api.delete(`/attachments/${newId}`);
          } catch {
            /* Actualizarea listei va arăta materialele rămase. */
          }
        }
      }
      if (uploadAttempted || committed) {
        setNeedsReload(true);
        try {
          const response = await api.get(`/attachments/informatii_utile/${id}`);
          setAttachments(response.data.attachments || []);
        } catch {
          toast.warning("Lista materialelor nu a putut fi actualizată.");
        }
        reportError(
          (err.response?.data?.message || err.message || "Salvarea nu a reușit.") +
            " Verifică materialele și reîncarcă formularul înainte de o nouă încercare.",
        );
      } else reportError(err.response?.data?.message || "Informația nu a putut fi modificată.");
    } finally {
      mutation.current = false;
      setSaving(false);
      setProgress("");
    }
  };
  if (loading) {
    return (
      <div className="edit-informatii-page edit-informatii-v2">
        <div className="edit-informatii-loading">Se încarcă informația...</div>
      </div>
    );
  }
  return (
    <div className="edit-informatii-page edit-informatii-v2">
      <header className="edit-informatii-header">
        <div>
          <span className="edit-informatii-label">CENTRU DE RESURSE</span>
          <h1>Editează informația utilă</h1>
          <p>Modifică informațiile și documentele atașate.</p>
        </div>
        <button
          type="button"
          className="edit-informatii-back-button"
          disabled={busy}
          onClick={requestBack}
        >
          <ArrowLeft size={17} />
          Înapoi
        </button>
      </header>
      {error && (
        <div className="edit-informatii-error" role="alert">
          {error}
        </div>
      )}
      {loadFailed ? (
        <div className="edit-informatii-error">
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            Încearcă din nou
          </button>
        </div>
      ) : (
        <form className="edit-informatii-form" onSubmit={handleSubmit}>
          <div className="edit-informatii-form-body">
            <section className="edit-informatii-details">
              <div className="edit-informatii-form-header">
                <h2>Datele informației utile</h2>
                <p>Actualizează informațiile și gestionează atașamentele.</p>
              </div>
              <div className="edit-informatii-fields">
                <div className="edit-informatii-form-group">
                  <label htmlFor="info-title">Titlul informației</label>
                  <input
                    id="info-title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    disabled={!canEdit || busy || needsReload}
                    placeholder="Titlul informației"
                  />
                </div>
                <div className="edit-informatii-form-group">
                  <label htmlFor="info-category">Categorie</label>
                  <input
                    id="info-category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    disabled={!canEdit || busy || needsReload}
                    placeholder="Ex.: Proceduri, Contacte, General"
                  />
                </div>
                <div className="edit-informatii-form-group edit-informatii-full">
                  <label htmlFor="info-content">Conținut</label>
                  <textarea
                    id="info-content"
                    name="content"
                    value={formData.content}
                    onChange={handleChange}
                    rows={4}
                    disabled={!canEdit || busy || needsReload}
                    placeholder="Introduceți conținutul informației..."
                  />
                </div>
              </div>
            </section>
            <section className="edit-informatii-section edit-informatii-existing">
              <div className="edit-informatii-section-heading">
                <h3>Documente și linkuri existente</h3>
                <span className="edit-informatii-count">{attachments.length}</span>
              </div>
              <p className="edit-informatii-section-description">
                Materialele deja salvate pentru această informație.
              </p>
              {attachments.length === 0 ? (
                <p className="edit-informatii-empty">Nu există documente atașate.</p>
              ) : (
                <div className="edit-informatii-attachments">
                  {attachments.map((attachment) => {
                    const Icon = isLink(attachment)
                      ? Link2
                      : isImage(attachment)
                        ? Image
                        : FileText;
                    return (
                      <div key={attachment.id} className="edit-informatii-attachment">
                        <div className="edit-informatii-attachment-icon">
                          <Icon size={19} />
                        </div>
                        <div className="edit-informatii-attachment-name">
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
                        <div className="edit-informatii-attachment-actions">
                          <button
                            type="button"
                            title="Deschide"
                            aria-label="Deschide atașamentul"
                            disabled={openingId !== null || busy}
                            onClick={() => handleOpenAttachment(attachment)}
                          >
                            <ExternalLink size={17} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            {canEdit && (
              <section className="edit-informatii-section edit-informatii-new">
                <h3>Adaugă documente, fotografii sau link</h3>
                <p className="edit-informatii-section-description">
                  {attachments.length
                    ? "Materialele noi vor înlocui materialele existente. Dacă nu adaugi nimic, acestea se păstrează."
                    : "Încarcă fișiere noi sau adaugă un link extern."}
                </p>
                {attachments.length > 0 && !canDelete && (
                  <p className="edit-informatii-section-description">
                    Doar administratorul poate înlocui materialele existente.
                  </p>
                )}
                <DocumentUploader
                  files={selectedFiles}
                  onFilesChange={setSelectedFiles}
                  linkUrl={linkUrl}
                  onLinkChange={setLinkUrl}
                  disabled={busy || needsReload || (attachments.length > 0 && !canDelete)}
                  allowMixed
                  onError={(message) => {
                    if (message) reportError(message);
                  }}
                  variant="telegram"
                />
              </section>
            )}
          </div>
          {needsReload && (
            <div className="edit-informatii-error">
              <button
                type="button"
                onClick={async () => {
                  const result = await Swal.fire({
                    title: "Reîncarci formularul?",
                    text: "Modificările locale nesalvate vor fi pierdute.",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Reîncarcă",
                    cancelButtonText: "Anulează",
                  });
                  if (result.isConfirmed) setReload((n) => n + 1);
                }}
              >
                Reîncarcă formularul
              </button>
            </div>
          )}
          <div className="edit-informatii-status" role="status" aria-live="polite">
            {saving
              ? progress
              : dirty
                ? "Ai modificări nesalvate."
                : "Nu există modificări nesalvate."}
          </div>
          <div className="edit-informatii-actions">
            <button
              type="button"
              className="edit-informatii-cancel-button"
              onClick={requestBack}
              disabled={busy}
            >
              Anulează
            </button>
            {canEdit && (
              <button
                type="submit"
                className="edit-informatii-save-button"
                disabled={busy || !dirty || needsReload}
              >
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
export default EditInformatiiUtile;
