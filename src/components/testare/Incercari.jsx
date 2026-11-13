import React, { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  Hourglass,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import "./Incercari.css";

const FINISHED = ["SUBMITTED", "EXPIRED", "FINISHED", "COMPLETED"];
const ACTIVE = ["STARTED", "IN_PROGRESS", "ACTIVE"];
const statusOf = (r) => String(r.status ?? r.attempt_status ?? "").toUpperCase();
const finished = (r) => FINISHED.includes(statusOf(r));
const active = (r) => ACTIVE.includes(statusOf(r));
const passedOf = (r) => {
  if (typeof r.passed === "boolean") return r.passed;
  if (typeof r.is_passed === "boolean") return r.is_passed;
  const v = String(r.result ?? "").toUpperCase();
  if (v === "PASSED") return true;
  if (v === "FAILED") return false;
  return null;
};
const percentOf = (r) => {
  const raw = r.percentage ?? r.score_percent;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
};
const nameOf = (r) => r.user_name_snapshot || r.full_name || r.username || "Utilizator";
const dateOf = (r) => r.started_at || r.created_at || r.submitted_at || null;
const timeLabel = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("ro-RO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
const durationOf = (r) => {
  const direct = r.duration_minutes ?? r.elapsed_minutes;
  if (direct != null && Number.isFinite(Number(direct))) return `${Math.round(Number(direct))} min`;
  if (r.started_at && (r.submitted_at || r.finished_at || r.completed_at)) {
    const ms = new Date(r.submitted_at || r.finished_at || r.completed_at) - new Date(r.started_at);
    if (Number.isFinite(ms) && ms >= 0) return `${Math.max(1, Math.round(ms / 60000))} min`;
  }
  return "—";
};
const Spark = ({ color = "blue" }) => (
  <svg className={`pt-ia-spark pt-ia-spark-${color}`} viewBox="0 0 66 35" aria-hidden="true">
    <path
      d="M1 28 C11 12 17 32 27 20 S39 8 45 13 S57 5 65 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M1 28 C11 12 17 32 27 20 S39 8 45 13 S57 5 65 3 V35 H1 Z"
      fill="currentColor"
      opacity=".08"
    />
  </svg>
);

export default function Incercari({ ctx }) {
  const { attemptRows = [], attemptLoading, attemptError, loadAttempts, navigate } = ctx;
  const [query, setQuery] = useState("");
  const [testFilter, setTestFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("30");
  const [page, setPage] = useState(1);
  const rows = Array.isArray(attemptRows) ? attemptRows : [];
  const summary = useMemo(() => {
    const evaluated = rows.filter((r) => finished(r) && passedOf(r) !== null);
    const passed = evaluated.filter((r) => passedOf(r) === true).length;
    const failed = evaluated.length - passed;
    const running = rows.filter(active).length;
    return {
      total: rows.length,
      passed,
      failed,
      running,
      unknown: rows.length - evaluated.length - running,
      rate: evaluated.length ? Math.round((passed * 100) / evaluated.length) : null,
    };
  }, [rows]);
  // Segmentele reprezintă toate încercările, fără valori fictive.
  // Ordinea corespunde legendei: promovate, nepromovate, active, neevaluate.
  const donutBackground = useMemo(() => {
    if (summary.total === 0) return "#e2e8f9";

    const segments = [
      [summary.passed, "#08a349"],
      [summary.failed, "#e65d19"],
      [summary.running, "#813cff"],
      [Math.max(0, summary.unknown), "#e2e8f9"],
    ];
    let cursor = 0;
    const stops = [];
    for (const [count, color] of segments) {
      if (count <= 0) continue;
      const start = (cursor / summary.total) * 100;
      cursor += count;
      const end = (cursor / summary.total) * 100;
      stops.push(`${color} ${start}% ${end}%`);
    }
    return `conic-gradient(from -90deg, ${stops.join(", ")})`;
  }, [summary]);

  const tests = useMemo(
    () =>
      [...new Set(rows.map((r) => r.test_title).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ro"),
      ),
    [rows],
  );
  const users = useMemo(
    () => [...new Set(rows.map(nameOf))].sort((a, b) => a.localeCompare(b, "ro")),
    [rows],
  );
  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          const text = `${nameOf(r)} ${r.test_title ?? ""} ${r.category ?? ""}`.toLocaleLowerCase(
            "ro",
          );
          if (!text.includes(query.trim().toLocaleLowerCase("ro"))) return false;
          if (testFilter !== "all" && r.test_title !== testFilter) return false;
          if (userFilter !== "all" && nameOf(r) !== userFilter) return false;
          if (resultFilter === "passed" && passedOf(r) !== true) return false;
          if (resultFilter === "failed" && passedOf(r) !== false) return false;
          if (resultFilter === "active" && !active(r)) return false;
          if (resultFilter === "finished" && !finished(r)) return false;
          if (periodFilter !== "all") {
            const date = dateOf(r);
            if (!date || Number.isNaN(new Date(date).getTime())) return false;
            const diff = Date.now() - new Date(date).getTime();
            if (diff < 0 || diff > Number(periodFilter) * 86400000) return false;
          }
          return true;
        })
        .sort((a, b) => new Date(dateOf(b) || 0) - new Date(dateOf(a) || 0)),
    [rows, query, testFilter, userFilter, resultFilter, periodFilter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * 6, safePage * 6);
  const recent = useMemo(
    () => [...rows].sort((a, b) => new Date(dateOf(b) || 0) - new Date(dateOf(a) || 0)).slice(0, 4),
    [rows],
  );
  const reset = () => {
    setQuery("");
    setTestFilter("all");
    setUserFilter("all");
    setResultFilter("all");
    setPeriodFilter("30");
    setPage(1);
  };
  const open = (r) => {
    const id = r.attempt_id ?? r.id;
    if (id == null) return;

    const encodedId = encodeURIComponent(id);

    if (finished(r)) {
      navigate(`/testare/incercari/${encodedId}/revizuire-manager`);
      return;
    }

    navigate(`/testare/incercari/${encodedId}`);
  };
  const cards = [
    { title: "Total încercări", value: summary.total, icon: ClipboardCheck, color: "blue" },
    {
      title: "Promovate",
      value: summary.passed,
      icon: CheckCircle2,
      color: "green",
      extra: summary.rate == null ? null : `${summary.rate}%`,
    },
    {
      title: "Nepromovate",
      value: summary.failed,
      icon: XCircle,
      color: "red",
      extra: summary.rate == null ? null : `${100 - summary.rate}%`,
    },
    { title: "În desfășurare", value: summary.running, icon: Hourglass, color: "purple" },
  ];
  return (
    <div className="pt-ia-page">
      <div className="pt-ia-layout">
        <main className="pt-ia-main">
          <section className="pt-ia-panel pt-ia-overview">
            <div className="pt-ia-heading">
              <span className="pt-ia-heading-icon">
                <Activity size={24} />
              </span>
              <div>
                <h2>Încercări</h2>
                <p>Toate încercările de susținere a testelor de către utilizatori</p>
              </div>
            </div>
            <div className="pt-ia-stats">
              {cards.map(({ title, value, icon: Icon, color, extra }) => (
                <div className={`pt-ia-stat pt-ia-${color}`} key={title}>
                  <span className="pt-ia-stat-icon">
                    <Icon size={27} />
                  </span>
                  <div className="pt-ia-stat-copy">
                    <span>{title}</span>
                    <div className="pt-ia-stat-number">
                      <strong>{value}</strong>
                      {extra && <em>{extra}</em>}
                    </div>
                  </div>
                  <Spark color={color} />
                </div>
              ))}
            </div>
          </section>
          <section className="pt-ia-panel pt-ia-data">
            <div className="pt-ia-filters">
              <label className="pt-ia-search">
                <Search size={19} />
                <input
                  aria-label="Caută încercări"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Caută după utilizator, test sau categorie..."
                />
              </label>
              <select
                aria-label="Filtrează după test"
                value={testFilter}
                onChange={(e) => {
                  setTestFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Toate testele</option>
                {tests.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrează după utilizator"
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Toți utilizatorii</option>
                {users.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrează după rezultat"
                value={resultFilter}
                onChange={(e) => {
                  setResultFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Toate rezultatele</option>
                <option value="passed">Promovate</option>
                <option value="failed">Nepromovate</option>
                <option value="active">În desfășurare</option>
                <option value="finished">Finalizate</option>
              </select>
              <select
                aria-label="Filtrează după perioadă"
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="7">Ultimele 7 zile</option>
                <option value="30">Ultimele 30 zile</option>
                <option value="90">Ultimele 90 zile</option>
                <option value="all">Orice perioadă</option>
              </select>
              <button className="pt-ia-reset" type="button" onClick={reset}>
                <RotateCcw size={17} /> Resetează
              </button>
            </div>
            {attemptError && (
              <div className="pt-error" role="alert">
                {attemptError}
              </div>
            )}
            {attemptLoading ? (
              <div className="pt-loading">
                <span className="pt-spinner" /> Se încarcă încercările...
              </div>
            ) : (
              <>
                <div className="pt-ia-table-scroll">
                  <table className="pt-ia-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Utilizator</th>
                        <th>Test</th>
                        <th>Data începerii</th>
                        <th>Durată</th>
                        <th>Scor</th>
                        <th>Rezultat</th>
                        <th>Status</th>
                        <th>Acțiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r, i) => {
                        const p = passedOf(r);
                        const score = percentOf(r);
                        return (
                          <tr key={`${r.version_id ?? "v"}-${r.attempt_id ?? r.id ?? i}`}>
                            <td>{(safePage - 1) * 6 + i + 1}</td>
                            <td>
                              <div className="pt-ia-person">
                                <span className="pt-ia-avatar">{initials(nameOf(r))}</span>
                                <strong>{nameOf(r)}</strong>
                              </div>
                            </td>
                            <td>
                              <strong>{r.test_title || "Test profesional"}</strong>
                              {r.category && <small className="pt-ia-category">{r.category}</small>}
                            </td>
                            <td>
                              <span className="pt-ia-nowrap">
                                <CalendarDays size={15} /> {timeLabel(dateOf(r))}
                              </span>
                            </td>
                            <td>
                              <span className="pt-ia-nowrap">
                                <Clock3 size={15} /> {durationOf(r)}
                              </span>
                            </td>
                            <td>
                              <strong>{score == null ? "—" : `${score}%`}</strong>
                            </td>
                            <td>
                              <span
                                className={`pt-ia-pill ${p === true ? "pt-ia-pill-green" : p === false ? "pt-ia-pill-red" : active(r) ? "pt-ia-pill-blue" : "pt-ia-pill-neutral"}`}
                              >
                                {p === true
                                  ? "✓ Promovat"
                                  : p === false
                                    ? "✕ Nepromovat"
                                    : active(r)
                                      ? "În desfășurare"
                                      : "Neevaluat"}
                              </span>
                            </td>
                            <td>
                              <span className="pt-ia-pill pt-ia-pill-neutral">
                                {active(r)
                                  ? "Activă"
                                  : finished(r)
                                    ? "Finalizată"
                                    : statusOf(r) || "—"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="pt-ia-view"
                                title="Vezi încercarea"
                                aria-label={`Vezi încercarea: ${nameOf(r)}`}
                                disabled={(r.attempt_id ?? r.id) == null}
                                onClick={() => open(r)}
                              >
                                <Eye size={19} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!visible.length && (
                    <div className="pt-ia-empty">
                      Nu există încercări pentru filtrele selectate.
                    </div>
                  )}
                </div>
                <div className="pt-ia-footer">
                  <span>
                    Afișează {visible.length ? (safePage - 1) * 6 + 1 : 0} –{" "}
                    {Math.min(safePage * 6, filtered.length)} din {filtered.length} încercări
                  </span>
                  <div className="pt-ia-pages">
                    <button
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                      aria-label="Pagina precedentă"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1)
                      .filter(
                        (n) => pages <= 6 || n === 1 || n === pages || Math.abs(n - safePage) <= 1,
                      )
                      .map((n, i, arr) => (
                        <React.Fragment key={n}>
                          {i > 0 && n - arr[i - 1] > 1 && <span>…</span>}
                          <button
                            className={n === safePage ? "active" : ""}
                            onClick={() => setPage(n)}
                            aria-label={`Pagina ${n}`}
                            aria-current={n === safePage ? "page" : undefined}
                          >
                            {n}
                          </button>
                        </React.Fragment>
                      ))}
                    <button
                      disabled={safePage >= pages}
                      onClick={() => setPage(safePage + 1)}
                      aria-label="Pagina următoare"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </main>
        <aside className="pt-ia-aside">
          <section className="pt-ia-panel pt-ia-results">
            <h3>
              <BarChart3 size={23} /> Rezultate încercări
            </h3>
            <div className="pt-ia-result-body">
              <div
                className="pt-ia-donut"
                style={{
                  backgroundImage: summary.total > 0 ? donutBackground : "none",
                  backgroundColor: summary.total > 0 ? "transparent" : donutBackground,
                }}
                role="img"
                aria-label={`Rezultate: ${summary.passed} promovate, ${summary.failed} nepromovate, ${summary.running} în desfășurare${summary.unknown ? `, ${summary.unknown} neevaluate` : ""}. Rată de promovare: ${summary.rate == null ? "indisponibilă" : `${summary.rate}%`}.`}
              >
                <div>
                  <strong>{summary.rate == null ? "—" : `${summary.rate}%`}</strong>
                  <small>Rată de promovare</small>
                </div>
              </div>
              <div className="pt-ia-legend">
                <p>
                  <i className="green" />
                  Promovate <strong>{summary.passed}</strong>
                </p>
                <p>
                  <i className="red" />
                  Nepromovate <strong>{summary.failed}</strong>
                </p>
                <p>
                  <i className="purple" />
                  În desfășurare <strong>{summary.running}</strong>
                </p>
                <p className="total">
                  Total încercări <strong>{summary.total}</strong>
                </p>
              </div>
            </div>
            {summary.unknown > 0 && (
              <p className="pt-ia-note">
                {summary.unknown} încercări fără rezultat de promovare confirmat.
              </p>
            )}
          </section>
          <section className="pt-ia-panel pt-ia-activity">
            <h3>
              <Clock3 size={23} /> Activitate recentă
            </h3>
            {recent.length ? (
              recent.map((r, i) => {
                const p = passedOf(r);
                return (
                  <button
                    key={`${r.version_id ?? "v"}-${r.attempt_id ?? r.id ?? i}`}
                    className="pt-ia-activity-row"
                    onClick={() => open(r)}
                    disabled={(r.attempt_id ?? r.id) == null}
                  >
                    <span
                      className={`pt-ia-activity-icon ${p === true ? "green" : p === false ? "red" : "purple"}`}
                    >
                      {p === true ? (
                        <Check size={19} />
                      ) : p === false ? (
                        <XCircle size={19} />
                      ) : (
                        <Hourglass size={19} />
                      )}
                    </span>
                    <span className="pt-ia-activity-copy">
                      <strong>{nameOf(r)}</strong>{" "}
                      {active(r) ? "a început testul" : "a susținut testul"}
                      <small>{r.test_title || "Test profesional"}</small>
                    </span>
                    <time>{timeLabel(dateOf(r))}</time>
                  </button>
                );
              })
            ) : (
              <p className="pt-ia-note">Nu există activitate înregistrată.</p>
            )}
            <button
              type="button"
              className="pt-ia-all"
              onClick={() => {
                reset();
                document
                  .querySelector(".pt-ia-data")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Vezi toate încercările →
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
