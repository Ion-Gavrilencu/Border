import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Bell,
  Search,
  Check,
  ChevronDown,
  ClipboardCheck,
  Newspaper,
  Clock3,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  FileText,
  FileImage,
  Link as LinkIcon,
  X,
  File,
} from "lucide-react";

import Swal from "sweetalert2";
import { toast } from "sonner";
import api from "../../services/api";
import "./NotificationBell.css";

const REFRESH_INTERVAL = 60000;

const MODULES = {
  telegrama: {
    entityType: "telegrame",
    basePath: "/telegrame",
  },
  ordin: {
    entityType: "ordine",
    basePath: "/ordine",
  },
  legislatie: {
    entityType: "legislatie",
    basePath: "/legislatie",
  },
  informatii: {
    entityType: "informatii_utile",
    basePath: "/informatii-utile",
  },
  stire: {
    entityType: "news",
    basePath: "/stiri",
  },
};

const isSafeInternalPath = (value) =>
  typeof value === "string" &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\");

const getAttachmentIcon = (attachment) => {
  if (attachment.attachment_type === "link") {
    return <LinkIcon size={18} />;
  }

  if (attachment.file_category === "image" || attachment.mime_type?.startsWith("image/")) {
    return <FileImage size={18} />;
  }

  if (attachment.file_category === "pdf" || attachment.mime_type === "application/pdf") {
    return <FileText size={18} />;
  }

  return <File size={18} />;
};

function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const objectUrlsRef = useRef([]);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const requestId = useRef(0);
  const [panelRight, setPanelRight] = useState(16);
  const visibleNotifications = notifications;
  const dayGroup = (value) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "Anterior";
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    return date.toDateString() === today.toDateString()
      ? "Astăzi"
      : date.toDateString() === yesterday.toDateString()
        ? "Ieri"
        : "Anterior";
  };
  useEffect(() => {
    if (!open) return;
    const position = () =>
      setPanelRight(
        Math.max(
          12,
          window.innerWidth -
            (containerRef.current?.getBoundingClientRect().right ?? window.innerWidth),
        ),
      );
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [open]);

  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get("/notifications", {
          params: {
            page,
            limit: 15,
            status: filter,
            q: query.trim(),
            type: category === "all" ? "" : category,
          },
        });
        if (id !== requestId.current) return;
        if (!data.pagination) throw new Error("Serverul nu oferă paginare.");
        const last = Math.max(1, data.pagination.totalPages);
        if (page > last) {
          setPage(last);
          return;
        }
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setPagination(data.pagination);
        setUnreadCount(Number(data.unreadCount) || 0);
        setError("");
      } catch (err) {
        if (id !== requestId.current) return;
        console.error("GET NOTIFICATIONS ERROR:", err);
        setError("Notificările nu sunt disponibile momentan.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [page, filter, query, category],
  );

  useEffect(() => {
    setLoading(true);
    const debounce = window.setTimeout(() => loadNotifications(), 250);
    const refresh = () => {
      if (document.visibilityState === "visible" && !busy) loadNotifications({ silent: true });
    };
    const interval = window.setInterval(refresh, REFRESH_INTERVAL);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      ++requestId.current;
      window.clearTimeout(debounce);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadNotifications, busy]);

  useEffect(() => {
    setOpen(false);
    setShowAttachmentPicker(false);
    setSelectedAttachments([]);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (Swal.isVisible()) return;
      if (
        !containerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
        setShowAttachmentPicker(false);
      }
    };

    const onKeyDown = (event) => {
      if (Swal.isVisible()) return;
      if (event.key === "Escape") {
        setOpen(false);
        setShowAttachmentPicker(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Eliberăm URL-urile temporare când componenta este demontată.
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current = [];
    };
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );

    setUnreadCount((current) => Math.max(0, current - 1));
  };

  const markSingleRead = async (item) => {
    if (busy || item.is_read) return;
    setBusy(true);
    setError("");
    try {
      await markRead(item.id);
    } catch {
      setError("Notificarea nu a putut fi marcată ca citită.");
    } finally {
      setBusy(false);
    }
  };

  const manageNotification = async (action, item) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const deleting = action === "delete" || action === "delete-read";
      if (deleting) {
        const all = action === "delete-read";
        const result = await Swal.fire({
          icon: "warning",
          iconColor: "#dc4754",
          title: all ? "Ștergi notificările citite?" : "Ștergi notificarea?",
          text: all
            ? "Toate notificările citite vor fi eliminate definitiv. Cele necitite vor fi păstrate."
            : "Notificarea va fi eliminată definitiv. Această acțiune nu poate fi anulată.",
          showCancelButton: true,
          confirmButtonText: all ? "Da, șterge toate" : "Da, șterge",
          cancelButtonText: "Anulează",
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#52658c",
          reverseButtons: true,
          focusCancel: true,
          allowOutsideClick: false,
          width: "min(420px, 94vw)",
          backdrop: "rgba(12, 25, 52, 0.48)",
          customClass: { container: "border-notification-confirm" },
          didOpen: () => {
            const container = Swal.getContainer();
            if (container) container.style.zIndex = "2147483647";
          },
        });
        if (!result.isConfirmed) return;
      }
      if (action === "unread") await api.patch(`/notifications/${item.id}/unread`);
      if (action === "delete") await api.delete(`/notifications/${item.id}`);
      if (action === "delete-read") await api.delete("/notifications/read");
      if (action === "delete") toast.success("Notificarea a fost ștearsă.");
      if (action === "delete-read") toast.success("Notificările citite au fost șterse.");
    } catch (err) {
      setError(err?.response?.data?.message || "Operațiunea nu a reușit.");
    } finally {
      setBusy(false);
    }
  };

  // Deschide o filă nouă imediat, în urma clicului.
  // Astfel evităm blocarea popup-ului după cererile asincrone.
  const createDocumentTab = () => {
    const tab = window.open("about:blank", "_blank");

    if (tab) {
      try {
        tab.opener = null;
        tab.document.title = "Se încarcă documentul...";
        tab.document.body.textContent = "Se încarcă documentul. Te rugăm să aștepți...";
      } catch (err) {
        console.warn("TAB INITIALIZATION:", err);
      }
    }

    return tab;
  };

  const showTabError = (tab) => {
    if (!tab || tab.closed) return;

    try {
      tab.document.body.textContent = "Documentul nu a putut fi deschis.";
    } catch {
      tab.close();
    }
  };

  const openAttachment = async (attachment, existingTab = null) => {
    if (attachment.attachment_type === "link") {
      const url = new URL(attachment.url);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Linkul nu este permis.");
      }

      if (existingTab && !existingTab.closed) {
        existingTab.location.replace(url.href);
      } else {
        window.open(url.href, "_blank", "noopener,noreferrer");
      }

      return;
    }

    if (attachment.attachment_type !== "file") {
      throw new Error("Tip de atașament necunoscut.");
    }

    const { data } = await api.get(`/attachments/file/${attachment.id}`, { responseType: "blob" });

    const blobUrl = URL.createObjectURL(data);
    objectUrlsRef.current.push(blobUrl);

    if (existingTab && !existingTab.closed) {
      existingTab.location.replace(blobUrl);
    } else {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Afișează o știre internă într-o filă nouă, fără rută React suplimentară.
  const showInternalNews = (tab, article) => {
    if (!tab || tab.closed) {
      throw new Error("Browserul a blocat fila nouă.");
    }

    const doc = tab.document;
    doc.title = article.title || "Știre";
    doc.body.replaceChildren();
    doc.body.style.cssText =
      "margin:0;padding:32px 20px;background:#f5f6f8;color:#20252b;font:16px/1.65 system-ui,sans-serif";

    const main = doc.createElement("main");
    main.style.cssText =
      "max-width:820px;margin:auto;background:white;padding:32px;border-radius:12px;overflow-wrap:anywhere";

    const title = doc.createElement("h1");
    title.textContent = article.title || "Știre";
    title.style.cssText = "font-size:28px;line-height:1.25;margin:0 0 18px";
    main.appendChild(title);

    if (article.source) {
      const source = doc.createElement("p");
      source.textContent = `Sursa: ${article.source}`;
      source.style.color = "#657080";
      main.appendChild(source);
    }

    const content = doc.createElement("div");
    content.textContent = article.content || "Această știre nu are text disponibil.";
    content.style.whiteSpace = "pre-wrap";
    main.appendChild(content);

    const imageUrls = [
      article.image_url,
      ...(Array.isArray(article.images) ? article.images : []),
    ].filter((value, index, all) => value && all.indexOf(value) === index);

    imageUrls.forEach((value) => {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) return;
        const img = doc.createElement("img");
        img.src = url.href;
        img.alt = article.title || "Imagine știre";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.style.cssText =
          "display:block;width:100%;height:auto;margin-top:20px;border-radius:8px";
        main.appendChild(img);
      } catch {
        // Ignorăm URL-urile invalide.
      }
    });

    doc.body.appendChild(main);
  };

  const openNotificationContent = async (item, tab) => {
    if (item.type === "test") {
      if (tab && !tab.closed) tab.close();
      // Testele sunt pagini React, nu documente cu atașamente.
      const params = new URLSearchParams({ tab: "assigned" });
      if (isSafeInternalPath(item.link)) {
        const url = new URL(item.link, window.location.origin);
        if (
          url.origin === window.location.origin &&
          /^\/testare\/incercari\/[1-9]\d*\/rezultat$/.test(url.pathname)
        ) {
          navigate(url.pathname);
          return false;
        }
        if (url.origin === window.location.origin && url.pathname === "/testare") {
          for (const name of ["versiune", "atribuire"]) {
            const value = url.searchParams.get(name);
            if (/^[1-9]\d*$/.test(value || "")) params.set(name, value);
          }
        }
      }
      navigate(`/testare?${params.toString()}`);
      return false;
    }
    const config = MODULES[item.type];

    if (!config) {
      if (tab && !tab.closed) tab.close();
      return false;
    }

    const parts = isSafeInternalPath(item.link) ? item.link.split("/").filter(Boolean) : [];
    const entityId = parts[1];

    if (parts[0] !== config.basePath.slice(1) || !/^[1-9]\d*$/.test(entityId || "")) {
      if (tab && !tab.closed) tab.close();
      navigate(config.basePath);
      return false;
    }

    // Știrile se încarcă direct din /api/news/:id.
    // Ele nu trebuie tratate ca atașamente obișnuite.
    if (item.type === "stire") {
      const { data } = await api.get(`/news/${entityId}`);
      const article = data.article;
      if (!article) throw new Error("Știrea nu a fost găsită.");

      if (article.type === "external") {
        const url = new URL(article.url);
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Linkul știrii nu este valid.");
        }
        if (!tab || tab.closed) throw new Error("Fila nouă a fost blocată.");
        tab.location.replace(url.href);
      } else {
        showInternalNews(tab, article);
      }
      return false;
    }

    const { data } = await api.get(`/attachments/${config.entityType}/${entityId}`);
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];

    if (attachments.length === 0) {
      if (tab && !tab.closed) tab.close();
      // Nu toate modulele au pagină de detalii definită în App.jsx.
      // Navigăm la lista modulului, care există.
      navigate(config.basePath);
      return false;
    }

    if (attachments.length === 1) {
      await openAttachment(attachments[0], tab);
      return false;
    }

    if (tab && !tab.closed) tab.close();
    setSelectedAttachments(attachments);
    setShowAttachmentPicker(true);
    setOpen(true);
    return true;
  };

  const handleOpenNotification = async (item) => {
    if (busy) return;

    const tab = item.type === "test" ? null : createDocumentTab();
    setBusy(true);
    setError("");

    try {
      const needsPicker = await openNotificationContent(item, tab);
      if (!needsPicker) setOpen(false);

      if (!item.is_read) {
        try {
          await markRead(item.id);
        } catch (readError) {
          console.error("MARK NOTIFICATION READ ERROR:", readError);
          loadNotifications({ silent: true });
        }
      }
    } catch (err) {
      console.error("OPEN NOTIFICATION ERROR:", err);
      showTabError(tab);
      setError("Conținutul notificării nu a putut fi deschis.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectAttachment = async (attachment) => {
    if (busy) return;

    const tab = createDocumentTab();

    setBusy(true);
    setError("");

    try {
      await openAttachment(attachment, tab);

      setShowAttachmentPicker(false);
      setSelectedAttachments([]);
      setOpen(false);
    } catch (err) {
      console.error("OPEN ATTACHMENT ERROR:", err);
      showTabError(tab);

      setError("Fișierul selectat nu a putut fi deschis.");
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    if (busy || unreadCount === 0) return;

    setBusy(true);

    try {
      await api.patch("/notifications/read-all");

      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));

      setUnreadCount(0);
      setError("");
    } catch (err) {
      console.error("MARK ALL NOTIFICATIONS ERROR:", err);
      setError("Nu s-au putut marca notificările ca citite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="icon-button notification-bell-trigger"
        aria-label={unreadCount > 0 ? `Notificări: ${unreadCount} necitite` : "Notificări"}
        aria-expanded={open}
        aria-haspopup="true"
        title="Notificări"
        onClick={() => {
          setOpen((current) => !current);

          if (!open) {
            loadNotifications({ silent: true });
          }
        }}
      >
        <Bell size={21} />

        {unreadCount > 0 && (
          <span className="notification-bell-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <section
            ref={panelRef}
            className="notification-panel"
            style={{ "--notification-right": `${panelRight}px` }}
            aria-label="Lista notificărilor"
          >
            <div className="notification-panel-header">
              <div className="notification-panel-heading">
                <strong>{showAttachmentPicker ? "Alege documentul" : "Notificări"}</strong>
                <span className="notification-panel-subtitle">
                  {showAttachmentPicker
                    ? `${selectedAttachments.length} documente disponibile`
                    : unreadCount > 0
                      ? `${unreadCount} ${unreadCount === 1 ? "notificare necitită" : "notificări necitite"}`
                      : "Ești la curent cu toate notificările"}
                </span>
              </div>

              <div className="notification-panel-actions">
                {showAttachmentPicker ? (
                  <button
                    type="button"
                    className="notification-text-button"
                    onClick={() => {
                      setShowAttachmentPicker(false);
                      setSelectedAttachments([]);
                    }}
                  >
                    <X size={16} />
                    Înapoi
                  </button>
                ) : (
                  <button
                    type="button"
                    className="notification-text-button"
                    onClick={markAllRead}
                    disabled={busy || unreadCount === 0}
                  >
                    <CheckCheck size={16} />
                    Toate citite
                  </button>
                )}
                <button
                  type="button"
                  className="notification-close-button"
                  aria-label="Închide notificările"
                  title="Închide"
                  onClick={() => {
                    setOpen(false);
                    setShowAttachmentPicker(false);
                  }}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {!showAttachmentPicker && (
              <div className="notification-toolbar">
                <div className="notification-tabs" role="group" aria-label="Starea notificărilor">
                  <button
                    type="button"
                    aria-pressed={filter === "all"}
                    onClick={() => {
                      setPage(1);
                      setFilter("all");
                    }}
                  >
                    Toate
                  </button>
                  <button
                    type="button"
                    aria-pressed={filter === "unread"}
                    onClick={() => {
                      setPage(1);
                      setFilter("unread");
                    }}
                  >
                    Necitite <span>{unreadCount}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={filter === "read"}
                    onClick={() => {
                      setPage(1);
                      setFilter("read");
                    }}
                  >
                    Citite
                  </button>
                </div>
                <div className="notification-search-row">
                  <label className="notification-search">
                    <Search size={16} />
                    <input
                      aria-label="Caută în toate notificările"
                      placeholder="Caută notificări..."
                      value={query}
                      maxLength={120}
                      onChange={(e) => {
                        setPage(1);
                        setQuery(e.target.value);
                      }}
                    />
                    {query && (
                      <button
                        type="button"
                        aria-label="Șterge căutarea"
                        onClick={() => {
                          setPage(1);
                          setQuery("");
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                  <select
                    aria-label="Categorie"
                    value={category}
                    onChange={(e) => {
                      setPage(1);
                      setCategory(e.target.value);
                    }}
                  >
                    <option value="all">Categorii</option>
                    <option value="test">Teste</option>
                    <option value="documents">Documente</option>
                    <option value="stire">Noutăți</option>
                  </select>
                </div>
              </div>
            )}
            {error && (
              <p className="notification-error" role="alert">
                {error}
              </p>
            )}

            {showAttachmentPicker ? (
              <div className="notification-attachment-list">
                {selectedAttachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className="notification-attachment-item"
                    disabled={busy}
                    onClick={() => handleSelectAttachment(attachment)}
                  >
                    {getAttachmentIcon(attachment)}

                    <span className="notification-attachment-name">{attachment.name}</span>

                    <ExternalLink size={15} />
                  </button>
                ))}
              </div>
            ) : loading ? (
              <p className="notification-empty">Se încarcă notificările...</p>
            ) : visibleNotifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={26} />
                <p>
                  {notifications.length
                    ? "Nicio notificare pentru filtrele selectate."
                    : "Nu există notificări."}
                </p>
              </div>
            ) : (
              <div className="notification-list">
                {visibleNotifications.map((item, index) => (
                  <div key={item.id}>
                    {(index === 0 ||
                      dayGroup(item.created_at) !==
                        dayGroup(visibleNotifications[index - 1].created_at)) && (
                      <div className="notification-day">{dayGroup(item.created_at)}</div>
                    )}
                    <div
                      className={`notification-card ${item.is_read ? "" : "notification-card--unread"}`}
                    >
                      <button
                        type="button"
                        key={item.id}
                        className={`notification-item ${item.is_read ? "" : "notification-item--unread"}`}
                        onClick={() => handleOpenNotification(item)}
                        disabled={busy}
                      >
                        <span
                          className={`notification-item-icon ${item.type === "test" ? "notification-item-icon--test" : item.type === "stire" ? "notification-item-icon--news" : "notification-item-icon--document"}`}
                          aria-hidden="true"
                        >
                          {item.type === "test" ? (
                            <ClipboardCheck size={17} />
                          ) : item.type === "stire" ? (
                            <Newspaper size={17} />
                          ) : (
                            <FileText size={17} />
                          )}
                        </span>
                        <span className="notification-item-content">
                          <span className="notification-item-heading">
                            <span className="notification-item-title">{item.title}</span>
                            {!item.is_read && (
                              <span className="notification-unread-dot" aria-label="Necitită" />
                            )}
                          </span>
                          {item.message && (
                            <span
                              className={`notification-item-message ${expanded[item.id] ? "is-expanded" : ""}`}
                            >
                              {item.message}
                            </span>
                          )}
                          {item.type === "test" && (
                            <span style={{ color: "#1666b1", fontSize: 12, fontWeight: 700 }}>
                              {typeof item.link === "string" &&
                              /^\/testare\/incercari\/[1-9]\d*\/rezultat$/.test(item.link)
                                ? "Vezi rezultatul →"
                                : "Accesează testul →"}
                            </span>
                          )}
                          <time
                            className="notification-item-time"
                            dateTime={item.created_at || undefined}
                          >
                            <Clock3 size={12} aria-hidden="true" />
                            {item.created_at
                              ? new Date(item.created_at).toLocaleString("ro-RO", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : ""}
                          </time>
                        </span>
                      </button>
                      <div className="notification-card-actions">
                        {item.message && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((old) => ({ ...old, [item.id]: !old[item.id] }))
                            }
                            aria-expanded={!!expanded[item.id]}
                          >
                            <ChevronDown size={14} />{" "}
                            {expanded[item.id] ? "Restrânge" : "Mesaj complet"}
                          </button>
                        )}
                        {!item.is_read && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => markSingleRead(item)}
                          >
                            <Check size={14} /> Marchează citită
                          </button>
                        )}
                        {item.is_read && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => manageNotification("unread", item)}
                          >
                            Marchează necitită
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => manageNotification("delete", item)}
                        >
                          Șterge
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div
                  className="notification-card-actions"
                  style={{ flexWrap: "wrap", justifyContent: "center" }}
                >
                  <button
                    type="button"
                    disabled={busy || loading || page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterioară
                  </button>
                  <span>
                    Pagina {page} / {Math.max(1, pagination?.totalPages || 1)}
                  </span>
                  <button
                    type="button"
                    disabled={busy || loading || !pagination?.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Următoarea
                  </button>
                </div>
              </div>
            )}

            {!showAttachmentPicker && (
              <div className="notification-card-actions">
                <button
                  type="button"
                  disabled={busy || loading}
                  onClick={() => manageNotification("delete-read")}
                >
                  Șterge notificările citite
                </button>
              </div>
            )}
            <div className="notification-panel-footer">
              <span className="notification-footer-label">
                {showAttachmentPicker
                  ? "Selectează un document"
                  : `${pagination?.total ?? 0} notificări găsite`}
              </span>
              <button
                type="button"
                className="notification-text-button notification-footer-refresh"
                onClick={() => loadNotifications()}
                disabled={loading || busy}
              >
                <RefreshCw size={15} />
                Actualizează
              </button>
            </div>
          </section>,
          document.body,
        )}
    </div>
  );
}

export default NotificationBell;
