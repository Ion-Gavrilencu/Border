import { dateTime, initials, readDevice } from "./monitoringUtils";

export default function MonitoringUserProfile({ user }) {
  return (
    <section className="mon-panel mon-profile" aria-label="Profilul utilizatorului">
      {user ? (
        <>
          <div className="mon-profile-top">
            <span className="mon-avatar mon-avatar-lg">{initials(user.full_name || user.username)}</span>
            <div className="mon-profile-name"><h2>{user.username}</h2><span>{user.full_name}</span></div>
            <span className={`mon-status ${user.online ? "online" : ""}`}>● {user.online ? "Online" : "Offline"}</span>
          </div>
          <div className="mon-profile-details">
            <div>
              <p><strong>Email:</strong> {user.email || "—"}</p>
              <p><strong>Rol:</strong> {user.role || "—"}</p>
              <p><strong>Data înregistrării:</strong> {dateTime(user.created_at)}</p>
            </div>
            <div>
              <p><strong>Dispozitiv / Browser:</strong> {readDevice(user.user_agent)}</p>
              <p><strong>Ultima activitate:</strong> {dateTime(user.last_seen_at)}</p>
              <p><strong>Început sesiune:</strong> {dateTime(user.session_started_at)}</p>
            </div>
          </div>
        </>
      ) : <p className="mon-empty">Selectează un utilizator pentru detalii.</p>}
    </section>
  );
}
