import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CalendarDays,
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
  CircleHelp,
} from "lucide-react";
import { actionNames, dateTime, readDevice } from "./monitoringUtils";

const LIMIT = 8;
const tabs = [
  ["all", "Toată activitatea", Activity],
  ["login", "Conectări", LogIn],
  ["logout", "Deconectări", LogOut],
  ["search", "Căutări", Search],
  ["page_view", "Pagini accesate", Globe],
  ["view", "Documente", Eye],
  ["download", "Descărcări", Download],
];
const icons = {
  login: LogIn,
  logout: LogOut,
  search: Search,
  page_view: Globe,
  view: Eye,
  download: Download,
};
const sectionPaths = {
  telegrame: "/telegrame",
  ordine: "/ordine",
  legislatie: "/legislatie",
  informatii_utile: "/informatii-utile",
  news: "/noutati",
};
const allowedPage = /^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/;
function detailTarget(item) {
  const details = String(item.details || "");
  if (item.action === "page_view") {
    const path = details.match(/^Pagină accesată:\s*(\/\S*)/i)?.[1];
    if (path && allowedPage.test(path) && !path.includes(".."))
      return { path, title: "Pagină accesată", subtitle: path };
  }
  if (["view", "download"].includes(item.action) && item.document) {
    const { entity_type, title } = item.document;
    const path = sectionPaths[entity_type];
    if (path)
      return { path, title: title || "Document", subtitle: "Deschide secțiunea documentului" };
  }
  return null;
}
function Details({ item }) {
  const target = detailTarget(item);
  if (!target)
    return (
      <span className="mon-activity-detail-unavailable" title={item.details || ""}>
        {item.details || "—"}
      </span>
    );
  return (
    <Link
      className="mon-activity-detail-link"
      to={target.path}
      title={item.details || target.title}
    >
      <span className="mon-activity-detail-link-text">
        <span className="mon-activity-detail-title">{target.title}</span>
        <span className="mon-activity-detail-path">{target.subtitle}</span>
      </span>
      <ExternalLink className="mon-activity-detail-link-icon" aria-hidden="true" />
    </Link>
  );
}
export default function MonitoringActivity({
  activities = [],
  total = 0,
  page = 1,
  onPageChange,
  action,
  onActionChange,
  search,
  onSearchChange,
  start,
  onStartChange,
  end,
  onEndChange,
  loading = false,
  error,
  onRefresh,
}) {
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const from = total ? (page - 1) * LIMIT + 1 : 0;
  const to = Math.min(page * LIMIT, total);
  return (
    <section className="mon-panel mon-activity" aria-label="Istoricul activității">
      <div className="mon-activity-title">
        <h2>
          <Activity size={20} /> Istoricul activității
        </h2>
        <button
          type="button"
          className="mon-refresh"
          onClick={onRefresh}
          disabled={loading}
          title="Actualizează activitățile"
          aria-label="Actualizează activitățile"
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="mon-action-tabs" role="group" aria-label="Filtrează după acțiune">
        {tabs.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            className={action === value ? "active" : ""}
            aria-pressed={action === value}
            onClick={() => onActionChange(value)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <div className="mon-activity-filters">
        <label className="mon-date-field">
          <span className="mon-date-caption">De la</span>
          <CalendarDays size={16} aria-hidden="true" />
          <input
            type="date"
            aria-label="De la data"
            value={start}
            max={end || undefined}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </label>
        <label className="mon-date-field">
          <span className="mon-date-caption">Până la</span>
          <CalendarDays size={16} aria-hidden="true" />
          <input
            type="date"
            aria-label="Până la data"
            value={end}
            min={start || undefined}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </label>
        <label className="mon-activity-search">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Caută în activitate..."
            aria-label="Caută în activitate"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="mon-error" role="alert">
          {error}
        </p>
      )}
      <div className="mon-activity-desktop mon-table-scroll">
        <table className="mon-table mon-activity-table">
          <thead>
            <tr>
              <th>Data și ora</th>
              <th>Acțiune</th>
              <th>Detalii</th>
              <th>IP</th>
              <th>Dispozitiv / Browser</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((item) => {
              const Icon = icons[item.action] || FileText;
              return (
                <tr key={item.id}>
                  <td>{dateTime(item.created_at)}</td>
                  <td>
                    <span className="mon-action-label" data-kind={item.action}>
                      <Icon size={16} />
                      {actionNames[item.action] || item.action}
                    </span>
                  </td>
                  <td className="mon-activity-details-cell">
                    <Details item={item} />
                  </td>
                  <td>{item.ip_address || "—"}</td>
                  <td>{readDevice(item.user_agent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mon-activity-mobile" aria-label="Activități în format mobil">
        {activities.map((item) => {
          const Icon = icons[item.action] || FileText;
          return (
            <article className="mon-activity-card" key={item.id}>
              <div className="mon-activity-card-head">
                <span className="mon-activity-card-action">
                  <Icon size={17} />
                  {actionNames[item.action] || item.action}
                </span>
              </div>
              <div className="mon-activity-card-date">
                <Clock3 size={14} />
                <time>{dateTime(item.created_at)}</time>
              </div>
              <div className="mon-activity-card-details">
                <Details item={item} />
              </div>
              <div className="mon-activity-card-meta">
                <span>
                  <Monitor size={15} />
                  {readDevice(item.user_agent)}
                </span>
                <span>
                  <Network size={15} />
                  IP: {item.ip_address || "—"}
                </span>
              </div>
            </article>
          );
        })}
      </div>
      {!loading && !activities.length && !error && (
        <p className="mon-empty">Nu există activități înregistrate pentru filtrele selectate.</p>
      )}
      {loading && (
        <p className="mon-empty" role="status">
          Se încarcă activitățile...
        </p>
      )}
      <footer className="mon-panel-footer mon-pagination">
        <span>
          Afișate {from}–{to} din {total}
        </span>
        <div>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="Pagina precedentă"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            Pagina {page} din {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => onPageChange(Math.min(pages, page + 1))}
            aria-label="Pagina următoare"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </section>
  );
}
