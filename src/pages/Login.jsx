import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  UserRound,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "../context/authStore";
import "./Login.css";

const getSafeDestination = (from) => {
  if (
    typeof from !== "string" ||
    !from.startsWith("/") ||
    from.startsWith("//")
  ) {
    return "/dashboard";
  }

  if (/[\\\r\n]/.test(from)) {
    return "/dashboard";
  }

  try {
    const url = new URL(from, "https://internal.invalid");
    if (url.origin !== "https://internal.invalid") return "/dashboard";

    const allowedPaths = new Set([
      "/dashboard",
      "/telegrame",
      "/ordine",
      "/legislatie",
      "/informatii-utile",
      "/profil",
      "/admin",
      "/monitorizare-utilizatori",
    ]);

    if (!allowedPaths.has(url.pathname)) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
};

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();

  const destination = getSafeDestination(location.state?.from);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const logoUrl = `${import.meta.env.BASE_URL}images/border-logo.png`;
  const bannerUrl = `${import.meta.env.BASE_URL}images/border-banner.png`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      await login(username.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Autentificarea a eșuat. Verifică datele introduse.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to={destination} replace />;
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* PANOU STÂNGA - BRANDING */}
        <section className="login-brand-panel">
          <div
            className="login-brand-background"
            style={{ backgroundImage: `url("${bannerUrl}")` }}
          />
          <div className="login-brand-overlay" />
          <div className="login-brand-content">
            <div className="login-brand-top">
              <img
                src={logoUrl}
                alt="Stema Republicii Moldova"
                className="login-brand-logo"
              />
              <div className="login-brand-name">
                <h1>BORDER</h1>
                <span>PORTAL INFORMAȚIONAL</span>
              </div>
            </div>
            <div className="login-brand-bottom">
              <span className="login-brand-tag">
                PLATFORMA INFORMAȚIONALĂ INTERNĂ
              </span>
              <h2>
                Informația de serviciu,
                <br />
                într-un singur loc.
              </h2>
              <p>
                Acces la telegrame, ordine interne, legislație și informații
                utile, într-o platformă organizată.
              </p>
              <div className="login-brand-features">
                <span>Documente</span>
                <span className="login-feature-dot">•</span>
                <span>Legislație</span>
                <span className="login-feature-dot">•</span>
                <span>Informații</span>
              </div>
            </div>
          </div>
        </section>

        {/* PANOU DREAPTA - AUTENTIFICARE */}
        <section className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-mobile-brand">
              <img src={logoUrl} alt="Stema Republicii Moldova" />
              <div>
                <strong>BORDER</strong>
                <span>PORTAL INFORMAȚIONAL</span>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <AlertCircle size={19} />
                <span>{error}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              {/* UTILIZATOR */}
              <div className="login-form-group">
                <label htmlFor="username">Nume de utilizator</label>
                <div className="login-input-wrapper">
                  <UserRound size={19} className="login-input-icon" />
                  <input
                    id="username"
                    type="text"
                    placeholder="Introdu numele de utilizator"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* PAROLĂ */}
              <div className="login-form-group">
                <label htmlFor="password">Parolă</label>
                <div className="login-input-wrapper">
                  <LockKeyhole size={19} className="login-input-icon" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Introdu parola"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={
                      showPassword ? "Ascunde parola" : "Afișează parola"
                    }
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {/* BUTON AUTENTIFICARE */}
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    <span>Se autentifică...</span>
                  </>
                ) : (
                  <>
                    <span>Autentificare</span>
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
            </form>

            {/* SECURITATE */}
            <div className="login-security">
              <ShieldCheck size={18} />
              <span>Acces destinat exclusiv utilizatorilor autorizați</span>
            </div>
            <div className="login-footer">
              <span>BORDER</span>
              <span>•</span>
              <span>Portal informațional intern</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
