import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import "./PreviewTestModal.css";

export default function PreviewTestModal({ form, onClose }) {
  const questions = form.questions || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const question = questions[index];
  if (!question) return null;
  const multiple = question.type === "multiple";
  const selected = answers[index] || [];
  const choose = (optionIndex) =>
    setAnswers((prev) => ({
      ...prev,
      [index]: multiple
        ? selected.includes(optionIndex)
          ? selected.filter((i) => i !== optionIndex)
          : [...selected, optionIndex]
        : [optionIndex],
    }));
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
        <div className="pt-preview-progress">
          <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
        <main className="pt-preview-body">
          <p className="pt-preview-counter">
            Întrebarea {index + 1} din {questions.length} · {question.points || 1} puncte
          </p>
          <h3>{question.text || "Întrebare fără text"}</h3>
          <p className="pt-preview-instruction">
            {multiple
              ? "Selectează toate răspunsurile pe care le consideri corecte."
              : "Selectează un singur răspuns."}
          </p>
          <div className="pt-preview-options">
            {(question.answers || []).map((answer, optionIndex) => (
              <label
                key={optionIndex}
                className={`pt-preview-option ${selected.includes(optionIndex) ? "selected" : ""}`}
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`preview-${index}`}
                  checked={selected.includes(optionIndex)}
                  onChange={() => choose(optionIndex)}
                />
                <span>{answer.text || `Varianta ${optionIndex + 1}`}</span>
              </label>
            ))}
          </div>
        </main>
        <footer className="pt-preview-footer">
          <span>
            Răspunsuri selectate: {Object.values(answers).filter((a) => a.length).length}/
            {questions.length}
          </span>
          <div>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              <ChevronLeft size={16} /> Anterioară
            </button>
            {index < questions.length - 1 ? (
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
