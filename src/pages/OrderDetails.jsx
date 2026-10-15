import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Attachments from "../components/Attachments";
import "./OrderDetails.css";

function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canEdit =
    user?.role === "EDITOR" ||
    user?.role === "ADMIN";

  const canDelete =
    user?.role === "ADMIN";

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/ordine/${id}`);

      setOrder(response.data.order);
    } catch (error) {
      console.error("Eroare încărcare ordin:", error);

      setError(
        error.response?.data?.message ||
          "Ordinul nu a putut fi încărcat."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Sigur dorești să ștergi acest ordin?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/ordine/${id}`);

      alert("Ordinul a fost șters.");

      navigate("/ordine");
    } catch (error) {
      console.error("Eroare ștergere ordin:", error);

      alert(
        error.response?.data?.message ||
          "Ordinul nu a putut fi șters."
      );
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="order-details-loading">
        <div className="order-details-spinner" />
        <span>Se încarcă ordinul...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-details-page">
        <div className="order-details-error">
          <span className="order-details-error-icon">
            !
          </span>

          <span>{error}</span>
        </div>

        <button
          type="button"
          className="order-details-back-button"
          onClick={() => navigate("/ordine")}
        >
          ← Înapoi la ordine
        </button>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="order-details-page">
      <div className="order-details-header">
        <div className="order-details-title-section">
          <div className="order-details-label">
            ORDIN
          </div>

          <h1>{order.title}</h1>

          <p>
            Informații și conținutul ordinului
          </p>
        </div>

        <button
          type="button"
          className="order-details-back-button"
          onClick={() => navigate("/ordine")}
        >
          ← Înapoi la ordine
        </button>
      </div>

      <div className="order-details-card">
        <div className="order-details-card-header">
          <h2>Detalii ordin</h2>
        </div>

        <div className="order-details-card-body">
          <div className="order-details-info-grid">
            <div className="order-details-info-item">
              <span className="order-details-info-label">
                Număr
              </span>

              <span className="order-details-info-value">
                {order.number || "-"}
              </span>
            </div>

            <div className="order-details-info-item">
              <span className="order-details-info-label">
                Data ordinului
              </span>

              <span className="order-details-info-value">
                {order.order_date
                  ? new Date(
                      order.order_date
                    ).toLocaleDateString("ro-RO")
                  : "-"}
              </span>
            </div>

            <div className="order-details-info-item">
              <span className="order-details-info-label">
                Creat de
              </span>

              <span className="order-details-info-value">
                {order.created_by_name ||
                  order.created_by_username ||
                  "-"}
              </span>
            </div>

            <div className="order-details-info-item">
              <span className="order-details-info-label">
                Data creării
              </span>

              <span className="order-details-info-value">
                {order.created_at
                  ? new Date(
                      order.created_at
                    ).toLocaleString("ro-RO")
                  : "-"}
              </span>
            </div>
          </div>

          <div className="order-details-content-section">
            <div className="order-details-content-label">
              Conținut
            </div>

            <div className="order-details-content">
              {order.content ||
                "Nu există conținut disponibil."}
            </div>
          </div>
        </div>

        {/* =====================================================
            ATAȘAMENTE
            ===================================================== */}

        <Attachments
          entityType="ordine"
          entityId={id}
          canEdit={canEdit}
          canDelete={canDelete}
        />

        {/* =====================================================
            ACȚIUNI ORDIN
            ===================================================== */}

        {canEdit && (
          <div className="order-details-actions">
            <button
              type="button"
              className="order-details-edit-button"
              onClick={() =>
                navigate(`/ordine/${id}/edit`)
              }
            >
              Editează ordinul
            </button>

            {canDelete && (
              <button
                type="button"
                className="order-details-delete-button"
                onClick={handleDelete}
              >
                Șterge ordinul
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderDetails;
