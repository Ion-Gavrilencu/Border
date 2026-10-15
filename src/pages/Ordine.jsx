import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./Ordine.css";

function Ordine() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ordine, setOrdine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [content, setContent] = useState("");

  const fetchOrdine = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/ordine");

      setOrdine(response.data.ordine);
    } catch (error) {
      console.error("Eroare încărcare ordine:", error);

      setError(
        error.response?.data?.message ||
          "Ordinele nu au putut fi încărcate."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdine();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await api.post("/ordine", {
        title,
        number,
        orderDate,
        content,
      });

      setTitle("");
      setNumber("");
      setOrderDate("");
      setContent("");

      setShowForm(false);

      await fetchOrdine();
    } catch (error) {
      console.error("Eroare adăugare ordin:", error);

      alert(
        error.response?.data?.message ||
          "Ordinul nu a putut fi adăugat."
      );
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

        {(user?.role === "EDITOR" ||
          user?.role === "ADMIN") && (
          <button
            type="button"
            className="ordine-add-button"
            onClick={() =>
              setShowForm((current) => !current)
            }
          >
            {showForm
              ? "Închide formularul"
              : "Adaugă ordin"}
          </button>
        )}
      </div>

      {error && (
        <div className="ordine-error">
          {error}
        </div>
      )}

      {showForm && (
        <form
          className="ordine-form"
          onSubmit={handleSubmit}
        >
          <h2>Adaugă ordin intern</h2>

          <div className="ordine-form-group">
            <label>Titlu</label>

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="Introduceți titlul ordinului"
              required
            />
          </div>

          <div className="ordine-form-group">
            <label>Număr</label>

            <input
              type="text"
              value={number}
              onChange={(event) =>
                setNumber(event.target.value)
              }
              placeholder="Ex: 123/2026"
            />
          </div>

          <div className="ordine-form-group">
            <label>Data ordinului</label>

            <input
              type="date"
              value={orderDate}
              onChange={(event) =>
                setOrderDate(event.target.value)
              }
            />
          </div>

          <div className="ordine-form-group">
            <label>Conținut</label>

            <textarea
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              placeholder="Introduceți conținutul ordinului..."
              required
              rows="8"
            />
          </div>

          <button
            type="submit"
            className="ordine-save-button"
          >
            Salvează ordinul
          </button>
        </form>
      )}

      <div className="ordine-table-container">
        <table className="ordine-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Număr</th>
              <th>Titlu</th>
              <th>Data</th>
              <th>Creat de</th>
              <th>Acțiuni</th>
            </tr>
          </thead>

          <tbody>
            {ordine.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="ordine-no-results"
                >
                  Nu există ordine.
                </td>
              </tr>
            ) : (
              ordine.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>

                  <td>
                    {order.number || "-"}
                  </td>

                  <td>{order.title}</td>

                  <td>
                    {order.order_date
                      ? new Date(
                          order.order_date
                        ).toLocaleDateString("ro-RO")
                      : "-"}
                  </td>

                  <td>
                    {order.created_by_name ||
                      order.created_by_username ||
                      "-"}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="ordine-view-button"
                      onClick={() =>
                        navigate(
                          `/ordine/${order.id}`
                        )
                      }
                    >
                      Vezi
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Ordine;