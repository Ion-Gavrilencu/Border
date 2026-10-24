import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "./Profile.css";

function Profile() {
  const { user, updateUser } = useAuth();

  // Editarea datelor personale
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Schimbarea parolei
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setFullName(user?.fullName || user?.full_name || "");
    setUsername(user?.username || "");
  }, [user?.fullName, user?.full_name, user?.username]);

  const handleEdit = () => {
    setFullName(user?.fullName || user?.full_name || "");
    setUsername(user?.username || "");
    setProfileError("");
    setProfileSuccess("");
    setEditing(true);
  };

  const handleCancel = () => {
    setFullName(user?.fullName || user?.full_name || "");
    setUsername(user?.username || "");
    setProfileError("");
    setEditing(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const trimmedName = fullName.trim();

    if (trimmedName.length < 3 || trimmedName.length > 100) {
      setProfileError("Numele trebuie să conțină între 3 și 100 de caractere.");
      return;
    }

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) {
      setProfileError(
        "Numele de utilizator trebuie să conțină între 3 și 30 de caractere. Sunt permise litere, cifre, punct, cratimă și underscore.",
      );
      return;
    }

    try {
      setProfileLoading(true);

      const response = await api.patch("/auth/profile", {
        fullName: trimmedName,
        username: username.trim(),
      });

      updateUser(response.data.user);
      setProfileSuccess(
        response.data.message || "Datele personale au fost actualizate.",
      );
      setEditing(false);
    } catch (err) {
      setProfileError(
        err.response?.data?.message ||
          "Datele personale nu au putut fi actualizate.",
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Parola nouă trebuie să aibă între 12 și 128 de caractere.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Parolele noi nu coincid.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Parola nouă trebuie să fie diferită de cea actuală.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.patch("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setSuccess(response.data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Parola nu a putut fi schimbată.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Profilul meu</h1>
        <p>Informațiile contului și setările de securitate.</p>
      </div>

      <div className="profile-grid">
        {/* Informații personale */}
        <section className="profile-card">
          <h2>Informații personale</h2>

          {profileError && (
            <p className="profile-error" role="alert">
              {profileError}
            </p>
          )}

          {profileSuccess && (
            <p className="profile-success" role="status">
              {profileSuccess}
            </p>
          )}

          {editing ? (
            <form onSubmit={handleSaveProfile}>
              <label htmlFor="profileFullName">Nume și prenume</label>

              <input
                id="profileFullName"
                className="form-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                minLength={3}
                maxLength={100}
                autoComplete="name"
                required
              />

              <label htmlFor="profileUsername">Nume de utilizator</label>

              <input
                id="profileUsername"
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={30}
                autoComplete="username"
                required
              />

              <div className="profile-info">
                <span>Adresă de e-mail</span>
                <strong>{user?.email || "-"}</strong>
              </div>

              <div className="profile-info">
                <span>Rol</span>
                <strong>{user?.role || "-"}</strong>
              </div>

              <div className="profile-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={profileLoading}
                >
                  {profileLoading ? "Se salvează..." : "Salvează"}
                </button>

                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={handleCancel}
                  disabled={profileLoading}
                >
                  Anulează
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="profile-info">
                <span>Nume și prenume</span>
                <strong>{user?.fullName || user?.full_name || "-"}</strong>
              </div>

              <div className="profile-info">
                <span>Nume de utilizator</span>
                <strong>{user?.username || "-"}</strong>
              </div>

              <div className="profile-info">
                <span>Adresă de e-mail</span>
                <strong>{user?.email || "-"}</strong>
              </div>

              <div className="profile-info">
                <span>Rol</span>
                <strong>{user?.role || "-"}</strong>
              </div>

              <button
                type="button"
                className="btn btn-primary profile-edit-button"
                onClick={handleEdit}
              >
                Editează datele
              </button>
            </>
          )}
        </section>

        {/* Schimbarea parolei */}
        <section className="profile-card">
          <h2>Schimbă parola</h2>

          <p className="profile-hint">
            Pentru securitatea contului, parola nouă trebuie să conțină între 12
            și 128 de caractere.
          </p>

          <form onSubmit={handleChangePassword}>
            <label htmlFor="currentPassword">Parola actuală</label>

            <input
              id="currentPassword"
              className="form-input"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <label htmlFor="newPassword">Parola nouă</label>

            <input
              id="newPassword"
              className="form-input"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <label htmlFor="confirmPassword">Confirmă parola nouă</label>

            <input
              id="confirmPassword"
              className="form-input"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && (
              <p className="profile-error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="profile-success" role="status">
                {success}
              </p>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Se salvează..." : "Schimbă parola"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Profile;
