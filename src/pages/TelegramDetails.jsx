import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Attachments from "../components/Attachments";
import "./TelegramDetails.css";

function TelegramDetails() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  

  const [telegram, setTelegram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTelegram = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/telegrame/${id}`);

        setTelegram(response.data.telegram);
      } catch (error) {
        console.error("Eroare telegramă:", error);

        setError(
          error.response?.data?.message || "Telegrama nu a putut fi încărcată.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadTelegram();
  }, [id]);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Sigur dorești să ștergi această telegramă?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/telegrame/${id}`);

      alert("Telegrama a fost ștearsă.");

      navigate("/telegrame");
    } catch (error) {
      console.error("Eroare la ștergerea telegramei:", error);

      alert(
        error.response?.data?.message || "Telegrama nu a putut fi ștearsă.",
      );
    }
  };

  if (loading) {
    return (
      <div className="telegram-details-loading">
        <div className="telegram-details-spinner" />
        <span>Se încarcă telegrama...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="telegram-details-page">
        <div className="telegram-details-error">
          <span className="telegram-details-error-icon">!</span>
          <span>{error}</span>
        </div>

        <button
          type="button"
          className="telegram-details-back-button"
          onClick={() => navigate("/telegrame")}
        >
          ← Înapoi la telegrame
        </button>
      </div>
    );
  }

  if (!telegram) {
    return (
      <div className="telegram-details-page">
        <div className="telegram-details-error">
          <span className="telegram-details-error-icon">!</span>
          <span>Telegrama nu există.</span>
        </div>

        <button
          type="button"
          className="telegram-details-back-button"
          onClick={() => navigate("/telegrame")}
        >
          ← Înapoi la telegrame
        </button>
      </div>
    );
  }

  return (
    <div className="telegram-details-page">
      <div className="telegram-details-header">
        <div className="telegram-details-title-section">
          <div className="telegram-details-label">TELEGRAMĂ</div>

          <h1>{telegram.title}</h1>

          <p>Informații și conținutul telegramei</p>
        </div>

        <button
          type="button"
          className="telegram-details-back-button"
          onClick={() => navigate("/telegrame")}
        >
          ← Înapoi la telegrame
        </button>
      </div>

      <div className="telegram-details-card">
        <div className="telegram-details-card-header">
          <h2>Detalii telegramă</h2>
        </div>

        <div className="telegram-details-card-body">
          <div className="telegram-details-info-grid">
            <div className="telegram-details-info-item">
              <span className="telegram-details-info-label">Număr</span>

              <span className="telegram-details-info-value">
                {telegram.number || "-"}
              </span>
            </div>

            <div className="telegram-details-info-item">
              <span className="telegram-details-info-label">
                Data telegramei
              </span>

              <span className="telegram-details-info-value">
                {telegram.telegram_date
                  ? new Date(telegram.telegram_date).toLocaleDateString("ro-RO")
                  : "-"}
              </span>
            </div>

            <div className="telegram-details-info-item">
              <span className="telegram-details-info-label">Creat de</span>

              <span className="telegram-details-info-value">
                {telegram.created_by_name ||
                  telegram.created_by_username ||
                  "-"}
              </span>
            </div>

            <div className="telegram-details-info-item">
              <span className="telegram-details-info-label">Data creării</span>

              <span className="telegram-details-info-value">
                {telegram.created_at
                  ? new Date(telegram.created_at).toLocaleString("ro-RO")
                  : "-"}
              </span>
            </div>
          </div>

          <div className="telegram-details-content-section">
            <div className="telegram-details-content-label">Conținut</div>

            <div className="telegram-details-content">
              {telegram.content || "Nu există conținut disponibil."}
            </div>
          </div>

          <Attachments
  entityType="telegrame"
  entityId={telegram.id}
  canEdit={user?.role === "EDITOR" || user?.role === "ADMIN"}
  canDelete={user?.role === "ADMIN"}
/>

        </div>

        {(user?.role === "EDITOR" || user?.role === "ADMIN") && (
          <div className="telegram-details-actions">
            <button
              type="button"
              className="telegram-details-edit-button"
              onClick={() => navigate(`/telegrame/${id}/edit`)}
            >
              Editează telegrama
            </button>

            {user?.role === "ADMIN" && (
              <button
                type="button"
                className="telegram-details-delete-button"
                onClick={handleDelete}
              >
                Șterge telegrama
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    
  );
}

export default TelegramDetails;
