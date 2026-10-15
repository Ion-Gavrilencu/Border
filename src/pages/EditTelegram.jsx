import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "./EditTelegram.css";

function EditTelegram() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    number: "",
    telegramDate: "",
    content: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTelegram = async () => {
      try {
        const response = await api.get(`/telegrame/${id}`);

        const telegram = response.data.telegram;

        setFormData({
          title: telegram.title || "",
          number: telegram.number || "",
          telegramDate: telegram.telegram_date
            ? telegram.telegram_date.split("T")[0]
            : "",
          content: telegram.content || "",
        });
      } catch (error) {
        console.error(
          "Eroare încărcare telegramă:",
          error
        );

        setError(
          error.response?.data?.message ||
            "Telegrama nu a putut fi încărcată."
        );
      } finally {
        setLoading(false);
      }
    };

    loadTelegram();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      await api.patch(`/telegrame/${id}`, formData);

      navigate(`/telegrame/${id}`);
    } catch (error) {
      console.error(
        "Eroare modificare telegramă:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Telegrama nu a putut fi modificată."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-telegram-page">
        <div className="edit-telegram-loading">
          <div className="edit-telegram-spinner"></div>
          <span>Se încarcă telegrama...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-telegram-page">
      <div className="edit-telegram-header">
        <div>
          <span className="edit-telegram-label">
            GESTIONARE TELEGRAME
          </span>

          <h1>Editează telegrama</h1>

          <p>
            Modifică datele telegramei selectate.
          </p>
        </div>

        <button
          type="button"
          className="edit-telegram-back-button"
          onClick={() =>
            navigate(`/telegrame/${id}`)
          }
        >
          ← Înapoi
        </button>
      </div>

      {error && (
        <div className="edit-telegram-error">
          {error}
        </div>
      )}

      <form
        className="edit-telegram-form"
        onSubmit={handleSubmit}
      >
        <div className="edit-telegram-form-header">
          <h2>Date telegramă</h2>

          <p>
            Actualizează informațiile necesare și
            salvează modificările.
          </p>
        </div>

        <div className="edit-telegram-form-body">
          <div className="edit-telegram-form-group">
            <label htmlFor="telegram-number">
              Număr telegramă
            </label>

            <input
              id="telegram-number"
              type="text"
              name="number"
              value={formData.number}
              onChange={handleChange}
              placeholder="Ex.: 123/2026"
            />
          </div>

          <div className="edit-telegram-form-group">
            <label htmlFor="telegram-title">
              Titlu
            </label>

            <input
              id="telegram-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Introduceți titlul telegramei"
              required
            />
          </div>

          <div className="edit-telegram-form-group">
            <label htmlFor="telegram-date">
              Data
            </label>

            <input
              id="telegram-date"
              type="date"
              name="telegramDate"
              value={formData.telegramDate}
              onChange={handleChange}
            />
          </div>

          <div className="edit-telegram-form-group">
            <label htmlFor="telegram-content">
              Conținut
            </label>

            <textarea
              id="telegram-content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows="12"
              placeholder="Introduceți conținutul telegramei..."
              required
            />
          </div>
        </div>

        <div className="edit-telegram-actions">
          <button
            type="button"
            className="edit-telegram-cancel-button"
            onClick={() =>
              navigate(`/telegrame/${id}`)
            }
            disabled={saving}
          >
            Anulează
          </button>

          <button
            type="submit"
            className="edit-telegram-save-button"
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

export default EditTelegram;