import { useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  ShieldCheck,
  CalendarDays,
  Clock3,
  Monitor,
  Smartphone,
  Laptop,
  Activity,
  ChevronDown,
} from "lucide-react";
import MonitoringAvatar from "./MonitoringAvatar";
import { dateTime, readDevice } from "./monitoringUtils";
import "./MonitoringUserProfile.css";

function duration(value, now) {
  if (!value) return "—";
  const start = Date.parse(value);
  if (!Number.isFinite(start) || start > now) return "—";
  const minutes = Math.floor((now - start) / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return minutes < 1
    ? "Sub 1 min"
    : [days && `${days} z`, hours && `${hours} h`, `${rest} min`].filter(Boolean).join(" ");
}
function Info({ icon: Icon, label, value }) {
  return (
    <div className="mp-info">
      <span className="mp-info-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value || "—"}</strong>
      </div>
    </div>
  );
}
function Session({ session, now }) {
  const device = readDevice(session.user_agent);
  const Icon = /Android|iOS/i.test(device)
    ? Smartphone
    : /Windows|macOS|Linux/i.test(device)
      ? Laptop
      : Monitor;
  return (
    <article className="mp-session">
      <div className="mp-session-head">
        <span className="mp-device-icon">
          <Icon size={21} aria-hidden="true" />
        </span>
        <div>
          <strong>{device}</strong>
          <small>Sesiune raportată activă</small>
        </div>
        <span className="mp-status is-online">
          <i />
          Activă
        </span>
      </div>
      <div className="mp-session-data">
        <Info icon={CalendarDays} label="Autentificare" value={dateTime(session.started_at)} />
        <Info icon={Clock3} label="Ultima activitate" value={dateTime(session.last_seen_at)} />
        <Info
          icon={Activity}
          label="Timp de la autentificare"
          value={duration(session.started_at, now)}
        />
      </div>
    </article>
  );
}
function Profile({ user }) {
  const [expanded, setExpanded] = useState(true);
  const [now, setNow] = useState(Date.now);
  const sessions = Array.isArray(user.sessions) ? user.sessions : [];
  useEffect(() => {
    if (!sessions.length) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 15000);
    return () => window.clearInterval(timer);
  }, [sessions.length]);
  return (
    <>
      <div className="mp-heading">
        <span>
          <UserRound size={18} /> Profil utilizator
        </span>
        <span className={`mp-status ${user.online ? "is-online" : ""}`}>
          <i />
          {user.online ? "Online" : "Offline"}
        </span>
      </div>
      <div className="mp-identity">
        <MonitoringAvatar user={user} large />
        <div>
          <h2>{user.full_name || user.username || "Utilizator"}</h2>
          <p>{user.username ? `@${user.username}` : "—"}</p>
          <span className="mp-role">
            <ShieldCheck size={13} />
            {user.role || "—"}
          </span>
        </div>
      </div>
      <div className="mp-info-grid">
        <Info icon={Mail} label="Adresă de email" value={user.email} />
        <Info icon={CalendarDays} label="Data înregistrării" value={dateTime(user.created_at)} />
        <Info icon={Monitor} label="Ultimul dispozitiv" value={readDevice(user.user_agent)} />
        <Info icon={Clock3} label="Ultima activitate" value={dateTime(user.last_seen_at)} />
        <Info
          icon={Activity}
          label="Începutul ultimei sesiuni"
          value={dateTime(user.session_started_at)}
        />
      </div>
      <div className="mp-sessions">
        <button
          className="mp-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <Monitor size={19} />
          <span>Sesiuni active</span>
          <span className="mp-count">{user.active_sessions ?? sessions.length}</span>
          <ChevronDown size={19} className={expanded ? "mp-chevron open" : "mp-chevron"} />
        </button>
        {expanded && (
          <div className="mp-session-list">
            {sessions.length ? (
              sessions.map((session, index) => (
                <Session key={session.session_id ?? index} session={session} now={now} />
              ))
            ) : (
              <p className="mp-empty">
                {Number(user.active_sessions) > 0
                  ? "Detaliile sesiunilor nu sunt disponibile."
                  : "Nicio sesiune activă raportată în ultimele două minute."}
              </p>
            )}
            <p className="mp-note">
              Prezența reflectă ultima sincronizare cu serverul, nu activitatea continuă la
              dispozitiv.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
export default function MonitoringUserProfile({ user }) {
  return (
    <section className="mon-panel mon-profile mp-profile" aria-label="Profilul utilizatorului">
      {user ? (
        <Profile key={user.id} user={user} />
      ) : (
        <div className="mp-empty">
          <UserRound size={26} />
          <p>Selectează un utilizator pentru a vedea detaliile.</p>
        </div>
      )}
    </section>
  );
}
