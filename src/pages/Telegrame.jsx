import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Telegrame.css";
import { useAuth } from "../context/AuthContext";

function Telegrame() {
    const navigate = useNavigate();
    const { user } = useAuth();
  const [telegrame, setTelegrame] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    number: "",
    telegramDate: "",
    content: "",
  });

  const [saving, setSaving] = useState(false);

  const loadTelegrame = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/telegrame");

      setTelegrame(response.data.telegrame);
    } catch (error) {
      console.error("Eroare telegrame:", error);

      setError(
        error.response?.data?.message ||
          "Nu s-au putut încărca telegramele."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTelegrame();
  }, []);

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

      const response = await api.post("/telegrame", formData);

      setTelegrame((current) => [
        response.data.telegram,
        ...current,
      ]);

      setFormData({
        title: "",
        number: "",
        telegramDate: "",
        content: "",
      });

      setShowForm(false);
    } catch (error) {
      console.error("Eroare adăugare telegramă:", error);

      alert(
        error.response?.data?.message ||
          "Telegrama nu a putut fi adăugată."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Se încarcă telegramele...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  const filteredTelegrame = telegrame.filter((telegram) => {
  const search = searchTerm.toLowerCase().trim();

  const matchesSearch =
    !search ||
    telegram.title?.toLowerCase().includes(search) ||
    telegram.number?.toLowerCase().includes(search) ||
    telegram.created_by_name?.toLowerCase().includes(search) ||
    telegram.created_by_username?.toLowerCase().includes(search);

  const telegramDate = telegram.telegram_date
    ? new Date(telegram.telegram_date)
    : null;

  const matchesDateFrom =
    !dateFrom ||
    (telegramDate &&
      telegramDate >= new Date(`${dateFrom}T00:00:00`));

  const matchesDateTo =
    !dateTo ||
    (telegramDate &&
      telegramDate <= new Date(`${dateTo}T23:59:59`));

  return (
    matchesSearch &&
    matchesDateFrom &&
    matchesDateTo
  );
});

const resetFilters = () => {
  setSearchTerm("");
  setDateFrom("");
  setDateTo("");
};
  return (
  <div className="telegrame-page">
    <div className="telegrame-header">
      <div>
        <h1>Telegrame</h1>

        <p className="telegrame-description">
          Lista telegramelor disponibile în platformă.
        </p>
      </div>

      {(user?.role === "EDITOR" ||
  user?.role === "ADMIN") && (
  <button
    type="button"
    className="telegram-add-button"
    onClick={() =>
      setShowForm((current) => !current)
    }
  >
    {showForm
      ? "Închide formularul"
      : "Adaugă telegramă"}
  </button>
)}

<input
  type="text"
  placeholder="Caută după număr, titlu sau autor..."
  
  value={searchTerm}
  onChange={(event) =>
    setSearchTerm(event.target.value)
  }
  className="telegram-search-input"
/>

<input
  type="date"
  value={dateFrom}
  onChange={(event) => setDateFrom(event.target.value)}
  className="telegram-date-filter"
/>

<input
  type="date"
  value={dateTo}
  onChange={(event) => setDateTo(event.target.value)}
  className="telegram-date-filter"
/> 

<button
  type="button"
  className="telegram-reset-button"
  onClick={resetFilters}
>
  Resetează filtrele
</button> 

    </div>

    {error && (
      <div className="telegram-error">
        {error}
      </div>
    )}

    {showForm && (
      <form
        className="telegram-form"
        onSubmit={handleSubmit}
      >
        <h2>Adaugă telegramă</h2>

        <div className="telegram-form-group">
          <label>Număr telegramă</label>

          <input
            type="text"
            name="number"
            value={formData.number}
            onChange={handleChange}
            placeholder="Ex: TEST-002"
          />
        </div>

        <div className="telegram-form-group">
          <label>Titlu</label>

          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Introduceți titlul"
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
            placeholder="Introduceți conținutul..."
            rows="8"
            required
          />
        </div>

        <button
          type="submit"
          className="telegram-save-button"
          disabled={saving}
        >
          {saving
            ? "Se salvează..."
            : "Salvează telegrama"}
        </button>
      </form>
    )}

    {telegrame.length === 0 ? (
      <div className="telegram-empty">
        Nu există telegrame.
      </div>
    ) : (
      <div className="telegrame-table-wrapper">
        <table className="telegrame-table">
          <thead>
  <tr>
    <th>ID</th>
    <th>Număr</th>
    <th>Titlu</th>
    <th>Data</th>
    <th>Creat de</th>
    <th>Acțiuni</th>
  </tr>
</thead>

          <tbody>
            {filteredTelegrame.length === 0 ? (
  <tr>
    <td colSpan="6" className="telegram-no-results">
      Nu au fost găsite rezultate.
    </td>
  </tr>
) : (
  filteredTelegrame.map((telegram) => (
              <tr key={telegram.id}>
                <td>{telegram.id}</td>

                <td>
                  {telegram.number || "-"}
                </td>

                <td>{telegram.title}</td>

                <td>
                  {telegram.telegram_date
                    ? new Date(
                        telegram.telegram_date
                      ).toLocaleDateString("ro-RO")
                    : "-"}
                </td>

                <td>
                  {telegram.created_by_name ||
                    telegram.created_by_username ||
                    "-"}
                </td>
                <td>
  <button
    type="button"
    className="telegram-view-button"
    onClick={() =>
      navigate(`/telegrame/${telegram.id}`)
    }
  >
    Vezi
  </button>
</td>
              </tr>
            ))
          )}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
}

export default Telegrame;