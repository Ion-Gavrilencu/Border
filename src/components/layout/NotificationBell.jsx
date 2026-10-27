
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  FileText,
  FileImage,
  Link as LinkIcon,
  X,
  File,
} from "lucide-react";

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

  if (
    attachment.file_category === "image" ||
    attachment.mime_type?.startsWith("image/")
  ) {
    return <FileImage size={18} />;
  }

  if (
    attachment.file_category === "pdf" ||
    attachment.mime_type === "application/pdf"
  ) {
    return <FileText size={18} />;
  }

  return <File size={18} />;
};

function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const objectUrlsRef = useRef([]);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);

      try {
        const { data } = await api.get("/notifications");

        const items = Array.isArray(data.notifications)
          ? data.notifications
          : [];

        setNotifications(items);
        setUnreadCount(Number(data.unreadCount) || 0);
        setError("");
      } catch (err) {
        console.error("GET NOTIFICATIONS ERROR:", err);
        setError("Notificările nu sunt disponibile momentan.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadNotifications({ silent: true });
      }
    }, REFRESH_INTERVAL);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadNotifications({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, [loadNotifications]);

  useEffect(() => {
    setOpen(false);
    setShowAttachmentPicker(false);
    setSelectedAttachments([]);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setShowAttachmentPicker(false);
      }
    };

    const onKeyDown = (event) => {
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
      current.map((item) =>
        item.id === id ? { ...item, is_read: true } : item
      )
    );

    setUnreadCount((current) => Math.max(0, current - 1));
  };

  // Deschide o filă nouă imediat, în urma clicului.
  // Astfel evităm blocarea popup-ului după cererile asincrone.
  const createDocumentTab = () => {
    const tab = window.open("about:blank", "_blank");

    if (tab) {
      try {
        tab.opener = null;
        tab.document.title = "Se încarcă documentul...";
        tab.document.body.textContent =
          "Se încarcă documentul. Te rugăm să aștepți...";
      } catch (err) {
        console.warn("TAB INITIALIZATION:", err);
      }
    }

    return tab;
  };

  const showTabError = (tab) => {
    if (!tab || tab.closed) return;

    try {
      tab.document.body.textContent =
        "Documentul nu a putut fi deschis.";
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

    const { data } = await api.get(
      `/attachments/file/${attachment.id}`,
      { responseType: "blob" }
    );

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
    const config = MODULES[item.type];

    if (!config) {
      if (tab && !tab.closed) tab.close();
      return false;
    }

    const parts = isSafeInternalPath(item.link)
      ? item.link.split("/").filter(Boolean)
      : [];
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

    const { data } = await api.get(
      `/attachments/${config.entityType}/${entityId}`
    );
    const attachments = Array.isArray(data.attachments)
      ? data.attachments
      : [];

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

    const tab = createDocumentTab();
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

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );

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
        aria-label={
          unreadCount > 0
            ? `Notificări: ${unreadCount} necitite`
            : "Notificări"
        }
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
          <span className="notification-bell-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="notification-panel"
          aria-label="Lista notificărilor"
        >
          <div className="notification-panel-header">
            <strong>
              {showAttachmentPicker
                ? "Alege documentul"
                : "Notificări"}
            </strong>

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
          </div>

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
                  onClick={() =>
                    handleSelectAttachment(attachment)
                  }
                >
                  {getAttachmentIcon(attachment)}

                  <span className="notification-attachment-name">
                    {attachment.name}
                  </span>

                  <ExternalLink size={15} />
                </button>
              ))}
            </div>
          ) : loading ? (
            <p className="notification-empty">
              Se încarcă notificările...
            </p>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <Bell size={26} />
              <p>Nu există notificări.</p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${
                    item.is_read
                      ? ""
                      : "notification-item--unread"
                  }`}
                  onClick={() => handleOpenNotification(item)}
                  disabled={busy}
                >
                  <span className="notification-item-title">
                    {item.title}
                  </span>

                  {item.message && (
                    <span className="notification-item-message">
                      {item.message}
                    </span>
                  )}

                  <time
                    className="notification-item-time"
                    dateTime={item.created_at || undefined}
                  >
                    {item.created_at
                      ? new Date(
                          item.created_at
                        ).toLocaleString("ro-RO")
                      : ""}
                  </time>
                </button>
              ))}
            </div>
          )}

          <div className="notification-panel-footer">
            <button
              type="button"
              className="notification-text-button"
              onClick={() => loadNotifications()}
              disabled={loading || busy}
            >
              <RefreshCw size={15} />
              Actualizează
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default NotificationBell;
