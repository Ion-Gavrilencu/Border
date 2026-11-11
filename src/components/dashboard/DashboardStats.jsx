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
  Sparkles,
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
    title: "Acte normative",
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

export default function DashboardStats({
  stats = {},
  loadingStats = false,
  trends = {},
  trendStatus = {},
}) {
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

        const status = trendStatus?.[section.key] ?? "unavailable";

        const isNew = !loadingStats && !hasTrend && status === "new";

        const progress = loadingStats ? 0 : (count / maxCount) * 100;

        let trendLabel = "Fără date comparative";

        if (hasTrend) {
          trendLabel = `Variație ${trend > 0 ? "+" : ""}${trend}%`;
        } else if (isNew) {
          trendLabel = "Documente noi, fără bază de comparație";
        } else if (status === "no_activity") {
          trendLabel = "Fără documente în ultimele două perioade";
        }

        return (
          <button
            key={section.key}
            type="button"
            className={`stat-card stat-card-clickable stat-card--${section.color}`}
            onClick={() => navigate(section.path)}
            aria-busy={loadingStats}
            aria-label={`${section.title}: ${
              loadingStats ? "se încarcă" : count.toLocaleString("ro-RO")
            } documente. ${trendLabel}. Deschide secțiunea.`}
          >
            {/* ILUSTRAȚIE DECORATIVĂ */}
            <Decoration className="stat-watermark" aria-hidden="true" />

            {/* INDICATOR STATISTIC */}
            {!loadingStats && (
              <span
                className={`stat-trend ${hasTrend && trend < 0 ? "stat-trend--down" : ""} ${
                  isNew ? "stat-trend--new" : ""
                }`}
                aria-hidden="true"
              >
                {hasTrend ? (
                  <>
                    {trend < 0 ? <ArrowDownRight /> : <ArrowUpRight />}

                    <span>
                      {trend > 0 ? "+" : ""}
                      {trend}%
                    </span>
                  </>
                ) : isNew ? (
                  <>
                    <Sparkles />
                    <span>Nou</span>
                  </>
                ) : (
                  <span>—</span>
                )}
              </span>
            )}

            {/* PICTOGRAMĂ */}
            <span className="stat-icon" aria-hidden="true">
              <Icon />
            </span>

            {/* NUMĂR ȘI DENUMIRE */}
            <span className="stat-content">
              <strong className="stat-value">
                {loadingStats ? "…" : count.toLocaleString("ro-RO")}
              </strong>

              <span className="stat-title">{section.title}</span>
            </span>

            {/* BARĂ PROGRES */}
            <span className="stat-progress-track" aria-hidden="true">
              <span
                className="stat-progress"
                style={{
                  width: `${progress}%`,
                }}
              />
            </span>

            {/* SĂGEATĂ DE NAVIGARE */}
            <span className="stat-arrow-circle" aria-hidden="true">
              <ArrowRight className="stat-arrow" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
