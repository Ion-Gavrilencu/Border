import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Newspaper, AlertCircle, CheckCircle2 } from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/authStore";
import NewsForm from "../components/dashboard/NewsForm";

import "./EditStire.css";

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

const getFileCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "word";
};

const getFileName = (attachment) =>
  attachment.original_name || attachment.name || "Document";

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

export default function EditStire() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  const canDelete = user?.role === "ADMIN";

  const [form, setForm] = useState({ ...emptyForm });
  const [originalImages, setOriginalImages] = useState([]);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingAttachments, setEditingAttachments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [uploadProgress, setUploadProgress] = useState("");
  const [attachmentsLoading, setAttachmentsLoading] = useState({});
  const [removingAttachmentId, setRemovingAttachmentId] = useState(null);

  // ÎNCĂRCARE ATAȘAMENTE
  const loadAttachments = async (newsId) => {
    setAttachmentsLoading((current) => ({
      ...current,
      [newsId]: true,
    }));

    try {
      const response = await api.get(`/attachments/news/${newsId}`);

      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];

      setEditingAttachments(attachments);

      return attachments;
    } finally {
      setAttachmentsLoading((current) => ({
        ...current,
        [newsId]: false,
      }));
    }
  };

  // ÎNCĂRCARE ȘTIRE
  useEffect(() => {
    let active = true;

    const loadNews = async () => {
      try {
        setLoading(true);
        setError("");

        // Folosim lista existentă /news pentru a găsi știrea.
        const response = await api.get("/news");

        const articles = Array.isArray(response.data?.articles)
          ? response.data.articles
          : [];

        const article = articles.find((item) => String(item.id) === String(id));

        if (!article) {
          throw new Error("Știrea nu a fost găsită.");
        }

        if (!active) return;

        setForm({
          title: article.title || "",
          type: article.type || "internal",
          url: article.url || "",
          content: article.content || "",
          category: article.category || "altele",
          source: article.source || "",
          image_url: article.image_url || "",
        });

        setOriginalImages(Array.isArray(article.images) ? article.images : []);

        // Încărcăm separat atașamentele.
        const attachmentsResponse = await api.get(`/attachments/news/${id}`);

        if (!active) return;

        setEditingAttachments(
          Array.isArray(attachmentsResponse.data?.attachments)
            ? attachmentsResponse.data.attachments
            : [],
        );
      } catch (err) {
        console.error("LOAD NEWS ERROR:", err);

        if (active) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Știrea nu a putut fi încărcată.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (canEdit) {
      loadNews();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [id, canEdit]);

  // MODIFICARE CÂMP
  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  // SELECTARE FIȘIERE
  const handleSelectFiles = (event) => {
    const files = Array.from(event.target.files || []);

    event.target.value = "";

    if (!files.length) return;

    const invalid = files.find(
      (file) =>
        !acceptedFileTypes.has(file.type) ||
        file.size === 0 ||
        file.size > MAX_FILE_SIZE,
    );

    if (invalid) {
      setError(
        "Format sau dimensiune neacceptată. Sunt permise JPG, PNG, WEBP, PDF, DOC și DOCX, maximum 4 MB per fișier.",
      );
      return;
    }

    const savedFiles = editingAttachments.filter(
      (attachment) => attachment.attachment_type === "file",
    );

    const totalFiles = savedFiles.length + selectedFiles.length + files.length;

    if (totalFiles > MAX_FILES) {
      const remaining = MAX_FILES - savedFiles.length - selectedFiles.length;

      setError(
        `Poți încărca maximum ${MAX_FILES} fișiere. Mai poți adăuga ${Math.max(0, remaining)} fișier(e).`,
      );
      return;
    }

    setSelectedFiles((current) => [...current, ...files]);

    setError("");
  };

  // ELIMINARE FIȘIER NOU DIN LISTĂ
  const removeSelectedFile = (index) => {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
  };

  // DESCĂRCARE ATAȘAMENT
  const handleDownloadAttachment = async (attachment) => {
    let objectUrl = "";

    try {
      setError("");

      const response = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });

      objectUrl = URL.createObjectURL(response.data);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getFileName(attachment);

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);

      setError("Fișierul nu a putut fi descărcat.");
    } finally {
      if (objectUrl) {
        window.setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 1000);
      }
    }
  };

  // ȘTERGERE ATAȘAMENT EXISTENT
  const handleRemoveAttachment = async (attachment) => {
    if (!canDelete || removingAttachmentId !== null || saving) {
      return;
    }

    const confirmed = window.confirm(
      `Sigur dorești să ștergi fișierul "${getFileName(attachment)}"?`,
    );

    if (!confirmed) return;

    try {
      setRemovingAttachmentId(attachment.id);
      setError("");
      setSuccess("");

      await api.delete(`/attachments/${attachment.id}`);

      await loadAttachments(id);

      setSuccess("Atașamentul a fost șters cu succes.");
    } catch (err) {
      console.error("DELETE ATTACHMENT ERROR:", err);

      setError(
        err.response?.data?.message || "Atașamentul nu a putut fi șters.",
      );
    } finally {
      setRemovingAttachmentId(null);
    }
  };

  // SALVARE ȘTIRE
  const handleSave = async (event) => {
    event.preventDefault();

    if (!canEdit || saving || removingAttachmentId !== null) {
      return;
    }

    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Introdu titlul știrii.");
      return;
    }

    if (form.type === "internal" && !form.content.trim()) {
      setError("Introdu conținutul știrii.");
      return;
    }

    if (form.type === "external" && !validUrl(form.url.trim())) {
      setError("Introdu un link valid către articol.");
      return;
    }

    if (form.image_url?.trim() && !validUrl(form.image_url.trim())) {
      setError("Introdu un URL HTTP/HTTPS valid pentru fotografie.");
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
      images: originalImages,
    };

    let newsSaved = false;

    try {
      setSaving(true);

      // ACTUALIZARE ÎN BAZA DE DATE
      await api.patch(`/news/${id}`, payload);

      newsSaved = true;

      // ÎNCĂRCARE FIȘIERE NOI
      const filesToUpload = [...selectedFiles];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        setUploadProgress(
          `Se încarcă ${i + 1} din ${filesToUpload.length}: ${file.name}`,
        );

        const data = new FormData();

        data.append("entityType", "news");
        data.append("entityId", String(id));
        data.append("fileCategory", getFileCategory(file));
        data.append("file", file);

        await api.post("/attachments/upload", data);

        // Eliminăm doar fișierul încărcat.
        setSelectedFiles((current) => current.filter((item) => item !== file));
      }

      setUploadProgress("");

      navigate("/dashboard", {
        state: {
          newsMessage: "Știrea a fost actualizată cu succes.",
        },
      });
    } catch (err) {
      console.error("UPDATE NEWS ERROR:", err);

      setUploadProgress("");

      if (newsSaved) {
        setError(
          "Știrea a fost salvată, dar încărcarea unui fișier a eșuat. Fișierele rămase pot fi încărcate la următoarea salvare.",
        );

        try {
          await loadAttachments(id);
        } catch (refreshError) {
          console.error("REFRESH ATTACHMENTS ERROR:", refreshError);
        }
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Știrea nu a putut fi actualizată.",
        );
      }
    } finally {
      setSaving(false);
      setUploadProgress("");
    }
  };

  // FĂRĂ PERMISIUNE
  if (!canEdit) {
    return (
      <main className="edit-stire-page">
        <div className="edit-stire-error">
          <AlertCircle size={18} />
          Nu ai permisiunea de a edita știri.
        </div>

        <button
          type="button"
          className="edit-stire-back"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={18} />
          Înapoi la Dashboard
        </button>
      </main>
    );
  }

  // ÎNCĂRCARE
  if (loading) {
    return (
      <main className="edit-stire-page">
        <p>Se încarcă știrea...</p>
      </main>
    );
  }

  return (
    <main className="edit-stire-page">
      {/* ANTET */}
      <div className="edit-stire-top">
        <header className="edit-stire-heading">
          <span>
            <Newspaper size={16} />
            GESTIONARE CONȚINUT
          </span>

          <h1>Editează știre</h1>

          <p>
            Modifică informațiile știrii și gestionează fotografiile și
            documentele atașate.
          </p>
        </header>

        <button
          type="button"
          className="edit-stire-back"
          onClick={() => navigate("/dashboard")}
          disabled={saving}
        >
          <ArrowLeft size={19} />
          Înapoi la listă
        </button>
      </div>

      {/* FORMULAR */}
      <section className="edit-stire-card">
        {/* EROARE */}
        {error && (
          <div className="edit-stire-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* SUCCES */}
        {success && (
          <div className="edit-stire-success" role="status">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        <NewsForm
          editingId={id}
          form={form}
          saving={saving}
          selectedFiles={selectedFiles}
          editingAttachments={editingAttachments}
          attachmentsLoading={attachmentsLoading}
          uploadProgress={uploadProgress}
          removingAttachmentId={removingAttachmentId}
          canDelete={canDelete}
          onSubmit={handleSave}
          onCancel={() => navigate("/dashboard")}
          updateForm={updateForm}
          setForm={setForm}
          handleSelectFiles={handleSelectFiles}
          removeSelectedFile={removeSelectedFile}
          handleDownloadAttachment={handleDownloadAttachment}
          handleRemoveAttachment={handleRemoveAttachment}
        />
      </section>
    </main>
  );
}
