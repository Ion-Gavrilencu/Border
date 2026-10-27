import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { Pencil, Trash2 } from "lucide-react";

import DocumentUploader from "../components/DocumentUploader";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import TelegramGallery from "../components/TelegramGallery";

import "./Telegrame.css";

const emptyForm = {
  title: "",

  number: "",

  telegramDate: "",

  content: "",
};

const getFileCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";

  if (file.type.startsWith("video/")) return "video";

  if (file.type === "application/pdf") return "pdf";

  if (/\.docx?$/i.test(file.name)) return "word";

  return "other";
};

function Telegrame() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const [telegrame, setTelegrame] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [formData, setFormData] = useState({ ...emptyForm });

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [linkUrl, setLinkUrl] = useState("");

  const [galleryTelegram, setGalleryTelegram] = useState(null);

  useEffect(() => {
    let active = true;

    const loadTelegrame = async () => {
      try {
        const response = await api.get("/telegrame");

        if (active) {
          setTelegrame(response.data.telegrame || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message || "Nu s-au putut încărca telegramele.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTelegrame();

    return () => {
      active = false;
    };
  }, []);

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
      setError("Denumirea telegramei este obligatorie.");

      return;
    }

    if (selectedFiles.length === 0 && !linkUrl.trim()) {
      setError("Adaugă un document, fotografii sau un link.");

      return;
    }

    if (linkUrl.trim()) {
      try {
        const url = new URL(linkUrl.trim());

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Link invalid");
        }
      } catch {
        setError("Introdu un link HTTP sau HTTPS valid.");

        return;
      }
    }

    setSaving(true);

    setError("");

    try {
      const response = await api.post("/telegrame", {
        ...formData,

        title: formData.title.trim(),
      });

      const telegram = response.data.telegram;

      const failed = [];

      for (const file of selectedFiles) {
        try {
          const data = new FormData();

          data.append("file", file);

          data.append("entityType", "telegrame");

          data.append("entityId", telegram.id);

          data.append("fileCategory", getFileCategory(file));

          await api.post("/attachments/upload", data);
        } catch (err) {
          console.error("Eroare încărcare fișier:", err);

          failed.push(file.name);
        }
      }

      if (linkUrl.trim()) {
        try {
          await api.post("/attachments/link", {
            entityType: "telegrame",

            entityId: telegram.id,

            name: telegram.title,

            url: linkUrl.trim(),
          });
        } catch (err) {
          console.error("Eroare salvare link:", err);

          failed.push("Link");
        }
      }

      setTelegrame((current) => [telegram, ...current]);

      resetForm();

      if (failed.length > 0) {
        alert(
          `Telegrama a fost creată, dar nu s-au salvat: ${failed.join(", ")}`,
        );
      }
    } catch (err) {
      console.error("Eroare salvare telegramă:", err);

      setError(
        err.response?.data?.message || "Telegrama nu a putut fi salvată.",
      );
    } finally {
      setSaving(false);
    }
  };

  // DESCHIDERE TELEGRAMĂ

  const handleOpenTelegram = async (telegram) => {
    const newTab = window.open("about:blank", "_blank");

    if (newTab) {
      newTab.opener = null;
    }

    try {
      const response = await api.get(`/attachments/telegrame/${telegram.id}`);

      const attachments = response.data.attachments || [];

      const images = attachments.filter(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "image" ||
            item.mime_type?.startsWith("image/")),
      );

      const pdf = attachments.find(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "pdf" ||
            item.mime_type === "application/pdf" ||
            /\.pdf$/i.test(
              item.original_name || item.file_name || item.name || "",
            )),
      );

      // Mai multe fotografii: deschidem galeria.

      if (!pdf && images.length > 1) {
        newTab?.close();

        setGalleryTelegram(telegram);

        return;
      }

      const attachment = pdf || attachments[0];

      if (!attachment) {
        newTab?.close();

        alert("Această telegramă nu are documente sau linkuri atașate.");

        return;
      }

      let url;

      if (attachment.attachment_type === "link") {
        url = attachment.url;

        if (!/^https?:\/\//i.test(url || "")) {
          throw new Error("Link invalid");
        }
      } else {
        url = `${api.defaults.baseURL}/attachments/file/${attachment.id}`;
      }

      if (newTab && !newTab.closed) {
        newTab.location.replace(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      newTab?.close();

      console.error("Eroare deschidere telegramă:", err);

      setError("Nu s-a putut deschide documentul sau linkul telegramei.");
    }
  };

  // EDITARE TELEGRAMĂ

  const handleEditTelegram = (telegram) => {
    if (!canEdit) return;

    navigate(`/telegrame/${telegram.id}/edit`);
  };

  // ȘTERGERE TELEGRAMĂ

  const handleDeleteTelegram = async (telegram) => {
    if (!canDelete || deletingId !== null) return;

    const confirmed = window.confirm(
      `Sigur dorești să ștergi telegrama "${telegram.title}"?\n\nAceastă acțiune nu poate fi anulată.`,
    );

    if (!confirmed) return;

    setDeletingId(telegram.id);

    setError("");

    try {
      await api.delete(`/telegrame/${telegram.id}`);

      setTelegrame((current) =>
        current.filter((item) => item.id !== telegram.id),
      );

      if (galleryTelegram?.id === telegram.id) {
        setGalleryTelegram(null);
      }
    } catch (err) {
      console.error("Eroare ștergere telegramă:", err);

      setError(
        err.response?.data?.message || "Telegrama nu a putut fi ștearsă.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="telegrame-page">
        <div className="telegram-loading">Se încarcă telegramele...</div>
      </div>
    );
  }

  return (
    <div className="telegrame-page">
      {/* ANTET */}

      <div className="telegrame-header">
        <div>
          <h1>Telegrame</h1>

          <p className="telegrame-description">
            Lista telegramelor disponibile în platformă.
          </p>
        </div>

        {canEdit && (
          <div className="telegram-header-actions">
            <button
              type="button"
              className="telegram-add-button"
              onClick={() => {
                if (showForm) {
                  resetForm();
                } else {
                  setShowForm(true);
                }
              }}
            >
              {showForm ? "Închide formularul" : "+ Adaugă telegramă"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="telegram-error" role="alert">
          {error}
        </div>
      )}

      {/* FORMULAR ADĂUGARE */}

      {showForm && canEdit && (
        <form className="telegram-form" onSubmit={handleSubmit}>
          <div className="telegram-form-header">
            <h2>Adaugă telegramă</h2>

            <button
              type="button"
              className="telegram-form-close"
              onClick={resetForm}
              disabled={saving}
              aria-label="Închide formularul"
            >
              ×
            </button>
          </div>

          <div className="telegram-form-body">
            <div className="telegram-form-group">
              <label htmlFor="telegram-number">Număr telegramă</label>

              <input
                id="telegram-number"
                type="text"
                placeholder="Ex: 125/2026"
                value={formData.number}
                onChange={(e) =>
                  setFormData({
                    ...formData,

                    number: e.target.value,
                  })
                }
              />
            </div>

            <div className="telegram-form-group">
              <label htmlFor="telegram-date">Data telegramei</label>

              <input
                id="telegram-date"
                type="date"
                value={formData.telegramDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,

                    telegramDate: e.target.value,
                  })
                }
              />
            </div>

            <div className="telegram-form-group telegram-form-full">
              <label htmlFor="telegram-title">Denumirea telegramei</label>

              <input
                id="telegram-title"
                type="text"
                required
                placeholder="Introduceți denumirea telegramei"
                value={formData.title}
                onChange={(e) =>
                  setFormData({
                    ...formData,

                    title: e.target.value,
                  })
                }
              />
            </div>

            <div className="telegram-form-group telegram-form-full">
              <label>Conținutul telegramei</label>

              <DocumentUploader
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                linkUrl={linkUrl}
                onLinkChange={setLinkUrl}
                disabled={saving}
                onError={setError}
              />
            </div>
          </div>

          <div className="telegram-form-actions">
            <button
              type="button"
              className="telegram-cancel-button"
              onClick={resetForm}
              disabled={saving}
            >
              Anulează
            </button>

            <button
              type="submit"
              className="telegram-save-button"
              disabled={saving}
            >
              {saving ? "Se salvează..." : "Salvează telegrama"}
            </button>
          </div>
        </form>
      )}

      {/* TABEL TELEGRAME */}

      {telegrame.length === 0 ? (
        <div className="telegram-empty">Nu există telegrame.</div>
      ) : (
        <div className="telegrame-table-wrapper">
          <table className="telegrame-table">
            <thead>
              <tr>
                <th>ID</th>

                <th>Număr</th>

                <th>Titlu</th>

                <th>Data</th>

                <th>Creat de</th>

                {(canEdit || canDelete) && (
                  <th className="telegram-actions-heading">Acțiuni</th>
                )}
              </tr>
            </thead>

            <tbody>
              {telegrame.map((telegram) => (
                <tr
                  key={telegram.id}
                  className="telegram-row"
                  onClick={() => handleOpenTelegram(telegram)}
                >
                  <td data-label="ID">{telegram.id}</td>

                  <td data-label="Număr">{telegram.number || "—"}</td>

                  <td>
                    <button
                      type="button"
                      className="telegram-title-link"
                      onClick={(event) => {
                        event.stopPropagation();

                        handleOpenTelegram(telegram);
                      }}
                    >
                      {telegram.title}
                    </button>
                  </td>

                  <td>
                    {telegram.telegram_date
                      ? new Date(telegram.telegram_date).toLocaleDateString(
                          "ro-RO",
                        )
                      : "—"}
                  </td>

                  <td>
                    {telegram.created_by_name ||
                      telegram.created_by_username ||
                      "—"}
                  </td>

                  {(canEdit || canDelete) && (
                    <td
                      className="telegram-actions-cell"
                      data-label="Acțiuni"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="telegram-row-actions">
                        {canEdit && (
                          <button
                            type="button"
                            className="telegram-action-button telegram-action-edit"
                            title="Editează telegrama"
                            aria-label={`Editează ${telegram.title}`}
                            onClick={() => handleEditTelegram(telegram)}
                          >
                            <Pencil size={17} />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            className="telegram-action-button telegram-action-delete"
                            title="Șterge telegrama"
                            aria-label={`Șterge ${telegram.title}`}
                            disabled={deletingId !== null}
                            onClick={() => handleDeleteTelegram(telegram)}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GALERIE FOTO */}

      {galleryTelegram && (
        <TelegramGallery
          telegramId={galleryTelegram.id}
          title={galleryTelegram.title}
          onClose={() => setGalleryTelegram(null)}
        />
      )}
    </div>
  );
}

export default Telegrame;
