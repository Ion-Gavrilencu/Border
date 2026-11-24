import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  BookOpen,
  Search,
  Plus,
  X,
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
  Download,
  Star,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/authStore";
import "./InformatiiUtile.css";
import TelegramGallery from "../components/TelegramGallery";
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const dayKey = (value) => {
  const d = new Date(value || "");
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
};
const getInfoFormat = (item) => {
  const value = String(
    item.format || item.file_format || item.mime_type || item.original_name || "",
  ).toLowerCase();
  if (value.includes("pdf")) return "PDF";
  if (value.includes("doc")) return "DOCX";
  if (value.includes("xls")) return "XLSX";
  if (value.includes("zip")) return "ZIP";
  if (value.includes("image") || /\.(jpg|jpeg|png|webp)$/i.test(value)) return "IMG";
  if (value.includes("video") || /\.(mp4|webm)$/i.test(value)) return "VIDEO";
  if (item.url) return "LINK";
  return "—";
};
const formatBytes = (n) => (!Number(n) ? "—" : `${(Number(n) / 1048576).toFixed(1)} MB`);
const getCategoryTone = (value) => {
  const name = String(value || "").toLocaleLowerCase("ro-RO");
  if (name.includes("procedur")) return "proceduri";
  if (name.includes("legisla") || name.includes("normativ")) return "legislatie";
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
  const location = useLocation();
  const navigationHandledRef = useRef(null);
  const deepLinkId = new URLSearchParams(location.search).get("open");
  const [highlightedInfoId, setHighlightedInfoId] = useState(null);
  const [targetInfoId, setTargetInfoId] = useState(null);
  const [informatii, setInformatii] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [category, setCategory] = useState("Toate");
  const [page, setPage] = useState(1);
  const [formatFilter, setFormatFilter] = useState("Toate");
  const [checkedIds, setCheckedIds] = useState([]);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attachmentFilter, setAttachmentFilter] = useState("all");
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState(false);
  const loadLock = useRef(false);
  const deleteLock = useRef(false);
  const openLock = useRef(false);
  const materialLock = useRef(false);
  const favoriteLocks = useRef(new Set());
  const resetFilters = () => {
    setQuery("");
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setCategory("Toate");
    setFormatFilter("Toate");
    setImportantOnly(false);
    setSort("recent");
    setPage(1);
  };
  const [pageSize, setPageSize] = useState(10);
  const [importantOnly, setImportantOnly] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState([]);

  const [attachmentMeta, setAttachmentMeta] = useState({});
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
  const loadInformatii = useCallback(async (manual = false) => {
    if (loadLock.current || deleteLock.current || favoriteLocks.current.size) return;
    loadLock.current = true;
    try {
      setLoading(true);
      const response = await api.get("/informatii-utile");
      setInformatii(Array.isArray(response.data?.informatii) ? response.data.informatii : []);
      setAttachmentMeta({});
      setMetaError(false);
      setMessage("");
      setCheckedIds([]);
      if (manual === true) toast.success("Lista informațiilor a fost actualizată.");
    } catch (error) {
      console.error("GET INFORMATII UTILE:", error);
      notify(error.response?.data?.message || "Informațiile nu au putut fi încărcate.", "error");
    } finally {
      loadLock.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadInformatii();
  }, [loadInformatii]);
  const categories = useMemo(() => {
    const names = informatii.map((item) => String(item.category || "").trim()).filter(Boolean);
    return ["Toate", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "ro"))];
  }, [informatii]);
  const filtered = useMemo(() => {
    const items = informatii.filter((item) => {
      const matchesCategory =
        category === "Toate" || String(item.category || "").trim() === category;
      const meta = attachmentMeta[item.id];
      const formats = meta?.formats || [getInfoFormat(item)];
      const matchesFormat = formatFilter === "Toate" || formats.includes(formatFilter);
      const date = dayKey(item.created_at);
      const text = normalize(
        [
          item.title,
          item.content,
          item.category,
          item.created_by_name,
          item.created_by_username,
        ].join(" "),
      );
      const matchesQuery = normalize(query)
        .split(/\s+/)
        .every((term) => text.includes(term));
      const matchesDate =
        (!fromDate || (date && date >= fromDate)) && (!toDate || (date && date <= toDate));
      const matchesAttachments =
        attachmentFilter === "all" ||
        (meta?.count != null && (attachmentFilter === "with" ? meta.count > 0 : meta.count === 0));
      return (
        matchesCategory &&
        matchesFormat &&
        matchesQuery &&
        matchesDate &&
        matchesAttachments &&
        (!importantOnly || item.is_favorite === true)
      );
    });
    return [...items].sort((a, b) => {
      if (sort === "oldest")
        return (
          (new Date(a.created_at || 0).getTime() || 0) -
          (new Date(b.created_at || 0).getTime() || 0)
        );
      if (sort === "az") return String(a.title || "").localeCompare(String(b.title || ""), "ro");
      if (sort === "za") return String(b.title || "").localeCompare(String(a.title || ""), "ro");
      return (
        (new Date(b.created_at || 0).getTime() || Number(b.id) || 0) -
        (new Date(a.created_at || 0).getTime() || Number(a.id) || 0)
      );
    });
  }, [
    informatii,
    category,
    sort,
    formatFilter,
    importantOnly,
    attachmentMeta,
    query,
    fromDate,
    toDate,
    attachmentFilter,
  ]);
  // Navigare din Dashboard la informația selectată, fără rute sau componente noi.
  useEffect(() => {
    const requestedId = deepLinkId || location.state?.openDocumentId;
    if (loading || requestedId == null) return;
    const navigationKey = `${location.key}:${requestedId}`;
    if (navigationHandledRef.current === navigationKey) return;
    navigationHandledRef.current = navigationKey;
    const target = informatii.find((item) => String(item.id) === String(requestedId));
    if (!target) {
      toast.error("Informația selectată nu a fost găsită.");
      return;
    }
    // Resetăm filtrele pentru ca documentul să fie inclus în rezultate.
    setQuery("");
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setCategory("Toate");
    setFormatFilter("Toate");
    setImportantOnly(false);
    setSort("recent");
    setTargetInfoId(String(requestedId));
    setHighlightedInfoId(String(requestedId));
  }, [loading, informatii, location.key, location.state, deepLinkId]);
  // După resetarea filtrelor calculăm pagina care conține informația.
  useEffect(() => {
    if (targetInfoId === null || loading) return;
    const index = filtered.findIndex((item) => String(item.id) === targetInfoId);
    if (index < 0) return;
    setPage(Math.floor(index / pageSize) + 1);
  }, [targetInfoId, loading, filtered, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  // Evidențiem și aducem în zona vizibilă documentul, pe mobil și desktop.
  useEffect(() => {
    if (targetInfoId === null || loading) return;
    if (!visibleItems.some((item) => String(item.id) === targetInfoId)) return;
    const frame = window.requestAnimationFrame(() => {
      const element = Array.from(document.querySelectorAll("[data-info-document-id]")).find(
        (node) =>
          node.getAttribute("data-info-document-id") === targetInfoId &&
          node.getClientRects().length > 0,
      );
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTargetInfoId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [targetInfoId, loading, visibleItems, navigate, location.pathname]);
  // Fișierele sunt private: le cerem cu tokenul Axios și le deschidem ca Blob.
  const openMaterial = async (attachment) => {
    if (
      attachment.attachment_type === "file" &&
      (attachment.file_category === "image" || attachment.mime_type?.startsWith("image/"))
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
    if (materialLock.current) return;
    materialLock.current = true;
    let tab;
    try {
      tab = window.open("", "_blank");
      if (tab) tab.opener = null;
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
        link.download = attachment.original_name || attachment.name || "document";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      // Nu revocăm imediat: browserul are nevoie de URL pentru vizualizare.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (error) {
      tab?.close();
      console.error("OPEN ATTACHMENT:", error);
      notify(error.response?.data?.message || "Materialul nu a putut fi deschis.", "error");
    } finally {
      materialLock.current = false;
      setOpeningId(null);
    }
  };
  const downloadMaterial = async (attachment) => {
    if (attachment.attachment_type !== "file" || materialLock.current) return;
    materialLock.current = true;
    try {
      setOpeningId(attachment.id);
      const response = await api.get(`/attachments/file/${attachment.id}?download=1`, {
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = attachment.original_name || attachment.name || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Descărcarea a fost inițiată.");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (error) {
      console.error("DOWNLOAD ATTACHMENT:", error);
      notify(error.response?.data?.message || "Fișierul nu a putut fi descărcat.", "error");
    } finally {
      materialLock.current = false;
      setOpeningId(null);
    }
  };
  const openUsefulInfo = async (item) => {
    if (openLock.current) return;
    openLock.current = true;
    // Deschidem anticipat fila pentru linkuri și documente.
    let preopenedTab;
    try {
      preopenedTab = window.open("", "_blank");
      if (preopenedTab) preopenedTab.opener = null;
      setOpeningCardId(item.id);
      const response = await api.get(`/attachments/informatii_utile/${item.id}`);
      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];
      const images = attachments.filter(
        (attachment) =>
          attachment.attachment_type === "file" &&
          (attachment.file_category === "image" || attachment.mime_type?.startsWith("image/")),
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
        preopenedTab?.close();
        setGallery(null);
        setViewer({ item, attachments });
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
        error.response?.data?.message || error.message || "Nu s-a putut deschide materialul.",
        "error",
      );
    } finally {
      openLock.current = false;
      setOpeningCardId(null);
    }
  };
  const handleDelete = async (item) => {
    if (!canDelete || deleteLock.current || loadLock.current || favoriteLocks.current.size) return;
    deleteLock.current = true;
    try {
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
      setDeletingId(item.id);
      setMessage("");
      await api.delete(`/informatii-utile/${item.id}`);
      setInformatii((current) => current.filter((entry) => entry.id !== item.id));
      setCheckedIds((ids) => ids.filter((id) => id !== item.id));
      notify("Informația a fost ștearsă.");
    } catch (error) {
      console.error("DELETE INFORMATII UTILE:", error);
      notify(error.response?.data?.message || "Informația nu a putut fi ștearsă.", "error");
    } finally {
      deleteLock.current = false;
      setDeletingId(null);
    }
  };
  // Metadatele tuturor documentelor sunt necesare pentru filtre globale.
  // Maximum patru solicitări simultane; rezultatele sunt păstrate până la refresh.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const controller = new AbortController();
    const all = formatFilter !== "Toate" || attachmentFilter !== "all";
    const missing = (all ? informatii : visibleItems).filter(
      (item) => !Object.prototype.hasOwnProperty.call(attachmentMeta, item.id),
    );
    if (!missing.length) {
      setMetaLoading(false);
      return;
    }
    setMetaLoading(true);
    (async () => {
      const entries = {};
      for (let i = 0; i < missing.length && !cancelled; i += 4) {
        await Promise.all(
          missing.slice(i, i + 4).map(async (item) => {
            try {
              const response = await api.get(`/attachments/informatii_utile/${item.id}`, {
                signal: controller.signal,
              });
              const attachments = Array.isArray(response.data?.attachments)
                ? response.data.attachments
                : [];
              const formats = [
                ...new Set(
                  attachments.map((a) =>
                    a.attachment_type === "link" ? "LINK" : getInfoFormat(a),
                  ),
                ),
              ];
              entries[item.id] = {
                count: attachments.length,
                formats: formats.length ? formats : ["—"],
                format: formats.join(" / ") || "—",
              };
            } catch {
              if (!cancelled)
                entries[item.id] = { count: null, formats: [], format: "—", failed: true };
            }
          }),
        );
      }
      if (!cancelled) {
        setAttachmentMeta((old) => ({ ...old, ...entries }));
        if (Object.values(entries).some((x) => x.failed)) setMetaError(true);
        setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    loading,
    informatii.map((item) => item.id).join(","),
    visibleItems.map((item) => item.id).join(","),
    formatFilter,
    attachmentFilter,
  ]);
  useEffect(() => {
    if (page > totalPages && targetInfoId === null) setPage(totalPages);
  }, [page, totalPages, targetInfoId]);
  useEffect(() => {
    if (!viewer) return;
    const escape = (e) => {
      if (e.key === "Escape") setViewer(null);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [viewer]);
  const copyLink = async (item) => {
    try {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("open", item.id);
      await navigator.clipboard.writeText(url.href);
      toast.success("Linkul intern a fost copiat.");
    } catch {
      toast.error("Linkul nu a putut fi copiat.");
    }
  };
  const isImportant = (item) => item.is_favorite === true;
  const toggleFavorite = async (item) => {
    if (favoriteLocks.current.has(item.id) || deleteLock.current || loadLock.current) return;
    favoriteLocks.current.add(item.id);
    const next = !isImportant(item);
    setFavoriteBusy((ids) => [...ids, item.id]);
    try {
      if (next) await api.post(`/informatii-utile/${item.id}/favorite`);
      else await api.delete(`/informatii-utile/${item.id}/favorite`);
      setInformatii((items) =>
        items.map((entry) => (entry.id === item.id ? { ...entry, is_favorite: next } : entry)),
      );
      toast.success(next ? "Adăugat la importante." : "Eliminat din importante.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Nu s-a putut actualiza favoritul.");
    } finally {
      favoriteLocks.current.delete(item.id);
      setFavoriteBusy((ids) => ids.filter((id) => id !== item.id));
    }
  };
  const goPage = (next) => setPage(Math.max(1, Math.min(totalPages, next)));
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => totalPages <= 7 || n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1,
  );
  const pagination = (
    <nav className="info-pages" aria-label="Paginare">
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => goPage(1)}
        aria-label="Prima pagină"
      >
        <ChevronsLeft size={19} />
      </button>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => goPage(currentPage - 1)}
        aria-label="Pagina precedentă"
      >
        <ChevronLeft size={19} />
      </button>
      {pageNumbers.map((n, index) => (
        <span className="info-page-slot" key={n}>
          {index > 0 && n - pageNumbers[index - 1] > 1 && <span className="info-ellipsis">…</span>}
          <button
            type="button"
            className={currentPage === n ? "active" : ""}
            onClick={() => goPage(n)}
            aria-current={currentPage === n ? "page" : undefined}
          >
            {n}
          </button>
        </span>
      ))}
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => goPage(currentPage + 1)}
        aria-label="Pagina următoare"
      >
        <ChevronRight size={19} />
      </button>
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => goPage(totalPages)}
        aria-label="Ultima pagină"
      >
        <ChevronsRight size={19} />
      </button>
    </nav>
  );
  return (
    <main className="informatii-page informatii-modern">
      <header className="informatii-hero">
        <div className="informatii-hero-copy">
          <div className="informatii-eyebrow">
            <BookOpen size={21} /> CENTRU DE RESURSE
          </div>
          <h1>Informații utile</h1>
          <p className="informatii-description">
            Găsește rapid proceduri, ghiduri și informații necesare activității de serviciu.
          </p>
          {canEdit && (
            <button
              type="button"
              className="informatii-add-button"
              onClick={() => navigate("/informatii-utile/adauga")}
            >
              <Plus size={22} /> Adaugă informație
            </button>
          )}
        </div>
        <div className="informatii-hero-art" aria-hidden="true">
          <svg
            className="informatii-art-svg"
            viewBox="0 0 320 240"
            xmlns="http\://www.w3.org/2000/svg"
            focusable="false"
          >
            <defs>
              <radialGradient id="infoHeroGlow">
                <stop offset="0" stopColor="#c1ddff" stopOpacity=".95" />
                <stop offset=".62" stopColor="#deefff" stopOpacity=".7" />
                <stop offset="1" stopColor="#eaf5ff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="infoHeroPaper" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#fff" />
                <stop offset="1" stopColor="#f8fbff" />
              </linearGradient>
              <linearGradient id="infoHeroBlue" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#2d9bff" />
                <stop offset="1" stopColor="#0063ec" />
              </linearGradient>
              <filter id="infoHeroShadow" x="-45%" y="-45%" width="190%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="10"
                  stdDeviation="12"
                  floodColor="#72a8e7"
                  floodOpacity=".27"
                />
              </filter>
            </defs>
            <ellipse cx="168" cy="122" rx="151" ry="112" fill="url(#infoHeroGlow)" />
            <g transform="translate(82 54) rotate(-19 68 84)" filter="url(#infoHeroShadow)">
              <rect x="0" y="0" width="134" height="170" rx="12" fill="url(#infoHeroPaper)" />
              <path
                d="M22 48H102 M22 69H108 M22 90H95 M22 111H103"
                stroke="#c3defd"
                strokeWidth="9"
                strokeLinecap="round"
              />
            </g>
            <g transform="translate(126 22) rotate(10 74 94)" filter="url(#infoHeroShadow)">
              <path
                d="M12 0H105L148 43V176Q148 188 136 188H12Q0 188 0 176V12Q0 0 12 0Z"
                fill="url(#infoHeroPaper)"
              />
              <path
                d="M105 0V31Q105 43 117 43H148"
                fill="#eff7ff"
                stroke="#e5f1ff"
                strokeWidth="2"
              />
              <path
                d="M27 57H79 M27 83H116 M27 109H108 M27 135H83 M27 158H65"
                stroke="#a9d0ff"
                strokeWidth="9"
                strokeLinecap="round"
              />
            </g>
            <g filter="url(#infoHeroShadow)">
              <circle cx="246" cy="171" r="43" fill="url(#infoHeroBlue)" />
              <text
                x="246"
                y="200"
                fontFamily="Georgia, serif"
                fontStyle="italic"
                fontWeight="bold"
                fontSize="62"
                textAnchor="middle"
                fill="white"
              >
                i
              </text>
            </g>
          </svg>
        </div>
      </header>
      {message && (
        <div className={`informatii-message ${messageType}`} role="status">
          {messageType === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Închide mesajul">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="info-v2-summary">
        <button
          type="button"
          aria-pressed={!importantOnly}
          onClick={() => {
            setImportantOnly(false);
            setPage(1);
          }}
        >
          <BookOpen size={20} /> Toate <b>{informatii.length}</b>
        </button>
        <button
          type="button"
          aria-pressed={importantOnly}
          onClick={() => {
            setImportantOnly(true);
            setPage(1);
          }}
        >
          <Star size={20} /> Importante{" "}
          <b>{informatii.filter((i) => i.is_favorite === true).length}</b>
        </button>
      </div>
      <div className="info-v2-search">
        <Search size={21} />
        <input
          type="search"
          aria-label="Caută informații utile"
          placeholder="Caută după titlu, conținut, categorie sau autor..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Șterge căutarea"
            onClick={() => {
              setQuery("");
              setPage(1);
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
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
            ...["PDF", "DOCX", "XLSX", "ZIP", "IMG", "VIDEO", "LINK", "—"].map((name) => ({
              value: name,
              label: name === "—" ? "Nespecificat" : name,
            })),
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
            { value: "oldest", label: "Cele mai vechi" },
            { value: "az", label: "Titlu A–Z" },
            { value: "za", label: "Titlu Z–A" },
          ]}
          onChange={(value) => {
            setSort(value);
            setPage(1);
          }}
        />
      </section>
      <div className="info-v2-advanced">
        <label>
          De la data
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Până la data
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Atașamente
          <select
            value={attachmentFilter}
            onChange={(e) => {
              setAttachmentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Toate</option>
            <option value="with">Cu atașamente</option>
            <option value="without">Fără atașamente</option>
          </select>
        </label>
        <button type="button" onClick={resetFilters}>
          <X size={17} /> Resetează filtrele
        </button>
      </div>
      {metaLoading && (formatFilter !== "Toate" || attachmentFilter !== "all") && (
        <p role="status" className="info-v2-status">
          Se verifică formatele și atașamentele documentelor… Rezultatele sunt provizorii.
        </p>
      )}
      {metaError && (
        <p role="status" className="info-v2-status">
          Unele metadate nu au putut fi încărcate. Actualizează lista pentru a reîncerca.
        </p>
      )}
      <section className="informatii-data">
        <div className="informatii-results">
          <span>
            {loading
              ? "Se încarcă..."
              : `${filtered.length} ${filtered.length === 1 ? "rezultat" : "rezultate"}`}
          </span>
          <button
            type="button"
            disabled={loading || deletingId !== null || favoriteBusy.length > 0}
            onClick={() => loadInformatii(true)}
          >
            <RefreshCw size={19} /> Actualizează
          </button>
        </div>
        {checkedIds.length > 0 && (
          <div className="info-v2-selection">
            <span>{checkedIds.length} selectate</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  const links = checkedIds.map((id) => {
                    const url = new URL(window.location.href);
                    url.search = "";
                    url.hash = "";
                    url.searchParams.set("open", id);
                    return url.href;
                  });
                  await navigator.clipboard.writeText(links.join("\n"));
                  toast.success("Linkurile selectate au fost copiate.");
                } catch {
                  toast.error("Linkurile nu au putut fi copiate.");
                }
              }}
            >
              <Link2 size={17} /> Copiază linkurile
            </button>
            <button type="button" onClick={() => setCheckedIds([])}>
              Deselectează toate
            </button>
          </div>
        )}
        {loading ? (
          <div className="informatii-state">
            <div className="informatii-spinner" />
            <p>Se încarcă informațiile utile...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="informatii-state">
            <FolderOpen size={38} />
            <h3>
              {informatii.length ? "Nu am găsit rezultate" : "Nu există încă informații utile"}
            </h3>
            <p>
              {informatii.length
                ? "Modifică filtrele pentru a vedea alte rezultate."
                : "Materialele publicate vor apărea aici."}
            </p>
            <button type="button" onClick={resetFilters}>
              Resetează filtrele
            </button>
          </div>
        ) : (
          <>
            <div className="informatii-desktop-layout">
              <div className="informatii-table-scroll">
                <table className="informatii-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Selectează pagina"
                          checked={
                            visibleItems.length > 0 &&
                            visibleItems.every((item) => checkedIds.includes(item.id))
                          }
                          onChange={(e) =>
                            setCheckedIds((ids) =>
                              e.target.checked
                                ? [...new Set([...ids, ...visibleItems.map((i) => i.id)])]
                                : ids.filter((id) => !visibleItems.some((i) => i.id === id)),
                            )
                          }
                        />
                      </th>
                      <th>#</th>
                      <th>Document</th>
                      <th>Descriere</th>
                      <th>Categorie</th>
                      <th>Format</th>
                      <th>Data</th>
                      <th>Important</th>
                      <th>Fișiere</th>
                      <th>Adăugat de</th>
                      <th>Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item, index) => (
                      <tr
                        key={item.id}
                        data-info-document-id={String(item.id)}
                        style={
                          String(item.id) === highlightedInfoId
                            ? {
                                outline: "3px solid #2b70d7",
                                outlineOffset: "-3px",
                                backgroundColor: "#eef5ff",
                              }
                            : undefined
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Selectează ${item.title}`}
                            checked={checkedIds.includes(item.id)}
                            onChange={(e) =>
                              setCheckedIds((ids) =>
                                e.target.checked
                                  ? [...new Set([...ids, item.id])]
                                  : ids.filter((id) => id !== item.id),
                              )
                            }
                          />
                        </td>
                        <td>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td>
                          <button
                            type="button"
                            className="info-title-button"
                            disabled={openingCardId !== null}
                            onClick={() => openUsefulInfo(item)}
                          >
                            <span
                              className={`info-file-icon tone-${getCategoryTone(item.category)}`}
                            >
                              <FileText size={25} />
                            </span>
                            <strong>{item.title}</strong>
                          </button>
                        </td>
                        <td className="info-description-cell">
                          {item.content?.trim() || "Apasă pentru a deschide materialul atașat."}
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
                            className={`info-format-badge format-${(attachmentMeta[item.id]?.format || getInfoFormat(item)).toLowerCase()}`}
                          >
                            {attachmentMeta[item.id]?.format || getInfoFormat(item)}
                          </span>
                        </td>
                        <td>{formatDate(item.created_at) || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="info-favorite-button"
                            aria-label={
                              isImportant(item) ? "Elimină din importante" : "Adaugă la importante"
                            }
                            aria-pressed={isImportant(item)}
                            disabled={favoriteBusy.includes(item.id)}
                            onClick={() => toggleFavorite(item)}
                          >
                            <Star
                              size={22}
                              className={isImportant(item) ? "info-star active" : "info-star"}
                              fill={isImportant(item) ? "currentColor" : "none"}
                            />
                          </button>
                        </td>
                        <td>
                          <span className="info-attachment-count">
                            <Paperclip size={16} />
                            {attachmentMeta[item.id]?.count ?? "—"}
                          </span>
                        </td>
                        <td>{item.created_by_name || item.created_by_username || "—"}</td>
                        <td>
                          <div className="info-table-actions">
                            {canEdit && (
                              <button
                                type="button"
                                title="Editează"
                                onClick={() => navigate(`/informatii-utile/${item.id}/edit`)}
                              >
                                <Pencil size={19} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                title="Șterge"
                                className="danger"
                                disabled={deletingId !== null}
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 size={19} />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Copiază linkul intern"
                              aria-label="Copiază linkul intern"
                              onClick={() => copyLink(item)}
                            >
                              <Link2 size={19} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="informatii-mobile-list">
              {visibleItems.map((item) => (
                <article
                  className={`informatii-card ${
                    String(item.id) === highlightedInfoId ? "informatii-card--highlighted" : ""
                  }`}
                  key={item.id}
                  data-info-document-id={String(item.id)}
                >
                  <span className={`informatii-card-icon tone-${getCategoryTone(item.category)}`}>
                    <FileText size={30} />
                  </span>
                  <div className="informatii-card-content">
                    <span className={`info-table-badge tone-${getCategoryTone(item.category)}`}>
                      {item.category || "General"}
                    </span>
                    <button
                      type="button"
                      className="informatii-card-title"
                      disabled={openingCardId !== null}
                      onClick={() => openUsefulInfo(item)}
                    >
                      {item.title}
                    </button>
                    <p>{item.content?.trim() || "Apasă pentru a deschide materialul atașat."}</p>
                    <div className="informatii-card-meta">
                      <span>
                        <UserRound size={16} />
                        {item.created_by_name || item.created_by_username || "—"}
                      </span>
                      <span>
                        <CalendarDays size={16} />
                        {formatDate(item.created_at) || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="informatii-card-top-actions">
                    <button
                      type="button"
                      className="info-favorite-button"
                      aria-label={
                        isImportant(item) ? "Elimină din importante" : "Adaugă la importante"
                      }
                      aria-pressed={isImportant(item)}
                      disabled={favoriteBusy.includes(item.id)}
                      onClick={() => toggleFavorite(item)}
                    >
                      <Star
                        size={22}
                        className={isImportant(item) ? "info-star active" : "info-star"}
                        fill={isImportant(item) ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="Copiază linkul intern"
                      title="Copiază linkul intern"
                      onClick={() => copyLink(item)}
                    >
                      <Link2 size={21} />
                    </button>
                  </div>
                  <div className="informatii-card-footer">
                    <button
                      type="button"
                      className="informatii-file-link"
                      disabled={openingCardId !== null}
                      onClick={() => openUsefulInfo(item)}
                    >
                      <Paperclip size={20} />
                      {attachmentMeta[item.id]?.count == null
                        ? "Fișiere atașate"
                        : `${attachmentMeta[item.id].count} ${attachmentMeta[item.id].count === 1 ? "fișier atașat" : "fișiere atașate"}`}
                    </button>
                    <div className="informatii-actions">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => navigate(`/informatii-utile/${item.id}/edit`)}
                        >
                          <Pencil size={18} /> Editează
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="danger"
                          disabled={deletingId !== null}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 size={18} /> Șterge
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <footer className="info-pagination">
              <span className="info-pagination-summary">
                Afișate {(currentPage - 1) * pageSize + 1} –{" "}
                {Math.min(currentPage * pageSize, filtered.length)} din {filtered.length} rezultate
              </span>
              {pagination}
              <label className="info-pagination-size">
                Elemente pe pagină:{" "}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={3}>3</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </footer>
          </>
        )}
      </section>
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
        <div className="informatii-viewer-backdrop" onClick={() => setViewer(null)}>
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
              <button type="button" onClick={() => setViewer(null)} aria-label="Închide">
                <X size={20} />
              </button>
            </div>
            {viewer.attachments.length > 0 && viewer.item.content?.trim() && (
              <div className="informatii-viewer-text">{viewer.item.content}</div>
            )}
            {viewer.attachments.length ? (
              <div className="informatii-viewer-list">
                {viewer.attachments.map((attachment) => {
                  const isLink = attachment.attachment_type === "link";
                  const category = attachment.file_category;
                  return (
                    <div className="informatii-viewer-file-row" key={attachment.id}>
                      <button
                        type="button"
                        className="informatii-viewer-item"
                        disabled={openingId !== null}
                        onClick={() => openMaterial(attachment)}
                        title={isLink ? "Deschide linkul" : "Deschide fișierul"}
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
                          {attachment.original_name || attachment.name || "Material atașat"}
                        </span>
                        <ExternalLink size={17} />
                      </button>
                      {!isLink && (
                        <button
                          type="button"
                          className="informatii-viewer-download"
                          disabled={openingId !== null}
                          onClick={() => downloadMaterial(attachment)}
                          aria-label={`Descarcă ${attachment.original_name || attachment.name || "fișier"}`}
                          title="Descarcă fișierul"
                        >
                          <Download size={19} />
                          <span>Descarcă</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="informatii-viewer-text">
                {viewer.item.content?.trim() || "Nu există materiale atașate acestui card."}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
export default InformatiiUtile;
