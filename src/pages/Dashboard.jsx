
import {
  Megaphone,
  FileText,
  Scale,
  Info,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Dashboard.css";

const initialStats = {
  telegrame: 0,
  ordine: 0,
  legislatie: 0,
  informatii_utile: 0,
  utilizatori: 0,
};

const sections = [
  {
    key: "telegrame",
    title: "Telegrame",
    path: "/telegrame",
    icon: Megaphone,
  },
  {
    key: "ordine",
    title: "Ordine interne",
    path: "/ordine",
    icon: FileText,
  },
  {
    key: "legislatie",
    title: "Acte legislative",
    path: "/legislatie",
    icon: Scale,
  },
  {
    key: "informatii_utile",
    title: "Informații utile",
    path: "/informatii-utile",
    icon: Info,
  },
];

const recentTypes = {
  telegrama: {
    label: "Telegramă nouă",
    path: "/telegrame",
    icon: Megaphone,
    className: "telegram",
  },
  ordin: {
    label: "Ordin intern",
    path: "/ordine",
    icon: FileText,
    className: "order",
  },
  legislatie: {
    label: "Act legislativ",
    path: "/legislatie",
    icon: Scale,
    className: "law",
  },
  informatii: {
    label: "Informație utilă",
    path: "/informatii-utile",
    icon: Info,
    className: "info",
  },
};

function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(initialStats);
  const [recent, setRecent] = useState([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoadingStats(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get("/dashboard/stats");

      const data = response.data;

      if (!data || !data.stats) {
        throw new Error("Răspuns invalid de la server.");
      }

      const normalizedStats = {};

      Object.keys(initialStats).forEach((key) => {
        normalizedStats[key] = Number(data.stats[key] ?? 0);
      });

      setStats(normalizedStats);
      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch (err) {
      console.error("Eroare Dashboard:", err);

      setError(
        err.response?.data?.message ||
          "Datele nu au putut fi încărcate. Verifică conexiunea cu serverul.",
      );
    } finally {
  console.log("Dashboard: cererea s-a terminat");
  setLoadingStats(false);
  setRefreshing(false);
}
  }, []);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        loadDashboard(false);
      }
    };

    document.addEventListener("visibilitychange", handleFocus);
console.log("Dashboard render:", {
  loadingStats,
  refreshing,
  stats,
  recentCount: recent.length,
});
    return () => {
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [loadDashboard]);

  return (
    <div className="dashboard">
      


{/* BANNER BORDER */}
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
          <button
            type="button"
            onClick={() => loadDashboard(true)}
          >
            Reîncearcă
          </button>
        </div>
      )}

      <div className="stats-grid">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <button
              key={section.key}
              type="button"
              className="stat-card stat-card-clickable"
              onClick={() => navigate(section.path)}
              title={`Deschide ${section.title}`}
            >
              <div className="stat-icon">
                <Icon size={24} />
              </div>

              <div className="stat-content">
                <span>{section.title}</span>
                <strong>
                  {loadingStats ? "..." : stats[section.key]}
                </strong>
              </div>

              <ArrowRight
                size={17}
                className="stat-arrow"
              />
            </button>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Ultimele informații</h2>
              <p>Documente adăugate recent</p>
            </div>

            <RefreshCw
              size={19}
              className={refreshing ? "refresh-spin" : ""}
              style={{ cursor: "pointer" }}
              onClick={() => loadDashboard(false)}
              aria-label="Actualizează informațiile"
            />
          </div>

          <div className="information-list">
            {loadingStats ? (
              <p className="dashboard-empty">
                Se încarcă informațiile...
              </p>
            ) : recent.length === 0 ? (
              <p className="dashboard-empty">
                Nu există documente recente.
              </p>
            ) : (
              recent.map((item) => {
                const config = recentTypes[item.type];

                if (!config) return null;

                const Icon = config.icon;

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    className="information-item information-item-button"
                    onClick={() =>
                      navigate(`${config.path}/${item.id}`)
                    }
                  >
                    <div
                      className={`item-icon ${config.className}`}
                    >
                      <Icon size={19} />
                    </div>

                    <div className="information-content">
                      <strong>{config.label}</strong>
                      <p>{item.title}</p>
                      <small>
                        {item.created_at
                          ? new Date(
                              item.created_at,
                            ).toLocaleDateString("ro-RO")
                          : ""}
                      </small>
                    </div>

                    <ArrowRight
                      size={17}
                      className="information-arrow"
                    />
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Acces rapid</h2>
              <p>Secțiuni utilizate frecvent</p>
            </div>
          </div>

          <div className="quick-links">
            {sections.map((section) => {
              const Icon = section.icon;

              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => navigate(section.path)}
                >
                  <Icon size={20} />
                  <span>{section.title}</span>
                  <ArrowRight size={17} />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;

