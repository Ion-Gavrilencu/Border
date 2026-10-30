import {
  ArrowRight,
  AlertCircle,
  Newspaper,
  Plus,
  Image as ImageIcon,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";

import NewsCard from "./NewsCard";
import NewsModal from "./NewsModal";
import ImageLightbox from "./ImageLightbox";
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
const getFileName = (attachment) =>
  attachment.original_name || attachment.name || "Document";

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

  // ȘTIRI
  const [news, setNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState("");
  const [newsMessage, setNewsMessage] = useState("");

  // PERMISIUNI
  const [role, setRole] = useState("USER");

  const canEdit = role === "ADMIN" || role === "EDITOR";

  const canDelete = role === "ADMIN";

  // LISTĂ
  const [showAllNews, setShowAllNews] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // MODAL ȘI FOTOGRAFII
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

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

  // ÎNCĂRCARE ȘTIRI
  const loadNews = useCallback(async () => {
    try {
      setLoadingNews(true);
      setNewsError("");

      const response = await api.get("/news");

      const articles = Array.isArray(response.data?.articles)
        ? response.data.articles
        : [];

      const validArticles = articles.filter((article) => {
        if (typeof article.title !== "string" || !article.title.trim()) {
          return false;
        }

        if (article.type === "internal") {
          return typeof article.content === "string";
        }

        return validUrl(article.url);
      });

      setNews(validArticles);

      // ÎNCĂRCARE FOTOGRAFII ȘI DOCUMENTE
      const results = await Promise.allSettled(
        validArticles.map((article) =>
          api.get(`/attachments/news/${article.id}`),
        ),
      );

      const attachmentsByNews = {};

      results.forEach((result, index) => {
        const articleId = validArticles[index].id;

        attachmentsByNews[articleId] =
          result.status === "fulfilled" &&
          Array.isArray(result.value.data?.attachments)
            ? result.value.data.attachments
            : [];
      });

      setNewsAttachments(attachmentsByNews);
    } catch (err) {
      console.error("NEWS ERROR:", err);

      setNewsError(
        err.response?.data?.message || "Noutățile nu au putut fi încărcate.",
      );
    } finally {
      setLoadingNews(false);
    }
  }, []);

  // ÎNCĂRCARE ROL UTILIZATOR
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

  // ÎNCĂRCARE INIȚIALĂ
  useEffect(() => {
    loadNews();
    loadUser();
  }, [loadNews, loadUser]);

  // ÎNCHIDERE MODAL CU ESCAPE
  useEffect(() => {
    if (!selectedArticle || previewImage) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedArticle(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedArticle, previewImage]);

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

  // ȘTERGERE ȘTIRE
  const handleDeleteNews = async (id) => {
    if (!canDelete || deletingId !== null) {
      return;
    }

    if (!window.confirm("Sigur dorești să ștergi această noutate?")) {
      return;
    }

    try {
      setDeletingId(id);
      setNewsError("");
      setNewsMessage("");

      const attachments = await loadNewsAttachments(id);

      const files = attachments.filter(
        (item) => item.attachment_type === "file",
      );

      // NU ȘTERGEM ȘTIREA DACĂ ARE FIȘIERE
      if (files.length > 0) {
        setNewsError(
          `Această noutate are ${files.length} fișier(e) atașat(e). ` +
            "Șterge mai întâi atașamentele din pagina de editare, " +
            "apoi șterge noutatea.",
        );
        return;
      }

      await api.delete(`/news/${id}`);

      await loadNews();

      if (selectedArticle?.id === id) {
        setSelectedArticle(null);
      }

      setNewsMessage("Noutatea a fost ștearsă cu succes.");
    } catch (err) {
      console.error("DELETE NEWS ERROR:", err);

      setNewsError(
        err.response?.data?.message || "Noutatea nu a putut fi ștearsă.",
      );
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

  // ȘTIRI AFIȘATE
  const displayedNews = showAllNews ? news : news.slice(0, 2);

  // ATAȘAMENTE ARTICOL SELECTAT
  const selectedArticleAttachments = selectedArticle
    ? newsAttachments[selectedArticle.id] || []
    : [];

  // FOTOGRAFIA PRINCIPALĂ
  const getMainNewsImage = (newsId) => {
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
        <div className="card-header">
          <div>
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
              <button
                type="button"
                className="border-news-add"
                onClick={openAddPage}
              >
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

        {/* LISTA ȘTIRILOR */}
        <div className="border-news-list">
          {loadingNews ? (
            <div className="border-news-state">Se încarcă noutățile...</div>
          ) : news.length === 0 ? (
            <div className="border-news-state">
              Nu există noutăți disponibile.
            </div>
          ) : (
            displayedNews.map((article) => (
              <NewsCard
                key={article.id}
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
            ))
          )}
        </div>

        {/* VEZI TOATE */}
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

      {/* MODAL ARTICOL */}
      <NewsModal
        article={selectedArticle}
        attachments={selectedArticleAttachments}
        loading={
          selectedArticle
            ? Boolean(attachmentsLoading[selectedArticle.id])
            : false
        }
        PrivateImageComponent={PrivateNewsImage}
        onClose={() => {
          setPreviewImage(null);
          setSelectedArticle(null);
        }}
        onPreviewImage={setPreviewImage}
        onDownloadAttachment={handleDownloadAttachment}
      />

      {/* PREVIZUALIZARE FOTOGRAFIE */}
      <ImageLightbox
  attachment={previewImage}
  attachments={
    selectedArticle
      ? (newsAttachments[selectedArticle.id] || [])
          .filter(
            (item) =>
              item.attachment_type === "file" &&
              item.file_category === "image"
          )
          .sort((a, b) => Number(a.id) - Number(b.id))
      : []
  }
  PrivateImageComponent={PrivateNewsImage}
  onChange={setPreviewImage}
  onClose={() => setPreviewImage(null)}
/>
    </>
  );
}

export default NewsSection;
