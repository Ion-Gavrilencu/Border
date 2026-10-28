import { useEffect, useState } from "react";
import {
  Bell, CalendarDays, Check, Crown, Eye, EyeOff, LockKeyhole,
  Mail, Pencil, Save, Settings, Shield, ShieldCheck, UserRound,
  X, Camera, Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "./Profile.css";

const roleNames = { ADMIN: "ADMIN", EDITOR: "EDITOR", USER: "USER" };

function Profile() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPasswords, setShowPasswords] = useState({});
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setFullName(user?.fullName || user?.full_name || "");
    setUsername(user?.username || "");
  }, [user?.fullName, user?.full_name, user?.username]);

  const displayName = user?.fullName || user?.full_name || user?.username || "Utilizator";
  const role = String(user?.role || "USER").toUpperCase();
  const memberDate = user?.createdAt || user?.created_at;
  const formattedDate = memberDate && !Number.isNaN(new Date(memberDate).getTime())
    ? new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(memberDate))
    : null;
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

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
    const trimmedUsername = username.trim();
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      setProfileError("Numele trebuie să conțină între 3 și 100 de caractere.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(trimmedUsername)) {
      setProfileError("Numele de utilizator trebuie să aibă 3–30 de caractere: litere, cifre, punct, cratimă sau underscore.");
      return;
    }
    try {
      setProfileLoading(true);
      const response = await api.patch("/auth/profile", {
        fullName: trimmedName,
        username: trimmedUsername,
      });
      if (response.data?.user) updateUser(response.data.user);
      const message = response.data?.message || "Datele personale au fost actualizate.";
      setProfileSuccess(message);
      toast.success(message);
      setEditing(false);
    } catch (err) {
      const message = err.response?.data?.message || "Datele personale nu au putut fi actualizate.";
      setProfileError(message);
      toast.error(message);
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
      const response = await api.patch("/auth/change-password", { currentPassword, newPassword });
      const message = response.data?.message || "Parola a fost schimbată.";
      setSuccess(message);
      toast.success(message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err.response?.data?.message || "Parola nu a putut fi schimbată.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = (field) => setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  const passwordField = (id, placeholder, value, setter, autocomplete, minLength) => (
    <div className="profile-password-field">
      <LockKeyhole size={17} aria-hidden="true" />
      <input
        id={id}
        aria-label={placeholder}
        type={showPasswords[id] ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autocomplete}
        minLength={minLength}
        maxLength={128}
        value={value}
        onChange={(e) => setter(e.target.value)}
        required
      />
      <button
        type="button"
        className="profile-eye-button"
        onClick={() => togglePassword(id)}
        aria-label={showPasswords[id] ? `Ascunde ${placeholder.toLowerCase()}` : `Afișează ${placeholder.toLowerCase()}`}
      >
        {showPasswords[id] ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );

  const rows = [
    { icon: UserRound, label: "Nume și prenume", value: displayName },
    { icon: UserRound, label: "Nume de utilizator", value: user?.username || "-" },
    { icon: Mail, label: "Adresă de e-mail", value: user?.email || "-" },
    { icon: Shield, label: "Rol", value: roleNames[role] || role, badge: true },
  ];
  const visibleRows = rows.filter((item) => `${item.label} ${item.value}`.toLocaleLowerCase("ro-RO").includes(search.toLocaleLowerCase("ro-RO")));

  return (
    <main className="profile-page profile-modern">
      
      <header className="profile-header">
        <div>
          <h1>Profilul meu</h1>
          <p>Informațiile contului și setările de securitate.</p>
        </div>
        <ShieldCheck className="profile-header-watermark" size={60} strokeWidth={1.5} aria-hidden="true" />
      </header>

      <div className="profile-grid">
        <section className="profile-card profile-identity-card">
          <div className="profile-identity">
            <div className="profile-avatar" aria-label={`Avatar ${displayName}`}>
              <span>{initial}</span>
              <span className="profile-avatar-camera" aria-hidden="true"><Camera size={14} /></span>
            </div>
            <div className="profile-identity-text">
              <h2>{displayName}</h2>
              <span className={`profile-role profile-role-${role.toLowerCase()}`}>
                {role === "ADMIN" ? <Crown size={13} /> : <Shield size={13} />}
                {roleNames[role] || role}
              </span>
              {formattedDate && <p className="profile-member"><CalendarDays size={13} /> Membru din {formattedDate}</p>}
            </div>
          </div>

          <div className="profile-section-title">
            <h3><UserRound size={19} /> Informații personale</h3>
            {!editing && <button className="profile-edit-button" type="button" onClick={handleEdit}><Pencil size={15} /> Editează datele</button>}
          </div>

          {profileError && <p className="profile-error" role="alert">{profileError}</p>}
          {profileSuccess && <p className="profile-success" role="status">{profileSuccess}</p>}

          {editing ? (
            <form className="profile-edit-form" onSubmit={handleSaveProfile}>
              <label htmlFor="profileFullName">Nume și prenume</label>
              <input id="profileFullName" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={3} maxLength={100} autoComplete="name" required />
              <label htmlFor="profileUsername">Nume de utilizator</label>
              <input id="profileUsername" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={30} autoComplete="username" required />
              <div className="profile-info"><Mail size={16} /><span>Adresă de e-mail</span><strong>{user?.email || "-"}</strong></div>
              <div className="profile-info"><Shield size={16} /><span>Rol</span><strong>{role}</strong></div>
              <div className="profile-actions">
                <button className="profile-primary-button" type="submit" disabled={profileLoading}><Save size={16} /> {profileLoading ? "Se salvează..." : "Salvează"}</button>
                <button className="profile-cancel-button" type="button" onClick={handleCancel} disabled={profileLoading}><X size={16} /> Anulează</button>
              </div>
            </form>
          ) : (
            <div className="profile-info-list">
              {visibleRows.length ? visibleRows.map(({ icon: Icon, label, value, badge }) => (
                <div className="profile-info" key={label}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                  {badge ? <strong className={`profile-role profile-role-${role.toLowerCase()}`}>{role === "ADMIN" && <Crown size={13} />}{value}</strong> : <strong>{value}</strong>}
                </div>
              )) : <p className="profile-empty">Nicio informație nu corespunde căutării.</p>}
            </div>
          )}
        </section>

        <div className="profile-side">
          <section className="profile-card profile-security-card">
            <div className="profile-section-title profile-section-title-stacked">
              <h3><LockKeyhole size={19} /> Schimbă parola</h3>
              <p>Pentru securitatea contului, parola nouă trebuie să conțină între 12 și 128 de caractere.</p>
            </div>
            <form className="profile-password-form" onSubmit={handleChangePassword}>
              {passwordField("currentPassword", "Parola actuală", currentPassword, setCurrentPassword, "current-password")}
              {passwordField("newPassword", "Parola nouă", newPassword, setNewPassword, "new-password", 12)}
              {passwordField("confirmPassword", "Confirmă parola nouă", confirmPassword, setConfirmPassword, "new-password", 12)}
              {error && <p className="profile-error" role="alert">{error}</p>}
              {success && <p className="profile-success" role="status">{success}</p>}
              <button className="profile-primary-button profile-password-submit" type="submit" disabled={loading}>
                <LockKeyhole size={17} /> {loading ? "Se salvează..." : "Schimbă parola"}
              </button>
            </form>
          </section>

          <section className="profile-card profile-settings-card">
            <div className="profile-section-title"><h3><Settings size={20} /> Setări cont</h3></div>
            <div className="profile-setting-row">
              <Bell size={19} aria-hidden="true" />
              <div><strong>Notificări e-mail</strong><p>Primește notificări despre noutăți și actualizări</p></div>
              <label className="profile-switch">
                <input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} aria-label="Notificări e-mail (preferință demonstrativă)" />
                <span aria-hidden="true" />
              </label>
            </div>
            <p className="profile-settings-note">Preferință vizuală momentan: pentru salvarea notificărilor în cont este necesar un endpoint dedicat în backend.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default Profile;
