import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileUp,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  previewTestQuestionsImport,
  confirmTestQuestionsImport,
} from "../services/professionalTestingService";
import "./ImportTestQuestions.css";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = ".docx,.xlsx,.csv,.txt,.json,.pdf";
const errorMessage = (e) => e?.response?.data?.message || e?.message || "Operațiunea nu a reușit.";
const normalized = (q) => ({
  question_type: q?.question_type || "SINGLE_CHOICE",
  question_text: String(q?.question_text ?? ""),
  points: q?.points ?? 1,
  explanation: q?.explanation ?? "",
  legal_reference: q?.legal_reference ?? "",
  options: Array.isArray(q?.options)
    ? q.options.map((o) => ({
        option_text: String(o?.option_text ?? ""),
        is_correct: o?.is_correct === true,
      }))
    : [],
});
const validate = (q) => {
  const errors = [];
  const text = String(q.question_text || "").trim();
  const pts = Number(q.points);
  const opts = q.options || [];
  const count = opts.filter((o) => o.is_correct).length;
  if (!text || text.length > 10000) errors.push("Completează enunțul (maximum 10.000 caractere).");
  if (!Number.isFinite(pts) || pts <= 0 || pts > 1000)
    errors.push("Punctajul trebuie să fie între 0 și 1.000 (exclusiv 0).");
  if (
    opts.length < 2 ||
    opts.length > 12 ||
    opts.some((o) => !o.option_text.trim() || o.option_text.trim().length > 5000)
  )
    errors.push("Sunt necesare 2–12 variante completate.");
  if (count < 1 || (q.question_type !== "MULTIPLE_CHOICE" && count !== 1))
    errors.push("Selectează răspunsul/răspunsurile corecte.");
  if (q.question_type === "TRUE_FALSE" && opts.length !== 2)
    errors.push("Adevărat/Fals necesită exact două variante.");
  if (!["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(q.question_type))
    errors.push("Tipul întrebării este invalid.");
  return errors;
};

export default function ImportTestQuestions({ versionId, onImported }) {
  const [opened, setOpened] = useState(false);
  const [filename, setFilename] = useState("");
  const [questions, setQuestions] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = useMemo(() => questions.map(validate), [questions]);
  const validCount = errors.filter((e) => !e.length).length;
  const busy = previewing || saving;
  const clear = () => {
    setQuestions([]);
    setFilename("");
    setExpanded({});
  };

  const onDrop = useCallback(
    async (accepted, rejected) => {
      if (rejected.length) {
        toast.error(
          rejected[0]?.errors?.[0]?.code === "file-too-large"
            ? "Fișierul depășește 5 MB."
            : "Format neacceptat. Alege DOCX, XLSX, CSV, TXT, JSON sau PDF.",
        );
        return;
      }
      const file = accepted[0];
      if (!file || busy) return;
      clear();
      setPreviewing(true);
      try {
        const result = await previewTestQuestionsImport(versionId, file);
        const parsed = (result.questions || []).map(normalized);
        setFilename(file.name);
        setQuestions(parsed);
        setExpanded(parsed.length ? { 0: true } : {});
        if (parsed.length)
          toast.success(`${parsed.length} întrebări extrase. Verifică-le înainte de salvare.`);
        else toast.error("Documentul nu conține întrebări recunoscute.");
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setPreviewing(false);
      }
    },
    [versionId, busy],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    multiple: false,
    maxSize: MAX_SIZE,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "text/plain": [".txt"],
      "application/json": [".json"],
      "application/pdf": [".pdf"],
      "application/octet-stream": [".docx", ".xlsx", ".csv", ".txt", ".json", ".pdf"],
    },
    disabled: busy,
  });
  const update = (index, patch) =>
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const updateOption = (qi, oi, patch) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qi
          ? q
          : { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) },
      ),
    );
  const choose = (qi, oi, checked) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qi
          ? q
          : {
              ...q,
              options: q.options.map((o, j) => ({
                ...o,
                is_correct:
                  q.question_type === "MULTIPLE_CHOICE"
                    ? j === oi
                      ? checked
                      : o.is_correct
                    : j === oi,
              })),
            },
      ),
    );
  const changeType = (i, type) =>
    setQuestions((prev) =>
      prev.map((q, j) =>
        j !== i
          ? q
          : {
              ...q,
              question_type: type,
              options:
                type === "TRUE_FALSE"
                  ? [
                      { option_text: "Adevărat", is_correct: true },
                      { option_text: "Fals", is_correct: false },
                    ]
                  : q.options.map((o, k) => ({ ...o, is_correct: k === 0 })),
            },
      ),
    );
  const confirm = async () => {
    if (busy || !questions.length || validCount !== questions.length) {
      toast.error("Corectează întrebările invalide înainte de import.");
      return;
    }
    const result = await Swal.fire({
      title: "Confirmi importul?",
      text: `Vor fi adăugate ${questions.length} întrebări la versiunea DRAFT.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Importă întrebările",
      cancelButtonText: "Anulează",
      confirmButtonColor: "#1674df",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setSaving(true);
    try {
      const response = await confirmTestQuestionsImport(versionId, questions);
      toast.success(`${response.imported ?? questions.length} întrebări importate cu succes.`);
      clear();
      setOpened(false);
      await onImported?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pti-panel" aria-label="Import întrebări din document">
      <div className="pti-header">
        <div className="pti-header-title">
          <span className="pti-icon">
            <FileUp size={20} />
          </span>
          <div>
            <h2>Importă întrebări din document</h2>
            <p>Extrage, verifică și corectează întrebările înainte de salvare.</p>
          </div>
        </div>
        <button
          type="button"
          className="pte-btn pte-btn-light"
          onClick={() => setOpened((v) => !v)}
          aria-expanded={opened}
          disabled={busy}
        >
          {opened ? <ChevronUp size={17} /> : <ChevronDown size={17} />}{" "}
          {opened ? "Închide" : "Importă întrebări"}
        </button>
      </div>
      {opened && (
        <div className="pti-content">
          <div {...getRootProps({ className: `pti-drop ${isDragActive ? "pti-drag" : ""}` })}>
            <input {...getInputProps({ accept: TYPES })} />
            <FileUp size={28} />
            <strong>
              {isDragActive
                ? "Eliberează documentul aici"
                : "Trage documentul aici sau selectează-l"}
            </strong>
            <span>DOCX, XLSX, CSV, TXT, JSON, PDF cu text · Maximum 5 MB</span>
            <button
              type="button"
              className="pte-btn pte-btn-primary"
              onClick={open}
              disabled={busy}
            >
              {previewing ? <LoaderCircle className="pte-spin" size={16} /> : <FileUp size={16} />}{" "}
              {previewing ? "Se analizează..." : "Alege document"}
            </button>
          </div>
          <p className="pti-help">
            <AlertCircle size={15} /> Documentele scanate fără text selectabil necesită OCR.
            Formatul DOC și XLS vechi nu este acceptat de backendul actual.
          </p>
          {filename && (
            <div className="pti-file">
              <span>
                <CheckCircle2 size={17} /> {filename}
              </span>
              <button
                type="button"
                className="pti-icon-btn"
                aria-label="Elimină documentul și previzualizarea"
                onClick={clear}
                disabled={busy}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {!!questions.length && (
            <>
              <div className="pti-summary">
                <strong>Previzualizare · {questions.length} întrebări</strong>
                <span className={validCount === questions.length ? "pti-valid" : "pti-invalid"}>
                  {validCount} valide · {questions.length - validCount} de corectat
                </span>
              </div>
              <div className="pti-list">
                {questions.map((q, i) => (
                  <article className="pti-question" key={i}>
                    <div className="pti-question-head">
                      <button
                        type="button"
                        onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
                        aria-expanded={!!expanded[i]}
                      >
                        <span>
                          {i + 1}. {q.question_text || "Întrebare fără enunț"}
                        </span>
                        {expanded[i] ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                      </button>
                      <span className={errors[i].length ? "pti-invalid" : "pti-valid"}>
                        {errors[i].length ? "Necesită corectare" : "Validă"}
                      </span>
                      <button
                        type="button"
                        className="pti-icon-btn"
                        aria-label={`Elimină întrebarea ${i + 1}`}
                        onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))}
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {!!expanded[i] && (
                      <div className="pti-fields">
                        <label>
                          Enunț
                          <textarea
                            rows={2}
                            value={q.question_text}
                            onChange={(e) => update(i, { question_text: e.target.value })}
                            disabled={busy}
                          />
                        </label>
                        <div className="pti-grid">
                          <label>
                            Tipul întrebării
                            <select
                              value={q.question_type}
                              onChange={(e) => changeType(i, e.target.value)}
                              disabled={busy}
                            >
                              <option value="SINGLE_CHOICE">Răspuns unic</option>
                              <option value="MULTIPLE_CHOICE">Răspuns multiplu</option>
                              <option value="TRUE_FALSE">Adevărat / Fals</option>
                            </select>
                          </label>
                          <label>
                            Punctaj
                            <input
                              type="number"
                              min="0.01"
                              max="1000"
                              step="0.01"
                              value={q.points}
                              onChange={(e) => update(i, { points: e.target.value })}
                              disabled={busy}
                            />
                          </label>
                        </div>
                        <strong>Variante de răspuns</strong>
                        {q.options.map((o, oi) => (
                          <div className="pti-option" key={oi}>
                            <input
                              aria-label={`Varianta ${oi + 1}`}
                              value={o.option_text}
                              onChange={(e) => updateOption(i, oi, { option_text: e.target.value })}
                              disabled={busy}
                            />
                            <label className="pti-correct">
                              <input
                                type={q.question_type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                                name={`pti-correct-${i}`}
                                checked={o.is_correct}
                                onChange={(e) => choose(i, oi, e.target.checked)}
                                disabled={busy}
                              />{" "}
                              Corect
                            </label>
                            {q.question_type !== "TRUE_FALSE" && q.options.length > 2 && (
                              <button
                                type="button"
                                className="pti-icon-btn"
                                aria-label={`Șterge varianta ${oi + 1}`}
                                onClick={() =>
                                  update(i, { options: q.options.filter((_, j) => j !== oi) })
                                }
                                disabled={busy}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                        {q.question_type !== "TRUE_FALSE" && q.options.length < 12 && (
                          <button
                            type="button"
                            className="pte-btn pte-btn-light"
                            onClick={() =>
                              update(i, {
                                options: [...q.options, { option_text: "", is_correct: false }],
                              })
                            }
                            disabled={busy}
                          >
                            <Plus size={15} /> Adaugă variantă
                          </button>
                        )}
                        <div className="pti-grid">
                          <label>
                            Explicație (opțional)
                            <textarea
                              rows={2}
                              value={q.explanation}
                              onChange={(e) => update(i, { explanation: e.target.value })}
                              disabled={busy}
                            />
                          </label>
                          <label>
                            Referință legală (opțional)
                            <input
                              value={q.legal_reference}
                              onChange={(e) => update(i, { legal_reference: e.target.value })}
                              disabled={busy}
                            />
                          </label>
                        </div>
                        {!!errors[i].length && (
                          <div className="pti-errors" role="alert">
                            {errors[i].map((error, j) => (
                              <p key={j}>
                                <AlertCircle size={14} /> {error}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <div className="pti-footer">
                <span>Importul se realizează numai după confirmare.</span>
                <button
                  type="button"
                  className="pte-btn pte-btn-primary"
                  disabled={busy || validCount !== questions.length}
                  onClick={confirm}
                >
                  {saving ? (
                    <LoaderCircle className="pte-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}{" "}
                  {saving ? "Se salvează..." : `Confirmă importul (${questions.length})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
