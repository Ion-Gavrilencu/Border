
import { Megaphone, FileText, Scale, Info, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const sections = [
  {
    key: "telegrame",
    title: "Telegrame",
    path: "/telegrame",
    icon: Megaphone,
  },
  {
    key: "ordine",
    title: "Ordine interne",
    path: "/ordine",
    icon: FileText,
  },
  {
    key: "legislatie",
    title: "Acte legislative",
    path: "/legislatie",
    icon: Scale,
  },
  {
    key: "informatii_utile",
    title: "Informații utile",
    path: "/informatii-utile",
    icon: Info,
  },
];

function DashboardStats({ stats, loadingStats }) {
  const navigate = useNavigate();

  return (
    <div className="stats-grid">
      {sections.map((section) => {
        const Icon = section.icon;

        return (
          <button
            key={section.key}
            type="button"
            className="stat-card stat-card-clickable"
            onClick={() => navigate(section.path)}
          >
            <div className="stat-icon">
              <Icon size={24} />
            </div>

            <div className="stat-content">
              <span>{section.title}</span>

              <strong>
                {loadingStats
                  ? "..."
                  : stats?.[section.key] ?? 0}
              </strong>
            </div>

            <ArrowRight
              size={17}
              className="stat-arrow"
            />
          </button>
        );
      })}
    </div>
  );
}

export default DashboardStats;
