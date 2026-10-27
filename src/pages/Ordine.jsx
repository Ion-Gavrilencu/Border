
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import DocumentUploader from "../components/DocumentUploader";
import TelegramGallery from "../components/TelegramGallery";

import "./Ordine.css";

const emptyForm = {
  title: "",
  number: "",
  orderDate: "",
  content: "",
};

const getFileCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (/\.docx?$/i.test(file.name)) return "word";
  return "other";
};

const formatDate = (value) => {
  if (!value) return "-";

  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split("-");

  return year && month && day
    ? `${day}.${month}.${year}`
    : "-";
};

function Ordine() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit =
    user?.role === "EDITOR" || user?.role === "ADMIN";
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

  const fetchOrdine = async () => {
    try {
      const response = await api.get("/ordine");
      setOrdine(response.data.ordine || []);
    } catch (err) {
      console.error("Eroare încărcare ordine:", err);
      setError(
        err.response?.data?.message ||
          "Ordinele nu au putut fi încărcate."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdine();
  }, []);

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setSelectedFiles([]);
    setLinkUrl("");
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    if (!formData.title.trim()) {
      setError("Denumirea ordinului este obligatorie.");
      return;
    }

    if (selectedFiles.length === 0 && !linkUrl.trim()) {
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
      const response = await api.post("/ordine", {
        ...formData,
        title: formData.title.trim(),
      });

      const order = response.data.order || response.data.ordin;

      if (!order?.id) {
        throw new Error("API-ul nu a returnat ID-ul ordinului.");
      }

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
          failed.push("Link");
        }
      }

      await fetchOrdine();
      resetForm();

      if (failed.length > 0) {
        setError(
          `Ordinul a fost creat, dar nu s-au salvat: ${failed.join(", ")}.`
        );
      }
    } catch (err) {
      console.error("Eroare salvare ordin:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Ordinul nu a putut fi salvat."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenOrder = async (order) => {
    const newTab = window.open("about:blank", "_blank");

    if (newTab) newTab.opener = null;

    try {
      const response = await api.get(
        `/attachments/ordine/${order.id}`
      );

      const attachments = response.data.attachments || [];

      const images = attachments.filter(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "image" ||
            item.mime_type?.startsWith("image/"))
      );

      const pdf = attachments.find(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "pdf" ||
            item.mime_type === "application/pdf" ||
            /\.pdf$/i.test(
              item.original_name ||
                item.file_name ||
                item.name ||
                ""
            ))
      );

      if (!pdf && images.length > 1) {
        newTab?.close();
        setGalleryOrder(order);
        return;
      }

      const attachment = pdf || attachments[0];

      if (!attachment) {
        newTab?.close();
        alert("Acest ordin nu are documente sau linkuri atașate.");
        return;
      }

      let url;

      if (attachment.attachment_type === "link") {
        url = attachment.url;

        if (!/^https?:\/\//i.test(url || "")) {
          throw new Error("Link invalid");
        }
      } else {
        url =
          `${api.defaults.baseURL}/attachments/file/${attachment.id}`;
      }

      if (newTab && !newTab.closed) {
        newTab.location.replace(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      newTab?.close();
      console.error("Eroare deschidere ordin:", err);

      setError(
        "Nu s-a putut deschide documentul sau linkul ordinului."
      );
    }
  };

  const handleEditOrder = (order) => {
    if (!canEdit) return;
    navigate(`/ordine/${order.id}/edit`);
  };

  const handleDeleteOrder = async (order) => {
    if (!canDelete || deletingId !== null) return;

    const confirmed = window.confirm(
      `Sigur dorești să ștergi ordinul "${order.title}"?\n\nAceastă acțiune nu poate fi anulată.`
    );

    if (!confirmed) return;

    setDeletingId(order.id);
    setError("");

    try {
      await api.delete(`/ordine/${order.id}`);

      setOrdine((current) =>
        current.filter((item) => item.id !== order.id)
      );

      if (galleryOrder?.id === order.id) {
        setGalleryOrder(null);
      }
    } catch (err) {
      console.error("Eroare ștergere ordin:", err);

      setError(
        err.response?.data?.message ||
          "Ordinul nu a putut fi șters."
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="ordine-page">
        <div className="ordine-loading">
          Se încarcă ordinele...
        </div>
      </div>
    );
  }

  return (
    <div className="ordine-page">
      <div className="ordine-header">
        <div>
          <h1>Ordine</h1>
          <p className="ordine-description">
            Lista ordinelor interne disponibile în platformă.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="ordine-add-button"
            disabled={saving}
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
          >
            {showForm
              ? "Închide formularul"
              : "+ Adaugă ordin"}
          </button>
        )}
      </div>

      {error && (
        <div className="ordine-error" role="alert">
          {error}
        </div>
      )}

      {showForm && canEdit && (
        <form className="ordine-form" onSubmit={handleSubmit}>
          <div className="ordine-form-header">
            <h2>Adaugă ordin intern</h2>

            <button
              type="button"
              className="ordine-form-close"
              onClick={resetForm}
              disabled={saving}
              aria-label="Închide formularul"
            >
              ×
            </button>
          </div>

          <div className="ordine-form-body">
            <div className="ordine-form-group">
              <label htmlFor="order-number">
                Număr ordin
              </label>

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
              <label htmlFor="order-date">
                Data ordinului
              </label>

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
              <label htmlFor="order-title">
                Denumirea ordinului
              </label>

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
              {saving
                ? "Se salvează..."
                : "Salvează ordinul"}
            </button>
          </div>
        </form>
      )}

      {ordine.length === 0 ? (
        <div className="ordine-empty">
          Nu există ordine.
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

      <td data-label="Număr">
        {order.number || "-"}
      </td>

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

      <td data-label="Data">
        {formatDate(order.order_date)}
      </td>

      <td data-label="Creat de">
        {order.created_by_name ||
          order.created_by_username ||
          "-"}
      </td>

      {(canEdit || canDelete) && (
        <td
          data-label="Acțiuni"
          className="ordine-actions-cell"
        >
          <div className="ordine-actions">
            {canEdit && (
              <button
                type="button"
                className="ordine-icon-button"
                title="Editează ordinul"
                aria-label="Editează ordinul"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEditOrder(order);
                }}
              >
                <Pencil size={17} />
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                className="ordine-icon-button ordine-delete-button"
                title="Șterge ordinul"
                aria-label="Șterge ordinul"
                disabled={deletingId !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteOrder(order);
                }}
              >
                <Trash2 size={17} />
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
