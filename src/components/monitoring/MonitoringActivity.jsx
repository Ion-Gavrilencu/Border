import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  Monitor,
  Network,
  Clock3,
  ExternalLink,
  Eye,
  Download,
  LogIn,
  LogOut,
  Globe,
  List,
  Table2,
  RotateCcw,
} from "lucide-react";
import { actionNames, dateTime, readDevice } from "./monitoringUtils";
import "./MonitoringActivity.css";

const tabs = [
  ["all", "Toate", Activity],
  ["login", "Conectări", LogIn],
  ["logout", "Deconectări", LogOut],
  ["search", "Căutări", Search],
  ["page_view", "Pagini", Globe],
  ["view", "Documente", Eye],
  ["download", "Descărcări", Download],
];
const icons = Object.fromEntries(tabs.map(([key, , Icon]) => [key, Icon]));
function attachmentUrl(id) {
  if (!/^[1-9]\d*$/.test(String(id ?? ""))) return null;
  try {
    const base = new URL(api.defaults.baseURL || "/api", window.location.origin);
    if (!["http:", "https:"].includes(base.protocol)) return null;
    base.search = "";
    base.hash = "";
    base.pathname = `${base.pathname.replace(/\/+$/, "")}/attachments/file/${id}`;
    return base.href;
  } catch {
    return null;
  }
}
function Details({ item }) {
  const details = String(item.details || "");
  const path =
    item.action === "page_view" ? details.match(/^Pagină accesată:\s*(\/\S*)$/i)?.[1] : null;
  const safe =
    path &&
    /^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(path) &&
    !path.includes("..") &&
    !/%(?:2f|5c|2e|25)/i.test(path);
  if (safe) {
    return (
      <Link className="ma-link" to={path} target="_blank" rel="noopener noreferrer">
        <span>
          {path}
          <small>Deschide pagina într-o filă nouă</small>
        </span>
        <ExternalLink size={15} aria-hidden="true" />
      </Link>
    );
  }
  if (["view", "download"].includes(item.action)) {
    const legacyId = details.match(/^(?:Vizualizare|Descărcare) atașament #([1-9]\d*): /)?.[1];
    const url = attachmentUrl(item.document?.attachment_id ?? legacyId);
    if (url) {
      return (
        <a className="ma-link" href={url} target="_blank" rel="noopener noreferrer">
          <span>
            {item.document?.title || details || "Document"}
            <small>Deschide fișierul original</small>
          </span>
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      );
    }
    return (
      <span className="ma-detail" title="Evenimentul nu conține identificatorul atașamentului">
        {details || "—"}
        <small style={{ display: "block" }}>Fișierul exact nu poate fi identificat</small>
      </span>
    );
  }
  return <span className="ma-detail">{details || "—"}</span>;
}
function Action({ item }) {
  const Icon = icons[item.action] || FileText;
  return (
    <span className="ma-kind" data-kind={item.action}>
      <Icon size={16} />
      {actionNames[item.action] || item.action}
    </span>
  );
}
const localDay = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
function dayString(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function range(days) {
  const today = localDay(new Date());
  const start = new Date(Date.UTC(+today.year, +today.month - 1, +today.day - days + 1));
  return [start.toISOString().slice(0, 10), dayString(today)];
}
export default function MonitoringActivity({
  activities = [],
  total = 0,
  page = 1,
  limit = 10,
  onLimitChange,
  onPageChange,
  action,
  onActionChange,
  search,
  onSearchChange,
  start,
  onStartChange,
  end,
  onEndChange,
  onDateRangeChange,
  onReset,
  loading = false,
  error,
  onRefresh,
}) {
  const [view, setView] = useState("table");
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total && activities.length ? (page - 1) * limit + 1 : 0;
  const to = from ? Math.min(total, from + activities.length - 1) : 0;
  return (
    <section
      className="mon-panel mon-activity ma"
      aria-label="Istoricul activității"
      aria-busy={loading}
    >
      <header className="ma-heading">
        <div>
          <h2>
            <Activity size={21} /> Istoricul activității
          </h2>
          <p>{total.toLocaleString("ro-RO")} evenimente pentru filtrele curente</p>
        </div>
        <div className="ma-tools">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizează istoricul"
          >
            <RefreshCw size={17} />
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
            aria-label="Vizualizare tabel"
          >
            <Table2 size={17} />
          </button>
          <button
            type="button"
            onClick={() => setView("timeline")}
            aria-pressed={view === "timeline"}
            aria-label="Vizualizare cronologică"
          >
            <List size={17} />
          </button>
        </div>
      </header>
      <div className="ma-tabs" role="group" aria-label="Tip activitate">
        {tabs.map(([value, label, Icon]) => (
          <button
            type="button"
            key={value}
            aria-pressed={action === value}
            onClick={() => onActionChange(value)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div className="ma-presets">
        <button type="button" onClick={() => onDateRangeChange(...range(1))}>
          Astăzi
        </button>
        <button type="button" onClick={() => onDateRangeChange(...range(7))}>
          Ultimele 7 zile
        </button>
        <button type="button" onClick={() => onDateRangeChange(...range(30))}>
          Ultimele 30 de zile
        </button>
        <button type="button" onClick={onReset}>
          <RotateCcw size={15} /> Resetează
        </button>
      </div>
      <div className="ma-filters">
        <label>
          <span>De la</span>
          <input
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </label>
        <label>
          <span>Până la</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </label>
        <label>
          <span>Caută în detalii</span>
          <span className="ma-search">
            <Search size={17} />
            <input
              value={search}
              maxLength={120}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Caută activitate..."
            />
          </span>
        </label>
      </div>
      {error && (
        <p className="mon-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="ma-loading" role="status">
          Se încarcă activitățile…
        </p>
      )}
      {!loading && !error && !activities.length && (
        <div className="ma-empty">
          <Activity size={28} />
          <strong>Nu există activități</strong>
          <span>Modifică filtrele pentru a căuta alte evenimente.</span>
        </div>
      )}
      {!!activities.length && (
        <div className={`ma-results ma-mode-${view}`}>
          {view === "table" && (
            <table className="ma-table">
              <thead>
                <tr>
                  <th>Data și ora</th>
                  <th>Acțiune</th>
                  <th>Detalii</th>
                  <th>IP / Dispozitiv</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((item) => (
                  <tr key={item.id}>
                    <td>{dateTime(item.created_at)}</td>
                    <td>
                      <Action item={item} />
                    </td>
                    <td>
                      <Details item={item} />
                    </td>
                    <td>
                      <div className="ma-meta">
                        <span>{item.ip_address || "—"}</span>
                        <small>{readDevice(item.user_agent)}</small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="ma-feed">
            {activities.map((item) => (
              <article key={item.id} className="ma-event">
                <div className="ma-event-head">
                  <Action item={item} />
                  <time>
                    <Clock3 size={14} />
                    {dateTime(item.created_at)}
                  </time>
                </div>
                <Details item={item} />
                <div className="ma-event-meta">
                  <span>
                    <Monitor size={15} />
                    {readDevice(item.user_agent)}
                  </span>
                  <span>
                    <Network size={15} />
                    {item.ip_address || "—"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      <footer className="ma-footer">
        <span>
          Afișate {from}–{to} din {total}
        </span>
        <label>
          Pe pagină{" "}
          <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="ma-pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Pagina precedentă"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Pagina următoare"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </section>
  );
}
