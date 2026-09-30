import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function LegislationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [legislation, setLegislation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canEdit =
    user?.role === "EDITOR" || user?.role === "ADMIN";

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    const loadLegislation = async () => {
      try {
        const response = await api.get(`/legislatie/${id}`);

        setLegislation(response.data.legislation);
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

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Sigur dorești să ștergi acest act legislativ?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/legislatie/${id}`);

      navigate("/legislatie");
    } catch (error) {
      console.error(
        "Eroare la ștergerea actului legislativ:",
        error
      );

      setMessage(
        error.response?.data?.message ||
          "Eroare la ștergerea actului legislativ."
      );
    }
  };

  if (loading) {
    return <div>Se încarcă actul legislativ...</div>;
  }

  if (!legislation) {
    return (
      <div>
        <p>{message || "Actul legislativ nu a fost găsit."}</p>

        <button
          className="telegram-view-button"
          onClick={() => navigate("/legislatie")}
        >
          Înapoi
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{legislation.title}</h1>
        </div>
      </div>

      {message && (
        <div className="error-message">
          {message}
        </div>
      )}

      <div className="telegram-details">
        {legislation.law_number && (
          <p>
            <strong>Număr act:</strong>{" "}
            {legislation.law_number}
          </p>
        )}

        {legislation.law_date && (
          <p>
            <strong>Data actului:</strong>{" "}
            {new Date(
              legislation.law_date
            ).toLocaleDateString("ro-RO")}
          </p>
        )}

        <p>
          <strong>Autor:</strong>{" "}
          {legislation.created_by_name ||
            legislation.created_by_username ||
            "Necunoscut"}
        </p>

        <p>
          <strong>Data adăugării:</strong>{" "}
          {new Date(
            legislation.created_at
          ).toLocaleString("ro-RO")}
        </p>

        <div className="telegram-content">
          <strong>Conținut:</strong>

          <div className="content-text">
            {legislation.content}
          </div>
        </div>
      </div>

      <div className="telegram-actions">
        <button
          className="telegram-view-button"
          onClick={() => navigate("/legislatie")}
        >
          Înapoi
        </button>

        {canEdit && (
          <button
            className="telegram-view-button"
            onClick={() =>
              navigate(`/legislatie/${id}/edit`)
            }
          >
            Editează
          </button>
        )}

        {isAdmin && (
          <button
            className="telegram-delete-button"
            onClick={handleDelete}
          >
            Șterge
          </button>
        )}
      </div>
    </div>
  );
}

export default LegislationDetails;