import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

function EditOrder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [content, setContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await api.get(`/ordine/${id}`);

        const order = response.data.order;

        setTitle(order.title || "");
        setNumber(order.number || "");
        setOrderDate(order.order_date || "");
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
    }
  };

  if (loading) {
    return <div>Se încarcă ordinul...</div>;
  }

  return (
    <div className="telegrame-page">
      <div className="telegrame-header">
        <div>
          <h1>Editează ordinul</h1>
          <p>Modifică datele ordinului</p>
        </div>
      </div>

      {error && <div className="telegram-error">{error}</div>}

      <form className="telegram-form" onSubmit={handleSubmit}>
        <div className="telegram-form-group">
          <label>Titlu</label>

          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>

        <div className="telegram-form-group">
          <label>Număr</label>

          <input
            type="text"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
        </div>

        <div className="telegram-form-group">
          <label>Data ordinului</label>

          <input
            type="date"
            value={orderDate}
            onChange={(event) => setOrderDate(event.target.value)}
          />
        </div>

        <div className="telegram-form-group">
          <label>Conținut</label>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            rows="10"
          />
        </div>

        <button type="submit" className="telegram-save-button">
          Salvează modificările
        </button>

        <button type="button" onClick={() => navigate(`/ordine/${id}`)}>
          Anulează
        </button>
      </form>
    </div>
  );
}

export default EditOrder;
