import { useState } from "react";
import api from "../../services/api";
import { dateTime, initials, readDevice } from "./monitoringUtils";

function getAvatarUrl(user) {
  const avatar = user?.avatarURL || user?.avatar_url;

  if (typeof avatar !== "string" || !avatar.trim()) {
    return "";
  }

  const value = avatar.trim();

  if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const apiOrigin = new URL(
    api.defaults.baseURL || "/api",
    window.location.origin,
  ).origin;

  return `${apiOrigin}${value}`;
}

function ProfileAvatar({ user }) {
  const [failedUrl, setFailedUrl] = useState("");
  const avatarUrl = getAvatarUrl(user);
  const showImage = avatarUrl && failedUrl !== avatarUrl;

  return (
    <span className="mon-avatar mon-avatar-lg" style={{ overflow: "hidden" }}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt={`Fotografia utilizatorului ${user.username}`}
          onError={() => setFailedUrl(avatarUrl)}
          style={{
            display: "block",
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
                <strong>Dispozitiv / Browser:</strong>{" "}
                {readDevice(user.user_agent)}
              </p>
              <p>
                <strong>Ultima activitate:</strong>{" "}
                {dateTime(user.last_seen_at)}
              </p>
              <p>
                <strong>Început sesiune:</strong>{" "}
                {dateTime(user.session_started_at)}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="mon-empty">Selectează un utilizator pentru detalii.</p>
      )}
    </section>
  );
}
