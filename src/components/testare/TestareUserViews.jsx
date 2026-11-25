import { useEffect, useMemo, useState } from "react";
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

const elapsedSecondsOf = (item) => {
  const seconds = numberOrNull(item?.duration_seconds);
  if (seconds !== null && seconds >= 0) return seconds;

  const start = item?.started_at;
  const end = dateOf(item);
  if (start && end) {
    const elapsed = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
    if (Number.isFinite(elapsed) && elapsed >= 0) return elapsed;
  }

  const minutes = numberOrNull(item?.elapsed_minutes ?? item?.time_spent_minutes);
  return minutes !== null && minutes >= 0 ? minutes * 60 : null;
};

const formatElapsed = (seconds) => {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return [
    hours && `${hours} h`,
    minutes && `${minutes} min`,
    remaining || (!hours && !minutes) ? `${remaining} s` : null,
  ]
    .filter(Boolean)
    .join(" ");
};

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

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const isResults = mode === "results";

  const assignedItems = Array.isArray(assigned) ? assigned : [];
  const resultItems = Array.isArray(results) ? results : [];

  const completed = useMemo(() => resultItems.filter(completedResult), [results]);

  const decorated = useMemo(() => {
    return assignedItems.map((item) => {
      const versionId =
        typeof versionIdOf === "function" ? versionIdOf(item) : (item?.version_id ?? null);

      const assignmentId = item?.assignment_id ?? null;
      const sameAssignment = (result) =>
        assignmentId != null && String(result?.assignment_id) === String(assignmentId);
      const finishedAttempts =
        assignmentId == null
          ? []
          : typeof finishedForVersion === "function"
            ? finishedForVersion(assignmentId)
            : resultItems.filter((result) => sameAssignment(result) && completedResult(result));

      const done = Array.isArray(finishedAttempts) ? finishedAttempts : [];

      const maxAttempts = numberOrNull(item?.max_attempts ?? item?.allowed_attempts);

      const progress = String(item?.progress_status ?? item?.assignment_status ?? "").toUpperCase();
      const active =
        typeof item.has_active_attempt === "boolean"
          ? item.has_active_attempt &&
            (!item.active_attempt_expires_at || Date.parse(item.active_attempt_expires_at) > now)
          : PROGRESS_STATUSES.has(progress) ||
            resultItems.some(
              (result) => sameAssignment(result) && PROGRESS_STATUSES.has(getStatus(result)),
            );
      const attemptsUsed = numberOrNull(item?.attempts_used);
      const exhausted =
        !active &&
        maxAttempts !== null &&
        maxAttempts > 0 &&
        Math.max(done.length, attemptsUsed ?? 0) >= maxAttempts;

      const start = Date.parse(item.available_from);
      const end = Date.parse(item.deadline_at ?? item.available_until);
      const retry = Date.parse(item.next_attempt_at);
      const state =
        item.block_after_expiry !== false && Number.isFinite(end) && end <= now
          ? "expired"
          : Number.isFinite(start) && start > now
            ? "scheduled"
            : exhausted
              ? "finished"
              : active
                ? "progress"
                : Number.isFinite(retry) && retry > now
                  ? "waiting"
                  : "pending";

      return {
        item,
        versionId,
        assignmentId,
        done,
        exhausted,
        state,
      };
    });
  }, [assigned, results, versionIdOf, finishedForVersion, now]);

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

  const durations = completed.map(elapsedSecondsOf).filter((value) => value !== null && value >= 0);

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
          label: "Nota medie",
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
            ? formatElapsed(durations.reduce((sum, value) => sum + value, 0) / durations.length)
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
                  ["scheduled", "Programate"],
                  ["expired", "Expirate"],
                  ["waiting", "În așteptare"],
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
          rows.map(
            ({ item, versionId, assignmentId, done = [], exhausted = false, state }, index) => {
              const isPassed = state === "passed";
              const isFailed = state === "failed";

              const label = isResults
                ? isPassed
                  ? "Promovat"
                  : isFailed
                    ? "Nepromovat"
                    : "Finalizat"
                : state === "expired"
                  ? "Expirat"
                  : state === "scheduled"
                    ? "Programat"
                    : state === "waiting"
                      ? "În așteptare"
                      : state === "finished"
                        ? "Finalizat"
                        : state === "progress"
                          ? "În desfășurare"
                          : "Neînceput";

              const grade = scoreOf(item);
              const duration = durationOf(item);
              const questionCount = questionCountOf(item);

              const available = dateLabel(
                item?.available_from ?? item?.starts_at ?? item?.start_at,
              );

              const until = dateLabel(
                item?.deadline_at ?? item?.available_until ?? item?.ends_at ?? item?.end_at,
              );

              const finishedDate = dateLabel(dateOf(item));

              const maxGrade = numberOrNull(item?.max_grade ?? item?.max_score);

              return (
                <article
                  key={`${mode}-${isResults ? (item?.attempt_id ?? item?.id ?? index) : (assignmentId ?? index)}`}
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

                      {!isResults && item?.assigned_at && (
                        <span>
                          <CalendarDays size={15} />
                          Atribuit: {dateLabel(item.assigned_at)}
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
                      <small>
                        {item.show_grade === false
                          ? "Rezultat ascuns"
                          : item.grading_mode === "percent"
                            ? "Procent"
                            : "Nota"}
                      </small>

                      <strong>
                        {item.show_grade === false
                          ? "—"
                          : item.grading_mode === "percent"
                            ? numberOrNull(item.percentage) === null
                              ? "—"
                              : `${numberOrNull(item.percentage)}%`
                            : grade === null
                              ? "—"
                              : grade.toFixed(2)}

                        {item.show_grade !== false &&
                          item.grading_mode !== "percent" &&
                          grade !== null &&
                          maxGrade !== null && <em> / {maxGrade}</em>}
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

                        {!exhausted && !["scheduled", "expired", "waiting"].includes(state) && (
                          <button
                            type="button"
                            className="ptuv-btn ptuv-btn-primary"
                            disabled={
                              versionId == null || assignmentId == null || startingId != null
                            }
                            onClick={() => onStart?.(item)}
                          >
                            {state === "progress" ? <ArrowRight size={18} /> : <Play size={18} />}

                            {startingId === String(assignmentId)
                              ? "Se deschide..."
                              : state === "progress"
                                ? "Continuă testul"
                                : "Începe testul"}
                          </button>
                        )}

                        {state === "waiting" && (
                          <span className="ptuv-unavailable">
                            Reluare: {dateLabel(item.next_attempt_at)}
                          </span>
                        )}
                        {state === "scheduled" && (
                          <span className="ptuv-unavailable">
                            Disponibil de la {dateLabel(item.available_from)}
                          </span>
                        )}
                        {state === "expired" && (
                          <span className="ptuv-unavailable">Termenul a expirat.</span>
                        )}
                        {state === "finished" && done.length === 0 && (
                          <span className="ptuv-unavailable">Încercările au fost utilizate.</span>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            },
          )
        )}
      </div>
    </div>
  );
}
