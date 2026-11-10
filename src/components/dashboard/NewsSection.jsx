import { ArrowRight, AlertCircle, Newspaper, Plus, Image as ImageIcon } from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../../services/api";

import NewsCard from "./NewsCard";
import NewsModal from "./NewsModal";
import TelegramGallery from "../TelegramGallery";
import PrivateNewsImage from "./PrivateNewsImage";

import "./NewsSection.css";

// VALIDARE URL
const validUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.hostname.includes(".") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

// NUMELE FIȘIERULUI
const validIdNews = (id) => /^[1-9]\d*$/.test(String(id));

const getFileName = (attachment) => attachment.original_name || attachment.name || "Document";

// VERIFICARE FOTOGRAFIE
const isImageAttachment = (attachment) =>
  attachment.attachment_type === "file" && attachment.file_category === "image";

// IMAGINE PUBLICĂ
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

// DESCĂRCARE ATAȘAMENT PRIVAT
async function downloadPrivateAttachment(attachment) {
  const response = await api.get(`/attachments/file/${attachment.id}`, {
    responseType: "blob",
  });

  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = getFileName(attachment);

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function NewsSection() {
  const navigate = useNavigate();
  const location = useLocation();
  const deepLinkHandledRef = useRef(null);
  const [highlightedNewsId, setHighlightedNewsId] = useState(null);

  // ȘTIRI
  const [news, setNews] = useState([]);
  const [counts, setCounts] = useState({});
  const [totalNews, setTotalNews] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedLimit, setExpandedLimit] = useState(2);
  const requestSequence = useRef(0);
  const [loadingNews, setLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState("");
  const [newsMessage, setNewsMessage] = useState("");

  // PERMISIUNI
  const [role, setRole] = useState("USER");

  const canEdit = role === "ADMIN" || role === "EDITOR";

  const canDelete = role === "ADMIN";

  // LISTĂ
  const [showAllNews, setShowAllNews] = useState(false);
  const [activeCategory, setActiveCategory] = useState("toate");
  const [deletingId, setDeletingId] = useState(null);

  // MODAL ȘI FOTOGRAFII
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // ATAȘAMENTE
  const [newsAttachments, setNewsAttachments] = useState({});
  const [attachmentsLoading, setAttachmentsLoading] = useState({});

  // ÎNCĂRCARE ATAȘAMENTE
  const loadNewsAttachments = useCallback(async (newsId) => {
    setAttachmentsLoading((current) => ({
      ...current,
      [newsId]: true,
    }));

    try {
      const response = await api.get(`/attachments/news/${newsId}`);

      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];

      setNewsAttachments((current) => ({
        ...current,
        [newsId]: attachments,
      }));

      return attachments;
    } catch (err) {
      console.error("NEWS ATTACHMENTS ERROR:", err);
      throw err;
    } finally {
      setAttachmentsLoading((current) => ({
        ...current,
        [newsId]: false,
      }));
    }
  }, []);

  // ÎNCĂRCARE ȘTIRI: doar lotul solicitat, fără N cereri pentru atașamente.
  const loadNews = useCallback(async (category = "toate", limit = 2) => {
    const sequence = ++requestSequence.current;
    try {
      setLoadingNews(true);
      setNewsError("");
      const response = await api.get("/news", { params: { category, limit, offset: 0 } });
      if (sequence !== requestSequence.current) return;
      setNews(Array.isArray(response.data?.articles) ? response.data.articles : []);
      setCounts(response.data?.counts || {});
      setTotalNews(Number(response.data?.total || 0));
      setHasMore(Boolean(response.data?.hasMore));
      setExpandedLimit(limit);
      setNewsAttachments({});
    } catch (err) {
      if (sequence === requestSequence.current) {
        console.error("NEWS ERROR:", err);
        setNewsError(err.response?.data?.message || "Noutățile nu au putut fi încărcate.");
      }
    } finally {
      if (sequence === requestSequence.current) setLoadingNews(false);
    }
  }, []);

  const loadMoreNews = useCallback(async () => {
    if (loadingMore || loadingNews || !hasMore) return;
    const sequence = requestSequence.current;
    setLoadingMore(true);
    try {
      const response = await api.get("/news", {
        params: { category: activeCategory, limit: 10, offset: news.length },
      });
      if (sequence !== requestSequence.current) return;
      const next = Array.isArray(response.data?.articles) ? response.data.articles : [];
      setNews((current) => {
        const known = new Set(current.map((article) => String(article.id)));
        return [...current, ...next.filter((article) => !known.has(String(article.id)))];
      });
      setHasMore(Boolean(response.data?.hasMore));
      setCounts(response.data?.counts || {});
      setTotalNews(Number(response.data?.total || 0));
    } catch (err) {
      if (sequence === requestSequence.current) {
        setNewsError(err.response?.data?.message || "Nu s-au putut încărca alte noutăți.");
      }
    } finally {
      if (sequence === requestSequence.current) setLoadingMore(false);
    }
  }, [activeCategory, hasMore, loadingMore, loadingNews, news.length]);

  // ÎNCĂRCARE ROL UTILIZATOR
  const loadUser = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");

      const user = response.data?.user || response.data?.data?.user || response.data;

      setRole(user?.role || "USER");
    } catch (err) {
      console.error("USER ROLE ERROR:", err);
      setRole("USER");
    }
  }, []);

  // ÎNCĂRCARE INIȚIALĂ
  useEffect(() => {
    loadNews("toate", 2);
    loadUser();
  }, [loadNews, loadUser]);

  // LINK DIN E-MAIL: ?open=ID. Funcționează și când articolul nu este
  // inclus în primele 100 de rezultate ale listei.
  useEffect(() => {
    if (loadingNews || newsError) return;

    const requestedId = new URLSearchParams(location.search).get("open");
    if (!requestedId || !/^[1-9]\d*$/.test(requestedId)) return;

    const key = `${location.pathname}:${requestedId}`;
    if (deepLinkHandledRef.current === key) return;
    let cancelled = false;

    const locateArticle = async () => {
      try {
        let article = news.find((item) => String(item.id) === requestedId);
        if (!article) {
          const response = await api.get(`/news/${requestedId}`);
          article = response.data?.article;
          if (article && !cancelled) {
            setNews((current) =>
              current.some((item) => String(item.id) === requestedId)
                ? current
                : [article, ...current],
            );
          }
        }

        if (cancelled) return;
        if (!article) {
          setNewsError("Știrea din notificare nu a fost găsită.");
          return;
        }

        deepLinkHandledRef.current = key;
        setShowAllNews(true);
        setHighlightedNewsId(requestedId);
        setActiveCategory("toate");

        // Știrile proprii se deschid în modalul deja existent.
        // Știrile externe rămân evidențiate în listă; un clic deschide sursa.
        if (article.type === "internal") {
          setSelectedArticle(article);
          try {
            await loadNewsAttachments(article.id);
          } catch (error) {
            console.error("DEEP LINK NEWS ATTACHMENTS:", error);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setNewsError(
            error.response?.status === 404
              ? "Știrea din notificare nu mai există."
              : "Știrea din notificare nu a putut fi încărcată.",
          );
        }
      }
    };

    locateArticle();
    return () => {
      cancelled = true;
    };
  }, [loadingNews, newsError, news, location.pathname, location.search, loadNewsAttachments]);

  useEffect(() => {
    if (!highlightedNewsId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const element = document.querySelector(`[data-news-deep-link-id="${highlightedNewsId}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightedNewsId, showAllNews, news]);

  // ÎNCHIDERE MODAL CU ESCAPE
  useEffect(() => {
    if (!selectedArticle || galleryOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedArticle(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedArticle, galleryOpen]);

  // ADAUGĂ ȘTIRE — PAGINĂ SEPARATĂ
  const openAddPage = () => {
    navigate("/stiri/adauga");
  };

  // EDITEAZĂ ȘTIRE — PAGINĂ SEPARATĂ
  const openEditPage = (article) => {
    if (!canEdit || !article?.id) return;

    navigate(`/stiri/${article.id}/edit`);
  };

  // DESCĂRCARE ATAȘAMENT
  const handleDownloadAttachment = async (attachment) => {
    try {
      await downloadPrivateAttachment(attachment);
    } catch (err) {
      console.error("DOWNLOAD ATTACHMENT ERROR:", err);

      setNewsError("Fișierul nu a putut fi descărcat.");
    }
  };

  // ȘTERGERE ȘTIRE ȘI ATAȘAMENTE — backendul gestionează fișierele.
  const handleDeleteNews = async (id) => {
    if (!canDelete || deletingId !== null || !validIdNews(id)) return;

    if (
      !window.confirm(
        "Sigur dorești să ștergi această noutate și toate fișierele atașate? Acțiunea nu poate fi anulată.",
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      setNewsError("");
      setNewsMessage("");

      // Nu blocăm ștergerea pentru că există atașamente.
      // Endpointul DELETE /news/:id trebuie să le gestioneze tranzacțional.
      const response = await api.delete(`/news/${id}`);

      setNews((current) => current.filter((article) => String(article.id) !== String(id)));
      setNewsAttachments((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      if (String(selectedArticle?.id) === String(id)) {
        setPreviewImage(null);
        setGalleryOpen(false);
        setSelectedArticle(null);
      }

      setNewsMessage(response.data?.message || "Noutatea a fost ștearsă cu succes.");
    } catch (err) {
      console.error("DELETE NEWS ERROR:", err);
      setNewsError(err.response?.data?.message || "Noutatea nu a putut fi ștearsă.");
    } finally {
      setDeletingId(null);
    }
  };

  // DESCHIDERE ARTICOL
  const openArticle = async (article) => {
    if (article.type !== "internal") {
      if (validUrl(article.url)) {
        window.open(article.url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    setSelectedArticle(article);

    try {
      await loadNewsAttachments(article.id);
    } catch {
      setNewsError("Atașamentele articolului nu au putut fi încărcate.");
    }
  };

  // Categoriile corespund exact valorilor validate în newsController.js.
  const categories = [
    { value: "toate", label: "Toate" },
    { value: "documente", label: "Documente falsificate" },
    { value: "transport", label: "Control transport" },
    { value: "contrabanda", label: "Contrabandă" },
    { value: "migratie", label: "Migrație ilegală" },
    { value: "altele", label: "Alte noutăți" },
  ];

  const filteredNews = news.filter(
    (article) => activeCategory === "toate" || article.category === activeCategory,
  );
  const displayedNews = showAllNews ? filteredNews : filteredNews.slice(0, 2);
  const categoryTotal =
    activeCategory === "toate" ? totalNews : Number(counts[activeCategory] || 0);

  // ATAȘAMENTE ARTICOL SELECTAT
  const selectedArticleAttachments = selectedArticle
    ? newsAttachments[selectedArticle.id] || []
    : [];

  // FOTOGRAFIA PRINCIPALĂ
  const getMainNewsImage = (newsId) => {
    const article = news.find((item) => String(item.id) === String(newsId));
    if (article?.mainImage) return article.mainImage;
    const attachments = newsAttachments[newsId] || [];

    return [...attachments]
      .filter(isImageAttachment)
      .sort((a, b) => Number(a.id) - Number(b.id))[0];
  };

  return (
    <>
      {/* ACTUALITATE */}
      <section className="dashboard-card border-news-card">
        {/* ANTET */}
        <div className="card-header border-news-header">
          <div className="border-news-header-content">
            <h2 className="border-news-heading">
              <Newspaper size={19} />
              Actualitate și securitate la frontieră
            </h2>

            <p>
              Știri naționale și internaționale
              {" • "}
              Controale
              {" • "}
              Depistări
            </p>
          </div>

          <div className="border-news-header-actions">
            {/* ADAUGĂ ȘTIRE */}
            {canEdit && (
              <button type="button" className="border-news-add" onClick={openAddPage}>
                <Plus size={17} />
                Adaugă știre
              </button>
            )}

            {/* ACTUALIZARE */}
          </div>
        </div>

        {/* MESAJ SUCCES */}
        {newsMessage && (
          <div className="border-news-success" role="status">
            {newsMessage}
          </div>
        )}

        {/* MESAJ EROARE */}
        {newsError && (
          <div className="border-news-error" role="alert">
            <AlertCircle size={17} />
            <span>{newsError}</span>
          </div>
        )}

        {/* FILTRE CATEGORII */}
        <div
          className="border-news-categories"
          role="group"
          aria-label="Filtrează noutățile după categorie"
        >
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              className={`border-news-filter-button ${activeCategory === category.value ? "is-active" : ""}`}
              aria-pressed={activeCategory === category.value}
              onClick={() => {
                setActiveCategory(category.value);
                setShowAllNews(false);
                setHighlightedNewsId(null);
                loadNews(category.value, 2);
              }}
            >
              {category.label}
              <span className="border-news-filter-count">
                {category.value === "toate" ? totalNews : Number(counts[category.value] || 0)}
              </span>
            </button>
          ))}
        </div>

        {/* LISTA ȘTIRILOR */}
        <div className="border-news-list">
          {loadingNews ? (
            <div className="border-news-state">Se încarcă noutățile...</div>
          ) : filteredNews.length === 0 ? (
            <div className="border-news-state">
              {categoryTotal === 0
                ? "Nu există noutăți disponibile."
                : "Nu există noutăți în categoria selectată."}
            </div>
          ) : (
            displayedNews.map((article) => (
              <div
                key={article.id}
                data-news-deep-link-id={String(article.id)}
                style={
                  highlightedNewsId === String(article.id)
                    ? {
                        outline: "3px solid #3b82f6",
                        outlineOffset: 4,
                        borderRadius: 14,
                      }
                    : undefined
                }
              >
                <NewsCard
                  article={article}
                  mainImage={getMainNewsImage(article.id)}
                  ImageComponent={NewsImage}
                  PrivateImageComponent={PrivateNewsImage}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  deletingId={deletingId}
                  onOpen={openArticle}
                  onEdit={openEditPage}
                  onDelete={handleDeleteNews}
                />
              </div>
            ))
          )}
        </div>

        {/* VEZI TOATE / PAGINARE PROGRESIVĂ */}
        {!showAllNews && categoryTotal > 2 && (
          <button
            type="button"
            className="border-news-show-all"
            onClick={async () => {
              setShowAllNews(true);
              // Primele 10 articole sunt preluate de backend doar la solicitare.
              await loadNews(activeCategory, 10);
            }}
          >
            {`Vezi toate noutățile (${categoryTotal})`}
            <ArrowRight size={17} />
          </button>
        )}
        {showAllNews && hasMore && (
          <button
            type="button"
            className="border-news-show-all"
            disabled={loadingMore}
            onClick={loadMoreNews}
          >
            {loadingMore ? "Se încarcă..." : "Încarcă mai multe"}
            <ArrowRight size={17} />
          </button>
        )}
        {showAllNews && !hasMore && categoryTotal > 2 && (
          <button
            type="button"
            className="border-news-show-all"
            onClick={() => {
              setShowAllNews(false);
              loadNews(activeCategory, 2);
            }}
          >
            Afișează mai puține <ArrowRight size={17} />
          </button>
        )}
      </section>

      {/* MODAL ARTICOL */}
      <NewsModal
        article={selectedArticle}
        attachments={selectedArticleAttachments}
        loading={selectedArticle ? Boolean(attachmentsLoading[selectedArticle.id]) : false}
        PrivateImageComponent={PrivateNewsImage}
        onClose={() => {
          setPreviewImage(null);
          setGalleryOpen(false);
          setSelectedArticle(null);
        }}
        onPreviewImage={(attachment) => {
          setPreviewImage(attachment);
          setGalleryOpen(Boolean(attachment));
        }}
        onDownloadAttachment={handleDownloadAttachment}
      />

      {/* GALERIE FOTOGRAFII */}
      {galleryOpen && selectedArticle && (
        <TelegramGallery
          entityType="news"
          entityId={selectedArticle.id}
          title={selectedArticle.title}
          initialAttachmentId={previewImage?.id}
          onClose={() => {
            setGalleryOpen(false);
            setPreviewImage(null);
          }}
        />
      )}
    </>
  );
}

export default NewsSection;
