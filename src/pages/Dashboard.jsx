import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./Dashboard.css";
import DashboardStats from "../components/dashboard/DashboardStats";
import RecentInformation from "../components/dashboard/RecentInformation";
import NewsSection from "../components/dashboard/NewsSection";

const initialStats = {
  telegrame: 0,
  ordine: 0,
  legislatie: 0,
  informatii_utile: 0,
  utilizatori: 0,
};

function Dashboard() {
  const [stats, setStats] = useState(initialStats);
  const [recent, setRecent] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // STATISTICI
  const loadDashboard = useCallback(async (initial = false) => {
    try {
      if (initial) setLoadingStats(true);
      else setRefreshing(true);

      setError("");

      const response = await api.get("/dashboard/stats");

      if (!response.data?.stats) {
        throw new Error("Răspuns invalid de la server.");
      }

      const normalizedStats = {};

      Object.keys(initialStats).forEach((key) => {
        normalizedStats[key] = Number(response.data.stats[key] ?? 0);
      });

      setStats(normalizedStats);

      setRecent(
        Array.isArray(response.data.recent) ? response.data.recent : [],
      );
    } catch (err) {
      console.error("DASHBOARD ERROR:", err);

      setError(
        err.response?.data?.message || "Datele nu au putut fi încărcate.",
      );
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadDashboard(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboard]);

  return (
    <div className="dashboard">
      {/* BANNER */}
      <div
        className="border-hero"
        style={{
          "--border-banner-url": `url("${import.meta.env.BASE_URL}images/border-banner.png")`,
        }}
      >
        <div className="border-hero-content">
          <p className="border-hero-description">
            Documente
            <span>•</span>
            Legislație
            <span>•</span>
            Informații
            <span>•</span>
            Suport operațional
          </p>
        </div>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button type="button" onClick={() => loadDashboard(true)}>
            Reîncearcă
          </button>
        </div>
      )}

      {/* STATISTICI */}
      <DashboardStats stats={stats} loadingStats={loadingStats} />

      <div className="dashboard-grid">
        {/* ULTIMELE INFORMAȚII */}
        <RecentInformation
          recent={recent}
          loadingStats={loadingStats}
          refreshing={refreshing}
          onRefresh={() => loadDashboard(false)}
        />

        <NewsSection />
      </div>
    </div>
  );
}

export default Dashboard;
