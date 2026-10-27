import {
  Megaphone,
  FileText,
  Scale,
  Info,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Newspaper,
  ExternalLink,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Dashboard.css";

const NEWS_SOURCE = "https://www.border.gov.md/noutati";

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

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ro-RO");
};

const isOfficialNewsUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      ["border.gov.md", "www.border.gov.md"].includes(
        url.hostname.toLowerCase(),
      )
    );
  } catch {
    return false;
  }
};

function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(initialStats);
  const [recent, setRecent] = useState([]);
  const [news, setNews] = useState([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingNews, setLoadingNews] = useState(true);

  const [error, setError] = useState("");
  const [newsError, setNewsError] = useState("");

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
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  const loadNews = useCallback(async () => {
    try {
      setLoadingNews(true);
      setNewsError("");

      const response = await api.get("/news");

      const articles = Array.isArray(response.data?.articles)
        ? response.data.articles
        : [];

      const validArticles = articles.filter(
        (article) =>
          typeof article.title === "string" &&
          article.title.trim() &&
          isOfficialNewsUrl(article.url),
      );

      setNews(validArticles.slice(0, 5));
    } catch (err) {
      console.error("Eroare la încărcarea știrilor:", err);

      setNewsError("Noutățile nu sunt disponibile momentan.");
    } finally {
      setLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
    loadNews();
  }, [loadDashboard, loadNews]);

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

  const handleRefresh = () => {
    loadDashboard(false);
    loadNews();
  };

  return (
    <div className="dashboard">
      {/* Banner FRONTIERĂ */}
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

      {/* Statistici */}
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
                <strong>{loadingStats ? "..." : stats[section.key]}</strong>
              </div>

              <ArrowRight size={17} className="stat-arrow" />
            </button>
          );
        })}
      </div>

      <div className="dashboard-grid">
        {/* Ultimele informații */}
        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Ultimele informații</h2>
              <p>Documente adăugate recent</p>
            </div>

            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={() => loadDashboard(false)}
              disabled={refreshing}
              aria-label="Actualizează informațiile"
              title="Actualizează informațiile"
            >
              <RefreshCw
                size={19}
                className={refreshing ? "refresh-spin" : ""}
              />
            </button>
          </div>

          <div className="information-list">
            {loadingStats ? (
              <p className="dashboard-empty">Se încarcă informațiile...</p>
            ) : recent.length === 0 ? (
              <p className="dashboard-empty">Nu există documente recente.</p>
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
                    onClick={() => navigate(`${config.path}/${item.id}`)}
                  >
                    <div className={`item-icon ${config.className}`}>
                      <Icon size={19} />
                    </div>

                    <div className="information-content">
                      <strong>{config.label}</strong>
                      <p>{item.title}</p>
                      <small>{formatDate(item.created_at)}</small>
                    </div>

                    <ArrowRight size={17} className="information-arrow" />
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Noutăți de frontieră */}
        <section className="dashboard-card border-news-card">
          <div className="card-header">
            <div>
              <h2 className="border-news-heading">
                <Newspaper size={19} />
                Noutăți de frontieră
              </h2>

              <p>Controale, depistări și evenimente recente</p>
            </div>

            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={handleRefresh}
              disabled={loadingNews}
              aria-label="Actualizează noutățile"
              title="Actualizează noutățile"
            >
              <RefreshCw
                size={19}
                className={loadingNews ? "refresh-spin" : ""}
              />
            </button>
          </div>

          <div className="border-news-list">
            {loadingNews ? (
              <div className="border-news-state">Se încarcă noutățile...</div>
            ) : newsError ? (
              <div className="border-news-state">
                <AlertCircle size={20} />
                <span>{newsError}</span>
                <button type="button" onClick={loadNews}>
                  Reîncearcă
                </button>
              </div>
            ) : news.length === 0 ? (
              <div className="border-news-state">
                Nu există noutăți disponibile.
              </div>
            ) : (
              news.map((article, index) => (
                <a
                  key={article.id || article.url || index}
                  className="border-news-item"
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="border-news-icon">
                    <Newspaper size={19} />
                  </div>

                  <div className="border-news-content">
                    <span className="border-news-source">
                      POLIȚIA DE FRONTIERĂ
                    </span>

                    <strong>{article.title}</strong>

                    <small>{formatDate(article.published_at)}</small>
                  </div>

                  <ArrowUpRight size={17} className="border-news-arrow" />
                </a>
              ))
            )}
          </div>

          <a
            className="border-news-footer"
            href={NEWS_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
          >
            Vezi toate știrile oficiale
            <ExternalLink size={16} />
          </a>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
