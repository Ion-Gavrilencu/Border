import { Megaphone, FileText, Scale, Info, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const recentTypes = {
  telegrama: {
    label: "Telegramă nouă",
    path: "/telegrame",
    icon: Megaphone,
    className: "telegram",
  },
  ordin: {
    label: "Ordin intern",
    path: "/ordine",
    icon: FileText,
    className: "order",
  },
  legislatie: {
    label: "Act legislativ",
    path: "/legislatie",
    icon: Scale,
    className: "law",
  },
  informatii: {
    label: "Informație utilă",
    path: "/informatii-utile",
    icon: Info,
    className: "info",
  },
};

const MAX_RECENT_ITEMS = 4;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ro-RO");
};

function RecentInformation({ recent = [], loadingStats }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const visibleRecent = useMemo(() => {
    if (!Array.isArray(recent)) return [];
    return recent.filter((item) => item && item.id != null && recentTypes[item.type]);
  }, [recent]);

  const displayedRecent = showAll ? visibleRecent : visibleRecent.slice(0, MAX_RECENT_ITEMS);

  const openInformation = (item, config) => {
    navigate(config.path, {
      state: {
        openDocumentId: item.id,
        openDocumentType: item.type,
      },
    });
  };

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

      {visibleRecent.length > MAX_RECENT_ITEMS && (
        <button
          type="button"
          className="border-news-show-all"
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Afișează mai puține" : `Vezi toate informațiile (${visibleRecent.length})`}
          <ArrowRight size={17} />
        </button>
      )}
    </section>
  );
}

export default RecentInformation;
