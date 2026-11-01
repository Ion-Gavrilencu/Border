import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import api from "../services/api";
import "./ActivateAccount.css";

function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      const response = await api.post("/auth/activate", { token, password });
      setSuccess(response.data.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Activarea contului nu a reușit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="activate-page">
      <section className="activate-card" aria-labelledby="activate-title">
        <header className="activate-brand">
          <div className="activate-brand-inner">
            <img
              className="activate-brand-logo"
              src="/images/border-logo.png"
              alt="Emblema BORDER"
            />
            <div className="activate-brand-name">BORDER</div>
            <div className="activate-brand-divider" aria-hidden="true" />
            <div className="activate-brand-subtitle">
              Platformă
              <br />
              informațională
            </div>
          </div>
          <div className="activate-brand-wave" aria-hidden="true" />
        </header>

        <div className="activate-content">
          <div className="activate-heading">
            <div className="activate-heading-icon" aria-hidden="true">
              <KeyRound size={29} strokeWidth={1.9} />
            </div>
            <div>
              <h1 id="activate-title">Activare cont</h1>
              <p>Stabilește parola pentru platforma BORDER.</p>
            </div>
          </div>

          {error && (
            <div className="activate-alert activate-alert-error" role="alert">
              {error}
            </div>
          )}

          {success ? (
            <div className="activate-success" role="status">
              <CheckCircle2 size={36} aria-hidden="true" />
              <p>{success}</p>
              <button type="button" className="activate-submit" onClick={() => navigate("/login")}>
                Mergi la autentificare <ArrowRight size={19} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="activate-form">
              <div className="activate-field">
                <label htmlFor="password">Parolă nouă</label>
                <div className="activate-input-wrap">
                  <LockKeyhole className="activate-input-icon" size={21} aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Introdu parola nouă"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="activate-visibility"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ascunde parola" : "Afișează parola"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                  </button>
                </div>
              </div>

              <div className="activate-field">
                <label htmlFor="confirmPassword">Confirmă parola</label>
                <div className="activate-input-wrap">
                  <LockKeyhole className="activate-input-icon" size={21} aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Confirmă parola"
                    minLength={12}
                    maxLength={128}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="activate-visibility"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={
                      showConfirmPassword
                        ? "Ascunde confirmarea parolei"
                        : "Afișează confirmarea parolei"
                    }
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                  </button>
                </div>
              </div>

              <p className="activate-password-hint">
                <ShieldCheck size={16} aria-hidden="true" /> Parola trebuie să conțină între 12 și
                128 de caractere.
              </p>

              <button type="submit" className="activate-submit" disabled={loading || !token}>
                {loading ? (
                  <>
                    <LoaderCircle className="activate-spinner" size={20} aria-hidden="true" /> Se
                    activează...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={21} aria-hidden="true" /> Activează contul
                  </>
                )}
              </button>
              {!token && (
                <p className="activate-token-warning" role="alert">
                  Linkul de activare este invalid.
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default ActivateAccount;
