import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";

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
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(initialStats);
  const [trends, setTrends] = useState({});
  const [recent, setRecent] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (initial = false) => {
    try {
      if (initial) setLoadingStats(true);
      else setRefreshing(true);
      setError("");
      const response = await api.get("/dashboard/stats");
      const data = response.data;
      if (!data?.stats || typeof data.stats !== "object" || Array.isArray(data.stats)) {
        throw new Error("Răspuns invalid de la server.");
      }
      const normalized = {};
      for (const key of Object.keys(initialStats)) {
        const number = Number(data.stats[key] ?? 0);
        normalized[key] = Number.isFinite(number) ? Math.max(0, number) : 0;
      }
      setStats(normalized);
      const nextTrends = {};
      for (const key of ["telegrame", "ordine", "legislatie", "informatii_utile"]) {
        const raw = data.trends?.[key];
        if (raw !== null && raw !== undefined && raw !== "" && Number.isFinite(Number(raw))) {
          nextTrends[key] = Number(raw);
        }
      }
      setTrends(nextTrends);
      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch (err) {
      console.error("DASHBOARD ERROR:", err);
      const message =
        err.response?.data?.message || err.message || "Datele nu au putut fi încărcate.";
      setError(message);
      if (!initial) toast.error(message);
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
      if (document.visibilityState === "visible") loadDashboard(false);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadDashboard]);
  useEffect(() => {
    const message = location.state?.newsMessage;
    if (!message) return;
    toast.success(message);
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  return (
    <div className="dashboard dashboard-modern">
      <motion.div
        className="border-hero"
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        transition={{ duration: 0.4 }}
        style={{
          "--border-banner-url": `url("${import.meta.env.BASE_URL}images/border-banner.png")`,
        }}
      >
        <div className="border-hero-content">
          <p className="border-hero-description">
            Documente <span>•</span> Legislație <span>•</span> Informații <span>•</span> Suport
            operațional
          </p>
        </div>
      </motion.div>
      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        transition={{ duration: 0.4, delay: 0.08 }}
        aria-label="Statistici"
      >
        <DashboardStats stats={stats} trends={trends} loadingStats={loadingStats} />
      </motion.section>
      <div className="dashboard-grid">
        <motion.div
          className="dashboard-panel-motion"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.4, delay: 0.14 }}
        >
          <RecentInformation
            recent={recent}
            loadingStats={loadingStats}
            refreshing={refreshing}
            onRefresh={() => loadDashboard(false)}
          />
        </motion.div>
        <motion.div
          className="dashboard-panel-motion"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <NewsSection />
        </motion.div>
      </div>
    </div>
  );
}
export default Dashboard;
