import DetaliiTest from "./DetaliiTest";
import Intrebari from "./Intrebari";
import Atribuire from "./Atribuire";
import Rezumat from "./Rezumat";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
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
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [draggedQuestion, setDraggedQuestion] = useState(null);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const progress = (step + 1) * 25;
  const valid = () => {
    if (!form.title.trim()) return "Completează titlul testului.";
    if (!form.category) return "Selectează categoria.";
    if (!(Number(form.duration) > 0)) return "Durata trebuie să fie mai mare decât zero.";
    if (!(Number(form.maxAttempts) >= 1)) return "Numărul de încercări trebuie să fie cel puțin 1.";
    if (Number(form.passThreshold) < 0 || Number(form.passThreshold) > 100)
      return "Pragul de promovare trebuie să fie între 0 și 100.";
    if (
      form.availableFrom &&
      form.availableUntil &&
      new Date(form.availableUntil) <= new Date(form.availableFrom)
    )
      return "Data finală trebuie să fie după data inițială.";
    return "";
  };
  const move = (next) => {
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
        Number.isNaN(new Date(form.availableUntil).getTime()))
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
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await callback({ ...form });
      if (saved?.questions) setForm((current) => ({ ...current, questions: saved.questions }));
      setNotice(
        kind === "publish"
          ? "Publicarea a fost confirmată de funcția conectată."
          : "Salvarea a fost confirmată de funcția conectată.",
      );
    } catch (e) {
      setError(e?.message || "Operația a eșuat.");
    } finally {
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
    const detailRows = [
      ["Categorie", form.category || "—"],
      ["Durată", `${form.duration ?? "—"} minute`],
      ["Încercări permise", form.maxAttempts ?? "—"],
      ["Prag promovare", `${form.passThreshold ?? "—"}%`],
      ["Nota maximă", form.maxGrade ?? "—"],
      ["Mod evaluare", form.grading || "—"],
      ["Rotunjire", form.rounding || "—"],
      ["Reîncercare", form.allowRetake ? "Permisă" : "Nepermisă"],
      ["Afișare notă", form.showGrade ? "Da" : "Nu"],
      ["Explicații", form.showExplanations ? "Da" : "Nu"],
      ["Amestecare întrebări", form.shuffleQuestions ? "Da" : "Nu"],
      ["Amestecare răspunsuri", form.shuffleAnswers ? "Da" : "Nu"],
      ["Disponibil de la", form.availableFrom || "—"],
      ["Disponibil până la", form.availableUntil || "—"],
    ];
    return (
      <main className="pte-page">
        <div className="pte-topline">
          <button type="button" className="pte-link" onClick={() => onCancel?.()}>
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
              <h1>{form.title || "Vizualizare test"}</h1>
              <p>Versiune publicată · vizualizare doar în citire</p>
            </div>
          </div>
          <button type="button" className="pte-btn pte-btn-light" onClick={() => onRefresh?.()}>
            <RefreshCw size={17} /> Actualizează
          </button>
        </header>
        <div className="pte-alert success" role="status">
          <ShieldCheck size={18} /> Această versiune este publicată. Întrebările și regulile nu pot
          fi modificate.
        </div>
        <div className="pte-layout">
          <div className="pte-main">
            <Card icon={FileText} title="Detalii test" subtitle="Informațiile versiunii publicate">
              {form.description && <p>{form.description}</p>}
              <div className="pte-info">
                {detailRows.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}:</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card
              icon={ClipboardList}
              title={`Întrebări (${form.questions.length})`}
              subtitle="Conținutul testului publicat"
            >
              {form.questions.length === 0 && <p>Nu există întrebări disponibile.</p>}
              {form.questions.map((question, index) => (
                <section
                  key={question.id ?? index}
                  style={{ padding: "16px 0", borderBottom: "1px solid #e7ecf7" }}
                >
                  <h3 style={{ margin: "0 0 10px", overflowWrap: "anywhere" }}>
                    {index + 1}. {question.text}
                  </h3>
                  <p style={{ margin: "0 0 10px" }}>
                    {questionType(question) === "multiple"
                      ? "Răspuns multiplu"
                      : questionType(question) === "truefalse"
                        ? "Adevărat sau fals"
                        : "Răspuns unic"}{" "}
                    · {question.points} puncte
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(question.answers || []).map((answer, answerIndex) => (
                      <div
                        key={answerIndex}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #e7ecf7",
                          background: answer.correct ? "#eaf8ef" : "#f8faff",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {answer.correct ? "✓ " : "○ "}
                        {answer.text}
                      </div>
                    ))}
                  </div>
                  {question.explanation && (
                    <p style={{ marginTop: 12 }}>Explicație: {question.explanation}</p>
                  )}
                </section>
              ))}
            </Card>
          </div>
        </div>
        <footer className="pte-footer">
          <button type="button" className="pte-btn pte-btn-light" onClick={() => onCancel?.()}>
            <ArrowLeft size={18} /> Înapoi la Teste
          </button>
        </footer>
      </main>
    );
  }

  return (
    <main className="pte-page">
      <div className="pte-topline">
        <button className="pte-link" onClick={() => onCancel?.()}>
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
        <button className="pte-btn pte-btn-light" onClick={() => onRefresh?.()}>
          <RefreshCw size={17} /> Actualizează
        </button>
      </header>
      <nav className="pte-steps" aria-label="Etapele creării testului">
        {STEPS.map(([title, subtitle], i) => (
          <React.Fragment key={title}>
            <button
              className={"pte-step " + (step === i ? "active " : "") + (i < step ? "done" : "")}
              disabled={assignmentOnly && i < 2}
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
                      disabled={assignmentOnly && i < 2}
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
                  ["Întrebări", form.questions.length],
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
        {(step === 1 || (step === 3 && !assignmentOnly)) && (
          <button type="button" className="pte-btn pte-btn-light" onClick={() => move(step - 1)}>
            <ArrowLeft size={18} /> Pasul anterior
          </button>
        )}
        {step !== 1 && step !== 3 && (
          <button className="pte-btn pte-btn-light" onClick={() => onCancel?.()}>
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
            <button className="pte-btn pte-btn-primary" onClick={() => move(step + 1)}>
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
