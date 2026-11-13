import React, { useMemo, useState } from "react";
import {
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  Award,
  Search,
  BarChart3,
  Target,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Printer,
  CalendarDays,
  Clock3,
  MoreHorizontal,
  RotateCcw,
  Medal,
  FileSpreadsheet,
  Filter,
  ChevronDown,
} from "lucide-react";
import "./Rezultate.css";

const PAGE_SIZE = 6;
const num = (value) =>
  value === null || value === undefined || value === ""
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;
const dateOf = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const verdictOf = (r) => {
  const v = r.passed ?? r.is_passed;
  if (v === true || v === 1 || v === "true") return true;
  if (v === false || v === 0 || v === "false") return false;
  return null;
};
const scoreOf = (r) => num(r.percentage ?? r.score_percent);
const gradeOf = (r) => num(r.grade);
const titleOf = (r) => r.test_title || r.title || "Test fără titlu";
const userOf = (r) => r.user_name_snapshot || r.full_name || r.username || "Utilizator";
const initialsOf = (s) =>
  String(s)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("") || "U";
const dateText = (value) => {
  const d = dateOf(value);
  return d
    ? d.toLocaleString("ro-RO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
};
const endDate = (r) => r.submitted_at ?? r.finished_at ?? r.completed_at ?? r.started_at;
const durationOf = (r) => {
  const seconds = num(r.duration_seconds);
  if (seconds != null) return `${Math.round(seconds / 60)} min`;
  const direct = num(r.duration_minutes ?? r.duration_min);
  if (direct != null) return `${Math.round(direct)} min`;
  const start = dateOf(r.started_at),
    end = dateOf(r.submitted_at ?? r.finished_at ?? r.completed_at);
  if (!start || !end || end < start) return "—";
  return `${Math.max(0, Math.round((end - start) / 60000))} min`;
};
const categoryOf = (r, tests) => {
  const found = tests.find(
    (t) => String(t.version_id ?? t.current_version_id ?? t.id) === String(r.version_id),
  );
  return r.category_name || r.category || found?.category_name || found?.category || null;
};
const csvCell = (v) =>
  `"${String(v ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replace(/"/g, '""')}"`;
const statWave = (
  <svg className="pt-r-wave" viewBox="0 0 76 35" aria-hidden="true">
    <path
      d="M1 28 C12 10 18 32 29 20 S44 7 53 12 S65 7 75 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export default function Rezultate({ ctx }) {
  const {
    managed = [],
    reportRows = [],
    attemptLoading = false,
    attemptError,
    loadAttempts,
    openEditor,
    openFinishedAttempt,
    versionIdOf,
  } = ctx;
  const [search, setSearch] = useState("");
  const [test, setTest] = useState("all");
  const [group, setGroup] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const [showReports, setShowReports] = useState(false);
  const tests = Array.isArray(managed) ? managed : [];
  const rows = Array.isArray(reportRows) ? reportRows : [];
  const testOptions = useMemo(
    () => Array.from(new Set(rows.map(titleOf))).sort((a, b) => a.localeCompare(b, "ro")),
    [rows],
  );
  const groupOf = (r) => r.group_name || r.target_label || r.group_label || null;
  const groupOptions = useMemo(
    () =>
      Array.from(new Set(rows.map(groupOf).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ro"),
      ),
    [rows],
  );
  const reset = () => {
    setSearch("");
    setTest("all");
    setGroup("all");
    setVerdict("all");
    setPeriod("all");
    setPage(1);
  };
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = search.trim().toLocaleLowerCase("ro");
        if (
          q &&
          ![userOf(r), titleOf(r), categoryOf(r, tests) || "", groupOf(r) || ""].some((v) =>
            String(v).toLocaleLowerCase("ro").includes(q),
          )
        )
          return false;
        if (test !== "all" && titleOf(r) !== test) return false;
        if (group !== "all" && groupOf(r) !== group) return false;
        if (verdict === "passed" && verdictOf(r) !== true) return false;
        if (verdict === "failed" && verdictOf(r) !== false) return false;
        if (verdict === "unknown" && verdictOf(r) !== null) return false;
        if (period !== "all") {
          const d = dateOf(endDate(r));
          if (!d) return false;
          const now = new Date();
          const from = new Date(now);
          from.setDate(now.getDate() - Number(period));
          if (d < from || d > now) return false;
        }
        return true;
      }),
    [rows, search, test, group, verdict, period, tests],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const evaluated = filtered.filter((r) => verdictOf(r) !== null);
  const passed = evaluated.filter((r) => verdictOf(r) === true).length;
  const failed = evaluated.length - passed;
  const rate = evaluated.length ? Math.round((passed / evaluated.length) * 100) : null;
  const grades = filtered.map(gradeOf).filter((v) => v != null);
  const average = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
  const formatGrade = (v) =>
    v == null
      ? "—"
      : v.toLocaleString("ro-RO", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const gradeBuckets = [0, 0, 0, 0, 0];
  grades.forEach((n) => {
    gradeBuckets[n < 5 ? 0 : n < 7 ? 1 : n < 8 ? 2 : n < 9 ? 3 : 4]++;
  });
  const maxBucket = Math.max(1, ...gradeBuckets);
  const top = filtered
    .filter((r) => gradeOf(r) != null)
    .sort((a, b) => gradeOf(b) - gradeOf(a))
    .slice(0, 3);
  const exportCsv = () => {
    const header = [
      "Utilizator",
      "Test",
      "Categorie",
      "Data finalizării",
      "Durată",
      "Scor (%)",
      "Notă",
      "Rezultat",
    ];
    const body = filtered.map((r) => [
      userOf(r),
      titleOf(r),
      categoryOf(r, tests) || "",
      dateText(endDate(r)),
      durationOf(r),
      scoreOf(r) ?? "",
      gradeOf(r) ?? "",
      verdictOf(r) === true ? "Promovat" : verdictOf(r) === false ? "Nepromovat" : "Neevaluat",
    ]);
    const csv =
      "\uFEFF" + [header, ...body].map((line) => line.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "BORDER-rezultate.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openRow = (r) => {
    if (typeof openFinishedAttempt === "function") openFinishedAttempt(r);
    else if (typeof openEditor === "function") openEditor(r);
  };
  const statCards = [
    { label: "Participanți", value: filtered.length, icon: Users, color: "blue" },
    {
      label: "Promovați",
      value: passed,
      icon: CheckCircle2,
      color: "green",
      sub: rate == null ? null : `${rate}%`,
    },
    {
      label: "Nepromovați",
      value: failed,
      icon: XCircle,
      color: "red",
      sub: rate == null ? null : `${100 - rate}%`,
    },
    {
      label: "Nota medie",
      value: average == null ? "—" : formatGrade(average),
      icon: Award,
      color: "purple",
    },
  ];
  return (
    <div className="pt-reports-page">
      <div className="pt-reports-layout">
        <main className="pt-reports-main">
          <section className="pt-reports-panel pt-reports-overview">
            <div className="pt-reports-heading">
              <div className="pt-reports-heading-left">
                <span className="pt-reports-heading-icon">
                  <Trophy size={25} />
                </span>
                <div>
                  <h2>Rezultate</h2>
                  <p>Vizualizează și analizează rezultatele testelor finalizate</p>
                </div>
              </div>
              <div className="pt-reports-actions">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="pt-r-button"
                  title="Export CSV compatibil Excel"
                >
                  <Download size={17} /> Exportă (Excel/CSV)
                </button>
                <button type="button" onClick={() => window.print()} className="pt-r-button">
                  <Printer size={17} /> PDF
                </button>
                <div className="pt-r-report-menu">
                  <button
                    type="button"
                    className="pt-r-button"
                    onClick={() => setShowReports((v) => !v)}
                    aria-expanded={showReports}
                  >
                    <BarChart3 size={17} /> Rapoarte <ChevronDown size={15} />
                  </button>
                  {showReports && (
                    <div className="pt-r-menu">
                      <button
                        onClick={() => {
                          setShowReports(false);
                          exportCsv();
                        }}
                      >
                        Exportă rezultatele filtrate
                      </button>
                      <button
                        onClick={() => {
                          setShowReports(false);
                          window.print();
                        }}
                      >
                        Tipărește / Salvează PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="pt-reports-stats">
              {statCards.map(({ label, value, icon: Icon, color, sub }) => (
                <div className={`pt-r-stat pt-r-${color}`} key={label}>
                  <span className="pt-r-stat-icon">
                    <Icon size={29} />
                  </span>
                  <div className="pt-r-stat-body">
                    <span>{label}</span>
                    <div className="pt-r-stat-number">
                      <strong>{value}</strong>
                      {sub && <em>{sub}</em>}
                    </div>
                  </div>
                  {statWave}
                </div>
              ))}
            </div>
          </section>
          <section className="pt-reports-panel pt-reports-data">
            <div className="pt-reports-filters">
              <label className="pt-r-search">
                <Search size={19} />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Caută după utilizator, test sau categorie..."
                  aria-label="Caută rezultate"
                />
              </label>
              <label className="pt-r-select">
                <span className="pt-r-sr">Test</span>
                <select
                  value={test}
                  onChange={(e) => {
                    setTest(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Toate testele</option>
                  {testOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              {groupOptions.length > 0 && (
                <label className="pt-r-select">
                  <span className="pt-r-sr">Grup</span>
                  <select
                    value={group}
                    onChange={(e) => {
                      setGroup(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">Toate grupurile</option>
                    {groupOptions.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="pt-r-select">
                <span className="pt-r-sr">Rezultat</span>
                <select
                  value={verdict}
                  onChange={(e) => {
                    setVerdict(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Toate rezultatele</option>
                  <option value="passed">Promovați</option>
                  <option value="failed">Nepromovați</option>
                  <option value="unknown">Neevaluați</option>
                </select>
              </label>
              <label className="pt-r-select">
                <CalendarDays size={17} />
                <span className="pt-r-sr">Perioadă</span>
                <select
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Orice perioadă</option>
                  <option value="7">Ultimele 7 zile</option>
                  <option value="30">Ultimele 30 zile</option>
                  <option value="90">Ultimele 90 zile</option>
                </select>
              </label>
              <button type="button" className="pt-r-reset" onClick={reset}>
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
                <span className="pt-spinner" /> Se încarcă rezultatele...
              </div>
            ) : (
              <>
                <div className="pt-reports-table-scroll">
                  <table className="pt-reports-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Utilizator</th>
                        <th>Test</th>
                        <th>Categorie</th>
                        <th>Data finalizării</th>
                        <th>Durată</th>
                        <th>Scor</th>
                        <th>Notă</th>
                        <th>Rezultat</th>
                        <th>Acțiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r, i) => {
                        const v = verdictOf(r);
                        const cat = categoryOf(r, tests);
                        return (
                          <tr key={`${r.version_id}-${r.id ?? i}-${i}`}>
                            <td>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                            <td>
                              <div className="pt-r-user">
                                <span className="pt-r-avatar">{initialsOf(userOf(r))}</span>
                                <div>
                                  <strong>{userOf(r)}</strong>
                                  {r.user_role_snapshot && <small>{r.user_role_snapshot}</small>}
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{titleOf(r)}</strong>
                            </td>
                            <td>
                              <span className="pt-r-category">{cat || "—"}</span>
                            </td>
                            <td>
                              <span className="pt-r-inline">
                                <CalendarDays size={15} />
                                {dateText(endDate(r))}
                              </span>
                            </td>
                            <td>
                              <span className="pt-r-inline">
                                <Clock3 size={15} />
                                {durationOf(r)}
                              </span>
                            </td>
                            <td>
                              <strong>{scoreOf(r) == null ? "—" : `${scoreOf(r)}%`}</strong>
                            </td>
                            <td>
                              <strong>{formatGrade(gradeOf(r))}</strong>
                            </td>
                            <td>
                              <span
                                className={`pt-r-verdict ${v === true ? "is-pass" : v === false ? "is-fail" : "is-unknown"}`}
                              >
                                {v === true ? (
                                  <CheckCircle2 size={14} />
                                ) : v === false ? (
                                  <XCircle size={14} />
                                ) : (
                                  <Filter size={14} />
                                )}{" "}
                                {v === true ? "Promovat" : v === false ? "Nepromovat" : "Neevaluat"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="pt-r-icon-button"
                                onClick={() => openRow(r)}
                                title="Vezi rezultatul"
                                aria-label={`Vezi rezultatul pentru ${userOf(r)}`}
                                disabled={
                                  typeof openFinishedAttempt !== "function" &&
                                  typeof openEditor !== "function"
                                }
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
                    <div className="pt-r-empty">Nu există rezultate pentru filtrele selectate.</div>
                  )}
                </div>
                <div className="pt-r-pagination">
                  <span>
                    Afișează {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} –{" "}
                    {Math.min(safePage * PAGE_SIZE, filtered.length)} din {filtered.length}{" "}
                    rezultate
                  </span>
                  <div>
                    <button
                      disabled={safePage <= 1}
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      aria-label="Pagina precedentă"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1)
                      .filter(
                        (n) => pages <= 7 || n === 1 || n === pages || Math.abs(n - safePage) <= 1,
                      )
                      .map((n, i, arr) => (
                        <React.Fragment key={n}>
                          {i > 0 && n - arr[i - 1] > 1 && <span className="pt-r-ellipsis">…</span>}
                          <button
                            className={safePage === n ? "active" : ""}
                            onClick={() => setPage(n)}
                            aria-label={`Pagina ${n}`}
                            aria-current={safePage === n ? "page" : undefined}
                          >
                            {n}
                          </button>
                        </React.Fragment>
                      ))}
                    <button
                      disabled={safePage >= pages}
                      onClick={() => setPage(Math.min(pages, safePage + 1))}
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
        <aside className="pt-reports-aside">
          <section className="pt-reports-panel pt-r-side">
            <h3>
              <Target size={23} /> Rata de promovare
            </h3>
            <div className="pt-r-donut-row">
              <div className="pt-r-donut" style={{ "--rate": `${rate ?? 0}%` }}>
                <div>
                  <strong>{rate == null ? "—" : `${rate}%`}</strong>
                  <span>Promovare</span>
                </div>
              </div>
              <div className="pt-r-legend">
                <div>
                  <i className="pt-r-dot green" />
                  Promovați{" "}
                  <strong>
                    {passed}
                    {rate != null ? ` (${rate}%)` : ""}
                  </strong>
                </div>
                <div>
                  <i className="pt-r-dot red" />
                  Nepromovați{" "}
                  <strong>
                    {failed}
                    {rate != null ? ` (${100 - rate}%)` : ""}
                  </strong>
                </div>
                <div>
                  <i className="pt-r-dot gray" />
                  Evaluați <strong>{evaluated.length}</strong>
                </div>
              </div>
            </div>
            {rate == null && (
              <p className="pt-r-muted">
                Nu există verdicte de promovare în rezultatele selectate.
              </p>
            )}
          </section>
          <section className="pt-reports-panel pt-r-side">
            <h3>
              <BarChart3 size={23} /> Distribuția notelor
            </h3>
            <div className="pt-r-chart">
              {gradeBuckets.map((n, i) => (
                <div className="pt-r-chart-col" key={i}>
                  <strong>{n || ""}</strong>
                  <div className="pt-r-chart-track">
                    <span style={{ height: `${(n / maxBucket) * 100}%` }} />
                  </div>
                  <small>{["1–4,9", "5–6,9", "7–7,9", "8–8,9", "9–10"][i]}</small>
                </div>
              ))}
            </div>
            {!grades.length && <p className="pt-r-muted">Nu există note valide pentru grafic.</p>}
          </section>
          <section className="pt-reports-panel pt-r-side">
            <h3>
              <Trophy size={23} /> Top rezultate
            </h3>
            {top.length ? (
              top.map((r, i) => (
                <div className="pt-r-top" key={`${r.id ?? i}-${i}`}>
                  <span className={`pt-r-medal rank-${i + 1}`}>
                    <Medal size={23} />
                  </span>
                  <div>
                    <strong>{userOf(r)}</strong>
                    <small>{titleOf(r)}</small>
                  </div>
                  <b>{formatGrade(gradeOf(r))}</b>
                </div>
              ))
            ) : (
              <p className="pt-r-muted">Nu există rezultate cu note pentru clasament.</p>
            )}
          </section>
        </aside>
      </div>
      <p className="pt-r-source-note">
        Statisticile sunt calculate din rezultatele încărcate prin API. Dacă API-ul limitează
        numărul de rezultate, totalurile pot fi incomplete. Exportul Excel este în format CSV
        compatibil; butonul PDF deschide imprimarea browserului pentru salvare ca PDF.
      </p>
    </div>
  );
}
