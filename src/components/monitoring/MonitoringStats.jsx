import { useState } from "react";
import { Users, LogIn, Search, Download, Eye, Globe, Monitor, Activity } from "lucide-react";
import { actionNames } from "./monitoringUtils";
import "./MonitoringStats.css";

const fmt = (value) =>
  value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("ro-RO");
const num = (value) => Math.max(0, Number(value) || 0);
const dateLabel = (value) =>
  typeof value === "string" ? value.slice(8, 10) + "." + value.slice(5, 7) : "—";

export default function MonitoringStats({ stats, totalUsers = 0, loading = false }) {
  const [metric, setMetric] = useState("events");
  const data = stats || {};
  const daily = Array.isArray(data.daily_activity) ? data.daily_activity : null;
  const distribution = Array.isArray(data.action_distribution) ? data.action_distribution : null;
  const max = Math.max(1, ...(daily || []).map((d) => num(d[metric])));
  const total = (distribution || []).reduce((sum, item) => sum + num(item.total), 0);
  const cards = [
    [
      "Utilizatori online",
      data.online_users,
      stats ? `Din ${totalUsers} utilizatori` : "Prezență recentă",
      Users,
      "green",
    ],
    ["Sesiuni active", data.active_sessions, "Prezență în ultimele 2 min", Monitor, "blue"],
    ["Conectări astăzi", data.logins_today, "Ziua curentă", LogIn, "blue"],
    ["Căutări", data.searches_24h, "Ultimele 24 de ore", Search, "violet"],
    ["Documente vizualizate", data.views_24h, "Evenimente în ultimele 24h", Eye, "violet"],
    ["Descărcări", data.downloads_24h, "Ultimele 24 de ore", Download, "cyan"],
    ["Pagini accesate", data.page_views_24h, "Evenimente în ultimele 24h", Globe, "cyan"],
    ["Activități înregistrate", data.events_7d, "Ultimele 7 zile calendaristice", Activity, "blue"],
  ];
  return (
    <section className="mon-insights" aria-label="Statistici monitorizare" aria-busy={loading}>
      <div className="mon-insights-grid">
        {cards.map(([label, value, sub, Icon, color]) => (
          <article key={label} className="mon-insight-card">
            <span className={`mon-insight-icon ${color}`}>
              <Icon size={21} aria-hidden="true" />
            </span>
            <div className="mon-insight-content">
              <span>{label}</span>
              <strong>{loading && value == null ? "…" : fmt(value)}</strong>
              <small>{sub}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="mon-insights-charts">
        <article className="mon-insight-panel">
          <header>
            <div>
              <h2>Evoluția activității</h2>
              <p>Ultimele 7 zile · inclusiv astăzi</p>
            </div>
            <div className="mon-insight-toggle" role="group" aria-label="Indicator grafic">
              <button
                type="button"
                aria-pressed={metric === "events"}
                onClick={() => setMetric("events")}
              >
                Evenimente
              </button>
              <button
                type="button"
                aria-pressed={metric === "users"}
                onClick={() => setMetric("users")}
              >
                Utilizatori
              </button>
            </div>
          </header>
          {daily?.length ? (
            <div
              className="mon-insight-bars"
              role="list"
              aria-label={
                metric === "events" ? "Evenimente zilnice" : "Utilizatori distincți cu evenimente"
              }
            >
              {daily.map((day) => (
                <div
                  className="mon-insight-day"
                  role="listitem"
                  key={day.date}
                  title={`${day.date}: ${fmt(day[metric])}`}
                >
                  <strong>{fmt(day[metric])}</strong>
                  <div className="mon-insight-track">
                    <span style={{ height: `${(num(day[metric]) / max) * 100}%` }} />
                  </div>
                  <small>{dateLabel(day.date)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="mon-insight-empty">
              {loading ? "Se încarcă statisticile…" : "Datele graficului nu sunt disponibile."}
            </p>
          )}
          <p className="mon-insight-note">
            {metric === "users"
              ? "Utilizatori distincți cu cel puțin un eveniment înregistrat în ziua respectivă."
              : "Numărul evenimentelor păstrate în istoric, pe zi."}
          </p>
        </article>
        <article className="mon-insight-panel">
          <header>
            <div>
              <h2>Distribuția activităților</h2>
              <p>Ultimele 7 zile calendaristice</p>
            </div>
            <strong>{distribution ? fmt(total) : "—"}</strong>
          </header>
          {distribution?.length ? (
            <div className="mon-insight-distribution">
              {distribution.map((item) => (
                <div key={item.action}>
                  <div className="mon-insight-distribution-label">
                    <span>{actionNames[item.action] || item.action || "Necunoscut"}</span>
                    <strong>{fmt(item.total)}</strong>
                  </div>
                  <div className="mon-insight-progress">
                    <span style={{ width: `${total ? (num(item.total) / total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mon-insight-empty">
              {loading
                ? "Se încarcă…"
                : distribution
                  ? "Nu există evenimente în interval."
                  : "Date indisponibile."}
            </p>
          )}
          <p className="mon-insight-note">
            Statisticile reflectă doar evenimentele încă păstrate în baza de date. Fus orar:
            Europe/Chisinau.
          </p>
        </article>
      </div>
    </section>
  );
}
