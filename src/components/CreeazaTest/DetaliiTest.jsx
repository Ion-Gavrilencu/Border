import React from "react";
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

const CATEGORIES = [
  "Activitate operațională",
  "Legislație",
  "Management",
  "Documente",
  "Juridic",
  "General",
];

function Field({ label, required = false, hint, icon: Icon, children, className = "" }) {
  return (
    <div className={`pte-field ptd-field ${className}`}>
      <div className="ptd-label-line">
        <label className="ptd-field-label">
          {label}
          {required && <b> *</b>}
        </label>

        {hint && (
          <span className="ptd-hint" title={hint} aria-label={hint}>
            <Info size={15} />
          </span>
        )}
      </div>

      <div className="ptd-input-wrap">
        {Icon && <Icon className="ptd-input-icon" size={19} aria-hidden="true" />}

        {children}
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="pte-switch-row ptd-switch-row">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />

      <span className="pte-switch" aria-hidden="true" />

      <span className="ptd-switch-text">{label}</span>

      {hint && (
        <span className="ptd-hint" title={hint}>
          <Info size={15} />
        </span>
      )}
    </label>
  );
}

export default function DetaliiTest({ form, set }) {
  return (
    <section className="pte-card ptd-details-card" aria-labelledby="ptd-title">
      <div className="pte-card-heading ptd-card-heading">
        <span className="pte-section-icon">
          <ClipboardList size={26} />
        </span>

        <div>
          <h2 id="ptd-title">Detalii test</h2>
          <p>Completează informațiile de bază ale testului.</p>
        </div>
      </div>

      <div className="pte-fields two ptd-general-grid">
        <Field label="Titlu test" required>
          <input
            aria-label="Titlu test"
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex.: Testarea cunoștințelor de frontieră"
          />
        </Field>

        <Field label="Categorie" required icon={ShieldCheck}>
          <select
            aria-label="Categorie"
            value={form.category ?? ""}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Selectează categoria</option>

            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Descriere (opțional)" className="ptd-description">
        <textarea
          aria-label="Descriere"
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Descrie obiectivul și conținutul testului..."
        />
      </Field>

      <h3 className="pte-subtitle ptd-section-title">
        <SlidersHorizontal size={23} />
        Setări de evaluare
      </h3>

      <div className="pte-soft-panel pte-fields three ptd-evaluation-grid">
        <Field label="Metodă de notare" hint="Alege cum este afișat rezultatul" icon={Layers3}>
          <select
            aria-label="Metodă de notare"
            value={form.grading ?? "grade-percent"}
            onChange={(e) => set("grading", e.target.value)}
          >
            <option value="grade-percent">Notă + procent</option>
            <option value="percent">Doar procent</option>
            <option value="grade">Doar notă</option>
          </select>
        </Field>

        <Field label="Prag de promovare" required icon={Target}>
          <input
            aria-label="Prag de promovare"
            type="number"
            min="0"
            max="100"
            value={form.passThreshold ?? ""}
            onChange={(e) => set("passThreshold", e.target.value)}
          />
          <span className="ptd-input-suffix">%</span>
        </Field>

        <Field label="Nota maximă" icon={Star}>
          <input
            aria-label="Nota maximă"
            type="number"
            min="1"
            max="100"
            value={form.maxGrade ?? ""}
            onChange={(e) => set("maxGrade", e.target.value)}
          />
        </Field>

        <Field label="Rotunjire notă" icon={Calculator}>
          <select
            aria-label="Rotunjire notă"
            value={form.rounding ?? "one-decimal"}
            onChange={(e) => set("rounding", e.target.value)}
          >
            <option value="one-decimal">La o zecimală (ex. 8,5)</option>
            <option value="integer">La număr întreg</option>
            <option value="two-decimals">La două zecimale</option>
          </select>
        </Field>

        <Field label="Durata testului" required icon={Clock3}>
          <input
            aria-label="Durata testului în minute"
            type="number"
            min="1"
            value={form.duration ?? ""}
            onChange={(e) => set("duration", e.target.value)}
          />
          <span className="ptd-input-suffix">minute</span>
        </Field>

        <Field label="Număr de încercări" icon={RefreshCw}>
          <input
            aria-label="Număr de încercări"
            type="number"
            min="1"
            value={form.maxAttempts ?? ""}
            onChange={(e) => set("maxAttempts", e.target.value)}
          />
        </Field>
      </div>

      <h3 className="pte-subtitle ptd-section-title">
        <Settings2 size={23} />
        Opțiuni suplimentare
      </h3>

      <div className="pte-soft-panel pte-switch-grid ptd-options-grid">
        <Switch
          checked={form.allowRetake}
          onChange={(value) => set("allowRetake", value)}
          label="Permite reluarea testului după finalizare"
        />

        <Switch
          checked={form.showCorrect}
          onChange={(value) => set("showCorrect", value)}
          label="Afișează răspunsurile corecte"
        />

        <Switch
          checked={form.showGrade}
          onChange={(value) => set("showGrade", value)}
          label="Afișează nota imediat după finalizare"
        />

        <Switch
          checked={form.shuffleQuestions}
          onChange={(value) => set("shuffleQuestions", value)}
          label="Amestecă întrebările"
        />

        <Switch
          checked={form.showExplanations}
          onChange={(value) => set("showExplanations", value)}
          label="Afișează explicații la răspunsuri"
        />

        <Switch
          checked={form.shuffleAnswers}
          onChange={(value) => set("shuffleAnswers", value)}
          label="Amestecă variantele de răspuns"
        />
      </div>
    </section>
  );
}
