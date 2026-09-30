import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

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
        console.error("Eroare încărcare telegramă:", error);

        setError(
          error.response?.data?.message || "Telegrama nu a putut fi încărcată.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadTelegram();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      await api.patch(`/telegrame/${id}`, formData);

      navigate(`/telegrame/${id}`);
    } catch (error) {
      console.error("Eroare modificare telegramă:", error);

      setError(
        error.response?.data?.message || "Telegrama nu a putut fi modificată.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Se încarcă telegrama...</div>;
  }

  return (
    <div className="telegrame-page">
      <button type="button" onClick={() => navigate(`/telegrame/${id}`)}>
        ← Înapoi
      </button>

      <h1>Editează telegrama</h1>

      {error && <div className="telegram-error">{error}</div>}

      <form className="telegram-form" onSubmit={handleSubmit}>
        <div className="telegram-form-group">
          <label>Număr telegramă</label>

          <input
            type="text"
            name="number"
            value={formData.number}
            onChange={handleChange}
          />
        </div>

        <div className="telegram-form-group">
          <label>Titlu</label>

          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="telegram-form-group">
          <label>Data</label>

          <input
            type="date"
            name="telegramDate"
            value={formData.telegramDate}
            onChange={handleChange}
          />
        </div>

        <div className="telegram-form-group">
          <label>Conținut</label>

          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows="12"
            required
          />
        </div>

        <button
          type="submit"
          className="telegram-save-button"
          disabled={saving}
        >
          {saving ? "Se salvează..." : "Salvează modificările"}
        </button>
      </form>
    </div>
  );
}

export default EditTelegram;
