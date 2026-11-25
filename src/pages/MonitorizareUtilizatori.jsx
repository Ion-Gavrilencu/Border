import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw, RotateCcw, Pause, Play, ArrowUpDown } from "lucide-react";
import { getMonitoringActivities, getMonitoringOverview } from "../services/monitoringService";
import MonitoringStats from "../components/monitoring/MonitoringStats";
import MonitoringUserList from "../components/monitoring/MonitoringUserList";
import MonitoringUserProfile from "../components/monitoring/MonitoringUserProfile";
import MonitoringActivity from "../components/monitoring/MonitoringActivity";
import MonitoringRetention from "../components/monitoring/MonitoringRetention";
import "./MonitorizareUtilizatori.css";
import "./MonitoringDashboardControls.css";

const INTERVAL = 15000;
const EMPTY = { action: "all", search: "", start: "", end: "", page: 1, limit: 10 };
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
const normalize = (value) => String(value ?? "").toLocaleLowerCase("ro-RO");
const timestamp = (value) => Date.parse(value) || 0;

export default function MonitorizareUtilizatori() {
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("online");
  const [filters, setFilters] = useState(EMPTY);
  const [activitySearch, setActivitySearch] = useState("");
  const [result, setResult] = useState(null);
  const [activityError, setActivityError] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [auto, setAuto] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [visible, setVisible] = useState(() => !document.hidden);
  const overviewBusy = useRef(false);
  const activityBusy = useRef(null);
  const profileRef = useRef(null);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const users = overview?.users || [];
  const selected = users.find((u) => String(u.id) === String(selectedId));
  const key = JSON.stringify([selectedId, filters]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const loadOverview = useCallback(async () => {
    if (overviewBusy.current) return;
    overviewBusy.current = true;
    setLoadingOverview(true);
    try {
      const data = await getMonitoringOverview();
      if (!mounted.current) return;
      setOverview(data);
      setOverviewError("");
      setLastSync(new Date());
      setSelectedId((previous) =>
        data.users?.some((u) => String(u.id) === String(previous))
          ? previous
          : (data.users?.[0]?.id ?? null),
      );
    } catch (error) {
      if (mounted.current)
        setOverviewError(errorMessage(error, "Nu s-au putut actualiza statisticile."));
    } finally {
      overviewBusy.current = false;
      if (mounted.current) setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = activitySearch.trim();
      setFilters((old) => (old.search === search ? old : { ...old, search, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activitySearch]);

  const loadActivities = useCallback(
    async (background = false) => {
      if (selectedId === null || (filters.start && filters.end && filters.start > filters.end))
        return;
      if (activityBusy.current?.key === key) return;
      const version = ++requestVersion.current;
      activityBusy.current = { key, version };
      if (!background) setLoadingActivities(true);
      try {
        const data = await getMonitoringActivities({
          userId: selectedId,
          action: filters.action,
          search: filters.search,
          start: filters.start || undefined,
          end: filters.end || undefined,
          page: filters.page,
          limit: filters.limit,
        });
        if (!mounted.current || version !== requestVersion.current) return;
        const total = Math.max(0, Number(data.total) || 0);
        const lastPage = Math.max(1, Math.ceil(total / filters.limit));
        if (filters.page > lastPage) {
          setFilters((old) => (old === filters ? { ...old, page: lastPage } : old));
          return;
        }
        setResult({
          key,
          activities: Array.isArray(data.activities) ? data.activities : [],
          total,
        });
        setActivityError(null);
      } catch (error) {
        if (mounted.current && version === requestVersion.current)
          setActivityError({
            key,
            message: errorMessage(error, "Nu s-a putut încărca istoricul."),
          });
      } finally {
        if (activityBusy.current?.version === version) activityBusy.current = null;
        if (mounted.current && version === requestVersion.current) setLoadingActivities(false);
      }
    },
    [selectedId, filters, key],
  );

  useEffect(() => {
    loadActivities();
    return () => {
      requestVersion.current++;
      activityBusy.current = null;
    };
  }, [loadActivities]);

  useEffect(() => {
    if (!auto || !visible) return;
    const timer = window.setInterval(() => {
      loadOverview();
      // Nu deplasăm istoricul în timp ce administratorul consultă pagini vechi.
      if (filters.page === 1) loadActivities(true);
    }, INTERVAL);
    return () => window.clearInterval(timer);
  }, [auto, visible, loadOverview, loadActivities, filters.page]);

  const filteredUsers = useMemo(() => {
    const term = normalize(userSearch.trim());
    return users
      .filter(
        (user) =>
          [user.full_name, user.username, user.email].some((v) => normalize(v).includes(term)) &&
          (status === "all" || (status === "online" ? user.online : !user.online)),
      )
      .sort((a, b) => {
        const name = String(a.full_name || a.username || "").localeCompare(
          String(b.full_name || b.username || ""),
          "ro",
        );
        if (sort === "name") return name;
        if (sort === "role")
          return String(a.role || "").localeCompare(String(b.role || "")) || name;
        if (sort === "online") {
          const diff = Number(Boolean(b.online)) - Number(Boolean(a.online));
          if (diff) return diff;
        }
        return timestamp(b.last_seen_at) - timestamp(a.last_seen_at) || name;
      });
  }, [users, userSearch, status, sort]);

  const changeFilter = (field, value) => setFilters((old) => ({ ...old, [field]: value, page: 1 }));
  const reset = () => {
    setFilters(EMPTY);
    setActivitySearch("");
    setUserSearch("");
    setStatus("all");
    setSort("online");
  };
  const refresh = () => {
    loadOverview();
    loadActivities();
  };
  const select = (id) => {
    setSelectedId(id);
    setFilters((old) => (old.page === 1 ? old : { ...old, page: 1 }));
    if (window.matchMedia("(max-width: 900px)").matches)
      profileRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const invalidDates = filters.start && filters.end && filters.start > filters.end;
  const current = result?.key === key ? result : null;
  const error = invalidDates
    ? "Data de început trebuie să fie înaintea datei de sfârșit."
    : activityError?.key === key
      ? activityError.message
      : "";

  return (
    <div className="mon-page">
      <header className="mon-heading">
        <span className="mon-eyebrow">ADMINISTRARE / BORDER</span>
        <h1>Monitorizare utilizatori</h1>
        <p>Urmărește conectările, căutările, documentele și activitatea utilizatorilor.</p>
        <div className="mon-dashboard-tools">
          <div className="mon-sync-info" role="status">
            <span
              className={`mon-sync-dot ${auto && visible && !overviewError && lastSync ? "is-live" : ""}`}
            />
            <div>
              <strong>
                {overviewError
                  ? "Sincronizare indisponibilă"
                  : !auto || !visible
                    ? "Actualizare suspendată"
                    : lastSync
                      ? "Actualizare automată · 15 sec."
                      : "Se conectează..."}
              </strong>
              <small>
                Statistici actualizate:{" "}
                {lastSync
                  ? lastSync.toLocaleTimeString("ro-RO", { timeZone: "Europe/Chisinau" })
                  : "—"}
              </small>
            </div>
          </div>
          <div className="mon-dashboard-actions">
            <button type="button" aria-pressed={auto} onClick={() => setAuto((v) => !v)}>
              {auto ? <Pause size={17} /> : <Play size={17} />} {auto ? "Pauză" : "Pornește"}
            </button>
            <button type="button" onClick={refresh} disabled={loadingOverview || loadingActivities}>
              <RefreshCw size={17} /> Actualizează
            </button>
          </div>
        </div>
      </header>
      {overviewError && (
        <div className="mon-error" role="alert">
          {overviewError} {overview && "Sunt afișate ultimele date disponibile."}{" "}
          <button type="button" onClick={loadOverview} disabled={loadingOverview}>
            Reîncearcă
          </button>
        </div>
      )}
      <MonitoringStats
        stats={overview?.stats}
        totalUsers={users.length}
        loading={!overview && loadingOverview}
      />
      <div className="mon-dashboard-filterbar">
        <label>
          <ArrowUpDown size={17} /> Sortare{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="online">Online mai întâi</option>
            <option value="recent">Ultima activitate</option>
            <option value="name">Nume A–Z</option>
            <option value="role">Rol</option>
          </select>
        </label>
        <button type="button" onClick={reset}>
          <RotateCcw size={16} /> Resetează filtrele
        </button>
      </div>
      <div className="mon-columns">
        <MonitoringUserList
          users={users}
          filteredUsers={filteredUsers}
          selectedId={selectedId}
          onSelect={select}
          search={userSearch}
          onSearchChange={setUserSearch}
          status={status}
          onStatusChange={setStatus}
          loading={!overview && loadingOverview}
        />
        <div className="mon-right" ref={profileRef}>
          <MonitoringUserProfile user={selected} />
          {selected && (
            <MonitoringActivity
              activities={current?.activities || []}
              total={current?.total || 0}
              limit={filters.limit}
              onLimitChange={(v) => changeFilter("limit", v)}
              onReset={() => {
                setFilters((old) => ({ ...EMPTY, limit: old.limit }));
                setActivitySearch("");
              }}
              onDateRangeChange={(start, end) =>
                setFilters((old) => ({ ...old, start, end, page: 1 }))
              }
              page={filters.page}
              onPageChange={(page) => setFilters((old) => ({ ...old, page }))}
              action={filters.action}
              onActionChange={(v) => changeFilter("action", v)}
              search={activitySearch}
              onSearchChange={setActivitySearch}
              start={filters.start}
              onStartChange={(v) => changeFilter("start", v)}
              end={filters.end}
              onEndChange={(v) => changeFilter("end", v)}
              loading={!invalidDates && (loadingActivities || (!current && !error))}
              error={error}
              onRefresh={refresh}
            />
          )}
          {!selected && (
            <section className="mon-panel mon-empty">
              <Activity size={24} /> Selectează un utilizator pentru a consulta istoricul.
            </section>
          )}
        </div>
      </div>
      <MonitoringRetention />
    </div>
  );
}
