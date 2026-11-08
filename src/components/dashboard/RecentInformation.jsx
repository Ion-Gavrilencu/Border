import { Megaphone, FileText, Scale, Info, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const recentTypes = {
  telegrama: {
    label: "Telegramă nouă",
    path: "/telegrame",
    icon: Megaphone,
    className: "telegram",
  },
  ordin: { label: "Ordin intern", path: "/ordine", icon: FileText, className: "order" },
  legislatie: { label: "Act legislativ", path: "/legislatie", icon: Scale, className: "law" },
  informatii: {
    label: "Informație utilă",
    path: "/informatii-utile",
    icon: Info,
    className: "info",
  },
};

const MAX_RECENT_ITEMS = 4;
const PAGE_SIZE = 20;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ro-RO");
};

const validItems = (items) =>
  (Array.isArray(items) ? items : []).filter(
    (item) => item && item.id != null && recentTypes[item.type],
  );

function RecentInformation({ recent = [], loadingStats }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [additional, setAdditional] = useState([]);
  const [nextOffset, setNextOffset] = useState(MAX_RECENT_ITEMS);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const requestVersion = useRef(0);
  const pending = useRef(false);

  // Orice reîmprospătare a statisticilor invalidează paginile vechi.
  useEffect(() => {
    requestVersion.current += 1;
    pending.current = false;
    setAdditional([]);
    setNextOffset(MAX_RECENT_ITEMS);
    setHasMore(true);
    setLoadingMore(false);
    setLoadError("");
    setShowAll(false);
  }, [recent]);

  useEffect(
    () => () => {
      requestVersion.current += 1;
    },
    [],
  );

  const visibleRecent = useMemo(() => {
    const combined = [...validItems(recent), ...validItems(additional)];
    const seen = new Set();
    return combined.filter((item) => {
      const key = `${item.type}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recent, additional]);

  const loadMore = async (offset) => {
    if (pending.current) return;
    pending.current = true;
    const version = requestVersion.current;
    setLoadingMore(true);
    setLoadError("");
    try {
      const response = await api.get("/dashboard/recent", { params: { offset } });
      if (version !== requestVersion.current) return;
      const rows = response.data?.recent;
      if (
        !Array.isArray(rows) ||
        typeof response.data?.hasMore !== "boolean" ||
        !Number.isSafeInteger(response.data?.nextOffset) ||
        response.data.nextOffset !== offset + rows.length ||
        rows.length > PAGE_SIZE
      ) {
        throw new Error("Răspuns invalid de la server.");
      }
      setAdditional((current) => (offset === MAX_RECENT_ITEMS ? rows : [...current, ...rows]));
      setNextOffset(response.data.nextOffset);
      setHasMore(response.data.hasMore);
    } catch (error) {
      if (version !== requestVersion.current) return;
      setLoadError(
        error.response?.data?.message || "Informațiile nu au putut fi încărcate. Încearcă din nou.",
      );
    } finally {
      if (version === requestVersion.current) {
        pending.current = false;
        setLoadingMore(false);
      }
    }
  };

  const handleExpand = () => {
    if (showAll) {
      setShowAll(false);
      return;
    }
    setShowAll(true);
    if (additional.length === 0 && hasMore) void loadMore(MAX_RECENT_ITEMS);
  };

  const openInformation = (item, config) => {
    navigate(config.path, {
      state: { openDocumentId: item.id, openDocumentType: item.type },
    });
  };

  const displayedRecent = showAll ? visibleRecent : visibleRecent.slice(0, MAX_RECENT_ITEMS);

  return (
    <section className="dashboard-card">
      <div className="card-header">
        <div>
          <h2>Ultimele informații</h2>
          <p>Documente adăugate recent</p>
        </div>
      </div>

      <div className="information-list">
        {loadingStats ? (
          <p className="dashboard-empty">Se încarcă informațiile...</p>
        ) : visibleRecent.length === 0 ? (
          <p className="dashboard-empty">Nu există documente recente.</p>
        ) : (
          displayedRecent.map((item) => {
            const config = recentTypes[item.type];
            const Icon = config.icon;
            return (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                className="information-item information-item-button"
                onClick={() => openInformation(item, config)}
              >
                <div className={`item-icon ${config.className}`}>
                  <Icon size={19} />
                </div>
                <div className="information-content">
                  <strong>{config.label}</strong>
                  <p>{item.title}</p>
                  <small>{formatDate(item.created_at)}</small>
                </div>
                <ArrowRight size={17} className="information-arrow" />
              </button>
            );
          })
        )}
      </div>

      {showAll && loadError && (
        <p className="dashboard-empty" role="alert">
          {loadError}
        </p>
      )}
      {showAll && loadingMore && (
        <p className="dashboard-empty" role="status">
          Se încarcă informațiile...
        </p>
      )}

      {visibleRecent.length > 0 && (visibleRecent.length >= MAX_RECENT_ITEMS || showAll) && (
        <>
          {showAll && hasMore && !loadingMore && (
            <button
              type="button"
              className="border-news-show-all"
              onClick={() => loadMore(nextOffset)}
            >
              Încarcă încă 20 de informații <ArrowRight size={17} />
            </button>
          )}
          <button
            type="button"
            className="border-news-show-all"
            aria-expanded={showAll}
            onClick={handleExpand}
          >
            {showAll ? "Afișează mai puține" : "Vezi toate informațiile"}
            <ArrowRight size={17} />
          </button>
        </>
      )}
    </section>
  );
}

export default RecentInformation;
