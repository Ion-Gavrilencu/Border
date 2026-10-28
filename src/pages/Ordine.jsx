import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  AlertCircle,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";
import TelegramGallery from "../components/TelegramGallery";
import "./Ordine.css";

const emptyForm = { title: "", number: "", orderDate: "", content: "" };

const getFileCategory = (file) => {
  const type = file.type || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (/\.docx?$/i.test(file.name)) return "word";
  return "other";
};

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : "—";
};

function Ordine() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";

  const [ordine, setOrdine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [galleryOrder, setGalleryOrder] = useState(null);

  const fetchOrdine = useCallback(async () => {
    try {
      const response = await api.get("/ordine");
      setOrdine(
        Array.isArray(response.data?.ordine) ? response.data.ordine : [],
      );
      setError("");
    } catch (err) {
      console.error("Eroare încărcare ordine:", err);
      setError(
        err.response?.data?.message || "Ordinele nu au putut fi încărcate.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdine();
  }, [fetchOrdine]);

  const resetForm = () => {
    if (saving) return;
    setFormData({ ...emptyForm });
    setSelectedFiles([]);
    setLinkUrl("");
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || saving) return;
    if (!formData.title.trim()) {
      toast.error("Denumirea ordinului este obligatorie.");
      return;
    }
    if (selectedFiles.length === 0 && !linkUrl.trim()) {
      toast.error("Adaugă un document, fotografii sau un link.");
      return;
    }
    if (linkUrl.trim()) {
      try {
        const url = new URL(linkUrl.trim());
        if (!["http:", "https:"].includes(url.protocol))
          throw new Error("Link invalid");
      } catch {
        toast.error("Introdu un link HTTP sau HTTPS valid.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const response = await api.post("/ordine", {
        ...formData,
        title: formData.title.trim(),
      });
      const order = response.data.order || response.data.ordin;
      if (!order?.id) throw new Error("API-ul nu a returnat ID-ul ordinului.");
      const failed = [];
      for (const file of selectedFiles) {
        try {
          const data = new FormData();
          data.append("file", file);
          data.append("entityType", "ordine");
          data.append("entityId", order.id);
          data.append("fileCategory", getFileCategory(file));
          await api.post("/attachments/upload", data);
        } catch (err) {
          console.error("Eroare încărcare fișier:", err);
          failed.push(file.name);
        }
      }
      if (linkUrl.trim()) {
        try {
          await api.post("/attachments/link", {
            entityType: "ordine",
            entityId: order.id,
            name: order.title,
            url: linkUrl.trim(),
          });
        } catch (err) {
          console.error("Eroare salvare link:", err);
          failed.push("linkul");
        }
      }
      await fetchOrdine();
      setFormData({ ...emptyForm });
      setSelectedFiles([]);
      setLinkUrl("");
      setShowForm(false);
      if (failed.length) {
        const message = `Ordinul a fost creat, dar nu s-au salvat: ${failed.join(", ")}.`;
        setError(message);
        toast.warning(message);
      } else {
        toast.success("Ordinul a fost adăugat cu succes.");
      }
    } catch (err) {
      console.error("Eroare salvare ordin:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Ordinul nu a putut fi salvat.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenOrder = async (order) => {
    const newTab = window.open("about:blank", "_blank");
    if (newTab) newTab.opener = null;
    try {
      const response = await api.get(`/attachments/ordine/${order.id}`);
      const attachments = response.data?.attachments || [];
      const images = attachments.filter(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "image" ||
            item.mime_type?.startsWith("image/")),
      );
      const pdf = attachments.find(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "pdf" ||
            item.mime_type === "application/pdf" ||
            /\.pdf$/i.test(
              item.original_name || item.file_name || item.name || "",
            )),
      );
      if (!pdf && images.length > 1) {
        newTab?.close();
        setGalleryOrder(order);
        return;
      }
      const attachment = pdf || attachments[0];
      if (!attachment) {
        newTab?.close();
        toast.info("Acest ordin nu are documente sau linkuri atașate.");
        return;
      }
      let url;
      if (attachment.attachment_type === "link") {
        url = attachment.url;
        if (!/^https?:\/\//i.test(url || "")) throw new Error("Link invalid");
      } else {
        url = `${api.defaults.baseURL}/attachments/file/${attachment.id}`;
      }
      if (newTab && !newTab.closed) newTab.location.replace(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      newTab?.close();
      console.error("Eroare deschidere ordin:", err);
      toast.error("Nu s-a putut deschide documentul sau linkul ordinului.");
    }
  };

  const handleEditOrder = (order) => {
    if (canEdit) navigate(`/ordine/${order.id}/edit`);
  };

  const handleDeleteOrder = async (order) => {
    if (!canDelete || deletingId !== null) return;
    const result = await Swal.fire({
      title: "Ștergi ordinul?",
      text: `„${order.title}” va fi șters definitiv.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Da, șterge",
      cancelButtonText: "Anulează",
      confirmButtonColor: "#c43b47",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setDeletingId(order.id);
    setError("");
    try {
      await api.delete(`/ordine/${order.id}`);
      setOrdine((current) => current.filter((item) => item.id !== order.id));
      if (galleryOrder?.id === order.id) setGalleryOrder(null);
      toast.success("Ordinul a fost șters.");
    } catch (err) {
      console.error("Eroare ștergere ordin:", err);
      const message =
        err.response?.data?.message || "Ordinul nu a putut fi șters.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="ordine-page ordine-modern">
        <div className="ordine-loading">
          <LoaderCircle className="ordine-spin" size={22} /> Se încarcă
          ordinele...
        </div>
      </div>
    );
  }

  return (
    <div className="ordine-page ordine-modern">
      <div className="ordine-header">
        <div className="ordine-heading">
          <span className="ordine-eyebrow">
            <FileText size={14} /> DOCUMENTE INTERNE
          </span>
          <h1>Ordine interne</h1>
          <p className="ordine-description">
            Lista ordinelor interne disponibile în platformă.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="ordine-add-button"
            disabled={saving}
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
          >
            {showForm ? (
              <>
                <X size={18} /> Închide formularul
              </>
            ) : (
              <>
                <Plus size={18} /> Adaugă ordin
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="ordine-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={fetchOrdine} title="Reîncarcă">
            <RefreshCw size={17} />
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showForm && canEdit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <form className="ordine-form" onSubmit={handleSubmit}>
              <div className="ordine-form-header">
                <div>
                  <h2>Adaugă ordin intern</h2>
                  <p>Completează datele și atașează documentul.</p>
                </div>
                <button
                  type="button"
                  className="ordine-form-close"
                  onClick={resetForm}
                  disabled={saving}
                  aria-label="Închide formularul"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="ordine-form-body">
                <div className="ordine-form-group">
                  <label htmlFor="order-number">Număr ordin</label>
                  <input
                    id="order-number"
                    type="text"
                    placeholder="Ex: 123/2026"
                    value={formData.number}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        number: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="ordine-form-group">
                  <label htmlFor="order-date">Data ordinului</label>
                  <input
                    id="order-date"
                    type="date"
                    value={formData.orderDate}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        orderDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="ordine-form-group ordine-form-full">
                  <label htmlFor="order-title">Denumirea ordinului</label>
                  <input
                    id="order-title"
                    type="text"
                    required
                    placeholder="Introduceți denumirea ordinului"
                    value={formData.title}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="ordine-form-group ordine-form-full">
                  <label>Conținutul ordinului</label>
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
              <div className="ordine-form-actions">
                <button
                  type="button"
                  className="ordine-cancel-button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="ordine-save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={17} className="ordine-spin" /> Se
                      salvează...
                    </>
                  ) : (
                    <>
                      <FileText size={17} /> Salvează ordinul
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ordine-list-heading">
        <div>
          <h2>Registrul ordinelor</h2>
          <p>Accesează un ordin pentru a consulta documentele atașate.</p>
        </div>
        <span className="ordine-count">
          {ordine.length} {ordine.length === 1 ? "ordin" : "ordine"}
        </span>
      </div>
      {ordine.length === 0 ? (
        <div className="ordine-empty">
          <FileText size={30} />
          <strong>Nu există ordine.</strong>
          <span>Ordinele adăugate vor apărea aici.</span>
        </div>
      ) : (
        <div className="ordine-table-container">
          <table className="ordine-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Număr</th>
                <th>Titlu</th>
                <th>Data</th>
                <th>Creat de</th>
                {(canEdit || canDelete) && <th>Acțiuni</th>}
              </tr>
            </thead>
            <tbody>
              {ordine.map((order) => (
                <tr
                  key={order.id}
                  className="ordine-row"
                  onClick={() => handleOpenOrder(order)}
                >
                  <td data-label="ID">{order.id}</td>
                  <td data-label="Număr">{order.number || "—"}</td>
                  <td data-label="Titlu" className="ordine-title-cell">
                    <button
                      type="button"
                      className="ordine-title-link"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenOrder(order);
                      }}
                    >
                      {order.title}
                    </button>
                  </td>
                  <td data-label="Data">{formatDate(order.order_date)}</td>
                  <td data-label="Creat de">
                    {order.created_by_name || order.created_by_username || "—"}
                  </td>
                  {(canEdit || canDelete) && (
                    <td
                      data-label="Acțiuni"
                      className="ordine-actions-cell"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="ordine-actions">
                        {canEdit && (
                          <button
                            type="button"
                            className="ordine-icon-button"
                            title="Editează ordinul"
                            aria-label={`Editează ${order.title}`}
                            onClick={() => handleEditOrder(order)}
                          >
                            <Pencil size={17} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="ordine-icon-button ordine-delete-button"
                            title="Șterge ordinul"
                            aria-label={`Șterge ${order.title}`}
                            disabled={deletingId !== null}
                            onClick={() => handleDeleteOrder(order)}
                          >
                            {deletingId === order.id ? (
                              <LoaderCircle className="ordine-spin" size={17} />
                            ) : (
                              <Trash2 size={17} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {galleryOrder && (
        <TelegramGallery
          entityType="ordine"
          entityId={galleryOrder.id}
          title={galleryOrder.title}
          onClose={() => setGalleryOrder(null)}
        />
      )}
    </div>
  );
}

export default Ordine;
