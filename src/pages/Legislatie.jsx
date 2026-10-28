
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Plus } from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import TelegramGallery from "../components/TelegramGallery";

import "./Legislatie.css";

function Legislatie() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit =
    user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";

  const [legislatie, setLegislatie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [galleryLegislation, setGalleryLegislation] =
    useState(null);

  useEffect(() => {
    let active = true;

    const loadLegislatie = async () => {
      try {
        setLoading(true);
        setError("");

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
        if (active) {
          setLoading(false);
        }
      }
    };

    loadLegislatie();

    return () => {
      active = false;
    };
  }, []);

  // DESCHIDERE DOCUMENT SAU LINK
  const handleOpenLegislation = async (legislation) => {
    const newTab = window.open("about:blank", "_blank");

    if (newTab) {
      newTab.opener = null;
    }

    try {
      setError("");

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

      // Deschidem galeria dacă sunt mai multe imagini
      // și nu există document PDF.
      if (!pdf && images.length > 1) {
        newTab?.close();
        setGalleryLegislation(legislation);
        return;
      }

      const attachment = pdf || attachments[0];

      if (!attachment) {
        newTab?.close();
        alert(
          "Acest act normativ nu are documente sau linkuri atașate."
        );
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

      console.error(
        "Eroare deschidere act normativ:",
        err
      );

      setError(
        "Nu s-a putut deschide documentul sau linkul actului normativ."
      );
    }
  };

  // EDITARE
  const handleEditLegislation = (legislation) => {
    if (!canEdit) return;

    navigate(`/legislatie/${legislation.id}/edit`);
  };

  // ȘTERGERE
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
        current.filter(
          (item) => item.id !== legislation.id
        )
      );

      if (galleryLegislation?.id === legislation.id) {
        setGalleryLegislation(null);
      }
    } catch (err) {
      console.error(
        "Eroare ștergere act normativ:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Actul normativ nu a putut fi șters."
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
              onClick={() =>
                navigate("/legislatie/adauga")
              }
            >
              <Plus size={18} />
              Adaugă act normativ
            </button>
          </div>
        )}
      </div>

      {/* ERORI */}
      {error && (
        <div
          className="legislation-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* LISTA ACTELOR NORMATIVE */}
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
                  onClick={() =>
                    handleOpenLegislation(legislation)
                  }
                >
                  <td data-label="ID">
                    {legislation.id}
                  </td>

                  <td data-label="Număr">
                    {legislation.law_number || "—"}
                  </td>

                  <td
                    data-label="Titlu"
                    className="legislation-title-cell"
                  >
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

                  <td data-label="Data">
                    {legislation.law_date
                      ? new Date(
                          legislation.law_date
                        ).toLocaleDateString("ro-RO")
                      : "—"}
                  </td>

                  <td data-label="Creat de">
                    {legislation.created_by_name ||
                      legislation.created_by_username ||
                      "—"}
                  </td>

                  {(canEdit || canDelete) && (
                    <td
                      data-label="Acțiuni"
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
                              handleEditLegislation(
                                legislation
                              )
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
                              handleDeleteLegislation(
                                legislation
                              )
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
          entityType="legislatie"
          entityId={galleryLegislation.id}
          title={galleryLegislation.title}
          onClose={() =>
            setGalleryLegislation(null)
          }
        />
      )}
    </div>
  );
}

export default Legislatie;
