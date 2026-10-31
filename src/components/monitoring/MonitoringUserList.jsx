import { useState } from "react";
import { Search, X } from "lucide-react";
import api from "../../services/api";
import { dateTime, initials } from "./monitoringUtils";

function getAvatarUrl(user) {
  const avatar = user?.avatarURL || user?.avatar_url;
  if (typeof avatar !== "string" || !avatar.trim()) return "";
  const value = avatar.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  try {
    return `${new URL(api.defaults.baseURL || "/api", window.location.origin).origin}${value}`;
  } catch {
    return "";
  }
}
function ListAvatar({ user }) {
  const [failedUrl, setFailedUrl] = useState("");
  const avatarUrl = getAvatarUrl(user);
  return (
    <span className="mon-avatar" style={{ overflow: "hidden", flexShrink: 0 }}>
      {avatarUrl && failedUrl !== avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Fotografia utilizatorului ${user.username}`}
          loading="lazy"
          onError={() => setFailedUrl(avatarUrl)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
      ) : (
        initials(user.full_name || user.username)
      )}
    </span>
  );
}
export default function MonitoringUserList({
  users = [],
  filteredUsers = [],
  selectedId,
  onSelect,
  search,
  onSearchChange,
  status,
  onStatusChange,
  loading = false,
}) {
  const onlineCount = users.filter((user) => user.online).length;
  return (
    <section className="mon-panel mon-users" aria-label="Lista utilizatorilor">
      <div className="mon-search">
        <Search size={19} />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Caută după nume, utilizator sau email..."
          aria-label="Caută utilizatori"
        />
        {search && (
          <button
            type="button"
            aria-label="Șterge căutarea"
            onClick={() => onSearchChange("")}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mon-filter-row">
        <button
          type="button"
          className={status === "all" ? "active" : ""}
          onClick={() => onStatusChange("all")}
        >
          Toți ({users.length})
        </button>
        <button
          type="button"
          className={status === "online" ? "active" : ""}
          onClick={() => onStatusChange("online")}
        >
          ● Online ({onlineCount})
        </button>
        <button
          type="button"
          className={status === "offline" ? "active" : ""}
          onClick={() => onStatusChange("offline")}
        >
          ● Offline ({users.length - onlineCount})
        </button>
      </div>
      <div className="mon-table-scroll">
        <table className="mon-table mon-user-table">
          <thead>
            <tr>
              <th>Utilizator</th>
              <th>Rol</th>
              <th>Status</th>
              <th>Ultima activitate</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className={
                  String(selectedId) === String(user.id) ? "selected" : ""
                }
              >
                <td>
                  <button
                    type="button"
                    className="mon-user-select"
                    onClick={() => onSelect(user.id)}
                    aria-pressed={String(selectedId) === String(user.id)}
                  >
                    <ListAvatar user={user} />
                    <span>
                      <strong>{user.username}</strong>
                      <small>{user.full_name}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="mon-role">{user.role}</span>
                </td>
                <td>
                  <span className={`mon-status ${user.online ? "online" : ""}`}>
                    ● {user.online ? "Online" : "Offline"}
                  </span>
                </td>
                <td>{dateTime(user.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mon-mobile-users">
        {filteredUsers.map((user) => (
          <button
            key={user.id}
            type="button"
            className={`mon-mobile-user ${String(selectedId) === String(user.id) ? "selected" : ""}`}
            onClick={() => onSelect(user.id)}
            aria-pressed={String(selectedId) === String(user.id)}
          >
            <ListAvatar user={user} />
            <span className="mon-mobile-user-main">
              <strong>{user.username}</strong>
              <small>{user.full_name || user.email || "—"}</small>
              <small>Ultima activitate: {dateTime(user.last_seen_at)}</small>
            </span>
            <span className="mon-mobile-user-side">
              <span className={`mon-status ${user.online ? "online" : ""}`}>
                ● {user.online ? "Online" : "Offline"}
              </span>
              <span className="mon-role">{user.role}</span>
            </span>
          </button>
        ))}
      </div>
      {!filteredUsers.length && (
        <p className="mon-empty">
          {loading
            ? "Se încarcă utilizatorii..."
            : "Nu există utilizatori care corespund filtrelor."}
        </p>
      )}
      <footer className="mon-panel-footer">
        Afișate {filteredUsers.length} din {users.length}
      </footer>
    </section>
  );
}
