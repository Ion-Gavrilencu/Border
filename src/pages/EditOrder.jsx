import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "./EditOrder.css";

function EditOrder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [content, setContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await api.get(`/ordine/${id}`);

        const order = response.data.order;

        setTitle(order.title || "");
        setNumber(order.number || "");
        setOrderDate(order.order_date ? order.order_date.substring(0, 10) : "");
        setContent(order.content || "");
      } catch (error) {
        console.error("Eroare încărcare ordin:", error);

        setError(
          error.response?.data?.message || "Ordinul nu a putut fi încărcat.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      await api.patch(`/ordine/${id}`, {
        title,
        number,
        orderDate,
        content,
      });

      navigate(`/ordine/${id}`);
    } catch (error) {
      console.error("Eroare actualizare ordin:", error);

      setError(
        error.response?.data?.message || "Ordinul nu a putut fi actualizat.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-order-page">
        <div className="edit-order-loading">
          <div className="edit-order-spinner"></div>
          <span>Se încarcă ordinul...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-order-page">
      <div className="edit-order-header">
        <div>
          <span className="edit-order-label">GESTIONARE ORDINE</span>

          <h1>Editează ordinul</h1>

          <p>Modifică datele ordinului selectat.</p>
        </div>
      </div>

      {error && <div className="edit-order-error">{error}</div>}

      <form className="edit-order-form" onSubmit={handleSubmit}>
        <div className="edit-order-form-header">
          <h2>Date ordin</h2>

          <p>Actualizează informațiile necesare și salvează modificările.</p>
        </div>

        <div className="edit-order-form-body">
          <div className="edit-order-form-group">
            <label htmlFor="order-title">Titlu</label>

            <input
              id="order-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Introduceți titlul ordinului"
              required
            />
          </div>

          <div className="edit-order-form-group">
            <label htmlFor="order-number">Număr</label>

            <input
              id="order-number"
              type="text"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="Ex.: 123/2026"
            />
          </div>

          <div className="edit-order-form-group">
            <label htmlFor="order-date">Data ordinului</label>

            <input
              id="order-date"
              type="date"
              value={orderDate}
              onChange={(event) => setOrderDate(event.target.value)}
            />
          </div>

          <div className="edit-order-form-group">
            <label htmlFor="order-content">Conținut</label>

            <textarea
              id="order-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Introduceți conținutul ordinului..."
              rows="12"
              required
            />
          </div>
        </div>

        <div className="edit-order-actions">
          <button
            type="button"
            className="edit-order-cancel-button"
            onClick={() => navigate(`/ordine/${id}`)}
            disabled={saving}
          >
            Anulează
          </button>

          <button
            type="submit"
            className="edit-order-save-button"
            disabled={saving}
          >
            {saving ? "Se salvează..." : "Salvează modificările"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditOrder;
