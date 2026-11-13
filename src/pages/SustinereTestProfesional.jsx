import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Send,
  X,
  Trophy,
  Target,
  ListChecks,
  Check,
  CircleX,
  CircleHelp,
  Eye,
  BookOpen,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProfessionalAttempt,
  getProfessionalAttemptReview,
  saveProfessionalAnswer,
  submitProfessionalAttempt,
} from "../services/professionalTestingService";
import "./SustinereTestProfesional.css";

const errorMessage = (e) => e?.response?.data?.message || e?.message || "A apărut o eroare.";
const keyOf = String;
const remainingSeconds = (date) =>
  Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 1000));
const formatDuration = (value) => {
  if (value == null) return "—";
  const s = Math.max(0, Math.floor(Number(value)));
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} sec`;
};

export default function SustinereTestProfesional() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [review, setReview] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(null);
  const [seconds, setSeconds] = useState(null);
  const [error, setError] = useState("");
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const submitting = useRef(false);
  const pending = useRef(Promise.resolve());
  const active = useRef(true);

  const loadReview = useCallback(async () => {
    const payload = await getProfessionalAttemptReview(attemptId);
    if (active.current) {
      setReview(payload);
      setData(null);
    }
  }, [attemptId]);

  useEffect(() => {
    active.current = true;
    setData(null);
    setReview(null);
    setError("");
    setShowFinalizeModal(false);
    setAnswers({});
    setSeconds(null);
    pending.current = Promise.resolve();
    (async () => {
      try {
        const payload = await getProfessionalAttempt(attemptId);
        if (!active.current) return;
        setData(payload);
        const initial = {};
        for (const answer of payload.answers || []) {
          initial[keyOf(answer.question_id)] = (answer.selected_option_ids || []).map(keyOf);
        }
        setAnswers(initial);
        setSeconds(remainingSeconds(payload.attempt.expires_at));
      } catch (e) {
        if (!active.current) return;
        if (e?.response?.status === 409) {
          try {
            await loadReview();
          } catch (reviewError) {
            if (active.current) setError(errorMessage(reviewError));
          }
        } else {
          setError(errorMessage(e));
        }
      }
    })();
    return () => {
      active.current = false;
    };
  }, [attemptId, loadReview]);

  const finalize = useCallback(
    async (askConfirmation = true) => {
      if (submitting.current || review) return;
      if (askConfirmation) {
        setShowFinalizeModal(true);
        return;
      }
      setShowFinalizeModal(false);
      submitting.current = true;
      setBusy(true);
      try {
        await pending.current;
        await submitProfessionalAttempt(attemptId);
        await loadReview();
        if (active.current) toast.success("Testul a fost evaluat.");
      } catch (e) {
        if (active.current) {
          if (e?.response?.status === 409) {
            try {
              await loadReview();
            } catch (reviewError) {
              toast.error(errorMessage(reviewError));
            }
          } else {
            toast.error(errorMessage(e));
          }
        }
      } finally {
        submitting.current = false;
        if (active.current) setBusy(false);
      }
    },
    [attemptId, loadReview, review],
  );

  useEffect(() => {
    if (!data || review) return;
    const tick = () => setSeconds(remainingSeconds(data.attempt.expires_at));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [data, review]);

  useEffect(() => {
    if (seconds === 0 && data && !review) finalize(false);
  }, [seconds, data, review, finalize]);

  useEffect(() => {
    if (!showFinalizeModal) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) setShowFinalizeModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showFinalizeModal, busy]);

  const choose = (question, optionId) => {
    if (busy || savingQuestion !== null || seconds === 0) return;
    const qid = keyOf(question.id);
    const oid = keyOf(optionId);
    const previous = answers[qid] || [];
    const selected =
      question.question_type === "MULTIPLE_CHOICE"
        ? previous.includes(oid)
          ? previous.filter((id) => id !== oid)
          : [...previous, oid]
        : [oid];
    setAnswers((old) => ({ ...old, [qid]: selected }));
    setSavingQuestion(qid);
    pending.current = pending.current
      .catch(() => {})
      .then(() =>
        saveProfessionalAnswer(attemptId, {
          question_id: question.id,
          selected_option_ids: selected,
        }),
      );
    pending.current
      .then(() => {
        if (active.current) setSavingQuestion(null);
      })
      .catch((e) => {
        if (active.current) {
          setAnswers((old) => ({ ...old, [qid]: previous }));
          setSavingQuestion(null);
          toast.error(`Răspunsul nu a fost salvat: ${errorMessage(e)}`);
        }
      });
  };

  if (error)
    return (
      <section className="st-page">
        <button className="st-back" onClick={() => navigate("/testare")}>
          <ArrowLeft size={17} /> Înapoi la teste
        </button>
        <div className="st-card" role="alert">
          {error}
        </div>
      </section>
    );
  if (!data && !review)
    return (
      <section className="st-page">
        <div className="st-card">Se încarcă testul...</div>
      </section>
    );

  if (review) {
    const a = review.attempt;
    const questions = review.questions || [];
    const answered = questions.filter((q) => q.answered).length;
    const revealed = Boolean(review.reveal_answers);
    const correct = revealed ? questions.filter((q) => q.is_correct).length : null;
    const wrong = revealed ? questions.filter((q) => q.answered && !q.is_correct).length : null;
    const unanswered = questions.length - answered;
    const displayGrade = a.show_grade !== false && a.grade != null;
    const displayPercent = a.show_grade !== false && a.percentage != null;
    const percentage = Math.max(0, Math.min(100, Number(a.percentage) || 0));
    const statusOf = (q) => (!q.answered ? "unanswered" : q.is_correct ? "correct" : "wrong");
    return (
      <section className="st-page st-review-page">
        <button className="st-back" onClick={() => navigate("/testare")}>
          <ArrowLeft size={17} /> Înapoi la teste
        </button>
        <div className="st-review-heading">
          <div>
            <span className="st-eyebrow">BORDER / TESTARE PROFESIONALĂ / REZULTATE</span>
            <h1>{a.title || "Rezultatul testului"}</h1>
            <p>
              Încercarea nr. {a.attempt_number} · {questions.length} întrebări
            </p>
          </div>
          <span className={`st-result-status ${a.passed ? "st-pass" : "st-fail"}`}>
            {a.passed ? <CheckCircle2 size={17} /> : <CircleX size={17} />}
            {a.passed ? "Promovat" : "Nepromovat"}
          </span>
        </div>
        <div className="st-review-hero">
          <div className="st-review-score">
            <div
              className="st-score-ring"
              style={{ "--st-progress": `${displayPercent ? percentage : 0}%` }}
            >
              <div className="st-score-ring-inner">
                <Trophy size={24} />
                <strong>
                  {displayPercent ? `${a.percentage}%` : displayGrade ? a.grade : "—"}
                </strong>
                <span>
                  {displayPercent
                    ? "Scor obținut"
                    : displayGrade
                      ? "Nota obținută"
                      : "Evaluare finalizată"}
                </span>
              </div>
            </div>
          </div>
          <div className="st-review-summary">
            <div className="st-summary-kicker">
              <CheckCircle2 size={17} /> Evaluare finalizată
            </div>
            <h2>Rezultatul evaluării tale</h2>
            <p>
              Testul a fost evaluat. Poți consulta răspunsurile înregistrate mai jos
              {revealed ? " și variantele corecte." : "."}
            </p>
            <div className="st-summary-stats">
              {displayGrade && (
                <div className="st-summary-stat">
                  <Target size={19} />
                  <div>
                    <span>Nota finală</span>
                    <strong>{a.grade}</strong>
                  </div>
                </div>
              )}
              <div className="st-summary-stat">
                <Clock3 size={19} />
                <div>
                  <span>Timp utilizat</span>
                  <strong>{formatDuration(a.duration_seconds)}</strong>
                </div>
              </div>
              <div className="st-summary-stat">
                <ListChecks size={19} />
                <div>
                  <span>Completate</span>
                  <strong>
                    {answered} / {questions.length}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="st-review-overview">
          {revealed && (
            <div className="st-overview-item st-overview-correct">
              <CheckCircle2 size={22} />
              <div>
                <strong>{correct}</strong>
                <span>Corecte</span>
              </div>
            </div>
          )}
          {revealed && (
            <div className="st-overview-item st-overview-wrong">
              <CircleX size={22} />
              <div>
                <strong>{wrong}</strong>
                <span>Greșite</span>
              </div>
            </div>
          )}
          <div className="st-overview-item st-overview-neutral">
            <CircleHelp size={22} />
            <div>
              <strong>{unanswered}</strong>
              <span>Fără răspuns</span>
            </div>
          </div>
        </div>
        <div className="st-review-section-heading">
          <div>
            <span className="st-eyebrow">ANALIZA TESTULUI</span>
            <h2>Răspunsurile tale</h2>
            <p>Verifică fiecare întrebare și variantele selectate.</p>
          </div>
          <span className="st-question-count">
            <ListChecks size={17} /> {questions.length} întrebări
          </span>
        </div>
        <div className="st-review-list">
          {questions.map((q, i) => {
            const status = revealed ? statusOf(q) : "hidden";
            return (
              <article className={`st-card st-review-question st-question-${status}`} key={q.id}>
                <div className="st-review-question-head">
                  <span className="st-question-index">{String(i + 1).padStart(2, "0")}</span>
                  <div className="st-review-question-main">
                    <h3>{q.question_text}</h3>
                    <span>
                      {q.question_type === "MULTIPLE_CHOICE"
                        ? "Răspunsuri multiple"
                        : "Răspuns unic"}
                    </span>
                  </div>
                  <div className="st-review-question-meta">
                    <span className={`st-question-badge st-badge-${status}`}>
                      {revealed ? (
                        status === "correct" ? (
                          <CheckCircle2 size={15} />
                        ) : status === "wrong" ? (
                          <CircleX size={15} />
                        ) : (
                          <CircleHelp size={15} />
                        )
                      ) : (
                        <Eye size={15} />
                      )}
                      {revealed
                        ? status === "correct"
                          ? "Corect"
                          : status === "wrong"
                            ? "Greșit"
                            : "Fără răspuns"
                        : q.answered
                          ? "Înregistrat"
                          : "Fără răspuns"}
                    </span>
                    <span className="st-review-points">
                      {revealed
                        ? `${q.awarded_points ?? 0} / ${q.points} pct.`
                        : `${q.points} pct.`}
                    </span>
                  </div>
                </div>
                <div className="st-review-options">
                  {(q.options || []).map((o) => {
                    const selected = (q.selected_option_ids || []).map(keyOf).includes(keyOf(o.id));
                    const correctOption = revealed && o.is_correct === true;
                    const incorrectSelected = revealed && selected && !correctOption;
                    return (
                      <div
                        className={`st-review-option ${correctOption ? "st-answer-correct" : incorrectSelected ? "st-answer-wrong" : selected ? "st-answer-selected" : ""}`}
                        key={o.id}
                      >
                        <span className="st-option-mark">
                          {correctOption ? (
                            <Check size={15} />
                          ) : incorrectSelected ? (
                            <X size={15} />
                          ) : selected ? (
                            <Check size={15} />
                          ) : null}
                        </span>
                        <span className="st-option-text">{o.option_text}</span>
                        <span className="st-option-labels">
                          {selected && (
                            <span className="st-option-label st-label-selected">Ales</span>
                          )}
                          {correctOption && (
                            <span className="st-option-label st-label-correct">Corect</span>
                          )}
                          {incorrectSelected && (
                            <span className="st-option-label st-label-wrong">Greșit</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {revealed && (q.explanation || q.legal_reference) && (
                  <div className="st-review-notes">
                    {q.explanation && (
                      <p>
                        <BookOpen size={16} />
                        <span>
                          <strong>Explicație:</strong> {q.explanation}
                        </span>
                      </p>
                    )}
                    {q.legal_reference && (
                      <p>
                        <Scale size={16} />
                        <span>
                          <strong>Temei:</strong> {q.legal_reference}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {!revealed && (
          <div className="st-review-locked">
            <Eye size={19} />
            <span>
              Răspunsurile corecte nu sunt încă disponibile conform setărilor acestui test.
            </span>
          </div>
        )}
        <div className="st-review-bottom">
          <button className="st-primary" onClick={() => navigate("/testare")}>
            <ArrowLeft size={17} /> Înapoi la teste
          </button>
        </div>
      </section>
    );
  }

  const answered = (data.questions || []).filter(
    (q) => (answers[keyOf(q.id)] || []).length > 0,
  ).length;
  const timeLabel =
    seconds == null
      ? "--:--"
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className="st-page">
      <button className="st-back" onClick={() => navigate("/testare")}>
        <ArrowLeft size={17} /> Înapoi la teste
      </button>
      <div className="st-header">
        <div>
          <span className="st-eyebrow">BORDER / TESTARE PROFESIONALĂ</span>
          <h1>Susținerea testului</h1>
          <p>
            Încercarea nr. {data.attempt.attempt_number} · {answered} din {data.questions.length}{" "}
            întrebări cu răspuns
          </p>
        </div>
        <div className={`st-clock ${seconds < 60 ? "st-clock-urgent" : ""}`}>
          <Clock3 size={19} /> {timeLabel}
        </div>
      </div>
      <div className="st-questions">
        {data.questions.map((q, i) => (
          <article className="st-card" key={q.id}>
            <div className="st-question-title">
              <h2>
                {i + 1}. {q.question_text}
              </h2>
              <span>{q.points} pct.</span>
            </div>
            <p className="st-hint">
              {q.question_type === "MULTIPLE_CHOICE"
                ? "Poți selecta mai multe răspunsuri."
                : "Selectează un singur răspuns."}
            </p>
            <div className="st-options">
              {q.options.map((o) => (
                <label className="st-option" key={o.id}>
                  <input
                    type={q.question_type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                    name={`question-${q.id}`}
                    checked={(answers[keyOf(q.id)] || []).includes(keyOf(o.id))}
                    disabled={busy || savingQuestion !== null || seconds === 0}
                    onChange={() => choose(q, o.id)}
                  />
                  <span>{o.option_text}</span>
                </label>
              ))}
            </div>
            {savingQuestion === keyOf(q.id) && <small>Se salvează...</small>}
          </article>
        ))}
      </div>
      <div className="st-footer">
        <span>
          {answered}/{data.questions.length} completate
        </span>
        <button
          className="st-primary"
          disabled={busy || savingQuestion !== null}
          onClick={() => finalize(true)}
        >
          <Send size={17} /> {busy ? "Se finalizează..." : "Finalizează testul"}
        </button>
      </div>
      {showFinalizeModal && !review && (
        <div
          className="st-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setShowFinalizeModal(false);
          }}
        >
          <div
            className="st-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="st-confirm-title"
            aria-describedby="st-confirm-description"
          >
            <button
              type="button"
              className="st-confirm-close"
              aria-label="Închide fereastra"
              disabled={busy}
              onClick={() => setShowFinalizeModal(false)}
            >
              <X size={19} />
            </button>
            <div className="st-confirm-icon">
              <AlertTriangle size={29} />
            </div>
            <h2 id="st-confirm-title">Finalizezi testul?</h2>
            <p id="st-confirm-description">
              După finalizare nu vei mai putea modifica răspunsurile.
            </p>
            <div className="st-confirm-progress">
              <CheckCircle2 size={17} />
              Ai răspuns la{" "}
              <strong>
                {answered} din {data.questions.length}
              </strong>{" "}
              întrebări.
            </div>
            {answered < data.questions.length && (
              <p className="st-confirm-warning">
                Ai întrebări fără răspuns. Poți reveni la test pentru a le completa.
              </p>
            )}
            <div className="st-confirm-actions">
              <button
                type="button"
                className="st-confirm-cancel"
                disabled={busy}
                onClick={() => setShowFinalizeModal(false)}
              >
                Anulează
              </button>
              <button
                type="button"
                className="st-primary"
                disabled={busy || savingQuestion !== null}
                onClick={() => finalize(false)}
                autoFocus
              >
                <Send size={17} /> {busy ? "Se finalizează..." : "Finalizează testul"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
