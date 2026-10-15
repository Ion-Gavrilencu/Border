import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "A apărut o eroare la autentificare."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background-shape login-background-shape-one" />
      <div className="login-background-shape login-background-shape-two" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span>PS</span>
          </div>

          <h1>Platforma de Serviciu</h1>

          <p className="login-subtitle">
            Sistem intern de informare
          </p>
        </div>

        <div className="login-divider" />

        <div className="login-form-header">
          <h2>Autentificare</h2>
          <p>Introduceți datele de acces pentru a continua.</p>
        </div>

        {error && (
          <div className="login-error" role="alert">
            <span className="login-error-icon">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label htmlFor="username">Utilizator</label>

            <input
              id="username"
              type="text"
              placeholder="Introduceți utilizatorul"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-form-group">
            <label htmlFor="password">Parolă</label>

            <input
              id="password"
              type="password"
              placeholder="Introduceți parola"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" />
                Se autentifică...
              </>
            ) : (
              "Autentificare"
            )}
          </button>
        </form>

        <div className="login-security">
          <span className="login-security-icon">●</span>
          <span>Acces autorizat pentru personal</span>
        </div>

        <div className="login-footer">
          <span>Platformă internă</span>
          <span className="login-footer-separator">•</span>
          <span>Acces securizat</span>
        </div>
      </div>
    </div>
  );
}

export default Login;