
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
  UploadCloud,
  Paperclip,
  Download,
  File as FileIcon,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
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
  type: "internal",
  url: "",
  content: "",
  category: "altele",
  source: "",
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

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("ro-RO");
};

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

const formatFileSize = (bytes) => {
  const size = Number(bytes);

  if (!Number.isFinite(size)) return "";

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const isImageAttachment = (attachment) =>
  attachment.attachment_type === "file" &&
  attachment.file_category === "image";

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

// Fotografiile private se obțin exclusiv prin API-ul autentificat.
function PrivateNewsImage({ attachment, className = "" }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    setSrc("");
    setFailed(false);

    const loadImage = async () => {
      try {
        const response = await api.get(
          `/attachments/file/${attachment.id}`,
          { responseType: "blob" }
        );

        if (!active) return;

        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      } catch (error) {
        console.error("PRIVATE NEWS IMAGE ERROR:", error);

        if (active) setFailed(true);
      }
    };

    loadImage();

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment.id]);

  if (!src || failed) {
    return (
      <div
        className={`border-news-photo border-news-placeholder ${className}`}
      >
        <ImageIcon size={27} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={getFileName(attachment)}
      className={className}
      loading="lazy"
    />
  );
}

async function downloadPrivateAttachment(attachment) {
  const response = await api.get(
    `/attachments/file/${attachment.id}`,
    { responseType: "blob" }
  );

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

function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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

      setError(
        err.response?.data?.message ||
          "Datele nu au putut fi încărcate."
      );
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  // ATAȘAMENTE
  const loadNewsAttachments = useCallback(async (newsId) => {
    setAttachmentsLoading((current) => ({
      ...current,
      [newsId]: true,
    }));

    try {
      const response = await api.get(
        `/attachments/news/${newsId}`
      );

      const attachments = Array.isArray(
        response.data?.attachments
      )
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
        if (
          typeof article.title !== "string" ||
          !article.title.trim()
        ) {
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
          api.get(`/attachments/news/${article.id}`)
        )
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
        err.response?.data?.message ||
          "Noutățile nu au putut fi încărcate."
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
        response.data?.user ||
        response.data?.data?.user ||
        response.data;

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

  useEffect(() => {
    if (!selectedArticle) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedArticle(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [selectedArticle]);

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
    });

    setSelectedFiles([]);
    setUploadProgress("");
    setShowForm(true);

    try {
      await loadNewsAttachments(article.id);
    } catch {
      setNewsError(
        "Atașamentele existente nu au putut fi încărcate."
      );
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
        file.size === 0
    );

    if (invalid) {
      setNewsError(
        "Format sau dimensiune neacceptată. Sunt permise JPG, PNG, WEBP, PDF, DOC și DOCX, maximum 4 MB per fișier."
      );
      return;
    }

    const existingAttachments =
      editingId !== null
        ? newsAttachments[editingId] || []
        : [];

    const savedFiles = existingAttachments.filter(
      (attachment) =>
        attachment.attachment_type === "file"
    );

    const savedImages = savedFiles.filter(
      isImageAttachment
    );

    const selectedImages = selectedFiles.filter(
      (file) => file.type.startsWith("image/")
    );

    const incomingImages = files.filter(
      (file) => file.type.startsWith("image/")
    );

    if (
      savedImages.length +
        selectedImages.length +
        incomingImages.length >
      1
    ) {
      setNewsError(
        "Pentru fiecare noutate este permisă o singură fotografie. Pentru înlocuire, șterge mai întâi fotografia existentă."
      );
      return;
    }

    if (
      savedFiles.length +
        selectedFiles.length +
        files.length >
      MAX_FILES
    ) {
      setNewsError(
        `Poți încărca maximum ${MAX_FILES} fișiere pentru o noutate.`
      );
      return;
    }

    setSelectedFiles((current) => [
      ...current,
      ...files,
    ]);

    setNewsError("");
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((current) =>
      current.filter((_, i) => i !== index)
    );
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

    if (
      form.type === "external" &&
      !validUrl(form.url.trim())
    ) {
      setNewsError(
        "Introdu un link valid către articol."
      );
      return;
    }

    if (
      form.type === "internal" &&
      !form.content.trim()
    ) {
      setNewsError(
        "Introdu textul știrii proprii."
      );
      return;
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      url:
        form.type === "external"
          ? form.url.trim()
          : "",
      content:
        form.type === "internal"
          ? form.content.trim()
          : "",
      category: form.category,
      source: form.source.trim(),
      image_url: "",
      images: [],
    };

    let savedNewsId = editingId;
    let newsSaved = false;
    const wasEditing = editingId !== null;

    try {
      setSaving(true);

      if (wasEditing) {
        const response = await api.patch(
          `/news/${editingId}`,
          payload
        );

        savedNewsId =
          response.data?.article?.id || editingId;
      } else {
        const response = await api.post(
          "/news",
          payload
        );

        savedNewsId = response.data?.article?.id;
      }

      if (!savedNewsId) {
        throw new Error(
          "Serverul nu a returnat ID-ul noutății."
        );
      }

      newsSaved = true;

      // Dacă uploadul eșuează, articolul rămâne
      // în modul de editare, fără duplicare.
      setEditingId(savedNewsId);

      const filesToUpload = [...selectedFiles];

      for (
        let i = 0;
        i < filesToUpload.length;
        i++
      ) {
        const file = filesToUpload[i];

        setUploadProgress(
          `Se încarcă ${i + 1} din ${
            filesToUpload.length
          }: ${file.name}`
        );

        const data = new FormData();

        data.append("entityType", "news");
        data.append(
          "entityId",
          String(savedNewsId)
        );
        data.append(
          "fileCategory",
          getFileCategory(file)
        );
        data.append("file", file);

        await api.post(
          "/attachments/upload",
          data
        );

        setSelectedFiles((current) =>
          current.filter(
            (item) => item !== file
          )
        );
      }

      setUploadProgress("");

      await loadNewsAttachments(savedNewsId);
      await loadNews();

      resetForm();

      setNewsMessage(
        wasEditing
          ? "Noutatea a fost actualizată cu succes."
          : "Noutatea a fost publicată cu succes."
      );
    } catch (err) {
      console.error("SAVE NEWS ERROR:", err);

      setUploadProgress("");

      if (newsSaved) {
        setNewsError(
          "Noutatea a fost salvată, dar încărcarea unui fișier a eșuat. Articolul rămâne în modul de editare. Reîncearcă salvarea pentru fișierele rămase."
        );

        try {
          await loadNews();
          await loadNewsAttachments(savedNewsId);
        } catch (refreshError) {
          console.error(
            "REFRESH AFTER SAVE ERROR:",
            refreshError
          );
        }
      } else {
        setNewsError(
          err.response?.data?.message ||
            err.message ||
            "Noutatea nu a putut fi salvată."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // DESCĂRCARE FIȘIER PRIVAT
  const handleDownloadAttachment = async (
    attachment
  ) => {
    try {
      await downloadPrivateAttachment(
        attachment
      );
    } catch (err) {
      console.error(
        "DOWNLOAD ATTACHMENT ERROR:",
        err
      );

      setNewsError(
        "Fișierul nu a putut fi descărcat."
      );
    }
  };

  // ȘTERGERE ATAȘAMENT
  const handleRemoveAttachment = async (
    attachment
  ) => {
    if (
      !canDelete ||
      removingAttachmentId !== null
    ) {
      return;
    }

    if (
      !window.confirm(
        `Sigur dorești să ștergi fișierul "${getFileName(
          attachment
        )}"?`
      )
    ) {
      return;
    }

    try {
      setRemovingAttachmentId(
        attachment.id
      );
      setNewsError("");

      await api.delete(
        `/attachments/${attachment.id}`
      );

      await loadNewsAttachments(
        attachment.entity_id
      );

      setNewsMessage(
        "Atașamentul a fost șters."
      );
    } catch (err) {
      console.error(
        "DELETE ATTACHMENT ERROR:",
        err
      );

      setNewsError(
        err.response?.data?.message ||
          "Atașamentul nu a putut fi șters."
      );
    } finally {
      setRemovingAttachmentId(null);
    }
  };

  // ȘTERGERE ȘTIRE
  const handleDeleteNews = async (id) => {
    if (
      !canDelete ||
      deletingId !== null
    ) {
      return;
    }

    if (
      !window.confirm(
        "Sigur dorești să ștergi această noutate?"
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      setNewsError("");
      setNewsMessage("");

      const attachments =
        await loadNewsAttachments(id);

      const files = attachments.filter(
        (item) =>
          item.attachment_type === "file"
      );

      if (files.length > 0) {
        setNewsError(
          `Această noutate are ${files.length} fișier(e) atașat(e). Șterge mai întâi atașamentele din formularul de editare, apoi șterge noutatea.`
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

      setNewsMessage(
        "Noutatea a fost ștearsă."
      );
    } catch (err) {
      console.error(
        "DELETE NEWS ERROR:",
        err
      );

      setNewsError(
        err.response?.data?.message ||
          "Noutatea nu a putut fi ștearsă."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // DESCHIDERE ARTICOL
  const openArticle = async (article) => {
    if (article.type !== "internal") {
      if (validUrl(article.url)) {
        window.open(
          article.url,
          "_blank",
          "noopener,noreferrer"
        );
      }

      return;
    }

    setSelectedArticle(article);

    try {
      await loadNewsAttachments(
        article.id
      );
    } catch {
      setNewsError(
        "Atașamentele articolului nu au putut fi încărcate."
      );
    }
  };

  const displayedNews = showAllNews
    ? news
    : news.slice(0, 2);

  const editingAttachments =
    editingId !== null
      ? newsAttachments[editingId] || []
      : [];

  const selectedArticleAttachments =
    selectedArticle
      ? newsAttachments[selectedArticle.id] || []
      : [];

  const selectedArticleImages =
    selectedArticleAttachments.filter(
      isImageAttachment
    );

  const selectedArticleDocuments =
    selectedArticleAttachments.filter(
      (attachment) =>
        attachment.attachment_type === "file" &&
        attachment.file_category !== "image"
    );

  const getMainNewsImage = (newsId) => {
    const attachments =
      newsAttachments[newsId] || [];

    return attachments.find(
      isImageAttachment
    );
  };

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
        <div
          className="dashboard-error"
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              loadDashboard(true)
            }
          >
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
              onClick={() =>
                navigate(section.path)
              }
            >
              <div className="stat-icon">
                <Icon size={24} />
              </div>

              <div className="stat-content">
                <span>
                  {section.title}
                </span>

                <strong>
                  {loadingStats
                    ? "..."
                    : stats[section.key]}
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
        {/* ULTIMELE INFORMAȚII */}
        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>
                Ultimele informații
              </h2>

              <p>
                Documente adăugate recent
              </p>
            </div>

            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={() =>
                loadDashboard(false)
              }
              disabled={refreshing}
              aria-label="Actualizează informațiile"
            >
              <RefreshCw
                size={19}
                className={
                  refreshing
                    ? "refresh-spin"
                    : ""
                }
              />
            </button>
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
                const config =
                  recentTypes[item.type];

                if (!config) return null;

                const Icon = config.icon;

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    className="information-item information-item-button"
                    onClick={() =>
                      navigate(
                        `${config.path}/${item.id}`
                      )
                    }
                  >
                    <div
                      className={`item-icon ${config.className}`}
                    >
                      <Icon size={19} />
                    </div>

                    <div className="information-content">
                      <strong>
                        {config.label}
                      </strong>

                      <p>{item.title}</p>

                      <small>
                        {formatDate(
                          item.created_at
                        )}
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

          <button
            type="button"
            className="border-news-show-all"
            onClick={() =>
              navigate(
                "/informatii-utile"
              )
            }
          >
            Vezi toate informațiile
            <ArrowRight size={17} />
          </button>
        </section>

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
                  onClick={() =>
                    showForm
                      ? resetForm()
                      : openCreateForm()
                  }
                >
                  {showForm ? (
                    <X size={17} />
                  ) : (
                    <Plus size={17} />
                  )}

                  {showForm
                    ? "Anulează"
                    : "Adaugă"}
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
                  className={
                    loadingNews
                      ? "refresh-spin"
                      : ""
                  }
                />
              </button>
            </div>
          </div>

          {newsMessage && (
            <div
              className="border-news-success"
              role="status"
            >
              {newsMessage}
            </div>
          )}

          {newsError && (
            <div
              className="border-news-error"
              role="alert"
            >
              <AlertCircle size={17} />
              <span>{newsError}</span>
            </div>
          )}

          {/* FORMULAR MODERN */}
          {showForm && canEdit && (
            <form
              className="border-news-form"
              onSubmit={handleSaveNews}
            >
              <h3>
                {editingId !== null
                  ? "Editează noutatea"
                  : "Publică o noutate"}
              </h3>

              <div className="border-news-form-grid">
                <div className="border-news-publication-type">
                  <span className="border-news-field-label">
                    Tipul publicației
                  </span>

                  <div className="border-news-type-grid">
                    <button
                      type="button"
                      className={`border-news-type-option ${
                        form.type ===
                        "internal"
                          ? "active"
                          : ""
                      }`}
                      disabled={saving}
                      aria-pressed={
                        form.type ===
                        "internal"
                      }
                      onClick={() =>
                        setForm(
                          (current) => ({
                            ...current,
                            type: "internal",
                            url: "",
                          })
                        )
                      }
                    >
                      <div className="border-news-type-title">
                        <Pencil size={20} />

                        <strong>
                          Știre proprie
                        </strong>
                      </div>

                      <span>
                        Text, fotografie și documente
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`border-news-type-option ${
                        form.type ===
                        "external"
                          ? "active"
                          : ""
                      }`}
                      disabled={saving}
                      aria-pressed={
                        form.type ===
                        "external"
                      }
                      onClick={() =>
                        setForm(
                          (current) => ({
                            ...current,
                            type: "external",
                            content: "",
                          })
                        )
                      }
                    >
                      <div className="border-news-type-title">
                        <ExternalLink
                          size={20}
                        />

                        <strong>
                          Articol extern
                        </strong>
                      </div>

                      <span>
                        Link către publicația originală
                      </span>
                    </button>
                  </div>
                </div>

                <label>
                  Categorie

                  <select
                    value={form.category}
                    disabled={saving}
                    onChange={(event) =>
                      updateForm(
                        "category",
                        event.target.value
                      )
                    }
                  >
                    {categories.map(
                      (category) => (
                        <option
                          key={
                            category.value
                          }
                          value={
                            category.value
                          }
                        >
                          {category.label}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <label>
                Titlul știrii *

                <input
                  type="text"
                  value={form.title}
                  maxLength={300}
                  required
                  disabled={saving}
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="Introdu titlul noutății"
                />
              </label>

              {form.type ===
              "external" ? (
                <label>
                  Link către articol *

                  <input
                    type="url"
                    value={form.url}
                    maxLength={2048}
                    required
                    disabled={saving}
                    onChange={(event) =>
                      updateForm(
                        "url",
                        event.target.value
                      )
                    }
                    placeholder="https://site.md/articol"
                  />
                </label>
              ) : (
                <label>
                  Conținutul știrii *

                  <textarea
                    value={form.content}
                    maxLength={20000}
                    required
                    rows={8}
                    disabled={saving}
                    onChange={(event) =>
                      updateForm(
                        "content",
                        event.target.value
                      )
                    }
                    placeholder="Redactează conținutul noutății..."
                  />
                </label>
              )}

              <label>
                Sursa

                <input
                  type="text"
                  value={form.source}
                  maxLength={150}
                  disabled={saving}
                  onChange={(event) =>
                    updateForm(
                      "source",
                      event.target.value
                    )
                  }
                  placeholder="Ex.: Poliția de Frontieră"
                />
              </label>

              {/* ÎNCĂRCARE DIRECTĂ */}
              <div className="border-news-upload-section">
                <div className="border-news-upload-heading">
                  <div>
                    <h4>
                      Fotografie principală și documente
                    </h4>

                    <p>
                      Încarcă o singură
                      fotografie principală
                      și, opțional,
                      documente PDF sau Word.
                      Maximum 10 fișiere
                      în total, câte 4 MB.
                    </p>
                  </div>

                  <Paperclip size={21} />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  onChange={
                    handleSelectFiles
                  }
                  disabled={saving}
                  style={{
                    display: "none",
                  }}
                />

                <button
                  type="button"
                  className="border-news-upload-zone"
                  disabled={
                    saving ||
                    selectedFiles.length >=
                      MAX_FILES
                  }
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  <span className="border-news-upload-icon">
                    <UploadCloud
                      size={30}
                    />
                  </span>

                  <strong>
                    Încarcă fotografia sau documentele
                  </strong>

                  <span>
                    Selectează din telefon
                    sau calculator
                  </span>

                  <span>
                    JPG, PNG, WEBP, PDF,
                    DOC, DOCX
                  </span>

                  <span className="border-news-upload-button">
                    <Plus size={16} />
                    Selectează fișiere
                  </span>
                </button>

                {/* FIȘIERE SELECTATE */}
                {selectedFiles.length >
                  0 && (
                  <div className="border-news-selected-files">
                    <div className="border-news-selected-header">
                      <strong>
                        Fișiere selectate (
                        {
                          selectedFiles.length
                        }
                        )
                      </strong>

                      <CheckCircle2
                        size={18}
                      />
                    </div>

                    {selectedFiles.map(
                      (file, index) => (
                        <div
                          className="border-news-selected-item"
                          key={`${file.name}-${file.size}-${index}`}
                        >
                          <FileIcon
                            size={19}
                          />

                          <div>
                            <strong>
                              {file.name}
                            </strong>

                            <small>
                              {formatFileSize(
                                file.size
                              )}
                            </small>
                          </div>

                          <button
                            type="button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              removeSelectedFile(
                                index
                              )
                            }
                            aria-label={`Elimină ${file.name}`}
                          >
                            <X
                              size={17}
                            />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* ATAȘAMENTE SALVATE */}
                {editingId !== null && (
                  <div className="border-news-saved-attachments">
                    <h4>
                      Atașamente salvate
                    </h4>

                    {attachmentsLoading[
                      editingId
                    ] ? (
                      <p>
                        Se încarcă atașamentele...
                      </p>
                    ) : editingAttachments.length ===
                      0 ? (
                      <p>
                        Nu există atașamente salvate.
                      </p>
                    ) : (
                      editingAttachments.map(
                        (attachment) => (
                          <div
                            key={
                              attachment.id
                            }
                            className="border-news-saved-file"
                          >
                            {isImageAttachment(
                              attachment
                            ) ? (
                              <PrivateNewsImage
                                attachment={
                                  attachment
                                }
                                className="border-news-private-thumbnail"
                              />
                            ) : (
                              <FileIcon
                                size={22}
                              />
                            )}

                            <div className="border-news-saved-file-info">
                              <strong>
                                {getFileName(
                                  attachment
                                )}
                              </strong>

                              <small>
                                {formatFileSize(
                                  attachment.file_size
                                )}
                              </small>
                            </div>

                            {attachment.attachment_type ===
                              "file" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadAttachment(
                                    attachment
                                  )
                                }
                                title="Descarcă"
                              >
                                <Download
                                  size={17}
                                />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                disabled={
                                  saving ||
                                  removingAttachmentId ===
                                    attachment.id
                                }
                                onClick={() =>
                                  handleRemoveAttachment(
                                    attachment
                                  )
                                }
                                title="Șterge atașamentul"
                              >
                                <Trash2
                                  size={17}
                                />
                              </button>
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                )}

                <div className="border-news-private-note">
                  <LockKeyhole
                    size={16}
                  />

                  <span>
                    Fișierele încărcate
                    sunt păstrate în
                    spațiul privat și
                    accesate prin
                    autentificarea aplicației.
                  </span>
                </div>

                {uploadProgress && (
                  <div
                    className="border-news-upload-progress"
                    role="status"
                  >
                    <RefreshCw
                      size={17}
                      className="refresh-spin"
                    />

                    {uploadProgress}
                  </div>
                )}
              </div>

              {/* ACȚIUNI */}
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
                    : editingId !== null
                      ? "Salvează modificările"
                      : "Publică noutatea"}
                </button>
              </div>
            </form>
          )}

          {/* LISTA ȘTIRILOR */}
          <div className="border-news-list">
            {loadingNews ? (
              <div className="border-news-state">
                Se încarcă noutățile...
              </div>
            ) : news.length === 0 ? (
              <div className="border-news-state">
                Nu există noutăți disponibile.
              </div>
            ) : (
              displayedNews.map(
                (article) => {
                  const category =
                    categories.find(
                      (item) =>
                        item.value ===
                        article.category
                    );

                  const mainImage =
                    getMainNewsImage(
                      article.id
                    );

                  return (
                    <article
                      key={article.id}
                      className="border-news-article border-news-clickable"
                      role="link"
                      tabIndex={0}
                      aria-label={`Deschide știrea: ${article.title}`}
                      onClick={(event) => {
                        if (
                          event.target instanceof
                            Element &&
                          event.target.closest(
                            "a, button"
                          )
                        ) {
                          return;
                        }

                        openArticle(
                          article
                        );
                      }}
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.target ===
                            event.currentTarget &&
                          (event.key ===
                            "Enter" ||
                            event.key ===
                              " ")
                        ) {
                          event.preventDefault();

                          openArticle(
                            article
                          );
                        }
                      }}
                    >
                      {/* FOTOGRAFIE PRIVATĂ */}
                      {mainImage ? (
                        <div className="border-news-photo">
                          <PrivateNewsImage
                            attachment={
                              mainImage
                            }
                            className="border-news-private-thumbnail"
                          />
                        </div>
                      ) : (
                        <NewsImage
                          src={
                            article.image_url
                          }
                          title={
                            article.title
                          }
                        />
                      )}

                      <div className="border-news-article-body">
                        <div className="border-news-meta">
                          <span
                            className={`border-news-category category-${article.category}`}
                          >
                            {category?.label ||
                              "Noutăți"}
                          </span>

                          {article.source && (
                            <span className="border-news-source-name">
                              {
                                article.source
                              }
                            </span>
                          )}

                          <time>
                            {formatDate(
                              article.created_at
                            )}
                          </time>
                        </div>

                        <h3>
                          {article.title}
                        </h3>

                        {article.type ===
                        "internal" ? (
                          <>
                            <p className="border-news-excerpt">
                              {article.content?.slice(
                                0,
                                160
                              )}

                              {article.content
                                ?.length >
                              160
                                ? "..."
                                : ""}
                            </p>

                            <span className="border-news-read">
                              Citește știrea

                              <ArrowRight
                                size={15}
                              />
                            </span>
                          </>
                        ) : (
                          <a
                            href={
                              article.url
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-news-read"
                          >
                            Citește articolul

                            <ExternalLink
                              size={15}
                            />
                          </a>
                        )}

                        {canEdit && (
                          <div className="border-news-article-actions">
                            <button
                              type="button"
                              onClick={() =>
                                openEditForm(
                                  article
                                )
                              }
                            >
                              <Pencil
                                size={15}
                              />

                              Editează
                            </button>

                            {canDelete && (
                              <button
                                type="button"
                                className="border-news-delete"
                                disabled={
                                  deletingId ===
                                  article.id
                                }
                                onClick={() =>
                                  handleDeleteNews(
                                    article.id
                                  )
                                }
                              >
                                <Trash2
                                  size={15}
                                />

                                Șterge
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {article.type ===
                        "external" ||
                      !article.type ? (
                        <a
                          href={
                            article.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-news-open-icon"
                          aria-label={`Deschide ${article.title}`}
                        >
                          <ArrowUpRight
                            size={18}
                          />
                        </a>
                      ) : (
                        <ArrowUpRight
                          size={18}
                          className="border-news-open-icon"
                          aria-hidden="true"
                        />
                      )}
                    </article>
                  );
                }
              )
            )}
          </div>

          {news.length > 2 && (
            <button
              type="button"
              className="border-news-show-all"
              onClick={() =>
                setShowAllNews(
                  (current) =>
                    !current
                )
              }
            >
              {showAllNews
                ? "Afișează mai puține"
                : `Vezi toate noutățile (${news.length})`}

              <ArrowRight
                size={17}
              />
            </button>
          )}
        </section>
      </div>

      {/* MODAL ȘTIRE PROPRIE */}
      {selectedArticle && (
        <div
          className="border-news-modal-overlay"
          onClick={() =>
            setSelectedArticle(null)
          }
        >
          <div
            className="border-news-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              selectedArticle.title
            }
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="border-news-modal-header">
              <div>
                <small>
                  {formatDate(
                    selectedArticle.created_at
                  )}
                </small>

                <h2>
                  {
                    selectedArticle.title
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedArticle(
                    null
                  )
                }
                aria-label="Închide"
              >
                <X size={22} />
              </button>
            </div>

            <div className="border-news-modal-content">
              <p>
                {
                  selectedArticle.content
                }
              </p>

              {attachmentsLoading[
                selectedArticle.id
              ] && (
                <p>
                  Se încarcă atașamentele...
                </p>
              )}

              {/* O SINGURĂ FOTOGRAFIE */}
              {selectedArticleImages.length >
                0 && (
                <div className="border-news-private-section">
                  <h3>
                    Fotografia principală
                  </h3>

                  <div className="border-news-private-gallery">
                    <div className="border-news-private-gallery-item">
                      <PrivateNewsImage
                        attachment={
                          selectedArticleImages[0]
                        }
                        className="border-news-private-gallery-image"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadAttachment(
                            selectedArticleImages[0]
                          )
                        }
                      >
                        <Download
                          size={16}
                        />

                        Descarcă fotografia
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCUMENTE PRIVATE */}
              {selectedArticleDocuments.length >
                0 && (
                <div className="border-news-private-section">
                  <h3>
                    Documente atașate
                  </h3>

                  <div className="border-news-private-documents">
                    {selectedArticleDocuments.map(
                      (
                        attachment
                      ) => (
                        <div
                          className="border-news-private-document"
                          key={
                            attachment.id
                          }
                        >
                          <FileIcon
                            size={23}
                          />

                          <div>
                            <strong>
                              {getFileName(
                                attachment
                              )}
                            </strong>

                            <small>
                              {formatFileSize(
                                attachment.file_size
                              )}
                            </small>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadAttachment(
                                attachment
                              )
                            }
                          >
                            <Download
                              size={17}
                            />

                            Descarcă
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
