import DetaliiTest from "./DetaliiTest";
import Intrebari from "./Intrebari";
import QuestionBank from "../testare/QuestionBank";
import Atribuire from "./Atribuire";
import Rezumat from "./Rezumat";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  Target,
  Settings2,
  CalendarDays,
  Circle,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ClipboardList,
  FileText,
  Lightbulb,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import "./ProfessionalTestEditor.css";
import { toast } from "sonner";
import Swal from "sweetalert2";

const Card = ({ icon: Icon, title, subtitle, children }) => (
  <section className="pte-card">
    <div className="pte-card-heading">
      <span className="pte-section-icon">
        <Icon size={24} />
      </span>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const DEFAULT = {
  title: "",
  category: "",
  description: "",
  duration: 30,
  maxAttempts: 1,
  retryIntervalHours: 0,
  questionLimit: 0,
  navigationMode: "free",
  scoringMode: "exact",
  idleWarningMinutes: 0,
  idleAutoFinish: false,
  notifyResult: false,
  monitorTabs: false,
  tabWarningLimit: 3,
  passThreshold: 50,
  maxGrade: 10,
  grading: "grade-percent",
  rounding: "one-decimal",
  allowRetake: true,
  showGrade: true,
  showCorrect: true,
  showExplanations: false,
  shuffleQuestions: false,
  shuffleAnswers: false,
  notifyOnAssignment: true,
  sendReminder: false,
  reminderHours: 24,
  blockAfterExpiry: true,
  showInAssignedTests: true,
  availableFrom: "",
  availableUntil: "",
  questions: [],
  assignments: [],
};
const STEPS = [
  ["Detalii test", "Informații generale și reguli"],
  ["Întrebări", "Adaugă sau importă întrebări"],
  ["Atribuire", "Selectează destinatarii"],
  ["Rezumat", "Verifică și publică"],
];
/**
 * Standalone frontend editor. Pass integration callbacks from the existing BORDER page:
 * onSaveDraft(payload), onPublish(payload), onRefresh(), onCancel(), onImportQuestions().
 * Each callback can return a Promise. No backend endpoint is assumed.
 * initialData may contain a saved test. onSaveDraft/onPublish MUST persist on server.
 */
export default function ProfessionalTestEditor({
  initialData = {},
  onSaveDraft,
  onPublish,
  onRefresh,
  onCancel,
  onImportQuestions,
  onExportQuestions,
  onPreview,
  recipients = [],
  groups = [],
  groupsLoading = false,
  groupsError = "",
  onGroupsChanged,
  assignmentOnly = false,
  readOnly = false,
  recipientsLoading = false,
  recipientsError = "",
  onOpenResults,
}) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT,
    ...initialData,
    questions: Array.isArray(initialData.questions) ? initialData.questions : [],
    assignments: assignmentOnly
      ? []
      : Array.isArray(initialData.assignments)
        ? initialData.assignments
        : [],
    ...(assignmentOnly ? { assignmentType: "individual", assignmentGroupId: "" } : {}),
  }));
  // Sincronizăm doar când CONȚINUTUL datelor inițiale se schimbă,
  // nu la fiecare randare a componentei părinte.
  // Un obiect initialData = {} creat la fiecare randare nu mai șterge ce tastezi.
  const initialDataSignature = JSON.stringify(initialData ?? {});
  useEffect(() => {
    const data = JSON.parse(initialDataSignature);
    setForm({
      ...DEFAULT,
      ...data,
      questions: Array.isArray(data.questions) ? data.questions : [],
      assignments: assignmentOnly ? [] : Array.isArray(data.assignments) ? data.assignments : [],
      ...(assignmentOnly ? { assignmentType: "individual", assignmentGroupId: "" } : {}),
    });
  }, [initialDataSignature, assignmentOnly]);
  const [step, setStep] = useState(assignmentOnly ? 2 : 0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const operationLock = useRef(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(form));
  const dirty = !readOnly && JSON.stringify(form) !== baseline;
  useEffect(() => {
    setBaseline(
      JSON.stringify({
        ...DEFAULT,
        ...JSON.parse(initialDataSignature),
        questions: Array.isArray(initialData.questions) ? initialData.questions : [],
        assignments: assignmentOnly
          ? []
          : Array.isArray(initialData.assignments)
            ? initialData.assignments
            : [],
        ...(assignmentOnly ? { assignmentType: "individual", assignmentGroupId: "" } : {}),
      }),
    );
  }, [initialDataSignature, assignmentOnly]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const safeLeave = async (callback) => {
    if (operationLock.current || busy || !callback) return;
    if (
      dirty &&
      !(
        await Swal.fire({
          title: "Modificări nesalvate",
          text: "Dacă continui, modificările locale se pot pierde.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Continuă",
          cancelButtonText: "Rămâi în editor",
        })
      ).isConfirmed
    )
      return;
    if (!operationLock.current) callback();
  };
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [draggedQuestion, setDraggedQuestion] = useState(null);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const progress = (step + 1) * 25;
  const valid = () => {
    if (!form.title.trim()) return "Completează titlul testului.";
    if (!form.category) return "Selectează categoria.";
    const numeric = (v, min, max, integer = false) =>
      v !== "" &&
      v != null &&
      typeof v !== "boolean" &&
      Number.isFinite(Number(v)) &&
      Number(v) >= min &&
      Number(v) <= max &&
      (!integer || Number.isInteger(Number(v)));
    if (form.title.trim().length > 250) return "Titlul poate avea maximum 250 de caractere.";
    if (!numeric(form.duration, 1, 480, true))
      return "Durata trebuie să fie un număr întreg între 1 și 480 de minute.";
    if (!numeric(form.maxAttempts, 1, 100, true))
      return "Numărul de încercări trebuie să fie între 1 și 100.";
    if (![0, 2, 5, 10, 15, 30].includes(Number(form.idleWarningMinutes)))
      return "Intervalul de avertizare este invalid.";
    if (![1, 2, 3, 5, 10].includes(Number(form.tabWarningLimit)))
      return "Limita avertizărilor este invalidă.";
    if (
      !["free", "sequential"].includes(form.navigationMode) ||
      !["exact", "partial", "penalized"].includes(form.scoringMode)
    )
      return "Regulă de navigare sau punctaj invalidă.";
    if (!numeric(form.questionLimit, 0, 10000, true))
      return "Numărul de întrebări trebuie să fie un întreg între 0 și 10000.";
    if (![0, 1, 24, 48].includes(Number(form.retryIntervalHours)))
      return "Interval de reîncercare invalid.";
    if (!numeric(form.passThreshold, 0, 100))
      return "Pragul de promovare trebuie să fie între 0 și 100.";
    if (!numeric(form.maxGrade, 1, 10)) return "Nota maximă trebuie să fie între 1 și 10.";
    if (!["grade-percent", "grade", "percent"].includes(form.grading))
      return "Metoda de notare este invalidă.";
    if (!["one-decimal", "two-decimals", "integer"].includes(form.rounding))
      return "Regula de rotunjire este invalidă.";
    if ([form.availableFrom, form.availableUntil].some((v) => v && !Number.isFinite(Date.parse(v))))
      return "Data de disponibilitate este invalidă.";
    if (
      form.availableFrom &&
      form.availableUntil &&
      new Date(form.availableUntil) <= new Date(form.availableFrom)
    )
      return "Data finală trebuie să fie după data inițială.";
    return "";
  };
  const move = (next) => {
    if (busy || operationLock.current) return;
    if (
      assignmentOnly &&
      next === 3 &&
      (form.assignmentType || "individual") === "individual" &&
      !form.assignments.length
    ) {
      setError("Selectează explicit persoana căreia vrei să îi atribui testul.");
      return;
    }
    if (assignmentOnly && next !== 2 && next !== 3) return;
    const issue = valid();
    if (!assignmentOnly && next > 0 && issue) {
      setError(issue);
      setStep(0);
      return;
    }
    setError("");
    setNotice("");
    setStep(next);
  };
  const execute = async (kind) => {
    if (busy || operationLock.current || readOnly) return;
    if (assignmentOnly && kind === "draft") {
      setError("Testul publicat nu poate fi salvat ca ciornă.");
      return;
    }
    const issue = assignmentOnly ? "" : valid();
    if (issue) {
      setError(issue);
      setStep(0);
      return;
    }
    if (
      !assignmentOnly &&
      kind === "publish" &&
      Number(form.questionLimit) > form.questions.length
    ) {
      setError("Numărul de întrebări selectate depășește banca disponibilă.");
      setStep(0);
      return;
    }
    if (!assignmentOnly && kind === "publish" && !form.questions.length) {
      setError("Adaugă cel puțin o întrebare înainte de publicare.");
      setStep(1);
      return;
    }
    if (!assignmentOnly && kind === "publish" && !form.questions.every(questionValid)) {
      setError("Completează și validează toate întrebările înainte de publicare.");
      setStep(1);
      return;
    }
    if (
      kind === "publish" &&
      (((form.assignmentType || "individual") === "individual" && !form.assignments.length) ||
        (form.assignmentType === "group" && !form.assignmentGroupId) ||
        (form.assignmentType === "all" && !recipients.length))
    ) {
      setError("Selectează cel puțin un destinatar înainte de publicare.");
      setStep(2);
      return;
    }
    if (kind === "publish" && form.assignmentType === "group") {
      const selectedGroup = groups.find((g) => String(g.id) === String(form.assignmentGroupId));
      if (
        !selectedGroup ||
        selectedGroup.membersLoaded === false ||
        !(selectedGroup.members || []).some((member) => member.is_active !== false)
      ) {
        setError("Selectează un grup cu membri activi, încărcați corect.");
        setStep(2);
        return;
      }
    }
    if (
      kind === "publish" &&
      (!form.availableFrom ||
        !form.availableUntil ||
        Number.isNaN(new Date(form.availableFrom).getTime()) ||
        Number.isNaN(new Date(form.availableUntil).getTime()) ||
        Date.parse(form.availableUntil) <= Date.parse(form.availableFrom))
    ) {
      setError("Completează o perioadă de participare validă înainte de publicare.");
      setStep(2);
      return;
    }
    const callback = kind === "publish" ? onPublish : onSaveDraft;
    if (typeof callback !== "function") {
      setError(
        "Salvarea nu este conectată la API-ul BORDER. Furnizează funcția " +
          (kind === "publish" ? "onPublish" : "onSaveDraft") +
          ".",
      );
      return;
    }
    operationLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await callback({ ...form });
      const next = { ...form, ...(saved?.questions ? { questions: saved.questions } : {}) };
      setForm(next);
      setBaseline(JSON.stringify(next));
      toast.success(
        kind === "publish"
          ? assignmentOnly
            ? "Atribuirea a fost salvată."
            : "Testul a fost publicat și atribuit."
          : "Ciorna a fost salvată.",
      );
      setNotice(
        kind === "publish"
          ? "Publicarea a fost confirmată de funcția conectată."
          : "Salvarea a fost confirmată de funcția conectată.",
      );
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || "Operația a eșuat.";
      setError(message);
      toast.error(message);
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  };
  const newId = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const questionType = (q) => {
    const type = q?.type ?? q?.question_type;
    if (type === "multiple" || type === "MULTIPLE_CHOICE") return "multiple";
    if (type === "truefalse" || type === "TRUE_FALSE") return "truefalse";
    return "single";
  };
  const questionValid = (q) => {
    if (!String(q?.text || "").trim() || !(Number(q?.points ?? 1) > 0)) return false;
    const answers = Array.isArray(q.answers) ? q.answers : [];
    const type = questionType(q);
    const correctCount = answers.filter((a) => a.correct).length;
    if (type === "truefalse") {
      return (
        answers.length === 2 &&
        answers[0].text === "Adevărat" &&
        answers[1].text === "Fals" &&
        correctCount === 1
      );
    }
    return (
      answers.length >= 2 &&
      answers.every((a) => String(a.text || "").trim()) &&
      (type === "multiple" ? correctCount >= 1 : correctCount === 1)
    );
  };
  const selectedIndex = Math.max(
    0,
    form.questions.findIndex((q) => q.id === selectedQuestionId),
  );
  const selectedQuestion = form.questions[selectedIndex] || null;
  const questionCounts = {
    single: form.questions.filter((q) => questionType(q) === "single").length,
    multiple: form.questions.filter((q) => questionType(q) === "multiple").length,
    truefalse: form.questions.filter((q) => questionType(q) === "truefalse").length,
  };
  const addQuestion = () => {
    const id = newId();
    setForm((f) => ({
      ...f,
      questions: [
        ...f.questions,
        {
          id,
          text: "",
          type: "single",
          points: 1,
          explanation: "",
          answers: [
            { text: "", correct: true },
            { text: "", correct: false },
          ],
        },
      ],
    }));
    setSelectedQuestionId(id);
  };
  const updateQuestion = (index, patch) =>
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  const removeQuestion = (index) => {
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }));
    setSelectedQuestionId(form.questions[index + 1]?.id || form.questions[index - 1]?.id || null);
  };
  const duplicateQuestion = (index) => {
    const id = newId();
    setForm((f) => {
      const next = [...f.questions];
      next.splice(index + 1, 0, {
        ...next[index],
        id,
        answers: (next[index].answers || []).map((a) => ({ ...a })),
      });
      return { ...f, questions: next };
    });
    setSelectedQuestionId(id);
  };
  const reorderQuestion = (from, to) => {
    if (from === to || from < 0 || to < 0 || to >= form.questions.length) return;
    setForm((f) => {
      const next = [...f.questions];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return { ...f, questions: next };
    });
  };
  const setCorrectAnswer = (index, answerIndex) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((q, i) => {
        if (i !== index) return q;
        const type = questionType(q);
        return {
          ...q,
          answers: (q.answers || []).map((answer, j) => ({
            ...answer,
            correct:
              type === "multiple"
                ? j === answerIndex
                  ? !answer.correct
                  : !!answer.correct
                : j === answerIndex,
          })),
        };
      }),
    }));
  };
  const changeQuestionType = (index, type) => {
    if (!["single", "multiple", "truefalse"].includes(type)) return;
    setForm((current) => ({
      ...current,
      questions: current.questions.map((q, i) => {
        if (i !== index) return q;
        if (type === "truefalse") {
          const previouslyCorrect = (q.answers || []).find((a) => a.correct);
          const value = String(previouslyCorrect?.text || "")
            .trim()
            .toLowerCase();
          return {
            ...q,
            type,
            answers: [
              { text: "Adevărat", correct: value === "adevărat" },
              { text: "Fals", correct: value === "fals" },
            ],
          };
        }
        const wasTrueFalse = questionType(q) === "truefalse";
        let answers = wasTrueFalse
          ? [
              { text: "", correct: true },
              { text: "", correct: false },
            ]
          : (q.answers || []).map((a) => ({ ...a }));
        while (answers.length < 2) answers.push({ text: "", correct: false });
        if (type === "single") {
          const firstCorrect = answers.findIndex((a) => a.correct);
          answers = answers.map((a, j) => ({
            ...a,
            correct: j === (firstCorrect >= 0 ? firstCorrect : 0),
          }));
        }
        return { ...q, type, answers };
      }),
    }));
  };
  const filteredRecipients = useMemo(
    () =>
      recipients.filter((r) =>
        String(r.name || r.label || "")
          .toLowerCase()
          .includes(recipientSearch.toLowerCase()),
      ),
    [recipients, recipientSearch],
  );
  const selectRecipient = (id, checked) =>
    set(
      "assignments",
      checked
        ? [...new Set([...(form.assignments || []).map(Number), Number(id)])]
        : (form.assignments || []).filter((v) => Number(v) !== Number(id)),
    );
  // Vizualizarea unei versiuni publicate nu montează formularele editabile.
  // Datele sunt doar afișate; nu există acțiuni de salvare, import sau publicare.
  if (readOnly) {
    const formatDate = (value) => {
      if (!value) return "—";
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("ro-RO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
    };
    const grading = { "grade-percent": "Notă și procent", grade: "Notă", percent: "Procent" };
    const rounding = {
      "one-decimal": "O zecimală",
      "two-decimals": "Două zecimale",
      integer: "Număr întreg",
    };
    const yesNo = (value) => (value == null ? "—" : value ? "Da" : "Nu");
    const detailRows = [
      ["Categorie", form.category || "—"],
      ["Încercări permise", form.maxAttempts ?? "—"],
      ["Întrebări per încercare", Number(form.questionLimit) || "Toate"],
      ["Navigare", form.navigationMode === "sequential" ? "Secvențială" : "Liberă"],
      [
        "Punctaj multiplu",
        { exact: "Integral", partial: "Parțial", penalized: "Cu penalizare" }[form.scoringMode],
      ],
      [
        "Interval între încercări",
        Number(form.retryIntervalHours) ? `${form.retryIntervalHours} ore` : "Fără interval",
      ],
      ["Nota maximă", form.maxGrade ?? "—"],
      ["Mod evaluare", grading[form.grading] ?? form.grading ?? "—"],
      ["Rotunjire", rounding[form.rounding] ?? form.rounding ?? "—"],
      ["Reîncercare", form.allowRetake == null ? "—" : form.allowRetake ? "Permisă" : "Nepermisă"],
      ["Afișare notă", yesNo(form.showGrade)],
      [
        "Dezvăluire răspunsuri",
        {
          NEVER: "Niciodată",
          AFTER_SUBMISSION: "După finalizare",
          AFTER_DEADLINE: "După termen",
          MANUAL: "Manual",
        }[form.revealAnswers ?? (form.showCorrect ? "AFTER_SUBMISSION" : "NEVER")],
      ],
      ["Monitorizare file", yesNo(form.monitorTabs)],
      ["Prag avertizare", form.monitorTabs ? form.tabWarningLimit : "—"],
      [
        "Inactivitate",
        Number(form.idleWarningMinutes) ? `${form.idleWarningMinutes} min` : "Dezactivată",
      ],
      ["Notificare finalizare", yesNo(form.notifyResult)],
      ["Explicații", yesNo(form.showExplanations)],
      ["Amestecare întrebări", yesNo(form.shuffleQuestions)],
      ["Amestecare răspunsuri", yesNo(form.shuffleAnswers)],
    ];
    const metrics = [
      ["Durată", form.duration == null ? "—" : `${form.duration} min`, Clock3],
      ["Întrebări", form.questions.length, ClipboardList],
      ["Promovare", form.passThreshold == null ? "—" : `${form.passThreshold}%`, Target],
    ];
    return (
      <main className="pte-page pte-readonly">
        <div className="pte-ro-top">
          <button type="button" className="pte-link" onClick={() => safeLeave(onCancel)}>
            <ArrowLeft size={18} /> Înapoi la Teste
          </button>
          <button
            type="button"
            className="pte-btn pte-btn-light"
            onClick={() => safeLeave(onRefresh)}
            disabled={!onRefresh}
          >
            <RefreshCw size={16} /> Actualizează
          </button>
        </div>
        <header className="pte-ro-hero">
          <div className="pte-ro-heading">
            <span className="pte-logo">
              <FileText size={28} />
            </span>
            <div>
              <span className="pte-ro-eyebrow">BORDER / TESTARE PROFESIONALĂ</span>
              <h1>{form.title || "Vizualizare test"}</h1>
              <p>{form.category || "Test profesional"} · Versiune publicată</p>
            </div>
          </div>
          <div className="pte-ro-metrics">
            {metrics.map(([label, value, Icon]) => (
              <div className="pte-ro-metric" key={label}>
                <Icon size={20} aria-hidden="true" />
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="pte-ro-notice" role="status">
            <ShieldCheck size={19} />
            <span>
              Test publicat · Doar vizualizare. Întrebările și regulile nu pot fi modificate.
            </span>
          </div>
        </header>
        <div className="pte-ro-layout">
          <Card
            icon={Settings2}
            title="Configurarea testului"
            subtitle="Informațiile versiunii publicate"
          >
            {form.description && <p className="pte-ro-description">{form.description}</p>}
            <dl className="pte-ro-details">
              {detailRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="pte-ro-period">
              <h3>
                <CalendarDays size={19} /> Perioada de disponibilitate
              </h3>
              <div>
                <span>Început</span>
                <strong>{formatDate(form.availableFrom)}</strong>
              </div>
              <div>
                <span>Sfârșit</span>
                <strong>{formatDate(form.availableUntil)}</strong>
              </div>
            </div>
          </Card>
          <section className="pte-ro-questions" aria-label="Întrebările testului">
            <div className="pte-ro-section-heading">
              <ClipboardList size={24} />
              <div>
                <h2>Întrebările testului</h2>
                <p>Conținutul versiunii publicate</p>
              </div>
              <span>{form.questions.length}</span>
            </div>
            {!form.questions.length && (
              <p className="pte-empty">Nu există întrebări disponibile.</p>
            )}
            {form.questions.map((question, index) => (
              <article className="pte-ro-question" key={question.id ?? index}>
                <div className="pte-ro-question-head">
                  <span className="pte-ro-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>Întrebarea {index + 1}</h3>
                    <p>
                      {questionType(question) === "multiple"
                        ? "Răspuns multiplu"
                        : questionType(question) === "truefalse"
                          ? "Adevărat sau fals"
                          : "Răspuns unic"}
                    </p>
                  </div>
                  <span className="pte-ro-points">
                    {question.points ?? "—"} {Number(question.points) === 1 ? "punct" : "puncte"}
                  </span>
                </div>
                <p className="pte-ro-question-text">{question.text}</p>
                <ul className="pte-ro-answers">
                  {(question.answers || []).map((answer, answerIndex) => (
                    <li
                      key={answerIndex}
                      className={`pte-ro-answer${answer.correct ? " is-correct" : ""}`}
                    >
                      {answer.correct ? (
                        <CheckCircle2 size={20} aria-hidden="true" />
                      ) : (
                        <Circle size={20} aria-hidden="true" />
                      )}
                      <span>{answer.text}</span>
                      {answer.correct && <small>Corect</small>}
                    </li>
                  ))}
                </ul>
                {question.explanation && (
                  <div className="pte-ro-explanation">
                    <Lightbulb size={18} />
                    <div>
                      <strong>Explicație</strong>
                      <p>{question.explanation}</p>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>
        </div>
        <footer className="pte-ro-footer">
          <button type="button" className="pte-btn" onClick={() => safeLeave(onCancel)}>
            <ArrowLeft size={18} /> Înapoi la Teste
          </button>
        </footer>
      </main>
    );
  }

  return (
    <main className="pte-page">
      <div className="pte-topline">
        <button className="pte-link" onClick={() => safeLeave(onCancel)}>
          <ArrowLeft size={17} /> Înapoi la Teste
        </button>
        <span>BORDER / TESTARE PROFESIONALĂ</span>
      </div>
      <header className="pte-header">
        <div className="pte-heading">
          <span className="pte-logo">
            <FileText size={31} />
          </span>
          <div>
            <h1>{assignmentOnly ? "Atribuire nouă" : "Creează test"}</h1>
            <p>
              {assignmentOnly
                ? "Selectează destinatarii și perioada pentru testul publicat."
                : step === 1
                  ? "Adaugă, editează și gestionează întrebările testului."
                  : step === 2
                    ? "Atribuie testul către utilizatori, grupuri sau tuturor angajaților."
                    : step === 3
                      ? "Verifică toate informațiile, apoi publică testul."
                      : "Configurează un test nou, adaugă întrebări, atribuie destinatari și publică."}
            </p>
          </div>
        </div>
        <button className="pte-btn pte-btn-light" onClick={() => safeLeave(onRefresh)}>
          <RefreshCw size={17} /> Actualizează
        </button>
      </header>
      <nav className="pte-steps" aria-label="Etapele creării testului">
        {STEPS.map(([title, subtitle], i) => (
          <React.Fragment key={title}>
            <button
              className={"pte-step " + (step === i ? "active " : "") + (i < step ? "done" : "")}
              disabled={busy || (assignmentOnly && i < 2)}
              onClick={() => move(i)}
            >
              <span className="pte-step-number">{i < step ? <Check size={18} /> : i + 1}</span>
              <span>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </span>
            </button>
            {i < 3 && <ChevronRight className="pte-step-arrow" size={20} />}
          </React.Fragment>
        ))}
      </nav>
      {error && (
        <div className="pte-alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="pte-alert success" role="status">
          {notice}
        </div>
      )}
      <div
        className={
          "pte-layout " +
          (step === 1 ? "pte-layout-questions" : step === 3 ? "pte-layout-summary" : "")
        }
      >
        <div className="pte-main">
          {step === 0 && <DetaliiTest form={form} set={set} />}
          {step === 1 && (
            <>
              <QuestionBank
                currentQuestions={form.questions}
                category={form.category}
                onAdd={(items) =>
                  setForm((f) => ({
                    ...f,
                    questions: [...f.questions, ...items.map((q) => ({ ...q, id: newId() }))],
                  }))
                }
              />
              <Intrebari
                form={form}
                set={set}
                onImportQuestions={onImportQuestions}
                onExportQuestions={onExportQuestions}
                onPreview={onPreview}
                newId={newId}
                setSelectedQuestionId={setSelectedQuestionId}
                addQuestion={addQuestion}
                selectedIndex={selectedIndex}
                setDraggedQuestion={setDraggedQuestion}
                draggedQuestion={draggedQuestion}
                reorderQuestion={reorderQuestion}
                questionType={questionType}
                questionValid={questionValid}
                duplicateQuestion={duplicateQuestion}
                questionCounts={questionCounts}
                selectedQuestion={selectedQuestion}
                updateQuestion={updateQuestion}
                changeQuestionType={changeQuestionType}
                setCorrectAnswer={setCorrectAnswer}
                showExplanation={showExplanation}
                setShowExplanation={setShowExplanation}
                removeQuestion={removeQuestion}
              />
            </>
          )}
          {step === 2 && (
            <Atribuire
              form={form}
              set={set}
              recipientSearch={recipientSearch}
              setRecipientSearch={setRecipientSearch}
              recipients={recipients}
              groups={groups}
              groupsLoading={groupsLoading}
              groupsError={groupsError}
              onGroupsChanged={onGroupsChanged}
              filteredRecipients={filteredRecipients}
              selectRecipient={selectRecipient}
              recipientsLoading={recipientsLoading}
              recipientsError={recipientsError}
            />
          )}
          {step === 3 && (
            <Rezumat
              form={form}
              busy={busy}
              execute={execute}
              move={move}
              onPreview={onPreview}
              questionValid={questionValid}
            />
          )}
        </div>
        {step !== 1 && step !== 3 && (
          <aside className="pte-aside">
            <Card icon={ClipboardList} title="Progres creare test">
              <div className="pte-progress">
                <div className="pte-donut" style={{ "--progress": progress + "%" }}>
                  <strong>{progress}%</strong>
                  <small>Pasul {step + 1} din 4</small>
                </div>
                <div className="pte-progress-list">
                  {STEPS.map(([title], i) => (
                    <button
                      key={title}
                      className={i === step ? "selected" : ""}
                      disabled={busy || (assignmentOnly && i < 2)}
                      onClick={() => move(i)}
                    >
                      <span className={i < step ? "completed" : ""}>
                        {i < step ? <Check size={14} /> : i + 1}
                      </span>
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
            <Card icon={FileText} title="Informații test">
              <div className="pte-info">
                {[
                  ["Categorie", form.category || "Neselectată"],
                  ["Durată", form.duration + " minute"],
                  ["Încercări", form.maxAttempts],
                  ["Prag promovare", form.passThreshold + "%"],
                  ["Nota maximă", form.maxGrade],
                  ["Întrebări în bancă", form.questions.length],
                  ["Întrebări per încercare", Number(form.questionLimit) || "Toate"],
                  ["Navigare", form.navigationMode === "sequential" ? "Secvențială" : "Liberă"],
                  [
                    "Punctaj multiplu",
                    { exact: "Integral", partial: "Parțial", penalized: "Cu penalizare" }[
                      form.scoringMode
                    ],
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}:</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card icon={Lightbulb} title="Sfaturi utile">
              <div className="pte-tips">
                {[
                  "Definește un titlu clar și o descriere relevantă.",
                  "Stabilește realist durata și numărul de încercări.",
                  "Poți adăuga întrebări manual sau prin import.",
                  "Verifică toate setările înainte de publicare.",
                ].map((t) => (
                  <p key={t}>
                    <Check size={16} />
                    {t}
                  </p>
                ))}
              </div>
            </Card>
          </aside>
        )}
      </div>
      <footer className="pte-footer">
        {(step === 1 || step === 3) && (
          <button type="button" className="pte-btn pte-btn-light" onClick={() => move(step - 1)}>
            <ArrowLeft size={18} /> Pasul anterior
          </button>
        )}
        {step !== 1 && step !== 3 && (
          <button className="pte-btn pte-btn-light" onClick={() => safeLeave(onCancel)}>
            <X size={18} /> Anulează
          </button>
        )}
        {step === 1 && (
          <div
            className={`pte-questions-validation ${form.questions.length && form.questions.every(questionValid) ? "is-valid" : "is-pending"}`}
            role="status"
          >
            {form.questions.length && form.questions.every(questionValid) ? (
              <>
                <CheckCircle2 size={19} /> Toate întrebările sunt complete și valide.
              </>
            ) : (
              <>
                <AlertCircle size={18} /> {form.questions.filter(questionValid).length} din{" "}
                {form.questions.length} întrebări complete
              </>
            )}
          </div>
        )}
        <div className="pte-footer-actions">
          {!assignmentOnly && (
            <button
              className="pte-btn pte-btn-light"
              disabled={busy}
              onClick={() => execute("draft")}
            >
              <Save size={18} /> Salvează ca ciornă
            </button>
          )}
          {step < 3 ? (
            <button
              className="pte-btn pte-btn-primary"
              disabled={busy}
              onClick={() => move(step + 1)}
            >
              Următorul pas <ArrowRight size={18} />
            </button>
          ) : (
            <button
              className="pte-btn pte-btn-primary"
              disabled={busy}
              onClick={() => execute("publish")}
            >
              <ShieldCheck size={18} /> {assignmentOnly ? "Salvează atribuirea" : "Publică testul"}
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}
