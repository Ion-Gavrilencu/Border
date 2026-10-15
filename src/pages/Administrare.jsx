import { useEffect, useState } from "react";
import api from "../services/api";
import "./Administrare.css";

function Administrare() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/users");

      setUsers(response.data.users);
    } catch (error) {
      console.error("Eroare utilizatori:", error);

      setError(
        error.response?.data?.message ||
          "Nu s-au putut încărca utilizatorii."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      setUpdatingUserId(userId);

      const response = await api.patch(`/users/${userId}/role`, {
        role: newRole,
      });

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId ? response.data.user : user
        )
      );
    } catch (error) {
      console.error("Eroare modificare rol:", error);

      alert(
        error.response?.data?.message ||
          "Rolul nu a putut fi modificat."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusChange = async (userId, currentStatus) => {
    try {
      setUpdatingUserId(userId);

      const response = await api.patch(`/users/${userId}/status`, {
        isActive: !currentStatus,
      });

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId ? response.data.user : user
        )
      );
    } catch (error) {
      console.error("Eroare modificare status:", error);

      alert(
        error.response?.data?.message ||
          "Statusul utilizatorului nu a putut fi modificat."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm(
      "Ești sigur că vrei să ștergi acest utilizator?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await api.delete(`/users/${userId}`);

      setUsers((currentUsers) =>
        currentUsers.filter((user) => user.id !== userId)
      );

      console.log(response.data.message);
    } catch (error) {
      console.error("Eroare ștergere utilizator:", error);

      alert(
        error.response?.data?.message ||
          "Utilizatorul nu a putut fi șters."
      );
    }
  };

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) {
      return true;
    }

    return (
      user.username?.toLowerCase().includes(search) ||
      user.full_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <span>Se încarcă utilizatorii...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Administrare utilizatori</h1>

          <p className="admin-description">
            Gestionarea conturilor, rolurilor și drepturilor
            utilizatorilor platformei.
          </p>
        </div>

        <div className="admin-user-count">
          <span className="admin-user-count-label">
            Utilizatori
          </span>

          <strong>{users.length}</strong>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <input
            type="text"
            placeholder="Caută după utilizator, nume sau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="admin-results">
          Afișate: <strong>{filteredUsers.length}</strong>
        </div>
      </div>

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
              <tr>
                <td
                  colSpan="7"
                  className="admin-no-results"
                >
                  Nu au fost găsiți utilizatori.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className="admin-id">
                      #{user.id}
                    </span>
                  </td>

                  <td>
                    <span className="admin-username">
                      {user.username}
                    </span>
                  </td>

                  <td>
                    {user.full_name || "-"}
                  </td>

                  <td>
                    {user.email || "-"}
                  </td>

                  <td>
                    <div className="admin-role-control">
                      <select
                        value={user.role}
                        disabled={
                          updatingUserId === user.id
                        }
                        onChange={(e) =>
                          handleRoleChange(
                            user.id,
                            e.target.value
                          )
                        }
                      >
                        <option value="USER">
                          USER
                        </option>

                        <option value="EDITOR">
                          EDITOR
                        </option>

                        <option value="ADMIN">
                          ADMIN
                        </option>
                      </select>

                      {updatingUserId === user.id && (
                        <span className="admin-saving">
                          Se salvează...
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className="admin-status-cell">
                      <span
                        className={`admin-status ${
                          user.is_active
                            ? "admin-status-active"
                            : "admin-status-inactive"
                        }`}
                      >
                        <span className="admin-status-dot"></span>

                        {user.is_active
                          ? "Activ"
                          : "Inactiv"}
                      </span>

                      <button
                        type="button"
                        className="admin-status-button"
                        disabled={
                          updatingUserId === user.id
                        }
                        onClick={() =>
                          handleStatusChange(
                            user.id,
                            user.is_active
                          )
                        }
                      >
                        {user.is_active
                          ? "Dezactivează"
                          : "Activează"}
                      </button>
                    </div>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="admin-delete"
                      onClick={() =>
                        handleDeleteUser(user.id)
                      }
                    >
                      Șterge
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Administrare;
