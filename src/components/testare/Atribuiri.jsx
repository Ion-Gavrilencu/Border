import React, { useMemo, useRef, useState } from "react";
import {
  Users,
  Layers3,
  CalendarDays,
  CheckCircle2,
  Search,
  Eye,
  Play,
  ChevronLeft,
  ChevronRight,
  Plus,
  Zap,
  BarChart3,
  Bell,
  RefreshCw,
  ArrowRight,
  Clock3,
  Activity,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import "./Atribuiri.css";

const normalize = (value) => String(value ?? "").toLowerCase();
const statusOf = (item) => normalize(item.progress_status).toUpperCase();
const dateOf = (item) => item.assigned_at || item.created_at;
const labelType = (item) =>
  ({ USER: "Individual", GROUP: "Grup", ALL: "Toți utilizatorii" })[
    String(item.target_type || "").toUpperCase()
  ] ||
  item.target_label ||
  "—";
const initials = (name) =>
  String(name || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
const fmt = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ro-RO");
};
const validityOf = (item) => {
  const from = item.available_from ?? item.starts_at ?? item.start_at;
  const until = item.deadline_at ?? item.available_until ?? item.expires_at ?? item.ends_at;
  if (!from && !until) return "Termen nespecificat";
  return `${from ? fmt(from) : "Fără început"} – ${until ? fmt(until) : "Fără termen-limită"}`;
};

const isFinished = (s) => ["FINISHED", "COMPLETED", "SUBMITTED"].includes(s);
const isActive = (s) => ["IN_PROGRESS", "STARTED", "ACTIVE"].includes(s);
const isScheduled = (s) => ["SCHEDULED", "PROGRAMMED"].includes(s);
const isPending = (s) => ["NOT_STARTED", "PENDING"].includes(s);

export default function Atribuiri({ ctx }) {
  const {
    assignmentRows = [],
    assignmentLoading,
    assignmentError,
    assignmentSearch = "",
    setAssignmentSearch,
    assignmentStatus = "all",
    setAssignmentStatus,
    assignmentPage = 1,
    setAssignmentPage,
    loadAssignments,
    openEditor,
    managed = [],
    canManage,
    user,
    openAssignedTest,
    startingId,
    attemptDate,
    setTab,
  } = ctx;
  const [testFilter, setTestFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [quickType, setQuickType] = useState("GROUP");
  const [quickTest, setQuickTest] = useState("");
  const [quickNotice, setQuickNotice] = useState("");
  const quickSelectRef = useRef(null);
  const rows = Array.isArray(assignmentRows) ? assignmentRows : [];
  const testOptions = useMemo(
    () => [
      ...new Map(
        rows
          .filter((x) => x.test_title)
          .map((x) => [
            String(x.version_id ?? x.test_title),
            { value: String(x.version_id ?? x.test_title), label: x.test_title },
          ]),
      ).values(),
    ],
    [rows],
  );
  const summary = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((x) => isActive(statusOf(x)) || isPending(statusOf(x))).length,
      scheduled: rows.filter((x) => isScheduled(statusOf(x))).length,
      finished: rows.filter((x) => isFinished(statusOf(x))).length,
    }),
    [rows],
  );
  const filtered = useMemo(
    () =>
      rows.filter((item) => {
        const search = normalize(assignmentSearch).trim();
        if (
          search &&
          ![
            item.test_title,
            item.full_name,
            item.username,
            item.target_label,
            item.group_name,
          ].some((v) => normalize(v).includes(search))
        )
          return false;
        if (assignmentStatus !== "all" && statusOf(item) !== assignmentStatus) return false;
        if (testFilter !== "all" && String(item.version_id ?? item.test_title) !== testFilter)
          return false;
        if (typeFilter !== "all" && String(item.target_type || "").toUpperCase() !== typeFilter)
          return false;
        if (period !== "all") {
          const d = new Date(dateOf(item));
          if (
            Number.isNaN(d.getTime()) ||
            Date.now() - d.getTime() > Number(period) * 86400000 ||
            d.getTime() > Date.now()
          )
            return false;
        }
        return true;
      }),
    [rows, assignmentSearch, assignmentStatus, testFilter, typeFilter, period],
  );
  const pageSize = 5;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(Number(assignmentPage) || 1, 1), pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const reset = () => {
    setAssignmentSearch("");
    setAssignmentStatus("all");
    setTestFilter("all");
    setTypeFilter("all");
    setPeriod("all");
    setAssignmentPage(1);
  };
  const goToEditor = (item) => {
    const versionId = item.version_id ?? item.current_version_id;
    if (versionId) window.location.assign(`/testare/${encodeURIComponent(versionId)}/editare?mod=atribuire`);
    else setQuickNotice("Nu este disponibil ID-ul versiunii pentru atribuire.");
  };
  const focusQuickAssignment = () => {
    setQuickNotice("Selectează testul din lista de atribuire rapidă, apoi apasă Continuă.");
    quickSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    quickSelectRef.current?.focus();
  };
  const startAssignment = () => {
    setQuickNotice("");
    if (!canManage) {
      setQuickNotice("Nu ai permisiunea de a crea atribuiri.");
      return;
    }
    const candidate = managed.find(
      (t) =>
        String(t.id) === quickTest ||
        String(t.version_id) === quickTest ||
        String(t.current_version_id) === quickTest,
    );
    if (candidate && typeof openEditor === "function") {
      const versionId = candidate.version_id ?? candidate.current_version_id;
      if (!versionId) {
        setQuickNotice("Testul selectat nu are ID-ul versiunii publicate.");
        return;
      }
      window.location.assign(`/testare/${encodeURIComponent(versionId)}/editare?mod=atribuire`);
      return;
    }
    setQuickNotice(
      "Selectează un test administrat pentru a deschide editorul și a configura destinatarii.",
    );
  };
  const quickOptions = managed
    .map((t) => ({
      value: String(t.version_id ?? t.current_version_id ?? t.id ?? ""),
      label: t.title || t.name || "Test fără titlu",
    }))
    .filter((x) => x.value);
  const donutTotal = summary.active + summary.scheduled + summary.finished;
  const activePct = donutTotal ? (summary.active / donutTotal) * 100 : 0;
  const scheduledPct = donutTotal ? (summary.scheduled / donutTotal) * 100 : 0;
  const finishedPct = donutTotal ? (summary.finished / donutTotal) * 100 : 0;
  const cards = [
    { title: "Atribuiri totale", value: summary.total, Icon: Layers3, tone: "blue" },
    { title: "Atribuiri active", value: summary.active, Icon: Users, tone: "purple" },
    { title: "Atribuiri programate", value: summary.scheduled, Icon: CalendarDays, tone: "blue" },
    { title: "Atribuiri finalizate", value: summary.finished, Icon: CheckCircle2, tone: "green" },
  ];
  return (
    <section className="pt-assignments-page pt-a4">
      <div className="pt-a4-layout">
        <main className="pt-a4-main">
          <div className="pt-a4-stats">
            {cards.map(({ title, value, Icon, tone }) => (
              <div className={`pt-a4-stat pt-a4-${tone}`} key={title}>
                <span className="pt-a4-stat-icon">
                  <Icon size={27} />
                </span>
                <div className="pt-a4-stat-copy">
                  <span>{title}</span>
                  <strong>{value}</strong>
                </div>
                <svg className="pt-a4-spark" viewBox="0 0 76 35" aria-hidden="true">
                  <path
                    d="M2 29 L15 21 L27 24 L41 11 L52 16 L65 6 L74 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ))}
          </div>
          <section className="pt-a4-panel">
            <header className="pt-a4-panel-head">
              <div className="pt-a4-title">
                <span className="pt-a4-title-icon">
                  <Users size={24} />
                </span>
                <div>
                  <h2>Gestionează atribuiri</h2>
                  <p>Creează atribuiri noi, modifică sau urmărește progresul testelor atribuite.</p>
                </div>
              </div>
              {canManage && (
                <button
                  className="pt-a4-primary"
                  type="button"
                  onClick={() => {
                    focusQuickAssignment();
                  }}
                >
                  <Plus size={19} /> Atribuire nouă
                </button>
              )}
            </header>
            <div className="pt-a4-filters">
              <label className="pt-a4-search">
                <Search size={19} />
                <input
                  aria-label="Caută atribuiri"
                  placeholder="Caută după test sau utilizator..."
                  value={assignmentSearch}
                  onChange={(e) => {
                    setAssignmentSearch(e.target.value);
                    setAssignmentPage(1);
                  }}
                />
              </label>
              <select
                aria-label="Filtru test"
                value={testFilter}
                onChange={(e) => {
                  setTestFilter(e.target.value);
                  setAssignmentPage(1);
                }}
              >
                <option value="all">Toate testele</option>
                {testOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Tip atribuire"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setAssignmentPage(1);
                }}
              >
                <option value="all">Toate tipurile</option>
                <option value="GROUP">Grupuri</option>
                <option value="USER">Individual</option>
                <option value="ALL">Toți utilizatorii</option>
              </select>
              <select
                aria-label="Stare atribuire"
                value={assignmentStatus}
                onChange={(e) => {
                  setAssignmentStatus(e.target.value);
                  setAssignmentPage(1);
                }}
              >
                <option value="all">Toate stările</option>
                <option value="NOT_STARTED">Neîncepute</option>
                <option value="IN_PROGRESS">În desfășurare</option>
                <option value="FINISHED">Finalizate</option>
                <option value="SCHEDULED">Programate</option>
              </select>
              <select
                aria-label="Perioada atribuirii"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setAssignmentPage(1);
                }}
              >
                <option value="all">Orice perioadă</option>
                <option value="7">Ultimele 7 zile</option>
                <option value="30">Ultimele 30 zile</option>
                <option value="90">Ultimele 90 zile</option>
              </select>
              <button type="button" className="pt-a4-reset" onClick={reset}>
                <RotateCcw size={17} /> Resetează
              </button>
            </div>
            {assignmentError && (
              <div className="pt-error" role="alert">
                {assignmentError}
              </div>
            )}
            {assignmentLoading ? (
              <div className="pt-loading">Se încarcă atribuirile...</div>
            ) : (
              <div className="pt-a4-table-scroll">
                <table className="pt-a4-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Test</th>
                      <th>Tip atribuire</th>
                      <th>Destinatari</th>
                      <th>Data atribuirii</th>
                      <th>Valabilitate</th>
                      <th>Stare</th>
                      <th>Progres</th>
                      <th>Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item, index) => {
                      const s = statusOf(item);
                      const name =
                        item.full_name || item.username || item.target_label || "Destinatar";
                      const done = isFinished(s);
                      // Arată pornirea doar pentru atribuirea destinată contului autentificat.
                      // Backendul rămâne responsabil pentru autorizarea efectivă.
                      const ownAssignment =
                        user?.id != null &&
                        item.user_id != null &&
                        String(user.id) === String(item.user_id);
                      const canStartOwn = ownAssignment && !done && !isScheduled(s);
                      const progress = done ? 100 : isPending(s) || isScheduled(s) ? 0 : null;
                      return (
                        <tr
                          key={`${item.version_id}-${item.assignment_id}-${item.user_id}-${index}`}
                        >
                          <td>{(safePage - 1) * pageSize + index + 1}</td>
                          <td>
                            <div className="pt-a4-test">
                              <span className="pt-a4-test-icon">
                                <ShieldCheck size={19} />
                              </span>
                              <span>
                                <strong>{item.test_title || "Test"}</strong>
                                <small>{item.category || ""}</small>
                              </span>
                            </div>
                          </td>
                          <td>{labelType(item)}</td>
                          <td>
                            <strong>{name}</strong>
                          </td>
                          <td>
                            {typeof attemptDate === "function"
                              ? attemptDate(dateOf(item))
                              : fmt(dateOf(item))}
                          </td>
                          <td>
                            {validityOf(item)}
                          </td>
                          <td>
                            <span
                              className={`pt-a4-pill ${done ? "is-done" : isActive(s) ? "is-active" : isScheduled(s) ? "is-scheduled" : "is-pending"}`}
                            >
                              {done
                                ? "Finalizată"
                                : isActive(s)
                                  ? "În desfășurare"
                                  : isScheduled(s)
                                    ? "Programată"
                                    : isPending(s)
                                      ? "Neîncepută"
                                      : item.progress_status || "—"}
                            </span>
                          </td>
                          <td>
                            {progress == null ? (
                              <span className="pt-a4-muted">—</span>
                            ) : (
                              <div className="pt-a4-progress">
                                <span>{progress}%</span>
                                <div>
                                  <i style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                          <td>
                            {canStartOwn && typeof openAssignedTest === "function" && (
                              <button
                                type="button"
                                className="pt-a4-eye"
                                title="Susține testul atribuit contului tău"
                                aria-label={`Susține testul ${item.test_title || "profesional"}`}
                                disabled={startingId != null}
                                onClick={() => openAssignedTest(item)}
                              >
                                <Play size={19} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="pt-a4-eye"
                              title="Deschide atribuirea"
                              aria-label={`Deschide atribuirea pentru ${name}`}
                              onClick={() => goToEditor(item)}
                            >
                              <Eye size={19} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!visible.length && (
                      <tr>
                        <td colSpan={9} className="pt-a4-empty">
                          Nu există atribuiri pentru filtrele selectate.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="pt-a4-footer">
              <span>
                Afișează {visible.length ? (safePage - 1) * pageSize + 1 : 0} –{" "}
                {Math.min(safePage * pageSize, filtered.length)} din {filtered.length} destinatari
              </span>
              <nav aria-label="Paginarea atribuirilor">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setAssignmentPage(safePage - 1)}
                  aria-label="Pagina anterioară"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter(
                    (p) => pages <= 6 || p === 1 || p === pages || Math.abs(p - safePage) <= 1,
                  )
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={p === safePage ? "selected" : ""}
                      aria-current={p === safePage ? "page" : undefined}
                      onClick={() => setAssignmentPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  type="button"
                  disabled={safePage === pages}
                  onClick={() => setAssignmentPage(safePage + 1)}
                  aria-label="Pagina următoare"
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
            </footer>
          </section>
        </main>
        <aside className="pt-a4-side">
          <section className="pt-a4-side-card">
            <h3>
              <Zap size={22} /> Atribuire rapidă
            </h3>
            <p>Alege tipul atribuirii, apoi deschide configurarea testului.</p>
            <div className="pt-a4-quick">
              {[
                ["GROUP", "Către un grup"],
                ["USER", "Către utilizatori individuali"],
                ["ALL", "Către toți utilizatorii"],
              ].map(([v, l]) => (
                <label key={v} className={quickType === v ? "active" : ""}>
                  <input
                    type="radio"
                    name="quick-assign"
                    checked={quickType === v}
                    onChange={() => setQuickType(v)}
                  />
                  <Users size={19} />
                  {l}
                </label>
              ))}
            </div>
            <select
              ref={quickSelectRef}
              className="pt-a4-quick-select"
              value={quickTest}
              onChange={(e) => setQuickTest(e.target.value)}
              aria-label="Selectează testul pentru atribuire"
            >
              <option value="">Selectează testul</option>
              {quickOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              className="pt-a4-continue"
              type="button"
              onClick={startAssignment}
              disabled={!canManage || !quickTest}
            >
              Continuă <ArrowRight size={18} />
            </button>
            {quickNotice && (
              <p role="status" className="pt-a4-notice">
                {quickNotice}
              </p>
            )}
          </section>
          <section className="pt-a4-side-card">
            <h3>
              <BarChart3 size={22} /> Distribuția atribuirilor
            </h3>
            <div className="pt-a4-distribution">
              <div
                className="pt-a4-donut"
                style={{
                  "--active": `${activePct}%`,
                  "--scheduled": `${activePct + scheduledPct}%`,
                  "--complete": `${activePct + scheduledPct + finishedPct}%`,
                }}
              >
                <div>
                  <strong>{donutTotal}</strong>
                  <small>Atribuiri clasificate</small>
                </div>
              </div>
              <div className="pt-a4-legend">
                <div>
                  <i className="green" />
                  Active <strong>{summary.active}</strong>
                </div>
                <div>
                  <i className="blue" />
                  Programate <strong>{summary.scheduled}</strong>
                </div>
                <div>
                  <i className="gray" />
                  Finalizate <strong>{summary.finished}</strong>
                </div>
              </div>
            </div>
            <p className="pt-a4-footnote">Distribuția folosește stările existente în datele API.</p>
          </section>
          <section className="pt-a4-side-card">
            <h3>
              <Bell size={22} /> Notificări și status
            </h3>
            <p>
              Notificările la atribuire și expirare sunt gestionate de setările platformei. Starea
              lor nu este disponibilă în datele acestei componente.
            </p>
            <button
              type="button"
              className="pt-a4-secondary"
              onClick={() => typeof setTab === "function" && setTab("setari")}
            >
              Deschide setările <ArrowRight size={16} />
            </button>
          </section>
        </aside>
      </div>
      <p className="pt-assignments-note">
        Atribuirile către grupuri sau către toți utilizatorii pot apărea pe mai multe rânduri, câte
        unul pentru fiecare destinatar. API-ul limitează datele la 2.000 de destinatari pentru
        fiecare versiune.
      </p>
    </section>
  );
}
