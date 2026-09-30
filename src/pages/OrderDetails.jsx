import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/ordine/${id}`);

      setOrder(response.data.order);
    } catch (error) {
      console.error("Eroare încărcare ordin:", error);

      setError(
        error.response?.data?.message || "Ordinul nu a putut fi încărcat.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Sigur dorești să ștergi acest ordin?");

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/ordine/${id}`);

      alert("Ordinul a fost șters.");

      navigate("/ordine");
    } catch (error) {
      console.error("Eroare ștergere ordin:", error);

      alert(error.response?.data?.message || "Ordinul nu a putut fi șters.");
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  if (loading) {
    return <div>Se încarcă ordinul...</div>;
  }

  if (error) {
    return (
      <div className="telegrame-page">
        <div className="telegram-error">{error}</div>

        <button type="button" onClick={() => navigate("/ordine")}>
          Înapoi la ordine
        </button>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="telegrame-page">
      <div className="telegrame-header">
        <div>
          <h1>{order.title}</h1>
          <p>Detalii ordin</p>
        </div>

        <button type="button" onClick={() => navigate("/ordine")}>
          Înapoi
        </button>
      </div>

      <div className="telegram-details">
        <p>
          <strong>Număr:</strong> {order.number || "-"}
        </p>

        <p>
          <strong>Data:</strong>{" "}
          {order.order_date
            ? new Date(order.order_date).toLocaleDateString("ro-RO")
            : "-"}
        </p>

        <p>
          <strong>Creat de:</strong>{" "}
          {order.created_by_name || order.created_by_username || "-"}
        </p>

        <p>
          <strong>Creat la:</strong>{" "}
          {order.created_at
            ? new Date(order.created_at).toLocaleString("ro-RO")
            : "-"}
        </p>

        <div>
          <strong>Conținut:</strong>

          <div className="telegram-content">{order.content}</div>
        </div>

        {(user?.role === "EDITOR" || user?.role === "ADMIN") && (
          <button type="button" onClick={() => navigate(`/ordine/${id}/edit`)}>
            Editează
          </button>
        )}

        {user?.role === "ADMIN" && (
          <button
            type="button"
            className="telegram-delete-button"
            onClick={handleDelete}
          >
            Șterge
          </button>
        )}
      </div>
    </div>
  );
}

export default OrderDetails;
