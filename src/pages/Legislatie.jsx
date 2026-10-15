import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./Legislatie.css";

function Legislatie() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [legislatie, setLegislatie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    lawNumber: "",
    lawDate: "",
    content: "",
  });

  const canEdit =
    user?.role === "EDITOR" || user?.role === "ADMIN";

  const loadLegislation = async () => {
    try {
      setLoading(true);

      const response = await api.get("/legislatie");

      setLegislatie(response.data.legislatie || []);
    } catch (error) {
      console.error(
        "Eroare la încărcarea legislației:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la încărcarea legislației."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLegislation();
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

      await api.post("/legislatie", formData);

      setFormData({
        title: "",
        lawNumber: "",
        lawDate: "",
        content: "",
      });

      setShowForm(false);
      setMessage(
        "Actul legislativ a fost adăugat."
      );

      await loadLegislation();
    } catch (error) {
      console.error(
        "Eroare la adăugarea legislației:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la adăugarea actului legislativ."
      );
    }
  };

  if (loading) {
    return (
      <div className="legislatie-page">
        <div className="legislatie-loading">
          Se încarcă legislația...
        </div>
      </div>
    );
  }

  return (
    <div className="legislatie-page">
      <div className="legislatie-header">
        <div>
          <h1>Legislație</h1>

          <p className="legislatie-description">
            Acte legislative disponibile în platformă.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="legislatie-add-button"
            onClick={() =>
              setShowForm((current) => !current)
            }
          >
            {showForm
              ? "Închide"
              : "Adaugă legislație"}
          </button>
        )}
      </div>

      {message && (
        <div className="legislatie-message">
          {message}
        </div>
      )}

      {showForm && canEdit && (
        <form
          onSubmit={handleSubmit}
          className="legislatie-form"
        >
          <h2>Adaugă act legislativ</h2>

          <div className="legislatie-form-group">
            <label>Titlu</label>

            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Introduceți titlul actului"
              required
            />
          </div>

          <div className="legislatie-form-group">
            <label>Număr act</label>

            <input
              type="text"
              name="lawNumber"
              value={formData.lawNumber}
              onChange={handleChange}
              placeholder="Ex: Legea nr. 28/2024"
            />
          </div>

          <div className="legislatie-form-group">
            <label>Data actului</label>

            <input
              type="date"
              name="lawDate"
              value={formData.lawDate}
              onChange={handleChange}
            />
          </div>

          <div className="legislatie-form-group">
            <label>Conținut</label>

            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="Introduceți conținutul actului legislativ..."
              rows="8"
              required
            />
          </div>

          <button
            type="submit"
            className="legislatie-save-button"
          >
            Salvează actul
          </button>
        </form>
      )}

      <div className="legislatie-list">
        {legislatie.length === 0 ? (
          <div className="legislatie-empty">
            Nu există acte legislative.
          </div>
        ) : (
          legislatie.map((item) => (
            <div
              key={item.id}
              className="legislatie-card"
            >
              <div className="legislatie-card-content">
                <div className="legislatie-card-info">
                  <span className="legislatie-card-label">
                    ACT LEGISLATIV
                  </span>

                  <h3>{item.title}</h3>

                  <div className="legislatie-meta">
                    {item.law_number && (
                      <span>
                        <strong>Număr:</strong>{" "}
                        {item.law_number}
                      </span>
                    )}

                    {item.law_date && (
                      <span>
                        <strong>Data:</strong>{" "}
                        {new Date(
                          item.law_date
                        ).toLocaleDateString(
                          "ro-RO"
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="legislatie-view-button"
                  onClick={() =>
                    navigate(
                      `/legislatie/${item.id}`
                    )
                  }
                >
                  Vezi
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Legislatie;