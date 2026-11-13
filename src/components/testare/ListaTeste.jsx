import React, { useMemo, useState } from "react";
import {
  ListChecks,
  Layers3,
  Search,
  RefreshCw,
  Grid2X2,
  List,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  MoreHorizontal,
  Clock3,
  CalendarDays,
  Users,
  ShieldCheck,
  Scale,
  FileWarning,
  Play,
  Check,
  ClipboardList,
  CircleCheck,
  Hourglass,
  ArrowUpDown,
  Trash2,
} from "lucide-react";
import "./ListaTeste.css";

const text = (value) => String(value ?? "").toLocaleLowerCase("ro-RO");
const number = (value) =>
  value === null || value === undefined || value === ""
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;
// Normalizează câmpurile de numărare returnate de API.
const assignmentCountOf = (item) => {
  const value = number(item.assignment_count ?? item.assignments_count ?? item.assigned_count);
  return value === null ? 0 : Math.max(0, value);
};
const titleOf = (item) => item.title ?? item.test_title ?? "Test fără titlu";
const categoryOf = (item) => item.category_name ?? item.category ?? "General";
const statusOf = (item) => {
  const status = String(item.status ?? item.version_status ?? "").toUpperCase();
  if (["PUBLISHED", "ACTIVE", "ACTIV"].includes(status)) return "active";
  if (["SCHEDULED", "PROGRAMAT"].includes(status)) return "scheduled";
  if (["COMPLETED", "FINISHED", "CLOSED", "FINALIZAT"].includes(status)) return "finished";
  if (["DRAFT", "CIORNA", "CIORNĂ"].includes(status)) return "draft";
  return "other";
};
const stateLabels = {
  active: "Activ",
  scheduled: "Programat",
  finished: "Finalizat",
  draft: "Ciornă",
  other: "Altă stare",
};
const stateIcons = {
  active: Play,
  scheduled: CalendarDays,
  finished: Check,
  draft: ClipboardList,
  other: Hourglass,
};
const dateOf = (item) => item.updated_at ?? item.created_at ?? item.published_at ?? null;
const fmtDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ro-RO");
};
const periodOf = (item) => {
  const from = item.starts_at ?? item.start_at ?? item.available_from ?? item.start_date;
  const to = item.ends_at ?? item.end_at ?? item.available_until ?? item.end_date;
  if (!from && !to) return "—";
  return [fmtDate(from), fmtDate(to)].filter(Boolean).join(" – ");
};
const iconOf = (category) => {
  const c = text(category);
  if (c.includes("legis") || c.includes("jurid")) return Scale;
  if (c.includes("document")) return FileWarning;
  if (c.includes("frontier") || c.includes("opera")) return ShieldCheck;
  return ClipboardList;
};
const colorOf = (category) => {
  const c = text(category);
  if (c.includes("legis")) return "blue";
  if (c.includes("jurid") || c.includes("manage")) return "purple";
  if (c.includes("document")) return "orange";
  if (c.includes("frontier") || c.includes("opera")) return "cyan";
  return "blue";
};

export default function ListaTeste({ ctx = {} }) {
  const {
    managed = [],
    filteredTests,
    testSearch,
    setTestSearch,
    testStatus,
    setTestStatus,
    testView,
    setTestView,
    testPage,
    setTestPage,
    openEditor,
    versionIdOf,
    canManage,
    canDelete,
    setDeleteTarget,
    loading,
    setShowCreate,
  } = ctx;
  const [localSearch, setLocalSearch] = useState("");
  const [localStatus, setLocalStatus] = useState("all");
  const [localView, setLocalView] = useState("list");
  const [localPage, setLocalPage] = useState(1);
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("all");
  const [menuId, setMenuId] = useState(null);
  const [sort, setSort] = useState("newest");
  const search = testSearch ?? localSearch;
  const status = testStatus ?? localStatus;
  const view = testView ?? localView;
  const page = testPage ?? localPage;
  const changeSearch = (v) => {
    (setTestSearch ?? setLocalSearch)(v);
    (setTestPage ?? setLocalPage)(1);
  };
  const changeStatus = (v) => {
    (setTestStatus ?? setLocalStatus)(v);
    (setTestPage ?? setLocalPage)(1);
  };
  const changeView = (v) => (setTestView ?? setLocalView)(v);
  const changePage = (v) => (setTestPage ?? setLocalPage)(v);
  const tests = Array.isArray(managed) ? managed : [];
  const categories = useMemo(
    () =>
      [...new Set(tests.map(categoryOf).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "ro"),
      ),
    [managed],
  );
  const stats = useMemo(
    () => ({
      total: tests.length,
      active: tests.filter((x) => statusOf(x) === "active").length,
      scheduled: tests.filter((x) => statusOf(x) === "scheduled").length,
      finished: tests.filter((x) => statusOf(x) === "finished").length,
    }),
    [managed],
  );
  const filtered = useMemo(() => {
    const now = Date.now();
    const days = period === "7" ? 7 : period === "30" ? 30 : period === "90" ? 90 : null;
    return tests
      .filter((item) => {
        const matchesSearch =
          !search ||
          text([titleOf(item), item.description, categoryOf(item)].join(" ")).includes(
            text(search),
          );
        const matchesStatus =
          status === "all" ||
          status === "" ||
          statusOf(item) === status ||
          String(item.status ?? item.version_status ?? "").toUpperCase() ===
            String(status).toUpperCase();
        const matchesCategory = category === "all" || String(categoryOf(item)) === category;
        const timestamp = new Date(dateOf(item) ?? "").getTime();
        const matchesPeriod =
          !days ||
          (Number.isFinite(timestamp) && timestamp >= now - days * 86400000 && timestamp <= now);
        return matchesSearch && matchesStatus && matchesCategory && matchesPeriod;
      })
      .sort((a, b) => {
        if (sort === "title") return String(titleOf(a)).localeCompare(String(titleOf(b)), "ro");
        const aTime = new Date(dateOf(a) ?? 0).getTime() || 0;
        const bTime = new Date(dateOf(b) ?? 0).getTime() || 0;
        return sort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [managed, search, status, category, period, sort]);
  const pageSize = 5;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.max(1, Math.min(Number(page) || 1, pages));
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const reset = () => {
    changeSearch("");
    changeStatus("all");
    setCategory("all");
    setPeriod("all");
    setSort("newest");
    changePage(1);
  };
  const open = (item) => {
    if (typeof openEditor === "function") openEditor(item);
  };
  const canOpen = (item) =>
    typeof openEditor === "function" &&
    (typeof versionIdOf !== "function" || versionIdOf(item) != null);
  const pageButtons = Array.from(
    { length: Math.min(5, pages) },
    (_, i) => Math.max(1, Math.min(safePage - 2, pages - 4)) + i,
  ).filter((p) => p <= pages);
  const renderRow = (item, index) => {
    const state = statusOf(item);
    const StateIcon = stateIcons[state];
    const categoryName = categoryOf(item);
    const CategoryIcon = iconOf(categoryName);
    const id = item.id ?? `${titleOf(item)}-${index}`;
    return (
      <div className="lt-row" key={id}>
        <div className="lt-test-cell">
          <span className={`lt-row-icon lt-tint-${colorOf(categoryName)}`}>
            <CategoryIcon size={23} />
          </span>
          <span className="lt-test-text">
            <strong>{titleOf(item)}</strong>
            <small>
              {item.description || (dateOf(item) ? `Actualizat: ${fmtDate(dateOf(item))}` : "")}
            </small>
          </span>
        </div>
        <div>
          <span className={`lt-chip lt-tint-${colorOf(categoryName)}`}>{categoryName}</span>
        </div>
        <div className="lt-number">{item.question_count ?? item.questions_count ?? "—"}</div>
        <div className="lt-inline">
          <Clock3 size={17} />
          {number(item.duration_minutes) == null ? "—" : `${item.duration_minutes} min`}
        </div>
        <div className="lt-inline">
          <Users size={18} />
          {assignmentCountOf(item)}
        </div>
        <div className="lt-inline">
          <CalendarDays size={17} />
          <span>{periodOf(item)}</span>
        </div>
        <div>
          <span className={`lt-state lt-state-${state}`}>
            <StateIcon size={14} />
            {stateLabels[state]}
          </span>
        </div>
        <div className="lt-actions">
          <button
            type="button"
            title="Vizualizează"
            aria-label={`Vizualizează ${titleOf(item)}`}
            disabled={!canOpen(item)}
            onClick={() => open(item)}
          >
            <Eye size={19} />
          </button>
          {canManage && (
            <button
              type="button"
              title="Editează"
              aria-label={`Editează ${titleOf(item)}`}
              disabled={!canOpen(item)}
              onClick={() => open(item)}
            >
              <Pencil size={18} />
            </button>
          )}
          {canManage && (
            <div className="lt-menu-wrap">
              <button
                type="button"
                title="Mai multe acțiuni"
                aria-label={`Mai multe acțiuni pentru ${titleOf(item)}`}
                aria-expanded={menuId === id}
                onClick={() => setMenuId(menuId === id ? null : id)}
              >
                <MoreHorizontal size={21} />
              </button>
              {menuId === id && (
                <div className="lt-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(null);
                      open(item);
                    }}
                    disabled={!canOpen(item)}
                  >
                    Deschide testul
                  </button>
                  {canDelete && typeof setDeleteTarget === "function" && (
                    <button
                      type="button"
                      className="lt-danger"
                      onClick={() => {
                        setMenuId(null);
                        setDeleteTarget(item);
                      }}
                    >
                      <Trash2 size={15} /> Șterge testul
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };
  return (
    <section className="lt-page" aria-label="Gestionarea testelor">
      <header className="lt-header">
        <div className="lt-header-title">
          <span className="lt-header-icon">
            <ListChecks size={27} />
          </span>
          <div>
            <h2>Teste</h2>
            <p>Gestionarea tuturor testelor din platformă</p>
          </div>
        </div>
        <div className="lt-view-switch">
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            onClick={() => changeView("list")}
          >
            <List size={19} /> Listă
          </button>
          <button
            type="button"
            className={view === "cards" ? "is-active" : ""}
            onClick={() => changeView("cards")}
          >
            <Grid2X2 size={19} /> Carduri
          </button>
        </div>
      </header>
      <div className="lt-stat-grid">
        {[
          { label: "Total teste", value: stats.total, Icon: Layers3, tone: "blue" },
          { label: "Teste active", value: stats.active, Icon: Play, tone: "purple" },
          { label: "Teste programate", value: stats.scheduled, Icon: ClipboardList, tone: "sky" },
          { label: "Teste finalizate", value: stats.finished, Icon: CircleCheck, tone: "green" },
        ].map(({ label, value, Icon, tone }) => (
          <div className={`lt-stat lt-stat-${tone}`} key={label}>
            <span className="lt-stat-icon">
              <Icon size={28} />
            </span>
            <span className="lt-stat-copy">
              <span>{label}</span>
              <strong>{value}</strong>
            </span>
            <svg viewBox="0 0 78 40" className="lt-spark" aria-hidden="true">
              <path d="M2 31 C13 17 20 37 33 20 S48 9 57 12 S70 3 76 4" />
            </svg>
          </div>
        ))}
      </div>
      <div className="lt-content">
        <div className="lt-filters">
          <label className="lt-search">
            <Search size={21} />
            <input
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              placeholder="Caută test după titlu, categorie sau descriere..."
              aria-label="Caută teste"
            />
          </label>
          <label className="lt-select">
            <Grid2X2 size={18} />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                changePage(1);
              }}
              aria-label="Categorie"
            >
              <option value="all">Toate categoriile</option>
              {categories.map((x) => (
                <option value={x} key={x}>
                  {x}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>
          <label className="lt-select">
            <ListChecks size={18} />
            <select
              value={status}
              onChange={(e) => changeStatus(e.target.value)}
              aria-label="Stare"
            >
              <option value="all">Toate stările</option>
              {Object.entries(stateLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>
          <label className="lt-select">
            <CalendarDays size={18} />
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                changePage(1);
              }}
              aria-label="Perioadă actualizare"
            >
              <option value="all">Orice perioadă</option>
              <option value="7">Ultimele 7 zile</option>
              <option value="30">Ultimele 30 zile</option>
              <option value="90">Ultimele 90 zile</option>
            </select>
            <ChevronDown size={16} />
          </label>
          <button className="lt-reset" type="button" onClick={reset}>
            <RefreshCw size={17} /> Resetează filtrele
          </button>
        </div>
        <div className="lt-sort">
          <label>
            <ArrowUpDown size={15} /> Sortare:{" "}
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                changePage(1);
              }}
            >
              <option value="newest">Cele mai noi</option>
              <option value="oldest">Cele mai vechi</option>
              <option value="title">Titlu A–Z</option>
            </select>
          </label>
        </div>
        {view === "cards" ? (
          <div className="lt-cards">
            {visible.map((item, i) => (
              <article className="lt-test-card" key={item.id ?? i}>
                <div className="lt-card-top">
                  <span className={`lt-chip lt-tint-${colorOf(categoryOf(item))}`}>
                    {categoryOf(item)}
                  </span>
                  <span className={`lt-state lt-state-${statusOf(item)}`}>
                    {stateLabels[statusOf(item)]}
                  </span>
                </div>
                <h3>{titleOf(item)}</h3>
                <p>{item.description || "Fără descriere"}</p>
                <div className="lt-card-meta">
                  <span>
                    <ListChecks size={16} />
                    {item.question_count ?? item.questions_count ?? "—"} întrebări
                  </span>
                  <span>
                    <Clock3 size={16} />
                    {number(item.duration_minutes) == null ? "—" : `${item.duration_minutes} min`}
                  </span>
                  <span>
                    <Users size={16} />
                    {assignmentCountOf(item)} atribuiri
                  </span>
                </div>
                <button
                  className="lt-open"
                  type="button"
                  disabled={!canOpen(item)}
                  onClick={() => open(item)}
                >
                  Deschide testul <Eye size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="lt-table-scroll">
            <div className="lt-table">
              <div className="lt-row lt-table-head">
                <div>Test</div>
                <div>Categorie</div>
                <div>Întrebări</div>
                <div>Durată</div>
                <div>Atribuiri</div>
                <div>Perioadă</div>
                <div>Stare</div>
                <div>Acțiuni</div>
              </div>
              {visible.map(renderRow)}
            </div>
          </div>
        )}
        {loading && (
          <p className="lt-empty" role="status">
            Se încarcă testele...
          </p>
        )}
        {!loading && !visible.length && (
          <p className="lt-empty">Nu există teste care să corespundă filtrelor selectate.</p>
        )}
        <footer className="lt-footer">
          <span>
            Afișează {visible.length ? (safePage - 1) * pageSize + 1 : 0} –{" "}
            {Math.min(safePage * pageSize, filtered.length)} din {filtered.length} teste
          </span>
          <nav className="lt-pagination" aria-label="Paginare teste">
            <button
              type="button"
              aria-label="Pagina precedentă"
              disabled={safePage <= 1}
              onClick={() => changePage(safePage - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            {pageButtons.map((p) => (
              <button
                type="button"
                key={p}
                className={safePage === p ? "is-active" : ""}
                aria-current={safePage === p ? "page" : undefined}
                onClick={() => changePage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              aria-label="Pagina următoare"
              disabled={safePage >= pages}
              onClick={() => changePage(safePage + 1)}
            >
              <ChevronRight size={19} />
            </button>
          </nav>
        </footer>
      </div>
    </section>
  );
}
