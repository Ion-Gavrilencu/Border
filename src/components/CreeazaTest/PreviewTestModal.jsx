import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import "./PreviewTestModal.css";

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function buildQuestions(form) {
  const source = Array.isArray(form.questions) ? form.questions : [];
  const limit = Number(form.questionLimit ?? 0);
  let questions = limit > 0 ? shuffle(source).slice(0, limit) : [...source];
  if (form.shuffleQuestions) questions = shuffle(questions);
  else questions.sort((a, b) => source.indexOf(a) - source.indexOf(b));
  return questions.map((q) => ({
    ...q,
    answers: form.shuffleAnswers ? shuffle(q.answers || []) : [...(q.answers || [])],
  }));
}
export default function PreviewTestModal({ form, onClose }) {
  const [questions] = useState(() => buildQuestions(form));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const sequential = form.navigationMode === "sequential";
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const question = questions[index];
  const invalid = !question || Number(form.questionLimit || 0) > (form.questions || []).length;
  const multiple = question?.type === "multiple";
  const selected = answers[index] || [];
  const choose = (optionIndex) =>
    setAnswers((prev) => {
      const old = prev[index] || [];
      return {
        ...prev,
        [index]: multiple
          ? old.includes(optionIndex)
            ? old.filter((i) => i !== optionIndex)
            : [...old, optionIndex]
          : [optionIndex],
      };
    });
  return (
    <div
      className="pt-preview-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="pt-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pt-preview-title"
      >
        <header className="pt-preview-header">
          <div>
            <span className="pt-preview-eyebrow">
              <Eye size={15} /> MOD PREVIZUALIZARE · FĂRĂ SALVARE
            </span>
            <h2 id="pt-preview-title">{form.title || "Previzualizare test"}</h2>
            <p>
              {form.category || "Test profesional"} · {form.duration || 30} minute ·{" "}
              {questions.length} întrebări
            </p>
          </div>
          <button
            type="button"
            className="pt-preview-close"
            onClick={onClose}
            aria-label="Închide previzualizarea"
          >
            <X size={22} />
          </button>
        </header>
        {invalid ? (
          <main className="pt-preview-body">
            <p role="alert">Banca de întrebări este insuficientă pentru configurația selectată.</p>
          </main>
        ) : (
          <>
            <div className="pt-preview-progress">
              <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
            </div>
            <main className="pt-preview-body">
              <p className="pt-preview-counter">
                Întrebarea {index + 1} din {questions.length} · {question.points ?? 1} puncte
              </p>
              <h3>{question.text || "Întrebare fără text"}</h3>
              <p className="pt-preview-instruction">
                {multiple
                  ? "Selectează toate răspunsurile pe care le consideri corecte."
                  : "Selectează un singur răspuns."}
                {sequential && " Navigare secvențială: nu poți reveni la întrebările precedente."}
              </p>
              <div className="pt-preview-options">
                {question.answers.map((answer, i) => (
                  <label
                    key={i}
                    className={`pt-preview-option ${selected.includes(i) ? "selected" : ""}`}
                  >
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name={`preview-${index}`}
                      checked={selected.includes(i)}
                      onChange={() => choose(i)}
                    />
                    <span>{answer.text || `Varianta ${i + 1}`}</span>
                  </label>
                ))}
              </div>
            </main>
          </>
        )}
        <footer className="pt-preview-footer">
          <span>
            Răspunsuri selectate: {Object.values(answers).filter((a) => a.length).length}/
            {questions.length}
          </span>
          <div>
            {!invalid && !sequential && (
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft size={16} /> Anterioară
              </button>
            )}
            {!invalid && index < questions.length - 1 ? (
              <button type="button" className="primary" onClick={() => setIndex((i) => i + 1)}>
                Următoarea <ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" className="primary" onClick={onClose}>
                Închide previzualizarea
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
