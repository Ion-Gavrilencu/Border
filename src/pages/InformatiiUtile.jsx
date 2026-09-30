import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./InformatiiUtile.css";

function InformatiiUtile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [informatii, setInformatii] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
  });

  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";
  const loadInformatii = async () => {
    try {
      setLoading(true);

      const response = await api.get("/informatii-utile");

      setInformatii(response.data.informatii || []);
    } catch (error) {
      console.error("Eroare la încărcarea informațiilor utile:", error);

      setMessage(
        error.response?.data?.message ||
          "Eroare la încărcarea informațiilor utile.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInformatii();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setMessage("");

      await api.post("/informatii-utile", formData);

      setFormData({
        title: "",
        category: "",
        content: "",
      });

      setShowForm(false);

      setMessage("Informația utilă a fost adăugată.");

      await loadInformatii();
    } catch (error) {
      console.error("Eroare la adăugarea informației utile:", error);

      setMessage(
        error.response?.data?.message ||
          "Eroare la adăugarea informației utile.",
      );
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Ești sigur că vrei să ștergi această informație?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");

      await api.delete(`/informatii-utile/${id}`);

      setMessage("Informația utilă a fost ștearsă.");

      await loadInformatii();
    } catch (error) {
      console.error("Eroare la ștergerea informației utile:", error);

      setMessage(
        error.response?.data?.message ||
          "Eroare la ștergerea informației utile.",
      );
    }
  };

  if (loading) {
    return <div>Se încarcă informațiile utile...</div>;
  }

  return (
    <div className="page-container useful-info-page">
      <div className="page-header">
        <div>
          <h1>Informații utile</h1>
          <p>Informații și materiale utile pentru activitatea de serviciu</p>
        </div>

        {canEdit && (
          <button
            className="add-button"
            onClick={() => {
              setShowForm(!showForm);
              setMessage("");
            }}
          >
            {showForm ? "Închide" : "Adaugă informație"}
          </button>
        )}
      </div>

      {message && <div className="success-message">{message}</div>}

      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="telegram-form">
          <div className="form-group">
            <label>Titlu</label>

            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Categorie</label>

            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Ex.: Proceduri, Contacte, General"
            />
          </div>

          <div className="form-group">
            <label>Conținut</label>

            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows="8"
              required
            />
          </div>

          <button type="submit" className="add-button">
            Salvează
          </button>
        </form>
      )}

      <div className="telegram-list">
        {informatii.length === 0 ? (
          <p>Nu există informații utile.</p>
        ) : (
          informatii.map((item) => (
            <div key={item.id} className="telegram-card">
              <div>
                <h3>{item.title}</h3>

                {item.category && (
                  <p>
                    <strong>Categorie:</strong> {item.category}
                  </p>
                )}

                <p>
                  {item.content.length > 180
                    ? `${item.content.substring(0, 180)}...`
                    : item.content}
                </p>

                {item.created_by_name && (
                  <small>Adăugat de: {item.created_by_name}</small>
                )}
              </div>

              <div className="telegram-actions">
                <button
                  className="telegram-view-button"
                  onClick={() => navigate(`/informatii-utile/${item.id}`)}
                >
                  Vezi detalii
                </button>

                {canEdit && (
                  <button
                    className="telegram-view-button"
                    onClick={() =>
                      navigate(`/informatii-utile/${item.id}/edit`)
                    }
                  >
                    Editează
                  </button>
                )}

                {canDelete && (
                  <button
                    className="telegram-delete-button"
                    onClick={() => handleDelete(item.id)}
                  >
                    Șterge
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default InformatiiUtile;
