
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";

function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Linkul de activare este invalid.");
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError("Parola trebuie să aibă între 12 și 128 de caractere.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Parolele introduse nu coincid.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/activate", {
        token,
        password,
      });

      setSuccess(response.data.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Activarea contului nu a reușit."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "var(--bg-main)",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "32px",
        }}
      >
        <h1 className="page-title">Activare cont</h1>

        <p className="page-subtitle">
          Stabilește parola pentru Platforma de Serviciu.
        </p>

        {error && (
          <p role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {success ? (
          <div>
            <p role="status" style={{ color: "var(--success)" }}>
              {success}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/login")}
            >
              Mergi la autentificare
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginTop: "24px" }}>
              <label htmlFor="password">Parolă nouă</label>

              <input
                id="password"
                className="form-input"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div style={{ marginTop: "18px" }}>
              <label htmlFor="confirmPassword">
                Confirmă parola
              </label>

              <input
                id="confirmPassword"
                className="form-input"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !token}
              style={{
                width: "100%",
                marginTop: "24px",
              }}
            >
              {loading ? "Se activează..." : "Activează contul"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ActivateAccount;
