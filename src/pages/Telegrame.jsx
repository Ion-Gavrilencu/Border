import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  Pencil,
  Trash2,
  Plus,
  FileText,
  Clock3,
  Star,
  Archive,
  Eye,
  CalendarDays,
  UserRound,
  Folder,
  Info,
  LockKeyhole,
} from "lucide-react";

import { toast } from "sonner";

import Swal from "sweetalert2";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import TelegramGallery from "../components/TelegramGallery";

import "./Telegrame.css";

function Telegrame() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const [telegrame, setTelegrame] = useState([]);

  const [activeFilter, setActiveFilter] = useState("toate");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [deletingId, setDeletingId] = useState(null);

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

        toast.info("Această telegramă nu are documente sau linkuri atașate.");

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

      toast.error("Nu s-a putut deschide documentul sau linkul telegramei.");
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

    const result = await Swal.fire({
      title: "Ștergi telegrama?",

      text: `„${telegram.title}” va fi ștearsă definitiv.`,

      icon: "warning",

      showCancelButton: true,

      confirmButtonText: "Da, șterge",

      cancelButtonText: "Anulează",

      confirmButtonColor: "#c0394a",

      cancelButtonColor: "#64748b",

      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    setDeletingId(telegram.id);

    setError("");

    try {
      await api.delete(`/telegrame/${telegram.id}`);

      setTelegrame((current) =>
        current.filter((item) => item.id !== telegram.id),
      );

      toast.success("Telegrama a fost ștearsă.");

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
      <div className="telegrame-page telegrame-modern">
        <div className="telegram-loading">Se încarcă telegramele...</div>
      </div>
    );
  }

  return (
    <div className="telegrame-page telegrame-modern">
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
              onClick={() => navigate("/telegrame/adauga")}
            >
              <Plus size={17} /> Adaugă telegramă
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="telegram-error" role="alert">
          {error}
        </div>
      )}

      {/* FILTRE CATEGORII — căutarea este în Navbar */}

      <div className="telegram-mobile-toolbar">
        {canEdit && (
          <button
            type="button"
            className="telegram-mobile-add"
            onClick={() => navigate("/telegrame/adauga")}
          >
            <Plus size={18} />
            Adaugă telegramă
          </button>
        )}

        <div
          className="telegram-filter-tabs"
          role="group"
          aria-label="Filtrare telegrame"
        >
          {[
            { key: "toate", label: "Toate", Icon: FileText },

            { key: "recente", label: "Recente", Icon: Clock3 },

            { key: "importante", label: "Importante", Icon: Star },

            { key: "arhiva", label: "Arhivă", Icon: Archive },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`telegram-filter-tab ${activeFilter === key ? "is-active" : ""}`}
              aria-pressed={activeFilter === key}
              onClick={() => setActiveFilter(key)}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* TABEL DESKTOP ȘI CARDURI MOBILE */}

      {(() => {
        const filtered = telegrame
          .filter((telegram) => {
            const category = String(
              telegram.category ?? telegram.categorie ?? "",
            ).toLowerCase();

            if (activeFilter === "importante")
              return (
                telegram.is_important === true ||
                category === "important" ||
                category === "importante"
              );

            if (activeFilter === "arhiva")
              return (
                telegram.is_archived === true ||
                category === "arhiva" ||
                category === "arhivă"
              );

            if (activeFilter === "recente") {
              const date = new Date(
                telegram.telegram_date || telegram.created_at,
              );

              return (
                !Number.isNaN(date.getTime()) &&
                Date.now() - date.getTime() <= 30 * 86400000 &&
                Date.now() >= date.getTime()
              );
            }

            return true;
          })
          .sort((a, b) => {
            const da =
              new Date(a.telegram_date || a.created_at || 0).getTime() || 0;

            const db =
              new Date(b.telegram_date || b.created_at || 0).getTime() || 0;

            return db - da;
          });

        const dateText = (telegram) =>
          telegram.telegram_date
            ? new Date(telegram.telegram_date).toLocaleDateString("ro-RO")
            : "—";

        const authorText = (telegram) =>
          telegram.created_by_name || telegram.created_by_username || "—";

        const categoryText = (telegram) => {
          const value = String(
            telegram.category ?? telegram.categorie ?? "General",
          );

          return value || "General";
        };

        const categoryKind = (telegram) => {
          const value = categoryText(telegram).toLowerCase();

          if (value.includes("import")) return "important";

          if (value.includes("inform")) return "info";

          if (value.includes("intern")) return "intern";

          return "general";
        };

        return filtered.length === 0 ? (
          <div className="telegram-empty">
            {telegrame.length === 0
              ? "Nu există telegrame."
              : "Nu au fost găsite telegrame pentru filtrul selectat."}
          </div>
        ) : (
          <>
            <div className="telegrame-table-wrapper">
              <table className="telegrame-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Număr</th>
                    <th>Titlu</th>
                    <th>Data</th>
                    <th>Creat de</th>
                    {(canEdit || canDelete) && <th>Acțiuni</th>}
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((telegram) => (
                    <tr
                      key={telegram.id}
                      className="telegram-row"
                      onClick={() => handleOpenTelegram(telegram)}
                    >
                      <td>{telegram.id}</td>
                      <td>{telegram.number || "—"}</td>

                      <td className="telegram-title-cell">
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

                      <td>{dateText(telegram)}</td>
                      <td>{authorText(telegram)}</td>

                      {(canEdit || canDelete) && (
                        <td
                          className="telegram-actions-cell"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="telegram-row-actions">
                            {canEdit && (
                              <button
                                type="button"
                                className="telegram-action-button telegram-action-edit"
                                title="Editează"
                                onClick={() => handleEditTelegram(telegram)}
                              >
                                <Pencil size={17} />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                className="telegram-action-button telegram-action-delete"
                                title="Șterge"
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

            <div className="telegram-mobile-list">
              {filtered.map((telegram, index) => {
                const kind = categoryKind(telegram);

                const Icon =
                  kind === "important"
                    ? Star
                    : kind === "info"
                      ? Info
                      : kind === "intern"
                        ? LockKeyhole
                        : Folder;

                return (
                  <article
                    className={`telegram-mobile-card telegram-kind-${kind}`}
                    key={telegram.id}
                  >
                    <div className="telegram-card-main">
                      <div className="telegram-card-document">
                        <FileText size={27} strokeWidth={1.9} />
                      </div>

                      <div className="telegram-card-content">
                        <div className="telegram-card-badges">
                          <span>ID: {telegram.id}</span>
                          <span>Nr. {telegram.number || "—"}</span>
                        </div>

                        <button
                          type="button"
                          className="telegram-card-title"
                          onClick={() => handleOpenTelegram(telegram)}
                        >
                          {telegram.title}
                        </button>

                        <div className="telegram-card-author">
                          <UserRound size={14} />{" "}
                          <span>{authorText(telegram)}</span>
                        </div>
                      </div>

                      <span className="telegram-card-date">
                        <CalendarDays size={14} /> {dateText(telegram)}
                      </span>
                    </div>

                    <div className="telegram-card-footer">
                      <span
                        className={`telegram-card-category telegram-category-${kind}`}
                      >
                        <Icon size={14} /> {categoryText(telegram)}
                      </span>

                      <div className="telegram-card-actions">
                        <button
                          type="button"
                          title="Vizualizează"
                          aria-label={`Vizualizează ${telegram.title}`}
                          onClick={() => handleOpenTelegram(telegram)}
                        >
                          <Eye size={19} />
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            title="Editează"
                            aria-label={`Editează ${telegram.title}`}
                            onClick={() => handleEditTelegram(telegram)}
                          >
                            <Pencil size={18} />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            className="is-delete"
                            title="Șterge"
                            aria-label={`Șterge ${telegram.title}`}
                            disabled={deletingId !== null}
                            onClick={() => handleDeleteTelegram(telegram)}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        );
      })()}

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
