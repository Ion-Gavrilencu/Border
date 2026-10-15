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

  const canEdit =
    user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const loadInformatii = async () => {
    try {
      setLoading(true);

      const response = await api.get("/informatii-utile");

      setInformatii(response.data.informatii || []);
    } catch (error) {
      console.error(
        "Eroare la încărcarea informațiilor utile:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la încărcarea informațiilor utile."
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

      setMessage(
        "Informația utilă a fost adăugată."
      );

      await loadInformatii();
    } catch (error) {
      console.error(
        "Eroare la adăugarea informației utile:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la adăugarea informației utile."
      );
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Ești sigur că vrei să ștergi această informație?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");

      await api.delete(`/informatii-utile/${id}`);

      setMessage(
        "Informația utilă a fost ștearsă."
      );

      await loadInformatii();
    } catch (error) {
      console.error(
        "Eroare la ștergerea informației utile:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la ștergerea informației utile."
      );
    }
  };

  if (loading) {
    return (
      <div className="informatii-page">
        <div className="informatii-loading">
          Se încarcă informațiile utile...
        </div>
      </div>
    );
  }

  return (
    <div className="informatii-page">
      <div className="informatii-header">
        <div>
          <h1>Informații utile</h1>

          <p className="informatii-description">
            Informații și materiale utile pentru activitatea
            de serviciu.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="informatii-add-button"
            onClick={() => {
              setShowForm((current) => !current);
              setMessage("");
            }}
          >
            {showForm
              ? "Închide"
              : "Adaugă informație"}
          </button>
        )}
      </div>

      {message && (
        <div className="informatii-message">
          {message}
        </div>
      )}

      {showForm && canEdit && (
        <form
          onSubmit={handleSubmit}
          className="informatii-form"
        >
          <h2>Adaugă informație utilă</h2>

          <div className="informatii-form-group">
            <label>Titlu</label>

            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Introduceți titlul"
              required
            />
          </div>

          <div className="informatii-form-group">
            <label>Categorie</label>

            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Ex.: Proceduri, Contacte, General"
            />
          </div>

          <div className="informatii-form-group">
            <label>Conținut</label>

            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="Introduceți informația..."
              rows="8"
              required
            />
          </div>

          <button
            type="submit"
            className="informatii-save-button"
          >
            Salvează informația
          </button>
        </form>
      )}

      <div className="informatii-list">
        {informatii.length === 0 ? (
          <div className="informatii-empty">
            Nu există informații utile.
          </div>
        ) : (
          informatii.map((item) => (
            <div
              key={item.id}
              className="informatii-card"
            >
              <div className="informatii-card-content">
                <div className="informatii-card-main">
                  <span className="informatii-card-label">
                    INFORMAȚIE UTILĂ
                  </span>

                  <h3>{item.title}</h3>

                  {item.category && (
                    <div className="informatii-category">
                      {item.category}
                    </div>
                  )}

                  <p className="informatii-preview">
                    {item.content.length > 180
                      ? `${item.content.substring(
                          0,
                          180
                        )}...`
                      : item.content}
                  </p>

                  {item.created_by_name && (
                    <small className="informatii-author">
                      Adăugat de: {item.created_by_name}
                    </small>
                  )}
                </div>

                <div className="informatii-actions">
                  <button
                    type="button"
                    className="informatii-view-button"
                    onClick={() =>
                      navigate(
                        `/informatii-utile/${item.id}`
                      )
                    }
                  >
                    Vezi detalii
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      className="informatii-edit-button"
                      onClick={() =>
                        navigate(
                          `/informatii-utile/${item.id}/edit`
                        )
                      }
                    >
                      Editează
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      className="informatii-delete-button"
                      onClick={() =>
                        handleDelete(item.id)
                      }
                    >
                      Șterge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default InformatiiUtile;
