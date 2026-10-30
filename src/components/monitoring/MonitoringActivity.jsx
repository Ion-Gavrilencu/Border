import { Activity, CalendarDays, ChevronLeft, ChevronRight, FileText, RefreshCw, Search } from "lucide-react";
import { actionNames, dateTime, readDevice } from "./monitoringUtils";

const LIMIT = 8;
const tabs = [["all", "Toată activitatea"], ["login", "Conectări"], ["logout", "Deconectări"], ["search", "Căutări"], ["page_view", "Pagini accesate"], ["view", "Documente"], ["download", "Descărcări"]];

export default function MonitoringActivity({ activities = [], total = 0, page = 1, onPageChange, action, onActionChange, search, onSearchChange, start, onStartChange, end, onEndChange, loading, error, onRefresh }) {
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  return (
    <section className="mon-panel mon-activity" aria-label="Istoricul activității">
      <div className="mon-activity-title">
        <h2><Activity size={19} /> Istoricul activității</h2>
        <button type="button" className="mon-refresh" onClick={onRefresh} title="Actualizează statisticile și activitățile" aria-label="Actualizează activitățile"><RefreshCw size={17} /></button>
      </div>
      <div className="mon-action-tabs">
        {tabs.map(([value, label]) => <button type="button" key={value} className={action === value ? "active" : ""} onClick={() => onActionChange(value)}>{label}</button>)}
      </div>
      <div className="mon-activity-filters">
        <label><CalendarDays size={17} /><input type="date" aria-label="De la data" value={start} max={end || undefined} onChange={(e) => onStartChange(e.target.value)} /></label>
        <label><CalendarDays size={17} /><input type="date" aria-label="Până la data" value={end} min={start || undefined} onChange={(e) => onEndChange(e.target.value)} /></label>
        <label className="mon-activity-search"><Search size={17} /><input placeholder="Caută în activitate..." aria-label="Caută în activitate" value={search} onChange={(e) => onSearchChange(e.target.value)} /></label>
      </div>
      {error && <p className="mon-error" role="alert">{error}</p>}
      <div className="mon-table-scroll">
        <table className="mon-table mon-activity-table">
          <thead><tr><th>Data și ora</th><th>Acțiune</th><th>Detalii</th><th>IP</th><th>Dispozitiv / Browser</th></tr></thead>
          <tbody>
            {activities.map((item) => (
              <tr key={item.id}>
                <td>{dateTime(item.created_at)}</td>
                <td><span className="mon-action-label"><FileText size={15} />{actionNames[item.action] || item.action}</span></td>
                <td title={item.details || ""}>{item.details || "—"}</td>
                <td>{item.ip_address || "—"}</td>
                <td>{readDevice(item.user_agent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !activities.length && !error && <p className="mon-empty">Nu există activități înregistrate pentru filtrele selectate.</p>}
      {loading && <p className="mon-empty">Se încarcă activitățile...</p>}
      <footer className="mon-panel-footer mon-pagination">
        <span>Afișate {total ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} din {total}</span>
        <div>
          <button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="Pagina precedentă"><ChevronLeft size={18} /></button>
          <span>Pagina {page} din {pages}</span>
          <button type="button" disabled={page >= pages || loading} onClick={() => onPageChange(Math.min(pages, page + 1))} aria-label="Pagina următoare"><ChevronRight size={18} /></button>
        </div>
      </footer>
    </section>
  );
}
