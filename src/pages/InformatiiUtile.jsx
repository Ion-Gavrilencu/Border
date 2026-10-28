import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  BookOpen,
  Plus,
  X,
  ArrowUpRight,
  Pencil,
  Trash2,
  FolderOpen,
  FileText,
  ArrowDownUp,
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
  Eye,
  Download,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./InformatiiUtile.css";
import TelegramGallery from "../components/TelegramGallery";
const getInfoFormat = (item) => {
  const value = String(
    item.format ||
      item.file_format ||
      item.mime_type ||
      item.original_name ||
      "",
  ).toLowerCase();
  if (value.includes("pdf")) return "PDF";
  if (value.includes("doc")) return "DOCX";
  if (value.includes("xls")) return "XLSX";
  if (value.includes("zip")) return "ZIP";
  if (value.includes("image") || /\.(jpg|jpeg|png|webp)$/.test(value))
    return "IMG";
  if (value.includes("video") || /\.(mp4|webm)$/.test(value)) return "VIDEO";
  if (item.url) return "LINK";
  return "—";
};
const formatBytes = (n) =>
  !Number(n) ? "—" : `${(Number(n) / 1048576).toFixed(1)} MB`;
const getCategoryTone = (value) => {
  const name = String(value || "").toLocaleLowerCase("ro-RO");
  if (name.includes("procedur")) return "proceduri";
  if (name.includes("legisla") || name.includes("normativ"))
    return "legislatie";
  if (name.includes("inform") || name.includes("contact")) return "informativ";
  return "ghiduri";
};
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
function ModernFilter({ icon: Icon, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);
  return (
    <div className={`info-filter ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="info-filter-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="info-filter-icon">
          <Icon size={18} />
        </span>
        <span className="info-filter-copy">
          <span className="info-filter-caption">{label}</span>
          <strong>{selected?.label || label}</strong>
        </span>
        <ChevronDown className="info-filter-chevron" size={16} />
      </button>
      {open && (
        <div className="info-filter-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={`info-filter-option ${value === option.value ? "is-active" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {value === option.value && <CheckCircle2 size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function InformatiiUtile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [informatii, setInformatii] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [category, setCategory] = useState("Toate");
  const [page, setPage] = useState(1);
  const [formatFilter, setFormatFilter] = useState("Toate");
  const [checkedIds, setCheckedIds] = useState([]);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [pageSize, setPageSize] = useState(8);
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
    if (type === "error") toast.error(text);
    else toast.success(text);
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
      const format = getInfoFormat(item);
      const matchesFormat = formatFilter === "Toate" || format === formatFilter;
      return matchesCategory && matchesFormat;
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
  }, [informatii, category, sort, formatFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
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
        `/attachments/informatii_utile/${item.id}`,
      );
      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];
      const images = attachments.filter(
        (attachment) =>
          attachment.attachment_type === "file" &&
          (attachment.file_category === "image" ||
            attachment.mime_type?.startsWith("image/")),
      );
      // Dacă toate materialele sunt fotografii,
      // deschidem direct galeria, indiferent de numărul lor.
      if (attachments.length > 0 && images.length === attachments.length) {
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
          { responseType: "blob" },
        );
        const blobUrl = URL.createObjectURL(fileResponse.data);
        if (preopenedTab) {
          preopenedTab.location.replace(blobUrl);
        } else {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download =
            attachment.original_name || attachment.name || "document";
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
        "error",
      );
    } finally {
      setOpeningCardId(null);
    }
  };
  const handleDelete = async (item) => {
    if (!canDelete || deletingId !== null) return;
    const result = await Swal.fire({
      title: "Ștergi informația?",
      text: `„${item.title}” va fi eliminată definitiv.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Da, șterge",
      cancelButtonText: "Anulează",
      confirmButtonColor: "#c43d52",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
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
    <main className="informatii-page informatii-modern">
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
            onClick={() => navigate("/informatii-utile/adauga")}
          >
            <Plus size={17} />
            Adaugă informație
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
      <section className="informatii-toolbar" aria-label="Filtrare și ordonare">
        <ModernFilter
          icon={FolderOpen}
          label="Categorie"
          value={category}
          options={categories.map((name) => ({
            value: name,
            label: name === "Toate" ? "Toate categoriile" : name,
          }))}
          onChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
        />
        <ModernFilter
          icon={FileText}
          label="Format"
          value={formatFilter}
          options={[
            { value: "Toate", label: "Toate formatele" },
            ...["PDF", "DOCX", "XLSX", "ZIP", "IMG", "VIDEO", "LINK", "—"].map(
              (name) => ({
                value: name,
                label: name === "—" ? "Nespecificat" : name,
              }),
            ),
          ]}
          onChange={(value) => {
            setFormatFilter(value);
            setPage(1);
          }}
        />
        <ModernFilter
          icon={ArrowDownUp}
          label="Ordonare"
          value={sort}
          options={[
            { value: "recent", label: "Cele mai recente" },
            { value: "az", label: "Titlu A–Z" },
            { value: "za", label: "Titlu Z–A" },
          ]}
          onChange={setSort}
        />
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
        <>
          <div className="informatii-desktop-layout">
            <div className="informatii-table-panel">
              <div className="informatii-table-scroll">
                <table className="informatii-table">
                  <thead>
                    <tr>
                      <th className="info-check-col">
                        <input
                          type="checkbox"
                          aria-label="Selectează pagina"
                          checked={
                            visibleItems.length > 0 &&
                            visibleItems.every((i) => checkedIds.includes(i.id))
                          }
                          onChange={(e) =>
                            setCheckedIds((ids) =>
                              e.target.checked
                                ? [
                                    ...new Set([
                                      ...ids,
                                      ...visibleItems.map((i) => i.id),
                                    ]),
                                  ]
                                : ids.filter(
                                    (id) =>
                                      !visibleItems.some((i) => i.id === id),
                                  ),
                            )
                          }
                        />
                      </th>
                      <th>TITLU</th>
                      <th>CATEGORIE</th>
                      <th>FORMAT</th>
                      <th>CREAT DE</th>
                      <th>DATA</th>
                      <th>ACȚIUNI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => {
                      const format = getInfoFormat(item);
                      return (
                        <tr
                          key={item.id}
                          className={
                            selectedInfo?.id === item.id ? "is-selected" : ""
                          }
                          onClick={() => setSelectedInfo(item)}
                        >
                          <td className="info-check-col">
                            <input
                              type="checkbox"
                              aria-label={`Selectează ${item.title}`}
                              checked={checkedIds.includes(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                setCheckedIds((ids) =>
                                  e.target.checked
                                    ? [...ids, item.id]
                                    : ids.filter((id) => id !== item.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="info-title-button"
                              type="button"
                              onClick={() => setSelectedInfo(item)}
                            >
                              <span
                                className={`info-file-icon tone-${getCategoryTone(item.category)}`}
                              >
                                <FileText size={21} />
                              </span>
                              <span>
                                <strong>{item.title}</strong>
                                <small>
                                  {String(
                                    item.content ||
                                      "Material disponibil în platformă",
                                  ).slice(0, 85)}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span
                              className={`info-table-badge tone-${getCategoryTone(item.category)}`}
                            >
                              {item.category || "General"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`info-format-badge format-${format.toLowerCase()}`}
                            >
                              <FileText size={14} />
                              {format}
                            </span>
                          </td>
                          <td>
                            {item.created_by_name ||
                              item.created_by_username ||
                              "—"}
                          </td>
                          <td>{formatDate(item.created_at) || "—"}</td>
                          <td>
                            <div className="info-table-actions">
                              
                              {canEdit && (
                                <button
                                  type="button"
                                  title="Editează"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/informatii-utile/${item.id}/edit`,
                                    );
                                  }}
                                >
                                  <Pencil size={17} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="danger"
                                  title="Șterge"
                                  disabled={deletingId !== null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(item);
                                  }}
                                >
                                  <Trash2 size={17} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="info-table-pagination">
                <div className="info-page-size">
                  <select
                    aria-label="Rezultate pe pagină"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>
                    Afișate {(currentPage - 1) * pageSize + 1} –{" "}
                    {Math.min(currentPage * pageSize, filtered.length)} din{" "}
                    {filtered.length} rezultate
                  </span>
                </div>
                <div className="info-page-buttons">
                  <button
                    type="button"
                    aria-label="Pagina precedentă"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      type="button"
                      key={i}
                      className={currentPage === i + 1 ? "active" : ""}
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Pagina următoare"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
            <aside className="info-detail-panel">
              {selectedInfo ? (
                <>
                  <div className="info-detail-heading">
                    <span className="info-file-icon">
                      <FileText size={23} />
                    </span>
                    <div>
                      <h2>{selectedInfo.title}</h2>
                      <p>
                        {String(
                          selectedInfo.content ||
                            "Detalii despre materialul selectat",
                        ).slice(0, 75)}
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Închide detaliile"
                      onClick={() => setSelectedInfo(null)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="info-detail-summary">
                    <div>
                      <span>Categorie</span>
                      <strong className="info-table-badge">
                        {selectedInfo.category || "General"}
                      </strong>
                    </div>
                    <div>
                      <span>Format</span>
                      <strong className="info-format-badge">
                        <FileText size={14} />
                        {getInfoFormat(selectedInfo)}
                      </strong>
                    </div>
                    <div>
                      <span>Dimensiune</span>
                      <strong>
                        {selectedInfo.file_size
                          ? formatBytes(selectedInfo.file_size)
                          : "—"}
                      </strong>
                    </div>
                  </div>
                  <div className="info-detail-fields">
                    <div>
                      <span>
                        <UserRound size={15} /> Creat de
                      </span>
                      <strong>
                        {selectedInfo.created_by_name ||
                          selectedInfo.created_by_username ||
                          "—"}
                      </strong>
                    </div>
                    <div>
                      <span>
                        <CalendarDays size={15} /> Data creării
                      </span>
                      <strong>
                        {formatDate(selectedInfo.created_at) || "—"}
                      </strong>
                    </div>
                    <div>
                      <span>
                        <CalendarDays size={15} /> Ultima modificare
                      </span>
                      <strong>
                        {formatDate(selectedInfo.updated_at) || "—"}
                      </strong>
                    </div>
                    <div>
                      <span>
                        <Download size={15} /> Descărcări
                      </span>
                      <strong>{selectedInfo.download_count ?? "—"}</strong>
                    </div>
                  </div>
                  {Array.isArray(selectedInfo.tags) &&
                    selectedInfo.tags.length > 0 && (
                      <div className="info-detail-tags">
                        <h3>Etichete</h3>
                        {selectedInfo.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                  <h3>Descriere</h3>
                  <p className="info-detail-description">
                    {selectedInfo.content ||
                      "Acest material conține documente sau linkuri atașate."}
                  </p>
                  <div className="info-detail-buttons">
                    <button
                      type="button"
                      className="info-detail-preview"
                      onClick={() => openUsefulInfo(selectedInfo)}
                    >
                      <Eye size={17} /> Previzualizează
                    </button>
                    <button
                      type="button"
                      className="info-detail-open"
                      onClick={() => openUsefulInfo(selectedInfo)}
                    >
                      <ExternalLink size={17} /> Deschide materialul
                    </button>
                  </div>
                </>
              ) : (
                <div className="info-detail-empty">
                  <FolderOpen size={32} />
                  <h3>Detalii material</h3>
                  <p>
                    Selectează un rând din tabel pentru a vedea informațiile și
                    a deschide documentele.
                  </p>
                </div>
              )}
            </aside>
          </div>
          <div className="informatii-mobile-list">
            <section
              className="informatii-grid"
              aria-label="Lista informațiilor utile"
            >
              {filtered.map((item) => (
                <article
                  className={`informatii-card tone-${getCategoryTone(item.category)}`}
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
                      <span className="informatii-category">
                        {item.category}
                      </span>
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
          </div>
        </>
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
