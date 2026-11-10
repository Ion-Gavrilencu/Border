import {
  Megaphone,
  FileText,
  Scale,
  Info,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Files,
  ScrollText,
  Landmark,
  FolderOpen,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

const sections = [
  {
    key: "telegrame",
    title: "Telegrame",
    path: "/telegrame",
    icon: Megaphone,
    decoration: Files,
    color: "blue",
  },
  {
    key: "ordine",
    title: "Ordine interne",
    path: "/ordine",
    icon: FileText,
    decoration: ScrollText,
    color: "green",
  },
  {
    key: "legislatie",
    title: "Acte legislative",
    path: "/legislatie",
    icon: Scale,
    decoration: Landmark,
    color: "purple",
  },
  {
    key: "informatii_utile",
    title: "Informații utile",
    path: "/informatii-utile",
    icon: Info,
    decoration: FolderOpen,
    color: "orange",
  },
];

export default function DashboardStats({ stats = {}, loadingStats = false, trends = {} }) {
  const navigate = useNavigate();

  const counts = sections.map(({ key }) => {
    const value = Number(stats?.[key]);

    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });

  const maxCount = Math.max(...counts, 1);

  return (
    <div className="stats-grid" aria-label="Statistici documente">
      {sections.map((section, index) => {
        const Icon = section.icon;
        const Decoration = section.decoration;

        const count = counts[index];

        const rawTrend = trends?.[section.key];

        const trend = Number(rawTrend);

        const hasTrend =
          !loadingStats &&
          rawTrend !== null &&
          rawTrend !== undefined &&
          rawTrend !== "" &&
          Number.isFinite(trend);

        const progress = loadingStats ? 0 : (count / maxCount) * 100;

        return (
          <button
            key={section.key}
            type="button"
            className={`stat-card stat-card-clickable stat-card--${section.color}`}
            onClick={() => navigate(section.path)}
            aria-busy={loadingStats}
            aria-label={`${section.title}: ${
              loadingStats ? "se încarcă" : count.toLocaleString("ro-RO")
            } documente. Deschide secțiunea.`}
          >
            {/* Ilustrație decorativă */}
            <Decoration className="stat-watermark" aria-hidden="true" />

            {/* Procent de creștere/scădere */}
            {hasTrend && (
              <span
                className={`stat-trend ${trend < 0 ? "stat-trend--down" : ""}`}
                aria-label={`Variație ${trend > 0 ? "+" : ""}${trend}%`}
              >
                {trend < 0 ? (
                  <ArrowDownRight aria-hidden="true" />
                ) : (
                  <ArrowUpRight aria-hidden="true" />
                )}

                <span>
                  {trend > 0 ? "+" : ""}
                  {trend}%
                </span>
              </span>
            )}

            {/* Pictograma */}
            <span className="stat-icon" aria-hidden="true">
              <Icon />
            </span>

            {/* Număr și denumire */}
            <span className="stat-content">
              <strong className="stat-value">
                {loadingStats ? "…" : count.toLocaleString("ro-RO")}
              </strong>

              <span className="stat-title">{section.title}</span>
            </span>

            {/* Bară de progres */}
            <span className="stat-progress-track" aria-hidden="true">
              <span
                className="stat-progress"
                style={{
                  width: `${progress}%`,
                }}
              />
            </span>

            {/* Cerc alb cu săgeată */}
            <span className="stat-arrow-circle" aria-hidden="true">
              <ArrowRight className="stat-arrow" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
