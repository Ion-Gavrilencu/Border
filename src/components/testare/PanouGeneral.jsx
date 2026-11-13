import React, { useMemo, useState } from "react";
import {
  Plus,
  ArrowRight,
  Eye,
  Pencil,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  Search,
  Users,
  BarChart3,
  CalendarDays,
  Layers3,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Activity,
  ClipboardCheck,
  Award,
  Play,
  ShieldCheck,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownUp,
  Check,
} from "lucide-react";
import "./PanouGeneral.css";

const normalize = (value) => String(value ?? "").toLocaleLowerCase("ro-RO");
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
const dateOf = (item) =>
  item?.updated_at ?? item?.created_at ?? item?.finished_at ?? item?.completed_at ?? null;
const dateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("ro-RO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const statusOf = (item) => normalize(item.status ?? item.version_status).toUpperCase();
const statusMeta = (item) => {
  const s = statusOf(item);
  if (["PUBLISHED", "ACTIVE", "ACTIV"].includes(s))
    return { label: "Activ", cls: "active", Icon: Play };
  if (["SCHEDULED", "PROGRAMAT"].includes(s))
    return { label: "Programat", cls: "scheduled", Icon: CalendarDays };
  if (["FINISHED", "COMPLETED", "CLOSED", "FINALIZAT"].includes(s))
    return { label: "Finalizat", cls: "finished", Icon: Check };
  if (s === "DRAFT" || s === "CIORNĂ") return { label: "Ciornă", cls: "draft", Icon: null };
  return { label: item.status ?? item.version_status ?? "Necunoscut", cls: "draft", Icon: null };
};
const percentOf = (item) => {
  const value = number(item.score_percent ?? item.percentage ?? item.percent);
  return value == null ? null : Math.max(0, Math.min(100, value));
};

export default function PanouGeneral({ ctx }) {
  const {
    canManage,
    setTab,
    dashboardSearch,
    setDashboardSearch,
    dashboardPage,
    setDashboardPage,
    filteredDashboardTests = [],
    results = [],
    managed = [],
    attemptRows = [],
    passRate,
    knownPasses,
    passedResults = [],
    completedResults = [],
    setShowCreate,
    openEditor,
    openFinishedAttempt,
    versionIdOf,
  } = ctx;
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [menuId, setMenuId] = useState(null);

  const allTests = Array.isArray(managed) ? managed : [];
  const categories = useMemo(
    () =>
      [...new Set(allTests.map((t) => String(t.category_name ?? t.category ?? "General")))].sort(),
    [managed],
  );
  const tests = useMemo(() => {
    const base = Array.isArray(filteredDashboardTests) ? filteredDashboardTests : [];
    return base
      .filter(
        (item) =>
          (category === "all" ||
            String(item.category_name ?? item.category ?? "General") === category) &&
          (status === "all" || statusMeta(item).cls === status),
      )
      .sort((a, b) => {
        if (sort === "title")
          return String(a.title ?? a.test_title ?? "").localeCompare(
            String(b.title ?? b.test_title ?? ""),
            "ro",
          );
        const aa = new Date(dateOf(a) ?? 0).getTime() || 0;
        const bb = new Date(dateOf(b) ?? 0).getTime() || 0;
        return sort === "oldest" ? aa - bb : bb - aa;
      });
  }, [filteredDashboardTests, category, status, sort]);
  const pages = Math.max(1, Math.ceil(tests.length / 4));
  const page = Math.max(1, Math.min(dashboardPage, pages));
  const visible = tests.slice((page - 1) * 4, page * 4);
  // Preferăm totalurile furnizate de API; rezultatele personale pot fi incomplete.
  const attemptsByVersion = useMemo(() => {
    const counts = new Map();
    const rows = Array.isArray(attemptRows) ? attemptRows : [];
    for (const row of rows) {
      const id = row.version_id ?? row.test_version_id ?? row.versionId;
      if (id == null) continue;
      const key = String(id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [attemptRows]);
  const attemptCountFor = (item) => {
    const direct = item.attempt_count ?? item.attempts_count ?? item.total_attempts;
    if (direct != null && Number.isFinite(Number(direct))) return Number(direct);
    const id = versionIdOf(item);
    if (id == null) return "—";
    // Numărul din attemptRows este utilizabil numai dacă lista este completă.
    if (ctx.attemptRowsComplete === true) return attemptsByVersion.get(String(id)) ?? 0;
    return "—";
  };
  const activeCount = allTests.filter((item) => statusMeta(item).cls === "active").length;
  const attemptsCount =
    Array.isArray(attemptRows) && attemptRows.length ? attemptRows.length : results.length;
  const rate =
    knownPasses && Number.isFinite(Number(passRate))
      ? Math.max(0, Math.min(100, Number(passRate)))
      : null;
  const recent = [...(Array.isArray(results) ? results : [])]
    .sort(
      (a, b) =>
        (new Date(dateOf(b) ?? 0).getTime() || 0) - (new Date(dateOf(a) ?? 0).getTime() || 0),
    )
    .slice(0, 4);
  // Graficul reprezintă distribuția rezultatelor finalizate, nu doar un indicator de progres.
  // Nu presupunem promovarea când API-ul nu oferă această informație.
  const totalCompleted = Array.isArray(completedResults) ? completedResults.length : 0;
  const passedCount = knownPasses
    ? Math.min(totalCompleted, Array.isArray(passedResults) ? passedResults.length : 0)
    : null;
  const failedCount = passedCount == null ? null : Math.max(0, totalCompleted - passedCount);
  const chartRate =
    passedCount != null && totalCompleted > 0 ? (passedCount / totalCompleted) * 100 : null;
  // Stil inline: evită suprascrierea gradientului de către alte fișiere CSS.
  const donutBackground =
    chartRate == null
      ? "#e3e8f7"
      : `conic-gradient(from -90deg, #08a349 0% ${chartRate}%, #e65d19 ${chartRate}% 100%)`;
  const stats = [
    { label: "Teste totale", value: allTests.length, Icon: Layers3, theme: "blue" },
    { label: "Teste active", value: activeCount, Icon: Users, theme: "violet" },
    { label: "Încercări înregistrate", value: attemptsCount, Icon: ClipboardCheck, theme: "cyan" },
    {
      label: "Rată de promovare",
      value: rate == null ? "—" : `${Math.round(rate)}%`,
      Icon: Award,
      theme: "purple",
    },
  ];
  const goPage = (next) => {
    setDashboardPage(Math.max(1, Math.min(pages, next)));
    setMenuId(null);
  };
  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setDashboardPage(1);
  };

  return (
    <div className="pt-dashboard pt-dashboard-premium">
      <div className="pt-dashboard-stats">
        {stats.map(({ label, value, Icon, theme }) => (
          <div className={`pt-dashboard-stat pt-ds-${theme}`} key={label}>
            <span className="pt-dashboard-stat-icon">
              <Icon size={29} strokeWidth={2.2} />
            </span>
            <div className="pt-stat-copy">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            {theme === "purple" ? (
              <span className="pt-stat-round-arrow">
                <ArrowUpRight size={23} />
              </span>
            ) : (
              <svg className="pt-stat-sparkline" viewBox="0 0 90 38" aria-hidden="true">
                <path d="M2 29 C14 16 22 35 34 20 S52 7 60 12 S75 5 88 3" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div className="pt-dashboard-grid">
        <div className="pt-dashboard-main">
          <section className="pt-dashboard-card pt-dashboard-create">
            <div className="pt-dashboard-section-title">
              <span className="pt-dashboard-section-icon">
                <Plus size={27} />
              </span>
              <div>
                <h2>Creează un test nou</h2>
                <p>Adaugă un test, definește întrebările și configurează regulile de evaluare.</p>
              </div>
            </div>
            {canManage && (
              <button
                type="button"
                className="pt-button pt-button-primary pt-create-action"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={19} /> Creează test
              </button>
            )}
            <div className="pt-dashboard-steps">
              {[
                ["1. Detalii test", "Titlu, descriere, categorie", FileCheck2],
                ["2. Întrebări", "Adaugă sau importă întrebări", ListChecks],
                ["3. Atribuire", "Selectează destinatarii", Users],
                ["4. Publicare", "Activează testul", Play],
              ].map(([name, detail, Icon], index) => (
                <div className="pt-dashboard-step" key={name}>
                  <span>
                    <Icon size={25} />
                  </span>
                  <b>{name}</b>
                  <small>{detail}</small>
                  {index < 3 && <ChevronRight className="pt-dashboard-step-arrow" size={22} />}
                </div>
              ))}
            </div>
          </section>

          <section className="pt-dashboard-card pt-suite-card">
            <div className="pt-dashboard-section-title">
              <Layers3 className="pt-section-blue" size={27} />
              <div>
                <h2>Suita de teste</h2>
                <p>Testele create și administrate în platformă</p>
              </div>
            </div>
            <div className="pt-dashboard-filters">
              <label className="pt-dashboard-search">
                <Search size={20} />
                <input
                  value={dashboardSearch}
                  onChange={(e) => {
                    setDashboardSearch(e.target.value);
                    setDashboardPage(1);
                  }}
                  placeholder="Caută test după titlu, categorie..."
                  aria-label="Caută teste"
                />
              </label>
              <label className="pt-filter-select">
                <LayoutDashboard size={17} />
                <select
                  value={category}
                  onChange={changeFilter(setCategory)}
                  aria-label="Filtrează după categorie"
                >
                  <option value="all">Toate categoriile</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronRight size={16} />
              </label>
              <label className="pt-filter-select">
                <Activity size={17} />
                <select
                  value={status}
                  onChange={changeFilter(setStatus)}
                  aria-label="Filtrează după stare"
                >
                  <option value="all">Toate stările</option>
                  <option value="active">Active</option>
                  <option value="draft">Ciorne</option>
                  <option value="scheduled">Programate</option>
                  <option value="finished">Finalizate</option>
                </select>
                <ChevronRight size={16} />
              </label>
              <label className="pt-filter-select">
                <ArrowDownUp size={17} />
                <select value={sort} onChange={changeFilter(setSort)} aria-label="Sortează testele">
                  <option value="newest">Mai noi</option>
                  <option value="oldest">Mai vechi</option>
                  <option value="title">Titlu A–Z</option>
                </select>
                <ChevronRight size={16} />
              </label>
            </div>
            <div className="pt-dashboard-table-wrap">
              <table className="pt-dashboard-table">
                <thead>
                  <tr>
                    <th>Titlu test</th>
                    <th>Categorie</th>
                    <th>Întrebări</th>
                    <th>Durată</th>
                    <th>Încercări</th>
                    <th>Stare</th>
                    <th>Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item, index) => {
                    const s = statusMeta(item);
                    const testKey = item.id ?? item.version_id ?? `${page}-${index}`;
                    const cat = String(item.category_name ?? item.category ?? "General");
                    return (
                      <tr key={testKey}>
                        <td>
                          <div className="pt-test-title-cell">
                            <span className="pt-test-row-icon">
                              <ShieldCheck size={20} />
                            </span>
                            <span>
                              <strong>{item.title ?? item.test_title ?? "Test fără titlu"}</strong>
                              <small>
                                {dateOf(item)
                                  ? `Actualizat: ${dateLabel(dateOf(item))}`
                                  : item.description || ""}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`pt-category-chip pt-category-${normalize(cat).includes("legis") ? "blue" : normalize(cat).includes("manage") ? "violet" : "neutral"}`}
                          >
                            {cat}
                          </span>
                        </td>
                        <td>{item.question_count ?? item.questions_count ?? "—"}</td>
                        <td>
                          {item.duration_minutes != null ? `${item.duration_minutes} min` : "—"}
                        </td>
                        <td>{attemptCountFor(item)}</td>
                        <td>
                          <span className={`pt-dashboard-status pt-status-${s.cls}`}>
                            {s.Icon && (
                              <s.Icon
                                size={13}
                                fill={s.cls === "active" ? "currentColor" : "none"}
                              />
                            )}
                            {s.label}
                          </span>
                        </td>
                        <td>
                          <div className="pt-row-actions">
                            <button
                              type="button"
                              className="pt-dashboard-view"
                              onClick={() => openEditor(item)}
                              disabled={versionIdOf(item) == null}
                              title="Deschide testul"
                              aria-label="Deschide testul"
                            >
                              <Eye size={19} />
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                className="pt-dashboard-view"
                                onClick={() => setMenuId(menuId === testKey ? null : testKey)}
                                title="Mai multe acțiuni"
                                aria-label="Mai multe acțiuni"
                              >
                                <MoreHorizontal size={21} />
                              </button>
                            )}
                            {menuId === testKey && canManage && (
                              <div className="pt-row-menu">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuId(null);
                                    openEditor(item);
                                  }}
                                  disabled={versionIdOf(item) == null}
                                >
                                  <Pencil size={15} /> Editează
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visible.length && (
                <div className="pt-empty">Nu există teste pentru filtrele selectate.</div>
              )}
            </div>
            <div className="pt-dashboard-footer">
              <span>
                Afișează {visible.length ? (page - 1) * 4 + 1 : 0} –{" "}
                {Math.min(page * 4, tests.length)} din {tests.length} teste
              </span>
              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                  aria-label="Pagina precedentă"
                >
                  <ChevronLeft size={19} />
                </button>
                {Array.from(
                  { length: Math.min(pages, 5) },
                  (_, i) => Math.max(1, Math.min(pages - 4, page - 2)) + i,
                )
                  .filter((p) => p <= pages)
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={page === p ? "pt-page-current" : ""}
                      onClick={() => goPage(p)}
                      aria-label={`Pagina ${p}`}
                      aria-current={page === p ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => goPage(page + 1)}
                  aria-label="Pagina următoare"
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>
          </section>
        </div>
        <aside className="pt-dashboard-aside">
          <section className="pt-dashboard-card pt-recent-card">
            <div className="pt-dashboard-section-title">
              <Clock3 className="pt-section-blue" size={25} />
              <h2>Încercări recente</h2>
              <button type="button" className="pt-aside-link" onClick={() => setTab("attempts")}>
                Vezi toate <ArrowRight size={17} />
              </button>
            </div>
            {recent.map((item, index) => {
              const score = percentOf(item);
              const displayName =
                item.user_name ??
                item.full_name ??
                item.student_name ??
                item.assignee_name ??
                item.employee_name ??
                null;
              return (
                <button
                  className="pt-dashboard-recent"
                  type="button"
                  key={item.attempt_id ?? item.id ?? index}
                  onClick={() => openFinishedAttempt(item)}
                >
                  <span className="pt-dashboard-recent-icon">
                    <Users size={19} />
                  </span>
                  <span className="pt-recent-text">
                    <strong>
                      {displayName || item.test_title || item.title || "Test profesional"}
                    </strong>
                    <small>
                      {displayName
                        ? (item.test_title ?? item.title ?? "Test profesional")
                        : item.grade != null
                          ? `Nota: ${item.grade}`
                          : "Rezultat personal"}
                    </small>
                  </span>
                  {score != null && (
                    <span
                      className={`pt-score-pill ${score >= 80 ? "pt-score-good" : score >= 70 ? "pt-score-mid" : "pt-score-low"}`}
                    >
                      {Math.round(score)}%
                    </span>
                  )}
                  <time>
                    {dateOf(item)
                      ? new Date(dateOf(item)).toLocaleDateString("ro-RO", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : ""}
                  </time>
                </button>
              );
            })}
            {!recent.length && (
              <p className="pt-dashboard-muted">Nu există încă rezultate personale.</p>
            )}
            <button type="button" className="pt-dashboard-all" onClick={() => setTab("results")}>
              Vezi rezultatele mele <ArrowRight size={17} />
            </button>
          </section>
          <section className="pt-dashboard-card pt-results-card">
            <div className="pt-dashboard-section-title">
              <BarChart3 className="pt-section-blue" size={26} />
              <h2>Statistici rezultate</h2>
            </div>
            <div className="pt-dashboard-rate">
              <div
                className={`pt-dashboard-donut ${chartRate == null ? "pt-donut-empty" : ""}`}
                style={{
                  "--pt-rate": `${chartRate ?? 0}%`,
                  backgroundImage: chartRate == null ? "none" : donutBackground,
                  backgroundColor: chartRate == null ? donutBackground : "transparent",
                }}
              >
                <strong>{chartRate == null ? "—" : `${Math.round(chartRate)}%`}</strong>
                <small>
                  Rată de
                  <br />
                  promovare
                </small>
              </div>
              <div className="pt-results-legend">
                <p>
                  <span className="pt-legend-dot pt-dot-green" />
                  Promovați <strong>{passedCount ?? "—"}</strong>
                </p>
                <p>
                  <span className="pt-legend-dot pt-dot-orange" />
                  Nepromovați <strong>{failedCount ?? "—"}</strong>
                </p>
                <p>
                  <span className="pt-legend-dot pt-dot-purple" />
                  Finalizate <strong>{totalCompleted}</strong>
                </p>
                <p className="pt-legend-total">
                  <span className="pt-legend-dot pt-dot-slate" />
                  Total rezultate <strong>{results.length}</strong>
                </p>
              </div>
            </div>
            {!knownPasses && (
              <p className="pt-dashboard-muted">
                Rata de promovare va apărea când API-ul va furniza rezultate explicite de promovare.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
