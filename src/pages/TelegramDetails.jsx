import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

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
          error.response?.data?.message ||
            "Telegrama nu a putut fi încărcată."
        );
      } finally {
        setLoading(false);
      }
    };

    loadTelegram();
  }, [id]);

  if (loading) {
    return <div>Se încarcă telegrama...</div>;
  }

  if (error) {
    return (
      <div>
        <p>{error}</p>

        <button
          type="button"
          onClick={() => navigate("/telegrame")}
        >
          Înapoi la telegrame
        </button>
      </div>
    );
  }

  if (!telegram) {
    return <div>Telegrama nu există.</div>;
  }

  return (
    <div className="telegrame-page">
      <button
        type="button"
        onClick={() => navigate("/telegrame")}
      >
        ← Înapoi la telegrame
      </button>

      {(user?.role === "EDITOR" ||
  user?.role === "ADMIN") && (
  <button
    type="button"
    onClick={() =>
      navigate(`/telegrame/${id}/edit`)
    }
  >
    Editează
  </button>
)}

      <h1>{telegram.title}</h1>

      <div>
        <p>
          <strong>Număr:</strong>{" "}
          {telegram.number || "-"}
        </p>

        <p>
          <strong>Data:</strong>{" "}
          {telegram.telegram_date
            ? new Date(
                telegram.telegram_date
              ).toLocaleDateString("ro-RO")
            : "-"}
        </p>

        <p>
          <strong>Creat de:</strong>{" "}
          {telegram.created_by_name ||
            telegram.created_by_username ||
            "-"}
        </p>

        <p>
          <strong>Data creării:</strong>{" "}
          {telegram.created_at
            ? new Date(
                telegram.created_at
              ).toLocaleString("ro-RO")
            : "-"}
        </p>

        <hr />

        <h2>Conținut</h2>

        <div>
          {telegram.content}
        </div>
      </div>
    </div>
  );
}

export default TelegramDetails;