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
  Plus,
  Pencil,
  Trash2,
  X,
  ExternalLink,
  Image as ImageIcon,
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

const categories = [
  { value: "documente", label: "Documente falsificate" },
  { value: "transport", label: "Control transport" },
  { value: "contrabanda", label: "Contrabandă" },
  { value: "migratie", label: "Migrație ilegală" },
  { value: "altele", label: "Alte noutăți" },
];

const emptyForm = {
  title: "",
  url: "",
  category: "altele",
  source: "",
  image_url: "",
};

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ro-RO");
};

const validUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

function NewsImage({ src, title }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || !validUrl(src) || failed) {
    return (
      <div className="border-news-photo border-news-placeholder">
        <ImageIcon size={30} />
      </div>
    );
  }

  return (
    <div className="border-news-photo">
      <img
        src={src}
        alt={title}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

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
  const [newsMessage, setNewsMessage] = useState("");

  const [role, setRole] = useState("USER");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [showAllNews, setShowAllNews] = useState(false);

  const canEdit = role === "ADMIN" || role === "EDITOR";
  const canDelete = role === "ADMIN";

  const loadDashboard = useCallback(async (initial = false) => {
    try {
      if (initial) setLoadingStats(true);
      else setRefreshing(true);

      setError("");

      const response = await api.get("/dashboard/stats");
      const data = response.data;

      if (!data?.stats) {
        throw new Error("Răspuns invalid de la server.");
      }

      const normalizedStats = {};

      Object.keys(initialStats).forEach((key) => {
        normalizedStats[key] = Number(data.stats[key] ?? 0);
      });

      setStats(normalizedStats);
      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch (err) {
      console.error("Dashboard:", err);

      setError(
        err.response?.data?.message || "Datele nu au putut fi încărcate.",
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

      setNews(
        articles.filter(
          (article) =>
            typeof article.title === "string" &&
            article.title.trim() &&
            validUrl(article.url),
        ),
      );
    } catch (err) {
      console.error("NEWS ERROR:", err);

      setNewsError(
        err.response?.data?.message || "Noutățile nu au putut fi încărcate.",
      );
    } finally {
      setLoadingNews(false);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");

      const user =
        response.data?.user || response.data?.data?.user || response.data;

      setRole(user?.role || "USER");
    } catch (err) {
      console.error("USER ROLE ERROR:", err);
      setRole("USER");
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
    loadNews();
    loadUser();
  }, [loadDashboard, loadNews, loadUser]);

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

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const openCreateForm = () => {
    setNewsMessage("");
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEditForm = (article) => {
    setNewsMessage("");
    setEditingId(article.id);

    setForm({
      title: article.title || "",
      url: article.url || "",
      category: article.category || "altele",
      source: article.source || "",
      image_url: article.image_url || "",
    });

    setShowForm(true);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveNews = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    setNewsError("");
    setNewsMessage("");

    if (!form.title.trim()) {
      setNewsError("Introdu titlul știrii.");
      return;
    }

    if (!validUrl(form.url.trim())) {
      setNewsError("Introdu un link valid către articol.");
      return;
    }

    if (form.image_url.trim() && !validUrl(form.image_url.trim())) {
      setNewsError("Linkul imaginii nu este valid.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      url: form.url.trim(),
      category: form.category,
      source: form.source.trim(),
      image_url: form.image_url.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        await api.patch(`/news/${editingId}`, payload);
      } else {
        await api.post("/news", payload);
      }

      resetForm();
      await loadNews();

      setNewsMessage(
        editingId
          ? "Noutatea a fost actualizată."
          : "Noutatea a fost adăugată.",
      );
    } catch (err) {
      console.error("SAVE NEWS ERROR:", err);

      setNewsError(
        err.response?.data?.message || "Noutatea nu a putut fi salvată.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNews = async (id) => {
    if (!canDelete || deletingId) return;

    if (!window.confirm("Sigur dorești să ștergi această noutate?")) {
      return;
    }

    try {
      setDeletingId(id);
      setNewsError("");
      setNewsMessage("");

      await api.delete(`/news/${id}`);
      await loadNews();

      if (editingId === id) resetForm();

      setNewsMessage("Noutatea a fost ștearsă.");
    } catch (err) {
      console.error("DELETE NEWS ERROR:", err);

      setNewsError(
        err.response?.data?.message || "Noutatea nu a putut fi ștearsă.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const displayedNews = showAllNews ? news : news.slice(0, 2);

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
      <div className="stats-grid">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <button
              key={section.key}
              type="button"
              className="stat-card stat-card-clickable"
              onClick={() => navigate(section.path)}
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
        {/* ULTIMELE INFORMAȚII */}
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

          <button
            type="button"
            className="border-news-show-all"
            onClick={() => navigate("/informatii-utile")}
          >
            Vezi toate informațiile
            <ArrowRight size={17} />
          </button>
        </section>

        {/* NOUTĂȚI DE FRONTIERĂ */}
        <section className="dashboard-card border-news-card">
          <div className="card-header">
            <div>
              <h2 className="border-news-heading">
                <Newspaper size={19} />
                Actualitate și securitate la frontieră
              </h2>
              <p>Știri naționale și internaționale • Controale • Depistări</p>
            </div>

            <div className="border-news-header-actions">
              {canEdit && (
                <button
                  type="button"
                  className="border-news-add"
                  onClick={() => (showForm ? resetForm() : openCreateForm())}
                >
                  {showForm ? <X size={17} /> : <Plus size={17} />}
                  {showForm ? "Anulează" : "Adaugă"}
                </button>
              )}

              <button
                type="button"
                className="dashboard-refresh-button"
                onClick={loadNews}
                disabled={loadingNews}
                aria-label="Actualizează noutățile"
              >
                <RefreshCw
                  size={19}
                  className={loadingNews ? "refresh-spin" : ""}
                />
              </button>
            </div>
          </div>

          {newsMessage && (
            <div className="border-news-success" role="status">
              {newsMessage}
            </div>
          )}

          {newsError && (
            <div className="border-news-error" role="alert">
              <AlertCircle size={17} />
              <span>{newsError}</span>
            </div>
          )}

          {/* FORMULAR */}
          {showForm && canEdit && (
            <form className="border-news-form" onSubmit={handleSaveNews}>
              <h3>{editingId ? "Editează noutatea" : "Adaugă o noutate"}</h3>

              <label>
                Titlul știrii *
                <input
                  type="text"
                  value={form.title}
                  maxLength={300}
                  required
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="Titlul articolului"
                />
              </label>

              <label>
                Link către articol *
                <input
                  type="url"
                  value={form.url}
                  maxLength={2048}
                  required
                  onChange={(e) => updateForm("url", e.target.value)}
                  placeholder="https://site.md/articol"
                />
              </label>

              <div className="border-news-form-grid">
                <label>
                  Categorie
                  <select
                    value={form.category}
                    onChange={(e) => updateForm("category", e.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Sursa
                  <input
                    type="text"
                    value={form.source}
                    maxLength={150}
                    onChange={(e) => updateForm("source", e.target.value)}
                    placeholder="Ex.: Poliția de Frontieră"
                  />
                </label>
              </div>

              <label>
                Link imagine (opțional)
                <input
                  type="url"
                  value={form.image_url}
                  maxLength={2048}
                  onChange={(e) => updateForm("image_url", e.target.value)}
                  placeholder="https://site.md/fotografie.jpg"
                />
              </label>

              {form.image_url && validUrl(form.image_url) && (
                <div className="border-news-preview">
                  <NewsImage
                    src={form.image_url}
                    title="Previzualizare imagine"
                  />
                </div>
              )}

              <div className="border-news-form-actions">
                <button
                  type="button"
                  className="border-news-cancel"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Anulează
                </button>

                <button
                  type="submit"
                  className="border-news-add"
                  disabled={saving}
                >
                  {saving
                    ? "Se salvează..."
                    : editingId
                      ? "Salvează modificările"
                      : "Publică noutatea"}
                </button>
              </div>
            </form>
          )}

          {/* LISTA DE ȘTIRI */}
          <div className="border-news-list">
            {loadingNews ? (
              <div className="border-news-state">Se încarcă noutățile...</div>
            ) : news.length === 0 ? (
              <div className="border-news-state">
                Nu există noutăți disponibile.
              </div>
            ) : (
              displayedNews.map((article) => {
                const category = categories.find(
                  (item) => item.value === article.category,
                );

                return (
                  <article
                    key={article.id}
                    className="border-news-article border-news-clickable"
                    role="link"
                    tabIndex={0}
                    aria-label={`Deschide articolul: ${article.title}`}
                    onClick={(event) => {
                      if (event.target instanceof Element && event.target.closest("a, button")) return;

                      window.open(article.url, "_blank", "noopener,noreferrer");
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();

                        window.open(
                          article.url,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }
                    }}
                  >
                    <NewsImage src={article.image_url} title={article.title} />

                    <div className="border-news-article-body">
                      <div className="border-news-meta">
                        <span
                          className={`border-news-category category-${article.category}`}
                        >
                          {category?.label || "Noutăți"}
                        </span>

                        {article.source && (
                          <span className="border-news-source-name">
                            {article.source}
                          </span>
                        )}

                        <time>{formatDate(article.created_at)}</time>
                      </div>

                      <h3>{article.title}</h3>

                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-news-read"
                      >
                        Citește articolul
                        <ExternalLink size={15} />
                      </a>

                      {canEdit && (
                        <div className="border-news-article-actions">
                          <button
                            type="button"
                            onClick={() => openEditForm(article)}
                          >
                            <Pencil size={15} />
                            Editează
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              className="border-news-delete"
                              onClick={() => handleDeleteNews(article.id)}
                              disabled={deletingId === article.id}
                            >
                              <Trash2 size={15} />
                              Șterge
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-news-open-icon"
                      aria-label={`Deschide articolul ${article.title}`}
                    >
                      <ArrowUpRight size={18} />
                    </a>
                  </article>
                );
              })
            )}
          </div>

          {news.length > 2 && (
            <button
              type="button"
              className="border-news-show-all"
              onClick={() => setShowAllNews((current) => !current)}
            >
              {showAllNews
                ? "Afișează mai puține"
                : `Vezi toate noutățile (${news.length})`}
              <ArrowRight size={17} />
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
