import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Clock3,
  ListChecks,
  Plus,
  RefreshCw,
  Settings2,
  Send,
  Trophy,
  CheckCircle2,
  FileQuestion,
  ShieldCheck,
  Trash2,
  Pencil,
  Sparkles,
  Users,
  CalendarClock,
  Save,
  AlertCircle,
  Search,
  Filter,
  UserRound,
  BarChart3,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { useAuth } from "../context/authStore";
import {
  getManagedTests,
  getTestQuestions,
  getTestVersion,
  saveTestSettings,
  addTestQuestion,
  editTestQuestion,
  deleteTestQuestion,
  publishTestVersion,
  createNextTestVersion,
  getEligibleTestUsers,
  assignTestVersion,
  getManagedTestResults,
  getVersionAssignments,
} from "../services/professionalTestingService";
import "./EditorTestProfesional.css";
import ImportTestQuestions from "../components/ImportTestQuestions";

const msg = (e) => e?.response?.data?.message || "Operațiunea nu a reușit.";
const blankQuestion = () => ({
  question_type: "SINGLE_CHOICE",
  question_text: "",
  points: 1,
  explanation: "",
  legal_reference: "",
  options: [
    { option_text: "", is_correct: true },
    { option_text: "", is_correct: false },
  ],
});
const initialSettings = {
  duration_minutes: 30,
  max_attempts: 1,
  passing_percentage: 70,
  reveal_answers: "NEVER",
  shuffle_questions: false,
  shuffle_options: false,
  available_from: "",
  available_until: "",
};
const toLocal = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function EditorTestProfesional() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [test, setTest] = useState(null);
  const [tab, setTab] = useState("settings");
  const [questions, setQuestions] = useState([]);
  const [settings, setSettings] = useState(initialSettings);
  const [users, setUsers] = useState([]);
  const [results, setResults] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [assignmentError, setAssignmentError] = useState("");
  const [target, setTarget] = useState("USER");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [question, setQuestion] = useState(blankQuestion);
  const [editingId, setEditingId] = useState(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [expandedQuestionIds, setExpandedQuestionIds] = useState([]);
  const [resultSearch, setResultSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const canManage = user?.role === "ADMIN" || user?.role === "EDITOR";
  const draft = test?.status === "DRAFT";
  const versionId = test?.version_id;
  const filteredQuestions = questions.filter((q) =>
    `${q.question_text} ${q.legal_reference || ""} ${(q.options || []).map((o) => o.option_text).join(" ")}`
      .toLocaleLowerCase("ro")
      .includes(questionSearch.trim().toLocaleLowerCase("ro")),
  );
  const filteredResults = results.filter((r) => {
    const matchName = String(r.user_name_snapshot || "")
      .toLocaleLowerCase("ro")
      .includes(resultSearch.trim().toLocaleLowerCase("ro"));
    const matchStatus =
      resultFilter === "ALL" ||
      (resultFilter === "PASSED" && r.passed === true) ||
      (resultFilter === "FAILED" && r.passed === false) ||
      (resultFilter === "PENDING" && r.passed == null);
    return matchName && matchStatus;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSettingsReady(false);
    try {
      const data = await getManagedTests();
      // Ruta editorului primește ID-ul versiunii; acceptăm și ID-ul testului
      // pentru compatibilitate cu eventuale linkuri mai vechi.
      const tests = data.tests || [];
      const found =
        tests.find((x) => String(x.version_id) === String(testId)) ||
        tests.find((x) => String(x.id) === String(testId));
      if (!found) {
        setTest(null);
        setError("Testul nu există sau nu ai acces la el.");
        return;
      }
      setTest(found);
      const qs = await getTestQuestions(found.version_id);
      setQuestions(qs.questions || []);

      // Nu blocăm întregul editor dacă endpointul de detalii al versiunii
      // nu este încă implementat în backend. Nu inventăm setări și nu
      // permitem salvarea lor până când serverul le furnizează.
      try {
        const details = await getTestVersion(found.version_id);
        const v = details.version;
        if (!v) throw new Error("Serverul nu a returnat detaliile versiunii.");
        setSettings({
          duration_minutes: v.duration_minutes,
          max_attempts: v.max_attempts,
          passing_percentage: v.passing_percentage,
          reveal_answers: v.reveal_answers,
          shuffle_questions: v.shuffle_questions,
          shuffle_options: v.shuffle_options,
          available_from: toLocal(v.available_from),
          available_until: toLocal(v.available_until),
        });
        setSettingsReady(true);
      } catch (detailsError) {
        setSettingsReady(false);
        toast.error(
          "Detaliile versiunii nu pot fi încărcate. Verifică ruta GET /testare/versiuni/:id din backend.",
        );
      }
      if (found.status === "PUBLISHED") {
        const [u, r, a] = await Promise.all([
          getEligibleTestUsers(),
          getManagedTestResults(found.version_id),
          getVersionAssignments(found.version_id).catch((err) => ({
            error: msg(err),
            assignments: [],
          })),
        ]);
        setUsers(u.users || []);
        setResults(r.results || []);
        setAssignments(a.assignments || []);
        setAssignmentError(a.error || "");
      } else {
        setUsers([]);
        setResults([]);
        setAssignments([]);
        setAssignmentError("");
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (canManage) load();
    else setLoading(false);
  }, [canManage, load]);
  const run = async (fn, success, reload = true) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      if (reload) await load();
      return true;
    } catch (e) {
      toast.error(msg(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const setField = (key, value) => setSettings((p) => ({ ...p, [key]: value }));
  const setQField = (key, value) => setQuestion((p) => ({ ...p, [key]: value }));
  const updateOption = (i, key, value) =>
    setQuestion((p) => ({
      ...p,
      options: p.options.map((o, n) => (n !== i ? o : { ...o, [key]: value })),
    }));
  const chooseCorrect = (i, checked) =>
    setQuestion((p) => ({
      ...p,
      options: p.options.map((o, n) => ({
        ...o,
        is_correct:
          p.question_type === "MULTIPLE_CHOICE" ? (n === i ? checked : o.is_correct) : n === i,
      })),
    }));
  const changeType = (type) =>
    setQuestion((p) => ({
      ...p,
      question_type: type,
      options:
        type === "TRUE_FALSE"
          ? [
              { option_text: "Adevărat", is_correct: true },
              { option_text: "Fals", is_correct: false },
            ]
          : p.options.map((o, i) => ({ ...o, is_correct: i === 0 })),
    }));
  const submitQuestion = async (e) => {
    e.preventDefault();
    if (
      !question.question_text.trim() ||
      question.options.some((o) => !o.option_text.trim()) ||
      !question.options.some((o) => o.is_correct)
    ) {
      toast.error("Completează întrebarea, variantele și răspunsul corect.");
      return;
    }
    const payload = {
      ...question,
      question_text: question.question_text.trim(),
      options: question.options.map((o) => ({ ...o, option_text: o.option_text.trim() })),
    };
    const ok = await run(
      () =>
        editingId
          ? editTestQuestion(versionId, editingId, payload)
          : addTestQuestion(versionId, payload),
      editingId ? "Întrebarea a fost actualizată." : "Întrebarea a fost adăugată.",
    );
    if (ok) {
      setQuestion(blankQuestion());
      setEditingId(null);
    }
  };
  const beginEdit = (q) => {
    setEditingId(q.id);
    setQuestion({
      question_type: q.question_type,
      question_text: q.question_text,
      points: q.points,
      explanation: q.explanation || "",
      legal_reference: q.legal_reference || "",
      options: (q.options || []).map((o) => ({
        option_text: o.option_text,
        is_correct: o.is_correct,
      })),
    });
  };
  const confirmAction = async ({ title, text, confirmButtonText, danger = false }) => {
    const response = await Swal.fire({
      title,
      text,
      icon: danger ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: "Anulează",
      confirmButtonColor: danger ? "#dc3545" : "#1674df",
      cancelButtonColor: "#71839a",
      reverseButtons: true,
      customClass: {
        popup: "pte-swal",
        confirmButton: "pte-swal-confirm",
        cancelButton: "pte-swal-cancel",
      },
    });
    return response.isConfirmed;
  };

  const removeQuestion = async (q) => {
    const confirmed = await confirmAction({
      title: "Ștergi această întrebare?",
      text: `„${q.question_text}” va fi eliminată definitiv.`,
      confirmButtonText: "Șterge întrebarea",
      danger: true,
    });
    if (!confirmed) return;
    const ok = await run(() => deleteTestQuestion(versionId, q.id), "Întrebarea a fost ștearsă.");
    if (ok && editingId === q.id) {
      setEditingId(null);
      setQuestion(blankQuestion());
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    await run(
      () =>
        saveTestSettings(versionId, {
          ...settings,
          duration_minutes: Number(settings.duration_minutes),
          max_attempts: Number(settings.max_attempts),
          passing_percentage: Number(settings.passing_percentage),
          available_from: settings.available_from
            ? new Date(settings.available_from).toISOString()
            : null,
          available_until: settings.available_until
            ? new Date(settings.available_until).toISOString()
            : null,
        }),
      "Setările au fost salvate.",
    );
  };
  const doPublish = async () => {
    const confirmed = await confirmAction({
      title: "Publici versiunea testului?",
      text: "După publicare, întrebările și setările nu vor mai putea fi modificate.",
      confirmButtonText: "Publică versiunea",
    });
    if (confirmed) await run(() => publishTestVersion(versionId), "Versiunea a fost publicată.");
  };

  const doNewVersion = async () => {
    const confirmed = await confirmAction({
      title: "Creezi o versiune nouă?",
      text: "Se va crea o versiune DRAFT, cu întrebările copiate din versiunea actuală.",
      confirmButtonText: "Creează versiunea",
    });
    if (confirmed) await run(() => createNextTestVersion(test.id), "Versiune nouă creată.");
  };

  const toggleAssignedUser = (id) => {
    const value = String(id);
    setSelectedUserIds((current) =>
      current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
    );
  };

  const visibleEligibleUsers = users.filter((u) =>
    `${u.full_name || ""} ${u.username || ""}`
      .toLocaleLowerCase("ro")
      .includes(assignmentSearch.trim().toLocaleLowerCase("ro")),
  );

  const reloadAssignments = async () => {
    try {
      const data = await getVersionAssignments(versionId);
      setAssignments(data.assignments || []);
      setAssignmentError("");
    } catch (err) {
      setAssignmentError(msg(err));
    }
  };
  const filteredAssignments = assignments.filter((a) => {
    const term = historySearch.trim().toLocaleLowerCase("ro");
    const matches = `${a.full_name || ""} ${a.username || ""} ${a.target_label || ""}`
      .toLocaleLowerCase("ro")
      .includes(term);
    return matches && (historyFilter === "ALL" || a.progress_status === historyFilter);
  });
  const assignmentStats = {
    total: assignments.length,
    pending: assignments.filter((a) => a.progress_status === "NOT_STARTED").length,
    started: assignments.filter((a) => a.progress_status === "IN_PROGRESS").length,
    finished: assignments.filter((a) => a.progress_status === "FINISHED").length,
  };
  const doAssign = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (target === "ALL") {
      const confirmed = await confirmAction({
        title: "Atribui testul tuturor?",
        text: "Testul va fi atribuit tuturor utilizatorilor eligibili.",
        confirmButtonText: "Atribuie tuturor",
      });
      if (!confirmed) return;
      const ok = await run(
        () => assignTestVersion(versionId, { target_type: "ALL" }),
        "Testul a fost atribuit.",
        false,
      );
      if (ok) await reloadAssignments();
      return;
    }
    const validIds = [...new Set(selectedUserIds)]
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0 && users.some((u) => Number(u.id) === id));
    if (!validIds.length) {
      toast.error("Selectează cel puțin un utilizator.");
      return;
    }
    const confirmed = await confirmAction({
      title: `Atribui testul pentru ${validIds.length} utilizatori?`,
      text: "Fiecare utilizator selectat va primi individual această versiune a testului.",
      confirmButtonText: "Confirmă atribuirea",
    });
    if (!confirmed) return;
    setBusy(true);
    const succeeded = [];
    const alreadyAssigned = [];
    const failed = [];
    try {
      // Endpointul existent acceptă un singur user_id per cerere.
      // Cererile sunt secvențiale pentru a evita suprasolicitarea serviciului.
      for (const id of validIds) {
        try {
          await assignTestVersion(versionId, { target_type: "USER", user_id: id });
          succeeded.push(id);
        } catch (err) {
          if (err?.response?.status === 409) alreadyAssigned.push(id);
          else failed.push({ id, message: msg(err) });
        }
      }
      if (succeeded.length) toast.success(`Test atribuit pentru ${succeeded.length} utilizatori.`);
      if (alreadyAssigned.length)
        toast.info(`${alreadyAssigned.length} utilizatori aveau deja atribuirea.`);
      if (failed.length)
        toast.error(`Atribuirea a eșuat pentru ${failed.length} utilizatori. Poți reîncerca.`);
      if (succeeded.length || alreadyAssigned.length) await reloadAssignments();
      setSelectedUserIds((current) =>
        current.filter(
          (id) => !succeeded.includes(Number(id)) && !alreadyAssigned.includes(Number(id)),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canManage)
    return (
      <section className="pte-page">
        <p>Nu ai permisiunea să administrezi teste.</p>
        <Link to="/testare">Înapoi</Link>
      </section>
    );
  return (
    <section className="pte-page">
      <header className="pte-heading">
        <div>
          <Link className="pte-back" to="/testare">
            <ArrowLeft size={17} /> Înapoi la testare
          </Link>
          <div className="pte-eyebrow">
            <Sparkles size={13} /> BORDER / TESTARE PROFESIONALĂ / EDITOR
          </div>
          <h1>{test?.title || "Editor test profesional"}</h1>
          <p>{test?.description || "Configurare, întrebări, atribuiri și rezultate"}</p>
        </div>
        <button className="pte-btn pte-btn-light" onClick={load} disabled={loading || busy}>
          <RefreshCw size={16} /> Actualizează
        </button>
      </header>
      {error && (
        <div className="pte-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="pte-panel pte-pad pte-loading" role="status">
          <RefreshCw className="pte-spin" size={22} /> Se încarcă editorul...
        </div>
      ) : (
        test && (
          <>
            <div className="pte-summary">
              <span>
                Versiunea <strong>{test.version_number}</strong>
              </span>
              <span className={draft ? "pte-draft" : "pte-published"}>
                {draft ? "Ciornă (DRAFT)" : "Publicat (PUBLISHED)"}
              </span>
              <span>
                <FileQuestion size={15} />
                <strong>{questions.length}</strong> întrebări
              </span>
            </div>
            <nav className="pte-tabs" aria-label="Secțiuni editor">
              {[
                ["settings", "Setări", Settings2],
                ["questions", "Întrebări", BookOpen],
                ["assign", "Atribuire", Send],
                ["results", "Rezultate", Trophy],
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={tab === id ? "pte-tab pte-selected" : "pte-tab"}
                  onClick={() => setTab(id)}
                  type="button"
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </nav>
            {tab === "settings" && (
              <div className="pte-panel pte-pad pte-settings-panel">
                <div className="pte-section-heading">
                  <div className="pte-section-icon">
                    <Settings2 size={22} />
                  </div>
                  <div>
                    <h2>Configurarea versiunii</h2>
                    <p>Reguli, disponibilitate și personalizarea evaluării</p>
                  </div>
                </div>
                {!settingsReady && (
                  <p className="pte-note" role="alert">
                    Setările nu sunt disponibile: backendul trebuie să ofere ruta GET
                    /testare/versiuni/:id. Întrebările pot fi administrate separat.
                  </p>
                )}
                {settingsReady && (
                  <form className="pte-form" onSubmit={saveSettings}>
                    <div className="pte-subheading">
                      <Clock3 size={17} /> Reguli de evaluare și disponibilitate
                    </div>
                    <div className="pte-grid">
                      <label>
                        Durată (minute)
                        <input
                          type="number"
                          min="1"
                          max="480"
                          required
                          disabled={!draft || busy}
                          value={settings.duration_minutes}
                          onChange={(e) => setField("duration_minutes", e.target.value)}
                        />
                      </label>
                      <label>
                        Număr maxim de încercări
                        <input
                          type="number"
                          min="1"
                          max="100"
                          required
                          disabled={!draft || busy}
                          value={settings.max_attempts}
                          onChange={(e) => setField("max_attempts", e.target.value)}
                        />
                      </label>
                      <label>
                        Prag promovare (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          required
                          disabled={!draft || busy}
                          value={settings.passing_percentage}
                          onChange={(e) => setField("passing_percentage", e.target.value)}
                        />
                      </label>
                      <label>
                        Afișarea răspunsurilor
                        <select
                          disabled={!draft || busy}
                          value={settings.reveal_answers}
                          onChange={(e) => setField("reveal_answers", e.target.value)}
                        >
                          <option value="NEVER">Niciodată</option>
                          <option value="AFTER_SUBMISSION">După finalizare</option>
                          <option value="AFTER_DEADLINE">După termen</option>
                          <option value="MANUAL">Manual</option>
                        </select>
                      </label>
                      <label>
                        Disponibil de la
                        <input
                          type="datetime-local"
                          disabled={!draft || busy}
                          value={settings.available_from}
                          onChange={(e) => setField("available_from", e.target.value)}
                        />
                      </label>
                      <label>
                        Disponibil până la
                        <input
                          type="datetime-local"
                          disabled={!draft || busy}
                          value={settings.available_until}
                          onChange={(e) => setField("available_until", e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="pte-subheading">
                      <ListChecks size={17} /> Personalizarea întrebărilor
                    </div>
                    <div className="pte-switches">
                      <label className="pte-check">
                        <input
                          type="checkbox"
                          disabled={!draft || busy}
                          checked={!!settings.shuffle_questions}
                          onChange={(e) => setField("shuffle_questions", e.target.checked)}
                        />{" "}
                        Amestecă întrebările
                      </label>
                      <label className="pte-check">
                        <input
                          type="checkbox"
                          disabled={!draft || busy}
                          checked={!!settings.shuffle_options}
                          onChange={(e) => setField("shuffle_options", e.target.checked)}
                        />{" "}
                        Amestecă variantele de răspuns
                      </label>
                    </div>
                    {draft && (
                      <button type="submit" className="pte-btn pte-btn-primary" disabled={busy}>
                        <Save size={16} /> Salvează setările
                      </button>
                    )}
                  </form>
                )}
                <p className="pte-note">
                  Atenție: opțiunile de amestecare și afișare a răspunsurilor necesită implementarea
                  corespunzătoare în fluxul de susținere; salvarea setărilor nu activează singură
                  aceste comportamente.
                </p>
                {draft ? (
                  <button
                    className="pte-btn pte-btn-primary"
                    disabled={busy || !questions.length}
                    onClick={doPublish}
                  >
                    <ShieldCheck size={16} /> Publică versiunea
                  </button>
                ) : (
                  <button
                    className="pte-btn pte-btn-primary"
                    disabled={busy}
                    onClick={doNewVersion}
                  >
                    <Plus size={16} /> Creează versiune nouă
                  </button>
                )}
                {draft && !questions.length && (
                  <p className="pte-note">Adaugă cel puțin o întrebare înainte de publicare.</p>
                )}
              </div>
            )}
            {tab === "questions" && (
              <>
                {draft && (
                  <ImportTestQuestions key={versionId} versionId={versionId} onImported={load} />
                )}
                <div className="pte-columns">
                  <div className="pte-panel pte-pad">
                    <div className="pte-section-heading">
                      <div className="pte-section-icon">
                        <BookOpen size={22} />
                      </div>
                      <div>
                        <h2>Întrebările versiunii ({questions.length})</h2>
                        <p>Verifică variantele și punctajul fiecărei întrebări</p>
                      </div>
                    </div>
                    <div className="pte-toolbar pte-questions-toolbar">
                      <div className="pte-search" role="search">
                        <Search size={18} aria-hidden="true" />
                        <input
                          type="search"
                          placeholder="Caută întrebări sau variante..."
                          aria-label="Caută întrebări sau variante"
                          value={questionSearch}
                          onChange={(e) => setQuestionSearch(e.target.value)}
                        />
                        {questionSearch && (
                          <button
                            type="button"
                            className="pte-search-clear"
                            aria-label="Șterge căutarea"
                            onClick={() => setQuestionSearch("")}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <span className="pte-count">
                        {filteredQuestions.length} din {questions.length} întrebări
                      </span>
                      {filteredQuestions.length > 0 && (
                        <button
                          type="button"
                          className="pte-expand-all"
                          onClick={() => {
                            const allVisibleExpanded = filteredQuestions.every((q) =>
                              expandedQuestionIds.includes(String(q.id)),
                            );
                            setExpandedQuestionIds((current) =>
                              allVisibleExpanded
                                ? current.filter(
                                    (id) => !filteredQuestions.some((q) => String(q.id) === id),
                                  )
                                : [
                                    ...new Set([
                                      ...current,
                                      ...filteredQuestions.map((q) => String(q.id)),
                                    ]),
                                  ],
                            );
                          }}
                        >
                          {filteredQuestions.every((q) =>
                            expandedQuestionIds.includes(String(q.id)),
                          )
                            ? "Restrânge toate"
                            : "Extinde toate"}
                        </button>
                      )}
                    </div>
                    {!filteredQuestions.length ? (
                      <div className="pte-empty-state">
                        <FileQuestion size={28} />
                        <strong>
                          {questions.length ? "Nu s-au găsit întrebări" : "Nu există întrebări"}
                        </strong>
                        <span>
                          {questions.length
                            ? "Încearcă alt termen de căutare."
                            : "Adaugă prima întrebare în versiunea DRAFT."}
                        </span>
                      </div>
                    ) : (
                      <div className="pte-questions-list">
                        {filteredQuestions.map((q) => {
                          const isExpanded =
                            expandedQuestionIds.includes(String(q.id)) || editingId === q.id;
                          const number = questions.indexOf(q) + 1;
                          const typeLabel =
                            q.question_type === "MULTIPLE_CHOICE"
                              ? "Răspuns multiplu"
                              : q.question_type === "TRUE_FALSE"
                                ? "Adevărat / Fals"
                                : "Răspuns unic";
                          return (
                            <article
                              className={`pte-question${isExpanded ? " is-expanded" : ""}`}
                              key={q.id}
                            >
                              <button
                                type="button"
                                className="pte-question-toggle"
                                aria-expanded={isExpanded}
                                aria-controls={`pte-question-details-${q.id}`}
                                onClick={() =>
                                  setExpandedQuestionIds((current) =>
                                    current.includes(String(q.id))
                                      ? current.filter((id) => id !== String(q.id))
                                      : [...current, String(q.id)],
                                  )
                                }
                              >
                                <span className="pte-question-number">{number}</span>
                                <span className="pte-question-title-group">
                                  <strong>{q.question_text}</strong>
                                  <small>
                                    {typeLabel} · {(q.options || []).length} variante
                                  </small>
                                </span>
                                <span className="pte-question-points">{q.points} pct.</span>
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                              {isExpanded && (
                                <div
                                  className="pte-question-details"
                                  id={`pte-question-details-${q.id}`}
                                >
                                  <div className="pte-option-list">
                                    {(q.options || []).map((o, i) => (
                                      <div
                                        key={o.id ?? i}
                                        className={`pte-option${o.is_correct ? " pte-correct" : ""}`}
                                      >
                                        {o.is_correct ? (
                                          <CheckCircle2 size={17} aria-label="Răspuns corect" />
                                        ) : (
                                          <Circle size={16} aria-hidden="true" />
                                        )}
                                        <span>{o.option_text}</span>
                                        {o.is_correct && <small>Corect</small>}
                                      </div>
                                    ))}
                                  </div>
                                  {q.legal_reference && (
                                    <p className="pte-question-meta">
                                      <strong>Temei:</strong> {q.legal_reference}
                                    </p>
                                  )}
                                  {q.explanation && (
                                    <p className="pte-question-meta">
                                      <strong>Explicație:</strong> {q.explanation}
                                    </p>
                                  )}
                                  {draft && (
                                    <div className="pte-q-actions">
                                      <button
                                        type="button"
                                        className="pte-btn pte-btn-light"
                                        disabled={busy}
                                        onClick={() => beginEdit(q)}
                                      >
                                        <Pencil size={15} /> Editează
                                      </button>
                                      <button
                                        type="button"
                                        className="pte-btn pte-btn-light pte-btn-danger"
                                        disabled={busy}
                                        onClick={() => removeQuestion(q)}
                                      >
                                        <Trash2 size={15} /> Șterge
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {draft && (
                    <form className="pte-panel pte-pad pte-form" onSubmit={submitQuestion}>
                      <div className="pte-section-heading">
                        <div className="pte-section-icon">
                          <Plus size={22} />
                        </div>
                        <div>
                          <h2>{editingId ? "Editează întrebarea" : "Adaugă întrebare"}</h2>
                          <p>Completează enunțul și variantele de răspuns</p>
                        </div>
                      </div>
                      {editingId && (
                        <button
                          type="button"
                          className="pte-btn pte-btn-light"
                          onClick={() => {
                            setEditingId(null);
                            setQuestion(blankQuestion());
                          }}
                        >
                          Anulează editarea
                        </button>
                      )}
                      <label>
                        Tipul întrebării
                        <select
                          value={question.question_type}
                          onChange={(e) => changeType(e.target.value)}
                        >
                          <option value="SINGLE_CHOICE">Un singur răspuns</option>
                          <option value="MULTIPLE_CHOICE">Mai multe răspunsuri</option>
                          <option value="TRUE_FALSE">Adevărat / Fals</option>
                        </select>
                      </label>
                      <label>
                        Textul întrebării *
                        <textarea
                          required
                          rows={3}
                          value={question.question_text}
                          onChange={(e) => setQField("question_text", e.target.value)}
                        />
                      </label>
                      <label>
                        Punctaj
                        <input
                          type="number"
                          min="0.01"
                          max="1000"
                          step="0.01"
                          required
                          value={question.points}
                          onChange={(e) => setQField("points", e.target.value)}
                        />
                      </label>
                      <strong>Variante de răspuns *</strong>
                      <p className="pte-note">
                        Bifează varianta corectă. Pentru răspuns multiplu poți bifa mai multe.
                      </p>
                      {question.options.map((o, i) => (
                        <div className="pte-option-edit" key={i}>
                          <input
                            aria-label={`Varianta ${i + 1}`}
                            value={o.option_text}
                            onChange={(e) => updateOption(i, "option_text", e.target.value)}
                            required
                          />
                          <label className="pte-check">
                            <input
                              type={
                                question.question_type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"
                              }
                              name="correct-option"
                              checked={o.is_correct}
                              onChange={(e) => chooseCorrect(i, e.target.checked)}
                            />{" "}
                            Corect
                          </label>
                          {question.question_type !== "TRUE_FALSE" &&
                            question.options.length > 2 && (
                              <button
                                type="button"
                                className="pte-small"
                                onClick={() =>
                                  setQuestion((p) => ({
                                    ...p,
                                    options: p.options.filter((_, n) => n !== i),
                                  }))
                                }
                              >
                                Elimină
                              </button>
                            )}
                        </div>
                      ))}
                      {question.question_type !== "TRUE_FALSE" && question.options.length < 12 && (
                        <button
                          type="button"
                          className="pte-btn pte-btn-light"
                          onClick={() =>
                            setQuestion((p) => ({
                              ...p,
                              options: [...p.options, { option_text: "", is_correct: false }],
                            }))
                          }
                        >
                          <Plus size={16} /> Adaugă variantă
                        </button>
                      )}
                      <label>
                        Explicație (opțional)
                        <textarea
                          rows={2}
                          value={question.explanation}
                          onChange={(e) => setQField("explanation", e.target.value)}
                        />
                      </label>
                      <label>
                        Referință legală (opțional)
                        <input
                          value={question.legal_reference}
                          onChange={(e) => setQField("legal_reference", e.target.value)}
                        />
                      </label>
                      <button className="pte-btn pte-btn-primary" disabled={busy} type="submit">
                        {busy
                          ? "Se salvează..."
                          : editingId
                            ? "Salvează modificările"
                            : "Salvează întrebarea"}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
            {tab === "assign" && (
              <div className="pte-panel pte-pad pte-assign-panel">
                <div className="pte-section-heading">
                  <div className="pte-section-icon">
                    <Users size={22} />
                  </div>
                  <div>
                    <h2>Atribuie testul</h2>
                    <p>Gestionează destinatarii evaluării profesionale</p>
                  </div>
                </div>
                {draft ? (
                  <p className="pte-note">Publică versiunea înainte de atribuire.</p>
                ) : (
                  <div className="pte-assign-layout">
                    <form className="pte-form pte-assign-form" onSubmit={doAssign}>
                      <div className="pte-assign-metrics" aria-label="Situația destinatarilor">
                        <div className="pte-assign-metric">
                          <span>
                            <Users size={16} /> Utilizatori eligibili
                          </span>
                          <strong>{users.length}</strong>
                        </div>
                        <div className="pte-assign-metric">
                          <span>
                            <CheckCircle2 size={16} /> Selectați
                          </span>
                          <strong>
                            {target === "ALL" ? users.length : selectedUserIds.length}
                          </strong>
                        </div>
                      </div>
                      <label className="pte-assign-target">
                        Destinatari
                        <select
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                          disabled={busy}
                        >
                          <option value="USER">Utilizatori selectați</option>
                          <option value="ALL">Toți utilizatorii eligibili</option>
                        </select>
                      </label>
                      {target === "USER" && (
                        <div className="pte-multi-users">
                          <label htmlFor="pte-user-search">Caută utilizatori</label>
                          <div className="pte-user-search-wrap">
                            <Search size={18} aria-hidden="true" />
                            <input
                              id="pte-user-search"
                              type="search"
                              value={assignmentSearch}
                              onChange={(e) => setAssignmentSearch(e.target.value)}
                              placeholder="Caută după nume sau utilizator..."
                              disabled={busy}
                            />
                          </div>
                          <div className="pte-user-selection-actions">
                            <span>
                              {selectedUserIds.length} din {users.length} selectați
                            </span>
                            <button
                              type="button"
                              disabled={busy || !visibleEligibleUsers.length}
                              onClick={() =>
                                setSelectedUserIds((current) => [
                                  ...new Set([
                                    ...current,
                                    ...visibleEligibleUsers.map((u) => String(u.id)),
                                  ]),
                                ])
                              }
                            >
                              Selectează {assignmentSearch ? "rezultatele" : "toți"}
                            </button>
                            <button
                              type="button"
                              disabled={busy || !selectedUserIds.length}
                              onClick={() => setSelectedUserIds([])}
                            >
                              Deselectează
                            </button>
                          </div>
                          <div
                            className="pte-user-checklist"
                            role="group"
                            aria-label="Utilizatori eligibili"
                          >
                            {visibleEligibleUsers.length ? (
                              visibleEligibleUsers.map((u) => {
                                const checked = selectedUserIds.includes(String(u.id));
                                const name = u.full_name || u.username || "Utilizator";
                                return (
                                  <label
                                    className={`pte-user-choice${checked ? " is-selected" : ""}`}
                                    key={u.id}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={busy}
                                      onChange={() => toggleAssignedUser(u.id)}
                                    />
                                    <span className="pte-user-avatar" aria-hidden="true">
                                      {name.trim().charAt(0).toLocaleUpperCase("ro")}
                                    </span>
                                    <span className="pte-user-identity">
                                      <strong>{name}</strong>
                                      <small>@{u.username}</small>
                                    </span>
                                    <span className="pte-user-check-icon" aria-hidden="true">
                                      <CheckCircle2 size={19} />
                                    </span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="pte-note">Nu au fost găsiți utilizatori.</p>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="pte-assign-footer">
                        <span>
                          {target === "ALL"
                            ? `Atribuire pentru ${users.length} utilizatori eligibili`
                            : `${selectedUserIds.length} persoane pregătite pentru atribuire`}
                        </span>
                        <button
                          className="pte-btn pte-btn-primary"
                          type="submit"
                          disabled={busy || (target === "USER" && !selectedUserIds.length)}
                        >
                          <Send size={16} />{" "}
                          {busy
                            ? "Se atribuie..."
                            : target === "ALL"
                              ? "Atribuie tuturor"
                              : `Atribuie (${selectedUserIds.length})`}
                        </button>
                      </div>
                      <p className="pte-note pte-assign-note">
                        Atribuirea grupurilor va fi disponibilă după integrarea gestionării
                        grupurilor.
                      </p>
                    </form>
                    <aside className="pte-assign-aside">
                      <div className="pte-aside-icon">
                        <UserRound size={22} />
                      </div>
                      <h3>Distribuirea evaluării</h3>
                      <p>
                        {target === "ALL"
                          ? "Testul va fi distribuit tuturor utilizatorilor eligibili."
                          : `Ai selectat ${selectedUserIds.length} utilizatori pentru această versiune.`}
                      </p>
                      <div className="pte-aside-divider" />
                      <div className="pte-aside-detail">
                        <Users size={16} />
                        <span>{users.length} utilizatori eligibili</span>
                      </div>
                      <div className="pte-aside-detail">
                        <ShieldCheck size={16} />
                        <span>Versiune publicată</span>
                      </div>
                      <div className="pte-aside-detail">
                        <Clock3 size={16} />
                        <span>Durată: {settings.duration_minutes} minute</span>
                      </div>
                    </aside>
                  </div>
                )}
                {!draft && (
                  <section className="pte-history" aria-label="Istoricul atribuirilor">
                    <div className="pte-history-heading">
                      <div>
                        <h3>
                          <ClipboardList size={19} /> Istoricul atribuirilor
                        </h3>
                        <p>Destinatarii și progresul lor pentru versiunea curentă</p>
                      </div>
                      <button
                        type="button"
                        className="pte-btn pte-btn-light"
                        onClick={reloadAssignments}
                        disabled={busy}
                      >
                        <RefreshCw size={16} /> Actualizează istoricul
                      </button>
                    </div>
                    {assignmentError && (
                      <div className="pte-error" role="alert">
                        {assignmentError}
                      </div>
                    )}
                    <div className="pte-history-stats">
                      <div>
                        <span>Atribuiri către persoane</span>
                        <strong>{assignmentStats.total}</strong>
                      </div>
                      <div>
                        <span>Neîncepute</span>
                        <strong>{assignmentStats.pending}</strong>
                      </div>
                      <div>
                        <span>În desfășurare</span>
                        <strong>{assignmentStats.started}</strong>
                      </div>
                      <div>
                        <span>Finalizate</span>
                        <strong>{assignmentStats.finished}</strong>
                      </div>
                    </div>
                    <div className="pte-history-toolbar">
                      <div className="pte-user-search-wrap">
                        <Search size={18} aria-hidden="true" />
                        <input
                          type="search"
                          aria-label="Caută în istoricul atribuirilor"
                          placeholder="Caută după nume sau utilizator..."
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="Filtrează starea atribuirii"
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value)}
                      >
                        <option value="ALL">Toate stările</option>
                        <option value="NOT_STARTED">Neîncepute</option>
                        <option value="IN_PROGRESS">În desfășurare</option>
                        <option value="FINISHED">Finalizate</option>
                      </select>
                    </div>
                    {filteredAssignments.length ? (
                      <div className="pte-history-list">
                        {filteredAssignments.map((a) => (
                          <article
                            className="pte-history-item"
                            key={`${a.assignment_id}-${a.user_id}`}
                          >
                            <div className="pte-history-person">
                              <span className="pte-user-avatar" aria-hidden="true">
                                {(a.full_name || a.username || "?")
                                  .charAt(0)
                                  .toLocaleUpperCase("ro")}
                              </span>
                              <div>
                                <strong>{a.full_name || a.username || "Utilizator"}</strong>
                                <small>
                                  {a.username ? `@${a.username} · ` : ""}
                                  {a.target_label}
                                </small>
                              </div>
                            </div>
                            <span
                              className={`pte-history-status pte-history-${a.progress_status.toLowerCase()}`}
                            >
                              {a.progress_status === "FINISHED"
                                ? "Finalizat"
                                : a.progress_status === "IN_PROGRESS"
                                  ? "În desfășurare"
                                  : "Neînceput"}
                            </span>
                            <div className="pte-history-date">
                              {a.assigned_at
                                ? new Date(a.assigned_at).toLocaleString("ro-RO")
                                : "Data indisponibilă"}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="pte-note">
                        {assignments.length
                          ? "Nu există rezultate pentru filtrele selectate."
                          : "Nu există atribuiri pentru această versiune."}
                      </p>
                    )}
                    <p className="pte-note">
                      Atribuirile generale și cele pe grup sunt afișate pentru membrii eligibili în
                      prezent. O persoană poate apărea de mai multe ori dacă a primit atribuiri
                      distincte.
                    </p>
                  </section>
                )}
              </div>
            )}
            {tab === "results" && (
              <div className="pte-panel pte-pad">
                <div className="pte-section-heading">
                  <div className="pte-section-icon">
                    <Trophy size={22} />
                  </div>
                  <div>
                    <h2>Rezultatele versiunii</h2>
                    <p>Monitorizează încercările și performanța participanților</p>
                  </div>
                </div>
                {draft ? (
                  <p className="pte-note">Versiunea nu este încă publicată.</p>
                ) : !results.length ? (
                  <p className="pte-note">
                    Nu există rezultate sau încercări pentru această versiune.
                  </p>
                ) : (
                  <>
                    <div className="pte-results-overview">
                      <div>
                        <span>
                          <ClipboardList size={17} /> Încercări înregistrate
                        </span>
                        <strong>{results.length}</strong>
                        <small>Toate încercările</small>
                      </div>
                      <div>
                        <span>
                          <CheckCircle size={17} /> Promovate
                        </span>
                        <strong>{results.filter((r) => r.passed === true).length}</strong>
                        <small>Evaluări promovate</small>
                      </div>
                      <div>
                        <span>
                          <BarChart3 size={17} /> Finalizate
                        </span>
                        <strong>{results.filter((r) => r.status === "SUBMITTED").length}</strong>
                        <small>Teste transmise</small>
                      </div>
                    </div>
                    <div className="pte-toolbar pte-results-toolbar">
                      <label className="pte-search">
                        <Search size={17} aria-hidden="true" />
                        <input
                          type="search"
                          placeholder="Caută participant..."
                          aria-label="Caută participant"
                          value={resultSearch}
                          onChange={(e) => setResultSearch(e.target.value)}
                        />
                      </label>
                      <label className="pte-filter">
                        <Filter size={16} aria-hidden="true" />
                        <select
                          aria-label="Filtrează rezultatele"
                          value={resultFilter}
                          onChange={(e) => setResultFilter(e.target.value)}
                        >
                          <option value="ALL">Toate rezultatele</option>
                          <option value="PASSED">Promovate</option>
                          <option value="FAILED">Nepromovate</option>
                          <option value="PENDING">Neevaluate</option>
                        </select>
                      </label>
                      <span className="pte-count">{filteredResults.length} rezultate</span>
                    </div>
                    <div className="pte-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Utilizator</th>
                            <th>Încercare</th>
                            <th>Stare</th>
                            <th>Procent</th>
                            <th>Notă</th>
                            <th>Promovat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredResults.map((r) => (
                            <tr key={r.id}>
                              <td>{r.user_name_snapshot}</td>
                              <td>{r.attempt_number}</td>
                              <td>
                                <span
                                  className={
                                    r.status === "SUBMITTED"
                                      ? "pte-status pte-status-done"
                                      : "pte-status pte-status-pending"
                                  }
                                >
                                  {r.status === "SUBMITTED" ? "Finalizat" : r.status}
                                </span>
                              </td>
                              <td>{r.percentage == null ? "—" : `${r.percentage}%`}</td>
                              <td>{r.grade ?? "—"}</td>
                              <td>
                                {r.passed == null ? (
                                  "—"
                                ) : (
                                  <span
                                    className={
                                      r.passed
                                        ? "pte-status pte-status-done"
                                        : "pte-status pte-status-failed"
                                    }
                                  >
                                    {r.passed ? <CheckCircle size={13} /> : <XCircle size={13} />}{" "}
                                    {r.passed ? "Promovat" : "Nepromovat"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
