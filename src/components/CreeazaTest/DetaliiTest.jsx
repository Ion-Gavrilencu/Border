import React, { useId } from "react";
import {
  ClipboardList,
  SlidersHorizontal,
  Settings2,
  ShieldCheck,
  Layers3,
  Target,
  Star,
  Calculator,
  Clock3,
  RefreshCw,
  Info,
} from "lucide-react";
import "./DetaliiTest.css";
import "./DetaliiTestV4.css";

const CATEGORIES = [
  "Activitate operațională",
  "Legislație",
  "Management",
  "Documente",
  "Juridic",
  "General",
];
function Field({ label, required = false, hint, icon: Icon, children, className = "" }) {
  const id = useId();
  return (
    <div className={`pte-field ptd-field ${className}`}>
      <div className="ptd-label-line">
        <label className="ptd-field-label" htmlFor={id}>
          {label}
          {required && <b> *</b>}
        </label>
        {hint && (
          <span className="ptd-hint" title={hint}>
            <Info size={15} />
          </span>
        )}
      </div>
      <div className="ptd-input-wrap">
        {Icon && <Icon className="ptd-input-icon" size={19} aria-hidden="true" />}
        {React.Children.map(children, (child) =>
          React.isValidElement(child) && ["input", "select", "textarea"].includes(child.type)
            ? React.cloneElement(child, {
                id,
                required,
                "aria-describedby": hint ? `${id}-hint` : undefined,
              })
            : child,
        )}
      </div>
      {hint && (
        <small className="ptd-help" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}
function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="pte-switch-row ptd-switch-row">
      <input
        type="checkbox"
        role="switch"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pte-switch" aria-hidden="true" />
      <span className="ptd-switch-text">
        {label}
        {hint && <small className="ptd-help">{hint}</small>}
      </span>
    </label>
  );
}
export default function DetaliiTest({ form, set }) {
  const categories = [
    ...new Set([
      ...CATEGORIES,
      ...(Array.isArray(form.personalCategories) ? form.personalCategories : []),
      ...(form.category ? [form.category] : []),
    ]),
  ];
  const bind = (key) => ({ value: form[key] ?? "", onChange: (e) => set(key, e.target.value) });
  const toggle = (key) => ({ checked: form[key], onChange: (value) => set(key, value) });
  const canRetry = form.allowRetake && Number(form.maxAttempts) > 1;
  return (
    <section className="pte-card ptd-details-card" aria-labelledby="ptd-title">
      <div className="pte-card-heading ptd-card-heading">
        <span className="pte-section-icon">
          <ClipboardList size={26} />
        </span>
        <div>
          <h2 id="ptd-title">Detalii test</h2>
          <p>Completează informațiile de bază și regulile testului.</p>
        </div>
      </div>
      <div className="pte-fields two ptd-general-grid">
        <Field label="Titlu test" required>
          <input
            {...bind("title")}
            maxLength={250}
            placeholder="Ex.: Testarea cunoștințelor de frontieră"
          />
        </Field>
        <Field label="Categorie" required icon={ShieldCheck}>
          <select {...bind("category")}>
            <option value="">Selectează categoria</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Descriere (opțional)" className="ptd-description">
        <textarea
          {...bind("description")}
          rows={3}
          maxLength={10000}
          placeholder="Descrie obiectivul și conținutul testului..."
        />
      </Field>
      <h3 className="pte-subtitle ptd-section-title">
        <SlidersHorizontal size={23} /> Setări de evaluare
      </h3>
      <div className="pte-soft-panel pte-fields three ptd-evaluation-grid">
        <Field label="Metodă de notare" icon={Layers3}>
          <select {...bind("grading")}>
            <option value="grade-percent">Notă + procent</option>
            <option value="percent">Doar procent</option>
            <option value="grade">Doar notă</option>
          </select>
        </Field>
        <Field label="Prag de promovare" required icon={Target}>
          <input {...bind("passThreshold")} type="number" min="0" max="100" step="0.01" />
          <span className="ptd-input-suffix">%</span>
        </Field>
        <Field label="Nota maximă" icon={Star}>
          <input {...bind("maxGrade")} type="number" min="1" max="10" step="0.1" />
        </Field>
        <Field label="Rotunjire notă" icon={Calculator}>
          <select {...bind("rounding")}>
            <option value="one-decimal">La o zecimală (ex. 8,5)</option>
            <option value="integer">La număr întreg</option>
            <option value="two-decimals">La două zecimale</option>
          </select>
        </Field>
        <Field label="Durata testului" required icon={Clock3}>
          <input {...bind("duration")} type="number" min="1" max="480" step="1" />
          <span className="ptd-input-suffix">minute</span>
        </Field>
        <Field label="Număr de încercări" icon={RefreshCw}>
          <input {...bind("maxAttempts")} type="number" min="1" max="100" step="1" />
        </Field>
      </div>
      <div className="pte-soft-panel pte-fields two ptd-evaluation-grid" style={{ marginTop: 12 }}>
        <Field
          label="Punctaj răspunsuri multiple"
          hint="În modul cu penalizare, fiecare opțiune greșită anulează o opțiune corectă. Punctajul nu poate fi negativ."
        >
          <select {...bind("scoringMode")}>
            <option value="exact">Integral sau zero</option>
            <option value="partial">Parțial (zero dacă există opțiuni greșite)</option>
            <option value="penalized">Parțial cu penalizare</option>
          </select>
        </Field>
        <Field
          label="Navigare între întrebări"
          hint="În modul secvențial, următoarea întrebare se deblochează pe server; întrebările anterioare nu mai pot fi modificate."
        >
          <select {...bind("navigationMode")}>
            <option value="free">Navigare liberă</option>
            <option value="sequential">Secvențială, fără revenire</option>
          </select>
        </Field>
      </div>
      <h3 className="pte-subtitle ptd-section-title">
        <Settings2 size={23} /> Opțiuni suplimentare
      </h3>
      <div className="pte-soft-panel pte-switch-grid ptd-options-grid">
        <Switch {...toggle("allowRetake")} label="Permite reluarea testului după finalizare" />
        <Field
          label="Dezvăluirea răspunsurilor corecte"
          hint="Autorizarea manuală nu este încă implementată."
        >
          <select
            value={form.revealAnswers ?? (form.showCorrect ? "AFTER_SUBMISSION" : "NEVER")}
            onChange={(e) => set("revealAnswers", e.target.value)}
          >
            <option value="NEVER">Niciodată</option>
            <option value="AFTER_SUBMISSION">După finalizarea încercării</option>
            <option value="AFTER_DEADLINE">După expirarea termenului</option>
            {form.revealAnswers === "MANUAL" && (
              <option value="MANUAL">Manual (configurație existentă)</option>
            )}
          </select>
        </Field>
        <Switch {...toggle("showGrade")} label="Afișează nota imediat după finalizare" />
        <Switch {...toggle("shuffleQuestions")} label="Amestecă întrebările" />
        <Switch {...toggle("showExplanations")} label="Afișează explicații la răspunsuri" />
        <Switch {...toggle("shuffleAnswers")} label="Amestecă variantele de răspuns" />
      </div>
      <h3 className="pte-subtitle ptd-section-title">
        <ClipboardList size={23} /> Bancă de întrebări
      </h3>
      <div className="pte-soft-panel ptd-retry-panel">
        <Field
          label="Întrebări per încercare"
          icon={Layers3}
          hint="0 = toate întrebările. O valoare pozitivă selectează aleatoriu acel număr, fără repetări. Selecția rămâne fixă pe durata încercării."
        >
          <input {...bind("questionLimit")} type="number" min="0" max="10000" step="1" />
        </Field>
        <p className="ptd-help" role="status">
          În bancă: {form.questions.length} · Per încercare:{" "}
          {Number(form.questionLimit) || form.questions.length}
        </p>
        {Number(form.questionLimit) > form.questions.length && (
          <p className="ptd-help">Adaugă suficiente întrebări înainte de publicare.</p>
        )}
      </div>
      <h3 className="pte-subtitle ptd-section-title">
        <ShieldCheck size={23} /> Integritatea testării
      </h3>
      <div className="pte-soft-panel ptd-retry-panel">
        <Field
          label="Avertizare de inactivitate"
          hint="Intervalul maxim fără activitate. Finalizarea automată este opțională."
        >
          <select
            {...bind("idleWarningMinutes")}
            onChange={(e) => {
              set("idleWarningMinutes", e.target.value);
              if (!Number(e.target.value)) set("idleAutoFinish", false);
            }}
          >
            {[0, 2, 5, 10, 15, 30].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Dezactivată" : `${n} minute`}
              </option>
            ))}
          </select>
        </Field>
        <Switch
          checked={!!form.idleAutoFinish && Number(form.idleWarningMinutes) > 0}
          onChange={(v) => set("idleAutoFinish", v && Number(form.idleWarningMinutes) > 0)}
          label="Finalizează automat pentru inactivitate"
          hint="Avertizare cu 60 secunde înainte. Necesită pagina vizibilă și conexiune continuă."
        />
        <Switch
          {...toggle("notifyResult")}
          label="Notifică participantul la finalizare (în aplicație)"
        />
        <Switch
          {...toggle("monitorTabs")}
          label="Monitorizează ascunderea filei"
          hint="Participantul este informat. Evenimentele nu dovedesc fraudă și nu finalizează automat testul."
        />
        <Field label="Prag de avertizare">
          <select {...bind("tabWarningLimit")} disabled={!form.monitorTabs}>
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <h3 className="pte-subtitle ptd-section-title">
        <Clock3 size={23} /> Reguli de reîncercare
      </h3>
      <div className="pte-soft-panel ptd-retry-panel">
        <Field
          label="Interval minim între încercări"
          icon={Clock3}
          hint={
            canRetry
              ? "Se aplică după finalizarea sau expirarea unei încercări, în cadrul aceleiași atribuiri."
              : "Permite reluarea și configurează cel puțin două încercări pentru a utiliza intervalul."
          }
        >
          <select {...bind("retryIntervalHours")} disabled={!canRetry}>
            <option value="0">Fără interval</option>
            <option value="1">1 oră</option>
            <option value="24">24 ore</option>
            <option value="48">48 ore</option>
          </select>
        </Field>
      </div>
    </section>
  );
}
