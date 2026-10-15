import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./UsefulInfoDetails.css";

function UsefulInfoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [informatie, setInformatie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canEdit =
    user?.role === "EDITOR" || user?.role === "ADMIN";

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const response = await api.get(
          `/informatii-utile/${id}`
        );

        setInformatie(response.data.informatie);
      } catch (error) {
        console.error(
          "Eroare la încărcarea informației utile:",
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

  if (loading) {
    return (
      <div className="useful-info-details-loading">
        <div className="useful-info-details-spinner" />
        <span>Se încarcă informația...</span>
      </div>
    );
  }

  if (message) {
    return (
      <div className="useful-info-details-page">
        <div className="useful-info-details-error">
          <span className="useful-info-details-error-icon">
            !
          </span>

          <span>{message}</span>
        </div>

        <button
          type="button"
          className="useful-info-details-back-button"
          onClick={() => navigate("/informatii-utile")}
        >
          ← Înapoi la informații utile
        </button>
      </div>
    );
  }

  if (!informatie) {
    return null;
  }

  return (
    <div className="useful-info-details-page">
      <div className="useful-info-details-header">
        <div className="useful-info-details-title-section">
          <div className="useful-info-details-label">
            INFORMAȚIE UTILĂ
          </div>

          <h1>{informatie.title}</h1>

          <p>
            Informații și detalii utile pentru activitatea de serviciu
          </p>

          {informatie.category && (
            <div className="useful-info-details-category">
              {informatie.category}
            </div>
          )}
        </div>

        <button
          type="button"
          className="useful-info-details-back-button"
          onClick={() => navigate("/informatii-utile")}
        >
          ← Înapoi
        </button>
      </div>

      <div className="useful-info-details-card">
        <div className="useful-info-details-card-header">
          <h2>Detalii informație</h2>
        </div>

        <div className="useful-info-details-card-body">
          <div className="useful-info-details-content-section">
            <div className="useful-info-details-content-label">
              Conținut
            </div>

            <div className="useful-info-details-content">
              {informatie.content ||
                "Nu există conținut disponibil."}
            </div>
          </div>

          {informatie.created_by_name && (
            <div className="useful-info-details-author">
              <span className="useful-info-details-author-label">
                Adăugat de
              </span>

              <span className="useful-info-details-author-value">
                {informatie.created_by_name}
              </span>
            </div>
          )}
        </div>

        <div className="useful-info-details-actions">
          <button
            type="button"
            className="useful-info-details-back-action"
            onClick={() => navigate("/informatii-utile")}
          >
            Înapoi
          </button>

          {canEdit && (
            <button
              type="button"
              className="useful-info-details-edit-button"
              onClick={() =>
                navigate(`/informatii-utile/${id}/edit`)
              }
            >
              Editează informația
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsefulInfoDetails;