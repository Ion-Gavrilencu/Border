import "./Intrebari.css";
import React, { useState } from "react";
import {
  SlidersHorizontal,
  Download,
  Plus,
  GripVertical,
  Copy,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Trash2,
  HelpCircle,
  MoreHorizontal,
  Play,
} from "lucide-react";

const TRUE_FALSE_ANSWERS = [
  { text: "Adevărat", correct: false },
  { text: "Fals", correct: false },
];

const Field = ({ label, required, children }) => (
  <label className="pte-field">
    <span>
      {label}
      {required && <b> *</b>}
    </span>
    {children}
  </label>
);

const getType = (question, questionType) => {
  const type = questionType(question);

  if (type === "truefalse" || type === "TRUE_FALSE") {
    return "truefalse";
  }

  if (type === "multiple" || type === "MULTIPLE_CHOICE") {
    return "multiple";
  }

  return "single";
};

const typeLabel = (type) => {
  if (type === "multiple") return "Răspuns multiplu";
  if (type === "truefalse") return "Adevărat sau fals";
  return "Un singur răspuns";
};

export default function Intrebari({
  form,
  set,
  onImportQuestions,
  onExportQuestions,
  onPreview,
  newId,
  setSelectedQuestionId,
  addQuestion,
  selectedIndex,
  setDraggedQuestion,
  draggedQuestion,
  reorderQuestion,
  questionType,
  questionValid,
  duplicateQuestion,
  questionCounts,
  selectedQuestion,
  updateQuestion,
  changeQuestionType,
  setCorrectAnswer,
  showExplanation,
  setShowExplanation,
  removeQuestion,
}) {
  const [menuId, setMenuId] = useState(null);
  const [draggedAnswer, setDraggedAnswer] = useState(null);

  const questions = form.questions || [];
  const total = questions.length;

  const currentType = selectedQuestion ? getType(selectedQuestion, questionType) : "single";

  const counts = {
    single: 0,
    multiple: 0,
    truefalse: 0,
  };

  questions.forEach((question) => {
    const type = getType(question, questionType);
    counts[type] += 1;
  });

  const changeType = (type) => {
    if (!selectedQuestion) return;

    if (type === "truefalse") {
      const previousAnswers = selectedQuestion.answers || [];

      const selectedCorrect = previousAnswers.find((answer) => answer.correct);

      const selectedText = selectedCorrect?.text?.trim().toLowerCase();

      const answers = TRUE_FALSE_ANSWERS.map((answer) => ({
        ...answer,
        correct: selectedText === answer.text.toLowerCase(),
      }));

      updateQuestion(selectedIndex, {
        type: "truefalse",
        answers,
      });

      return;
    }

    const existingAnswers = selectedQuestion.answers || [];

    let answers = existingAnswers.map((answer) => ({
      ...answer,
    }));

    if (answers.length < 2) {
      answers = [
        { text: "", correct: false },
        { text: "", correct: false },
      ];
    }

    if (currentType === "truefalse") {
      answers = [
        { text: "", correct: false },
        { text: "", correct: false },
      ];
    }

    if (type === "single") {
      let foundCorrect = false;

      answers = answers.map((answer) => {
        if (answer.correct && !foundCorrect) {
          foundCorrect = true;
          return answer;
        }

        return {
          ...answer,
          correct: false,
        };
      });
    }

    updateQuestion(selectedIndex, {
      type,
      answers,
    });
  };

  const selectCorrect = (index) => {
    if (!selectedQuestion) return;

    if (currentType === "truefalse") {
      updateQuestion(selectedIndex, {
        answers: TRUE_FALSE_ANSWERS.map((answer, i) => ({
          ...answer,
          correct: i === index,
        })),
      });

      return;
    }

    setCorrectAnswer(selectedIndex, index);
  };

  const reorderAnswers = (from, to) => {
    if (!selectedQuestion || currentType === "truefalse" || from === to || from < 0 || to < 0) {
      return;
    }

    const answers = [...(selectedQuestion.answers || [])];

    if (from >= answers.length || to >= answers.length) {
      return;
    }

    answers.splice(to, 0, answers.splice(from, 1)[0]);

    updateQuestion(selectedIndex, { answers });
  };

  const addAnswer = () => {
    if (!selectedQuestion || currentType === "truefalse") {
      return;
    }

    const answers = [...(selectedQuestion.answers || []), { text: "", correct: false }];

    if (answers.length > 12) return;

    updateQuestion(selectedIndex, { answers });
  };

  const removeAnswer = (index) => {
    if (!selectedQuestion || currentType === "truefalse") {
      return;
    }

    const answers = selectedQuestion.answers || [];

    if (answers.length <= 2) return;

    updateQuestion(selectedIndex, {
      answers: answers.filter((_, i) => i !== index),
    });
  };

  const updateAnswerText = (index, text) => {
    if (!selectedQuestion || currentType === "truefalse") {
      return;
    }

    updateQuestion(selectedIndex, {
      answers: (selectedQuestion.answers || []).map((answer, i) =>
        i === index ? { ...answer, text } : answer,
      ),
    });
  };

  const displayedAnswers =
    currentType === "truefalse"
      ? TRUE_FALSE_ANSWERS.map((answer, index) => ({
          ...answer,
          correct: selectedQuestion?.answers?.[index]?.correct === true,
        }))
      : selectedQuestion?.answers || [];

  const isQuestionValid = (question) => {
    const type = getType(question, questionType);

    if (type === "truefalse") {
      const answers = question.answers || [];

      return (
        Boolean(question.text?.trim()) &&
        Number(question.points) > 0 &&
        answers.length === 2 &&
        answers[0]?.text === "Adevărat" &&
        answers[1]?.text === "Fals" &&
        answers.filter((answer) => answer.correct).length === 1
      );
    }

    return questionValid(question);
  };

  return (
    <section className="pte-questions-workspace">
      <div className="pte-questions-toolbar">
        <div className="pte-questions-title">
          <span className="pte-section-icon pte-section-icon-blue">
            <SlidersHorizontal size={27} />
          </span>

          <div>
            <h2>Întrebări ({total})</h2>
            <p>Gestionează întrebările testului.</p>
          </div>
        </div>

        <div className="pte-questions-actions">
          <button
            type="button"
            className="pte-btn pte-btn-light"
            disabled={!onImportQuestions}
            onClick={() =>
              onImportQuestions?.(questions, (imported) => {
                if (!Array.isArray(imported)) return;

                set(
                  "questions",
                  imported.map((question) => ({
                    ...question,
                    id: question.id || newId(),
                  })),
                );

                setSelectedQuestionId(null);
              })
            }
          >
            <Download size={17} />
            Importă întrebări
          </button>

          <button
            type="button"
            className="pte-btn pte-btn-light"
            disabled={!onExportQuestions}
            onClick={() => onExportQuestions?.(questions)}
          >
            <Download size={17} />
            Export (Excel)
          </button>

          <button
            type="button"
            className="pte-btn pte-btn-light"
            disabled={!onPreview}
            onClick={() => onPreview?.(form)}
          >
            <Play size={17} />
            Previzualizare test
          </button>

          <button type="button" className="pte-btn pte-btn-primary" onClick={addQuestion}>
            <Plus size={18} />
            Adaugă întrebare
          </button>
        </div>
      </div>

      <div className="pte-questions-columns">
        <div className="pte-questions-left">
          <div className="pte-question-list" aria-label="Lista întrebărilor">
            {total === 0 && (
              <p className="pte-empty">Nu ai adăugat încă întrebări. Apasă „Adaugă întrebare”.</p>
            )}

            {questions.map((question, index) => {
              const type = getType(question, questionType);
              const menuKey = question.id ?? index;

              return (
                <div
                  key={menuKey}
                  className={`pte-question-list-item ${
                    selectedIndex === index ? "is-selected" : ""
                  }`}
                  draggable
                  onDragStart={() => setDraggedQuestion(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();

                    if (draggedQuestion !== null) {
                      reorderQuestion(draggedQuestion, index);
                    }

                    setDraggedQuestion(null);
                  }}
                  onDragEnd={() => setDraggedQuestion(null)}
                >
                  <GripVertical
                    size={17}
                    className="pte-drag-icon"
                    aria-label="Trage pentru reordonare"
                  />

                  <button
                    type="button"
                    className="pte-question-select"
                    onClick={() => setSelectedQuestionId(question.id)}
                  >
                    <span className="pte-question-number">{index + 1}</span>

                    <span className="pte-question-list-text">
                      {question.text?.trim() || "Întrebare fără text"}
                    </span>

                    <span className="pte-question-type-badge">{typeLabel(type)}</span>

                    <span className="pte-question-points">{question.points ?? 1} pct</span>

                    {isQuestionValid(question) ? (
                      <CheckCircle2 className="pte-valid-icon" size={19} />
                    ) : (
                      <AlertCircle className="pte-invalid-icon" size={19} />
                    )}
                  </button>

                  <div className="pte-question-menu-wrap">
                    <button
                      type="button"
                      className="pte-icon-button pte-question-menu-trigger"
                      aria-label={`Acțiuni pentru întrebarea ${index + 1}`}
                      aria-expanded={menuId === menuKey}
                      onClick={() => setMenuId(menuId === menuKey ? null : menuKey)}
                    >
                      <MoreHorizontal size={19} />
                    </button>

                    {menuId === menuKey && (
                      <div className="pte-question-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuestionId(question.id);
                            setMenuId(null);
                          }}
                        >
                          <Pencil size={15} />
                          Editează
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            duplicateQuestion(index);
                            setMenuId(null);
                          }}
                        >
                          <Copy size={15} />
                          Duplică
                        </button>

                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => {
                            removeQuestion(index);
                            setMenuId(null);
                          }}
                        >
                          <Trash2 size={15} />
                          Șterge
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <section className="pte-question-stats">
            <h3>
              <BarChart3 size={23} />
              Statistici întrebări
            </h3>

            <div className="pte-question-stats-content">
              <div
                className="pte-stats-donut"
                style={{
                  "--single": `${total ? (counts.single / total) * 100 : 0}%`,
                  "--multiple": `${total ? ((counts.single + counts.multiple) / total) * 100 : 0}%`,
                  "--truefalse": `${total ? ((counts.single + counts.multiple + counts.truefalse) / total) * 100 : 0}%`,
                }}
              >
                <div>
                  <strong>{total}</strong>
                  <span>Întrebări</span>
                </div>
              </div>

              <div className="pte-stats-legend">
                {[
                  ["single", "Un singur răspuns"],
                  ["multiple", "Răspuns multiplu"],
                  ["truefalse", "Adevărat sau fals"],
                ].map(([key, label]) => {
                  const count = counts[key];

                  const percentage = total ? Math.round((count / total) * 100) : 0;

                  return (
                    <div key={key}>
                      <span className={`pte-dot ${key}`} />

                      {label}

                      <strong>
                        {count} ({percentage}%)
                      </strong>
                    </div>
                  );
                })}

                <div className="pte-stats-total">
                  Total <strong>{total}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="pte-question-editor">
          {!selectedQuestion ? (
            <p className="pte-empty">Selectează o întrebare din listă sau adaugă una nouă.</p>
          ) : (
            <>
              <div className="pte-question-editor-head">
                <h3>
                  <Pencil size={23} />
                  Editează întrebarea
                </h3>

                <div>
                  <span>
                    Întrebarea {selectedIndex + 1} din {total}
                  </span>

                  <button
                    type="button"
                    className="pte-icon-button"
                    disabled={selectedIndex === 0}
                    onClick={() => setSelectedQuestionId(questions[selectedIndex - 1].id)}
                    aria-label="Întrebarea anterioară"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    className="pte-icon-button"
                    disabled={selectedIndex === total - 1}
                    onClick={() => setSelectedQuestionId(questions[selectedIndex + 1].id)}
                    aria-label="Întrebarea următoare"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <Field label="Textul întrebării" required>
                <textarea
                  rows={2}
                  value={selectedQuestion.text || ""}
                  onChange={(event) =>
                    updateQuestion(selectedIndex, {
                      text: event.target.value,
                    })
                  }
                  placeholder="Introdu textul întrebării..."
                />
              </Field>

              <div className="pte-fields two">
                <Field label="Tipul răspunsului">
                  <select value={currentType} onChange={(event) => changeType(event.target.value)}>
                    <option value="single">Un singur răspuns</option>

                    <option value="multiple">Răspuns multiplu</option>

                    <option value="truefalse">Adevărat sau fals</option>
                  </select>
                </Field>

                <Field label="Punctaj" required>
                  <input
                    type="number"
                    min="0.1"
                    max="1000"
                    step="0.5"
                    value={selectedQuestion.points ?? 1}
                    onChange={(event) =>
                      updateQuestion(selectedIndex, {
                        points: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>

              <div className="pte-answer-editor">
                <h4>
                  {currentType === "truefalse"
                    ? "Selectează răspunsul corect"
                    : "Variante de răspuns"}{" "}
                  <b>*</b>
                </h4>

                {displayedAnswers.map((answer, index) => (
                  <div
                    key={index}
                    className={`pte-answer-option ${answer.correct ? "is-correct" : ""}`}
                  >
                    <span
                      className="pte-answer-grip"
                      draggable={currentType !== "truefalse"}
                      onDragStart={(event) => {
                        if (currentType === "truefalse") {
                          event.preventDefault();
                          return;
                        }

                        event.stopPropagation();
                        setDraggedAnswer(index);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        if (draggedAnswer !== null) {
                          reorderAnswers(draggedAnswer, index);
                        }

                        setDraggedAnswer(null);
                      }}
                      onDragEnd={() => setDraggedAnswer(null)}
                      title={
                        currentType === "truefalse" ? "Ordine fixă" : "Trage pentru reordonare"
                      }
                    >
                      <GripVertical size={16} className="pte-drag-icon" />
                    </span>

                    <input
                      type={currentType === "multiple" ? "checkbox" : "radio"}
                      name={`correct-${selectedQuestion.id ?? selectedIndex}`}
                      checked={!!answer.correct}
                      onChange={() => selectCorrect(index)}
                      aria-label={`Răspuns corect: ${answer.text || `varianta ${index + 1}`}`}
                    />

                    <input
                      className="pte-answer-text"
                      value={answer.text || ""}
                      readOnly={currentType === "truefalse"}
                      onChange={(event) => updateAnswerText(index, event.target.value)}
                      placeholder={`Varianta ${index + 1}`}
                    />

                    {answer.correct && <span className="pte-correct-label">Răspuns corect</span>}

                    {currentType !== "truefalse" && (
                      <button
                        type="button"
                        className="pte-icon-button pte-danger-icon"
                        disabled={displayedAnswers.length <= 2}
                        aria-label={`Șterge varianta ${index + 1}`}
                        onClick={() => removeAnswer(index)}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                ))}

                {currentType !== "truefalse" && (
                  <button
                    type="button"
                    className="pte-add-answer"
                    disabled={displayedAnswers.length >= 12}
                    onClick={addAnswer}
                  >
                    <Plus size={18} />
                    Adaugă variantă de răspuns
                  </button>
                )}
              </div>

              <div className="pte-explanation">
                <button
                  type="button"
                  className="pte-explanation-toggle"
                  onClick={() => setShowExplanation((value) => !value)}
                >
                  <HelpCircle size={18} />
                  Explicație (opțional)
                  <ChevronRight size={18} className={showExplanation ? "is-open" : ""} />
                </button>

                {showExplanation && (
                  <textarea
                    rows={2}
                    value={selectedQuestion.explanation || ""}
                    onChange={(event) =>
                      updateQuestion(selectedIndex, {
                        explanation: event.target.value,
                      })
                    }
                    placeholder="Explică răspunsul corect..."
                  />
                )}
              </div>

              <div className="pte-question-editor-footer">
                <button
                  type="button"
                  className="pte-btn pte-btn-light"
                  onClick={() => duplicateQuestion(selectedIndex)}
                >
                  <Copy size={17} />
                  Duplică întrebarea
                </button>

                <button
                  type="button"
                  className="pte-btn pte-btn-danger"
                  onClick={() => removeQuestion(selectedIndex)}
                >
                  <Trash2 size={17} />
                  Șterge întrebarea
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
