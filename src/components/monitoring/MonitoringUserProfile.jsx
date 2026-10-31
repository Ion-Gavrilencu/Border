import { useState } from "react";
import api from "../../services/api";
import { dateTime, initials, readDevice } from "./monitoringUtils";

function getAvatarUrl(user) {
  const avatar = user?.avatarURL || user?.avatar_url;
  if (typeof avatar !== "string" || !avatar.trim()) return "";
  const value = avatar.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  try {
    const base = new URL(
      api.defaults.baseURL || "/api",
      window.location.origin,
    );
    return `${base.origin}${value}`;
  } catch {
    return "";
  }
}
function ProfileAvatar({ user }) {
  const [failedUrl, setFailedUrl] = useState("");
  const avatarUrl = getAvatarUrl(user);
  return (
    <span className="mon-avatar mon-avatar-lg" style={{ overflow: "hidden" }}>
      {avatarUrl && failedUrl !== avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Fotografia utilizatorului ${user.username}`}
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
export default function MonitoringUserProfile({ user }) {
  const sessions = Array.isArray(user?.sessions) ? user.sessions : [];
  return (
    <section
      className="mon-panel mon-profile"
      aria-label="Profilul utilizatorului"
    >
      {user ? (
        <>
          <div className="mon-profile-top">
            <ProfileAvatar key={user.id} user={user} />
            <div className="mon-profile-name">
              <h2>{user.username}</h2>
              <span>{user.full_name}</span>
            </div>
            <span className={`mon-status ${user.online ? "online" : ""}`}>
              ● {user.online ? "Online" : "Offline"}
            </span>
          </div>
          <div className="mon-profile-details">
            <div>
              <p>
                <strong>Email:</strong> {user.email || "—"}
              </p>
              <p>
                <strong>Rol:</strong> {user.role || "—"}
              </p>
              <p>
                <strong>Data înregistrării:</strong> {dateTime(user.created_at)}
              </p>
            </div>
            <div>
              <p>
                <strong>Dispozitiv / Browser (ultima sesiune):</strong>{" "}
                {readDevice(user.user_agent)}
              </p>
              <p>
                <strong>Ultima activitate:</strong>{" "}
                {dateTime(user.last_seen_at)}
              </p>
              <p>
                <strong>Început ultima sesiune:</strong>{" "}
                {dateTime(user.session_started_at)}
              </p>
            </div>
          </div>
          <div className="mon-session-section">
            <h3>
              Sesiuni active{" "}
              <span className="mon-session-count">
                {user.active_sessions ?? sessions.length}
              </span>
            </h3>
            {sessions.length ? (
              <div className="mon-session-list">
                {sessions.map((session) => (
                  <div className="mon-session-item" key={session.session_id}>
                    <div className="mon-session-top">
                      <strong>{readDevice(session.user_agent)}</strong>
                      <span className="mon-status online">● Activ</span>
                    </div>
                    <div className="mon-session-meta">
                      <span>Autentificare: {dateTime(session.started_at)}</span>
                      <span>
                        Ultima activitate: {dateTime(session.last_seen_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mon-session-empty">
                Nicio sesiune activă în ultimele două minute.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="mon-empty">Selectează un utilizator pentru detalii.</p>
      )}
    </section>
  );
}
