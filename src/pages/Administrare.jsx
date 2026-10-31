import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import Swal from "sweetalert2";
import {
  Plus,
  X,
  Search,
  Users,
  UserPlus,
  Mail,
  Trash2,
  RefreshCw,
  LoaderCircle,
  SlidersHorizontal,
  ArrowDownUp,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Crown,
  UserRound,
  Check,
  Info,
  Bell,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import "./Administrare.css";

const emptyUser = {
  username: "",
  fullName: "",
  email: "",
  role: "USER",
};

const confirmDialog = (options) =>
  Swal.fire({
    background: "#ffffff",
    color: "#17324d",
    confirmButtonColor: "#174d79",
    cancelButtonColor: "#e9eef5",
    showCancelButton: true,
    reverseButtons: true,
    buttonsStyling: true,
    customClass: {
      popup: "border-admin-dialog",
      cancelButton: "border-admin-dialog-cancel",
    },
    ...options,
  });

// Fotografia din profil este afișată numai în tabelul desktop.
function AdminDesktopAvatar({ user }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarValue = user.avatar_url || user.avatarURL || "";
  const apiOrigin = new URL(
    api.defaults.baseURL || "/api",
    window.location.origin,
  ).origin;
  const avatarUrl =
    typeof avatarValue === "string" && avatarValue.trim()
      ? avatarValue.startsWith("http://") || avatarValue.startsWith("https://")
        ? avatarValue
        : avatarValue.startsWith("/")
          ? `${apiOrigin}${avatarValue}`
          : ""
      : `${apiOrigin}/api/auth/avatar-image/${encodeURIComponent(user.id)}`;
  const initial = String(user.full_name || user.username || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <span className="admin-desktop-avatar" aria-hidden="true">
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );
}

function Administrare() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("recent");
  const [showFilters, setShowFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [newUser, setNewUser] = useState({ ...emptyUser });

  const loadUsers = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");

      const response = await api.get("/users");
      setUsers(response.data.users || []);
    } catch (err) {
      console.error("GET USERS ERROR:", err);
      const message =
        err.response?.data?.message || "Nu s-au putut încărca utilizatorii.";

      setError(message);
      toast.error(message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (event) => {
    event.preventDefault();

    if (creatingUser) return;

    try {
      setCreatingUser(true);

      const response = await api.post("/users", {
        username: newUser.username.trim(),
        fullName: newUser.fullName.trim(),
        email: newUser.email.trim(),
        role: newUser.role,
        sendEmailNotification,
      });

      setNewUser({ ...emptyUser });
      setSendEmailNotification(true);
      setShowCreateForm(false);

      toast.success(response.data.message || "Utilizatorul a fost creat.");

      await loadUsers(false);
    } catch (err) {
      console.error("CREATE USER ERROR:", err);
      toast.error(
        err.response?.data?.message || "Contul nu a putut fi creat.",
        { duration: 6000 },
      );

      // Dacă backendul a salvat contul, dar e-mailul
      // a eșuat, actualizăm lista fără a crea duplicate.
      if (err.response?.status === 502) {
        await loadUsers(false);
      }
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setUpdatingUserId(userId);

      const response = await api.patch(`/users/${userId}/role`, {
        role: newRole,
      });

      setUsers((current) =>
        current.map((user) => (user.id === userId ? response.data.user : user)),
      );

      toast.success("Rolul utilizatorului a fost actualizat.");
    } catch (err) {
      console.error("UPDATE ROLE ERROR:", err);
      toast.error(
        err.response?.data?.message || "Rolul nu a putut fi modificat.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusChange = async (userId, currentStatus) => {
    const action = currentStatus ? "dezactivezi" : "activezi";

    const confirmation = await confirmDialog({
      title: "Confirmare status",
      text: `Sigur dorești să ${action} acest utilizator?`,
      icon: "question",
      confirmButtonText: "Confirmă",
      cancelButtonText: "Anulează",
    });

    if (!confirmation.isConfirmed) return;

    try {
      setUpdatingUserId(userId);

      const response = await api.patch(`/users/${userId}/status`, {
        isActive: !currentStatus,
      });

      setUsers((current) =>
        current.map((user) => (user.id === userId ? response.data.user : user)),
      );

      toast.success(
        currentStatus ? "Contul a fost dezactivat." : "Contul a fost activat.",
      );
    } catch (err) {
      console.error("UPDATE STATUS ERROR:", err);
      toast.error(
        err.response?.data?.message || "Statusul nu a putut fi modificat.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleResendActivation = async (userId) => {
    const confirmation = await confirmDialog({
      title: "Retrimite activarea?",
      text: "Va fi generat un link nou, iar linkul anterior nu va mai funcționa.",
      icon: "question",
      confirmButtonText: "Trimite e-mailul",
      cancelButtonText: "Anulează",
    });

    if (!confirmation.isConfirmed) return;

    try {
      setUpdatingUserId(userId);

      const response = await api.post(`/users/${userId}/resend-activation`);

      toast.success(
        response.data.message || "E-mailul de activare a fost trimis.",
      );
    } catch (err) {
      console.error("RESEND ACTIVATION ERROR:", err);
      toast.error(
        err.response?.data?.message || "Nu s-a putut retrimite activarea.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find((item) => item.id === userId);

    const confirmation = await confirmDialog({
      title: "Ștergi utilizatorul?",
      text: `Contul „${user?.username || userId}” va fi șters. Această acțiune nu poate fi anulată.`,
      icon: "warning",
      confirmButtonText: "Da, șterge",
      cancelButtonText: "Anulează",
      confirmButtonColor: "#c43d46",
    });

    if (!confirmation.isConfirmed) return;

    try {
      setUpdatingUserId(userId);

      await api.delete(`/users/${userId}`);

      setUsers((current) => current.filter((item) => item.id !== userId));

      toast.success("Utilizatorul a fost șters.");
    } catch (err) {
      console.error("DELETE USER ERROR:", err);
      toast.error(
        err.response?.data?.message || "Utilizatorul nu a putut fi șters.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const search = searchTerm.toLowerCase().trim();

  const roleCounts = {
    ALL: users.length,
    ADMIN: users.filter((u) => u.role === "ADMIN").length,
    EDITOR: users.filter((u) => u.role === "EDITOR").length,
    USER: users.filter((u) => u.role === "USER").length,
    ACTIVE: users.filter((u) => u.is_active).length,
  };

  const filteredUsers = users
    .filter((user) => {
      const matchesSearch =
        !search ||
        [user.username, user.full_name, user.email].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(search),
        );
      const matchesRole =
        roleFilter === "ALL" ||
        (roleFilter === "ACTIVE"
          ? Boolean(user.is_active)
          : user.role === roleFilter);
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (sortOrder === "name")
        return String(a.username || "").localeCompare(
          String(b.username || ""),
          "ro",
        );
      if (sortOrder === "oldest") return Number(a.id) - Number(b.id);
      return Number(b.id) - Number(a.id);
    });

  const getInitial = (user) =>
    String(user.full_name || user.username || "U")
      .trim()
      .charAt(0)
      .toUpperCase();
  const getRoleIcon = (role) =>
    role === "ADMIN" ? (
      <Crown size={13} />
    ) : role === "EDITOR" ? (
      <Pencil size={13} />
    ) : (
      <UserRound size={13} />
    );

  return (
    <div className="admin-page border-admin-modern">
      <Toaster position="top-right" richColors closeButton duration={4000} />

      <div className="admin-header">
        <div>
          <h1>Administrare utilizatori</h1>
          <p className="admin-description">
            Gestionarea conturilor, rolurilor și drepturilor utilizatorilor
            platformei.
          </p>
        </div>

        <div className="admin-user-count">
          <div className="admin-count-icon">
            <Users size={25} />
          </div>
          <div className="admin-count-main">
            <span className="admin-user-count-label">UTILIZATORI TOTALI</span>
            <strong>{users.length}</strong>
          </div>
          <span className="admin-count-note">Total conturi</span>
        </div>

        <button
          type="button"
          className="btn btn-primary border-admin-add-button"
          onClick={() => setShowCreateForm(true)}
        >
          <Plus size={17} />
          Adaugă utilizator
        </button>
      </div>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            className="border-admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !creatingUser) {
                setShowCreateForm(false);
              }
            }}
          >
            <motion.div
              className="border-admin-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-create-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <div className="border-admin-mobile-cancel">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creatingUser}
                >
                  <X size={23} /> Anulează
                </button>
              </div>
              <button
                className="border-admin-modal-close"
                type="button"
                aria-label="Închide formularul"
                onClick={() => setShowCreateForm(false)}
                disabled={creatingUser}
              >
                <X size={22} />
              </button>
              <div className="border-admin-modal-hero">
                <div className="border-admin-hero-icon">
                  <UserPlus size={31} />
                </div>
                <div className="border-admin-hero-text">
                  <h2 id="admin-create-title">Creare utilizator</h2>
                  <p>Completează datele pentru noul cont.</p>
                </div>
                <div className="border-admin-hero-art" aria-hidden="true">
                  <UserRound size={66} strokeWidth={1.7} />
                  <span>
                    <Plus size={24} />
                  </span>
                </div>
              </div>
              <form
                className="border-admin-modal-form"
                onSubmit={handleCreateUser}
              >
                <div className="border-admin-form-fields">
                  <div className="border-admin-field">
                    <UserRound size={21} aria-hidden="true" />
                    <div>
                      <label htmlFor="admin-new-fullname">
                        Nume și prenume
                      </label>
                      <input
                        id="admin-new-fullname"
                        type="text"
                        required
                        maxLength={150}
                        autoComplete="name"
                        placeholder="Nume complet"
                        value={newUser.fullName}
                        onChange={(e) =>
                          setNewUser((current) => ({
                            ...current,
                            fullName: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="border-admin-field">
                    <UserRound size={21} aria-hidden="true" />
                    <div>
                      <label htmlFor="admin-new-username">
                        Nume de utilizator
                      </label>
                      <input
                        id="admin-new-username"
                        type="text"
                        required
                        maxLength={50}
                        autoComplete="off"
                        placeholder="Username"
                        value={newUser.username}
                        onChange={(e) =>
                          setNewUser((current) => ({
                            ...current,
                            username: e.target.value,
                          }))
                        }
                      />
                      <small>
                        Se vor folosi litere mici, cifre și simbolul _
                        (underscore).
                      </small>
                    </div>
                  </div>
                  <div className="border-admin-field">
                    <Mail size={21} aria-hidden="true" />
                    <div>
                      <label htmlFor="admin-new-email">Adresă de e-mail</label>
                      <input
                        id="admin-new-email"
                        type="email"
                        required
                        maxLength={254}
                        autoComplete="email"
                        placeholder="exemplu@email.com"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser((current) => ({
                            ...current,
                            email: e.target.value,
                          }))
                        }
                      />
                      <small>Se va folosi o adresă de e-mail validă.</small>
                    </div>
                  </div>
                  <div className="border-admin-field">
                    <ShieldCheck size={21} aria-hidden="true" />
                    <div>
                      <label htmlFor="admin-new-role">Rol</label>
                      <select
                        id="admin-new-role"
                        value={newUser.role}
                        onChange={(e) =>
                          setNewUser((current) => ({
                            ...current,
                            role: e.target.value,
                          }))
                        }
                      >
                        <option value="USER">USER</option>
                        <option value="EDITOR">EDITOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <div className="border-admin-role-hint">
                        <Info size={16} />
                        <span>
                          Rolul determină drepturile de acces ale utilizatorului
                          în platformă.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <label className="border-admin-notify">
                  <Mail size={21} aria-hidden="true" />
                  <span>
                    <strong>Trimite notificare pe e-mail</strong>
                    <small>
                      Utilizatorul va primi un e-mail cu informații despre cont.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={sendEmailNotification}
                    onChange={(e) => setSendEmailNotification(e.target.checked)}
                  />
                  <span className="border-admin-switch" aria-hidden="true" />
                </label>
                <div className="border-admin-modal-actions">
                  <button
                    className="border-admin-cancel-btn"
                    type="button"
                    disabled={creatingUser}
                    onClick={() => setShowCreateForm(false)}
                  >
                    <X size={18} /> Anulează
                  </button>
                  <button
                    className="border-admin-create-btn"
                    type="submit"
                    disabled={creatingUser}
                  >
                    {creatingUser ? (
                      <LoaderCircle size={19} className="border-admin-spin" />
                    ) : (
                      <UserPlus size={19} />
                    )}
                    {creatingUser ? "Se creează..." : "Creează utilizator"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="admin-toolbar">
        <div className="admin-search border-admin-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Caută utilizatori"
            placeholder="Caută după utilizator, nume sau email..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-filter-toggle"
          aria-label="Opțiuni de filtrare"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((value) => !value)}
        >
          <SlidersHorizontal size={19} />
        </button>
      </div>
      <div className="admin-filter-tabs" aria-label="Filtrează utilizatorii">
        {[
          ["ALL", "Toți"],
          ["ADMIN", "Admin"],
          ["EDITOR", "Editor"],
          ["USER", "User"],
          ["ACTIVE", "Activi"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`admin-filter-tab ${roleFilter === value ? "is-active" : ""}`}
            aria-pressed={roleFilter === value}
            onClick={() => setRoleFilter(value)}
          >
            {label} ({roleCounts[value]})
          </button>
        ))}
      </div>
      {showFilters && (
        <div className="admin-extra-filters">
          <span>
            Filtre active:{" "}
            {roleFilter === "ALL"
              ? "toate rolurile"
              : roleFilter === "ACTIVE"
                ? "conturi active"
                : roleFilter}
          </span>
          <button
            type="button"
            onClick={() => {
              setRoleFilter("ALL");
              setSearchTerm("");
              setSortOrder("recent");
            }}
          >
            Resetează filtrele
          </button>
        </div>
      )}
      <div className="admin-results-row">
        <div className="admin-results">
          Afișate: <strong>{filteredUsers.length}</strong>
        </div>
        <label className="admin-sort-control">
          <ArrowDownUp size={15} />
          <select
            aria-label="Sortare utilizatori"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="recent">Cei mai recenți</option>
            <option value="oldest">Cei mai vechi</option>
            <option value="name">Nume A–Z</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="admin-loading">
          <LoaderCircle size={28} className="border-admin-spin" />
          <span>Se încarcă utilizatorii...</span>
        </div>
      ) : error ? (
        <div className="admin-error">
          <p>{error}</p>
          <button type="button" className="btn" onClick={() => loadUsers()}>
            <RefreshCw size={16} /> Reîncearcă
          </button>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Utilizator</th>
                <th>Nume complet</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Status</th>
                <th>Acțiuni</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr className="admin-empty-row">
                  <td colSpan={7} className="admin-no-results">
                    Nu au fost găsiți utilizatori.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const busy = updatingUserId === user.id;

                  return (
                    <tr key={user.id} className="admin-user-row">
                      <td data-label="ID">
                        <span className="admin-id">#{user.id}</span>
                      </td>

                      <td data-label="Utilizator">
                        <span className="admin-desktop-identity">
                          <AdminDesktopAvatar key={user.id} user={user} />
                          <span className="admin-username">
                            {user.username}
                          </span>
                        </span>
                      </td>

                      <td data-label="Nume complet">{user.full_name || "—"}</td>

                      <td data-label="Email" className="admin-email-cell">
                        {user.email || "—"}
                      </td>

                      <td data-label="Rol">
                        <div className="admin-role-control">
                          <select
                            value={user.role}
                            disabled={busy}
                            aria-label={`Rolul utilizatorului ${user.username}`}
                            onChange={(event) =>
                              handleRoleChange(user.id, event.target.value)
                            }
                          >
                            <option value="USER">USER</option>
                            <option value="EDITOR">EDITOR</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>

                          {busy && (
                            <span className="admin-saving">
                              Se procesează...
                            </span>
                          )}
                        </div>
                      </td>

                      <td data-label="Status">
                        <div className="admin-status-cell">
                          <span
                            className={`admin-status ${
                              user.is_active
                                ? "admin-status-active"
                                : "admin-status-inactive"
                            }`}
                          >
                            <span className="admin-status-dot" />
                            {user.is_active ? "Activ" : "Inactiv"}
                          </span>

                          <button
                            type="button"
                            className="admin-status-button"
                            disabled={busy}
                            onClick={() =>
                              handleStatusChange(user.id, user.is_active)
                            }
                          >
                            {user.is_active ? "Dezactivează" : "Activează"}
                          </button>
                        </div>
                      </td>

                      <td data-label="Acțiuni" className="admin-actions-cell">
                        <div className="border-admin-actions">
                          {!user.is_active && (
                            <button
                              type="button"
                              className="border-admin-resend"
                              disabled={busy}
                              onClick={() => handleResendActivation(user.id)}
                            >
                              <Mail size={15} />
                              Retrimite activarea
                            </button>
                          )}

                          <button
                            type="button"
                            className="admin-delete"
                            disabled={busy}
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 size={15} />
                            Șterge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && (
        <div className="admin-mobile-list">
          {filteredUsers.length === 0 ? (
            <p className="admin-mobile-empty">Nu au fost găsiți utilizatori.</p>
          ) : (
            filteredUsers.map((user) => {
              const busy = updatingUserId === user.id;
              return (
                <article className="admin-mobile-card" key={user.id}>
                  <div className="admin-mobile-top">
                    <div
                      className={`admin-avatar role-${String(user.role || "USER").toLowerCase()}`}
                    >
                      {getInitial(user)}
                    </div>
                    <div className="admin-mobile-identity">
                      <strong>{user.username}</strong>
                      <span>{user.full_name || "Nume necompletat"}</span>
                    </div>
                    <span
                      className={`admin-status ${user.is_active ? "admin-status-active" : "admin-status-inactive"}`}
                    >
                      <span className="admin-status-dot" />
                      {user.is_active ? "Activ" : "Inactiv"}
                    </span>
                    <div className="admin-mobile-menu-wrap">
                      <button
                        type="button"
                        className="admin-mobile-menu-trigger"
                        aria-label={`Opțiuni pentru ${user.username}`}
                        aria-expanded={openMenuId === user.id}
                        onClick={() =>
                          setOpenMenuId((id) =>
                            id === user.id ? null : user.id,
                          )
                        }
                      >
                        <MoreVertical size={19} />
                      </button>
                      {openMenuId === user.id && (
                        <div className="admin-mobile-menu">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setOpenMenuId(null);
                              handleStatusChange(user.id, user.is_active);
                            }}
                          >
                            {user.is_active ? (
                              <XCircle size={15} />
                            ) : (
                              <Check size={15} />
                            )}
                            {user.is_active
                              ? "Dezactivează contul"
                              : "Activează contul"}
                          </button>
                          {!user.is_active && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setOpenMenuId(null);
                                handleResendActivation(user.id);
                              }}
                            >
                              <Mail size={15} /> Retrimite activarea
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="admin-mobile-details">
                    <div className="admin-mobile-detail">
                      <UserRound size={15} /> <span>Nume complet</span>
                      <strong>{user.full_name || "—"}</strong>
                    </div>
                    <div className="admin-mobile-detail">
                      <Mail size={15} /> <span>Email</span>
                      <strong className="admin-mobile-email">
                        {user.email || "—"}
                      </strong>
                    </div>
                    <div className="admin-mobile-detail admin-mobile-role-row">
                      <ShieldCheck size={15} /> <span>Rol</span>
                      <div className="admin-mobile-role-value">
                        {editingRoleId === user.id ? (
                          <select
                            value={user.role}
                            disabled={busy}
                            aria-label={`Rolul utilizatorului ${user.username}`}
                            onChange={async (e) => {
                              setEditingRoleId(null);
                              await handleRoleChange(user.id, e.target.value);
                            }}
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="EDITOR">EDITOR</option>
                            <option value="USER">USER</option>
                          </select>
                        ) : (
                          <span
                            className={`admin-role-badge role-${String(user.role || "USER").toLowerCase()}`}
                          >
                            {getRoleIcon(user.role)} {user.role}
                          </span>
                        )}
                      </div>
                      <div className="admin-mobile-actions">
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Modifică rolul pentru ${user.username}`}
                          onClick={() =>
                            setEditingRoleId((id) =>
                              id === user.id ? null : user.id,
                            )
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="danger"
                          aria-label={`Șterge ${user.username}`}
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default Administrare;
