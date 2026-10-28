
import { AlertCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function Dashboard() {
  const [stats, setStats] = useState(initialStats);
  const [recent, setRecent] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (initial = false) => {
    try {
      if (initial) {
        setLoadingStats(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get("/dashboard/stats");

      if (!response.data?.stats) {
        throw new Error("Răspuns invalid de la server.");
      }

      const normalizedStats = {};

      Object.keys(initialStats).forEach((key) => {
        normalizedStats[key] = Number(
          response.data.stats[key] ?? 0
        );
      });

      setStats(normalizedStats);

      setRecent(
        Array.isArray(response.data.recent)
          ? response.data.recent
          : []
      );

    } catch (err) {
      console.error("DASHBOARD ERROR:", err);

      const message =
        err.response?.data?.message ||
        err.message ||
        "Datele nu au putut fi încărcate.";

      setError(message);

      if (!initial) {
        toast.error(message);
      }
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

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadDashboard]);

  return (
    <div className="dashboard dashboard-modern">

      {/* BANNER EXISTENT */}
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
          <AlertCircle size={19} />
          <span>{error}</span>

          <button
            type="button"
            disabled={loadingStats || refreshing}
            onClick={() => loadDashboard(true)}
          >
            <RefreshCw size={15} />
            Reîncearcă
          </button>
        </div>
      )}

      {/* STATISTICI */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        transition={{ duration: 0.4, delay: 0.08 }}
        aria-label="Statistici"
      >
        <DashboardStats
          stats={stats}
          loadingStats={loadingStats}
        />
      </motion.section>

      {/* PANOURI INFORMAȚII ȘI ȘTIRI */}
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
