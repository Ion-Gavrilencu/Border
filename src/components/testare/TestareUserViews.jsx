import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  Filter,
  Hourglass,
  Layers3,
  ListChecks,
  Play,
  Search,
  Trophy,
  XCircle,
} from "lucide-react";

import "./TestareUserViews.css";

const FINISHED_STATUSES = new Set(["SUBMITTED", "EXPIRED", "FINISHED", "COMPLETED"]);

const PROGRESS_STATUSES = new Set(["IN_PROGRESS", "STARTED"]);

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const dateLabel = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTitle = (item) => item?.title ?? item?.test_title ?? item?.name ?? "Test profesional";

const getStatus = (item) => String(item?.attempt_status ?? item?.status ?? "").toUpperCase();

const passOf = (item) => {
  if (typeof item?.passed === "boolean") {
    return item.passed;
  }

  if (typeof item?.is_passed === "boolean") {
    return item.is_passed;
  }

  const result = String(item?.result ?? "").toUpperCase();

  if (result === "PASSED") return true;
  if (result === "FAILED") return false;

  return null;
};

const scoreOf = (item) => numberOrNull(item?.grade);

const dateOf = (item) =>
  item?.submitted_at ?? item?.finished_at ?? item?.completed_at ?? item?.ended_at ?? null;

const questionCountOf = (item) =>
  numberOrNull(
    item?.question_count ?? item?.questions_count ?? item?.total_questions ?? item?.questions_total,
  );

const durationOf = (item) => numberOrNull(item?.duration_minutes);

const completedResult = (item) => {
  const status = getStatus(item);

  return FINISHED_STATUSES.has(status);
};

const formatQuestions = (count) => `${count} ${count === 1 ? "întrebare" : "întrebări"}`;

export default function TestareUserViews({
  mode,
  assigned = [],
  results = [],
  startingId,
  onStart,
  onOpenResult,
  versionIdOf,
  finishedForVersion,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const isResults = mode === "results";

  const assignedItems = Array.isArray(assigned) ? assigned : [];
  const resultItems = Array.isArray(results) ? results : [];

  const completed = useMemo(() => resultItems.filter(completedResult), [results]);

  const decorated = useMemo(() => {
    return assignedItems.map((item) => {
      const versionId =
        typeof versionIdOf === "function" ? versionIdOf(item) : (item?.version_id ?? null);

      const finishedAttempts =
        typeof finishedForVersion === "function" ? finishedForVersion(versionId) : [];

      const done = Array.isArray(finishedAttempts) ? finishedAttempts : [];

      const maxAttempts = numberOrNull(item?.max_attempts ?? item?.allowed_attempts);

      const exhausted = maxAttempts !== null && maxAttempts > 0 && done.length >= maxAttempts;

      const progress = String(item?.progress_status ?? item?.assignment_status ?? "").toUpperCase();

      const state = exhausted
        ? "finished"
        : PROGRESS_STATUSES.has(progress)
          ? "progress"
          : "pending";

      return {
        item,
        versionId,
        done,
        exhausted,
        state,
      };
    });
  }, [assigned, results, versionIdOf, finishedForVersion]);

  const resultRows = useMemo(() => {
    return completed.map((item) => {
      const passed = passOf(item);

      return {
        item,
        state: passed === true ? "passed" : passed === false ? "failed" : "unknown",
      };
    });
  }, [completed]);

  const rows = useMemo(() => {
    const source = isResults ? resultRows : decorated;
    const normalizedQuery = query.trim().toLocaleLowerCase("ro");

    return source.filter(({ item, state }) => {
      const title = String(getTitle(item)).toLocaleLowerCase("ro");

      const matchesSearch = title.includes(normalizedQuery);
      const matchesFilter = filter === "all" || filter === state;

      return matchesSearch && matchesFilter;
    });
  }, [isResults, resultRows, decorated, query, filter]);

  const knownResults = completed.filter((item) => passOf(item) !== null);

  const grades = completed.map(scoreOf).filter((value) => value !== null);

  const durations = completed
    .map((item) => numberOrNull(item?.elapsed_minutes ?? item?.time_spent_minutes))
    .filter((value) => value !== null && value >= 0);

  const stats = isResults
    ? [
        {
          icon: ClipboardList,
          value: completed.length,
          label: "Teste finalizate",
          tone: "violet",
        },
        {
          icon: Trophy,
          value: grades.length
            ? (grades.reduce((sum, value) => sum + value, 0) / grades.length).toFixed(2)
            : "—",
          label: "Punctaj mediu",
          tone: "purple",
        },
        {
          icon: BarChart3,
          value: knownResults.length
            ? `${Math.round(
                (knownResults.filter((item) => passOf(item) === true).length /
                  knownResults.length) *
                  100,
              )}%`
            : "—",
          label: "Rată de promovare",
          tone: "blue",
        },
        {
          icon: Clock3,
          value: durations.length
            ? `${Math.round(
                durations.reduce((sum, value) => sum + value, 0) / durations.length,
              )} min`
            : "—",
          label: "Timp mediu/test",
          tone: "purple",
        },
      ]
    : [
        {
          icon: ClipboardList,
          value: decorated.length,
          label: "Teste atribuite",
          tone: "violet",
        },
        {
          icon: Play,
          value: decorated.filter((item) => item.state === "progress").length,
          label: "În desfășurare",
          tone: "blue",
        },
        {
          icon: CheckCircle2,
          value: decorated.filter((item) => item.state === "finished").length,
          label: "Finalizate",
          tone: "green",
        },
      ];

  return (
    <div className="ptuv">
      {!isResults && (
        <div className="ptuv-hero">
          <span className="ptuv-hero-icon">
            <ClipboardList size={34} />
          </span>

          <div>
            <h2>Testele mele</h2>
            <p>Aici găsești toate testele care ți-au fost atribuite.</p>
          </div>

          <div className="ptuv-hero-stats">
            {stats.map(({ icon: Icon, value, label, tone }) => (
              <div className="ptuv-hero-stat" key={label}>
                <span className={`ptuv-small-icon ${tone}`}>
                  <Icon size={22} />
                </span>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {isResults && (
        <div className="ptuv-stats">
          {stats.map(({ icon: Icon, value, label, tone }) => (
            <div className="ptuv-stat" key={label}>
              <span className={`ptuv-small-icon ${tone}`}>
                <Icon size={25} />
              </span>

              <div>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ptuv-controls">
        <label className="ptuv-search">
          <Search size={20} />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută test după titlu..."
            aria-label="Caută test după titlu"
          />
        </label>

        <label className="ptuv-filter">
          <Filter size={19} />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filtrează lista"
          >
            {(isResults
              ? [
                  ["all", "Toate rezultatele"],
                  ["passed", "Promovate"],
                  ["failed", "Nepromovate"],
                  ["unknown", "Fără calificativ"],
                ]
              : [
                  ["all", "Toate testele"],
                  ["pending", "Neîncepute"],
                  ["progress", "În desfășurare"],
                  ["finished", "Finalizate"],
                ]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ptuv-cards">
        {rows.length === 0 ? (
          <div className="ptuv-no-results">
            <Search size={26} />

            <strong>Nu există teste pentru filtrul selectat.</strong>

            <span>Modifică termenul de căutare sau filtrul.</span>
          </div>
        ) : (
          rows.map(({ item, versionId, done = [], exhausted = false, state }, index) => {
            const isPassed = state === "passed";
            const isFailed = state === "failed";

            const label = isResults
              ? isPassed
                ? "Promovat"
                : isFailed
                  ? "Nepromovat"
                  : "Finalizat"
              : state === "finished"
                ? "Finalizat"
                : state === "progress"
                  ? "În desfășurare"
                  : "Neînceput";

            const grade = scoreOf(item);
            const duration = durationOf(item);
            const questionCount = questionCountOf(item);

            const available = dateLabel(item?.available_from ?? item?.starts_at ?? item?.start_at);

            const until = dateLabel(
              item?.deadline_at ?? item?.available_until ?? item?.ends_at ?? item?.end_at,
            );

            const finishedDate = dateLabel(dateOf(item));

            const maxGrade = numberOrNull(item?.max_grade ?? item?.max_score);

            return (
              <article
                key={`${mode}-${
                  item?.attempt_id ?? item?.assignment_id ?? item?.id ?? index
                }-${index}`}
                className={`ptuv-card ptuv-${state}`}
              >
                <span className="ptuv-card-icon">
                  <ClipboardList size={25} />
                </span>

                <div className="ptuv-card-main">
                  <h3>{getTitle(item)}</h3>

                  <div className="ptuv-chips">
                    {item?.version_number != null && (
                      <span>
                        <Layers3 size={15} />
                        Versiunea {item.version_number}
                      </span>
                    )}

                    {duration !== null && (
                      <span>
                        <Clock3 size={15} />
                        {duration} min
                      </span>
                    )}

                    {questionCount !== null && (
                      <span>
                        <ListChecks size={15} />
                        {formatQuestions(questionCount)}
                      </span>
                    )}

                    {isResults
                      ? finishedDate && (
                          <span>
                            <CalendarDays size={15} />
                            Finalizat: {finishedDate}
                          </span>
                        )
                      : (available || until) && (
                          <span>
                            <CalendarDays size={15} />
                            Disponibil: {available ?? "—"} – {until ?? "—"}
                          </span>
                        )}
                  </div>
                </div>

                <div className={`ptuv-status ptuv-status-${state}`}>
                  {isResults ? (
                    isPassed ? (
                      <CheckCircle2 size={18} />
                    ) : isFailed ? (
                      <XCircle size={18} />
                    ) : (
                      <ClipboardList size={18} />
                    )
                  ) : state === "finished" ? (
                    <CheckCircle2 size={18} />
                  ) : state === "progress" ? (
                    <Play size={16} />
                  ) : (
                    <Hourglass size={17} />
                  )}

                  {label}
                </div>

                {isResults && (
                  <div className="ptuv-grade">
                    <small>Nota</small>

                    <strong>
                      {grade === null ? "—" : grade.toFixed(2)}

                      {grade !== null && maxGrade !== null && <em> / {maxGrade}</em>}
                    </strong>
                  </div>
                )}

                <div className="ptuv-card-actions">
                  {isResults ? (
                    <button
                      type="button"
                      className="ptuv-btn ptuv-btn-outline"
                      onClick={() => onOpenResult?.(item)}
                    >
                      <Eye size={18} />
                      Vezi detaliile
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <>
                      {done.length > 0 && (
                        <button
                          type="button"
                          className="ptuv-btn ptuv-btn-outline"
                          onClick={() => onOpenResult?.(done[0])}
                        >
                          <Eye size={18} />
                          Vezi rezultatul
                        </button>
                      )}

                      {!exhausted && (
                        <button
                          type="button"
                          className="ptuv-btn ptuv-btn-primary"
                          disabled={versionId == null || startingId != null}
                          onClick={() => onStart?.(item)}
                        >
                          {state === "progress" ? <ArrowRight size={18} /> : <Play size={18} />}

                          {startingId === String(versionId)
                            ? "Se deschide..."
                            : state === "progress"
                              ? "Continuă testul"
                              : "Începe testul"}
                        </button>
                      )}

                      {exhausted && done.length === 0 && (
                        <span className="ptuv-unavailable">Încercările au fost utilizate.</span>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
