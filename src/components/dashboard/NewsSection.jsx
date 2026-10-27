import {
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Newspaper,
  Plus,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import NewsCard from "./NewsCard";
import NewsForm from "./NewsForm";
import NewsModal from "./NewsModal";
import ImageLightbox from "./ImageLightbox";
import PrivateNewsImage from "./PrivateNewsImage";
import "./NewsSection.css";

const emptyForm = {
  title: "",
  type: "internal",
  url: "",
  content: "",
  category: "altele",
  source: "",
  image_url: "",
};

const MAX_FILES = 10;
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const acceptedFileTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

const getFileCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "word";
};

const getFileName = (attachment) =>
  attachment.original_name || attachment.name || "Document";

const isImageAttachment = (attachment) =>
  attachment.attachment_type === "file" && attachment.file_category === "image";

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
  const [news, setNews] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [loadingNews, setLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState("");
  const [newsMessage, setNewsMessage] = useState("");
  const [role, setRole] = useState("USER");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showAllNews, setShowAllNews] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [newsAttachments, setNewsAttachments] = useState({});
  const [attachmentsLoading, setAttachmentsLoading] = useState({});
  const [uploadProgress, setUploadProgress] = useState("");
  const [removingAttachmentId, setRemovingAttachmentId] = useState(null);
  const canEdit = role === "ADMIN" || role === "EDITOR";
  const canDelete = role === "ADMIN";

  // ATAȘAMENTE
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

  // ȘTIRI ȘI FOTOGRAFII
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

      // Încărcăm atașamentele tuturor noutăților.
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

  // UTILIZATOR
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
    loadNews();
    loadUser();
  }, [loadNews, loadUser]);

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

  // FORMULAR
  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setSelectedFiles([]);
    setUploadProgress("");
  };

  const openCreateForm = () => {
    setNewsError("");
    setNewsMessage("");
    setEditingId(null);
    setForm({ ...emptyForm });
    setSelectedFiles([]);
    setUploadProgress("");
    setShowForm(true);
  };

  const openEditForm = async (article) => {
    setNewsError("");
    setNewsMessage("");
    setEditingId(article.id);

    setForm({
      title: article.title || "",
      type: article.type || "external",
      url: article.url || "",
      content: article.content || "",
      category: article.category || "altele",
      source: article.source || "",
      image_url: article.image_url || "",
    });

    setSelectedFiles([]);
    setUploadProgress("");
    setShowForm(true);

    try {
      await loadNewsAttachments(article.id);
    } catch {
      setNewsError("Atașamentele existente nu au putut fi încărcate.");
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // SELECTARE FIȘIERE

  const handleSelectFiles = (event) => {
    const files = Array.from(event.target.files || []);

    event.target.value = "";

    if (files.length === 0) return;

    const invalid = files.find(
      (file) =>
        !acceptedFileTypes.has(file.type) ||
        file.size > MAX_FILE_SIZE ||
        file.size === 0,
    );

    if (invalid) {
      setNewsError(
        "Format sau dimensiune neacceptată. Sunt permise JPG, PNG, WEBP, PDF, DOC și DOCX, maximum 4 MB per fișier.",
      );
      return;
    }

    const existingAttachments =
      editingId !== null ? newsAttachments[editingId] || [] : [];

    const savedFiles = existingAttachments.filter(
      (attachment) => attachment.attachment_type === "file",
    );

    const totalFiles = savedFiles.length + selectedFiles.length + files.length;

    if (totalFiles > MAX_FILES) {
      const remaining = MAX_FILES - savedFiles.length - selectedFiles.length;

      setNewsError(
        `Poți încărca maximum ${MAX_FILES} fișiere pentru o noutate. Mai poți adăuga ${Math.max(0, remaining)} fișier(e).`,
      );
      return;
    }

    setSelectedFiles((current) => [...current, ...files]);

    setNewsError("");
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
  };

  // SALVARE ȘTIRE ȘI FIȘIERE
  const handleSaveNews = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    setNewsError("");
    setNewsMessage("");

    if (!form.title.trim()) {
      setNewsError("Introdu titlul știrii.");
      return;
    }

    if (form.type === "external" && !validUrl(form.url.trim())) {
      setNewsError("Introdu un link valid către articol.");
      return;
    }

    if (form.type === "internal" && !form.content.trim()) {
      setNewsError("Introdu textul știrii proprii.");
      return;
    }

    if (form.image_url?.trim() && !validUrl(form.image_url.trim())) {
      setNewsError("Introdu un URL HTTP/HTTPS valid pentru fotografie.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      url: form.type === "external" ? form.url.trim() : "",
      content: form.type === "internal" ? form.content.trim() : "",
      category: form.category,
      source: form.source.trim(),
      image_url: form.image_url?.trim() || "",
      images: editingId !== null
        ? news.find((item) => item.id === editingId)?.images || []
        : [],
    };

    let savedNewsId = editingId;
    let newsSaved = false;
    const wasEditing = editingId !== null;

    try {
      setSaving(true);

      if (wasEditing) {
        const response = await api.patch(`/news/${editingId}`, payload);

        savedNewsId = response.data?.article?.id || editingId;
      } else {
        const response = await api.post("/news", payload);

        savedNewsId = response.data?.article?.id;
      }

      if (!savedNewsId) {
        throw new Error("Serverul nu a returnat ID-ul noutății.");
      }

      newsSaved = true;

      // Dacă uploadul eșuează, articolul rămâne
      // în modul de editare, fără duplicare.
      setEditingId(savedNewsId);

      const filesToUpload = [...selectedFiles];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        setUploadProgress(
          `Se încarcă ${i + 1} din ${filesToUpload.length}: ${file.name}`,
        );

        const data = new FormData();

        data.append("entityType", "news");
        data.append("entityId", String(savedNewsId));
        data.append("fileCategory", getFileCategory(file));
        data.append("file", file);

        await api.post("/attachments/upload", data);

        setSelectedFiles((current) => current.filter((item) => item !== file));
      }

      setUploadProgress("");

      await loadNewsAttachments(savedNewsId);
      await loadNews();

      resetForm();

      setNewsMessage(
        wasEditing
          ? "Noutatea a fost actualizată cu succes."
          : "Noutatea a fost publicată cu succes.",
      );
    } catch (err) {
      console.error("SAVE NEWS ERROR:", err);

      setUploadProgress("");

      if (newsSaved) {
        setNewsError(
          "Noutatea a fost salvată, dar încărcarea unui fișier a eșuat. Articolul rămâne în modul de editare. Reîncearcă salvarea pentru fișierele rămase.",
        );

        try {
          await loadNews();
          await loadNewsAttachments(savedNewsId);
        } catch (refreshError) {
          console.error("REFRESH AFTER SAVE ERROR:", refreshError);
        }
      } else {
        setNewsError(
          err.response?.data?.message ||
            err.message ||
            "Noutatea nu a putut fi salvată.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // DESCĂRCARE FIȘIER PRIVAT
  const handleDownloadAttachment = async (attachment) => {
    try {
      await downloadPrivateAttachment(attachment);
    } catch (err) {
      console.error("DOWNLOAD ATTACHMENT ERROR:", err);

      setNewsError("Fișierul nu a putut fi descărcat.");
    }
  };

  // ȘTERGERE ATAȘAMENT
  const handleRemoveAttachment = async (attachment) => {
    if (!canDelete || removingAttachmentId !== null) {
      return;
    }

    if (
      !window.confirm(
        `Sigur dorești să ștergi fișierul "${getFileName(attachment)}"?`,
      )
    ) {
      return;
    }

    try {
      setRemovingAttachmentId(attachment.id);
      setNewsError("");

      await api.delete(`/attachments/${attachment.id}`);

      await loadNewsAttachments(attachment.entity_id);

      setNewsMessage("Atașamentul a fost șters.");
    } catch (err) {
      console.error("DELETE ATTACHMENT ERROR:", err);

      setNewsError(
        err.response?.data?.message || "Atașamentul nu a putut fi șters.",
      );
    } finally {
      setRemovingAttachmentId(null);
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

      if (files.length > 0) {
        setNewsError(
          `Această noutate are ${files.length} fișier(e) atașat(e). Șterge mai întâi atașamentele din formularul de editare, apoi șterge noutatea.`,
        );
        return;
      }

      await api.delete(`/news/${id}`);
      await loadNews();

      if (editingId === id) {
        resetForm();
      }

      if (selectedArticle?.id === id) {
        setSelectedArticle(null);
      }

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

  const displayedNews = showAllNews ? news : news.slice(0, 2);

  const editingAttachments =
    editingId !== null ? newsAttachments[editingId] || [] : [];

  const selectedArticleAttachments = selectedArticle
    ? newsAttachments[selectedArticle.id] || []
    : [];

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
            {canEdit && (
              <button
                type="button"
                className="border-news-add"
                disabled={saving}
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

        {/* FORMULAR MODERN */}
        {showForm && canEdit && (
          <NewsForm
            editingId={editingId}
            form={form}
            saving={saving}
            selectedFiles={selectedFiles}
            editingAttachments={editingAttachments}
            attachmentsLoading={attachmentsLoading}
            uploadProgress={uploadProgress}
            removingAttachmentId={removingAttachmentId}
            canDelete={canDelete}
            onSubmit={handleSaveNews}
            onCancel={resetForm}
            updateForm={updateForm}
            setForm={setForm}
            handleSelectFiles={handleSelectFiles}
            removeSelectedFile={removeSelectedFile}
            handleDownloadAttachment={handleDownloadAttachment}
            handleRemoveAttachment={handleRemoveAttachment}
          />
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
                onEdit={openEditForm}
                onDelete={handleDeleteNews}
              />
            ))
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
      {/* MODAL ȘTIRE PROPRIE */}
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
        PrivateImageComponent={PrivateNewsImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}

export default NewsSection;
