import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import TelegramGallery from "../components/TelegramGallery";
import "./Ordine.css";
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
  const [deletingId, setDeletingId] = useState(null);
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
          <button type="button" className="ordine-add-button" onClick={() => navigate("/ordine/adauga")}>
            <Plus size={18} /> Adaugă ordin
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
