
import {
  Megaphone,
  FileText,
  Scale,
  Info,
  ArrowRight,
} from "lucide-react";

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

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("ro-RO");
};

function RecentInformation({
  recent = [],
  loadingStats,
}) {
  const navigate = useNavigate();

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
          <p className="dashboard-empty">
            Se încarcă informațiile...
          </p>
        ) : recent.length === 0 ? (
          <p className="dashboard-empty">
            Nu există documente recente.
          </p>
        ) : (
          recent.map((item) => {
            const config = recentTypes[item.type];

            if (!config) return null;

            const Icon = config.icon;

            return (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                className="information-item information-item-button"
                onClick={() =>
                  navigate(`${config.path}/${item.id}`)
                }
              >
                <div
                  className={`item-icon ${config.className}`}
                >
                  <Icon size={19} />
                </div>

                <div className="information-content">
                  <strong>{config.label}</strong>
                  <p>{item.title}</p>
                  <small>
                    {formatDate(item.created_at)}
                  </small>
                </div>

                <ArrowRight
                  size={17}
                  className="information-arrow"
                />
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        className="border-news-show-all"
        onClick={() => navigate("/informatii-utile")}
      >
        Vezi toate informațiile
        <ArrowRight size={17} />
      </button>
    </section>
  );
}

export default RecentInformation;
