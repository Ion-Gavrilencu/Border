import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const categories = ["telegrame", "ordine", "legislatie", "informatii_utile"];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function normalizeStats(data) {
  const result = {};

  for (const key of Object.keys(initialStats)) {
    const value = Number(data?.[key] ?? 0);

    result[key] = Number.isFinite(value) && value >= 0 ? value : 0;
  }

  return result;
}

function normalizeTrends(data) {
  const result = {};

  for (const key of categories) {
    const raw = data?.[key];

    if (raw === null || raw === undefined || raw === "") {
      result[key] = null;
      continue;
    }

    const value = Number(raw);

    result[key] = Number.isFinite(value) ? value : null;
  }

  return result;
}

function normalizeTrendStatus(data) {
  const allowed = new Set(["increase", "decrease", "stable", "new", "no_activity", "unavailable"]);

  const result = {};

  for (const key of categories) {
    const value = data?.[key];

    result[key] = allowed.has(value) ? value : "unavailable";
  }

  return result;
}

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const [stats, setStats] = useState(initialStats);
  const [trends, setTrends] = useState({});
  const [trendStatus, setTrendStatus] = useState({});
  const [recent, setRecent] = useState([]);

  const [loadingStats, setLoadingStats] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const requestRef = useRef(0);
  const mountedRef = useRef(false);

  const loadDashboard = useCallback(async (initial = false) => {
    const requestId = ++requestRef.current;

    try {
      if (initial) {
        setLoadingStats(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get("/dashboard/stats");

      if (!mountedRef.current || requestId !== requestRef.current) {
        return;
      }

      const data = response.data;

      if (!data?.stats || typeof data.stats !== "object" || Array.isArray(data.stats)) {
        throw new Error("Răspuns invalid de la server.");
      }

      setStats(normalizeStats(data.stats));
      setTrends(normalizeTrends(data.trends));

      setTrendStatus(normalizeTrendStatus(data.trendStatus));

      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch (err) {
      if (!mountedRef.current || requestId !== requestRef.current) {
        return;
      }

      console.error("DASHBOARD ERROR:", err);

      const message =
        err.response?.data?.message || err.message || "Datele nu au putut fi încărcate.";

      setError(message);

      if (!initial) {
        toast.error(message);
      }
    } finally {
      if (mountedRef.current && requestId === requestRef.current) {
        setLoadingStats(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Încărcare inițială.
  useEffect(() => {
    mountedRef.current = true;

    loadDashboard(true);

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadDashboard]);

  // Actualizare la revenirea în aplicație.
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

  // Mesaj după adăugarea sau editarea știrii.
  useEffect(() => {
    const message = location.state?.newsMessage;

    if (!message) return;

    toast.success(message);

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      {
        replace: true,
        state: null,
      },
    );
  }, [location.pathname, location.search, location.hash, location.state, navigate]);

  return (
    <div className="dashboard dashboard-modern">
      {/* BANNER */}
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
            Documente
            <span>•</span>
            Legislație
            <span>•</span>
            Informații
            <span>•</span>
            Suport operațional
          </p>
        </div>
      </motion.div>

      {/* EROARE */}
      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* STATISTICI */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        transition={{
          duration: 0.4,
          delay: 0.08,
        }}
        aria-label="Statistici documente"
      >
        <DashboardStats
          stats={stats}
          trends={trends}
          trendStatus={trendStatus}
          loadingStats={loadingStats}
        />
      </motion.section>

      {/* INFORMAȚII RECENTE ȘI ȘTIRI */}
      <div className="dashboard-grid">
        <motion.div
          className="dashboard-panel-motion"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{
            duration: 0.4,
            delay: 0.14,
          }}
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
          transition={{
            duration: 0.4,
            delay: 0.2,
          }}
        >
          <NewsSection />
        </motion.div>
      </div>
    </div>
  );
}

export default Dashboard;
