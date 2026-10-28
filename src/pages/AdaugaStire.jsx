
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Newspaper, AlertCircle } from "lucide-react";

import api from "../services/api";
import NewsForm from "../components/dashboard/NewsForm";

import "../components/dashboard/NewsSection.css";
import "./AdaugaStire.css";

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

export default function AdaugaStire() {
  const navigate = useNavigate();

  const [role, setRole] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [savedId, setSavedId] = useState(null);

  const canEdit = role === "ADMIN" || role === "EDITOR";

  // VERIFICAREA PERMISIUNILOR
  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      try {
        const response = await api.get("/auth/me");

        const user =
          response.data?.user ||
          response.data?.data?.user ||
          response.data;

        if (active) {
          setRole(user?.role || "USER");
        }
      } catch (err) {
        console.error("USER ROLE ERROR:", err);

        if (active) {
          setRole("USER");
        }
      }
    };

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  // ACTUALIZAREA FORMULARULUI
  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // SELECTAREA FIȘIERELOR
  const handleSelectFiles = (event) => {
    const files = Array.from(event.target.files || []);

    event.target.value = "";

    if (files.length === 0) return;

    const invalidFile = files.find(
      (file) =>
        !acceptedFileTypes.has(file.type) ||
        file.size > MAX_FILE_SIZE ||
        file.size === 0,
    );

    if (invalidFile) {
      setError(
        "Sunt permise JPG, PNG, WEBP, PDF, DOC și DOCX, maximum 4 MB per fișier.",
      );
      return;
    }

    if (selectedFiles.length + files.length > MAX_FILES) {
      setError(
        `Poți încărca maximum ${MAX_FILES} fișiere pentru o știre.`,
      );
      return;
    }

    setSelectedFiles((current) => [...current, ...files]);
    setError("");
  };

  // ELIMINAREA UNUI FIȘIER SELECTAT
  const removeSelectedFile = (index) => {
    setSelectedFiles((current) =>
      current.filter((_, i) => i !== index),
    );
  };

  // PUBLICAREA ȘTIRII
  const handleSave = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    setError("");

    // VALIDARE
    if (!form.title.trim()) {
      setError("Introdu titlul știrii.");
      return;
    }

    if (
      form.type === "external" &&
      !validUrl(form.url.trim())
    ) {
      setError("Introdu un link valid către articol.");
      return;
    }

    if (
      form.type === "internal" &&
      !form.content.trim()
    ) {
      setError("Introdu textul știrii proprii.");
      return;
    }

    if (
      form.image_url?.trim() &&
      !validUrl(form.image_url.trim())
    ) {
      setError(
        "Introdu un URL HTTP/HTTPS valid pentru fotografie.",
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
      image_url: form.image_url?.trim() || "",
      images: [],
    };

    setSaving(true);

    let currentId = savedId;
    let articleSaved = Boolean(savedId);

    try {
      // CREAREA SAU ACTUALIZAREA ȘTIRII
      if (!currentId) {
        const response = await api.post("/news", payload);

        currentId = response.data?.article?.id;

        if (!currentId) {
          throw new Error(
            "Serverul nu a returnat ID-ul știrii.",
          );
        }

        setSavedId(currentId);
        articleSaved = true;
      } else {
        await api.patch(`/news/${currentId}`, payload);
      }

      // ÎNCĂRCAREA FIȘIERELOR
      const filesToUpload = [...selectedFiles];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        setUploadProgress(
          `Se încarcă ${i + 1} din ${filesToUpload.length}: ${file.name}`,
        );

        const data = new FormData();

        data.append("entityType", "news");
        data.append("entityId", String(currentId));
        data.append("fileCategory", getFileCategory(file));
        data.append("file", file);

        await api.post("/attachments/upload", data);

        // Eliminăm din listă fișierul încărcat
        setSelectedFiles((current) =>
          current.filter((item) => item !== file),
        );
      }

      setUploadProgress("");

      // REVENIRE LA DASHBOARD
      navigate("/dashboard", {
        state: {
          newsMessage: "Știrea a fost publicată cu succes.",
        },
      });
    } catch (err) {
      console.error("SAVE NEWS ERROR:", err);

      const serverMessage =
        err.response?.data?.message ||
        err.message ||
        "Știrea nu a putut fi salvată.";

      if (articleSaved) {
        setError(
          `Știrea a fost salvată, dar operațiunea nu s-a finalizat: ${serverMessage}. Poți reîncerca fără a crea o știre nouă.`,
        );
      } else {
        setError(serverMessage);
      }
    } finally {
      setUploadProgress("");
      setSaving(false);
    }
  };

  // VERIFICAREA ROLULUI
  if (role === null) {
    return (
      <main className="adauga-stire-page">
        Se verifică permisiunile...
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main className="adauga-stire-page">
        <p>Nu ai permisiunea de a adăuga știri.</p>

        <button
          type="button"
          className="adauga-stire-back"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={18} />
          Înapoi la listă
        </button>
      </main>
    );
  }

  return (
    <main className="adauga-stire-page">
      {/* ANTETUL PAGINII */}
      <div className="adauga-stire-top">
        <header className="adauga-stire-heading">
          <span>
            <Newspaper size={16} />
            GESTIONARE CONȚINUT
          </span>

          <h1>Adaugă știre</h1>

          <p>
            Publică o știre internă sau un articol extern și
            atașează materialele aferente.
          </p>
        </header>

        <button
          type="button"
          className="adauga-stire-back"
          onClick={() => navigate("/dashboard")}
          disabled={saving}
        >
          <ArrowLeft size={19} />
          Înapoi la listă
        </button>
      </div>

      {/* FORMULARUL */}
      <section className="border-news-card adauga-stire-card">
        {error && (
          <div className="border-news-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <NewsForm
          editingId={null}
          form={form}
          saving={saving}
          selectedFiles={selectedFiles}
          editingAttachments={[]}
          attachmentsLoading={{}}
          uploadProgress={uploadProgress}
          removingAttachmentId={null}
          canDelete={false}
          onSubmit={handleSave}
          onCancel={() => navigate("/dashboard")}
          updateForm={updateForm}
          setForm={setForm}
          handleSelectFiles={handleSelectFiles}
          removeSelectedFile={removeSelectedFile}
          handleDownloadAttachment={() => {}}
          handleRemoveAttachment={() => {}}
        />
      </section>
    </main>
  );
}
