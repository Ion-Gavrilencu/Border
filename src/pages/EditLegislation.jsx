import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "./EditLegislation.css";

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
    return (
      <div className="edit-legislation-page">
        <div className="edit-legislation-loading">
          <div className="edit-legislation-spinner"></div>
          <span>Se încarcă actul legislativ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-legislation-page">
      <div className="edit-legislation-header">
        <div>
          <span className="edit-legislation-label">
            GESTIONARE LEGISLAȚIE
          </span>

          <h1>Editează actul legislativ</h1>

          <p>
            Modifică datele actului legislativ selectat.
          </p>
        </div>
      </div>

      {message && (
        <div className="edit-legislation-message">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="edit-legislation-form"
      >
        <div className="edit-legislation-form-header">
          <h2>Date act legislativ</h2>

          <p>
            Actualizează informațiile necesare și salvează
            modificările.
          </p>
        </div>

        <div className="edit-legislation-form-body">
          <div className="edit-legislation-form-group">
            <label htmlFor="title">
              Titlu
            </label>

            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Introduceți titlul actului legislativ"
              required
            />
          </div>

          <div className="edit-legislation-form-group">
            <label htmlFor="lawNumber">
              Număr act
            </label>

            <input
              id="lawNumber"
              type="text"
              name="lawNumber"
              value={formData.lawNumber}
              onChange={handleChange}
              placeholder="Ex.: Legea nr. 28/2024"
            />
          </div>

          <div className="edit-legislation-form-group">
            <label htmlFor="lawDate">
              Data actului
            </label>

            <input
              id="lawDate"
              type="date"
              name="lawDate"
              value={formData.lawDate}
              onChange={handleChange}
            />
          </div>

          <div className="edit-legislation-form-group">
            <label htmlFor="content">
              Conținut
            </label>

            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows="12"
              placeholder="Introduceți conținutul actului legislativ..."
              required
            />
          </div>
        </div>

        <div className="edit-legislation-actions">
          <button
            type="button"
            className="edit-legislation-cancel-button"
            onClick={() =>
              navigate(`/legislatie/${id}`)
            }
            disabled={saving}
          >
            Anulează
          </button>

          <button
            type="submit"
            className="edit-legislation-save-button"
            disabled={saving}
          >
            {saving
              ? "Se salvează..."
              : "Salvează modificările"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditLegislation;