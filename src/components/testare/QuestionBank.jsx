import React, { useEffect, useState, useRef } from "react";
import {
  Database,
  Search,
  Plus,
  Download,
  Upload,
  Archive,
  Pencil,
  RefreshCw,
  Layers3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  BookOpen,
  ListChecks,
  Eye,
  Shuffle,
  Save,
} from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import api from "../../services/api";
import "./QuestionBank.css";
import { questionKey, bankPayload, validBankPayload } from "./questionBankUtils";
const endpoint = "/testare/banca";
const blank = () => ({
  type: "single",
  text: "",
  points: 1,
  explanation: "",
  legalReference: "",
  answers: [
    { text: "", correct: true },
    { text: "", correct: false },
  ],
});
const message = (e) => e?.response?.data?.message || e?.message || "Operația a eșuat.";
export default function QuestionBank({ currentQuestions = [], category = "", onAdd }) {
  const [open, setOpen] = useState(!onAdd),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState(""),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(1),
    [data, setData] = useState({ items: [], total: 0, categories: [] }),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [expanded, setExpanded] = useState({}),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [editing, setEditing] = useState(null),
    [picked, setPicked] = useState({}),
    [counts, setCounts] = useState({}),
    [reload, setReload] = useState(0);
  const rootRef = useRef(null);
  const editRef = useRef(null);
  const draftKeys = new Set(currentQuestions.map(questionKey));
  const inDraft = (item) => draftKeys.has(questionKey(item.question));
  const transfer = (items) => {
    const seen = new Set(draftKeys);
    const fresh = items.filter((q) => {
      const key = questionKey(q);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) onAdd(fresh.map((q) => ({ ...structuredClone(q), bankSource: true })));
    setPicked({});
    if (fresh.length) toast.success(`${fresh.length} întrebări adăugate în ciornă.`);
    if (items.length > fresh.length) toast.info(`${items.length - fresh.length} duplicate omise.`);
  };
  useEffect(() => {
    const refresh = () => setReload((n) => n + 1);
    window.addEventListener("border:question-bank-updated", refresh);
    return () => window.removeEventListener("border:question-bank-updated", refresh);
  }, []);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    setLoadError("");
    const timer = setTimeout(async () => {
      try {
        const { data: d } = await api.get(endpoint, {
          params: { q, category: filter, archived, page },
        });
        if (live) {
          setData(d);
          const last = Math.max(1, Math.ceil(d.total / 50));
          if (page > last) setPage(last);
          setError("");
        }
      } catch (e) {
        if (live) setLoadError(message(e));
      } finally {
        if (live) setLoading(false);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, q, filter, archived, page, reload]);
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      setReload((n) => n + 1);
    } catch (e) {
      setError(message(e));
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const question = editing.question;
      if (!editing.category.trim() || !question.text.trim())
        throw new Error("Completează categoria și textul întrebării.");
      if (
        !Number.isFinite(Number(question.points)) ||
        Number(question.points) <= 0 ||
        Number(question.points) > 1000
      )
        throw new Error("Punctajul trebuie să fie între 0 și 1000 (exclusiv 0).");
      if (
        question.answers.some((a) => !a.text.trim()) ||
        !question.answers.some((a) => a.correct) ||
        (question.type !== "multiple" && question.answers.filter((a) => a.correct).length !== 1)
      )
        throw new Error("Completează variantele și marchează răspunsurile corecte.");
      const payload = {
        category: editing.category.trim(),
        question: { ...question, points: Number(question.points) },
      };
      if (editing.id) await api.patch(`${endpoint}/${editing.id}`, payload);
      else await api.post(endpoint, payload);
      setEditing(null);
      setPage(1);
      toast.success("Întrebarea a fost salvată.");
    });
  useEffect(() => {
    if (editing) editRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [editing?.id, Boolean(editing)]);
  const change = (key, value) =>
    setEditing((e) => ({ ...e, question: { ...e.question, [key]: value } }));
  const archive = (item) =>
    run(async () => {
      const result = await Swal.fire({
        title: item.archived_at ? "Reactivezi întrebarea?" : "Arhivezi întrebarea?",
        text: "Testele deja create nu sunt afectate.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Confirmă",
        cancelButtonText: "Anulează",
      });
      if (!result.isConfirmed) return;
      await api.post(`${endpoint}/${item.id}/archive`, { archived: !item.archived_at });
      setPicked({});
      toast.success(
        item.archived_at ? "Întrebarea a fost reactivată." : "Întrebarea a fost arhivată.",
      );
    });
  const copyCurrent = () =>
    run(async () => {
      const items = currentQuestions.map((q) => bankPayload(q, category)).filter(validBankPayload);
      if (!items.length) throw new Error("Completează categoria și cel puțin o întrebare validă.");
      if (items.length > 100) throw new Error("Maximum 100 de întrebări valide per operațiune.");
      const result = await Swal.fire({
        title: "Salvezi întrebările în bancă?",
        text: `${items.length} întrebări valide; ${currentQuestions.length - items.length} incomplete vor fi omise. Duplicatele din aceeași categorie vor fi omise.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Salvează",
        cancelButtonText: "Anulează",
      });
      if (!result.isConfirmed) return;
      const { data: r } = await api.post(endpoint, { items, skipDuplicates: true });
      toast.success(`${r.added} salvate; ${r.skipped ?? 0} duplicate omise.`);
    });
  const importFile = (file) =>
    run(async () => {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) throw new Error("Fișierul depășește 2 MB.");
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || !parsed.length || parsed.length > 100)
        throw new Error("Este necesară o listă JSON cu 1–100 elemente, cu category și question.");
      const { data: r } = await api.post(endpoint, { items: parsed, skipDuplicates: true });
      toast.success(`${r.added} importate; ${r.skipped ?? 0} duplicate omise.`);
    });
  const exportPage = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            data.items.map(({ category, question }) => ({ category, question })),
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "BORDER-banca-pagina.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectRandom = () =>
    run(async () => {
      const selections = Object.entries(counts)
        .filter(([, n]) => Number(n) > 0)
        .map(([category, count]) => ({ category, count: Number(count) }));
      if (
        selections.length > 30 ||
        selections.reduce((sum, x) => sum + x.count, 0) > 100 ||
        selections.some(
          (x) =>
            !Number.isInteger(x.count) ||
            x.count > Number(data.categories.find((c) => c.category === x.category)?.count || 0),
        )
      )
        throw new Error(
          "Selectează maximum 100 de întrebări disponibile, din cel mult 30 de categorii.",
        );
      const { data: r } = await api.post(`${endpoint}/sample`, { selections });
      transfer(r.questions);
      setCounts({});
    });
  const selected = Object.values(picked);
  const activeTotal = data.categories.reduce((n, c) => n + Number(c.count || 0), 0);
  const types = {
    single: "Un singur răspuns",
    multiple: "Răspuns multiplu",
    truefalse: "Adevărat / Fals",
  };
  const randomTotal = Object.values(counts).reduce((n, v) => n + (Number(v) || 0), 0);
  const togglePage = () =>
    setPicked((old) => {
      const next = { ...old };
      const eligible = data.items.filter((item) => !inDraft(item));
      const all = eligible.every((item) => !!old[item.id]);
      for (const item of eligible) {
        if (all) delete next[item.id];
        else next[item.id] = item.question;
      }
      return next;
    });
  return (
    <section
      ref={rootRef}
      className={`pt-bank ${onAdd ? "pt-bank-embedded" : ""}`}
      id={onAdd ? "pte-bank-transfer" : undefined}
    >
      <header className="pt-bank-header">
        <div className="pt-bank-heading">
          <span className="pt-bank-emblem">
            <Database size={26} />
          </span>
          <div>
            <h3>Banca globală de întrebări</h3>
            <p>Organizează și reutilizează întrebările profesionale în orice test.</p>
          </div>
        </div>
        {onAdd && (
          <button type="button" onClick={() => setOpen((v) => !v)}>
            {open ? "Restrânge biblioteca" : "Preia din bancă"}
          </button>
        )}
      </header>
      {onAdd && (
        <div className="pt-bank-bridge">
          <span>
            <ListChecks size={17} /> {currentQuestions.length} întrebări în ciornă
          </span>
          <button
            type="button"
            disabled={
              busy || !currentQuestions.some((q) => validBankPayload(bankPayload(q, category)))
            }
            onClick={copyCurrent}
          >
            <Save size={16} /> Salvează în bancă
          </button>
          <small>Transferul creează copii independente.</small>
        </div>
      )}
      {open && (
        <>
          <div className="pt-bank-metrics">
            <div>
              <span className="pt-bank-metric-icon">
                <Database size={21} />
              </span>
              <div>
                <small>Întrebări active</small>
                <strong>{loading ? "—" : activeTotal}</strong>
              </div>
            </div>
            <div>
              <span className="pt-bank-metric-icon violet">
                <Layers3 size={21} />
              </span>
              <div>
                <small>Categorii active</small>
                <strong>{loading ? "—" : data.categories.length}</strong>
              </div>
            </div>
            <div>
              <span className="pt-bank-metric-icon green">
                <ListChecks size={21} />
              </span>
              <div>
                <small>{onAdd ? "Selectate" : "Rezultate găsite"}</small>
                <strong>{onAdd ? selected.length : loading ? "—" : data.total}</strong>
              </div>
            </div>
          </div>
          <div className="pt-bank-tools pt-bank-actions">
            <button
              className="pt-bank-primary"
              type="button"
              disabled={busy}
              onClick={() => setEditing({ category: category || filter, question: blank() })}
            >
              <Plus size={18} /> Adaugă întrebare
            </button>
            <label className="pt-bank-file">
              <Upload size={16} /> Import JSON
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void importFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={exportPage}
              disabled={loading || !!loadError || !data.items.length}
            >
              <Download size={16} /> Export pagina
            </button>
            <button
              type="button"
              onClick={() => setReload((n) => n + 1)}
              disabled={loading || busy}
            >
              <RefreshCw size={16} /> Actualizează
            </button>
          </div>
          {error && (
            <p role="alert" className="pt-bank-error">
              {error}
            </p>
          )}
          {editing && (
            <div
              ref={editRef}
              className="pt-bank-edit"
              role="region"
              aria-label="Formular întrebare"
            >
              <div className="pt-bank-edit-title">
                <h4>
                  <Pencil size={19} /> {editing.id ? "Editează întrebarea" : "Întrebare nouă"}
                </h4>
                <button
                  type="button"
                  aria-label="Închide formularul"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <label>
                Categorie
                <input
                  value={editing.category}
                  list="pt-bank-category-options"
                  placeholder="Ex. Legislație"
                  maxLength={100}
                  onChange={(e) => setEditing((x) => ({ ...x, category: e.target.value }))}
                />
              </label>
              <datalist id="pt-bank-category-options">
                {data.categories.map((c) => (
                  <option key={c.category} value={c.category} />
                ))}
              </datalist>
              <label>
                Întrebare
                <textarea
                  placeholder="Introdu textul întrebării..."
                  maxLength={10000}
                  value={editing.question.text}
                  onChange={(e) => change("text", e.target.value)}
                />
              </label>
              <div className="pt-bank-fields">
                <label>
                  Tip
                  <select
                    value={editing.question.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      setEditing((x) => ({
                        ...x,
                        question: {
                          ...x.question,
                          type,
                          answers:
                            type === "truefalse"
                              ? [
                                  { text: "Adevărat", correct: true },
                                  { text: "Fals", correct: false },
                                ]
                              : x.question.type === "truefalse"
                                ? blank().answers
                                : x.question.answers.map((a, i, all) => ({
                                    ...a,
                                    correct:
                                      type === "multiple"
                                        ? a.correct
                                        : i ===
                                          Math.max(
                                            0,
                                            all.findIndex((v) => v.correct),
                                          ),
                                  })),
                        },
                      }));
                    }}
                  >
                    <option value="single">Un răspuns</option>
                    <option value="multiple">Multiplu</option>
                    <option value="truefalse">Adevărat / Fals</option>
                  </select>
                </label>
                <label>
                  Punctaj
                  <input
                    type="number"
                    min="0.01"
                    max="1000"
                    step="any"
                    value={editing.question.points}
                    onChange={(e) => change("points", e.target.value)}
                  />
                </label>
              </div>
              <div className="pt-bank-answer-heading">
                <strong>Variante de răspuns</strong>
                <small>Marchează răspunsul corect</small>
              </div>
              {editing.question.answers.map((a, i) => (
                <div className={`pt-bank-answer ${a.correct ? "is-correct" : ""}`} key={i}>
                  <input
                    aria-label={`Corect ${i + 1}`}
                    type={editing.question.type === "multiple" ? "checkbox" : "radio"}
                    name="pt-bank-correct"
                    checked={a.correct}
                    onChange={() =>
                      change(
                        "answers",
                        editing.question.answers.map((v, j) => ({
                          ...v,
                          correct:
                            editing.question.type === "multiple"
                              ? j === i
                                ? !v.correct
                                : v.correct
                              : j === i,
                        })),
                      )
                    }
                  />
                  <input
                    aria-label={`Variantă ${i + 1}`}
                    placeholder={`Varianta ${i + 1}`}
                    maxLength={5000}
                    readOnly={editing.question.type === "truefalse"}
                    value={a.text}
                    onChange={(e) =>
                      change(
                        "answers",
                        editing.question.answers.map((v, j) =>
                          j === i ? { ...v, text: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  {editing.question.type !== "truefalse" && editing.question.answers.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        change(
                          "answers",
                          editing.question.answers.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {editing.question.type !== "truefalse" && editing.question.answers.length < 12 && (
                <button
                  type="button"
                  onClick={() =>
                    change("answers", [...editing.question.answers, { text: "", correct: false }])
                  }
                >
                  <Plus size={16} /> Adaugă variantă
                </button>
              )}
              <label>
                Explicație
                <textarea
                  value={editing.question.explanation || ""}
                  onChange={(e) => change("explanation", e.target.value)}
                />
              </label>
              <label>
                Referință juridică
                <input
                  value={editing.question.legalReference || ""}
                  onChange={(e) => change("legalReference", e.target.value)}
                />
              </label>
              <div className="pt-bank-tools pt-bank-edit-footer">
                <button className="pt-bank-primary" type="button" disabled={busy} onClick={save}>
                  <Save size={16} /> Salvează
                </button>
                <button type="button" disabled={busy} onClick={() => setEditing(null)}>
                  Anulează
                </button>
              </div>
            </div>
          )}
          <div className="pt-bank-tools pt-bank-filters">
            <label className="pt-bank-search">
              <Search size={16} />
              <input
                placeholder="Caută întrebare sau referință..."
                aria-label="Caută întrebări"
                maxLength={120}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <select
              aria-label="Categorie"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Toate categoriile</option>
              {data.categories.map((c) => (
                <option key={c.category}>{c.category}</option>
              ))}
            </select>
            <label className="pt-bank-archive-toggle">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => {
                  setArchived(e.target.checked);
                  setPage(1);
                  setPicked({});
                }}
              />{" "}
              Arhivate
            </label>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFilter("");
                setArchived(false);
                setPage(1);
                setPicked({});
              }}
            >
              <X size={15} /> Resetează
            </button>
          </div>
          {onAdd && !archived && (
            <details className="pt-bank-random">
              <summary>
                <Shuffle size={18} /> Selecție aleatorie pe categorii{" "}
                <span>{randomTotal} selectate</span>
              </summary>
              <div className="pt-bank-random-grid">
                {data.categories.map((c) => (
                  <label key={c.category}>
                    {c.category} ({c.count})
                    <input
                      type="number"
                      min="0"
                      max={Math.min(100, c.count)}
                      value={counts[c.category] || ""}
                      onChange={(e) => setCounts((x) => ({ ...x, [c.category]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <button
                className="pt-bank-primary"
                type="button"
                disabled={busy || randomTotal <= 0 || randomTotal > 100}
                onClick={selectRandom}
              >
                Adaugă aleatoriu în test
              </button>
            </details>
          )}
          <div className="pt-bank-list-heading">
            <strong>{archived ? "Întrebări arhivate" : "Biblioteca de întrebări"}</strong>
            <span>{loading ? "Se încarcă…" : `${data.total} rezultate`}</span>
            {onAdd && !archived && !!data.items.length && (
              <button type="button" disabled={loading || busy} onClick={togglePage}>
                {data.items.filter((i) => !inDraft(i)).every((i) => picked[i.id])
                  ? "Deselectează pagina"
                  : "Selectează pagina"}
              </button>
            )}
          </div>
          <div className="pt-bank-list" aria-busy={loading}>
            {!loading &&
              !loadError &&
              data.items.map((item) => (
                <article key={item.id} className={picked[item.id] ? "is-selected" : ""}>
                  {onAdd && !archived && (
                    <input
                      aria-label="Selectează întrebarea"
                      type="checkbox"
                      disabled={inDraft(item) || busy}
                      checked={inDraft(item) || !!picked[item.id]}
                      onChange={(e) =>
                        setPicked((old) => {
                          const next = { ...old };
                          if (e.target.checked) next[item.id] = item.question;
                          else delete next[item.id];
                          return next;
                        })
                      }
                    />
                  )}
                  <div className="pt-bank-card-content">
                    <div className="pt-bank-tags">
                      <span>{item.category}</span>
                      <span>{types[item.question.type] || item.question.type}</span>
                      <span>{item.question.points} pct.</span>
                    </div>
                    <strong>{item.question.text}</strong>
                    {onAdd && inDraft(item) && (
                      <small className="pt-bank-in-draft">
                        <CheckCircle2 size={15} /> Deja în test
                      </small>
                    )}
                    {item.question.legalReference && (
                      <small>
                        <BookOpen size={14} /> {item.question.legalReference}
                      </small>
                    )}
                    {expanded[item.id] && (
                      <div className="pt-bank-preview">
                        {item.question.answers.map((a, i) => (
                          <div key={i} className={a.correct ? "is-correct" : ""}>
                            {a.correct ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <span className="pt-bank-letter">{String.fromCharCode(65 + i)}</span>
                            )}
                            {a.text}
                          </div>
                        ))}
                        {item.question.explanation && <p>{item.question.explanation}</p>}
                      </div>
                    )}
                  </div>
                  <div className="pt-bank-card-actions">
                    <button
                      type="button"
                      aria-expanded={!!expanded[item.id]}
                      onClick={() => setExpanded((old) => ({ ...old, [item.id]: !old[item.id] }))}
                    >
                      <Eye size={16} /> {expanded[item.id] ? "Ascunde" : "Detalii"}
                    </button>
                    {!item.archived_at && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setEditing({
                            category: item.category,
                            question: structuredClone(item.question),
                          })
                        }
                      >
                        <Copy size={16} /> Duplică
                      </button>
                    )}
                    {item.can_edit && !item.archived_at && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label="Editează"
                        onClick={() =>
                          setEditing({
                            id: item.id,
                            category: item.category,
                            question: item.question,
                          })
                        }
                      >
                        <Pencil size={16} /> Editează
                      </button>
                    )}
                    {item.can_edit && (
                      <button type="button" disabled={busy} onClick={() => archive(item)}>
                        <Archive size={16} /> {item.archived_at ? "Reactivează" : "Arhivează"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            {loading ? (
              <div className="pt-bank-empty">
                <RefreshCw size={28} />
                <strong>Se încarcă întrebările…</strong>
              </div>
            ) : loadError ? (
              <div className="pt-bank-empty">
                <strong>Nu s-au putut încărca datele.</strong>
                <p>{loadError}</p>
                <button type="button" onClick={() => setReload((n) => n + 1)}>
                  Încearcă din nou
                </button>
              </div>
            ) : (
              !data.items.length && (
                <div className="pt-bank-empty">
                  <span className="pt-bank-empty-icon">
                    <Database size={32} />
                  </span>
                  <h4>
                    {q || filter || archived ? "Niciun rezultat" : "Banca de întrebări este goală"}
                  </h4>
                  <p>
                    {q || filter || archived
                      ? "Modifică filtrele pentru a găsi întrebări."
                      : "Adaugă prima întrebare sau importă un fișier JSON pentru a începe."}
                  </p>
                  {!q && !filter && !archived && (
                    <button
                      type="button"
                      className="pt-bank-primary"
                      onClick={() => setEditing({ category: category || "", question: blank() })}
                    >
                      <Plus size={17} /> Adaugă prima întrebare
                    </button>
                  )}
                </div>
              )
            )}
          </div>
          <footer className="pt-bank-tools pt-bank-footer">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <span>
              Pagina {page} / {Math.max(1, Math.ceil(data.total / 50))}
            </span>
            <button
              type="button"
              disabled={loading || page * 50 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Următor <ChevronRight size={16} />
            </button>
            {onAdd && (
              <button
                type="button"
                className="pt-bank-primary"
                disabled={
                  archived ||
                  !selected.length ||
                  selected.length > 100 ||
                  busy ||
                  loading ||
                  !!loadError
                }
                onClick={() => {
                  transfer(selected);
                }}
              >
                Adaugă selectate ({selected.length})
              </button>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
