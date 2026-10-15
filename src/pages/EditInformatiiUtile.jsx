import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "./EditInformatiiUtile.css";

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
    return (
      <div className="edit-informatii-page">
        <div className="edit-informatii-loading">
          <div className="edit-informatii-spinner"></div>
          <span>Se încarcă informația...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-informatii-page">
      <div className="edit-informatii-header">
        <div>
          <span className="edit-informatii-label">
            GESTIONARE CONȚINUT
          </span>

          <h1>Editează informația utilă</h1>

          <p>
            Modifică datele informației selectate.
          </p>
        </div>
      </div>

      {message && (
        <div className="edit-informatii-message">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="edit-informatii-form"
      >
        <div className="edit-informatii-form-header">
          <h2>Date informație</h2>

          <p>
            Actualizează câmpurile necesare și salvează
            modificările.
          </p>
        </div>

        <div className="edit-informatii-form-body">
          <div className="edit-informatii-form-group">
            <label htmlFor="title">Titlu</label>

            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Introduceți titlul informației"
              required
            />
          </div>

          <div className="edit-informatii-form-group">
            <label htmlFor="category">Categorie</label>

            <input
              id="category"
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Ex.: Proceduri, Contacte, General"
            />
          </div>

          <div className="edit-informatii-form-group">
            <label htmlFor="content">Conținut</label>

            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows="12"
              placeholder="Introduceți conținutul informației..."
              required
            />
          </div>
        </div>

        <div className="edit-informatii-actions">
          <button
            type="button"
            className="edit-informatii-cancel-button"
            onClick={() =>
              navigate("/informatii-utile")
            }
            disabled={saving}
          >
            Anulează
          </button>

          <button
            type="submit"
            className="edit-informatii-save-button"
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

export default EditInformatiiUtile;