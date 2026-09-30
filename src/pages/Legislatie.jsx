import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

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
      console.error("Eroare la încărcarea legislației:", error);
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
      setMessage("Actul legislativ a fost adăugat.");

      await loadLegislation();
    } catch (error) {
      console.error("Eroare la adăugarea legislației:", error);

      setMessage(
        error.response?.data?.message ||
          "Eroare la adăugarea actului legislativ."
      );
    }
  };

  if (loading) {
    return <div>Se încarcă legislația...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Legislație</h1>
          <p>Acte legislative disponibile în platformă</p>
        </div>

        {canEdit && (
          <button
            className="add-button"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Închide" : "Adaugă legislație"}
          </button>
        )}
      </div>

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

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
            <label>Număr act</label>

            <input
              type="text"
              name="lawNumber"
              value={formData.lawNumber}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Data actului</label>

            <input
              type="date"
              name="lawDate"
              value={formData.lawDate}
              onChange={handleChange}
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
        {legislatie.length === 0 ? (
          <p>Nu există acte legislative.</p>
        ) : (
          legislatie.map((item) => (
            <div key={item.id} className="telegram-card">
              <div>
                <h3>{item.title}</h3>

                {item.law_number && (
                  <p>
                    <strong>Număr:</strong>{" "}
                    {item.law_number}
                  </p>
                )}

                {item.law_date && (
                  <p>
                    <strong>Data:</strong>{" "}
                    {new Date(
                      item.law_date
                    ).toLocaleDateString("ro-RO")}
                  </p>
                )}
              </div>

              <button
                className="telegram-view-button"
                onClick={() =>
                  navigate(`/legislatie/${item.id}`)
                }
              >
                Vezi
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Legislatie;