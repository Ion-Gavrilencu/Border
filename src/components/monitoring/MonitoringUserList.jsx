import { useEffect, useState } from "react";
import { Search, X, Users, ChevronRight, ChevronLeft, Clock3 } from "lucide-react";
import MonitoringAvatar from "./MonitoringAvatar";
import { dateTime } from "./monitoringUtils";
import "./MonitoringUserList.css";

const LIMIT = 10;
export default function MonitoringUserList({
  users = [],
  filteredUsers = [],
  selectedId,
  onSelect,
  search = "",
  onSearchChange,
  status = "all",
  onStatusChange,
  loading = false,
}) {
  const [page, setPage] = useState(1);
  const online = users.filter((u) => u.online).length;
  const pages = Math.max(1, Math.ceil(filteredUsers.length / LIMIT));
  const current = Math.min(page, pages);
  useEffect(() => setPage(1), [search, status]);
  useEffect(() => setPage((p) => Math.min(p, pages)), [pages]);
  const visible = filteredUsers.slice((current - 1) * LIMIT, current * LIMIT);
  const tabs = [
    ["all", "Toți", users.length],
    ["online", "Online", online],
    ["offline", "Offline", users.length - online],
  ];
  return (
    <section
      className="mon-panel mon-users mon-directory"
      aria-label="Lista utilizatorilor"
      aria-busy={loading}
    >
      <header className="mon-directory-heading">
        <span className="mon-directory-symbol">
          <Users size={21} />
        </span>
        <div>
          <h2>Utilizatori</h2>
          <p>{loading ? "Se încarcă..." : `${users.length} conturi înregistrate`}</p>
        </div>
        <span className="mon-directory-live">
          <i /> {loading ? "—" : online} online
        </span>
      </header>
      <div className="mon-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Caută utilizator..."
          aria-label="Caută după nume, utilizator sau email"
        />
        {search && (
          <button type="button" aria-label="Șterge căutarea" onClick={() => onSearchChange("")}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mon-directory-tabs" role="group" aria-label="Status utilizatori">
        {tabs.map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value)}
          >
            {label}
            <span>{loading ? "—" : count}</span>
          </button>
        ))}
      </div>
      <div className="mon-directory-list">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="mon-directory-skeleton" aria-hidden="true" />
            ))
          : visible.map((user) => {
              const selected = String(user.id) === String(selectedId);
              return (
                <button
                  key={user.id}
                  type="button"
                  className={`mon-directory-user${selected ? " selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(user.id)}
                >
                  <span className="mon-directory-avatar">
                    <MonitoringAvatar user={user} />
                    <i className={user.online ? "online" : ""} />
                  </span>
                  <span className="mon-directory-main">
                    <strong>{user.username || user.full_name || "—"}</strong>
                    <small>{user.full_name || user.email || "—"}</small>
                    <span className="mon-directory-time">
                      <Clock3 size={12} />
                      {dateTime(user.last_seen_at)}
                    </span>
                  </span>
                  <span className="mon-directory-meta">
                    <span className={`mon-status ${user.online ? "online" : ""}`}>
                      {user.online ? "Online" : "Offline"}
                    </span>
                    <span className="mon-role">{user.role || "—"}</span>
                  </span>
                  <ChevronRight className="mon-directory-arrow" size={16} aria-hidden="true" />
                </button>
              );
            })}
        {!loading && !visible.length && (
          <div className="mon-directory-empty">
            <Users size={28} />
            <strong>Niciun utilizator găsit</strong>
            <small>Modifică filtrele sau termenul de căutare.</small>
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                onStatusChange("all");
              }}
            >
              Resetează filtrele
            </button>
          </div>
        )}
      </div>
      {!loading && (
        <footer className="mon-directory-footer">
          <span>
            {filteredUsers.length ? (current - 1) * LIMIT + 1 : 0}–
            {Math.min(current * LIMIT, filteredUsers.length)} din {filteredUsers.length}
          </span>
          <div>
            <button
              type="button"
              aria-label="Pagina precedentă de utilizatori"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {current} / {pages}
            </span>
            <button
              type="button"
              aria-label="Pagina următoare de utilizatori"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
