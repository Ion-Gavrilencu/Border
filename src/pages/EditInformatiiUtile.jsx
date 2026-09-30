import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

function EditInformatiiUtile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
  });

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const response = await api.get("/informatii-utile");

        const informatie = response.data.informatii.find(
          (item) => String(item.id) === String(id)
        );

        if (!informatie) {
          setMessage("Informația utilă nu a fost găsită.");
          return;
        }

        setFormData({
          title: informatie.title || "",
          category: informatie.category || "",
          content: informatie.content || "",
        });
      } catch (error) {
        console.error(
          "Eroare la încărcarea informației:",
          error
        );

        setMessage(
          error.response?.data?.message ||
            "Eroare la încărcarea informației utile."
        );
      } finally {
        setLoading(false);
      }
    };

    loadInfo();
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

      await api.patch(
        `/informatii-utile/${id}`,
        formData
      );

      navigate("/informatii-utile");
    } catch (error) {
      console.error(
        "Eroare la actualizarea informației:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la actualizarea informației utile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Se încarcă informația...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Editează informația utilă</h1>
          <p>Modifică datele informației selectate</p>
        </div>
      </div>

      {message && (
        <div className="success-message">
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
          <label>Categorie</label>

          <input
            type="text"
            name="category"
            value={formData.category}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Conținut</label>

          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows="10"
            required
          />
        </div>

        <div className="telegram-actions">
          <button
            type="submit"
            className="add-button"
            disabled={saving}
          >
            {saving ? "Se salvează..." : "Salvează modificările"}
          </button>

          <button
            type="button"
            className="telegram-view-button"
            onClick={() => navigate("/informatii-utile")}
          >
            Anulează
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditInformatiiUtile;