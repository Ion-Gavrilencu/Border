import { useEffect, useState } from "react";
import api from "../services/api";
import "./Administrare.css";

function Administrare() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);

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

      const response = await api.patch(
        `/users/${userId}/role`,
        {
          role: newRole,
        }
      );

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId
            ? response.data.user
            : user
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
    const response = await api.patch(
      `/users/${userId}/status`,
      {
        isActive: !currentStatus,
      }
    );

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? response.data.user
          : user
      )
    );
  } catch (error) {
    console.error("Eroare modificare status:", error);

    alert(
      error.response?.data?.message ||
        "Statusul utilizatorului nu a putut fi modificat."
    );
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

  if (loading) {
    return <div>Se încarcă utilizatorii...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
  <div className="admin-page">
    <h1>Administrare utilizatori</h1>

    <p className="admin-description">
      Gestionarea conturilor și a drepturilor utilizatorilor.
    </p>

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
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>

              <td>{user.username}</td>

              <td>{user.full_name}</td>

              <td>{user.email}</td>

              <td>
                <select
                  value={user.role}
                  disabled={updatingUserId === user.id}
                  onChange={(e) =>
                    handleRoleChange(
                      user.id,
                      e.target.value
                    )
                  }
                >
                  <option value="USER">USER</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                {updatingUserId === user.id && (
                  <span> Se salvează...</span>
                )}
              </td>

              <td>
  <button
  type="button"
  className="admin-status-button"
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

  <span className="admin-status">
    {" "}
    {user.is_active ? "Activ" : "Inactiv"}
  </span>
</td>
<td>
  <button
    type="button"
    className="admin-delete"
    onClick={() => handleDeleteUser(user.id)}
  >
    Șterge
  </button>
</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

 
  
}



export default Administrare;