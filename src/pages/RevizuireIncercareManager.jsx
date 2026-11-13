import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock3,
  ClipboardList,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import api from "../services/api";
import "./RevizuireIncercareManager.css";

const dateText = (value) => (value ? new Date(value).toLocaleString("ro-RO") : "—");
const num = (value, decimals = 0) =>
  value == null ? "—" : Number(value).toLocaleString("ro-RO", { maximumFractionDigits: decimals });

export default function RevizuireIncercareManager() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(
          `/testare/incercari/${encodeURIComponent(attemptId)}/revizuire-manager`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setData(response.data);
      } catch (err) {
        if (controller.signal.aborted || err.code === "ERR_CANCELED") return;
        setData(null);
        setError(err.response?.data?.message || "Nu am putut încărca revizuirea încercării.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [attemptId, reload]);

  const attempt = data?.attempt;
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  const selected = (question) => new Set((question.selected_option_ids || []).map(String));

  return (
    <main className="ptr-page">
      <div className="ptr-topbar">
        <button
          className="ptr-button ptr-button-light"
          onClick={() => navigate("/testare")}
          type="button"
        >
          <ArrowLeft size={17} /> Înapoi la testare
        </button>
        <button
          className="ptr-button ptr-button-light"
          onClick={() => setReload((x) => x + 1)}
          type="button"
          disabled={loading}
        >
          <RefreshCw size={17} /> Actualizează
        </button>
      </div>
      <div className="ptr-heading">
        <div className="ptr-heading-icon">
          <ClipboardList size={26} />
        </div>
        <div>
          <h1>Revizuirea încercării</h1>
          <p>Detalii despre testul susținut și răspunsurile înregistrate.</p>
        </div>
      </div>
      {loading ? (
        <section className="ptr-panel ptr-message" role="status">
          Se încarcă detaliile încercării…
        </section>
      ) : error ? (
        <section className="ptr-panel ptr-message ptr-error" role="alert">
          <AlertCircle size={20} /> {error}
        </section>
      ) : attempt ? (
        <>
          <section className="ptr-panel">
            <div className="ptr-section-heading">
              <h2>{attempt.title || "Test profesional"}</h2>
              <span className={`ptr-status ${attempt.passed ? "ptr-passed" : "ptr-failed"}`}>
                {attempt.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {attempt.passed ? "Promovat" : "Nepromovat"}
              </span>
            </div>
            <div className="ptr-stats">
              <div>
                <span>Utilizator</span>
                <strong>{attempt.user_name_snapshot || "—"}</strong>
              </div>
              <div>
                <span>Încercarea</span>
                <strong>#{attempt.attempt_number ?? "—"}</strong>
              </div>
              <div>
                <span>Scor</span>
                <strong>{num(attempt.percentage, 2)}%</strong>
              </div>
              <div>
                <span>Nota</span>
                <strong>{num(attempt.grade, 2)}</strong>
              </div>
              <div>
                <span>Punctaj</span>
                <strong>
                  {num(attempt.earned_points, 2)} / {num(attempt.total_points, 2)}
                </strong>
              </div>
              <div>
                <span>Stare</span>
                <strong>
                  {attempt.status === "SUBMITTED"
                    ? "Finalizată"
                    : attempt.status === "EXPIRED"
                      ? "Expirată"
                      : attempt.status || "—"}
                </strong>
              </div>
            </div>
            <div className="ptr-dates">
              <span>
                <Clock3 size={15} /> Început: {dateText(attempt.started_at)}
              </span>
              <span>
                <Clock3 size={15} /> Finalizare: {dateText(attempt.submitted_at)}
              </span>
            </div>
          </section>
          <section className="ptr-questions">
            <h2>
              Întrebări și răspunsuri <span>({questions.length})</span>
            </h2>
            {questions.length === 0 ? (
              <div className="ptr-panel ptr-message">
                Nu există întrebări pentru această încercare.
              </div>
            ) : (
              questions.map((question, index) => {
                const chosen = selected(question);
                return (
                  <article className="ptr-panel ptr-question" key={question.id ?? index}>
                    <div className="ptr-question-title">
                      <span className="ptr-number">{index + 1}</span>
                      <h3>{question.question_text}</h3>
                      <span
                        className={`ptr-status ${question.is_correct === true ? "ptr-passed" : question.is_correct === false ? "ptr-failed" : "ptr-neutral"}`}
                      >
                        {question.is_correct === true
                          ? "Corect"
                          : question.is_correct === false
                            ? "Incorect"
                            : "Fără evaluare"}
                      </span>
                    </div>
                    <div className="ptr-options">
                      {(question.options || []).map((option) => {
                        const isSelected = chosen.has(String(option.id));
                        return (
                          <div
                            key={option.id}
                            className={`ptr-option ${isSelected ? "ptr-option-selected" : ""} ${option.is_correct ? "ptr-option-correct" : ""}`}
                          >
                            <span className="ptr-option-marker">{isSelected ? "✓" : "○"}</span>
                            <span>{option.option_text}</span>
                            <div className="ptr-option-tags">
                              {isSelected && <small>Ales</small>}
                              {option.is_correct && <small>Corect</small>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="ptr-question-footer">
                      <span>{question.answered ? "Răspuns înregistrat" : "Fără răspuns"}</span>
                      <span>
                        {num(question.awarded_points, 2)} / {num(question.points, 2)} puncte
                      </span>
                    </div>
                    {question.explanation && (
                      <div className="ptr-explanation">
                        <strong>Explicație:</strong> {question.explanation}
                      </div>
                    )}
                    {question.legal_reference && (
                      <div className="ptr-explanation">
                        <strong>Referință:</strong> {question.legal_reference}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
