import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

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
    return <div>Se încarcă informația...</div>;
  }

  if (message) {
    return (
      <div className="page-container">
        <div className="success-message">
          {message}
        </div>

        <button
          className="telegram-view-button"
          onClick={() => navigate("/informatii-utile")}
        >
          Înapoi
        </button>
      </div>
    );
  }

  if (!informatie) {
    return null;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{informatie.title}</h1>

          {informatie.category && (
            <p>
              <strong>Categorie:</strong>{" "}
              {informatie.category}
            </p>
          )}
        </div>
      </div>

      <div className="telegram-card">
        <div className="useful-info-content">
          <p
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: "1.7",
            }}
          >
            {informatie.content}
          </p>

          {informatie.created_by_name && (
            <small>
              Adăugat de: {informatie.created_by_name}
            </small>
          )}
        </div>
      </div>

      <div className="telegram-actions">
        <button
          className="telegram-view-button"
          onClick={() => navigate("/informatii-utile")}
        >
          Înapoi
        </button>

        {canEdit && (
          <button
            className="add-button"
            onClick={() =>
              navigate(`/informatii-utile/${id}/edit`)
            }
          >
            Editează
          </button>
        )}
      </div>
    </div>
  );
}

export default UsefulInfoDetails;