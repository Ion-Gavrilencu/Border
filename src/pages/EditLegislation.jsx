import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

function EditLegislation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    lawNumber: "",
    lawDate: "",
    content: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadLegislation = async () => {
      try {
        const response = await api.get(`/legislatie/${id}`);

        const item = response.data.legislation;

        setFormData({
          title: item.title || "",
          lawNumber: item.law_number || "",
          lawDate: item.law_date
            ? item.law_date.substring(0, 10)
            : "",
          content: item.content || "",
        });
      } catch (error) {
        console.error(
          "Eroare la încărcarea actului legislativ:",
          error
        );

        setMessage(
          error.response?.data?.message ||
            "Eroare la încărcarea actului legislativ."
        );
      } finally {
        setLoading(false);
      }
    };

    loadLegislation();
  }, [id]);

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
      setSaving(true);
      setMessage("");

      await api.patch(`/legislatie/${id}`, formData);

      navigate(`/legislatie/${id}`);
    } catch (error) {
      console.error(
        "Eroare la actualizarea actului legislativ:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la actualizarea actului legislativ."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Se încarcă...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Editează actul legislativ</h1>
        </div>
      </div>

      {message && (
        <div className="error-message">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="telegram-form"
      >
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
            rows="12"
            required
          />
        </div>

        <div className="telegram-actions">
          <button
            type="button"
            className="telegram-view-button"
            onClick={() =>
              navigate(`/legislatie/${id}`)
            }
          >
            Anulează
          </button>

          <button
            type="submit"
            className="add-button"
            disabled={saving}
          >
            {saving ? "Se salvează..." : "Salvează modificările"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditLegislation;