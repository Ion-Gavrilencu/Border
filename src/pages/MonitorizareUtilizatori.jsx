import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getMonitoringActivities, getMonitoringOverview } from "../services/monitoringService";
import MonitoringStats from "../components/monitoring/MonitoringStats";
import MonitoringUserList from "../components/monitoring/MonitoringUserList";
import MonitoringUserProfile from "../components/monitoring/MonitoringUserProfile";
import MonitoringActivity from "../components/monitoring/MonitoringActivity";
import "./MonitorizareUtilizatori.css";

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

export default function MonitorizareUtilizatori() {
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(1);
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadOverview = useCallback(async () => {
    try {
      const data = await getMonitoringOverview();
      setOverview(data);
      setSelectedId((previous) => previous !== null && data.users?.some((u) => String(u.id) === String(previous)) ? previous : data.users?.[0]?.id ?? null);
    } catch (error) {
      toast.error(errorMessage(error, "Nu s-au putut încărca utilizatorii."));
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const timer = window.setInterval(loadOverview, 15000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(activitySearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [activitySearch]);

  useEffect(() => setPage(1), [selectedId, action, debouncedSearch, start, end]);

  useEffect(() => {
    if (selectedId === null) {
      setActivities([]);
      setTotal(0);
      return;
    }
    let active = true;
    setLoadingActivities(true);
    setActivityError("");
    getMonitoringActivities({ userId: selectedId, action, search: debouncedSearch, start: start || undefined, end: end || undefined, page, limit: 8 })
      .then((data) => {
        if (!active) return;
        setActivities(data.activities || []);
        setTotal(Number(data.total) || 0);
      })
      .catch((error) => {
        if (!active) return;
        setActivityError(errorMessage(error, "Nu s-a putut încărca istoricul."));
        setActivities([]);
        setTotal(0);
      })
      .finally(() => { if (active) setLoadingActivities(false); });
    return () => { active = false; };
  }, [selectedId, action, debouncedSearch, start, end, page, refreshKey]);

  const users = overview?.users || [];
  const selected = users.find((user) => String(user.id) === String(selectedId));
  const filteredUsers = useMemo(() => users.filter((user) => {
    const term = userSearch.trim().toLocaleLowerCase("ro-RO");
    const matches = [user.full_name, user.username, user.email].some((value) => String(value || "").toLocaleLowerCase("ro-RO").includes(term));
    return matches && (status === "all" || (status === "online" ? user.online : !user.online));
  }), [users, userSearch, status]);

  const refresh = () => {
    loadOverview();
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="mon-page">
      <header className="mon-heading">
        <span className="mon-eyebrow">ADMINISTRARE</span>
        <h1>Monitorizare utilizatori</h1>
        <p>Urmărește activitatea utilizatorilor în platformă: conectări, căutări, accesări pagini, vizualizări și descărcări.</p>
      </header>
      <MonitoringStats stats={overview?.stats} totalUsers={users.length} loading={loadingOverview} />
      <div className="mon-columns">
        <MonitoringUserList users={users} filteredUsers={filteredUsers} selectedId={selectedId} onSelect={setSelectedId} search={userSearch} onSearchChange={setUserSearch} status={status} onStatusChange={setStatus} loading={loadingOverview} />
        <div className="mon-right">
          <MonitoringUserProfile user={selected} />
          <MonitoringActivity activities={activities} total={total} page={page} onPageChange={setPage} action={action} onActionChange={setAction} search={activitySearch} onSearchChange={setActivitySearch} start={start} onStartChange={setStart} end={end} onEndChange={setEnd} loading={loadingActivities} error={activityError} onRefresh={refresh} />
        </div>
      </div>
    </div>
  );
}
