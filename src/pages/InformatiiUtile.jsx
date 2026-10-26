import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  BookOpen,
  Plus,
  X,
  ArrowUpRight,
  Pencil,
  Trash2,
  FolderOpen,
  FileText,
  Filter,
  CalendarDays,
  UserRound,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Video,
  Link2,
} from "lucide-react";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import "./InformatiiUtile.css";

import DocumentUploader from "../components/DocumentUploader";
import TelegramGallery from "../components/TelegramGallery";

const getFileCategory = (file) => {
  if (file.type?.startsWith("image/")) return "image";

  if (file.type?.startsWith("video/")) return "video";

  if (file.type === "application/pdf") return "pdf";

  if (/\.(doc|docx)$/i.test(file.name)) return "word";

  return "other";
};

const emptyForm = { title: "", category: "", content: "" };

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ro-RO", {
        day: "2-digit",

        month: "short",

        year: "numeric",
      }).format(date);
};

function InformatiiUtile() {
  const { user } = useAuth();

  const navigate = useNavigate();

  const [informatii, setInformatii] = useState([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [showForm, setShowForm] = useState(false);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState("success");

  const [formData, setFormData] = useState(emptyForm);

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [linkUrl, setLinkUrl] = useState("");

  const [category, setCategory] = useState("Toate");

  const [sort, setSort] = useState("recent");
  const [viewer, setViewer] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [openingCardId, setOpeningCardId] = useState(null);

  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const notify = (text, type = "success") => {
    setMessage(text);

    setMessageType(type);
  };

  const loadInformatii = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get("/informatii-utile");

      setInformatii(
        Array.isArray(response.data.informatii) ? response.data.informatii : [],
      );
    } catch (error) {
      console.error("GET INFORMATII UTILE:", error);

      notify(
        error.response?.data?.message ||
          "Informațiile nu au putut fi încărcate.",

        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInformatii();
  }, [loadInformatii]);

  const categories = useMemo(() => {
    const names = informatii

      .map((item) => String(item.category || "").trim())

      .filter(Boolean);

    return [
      "Toate",

      ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "ro")),
    ];
  }, [informatii]);

  const filtered = useMemo(() => {
    const items = informatii.filter((item) => {
      const matchesCategory =
        category === "Toate" || String(item.category || "").trim() === category;

      return matchesCategory;
    });

    return [...items].sort((a, b) => {
      if (sort === "az")
        return String(a.title || "").localeCompare(String(b.title || ""), "ro");

      if (sort === "za")
        return String(b.title || "").localeCompare(String(a.title || ""), "ro");

      return (
        (new Date(b.created_at || 0).getTime() || Number(b.id) || 0) -
        (new Date(a.created_at || 0).getTime() || Number(a.id) || 0)
      );
    });
  }, [informatii, category, sort]);

  // Fișierele sunt private: le cerem cu tokenul Axios și le deschidem ca Blob.
  const openMaterial = async (attachment) => {
    if (
      attachment.attachment_type === "file" &&
      (attachment.file_category === "image" ||
        attachment.mime_type?.startsWith("image/"))
    ) {
      if (viewer?.item) {
        setGallery({ item: viewer.item, initialAttachmentId: attachment.id });
        setViewer(null);
      }
      return;
    }
    if (attachment.attachment_type === "link") {
      try {
        const target = new URL(attachment.url);
        if (!["https:", "http:"].includes(target.protocol)) throw new Error();
        window.open(target.href, "_blank", "noopener,noreferrer");
      } catch {
        notify("Linkul salvat nu este valid.", "error");
      }
      return;
    }

    // Fila se creează la clic, înainte de așteptarea răspunsului API.
    const tab = window.open("", "_blank");
    try {
      setOpeningId(attachment.id);
      const response = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(response.data);
      if (tab) {
        tab.location.replace(blobUrl);
      } else {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download =
          attachment.original_name || attachment.name || "document";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      // Nu revocăm imediat: browserul are nevoie de URL pentru vizualizare.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (error) {
      tab?.close();
      console.error("OPEN ATTACHMENT:", error);
      notify(
        error.response?.data?.message || "Materialul nu a putut fi deschis.",
        "error",
      );
    } finally {
      setOpeningId(null);
    }
  };

 
const openUsefulInfo = async (item) => {
  if (openingCardId !== null) return;

  // Deschidem anticipat fila pentru linkuri și documente.
  const preopenedTab = window.open("", "_blank");

  try {
    setOpeningCardId(item.id);

    const response = await api.get(
      `/attachments/informatii_utile/${item.id}`
    );

    const attachments = Array.isArray(response.data?.attachments)
      ? response.data.attachments
      : [];

    const images = attachments.filter(
      (attachment) =>
        attachment.attachment_type === "file" &&
        (attachment.file_category === "image" ||
          attachment.mime_type?.startsWith("image/"))
    );

    // Dacă toate materialele sunt fotografii,
    // deschidem direct galeria, indiferent de numărul lor.
    if (
      attachments.length > 0 &&
      images.length === attachments.length
    ) {
      preopenedTab?.close();
      setViewer(null);
      setGallery({ item, initialAttachmentId: images[0].id });
      return;
    }

    // Un singur material: îl deschidem direct.
    if (attachments.length === 1) {
      const attachment = attachments[0];

      if (attachment.attachment_type === "link") {
        const url = new URL(attachment.url);

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Link invalid.");
        }

        if (preopenedTab) {
          preopenedTab.location.replace(url.href);
        } else {
          window.open(url.href, "_blank", "noopener,noreferrer");
        }

        return;
      }

      const fileResponse = await api.get(
        `/attachments/file/${attachment.id}`,
        { responseType: "blob" }
      );

      const blobUrl = URL.createObjectURL(fileResponse.data);

      if (preopenedTab) {
        preopenedTab.location.replace(blobUrl);
      } else {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download =
          attachment.original_name ||
          attachment.name ||
          "document";

        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 120000);

      return;
    }

    // Materiale mixte sau informație numai text.
    preopenedTab?.close();
    setGallery(null);
    setViewer({ item, attachments });
  } catch (error) {
    preopenedTab?.close();

    console.error("OPEN USEFUL INFO:", error);

    notify(
      error.response?.data?.message ||
        error.message ||
        "Nu s-a putut deschide materialul.",
      "error"
    );
  } finally {
    setOpeningCardId(null);
  }
};


  const resetForm = () => {
    setFormData({ ...emptyForm });

    setSelectedFiles([]);

    setLinkUrl("");

    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit || saving) return;

    if (!formData.title.trim()) {
      notify("Titlul este obligatoriu.", "error");

      return;
    }

    if (
      !formData.content.trim() &&
      selectedFiles.length === 0 &&
      !linkUrl.trim()
    ) {
      notify("Adaugă text, un fișier sau un link.", "error");

      return;
    }

    if (linkUrl.trim()) {
      try {
        const url = new URL(linkUrl.trim());

        if (!["https:", "http:"].includes(url.protocol)) throw new Error();
      } catch {
        notify(
          "Introdu un link valid, care începe cu https:// sau http://.",

          "error",
        );

        return;
      }
    }

    try {
      setSaving(true);

      setMessage("");

      const response = await api.post("/informatii-utile", {
        title: formData.title.trim(),

        category: formData.category.trim(),

        content: formData.content.trim(),
      });

      const itemId = response.data?.informatie?.id;

      if (!itemId) {
        await loadInformatii();

        notify(
          "Informația a fost creată, dar serverul nu a returnat ID-ul pentru atașamente.",

          "error",
        );

        return;
      }

      const failed = [];

      for (const file of selectedFiles) {
        try {
          const data = new FormData();

          data.append("file", file);

          data.append("entityType", "informatii_utile");

          data.append("entityId", String(itemId));

          data.append("fileCategory", getFileCategory(file));

          await api.post("/attachments/upload", data);
        } catch (error) {
          console.error("UPLOAD INFORMATII UTILE:", error);

          failed.push(file.name);
        }
      }

      if (linkUrl.trim()) {
        try {
          await api.post("/attachments/link", {
            entityType: "informatii_utile",

            entityId: itemId,

            name: formData.title.trim(),

            url: linkUrl.trim(),
          });
        } catch (error) {
          console.error("LINK INFORMATII UTILE:", error);

          failed.push("linkul");
        }
      }

      resetForm();

      await loadInformatii();

      notify(
        failed.length
          ? `Informația a fost creată, dar nu s-au încărcat: ${failed.join(", ")}.`
          : "Informația a fost adăugată cu succes.",

        failed.length ? "error" : "success",
      );
    } catch (error) {
      console.error("CREATE INFORMATII UTILE:", error);

      notify(
        error.response?.data?.message ||
          error.message ||
          "Informația nu a putut fi adăugată.",

        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!canDelete || deletingId !== null) return;

    if (!window.confirm(`Sigur dorești să ștergi „${item.title}”?`)) return;

    try {
      setDeletingId(item.id);

      setMessage("");

      await api.delete(`/informatii-utile/${item.id}`);

      setInformatii((current) =>
        current.filter((entry) => entry.id !== item.id),
      );

      notify("Informația a fost ștearsă.");
    } catch (error) {
      console.error("DELETE INFORMATII UTILE:", error);

      notify(
        error.response?.data?.message || "Informația nu a putut fi ștearsă.",

        "error",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="informatii-page">
      <header className="informatii-header">
        <div className="informatii-header-copy">
          <div className="informatii-eyebrow">
            <BookOpen size={14} /> CENTRU DE RESURSE
          </div>

          <h1>Informații utile</h1>

          <p className="informatii-description">
            Găsește rapid proceduri, ghiduri și informații necesare activității
            de serviciu.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="informatii-add-button"
            onClick={() => {
              setShowForm((v) => !v);

              setMessage("");
            }}
          >
            {showForm ? <X size={17} /> : <Plus size={17} />}

            {showForm ? "Închide formularul" : "Adaugă informație"}
          </button>
        )}
      </header>

      {message && (
        <div className={`informatii-message ${messageType}`} role="status">
          {messageType === "error" ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}

          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Închide mesajul"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showForm && canEdit && (
        <form className="informatii-form" onSubmit={handleSubmit}>
          <div className="informatii-form-heading">
            <div className="informatii-form-icon">
              <Plus size={20} />
            </div>

            <div>
              <h2>Informație nouă</h2>

              <p>
                Completează datele pentru a publica un material în platformă.
              </p>
            </div>
          </div>

          <div className="informatii-form-grid">
            <div className="informatii-form-group informatii-form-full">
              <label htmlFor="info-title">
                Titlu <span>*</span>
              </label>

              <input
                id="info-title"
                name="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((v) => ({ ...v, title: e.target.value }))
                }
                placeholder="Ex.: Ghid pentru verificarea documentelor"
                required
                disabled={saving}
              />
            </div>

            <div className="informatii-form-group informatii-form-full">
              <label htmlFor="info-category">Categorie</label>

              <input
                id="info-category"
                name="category"
                list="informatii-category-suggestions"
                value={formData.category}
                onChange={(e) =>
                  setFormData((v) => ({ ...v, category: e.target.value }))
                }
                placeholder="Ex.: Proceduri, Ghiduri, Contacte"
                disabled={saving}
              />

              <datalist id="informatii-category-suggestions">
                {categories

                  .filter((v) => v !== "Toate")

                  .map((v) => (
                    <option key={v} value={v} />
                  ))}
              </datalist>
            </div>

            <div className="informatii-form-group informatii-form-full">
              <label htmlFor="info-content">
                Conținut (opțional dacă atașezi materiale)
              </label>

              <textarea
                id="info-content"
                name="content"
                rows={7}
                value={formData.content}
                onChange={(e) =>
                  setFormData((v) => ({ ...v, content: e.target.value }))
                }
                placeholder="Scrie aici informațiile care trebuie să fie disponibile colegilor..."
                disabled={saving}
              />
            </div>

            <div className="informatii-form-group informatii-form-full">
              <div className="informatii-attachments">
                <div className="informatii-attachments-heading">
                  <h3>Documente și materiale atașate</h3>

                  <p>
                    Fotografii, videoclipuri, documente Word, PDF și linkuri.
                  </p>
                </div>

                <DocumentUploader
                  files={selectedFiles}
                  onFilesChange={setSelectedFiles}
                  linkUrl={linkUrl}
                  onLinkChange={setLinkUrl}
                  disabled={saving}
                  allowMixed
                  onError={(error) => {
                    if (error) notify(error, "error");
                  }}
                />
              </div>
            </div>
          </div>

          <div className="informatii-form-actions">
            <button
              type="button"
              className="informatii-cancel-button"
              onClick={resetForm}
              disabled={saving}
            >
              Anulează
            </button>

            <button
              type="submit"
              className="informatii-save-button"
              disabled={saving}
            >
              {saving ? "Se salvează..." : "Publică informația"}
            </button>
          </div>
        </form>
      )}

      <section className="informatii-toolbar" aria-label="Filtrare și ordonare">
        <div className="informatii-select-wrap">
          <Filter size={17} />

          <select
            aria-label="Filtrează după categorie"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((v) => (
              <option key={v} value={v}>
                {v === "Toate" ? "Toate categoriile" : v}
              </option>
            ))}
          </select>

          <ChevronDown size={15} />
        </div>

        <div className="informatii-select-wrap informatii-sort">
          <select
            aria-label="Ordonează informațiile"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Cele mai recente</option>

            <option value="az">Titlu A–Z</option>

            <option value="za">Titlu Z–A</option>
          </select>

          <ChevronDown size={15} />
        </div>
      </section>

      <div className="informatii-results">
        <span>
          {loading
            ? "Se încarcă..."
            : `${filtered.length} ${filtered.length === 1 ? "rezultat" : "rezultate"}`}
        </span>

        <button
          type="button"
          onClick={loadInformatii}
          disabled={loading}
          title="Reîncarcă lista"
        >
          <RefreshCw size={15} /> Actualizează
        </button>
      </div>

      {loading ? (
        <div className="informatii-state">
          <div className="informatii-spinner" />

          <p>Se încarcă informațiile utile...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="informatii-state">
          <FolderOpen size={38} />

          <h3>
            {informatii.length === 0
              ? "Nu există încă informații utile"
              : "Nu am găsit rezultate"}
          </h3>

          <p>
            {informatii.length === 0
              ? "Materialele publicate vor apărea aici."
              : "Alege o altă categorie."}
          </p>

          {category !== "Toate" && (
            <button type="button" onClick={() => setCategory("Toate")}>
              Resetează filtrele
            </button>
          )}
        </div>
      ) : (
        <section
          className="informatii-grid"
          aria-label="Lista informațiilor utile"
        >
          {filtered.map((item) => (
            <article
              className="informatii-card"
              key={item.id}
              role="link"
              tabIndex={0}
              aria-label={`Deschide ${item.title}`}
              onClick={() => openUsefulInfo(item)}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();

                  openUsefulInfo(item);
                }
              }}
            >
              <div className="informatii-card-top">
                <div className="informatii-card-icon">
                  <FileText size={22} />
                </div>

                <span className="informatii-card-id">#{item.id}</span>
              </div>

              <div className="informatii-card-body">
                {item.category && (
                  <span className="informatii-category">{item.category}</span>
                )}

                <h2>{item.title}</h2>

                <p className="informatii-preview">
                  {String(item.content || "").trim() ||
                    "Apasă pentru a deschide materialul atașat."}
                </p>
              </div>

              <div className="informatii-card-meta">
                {(item.created_by_name || item.created_by_username) && (
                  <span>
                    <UserRound size={14} />

                    {item.created_by_name || item.created_by_username}
                  </span>
                )}

                {item.created_at && (
                  <span>
                    <CalendarDays size={14} />

                    {formatDate(item.created_at)}
                  </span>
                )}
              </div>

              <div className="informatii-card-footer">
                <button
                  type="button"
                  className="informatii-view-button"
                  onClick={(event) => {
                    event.stopPropagation();

                    openUsefulInfo(item);
                  }}
                >
                  Deschide materialul <ArrowUpRight size={17} />
                </button>

                <div className="informatii-actions">
                  {canEdit && (
                    <button
                      type="button"
                      className="informatii-icon-button"
                      title="Editează"
                      aria-label={`Editează ${item.title}`}
                      onClick={(event) => {
                        event.stopPropagation();

                        navigate(`/informatii-utile/${item.id}/edit`);
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      className="informatii-icon-button danger"
                      title="Șterge"
                      aria-label={`Șterge ${item.title}`}
                      disabled={deletingId !== null}
                      onClick={(event) => {
                        event.stopPropagation();

                        handleDelete(item);
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {gallery && (
        <TelegramGallery
          entityType="informatii_utile"
          entityId={gallery.item.id}
          title={gallery.item.title}
          initialAttachmentId={gallery.initialAttachmentId}
          onClose={() => setGallery(null)}
        />
      )}

      {viewer && (
        <div
          className="informatii-viewer-backdrop"
          onClick={() => setViewer(null)}
        >
          <section
            className="informatii-viewer-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Materiale: ${viewer.item.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="informatii-viewer-header">
              <div>
                <h2>{viewer.item.title}</h2>
                <p>
                  {viewer.attachments.length
                    ? "Selectează materialul pe care vrei să îl deschizi."
                    : "Conținutul informației"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewer(null)}
                aria-label="Închide"
              >
                <X size={20} />
              </button>
            </div>
            {viewer.attachments.length ? (
              <div className="informatii-viewer-list">
                {viewer.attachments.map((attachment) => {
                  const isLink = attachment.attachment_type === "link";
                  const category = attachment.file_category;
                  return (
                    <button
                      type="button"
                      key={attachment.id}
                      className="informatii-viewer-item"
                      disabled={openingId === attachment.id}
                      onClick={() => openMaterial(attachment)}
                    >
                      {isLink ? (
                        <Link2 size={21} />
                      ) : category === "image" ? (
                        <ImageIcon size={21} />
                      ) : category === "video" ? (
                        <Video size={21} />
                      ) : (
                        <FileText size={21} />
                      )}
                      <span>
                        {attachment.original_name ||
                          attachment.name ||
                          "Material atașat"}
                      </span>
                      <ExternalLink size={17} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="informatii-viewer-text">
                {viewer.item.content?.trim() ||
                  "Nu există materiale atașate acestui card."}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default InformatiiUtile;
