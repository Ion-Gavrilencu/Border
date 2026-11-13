import React from "react";
import {
  FileText,
  SlidersHorizontal,
  Layers3,
  Users,
  Pencil,
  Clock3,
  Trophy,
  Star,
  RefreshCw,
  CalendarDays,
  Bell,
  CheckCircle2,
  Circle,
  AlertCircle,
  Target,
  ClipboardCheck,
  Play,
  Eye,
  Info,
  ShieldCheck,
  Tag,
  ListChecks,
} from "lucide-react";
import "./Rezumat.css";

const fmtDate = (value) => {
  if (!value) return "Nesetată";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Dată invalidă"
    : date.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
};
const labelGrading = {
  "grade-percent": "Notă + procent",
  percent: "Doar procent",
  grade: "Doar notă",
};
const labelRounding = {
  "one-decimal": "La o zecimală (ex. 8,5)",
  integer: "La număr întreg",
  "two-decimals": "La două zecimale",
};

function EditButton({ step, move }) {
  return (
    <button type="button" className="pte-btn pte-btn-light pte-r-edit" onClick={() => move(step)}>
      <Pencil size={17} /> Editează
    </button>
  );
}
function Line({ icon: Icon, label, children }) {
  return (
    <div className="pte-r-line">
      <Icon size={19} className="pte-r-line-icon" />
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

export default function Rezumat({ form, move, onPreview, questionValid, busy }) {
  const questions = Array.isArray(form.questions) ? form.questions : [];
  const assignments = Array.isArray(form.assignments) ? form.assignments : [];
  const counts = questions.reduce(
    (acc, q) => {
      const type = q.type === "multiple" ? "multiple" : q.type === "open" ? "open" : "single";
      acc[type] += 1;
      return acc;
    },
    { single: 0, multiple: 0, open: 0 },
  );
  const points = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const periodValid =
    !!form.availableFrom &&
    !!form.availableUntil &&
    !Number.isNaN(new Date(form.availableFrom).getTime()) &&
    !Number.isNaN(new Date(form.availableUntil).getTime()) &&
    new Date(form.availableUntil) > new Date(form.availableFrom);
  const checks = [
    {
      text: "Detaliile testului sunt complete",
      ok:
        !!String(form.title || "").trim() &&
        !!form.category &&
        Number(form.duration) > 0 &&
        Number(form.maxAttempts) >= 1,
    },
    {
      text: `Există cel puțin o întrebare (${questions.length})`,
      ok:
        questions.length > 0 &&
        questions.every((q) =>
          typeof questionValid === "function" ? questionValid(q) : !!String(q.text || "").trim(),
        ),
    },
    {
      text: `Pragul de promovare este valid (${form.passThreshold}%)`,
      ok:
        form.passThreshold !== "" &&
        Number(form.passThreshold) >= 0 &&
        Number(form.passThreshold) <= 100,
    },
    { text: `Destinatarii au fost selectați (${assignments.length})`, ok: assignments.length > 0 },
    { text: "Perioada de participare este validă", ok: periodValid },
    {
      text: "Setările de evaluare sunt valide",
      ok: Number(form.maxGrade) > 0 && Number(form.maxAttempts) >= 1 && Number(form.duration) > 0,
    },
  ];
  const complete = checks.filter((c) => c.ok).length;
  const percent = Math.round((complete / checks.length) * 100);
  const ready = checks.every((c) => c.ok);
  const assignmentType =
    form.assignmentType || (assignments.length ? "Destinatari selectați" : "Neconfigurată");
  const assignmentLabel =
    assignmentType === "group"
      ? "Către un grup"
      : assignmentType === "all"
        ? "Către toți utilizatorii"
        : assignmentType === "individual"
          ? "Individual"
          : assignmentType;
  const groupLabel = form.selectedGroupName || form.groupName || "";
  const notificationEnabled = form.notifyOnAssign ?? form.notifyUsers ?? false;
  const reminderEnabled = form.sendReminder ?? form.reminderEnabled ?? false;

  return (
    <div className="pte-r-grid">
      <section className="pte-r-primary pte-card">
        <div className="pte-card-heading pte-r-heading">
          <span className="pte-section-icon pte-r-blue">
            <FileText size={26} />
          </span>
          <div>
            <h2>Rezumat test</h2>
            <p>Prezentarea finală a configurației testului.</p>
          </div>
        </div>
        <div className="pte-r-sections">
          <section className="pte-r-section pte-r-details">
            <span className="pte-r-icon">
              <FileText />
            </span>
            <h3>Detalii test</h3>
            <div className="pte-r-section-body pte-r-detail-fields">
              <div>
                <b>Titlu:</b>
                <strong>{form.title || "Necompletat"}</strong>
              </div>
              <div>
                <b>Categorie:</b>
                <span className="pte-r-pill">{form.category || "Neselectată"}</span>
              </div>
              <div>
                <b>Descriere:</b>
                <span>{form.description || "Nu a fost adăugată o descriere."}</span>
              </div>
            </div>
            <EditButton step={0} move={move} />
          </section>
          <section className="pte-r-section pte-r-evaluation">
            <span className="pte-r-icon">
              <SlidersHorizontal />
            </span>
            <h3>Configurare evaluare</h3>
            <div className="pte-r-section-body pte-r-metrics">
              <div>
                <Clock3 />
                <span>
                  Durată:<strong>{form.duration} minute</strong>
                </span>
              </div>
              <div>
                <Trophy />
                <span>
                  Prag promovare:<strong>{form.passThreshold}%</strong>
                </span>
              </div>
              <div>
                <Star />
                <span>
                  Nota maximă:<strong>{form.maxGrade}</strong>
                </span>
              </div>
              <div>
                <RefreshCw />
                <span>
                  Încercări permise:<strong>{form.maxAttempts}</strong>
                </span>
              </div>
              <div>
                <Layers3 />
                <span>
                  Metodă de notare:
                  <strong className="pte-r-pill">
                    {labelGrading[form.grading] || form.grading || "Nesetată"}
                  </strong>
                </span>
              </div>
              <div>
                <CalendarDays />
                <span>
                  Rotunjire notă:
                  <strong className="pte-r-pill">
                    {labelRounding[form.rounding] || form.rounding || "Nesetată"}
                  </strong>
                </span>
              </div>
            </div>
            <EditButton step={0} move={move} />
          </section>
          <section className="pte-r-section pte-r-questions">
            <span className="pte-r-icon">
              <Layers3 />
            </span>
            <h3>Întrebări</h3>
            <div className="pte-r-section-body pte-r-question-metrics">
              <div>
                <small>Total întrebări:</small>
                <strong className="pte-r-big">{questions.length}</strong>
              </div>
              <div>
                <Circle />
                <span>
                  Un singur răspuns:
                  <strong>
                    {counts.single} (
                    {questions.length ? Math.round((counts.single / questions.length) * 100) : 0}%)
                  </strong>
                </span>
              </div>
              <div>
                <Circle />
                <span>
                  Răspuns multiplu:
                  <strong>
                    {counts.multiple} (
                    {questions.length ? Math.round((counts.multiple / questions.length) * 100) : 0}
                    %)
                  </strong>
                </span>
              </div>
              <div>
                <ListChecks />
                <span>
                  Deschis:
                  <strong>
                    {counts.open} (
                    {questions.length ? Math.round((counts.open / questions.length) * 100) : 0}%)
                  </strong>
                </span>
              </div>
              <div className="pte-r-points">
                <small>Punctaj total:</small>
                <strong>{points} puncte</strong>
              </div>
            </div>
            <EditButton step={1} move={move} />
          </section>
          <section className="pte-r-section pte-r-assignments">
            <span className="pte-r-icon">
              <Users />
            </span>
            <h3>Atribuire</h3>
            <div className="pte-r-section-body pte-r-assignment-metrics">
              <div>
                <Users />
                <span>
                  Tip atribuire:<strong>{assignmentLabel}</strong>
                </span>
              </div>
              {groupLabel && (
                <div>
                  <Layers3 />
                  <span>
                    Grup:<strong>{groupLabel}</strong>
                  </span>
                </div>
              )}
              <div>
                <Users />
                <span>
                  Destinatari:<strong>{assignments.length} selectați</strong>
                </span>
              </div>
              <div className="pte-r-period">
                <CalendarDays />
                <span>
                  Perioada de participare:
                  <strong>
                    {fmtDate(form.availableFrom)} – {fmtDate(form.availableUntil)}
                  </strong>
                </span>
              </div>
              <div>
                <Bell />
                <span>
                  Notificări:
                  <strong>
                    {notificationEnabled
                      ? `Activate${reminderEnabled ? " (cu reminder)" : ""}`
                      : "Neactivate sau neconfigurate"}
                  </strong>
                </span>
              </div>
            </div>
            <EditButton step={2} move={move} />
          </section>
        </div>
      </section>
      <aside className="pte-r-aside">
        <section className="pte-card pte-r-ready">
          <h3>
            <Target /> Pregătire pentru publicare
          </h3>
          <div className="pte-r-ready-content">
            <div className="pte-r-ring" style={{ "--r-progress": `${percent}%` }}>
              <div>
                <strong>{percent}%</strong>
                <span>{ready ? "Gata de publicare" : "Verificări în curs"}</span>
              </div>
            </div>
            <div className={"pte-r-status " + (ready ? "is-ready" : "is-pending")}>
              {ready ? <CheckCircle2 /> : <AlertCircle />}
              <span>
                {ready
                  ? "Testul este complet configurat și poate fi publicat."
                  : `${complete} din ${checks.length} verificări îndeplinite. Completează elementele lipsă.`}
              </span>
            </div>
          </div>
        </section>
        <section className="pte-card pte-r-checks">
          <h3>
            <ClipboardCheck /> Verificări înainte de publicare
          </h3>
          <div>
            {checks.map((c) => (
              <div className="pte-r-check" key={c.text}>
                {c.ok ? <CheckCircle2 className="ok" /> : <AlertCircle className="pending" />}
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="pte-card pte-r-actions">
          <h3>
            <Play /> Acțiuni finale
          </h3>
          <button
            className="pte-btn pte-btn-light pte-r-preview"
            type="button"
            disabled={busy || typeof onPreview !== "function"}
            onClick={() => onPreview?.(form)}
          >
            <Eye /> Previzualizează testul
          </button>
          <p>
            <Info size={19} />{" "}
            {typeof onPreview === "function"
              ? "Poți previzualiza testul înainte de publicare. După publicare, disponibilitatea pentru destinatari depinde de configurarea platformei."
              : "Previzualizarea nu este conectată. Furnizează funcția onPreview existentă."}
          </p>
        </section>
      </aside>
    </div>
  );
}
