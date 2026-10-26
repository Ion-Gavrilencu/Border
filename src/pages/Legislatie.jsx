

import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { Pencil, Trash2 } from "lucide-react";

import DocumentUploader from "../components/DocumentUploader";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import TelegramGallery from "../components/TelegramGallery";

import "./Legislatie.css";

const emptyForm = {

  title: "",

  lawNumber: "",

  lawDate: "",

  content: "",

};

const getFileCategory = (file) => {

  if (file.type.startsWith("image/")) return "image";

  if (file.type.startsWith("video/")) return "video";

  if (file.type === "application/pdf") return "pdf";

  if (/\.docx?$/i.test(file.name)) return "word";

  return "other";

};

function Legislatie() {

  const navigate = useNavigate();

  const { user } = useAuth();

  const canEdit =

    user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const [legislatie, setLegislatie] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [formData, setFormData] = useState({ ...emptyForm });

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [linkUrl, setLinkUrl] = useState("");

  const [galleryLegislation, setGalleryLegislation] = useState(null);

  useEffect(() => {

    let active = true;

    const loadLegislatie = async () => {

      try {

        const response = await api.get("/legislatie");

        if (active) {

          setLegislatie(response.data.legislatie || []);

        }

      } catch (err) {

        if (active) {

          setError(

            err.response?.data?.message ||

              "Nu s-au putut încărca actele normative."

          );

        }

      } finally {

        if (active) setLoading(false);

      }

    };

    loadLegislatie();

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

      setError("Denumirea actului normativ este obligatorie.");

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

      const response = await api.post("/legislatie", {

        ...formData,

        title: formData.title.trim(),

      });

      const legislation = response.data.legislation;

      const failed = [];

      for (const file of selectedFiles) {

        try {

          const data = new FormData();

          data.append("file", file);

          data.append("entityType", "legislatie");

          data.append("entityId", legislation.id);

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

            entityType: "legislatie",

            entityId: legislation.id,

            name: legislation.title,

            url: linkUrl.trim(),

          });

        } catch (err) {

          console.error("Eroare salvare link:", err);

          failed.push("Link");

        }

      }

      setLegislatie((current) => [legislation, ...current]);

      resetForm();

      if (failed.length > 0) {

        alert(

          `Legislationa a fost creată, dar nu s-au salvat: ${failed.join(", ")}`

        );

      }

    } catch (err) {

      console.error("Eroare salvare act normativ:", err);

      setError(

        err.response?.data?.message ||

          "Legislationa nu a putut fi salvată."

      );

    } finally {

      setSaving(false);

    }

  };

  // DESCHIDERE ACT NORMATIVĂ

  const handleOpenLegislation = async (legislation) => {

    const newTab = window.open("about:blank", "\_blank");

    if (newTab) {

      newTab.opener = null;

    }

    try {

      const response = await api.get(

        `/attachments/legislatie/${legislation.id}`

      );

      const attachments = response.data.attachments || [];

      const images = attachments.filter(

        (item) =>

          item.attachment_type !== "link" &&

          (item.file_category === "image" ||

            item.mime_type?.startsWith("image/"))

      );

      const pdf = attachments.find(

        (item) =>

          item.attachment_type !== "link" &&

          (item.file_category === "pdf" ||

            item.mime_type === "application/pdf" ||

            /\.pdf$/i.test(

              item.original_name ||

                item.file_name ||

                item.name ||

                ""

            ))

      );

      // Mai multe fotografii: deschidem galeria.

      if (!pdf && images.length > 1) {

        newTab?.close();

        setGalleryLegislation(legislation);

        return;

      }

      const attachment = pdf || attachments[0];

      if (!attachment) {

  newTab?.close();

  alert("Această act normativ nu are documente sau linkuri atașate.");

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

        window.open(url, "\_blank", "noopener,noreferrer");

      }

    } catch (err) {

      newTab?.close();

      console.error("Eroare deschidere act normativ:", err);

      setError(

        "Nu s-a putut deschide documentul sau linkul actului normativ."

      );

    }

  };

  // EDITARE ACT NORMATIVĂ

  const handleEditLegislation = (legislation) => {

    if (!canEdit) return;

    navigate(`/legislatie/${legislation.id}/edit`);

  };

  // ȘTERGERE ACT NORMATIVĂ

  const handleDeleteLegislation = async (legislation) => {

    if (!canDelete || deletingId !== null) return;

    const confirmed = window.confirm(

      `Sigur dorești să ștergi actul normativ "${legislation.title}"?\n\nAceastă acțiune nu poate fi anulată.`

    );

    if (!confirmed) return;

    setDeletingId(legislation.id);

    setError("");

    try {

      await api.delete(`/legislatie/${legislation.id}`);

      setLegislatie((current) =>

        current.filter((item) => item.id !== legislation.id)

      );

      if (galleryLegislation?.id === legislation.id) {

        setGalleryLegislation(null);

      }

    } catch (err) {

      console.error("Eroare ștergere act normativ:", err);

      setError(

        err.response?.data?.message ||

          "Legislationa nu a putut fi ștearsă."

      );

    } finally {

      setDeletingId(null);

    }

  };

  if (loading) {

    return (

      <div className="legislatie-page">

        <div className="legislation-loading">

          Se încarcă actele normative...

        </div>

      </div>

    );

  }

  return (

    <div className="legislatie-page">

      {/* ANTET */}

      <div className="legislatie-header">

        <div>

          <h1>Acte normative</h1>

          <p className="legislatie-description">

            Lista actelor normative disponibile în platformă.

          </p>

        </div>

        {canEdit && (

          <div className="legislation-header-actions">

            <button

              type="button"

              className="legislation-add-button"

              onClick={() => {

                if (showForm) {

                  resetForm();

                } else {

                  setShowForm(true);

                }

              }}

            >

              {showForm

                ? "Închide formularul"

                : "+ Adaugă act normativ"}

            </button>

          </div>

        )}

      </div>

      {error && (

        <div className="legislation-error" role="alert">

          {error}

        </div>

      )}

      {/* FORMULAR ADĂUGARE */}

      {showForm && canEdit && (

        <form className="legislation-form" onSubmit={handleSubmit}>

          <div className="legislation-form-header">

            <h2>Adaugă act normativ</h2>

            <button

              type="button"

              className="legislation-form-close"

              onClick={resetForm}

              disabled={saving}

              aria-label="Închide formularul"

            >

              ×

            </button>

          </div>

          <div className="legislation-form-body">

            <div className="legislation-form-group">

              <label htmlFor="legislation-lawNumber">

                Număr act normativă

              </label>

              <input

                id="legislation-lawNumber"

                type="text"

                placeholder="Ex: 125/2026"

                value={formData.lawNumber}

                onChange={(e) =>

                  setFormData({

                    ...formData,

                    lawNumber: e.target.value,

                  })

                }

              />

            </div>

            <div className="legislation-form-group">

              <label htmlFor="legislation-date">

                Data actului normativ

              </label>

              <input

                id="legislation-date"

                type="date"

                value={formData.lawDate}

                onChange={(e) =>

                  setFormData({

                    ...formData,

                    lawDate: e.target.value,

                  })

                }

              />

            </div>

            <div className="legislation-form-group legislation-form-full">

              <label htmlFor="legislation-title">

                Denumirea actului normativ

              </label>

              <input

                id="legislation-title"

                type="text"

                required

                placeholder="Introduceți denumirea actului normativ"

                value={formData.title}

                onChange={(e) =>

                  setFormData({

                    ...formData,

                    title: e.target.value,

                  })

                }

              />

            </div>

              <div className="legislation-form-group legislation-form-full">

                <label>Conținutul actului normativ</label>

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

          <div className="legislation-form-actions">

            <button

              type="button"

              className="legislation-cancel-button"

              onClick={resetForm}

              disabled={saving}

            >

              Anulează

            </button>

            <button

              type="submit"

              className="legislation-save-button"

              disabled={saving}

            >

              {saving

                ? "Se salvează..."

                : "Salvează actul"}

            </button>

          </div>

        </form>

      )}

      {/* TABEL ACTE NORMATIVE */}

      {legislatie.length === 0 ? (

        <div className="legislation-empty">

          Nu există acte normative.

        </div>

      ) : (

        <div className="legislatie-table-wrapper">

          <table className="legislatie-table">

            <thead>

              <tr>

                <th>ID</th>

                <th>Număr</th>

                <th>Titlu</th>

                <th>Data</th>

                <th>Creat de</th>

                {(canEdit || canDelete) && (

                  <th className="legislation-actions-heading">

                    Acțiuni

                  </th>

                )}

              </tr>

            </thead>

            <tbody>

              {legislatie.map((legislation) => (

                <tr

                  key={legislation.id}

                  className="legislation-row"

                  onClick={() => handleOpenLegislation(legislation)}

                >

                  <td>{legislation.id}</td>

                  <td>{legislation.law_number || "—"}</td>

                  <td>

                    <button

                      type="button"

                      className="legislation-title-link"

                      onClick={(event) => {

                        event.stopPropagation();

                        handleOpenLegislation(legislation);

                      }}

                    >

                      {legislation.title}

                    </button>

                  </td>

                  <td>

                    {legislation.law_date

                      ? new Date(

                          legislation.law_date

                        ).toLocaleDateString("ro-RO")

                      : "—"}

                  </td>

                  <td>

                    {legislation.created_by_name ||

                      legislation.created_by_username ||

                      "—"}

                  </td>

                  {(canEdit || canDelete) && (

                    <td

                      className="legislation-actions-cell"

                      onClick={(event) =>

                        event.stopPropagation()

                      }

                    >

                      <div className="legislation-row-actions">

                        {canEdit && (

                          <button

                            type="button"

                            className="legislation-action-button legislation-action-edit"

                            title="Editează actul normativ"

                            aria-label={`Editează ${legislation.title}`}

                            onClick={() =>

                              handleEditLegislation(legislation)

                            }

                          >

                            <Pencil size={17} />

                          </button>

                        )}

                        {canDelete && (

                          <button

                            type="button"

                            className="legislation-action-button legislation-action-delete"

                            title="Șterge actul normativ"

                            aria-label={`Șterge ${legislation.title}`}

                            disabled={deletingId !== null}

                            onClick={() =>

                              handleDeleteLegislation(legislation)

                            }

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

      {galleryLegislation && (

        <TelegramGallery

          entityType="legislatie" entityId={galleryLegislation.id}

          title={galleryLegislation.title}

          onClose={() => setGalleryLegislation(null)}

        />

      )}

    </div>

  );

}

export default Legislatie;
