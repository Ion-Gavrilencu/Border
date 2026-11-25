import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
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
  getProfessionalAttemptReview,
  saveProfessionalAnswer as saveAnswerRequest,
  submitProfessionalAttempt,
} from "../services/professionalTestingService";
import api from "../services/api";
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
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(null);
  const [seconds, setSeconds] = useState(null);
  const [error, setError] = useState("");
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const submitting = useRef(false);
  const advancing = useRef(false);
  const pending = useRef(Promise.resolve());
  const active = useRef(true);
  const monitorTabs = data?.attempt?.monitor_tabs === true;
  const pageToken = useRef(null);
  if (!pageToken.current)
    pageToken.current =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}-page`;
  const saveProfessionalAnswer = useCallback(
    (id, payload) => saveAnswerRequest(id, { ...payload, page_token: pageToken.current }),
    [],
  );
  const exitRequested = useRef(false);
  const [integrityClosing, setIntegrityClosing] = useState(false);
  const [integrityError, setIntegrityError] = useState(false);
  const cleanupTimer = useRef(null);
  const idleAuto = data?.attempt?.idle_auto_finish === true;
  const idleWarningMinutes = Number(data?.attempt?.idle_warning_minutes ?? 0);
  useEffect(() => {
    if (idleAuto || !idleWarningMinutes || review || data?.attempt?.status !== "IN_PROGRESS")
      return;
    let last = Date.now(),
      warned = false;
    const activity = () => {
      last = Date.now();
      warned = false;
    };
    const events = ["pointerdown", "keydown", "scroll"];
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }));
    const timer = window.setInterval(() => {
      if (
        !warned &&
        document.visibilityState === "visible" &&
        Date.now() - last >= idleWarningMinutes * 60000
      ) {
        warned = true;
        toast.warning("Nu a fost detectată activitate. Timpul testului continuă să curgă.");
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, activity));
    };
  }, [attemptId, idleWarningMinutes, idleAuto, review, data?.attempt?.status]);
  const loadReview = useCallback(async () => {
    const payload = await getProfessionalAttemptReview(attemptId);
    if (active.current) {
      setReview(payload);
      setData(null);
    }
  }, [attemptId]);

  // O singură abatere închide definitiv încercarea. Serverul calculează nota.
  const finishForExit = useCallback(
    async (silent = false) => {
      if (exitRequested.current || submitting.current || !monitorTabs || review) return;
      exitRequested.current = true;
      submitting.current = true;
      if (!silent) {
        setIntegrityClosing(true);
        setIntegrityError(false);
        setBusy(true);
        setShowFinalizeModal(false);
      }
      const event_id =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}-exit`;
      try {
        // Nu așteptăm cererile nesalvate: evaluăm ce a ajuns deja la server.
        await saveProfessionalAnswer(attemptId, { action: "tab_hidden", event_id });
        if (active.current && !silent) {
          await loadReview();
          toast.error("Testul a fost finalizat automat pentru părăsirea paginii.");
        }
      } catch (e) {
        if (!silent && active.current) {
          if (e?.response?.status === 409) {
            try {
              await loadReview();
              return;
            } catch {
              /* reîncercare */
            }
          }
          setIntegrityError(true);
        }
      }
    },
    [attemptId, monitorTabs, review, loadReview, saveProfessionalAnswer],
  );

  useEffect(() => {
    if (!monitorTabs || review || data?.attempt?.status !== "IN_PROGRESS") return;
    clearTimeout(cleanupTimer.current);
    const hidden = () => {
      if (document.visibilityState === "hidden") void finishForExit();
    };
    const unload = (event) => {
      if (submitting.current && !exitRequested.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const pagehide = () => {
      void finishForExit(true);
    };
    const pop = () => {
      void finishForExit(true);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("popstate", pop);
    hidden();
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("popstate", pop);
      // Acoperă navigarea React; amânarea evită declanșarea la StrictMode.
      cleanupTimer.current = setTimeout(() => {
        if (!active.current) void finishForExit(true);
      }, 0);
    };
  }, [attemptId, monitorTabs, review, data?.attempt?.status, finishForExit]);

  const [idleRemaining, setIdleRemaining] = useState(null);
  const idleConfirm = useRef(null);
  const idleDialog = useRef(null);
  const idleWarningOpen = idleRemaining !== null;
  useEffect(() => {
    const dialog = idleDialog.current;
    if (!dialog) return;
    if (idleWarningOpen && !dialog.open) dialog.showModal();
    else if (!idleWarningOpen && dialog.open) dialog.close();
  }, [idleWarningOpen]);
  useEffect(() => {
    setIdleRemaining(null);
    if (!idleAuto || review || data?.attempt?.status !== "IN_PROGRESS") return;
    let alive = true,
      touched = false,
      sending = false;
    const activity = (e) => {
      if (e.isTrusted && document.visibilityState === "visible" && !idleDialog.current?.open)
        touched = true;
    };
    const poll = async () => {
      if (!alive || sending || document.visibilityState !== "visible" || submitting.current) return;
      sending = true;
      const wasActive = touched;
      touched = false;
      try {
        const r = await saveProfessionalAnswer(attemptId, {
          action: "idle_poll",
          active: wasActive,
        });
        if (!alive) return;
        if (r.finished) {
          setIdleRemaining(null);
          await loadReview();
        } else setIdleRemaining(r.enabled && r.remaining <= 60 ? r.remaining : null);
      } catch (e) {
        if (alive) {
          setIdleRemaining(null);
          touched = touched || wasActive;
          if (e?.response?.status === 409) {
            try {
              await loadReview();
            } catch {}
          }
        }
      } finally {
        sending = false;
      }
    };
    idleConfirm.current = () => {
      touched = true;
      void poll();
    };
    const events = ["pointerdown", "keydown", "scroll"];
    events.forEach((n) => window.addEventListener(n, activity, { passive: true, capture: true }));
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      alive = false;
      idleConfirm.current = null;
      clearInterval(timer);
      events.forEach((n) => window.removeEventListener(n, activity, true));
    };
  }, [attemptId, idleAuto, review, data?.attempt?.status, loadReview]);
  useEffect(() => {
    active.current = true;
    setData(null);
    setReview(null);
    setError("");
    setShowFinalizeModal(false);
    setAnswers({});
    setCurrentQuestion(0);
    setSeconds(null);
    pending.current = Promise.resolve();
    exitRequested.current = false;
    submitting.current = false;
    setIntegrityClosing(false);
    setIntegrityError(false);
    let cancelled = false;
    (async () => {
      try {
        const { data: payload } = await api.get(
          `/testare/incercari/${encodeURIComponent(attemptId)}`,
          {
            params: { page_token: pageToken.current },
          },
        );
        if (cancelled || !active.current) return;
        if (payload.attempt.status !== "IN_PROGRESS") {
          await loadReview();
          return;
        }
        setData(payload);
        setCurrentQuestion(
          payload.attempt.navigation_mode === "sequential"
            ? Number(payload.attempt.current_question_index)
            : 0,
        );
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
      cancelled = true;
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

  const advance = async () => {
    if (busy || savingQuestion !== null || seconds === 0 || submitting.current || advancing.current)
      return;
    if (data.attempt.navigation_mode !== "sequential") {
      setCurrentQuestion((i) => Math.min(data.questions.length - 1, i + 1));
      return;
    }
    advancing.current = true;
    setBusy(true);
    try {
      const request = pending.current
        .catch(() => {})
        .then(() =>
          saveProfessionalAnswer(attemptId, {
            action: "advance",
            question_id: data.questions[currentQuestion].id,
          }),
        );
      pending.current = request.catch(() => {});
      const result = await request;
      if (active.current) {
        setData((old) =>
          old
            ? {
                ...old,
                attempt: { ...old.attempt, current_question_index: result.current_question_index },
                questions: result.questions,
              }
            : old,
        );
        setCurrentQuestion(result.current_question_index);
      }
    } catch (e) {
      if (active.current) toast.error(errorMessage(e));
    } finally {
      advancing.current = false;
      if (active.current && !submitting.current) setBusy(false);
    }
  };
  const choose = (question, optionId) => {
    if (busy || savingQuestion !== null || seconds === 0 || advancing.current || submitting.current)
      return;
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

  if (integrityClosing && !review)
    return (
      <section className="st-page">
        <div className="st-card st-integrity-notice" role="alert">
          <AlertTriangle size={28} />
          <h2>Încercare blocată</h2>
          <p>
            {integrityError
              ? "Nu am putut confirma finalizarea. Reconectează-te și reîncearcă. Testul nu poate continua."
              : "Se finalizează automat testul. Răspunsurile salvate vor fi evaluate."}
          </p>
          {integrityError && (
            <button
              className="st-primary"
              onClick={() => {
                exitRequested.current = false;
                submitting.current = false;
                void finishForExit();
              }}
            >
              Reîncearcă finalizarea
            </button>
          )}
        </div>
      </section>
    );
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
    const isPartial = (q) =>
      q.answered && !q.is_correct && (q.is_partial === true || Number(q.awarded_points) > 0);
    const partial = revealed ? questions.filter(isPartial).length : 0;
    const wrong = revealed
      ? questions.filter((q) => q.answered && !q.is_correct && !isPartial(q)).length
      : null;
    const unanswered = questions.length - answered;
    const displayGrade = a.show_grade !== false && a.grade != null;
    const displayPercent = a.show_grade !== false && a.percentage != null;
    const percentage = Math.max(0, Math.min(100, Number(a.percentage) || 0));
    const statusOf = (q) =>
      !q.answered ? "unanswered" : q.is_correct ? "correct" : isPartial(q) ? "partial" : "wrong";
    return (
      <section className="st-page st-review-page">
        {a.completion_reason === "TAB_EXIT" && (
          <div className="st-integrity-notice" role="alert">
            <AlertTriangle size={22} /> <strong>Test finalizat automat</strong>
            <p>
              Pagina de testare a fost părăsită sau redeschisă. Încercarea a fost închisă definitiv.
              Rezultatul reflectă răspunsurile salvate.
            </p>
          </div>
        )}
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
          {revealed && partial > 0 && (
            <div className="st-overview-item st-overview-neutral">
              <Target size={22} />
              <div>
                <strong>{partial}</strong>
                <span>Parțial corecte</span>
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
                    <span
                      className={`st-question-badge st-badge-${status === "partial" ? "unanswered" : status}`}
                    >
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
                          : status === "partial"
                            ? "Parțial corect"
                            : status === "wrong"
                              ? "Greșit"
                              : "Fără răspuns"
                        : q.answered
                          ? "Înregistrat"
                          : "Fără răspuns"}
                    </span>
                    <span className="st-review-points">
                      {revealed && q.awarded_points != null
                        ? `${q.awarded_points} / ${q.points} pct.`
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

  const questionCount = data.questions.length;
  const sequential = data.attempt.navigation_mode === "sequential";
  const navigationLocked = busy || savingQuestion !== null || seconds === 0;
  const answered = (data.questions || []).filter(
    (q) => (answers[keyOf(q.id)] || []).length > 0,
  ).length;
  const timeLabel =
    seconds == null
      ? "--:--"
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className="st-page st-taking-page">
      <button
        className="st-back"
        onClick={() => {
          if (!monitorTabs) return navigate("/testare");
          if (
            window.confirm(
              "Dacă părăsești pagina, testul va fi finalizat automat și nu va putea fi reluat. Continui?",
            )
          )
            void finishForExit();
        }}
      >
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
      </div>
      <dialog
        ref={idleDialog}
        aria-labelledby="idle-warning-title"
        onCancel={(e) => e.preventDefault()}
        style={{
          border: 0,
          borderRadius: 20,
          padding: 24,
          width: "min(420px,calc(100% - 32px))",
          boxShadow: "0 20px 65px #172a5266",
          color: "#14234d",
        }}
      >
        <h2 id="idle-warning-title">Inactivitate detectată</h2>
        <p>
          Testul se finalizează automat dacă nu confirmi continuarea. Răspunsurile salvate vor fi
          evaluate.
        </p>
        <strong style={{ fontSize: 32, color: "#a36612" }}>{idleRemaining ?? 0} secunde</strong>
        <p>
          <button type="button" onClick={() => idleConfirm.current?.()} className="st-back">
            Sunt prezent – Continuă testul
          </button>
        </p>
      </dialog>
      {monitorTabs && (
        <div className="st-integrity-notice" role="status">
          <AlertTriangle size={22} /> <strong>Mod strict de testare</strong>
          <p>
            Nu părăsi pagina și nu schimba fila. La prima abatere, testul se finalizează automat și
            nu poate fi reluat.
          </p>
        </div>
      )}
      <div className="st-exam-progress">
        <div className="st-exam-progress-top">
          <div className="st-exam-time">
            <span>Timp rămas</span>
            <div
              className={`st-clock ${seconds !== null && seconds < 60 ? "st-clock-urgent" : ""}`}
            >
              <Clock3 size={19} /> {timeLabel}
            </div>
          </div>
          <div className="st-exam-count">
            <span>Progres</span>
            <strong>
              {answered} din {data.questions.length}
            </strong>
          </div>
        </div>
        <div
          className="st-progress-track"
          role="progressbar"
          aria-label="Întrebări cu răspuns"
          aria-valuemin={0}
          aria-valuemax={data.questions.length || 1}
          aria-valuenow={answered}
        >
          <div
            style={{
              width: `${data.questions.length ? (answered / data.questions.length) * 100 : 0}%`,
            }}
          />
        </div>
        <nav className="st-question-nav" aria-label="Navigare între întrebări">
          {data.questions.map((q, i) => {
            const done = (answers[keyOf(q.id)] || []).length > 0;
            return (
              <button
                type="button"
                key={q.id}
                className={[done && "is-answered", currentQuestion === i && "is-current"]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={currentQuestion === i ? "step" : undefined}
                disabled={navigationLocked || (sequential && currentQuestion !== i)}
                aria-label={`Întrebarea ${i + 1}, ${done ? "cu răspuns" : "fără răspuns"}`}
                onClick={() => setCurrentQuestion(i)}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>
        <div className="st-nav-legend">
          <span>
            <i className="st-legend-current" /> Curentă
          </span>
          <span>
            <i className="st-legend-answered" /> Completată
          </span>
          <span>
            <i /> Fără răspuns
          </span>
        </div>
      </div>
      <div className="st-questions">
        {data.questions.slice(currentQuestion, currentQuestion + 1).map((q) => (
          <article className="st-card st-exam-question" key={q.id} id={`st-question-${q.id}`}>
            <div className="st-question-title">
              <span>
                Întrebarea {currentQuestion + 1} din {data.questions.length}
              </span>
              <span>{q.points} pct.</span>
            </div>
            <h2 className="st-exam-question-text">{q.question_text}</h2>
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
      {sequential && (
        <p className="st-hint">
          Navigare secvențială: după trecerea la următoarea întrebare nu mai poți reveni.
          Întrebările pot fi lăsate fără răspuns.
        </p>
      )}
      <div className="st-step-controls">
        <button
          type="button"
          className="st-step-previous"
          disabled={navigationLocked || sequential || currentQuestion === 0}
          onClick={() => setCurrentQuestion((i) => Math.max(0, i - 1))}
        >
          <ArrowLeft size={17} /> Anterioară
        </button>
        {currentQuestion < questionCount - 1 ? (
          <button
            type="button"
            className="st-primary"
            disabled={navigationLocked}
            onClick={advance}
          >
            Următoarea <ArrowRight size={17} />
          </button>
        ) : (
          <button
            type="button"
            className="st-primary"
            disabled={navigationLocked || !questionCount}
            onClick={() => finalize(true)}
          >
            <Send size={17} /> Finalizează
          </button>
        )}
      </div>
      <div className="st-step-summary">
        <span role="status">
          Întrebarea {questionCount ? currentQuestion + 1 : 0} din {questionCount}
        </span>
        <span>
          {answered}/{questionCount} completate
        </span>
      </div>
      {!sequential && currentQuestion < questionCount - 1 && answered === questionCount && (
        <button
          type="button"
          className="st-primary st-step-finish"
          disabled={navigationLocked}
          onClick={() => finalize(true)}
        >
          <Send size={17} /> Finalizează testul
        </button>
      )}
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
