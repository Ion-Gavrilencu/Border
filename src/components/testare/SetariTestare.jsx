import React, { useEffect, useRef, useState } from "react";
import {
  Settings,
  SlidersHorizontal,
  RotateCcw,
  BarChart3,
  Bell,
  CalendarDays,
  ShieldCheck,
  Layers3,
  Users,
  Trophy,
  Download,
  FileText,
  LockKeyhole,
  Info,
  Save,
  CheckCircle2,
  ClipboardList,
  Timer,
  ListChecks,
  BookTemplate,
} from "lucide-react";
import "./SetariTestare.css";
import "./SetariTestareV2.css";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { getTestPreferences, saveTestPreferences } from "../../services/professionalTestingService";

const CONFIG_KEYS = [
  "grading",
  "threshold",
  "maxGrade",
  "rounding",
  "attempts",
  "allowRetake",
  "retryIntervalHours",
  "questionLimit",
  "navigationMode",
  "scoringMode",
  "monitorTabs",
  "tabWarningLimit",
  "showGrade",
  "showAnswers",
  "showExplanations",
  "notifyAssignment",
  "notifyExpiry",
  "expiryHours",
  "duration",
  "validity",
  "shuffleQuestions",
  "shuffleAnswers",
  "idleWarningMinutes",
  "notifyResult",
];
const pickConfig = (v) =>
  Object.fromEntries(CONFIG_KEYS.filter((k) => Object.hasOwn(v, k)).map((k) => [k, v[k]]));
const defaults = {
  personalCategories: [],
  personalTemplates: [],
  idleWarningMinutes: "0",
  notifyResult: false,
  grading: "both",
  threshold: 50,
  maxGrade: 10,
  rounding: "one",
  attempts: 1,
  allowRetake: true,
  retryIntervalHours: "0",
  questionLimit: 0,
  navigationMode: "free",
  scoringMode: "exact",
  monitorTabs: false,
  tabWarningLimit: "3",
  showGrade: true,
  showAnswers: true,
  showExplanations: false,
  notifyAssignment: true,
  notifyExpiry: true,
  expiryHours: "24",
  notifyPublish: false,
  duration: "30",
  validity: "7",
  authenticated: true,
  idleTimeout: "10",
  blockNavigation: false,
  shuffleQuestions: false,
  shuffleAnswers: false,
};
const normalizePreferences = (saved) => {
  const next = {
    ...defaults,
    ...(saved || {}),
    authenticated: true,
    notifyPublish: false,
    blockNavigation: false,
  };
  for (const key of ["duration", "validity", "retryIntervalHours", "idleTimeout"])
    next[key] = String(next[key]);
  for (const key of [
    "allowRetake",
    "showGrade",
    "showAnswers",
    "showExplanations",
    "notifyAssignment",
    "notifyExpiry",
    "shuffleQuestions",
    "shuffleAnswers",
    "monitorTabs",
  ])
    if (typeof next[key] !== "boolean") next[key] = defaults[key];
  if (!["24", "48", "72"].includes(String(next.expiryHours))) next.expiryHours = "24";
  else next.expiryHours = String(next.expiryHours);
  if (!["0", "1", "24", "48"].includes(next.retryIntervalHours)) next.retryIntervalHours = "0";
  if (!["free", "sequential"].includes(next.navigationMode)) next.navigationMode = "free";
  if (!["exact", "partial", "penalized"].includes(next.scoringMode)) next.scoringMode = "exact";
  next.tabWarningLimit = ["1", "2", "3", "5", "10"].includes(String(next.tabWarningLimit))
    ? String(next.tabWarningLimit)
    : "3";
  next.personalCategories = Array.isArray(next.personalCategories)
    ? next.personalCategories.filter((v) => typeof v === "string").slice(0, 30)
    : [];
  next.personalTemplates = Array.isArray(next.personalTemplates)
    ? next.personalTemplates
        .filter((t) => t && typeof t.name === "string" && t.config && typeof t.config === "object")
        .slice(0, 10)
    : [];
  next.idleWarningMinutes = ["0", "2", "5", "10", "15", "30"].includes(
    String(next.idleWarningMinutes),
  )
    ? String(next.idleWarningMinutes)
    : "0";
  next.notifyResult = next.notifyResult === true;
  return next;
};
const sections = [
  { id: "general", label: "Generale", Icon: Settings },
  { id: "evaluation", label: "Evaluare și notare", Icon: Trophy },
  { id: "attempts", label: "Încercări și acces", Icon: RotateCcw },
  { id: "questions", label: "Configurarea întrebărilor", Icon: ListChecks },
  { id: "display", label: "Afișare rezultate", Icon: BarChart3 },
  { id: "notifications", label: "Notificări", Icon: Bell },
  { id: "categories", label: "Categorii", Icon: Layers3 },
  { id: "import", label: "Import / Export", Icon: Download },
  { id: "templates", label: "Șabloane", Icon: BookTemplate },
  { id: "permissions", label: "Permisiuni", Icon: Users },
];
function readSaved() {
  return { ...defaults };
}
function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`pts-switch-row${disabled ? " is-disabled" : ""}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pts-switch" aria-hidden="true" />
    </label>
  );
}
function Field({ label, children }) {
  return (
    <label className="pts-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Panel({ title, Icon, children }) {
  return (
    <section className="pts-panel">
      <h3>
        <Icon size={23} />
        {title}
      </h3>
      <div className="pts-panel-body">{children}</div>
    </section>
  );
}
export default function SetariTestare({ ctx = {} }) {
  const [categoryName, setCategoryName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [section, setSection] = useState("general");
  const [values, setValues] = useState(readSaved);
  const [baseline, setBaseline] = useState(null);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [lastSaved, setLastSaved] = useState(null);
  const lock = useRef(false);
  const dirty = loaded && JSON.stringify(values) !== JSON.stringify(baseline);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    getTestPreferences()
      .then((result) => {
        if (!active) return;
        if (
          !result?.preferences ||
          typeof result.preferences !== "object" ||
          Array.isArray(result.preferences)
        )
          throw new Error("Răspuns invalid.");
        const next = normalizePreferences(result.preferences);
        setValues(next);
        setBaseline(next);
        setLoaded(true);
        setLastSaved(result.updated_at || null);
      })
      .catch(() => {
        if (active) {
          setLoaded(false);
          setError("Nu s-au putut încărca preferințele din server.");
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [loadKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (key, value) => {
    if (busy || !loaded || lock.current) return;
    setValues((prev) => ({ ...prev, [key]: value }));
    setError("");
  };
  const confirm = async (title, text) =>
    (
      await Swal.fire({
        title,
        text,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Confirmă",
        cancelButtonText: "Anulează",
        confirmButtonColor: "#355af6",
      })
    ).isConfirmed;
  const reset = async () => {
    if (busy || !loaded || lock.current) return;
    if (
      await confirm(
        "Resetezi preferințele?",
        "Valorile implicite vor fi aplicate în formular. Salvează pentru a le trimite serverului.",
      )
    ) {
      setValues((prev) => ({
        ...prev,
        ...defaults,
        personalCategories: prev.personalCategories,
        personalTemplates: prev.personalTemplates,
      }));
      setError("");
    }
  };
  const discard = async () => {
    if (!dirty || busy || lock.current) return;
    if (await confirm("Renunți la modificări?", "Se vor restabili ultimele valori salvate.")) {
      setValues(baseline);
      setError("");
    }
  };
  const save = async () => {
    if (!loaded || busy || !dirty || lock.current) return;
    const numeric = [
      ["questionLimit", 0, 10000],
      ["threshold", 0, 100],
      ["maxGrade", 1, 10],
      ["attempts", 1, 99],
    ];
    for (const [key, min, max] of numeric) {
      if (
        values[key] === "" ||
        !Number.isFinite(Number(values[key])) ||
        Number(values[key]) < min ||
        Number(values[key]) > max ||
        (["attempts", "questionLimit"].includes(key) && !Number.isInteger(Number(values[key])))
      ) {
        setError(
          `Verifică ${{ threshold: "pragul de promovare", maxGrade: "nota maximă", attempts: "numărul de încercări", questionLimit: "numărul de întrebări" }[key]} (${min}–${max}).`,
        );
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = normalizePreferences({
        ...values,
        threshold: Number(values.threshold),
        maxGrade: Number(values.maxGrade),
        attempts: Number(values.attempts),
        questionLimit: Number(values.questionLimit),
      });
      const result = await saveTestPreferences(payload);
      if (
        !result?.preferences ||
        typeof result.preferences !== "object" ||
        Array.isArray(result.preferences)
      )
        throw new Error("Răspuns invalid.");
      const next = normalizePreferences(result.preferences);
      setValues(next);
      setBaseline(next);
      setLastSaved(result.updated_at || null);
      toast.success("Preferințele au fost salvate pe server.");
    } catch (err) {
      const message = err.response?.data?.message || "Nu s-au putut salva preferințele pe server.";
      setError(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const addCategory = () => {
    const name = categoryName.trim();
    if (
      !name ||
      name.length > 100 ||
      values.personalCategories.length >= 30 ||
      values.personalCategories.some(
        (x) => x.toLocaleLowerCase("ro") === name.toLocaleLowerCase("ro"),
      )
    )
      return toast.error("Categorie invalidă, duplicată sau limită atinsă.");
    update("personalCategories", [...values.personalCategories, name]);
    setCategoryName("");
  };
  const addTemplate = () => {
    const name = templateName.trim();
    if (
      !name ||
      name.length > 60 ||
      values.personalTemplates.length >= 10 ||
      values.personalTemplates.some(
        (t) => t.name.toLocaleLowerCase("ro") === name.toLocaleLowerCase("ro"),
      )
    )
      return toast.error("Nume invalid, duplicat sau limită atinsă.");
    update("personalTemplates", [
      ...values.personalTemplates,
      { name, config: pickConfig(values) },
    ]);
    setTemplateName("");
  };
  const exportConfig = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { format: "BORDER-test-config", version: 1, config: pickConfig(values) },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BORDER-configuratie.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importConfig = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 16384) throw new Error("Fișier prea mare.");
      const parsed = JSON.parse(await file.text());
      if (
        parsed.format !== "BORDER-test-config" ||
        parsed.version !== 1 ||
        !parsed.config ||
        Array.isArray(parsed.config) ||
        typeof parsed.config !== "object"
      )
        throw new Error("Format invalid.");
      const config = pickConfig(parsed.config);
      if (!Object.keys(config).length) throw new Error("Configurație goală.");
      if (
        await confirm(
          "Importă configurația?",
          "Valorile importate înlocuiesc setările din formular. Salvează pentru validarea pe server.",
        )
      )
        setValues((v) => normalizePreferences({ ...v, ...config }));
    } catch (err) {
      toast.error(err.message || "Import nereușit.");
    }
  };
  const metrics = ctx.dashboardMetricsError ? null : ctx.dashboardMetrics;
  const testCount = metrics?.total_tests ?? null;
  const userCount = metrics?.unique_recipients ?? null;
  const passRate =
    typeof metrics?.pass_rate === "number" && Number.isFinite(metrics.pass_rate)
      ? Math.round(metrics.pass_rate)
      : null;
  const isGeneral = section === "general";
  return (
    <div className="pts-page">
      <div className="pts-layout">
        <nav className="pts-sidebar" aria-label="Secțiuni setări testare">
          {sections.map(({ id, label, Icon }) => (
            <button
              type="button"
              key={id}
              className={section === id ? "active" : ""}
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <main className="pts-main">
          <div className="pts-heading">
            <div className="pts-heading-title">
              <Settings size={34} />
              <div>
                <h2>
                  {sections.find((x) => x.id === section)?.label === "Generale"
                    ? "Setări generale"
                    : sections.find((x) => x.id === section)?.label}
                </h2>
                <p>Configurează regulile implicite pentru testele noi</p>
              </div>
            </div>
            <button className="pts-reset" type="button" onClick={reset} disabled={busy || !loaded}>
              <RotateCcw size={18} /> Reset la valori implicite
            </button>
          </div>
          <div className="pts-info" role="status">
            <Info size={18} />
            <span>
              <strong>Preferințe personale:</strong> valorile se salvează în contul tău pe server.
              Valorile compatibile sunt preluate la crearea unui test nou. Testele existente nu se
              modifică. Opțiunile indisponibile sunt dezactivate.
            </span>
          </div>
          {isGeneral && (
            <div className="pts-stats">
              <div className="pts-stat">
                <span className="pts-stat-icon blue">
                  <Layers3 />
                </span>
                <div>
                  <strong>{testCount ?? "—"}</strong>
                  <span>Teste create</span>
                </div>
              </div>
              <div className="pts-stat">
                <span className="pts-stat-icon purple">
                  <Users />
                </span>
                <div>
                  <strong>{userCount ?? "—"}</strong>
                  <span>Destinatari unici activi</span>
                </div>
              </div>
              <div className="pts-stat">
                <span className="pts-stat-icon green">
                  <Trophy />
                </span>
                <div>
                  <strong>{passRate == null ? "—" : `${passRate}%`}</strong>
                  <span>Rată de promovare</span>
                </div>
              </div>
            </div>
          )}
          {error && !loaded && (
            <div className="pts-retry" role="alert">
              {error}{" "}
              <button
                type="button"
                className="pts-secondary"
                disabled={busy}
                onClick={() => setLoadKey((k) => k + 1)}
              >
                Reîncearcă
              </button>
            </div>
          )}
          <fieldset className="pts-settings-fields" disabled={busy || !loaded}>
            {(isGeneral ||
              section === "evaluation" ||
              section === "attempts" ||
              section === "questions" ||
              section === "display" ||
              section === "notifications") && (
              <div className="pts-panels">
                {(isGeneral || section === "evaluation") && (
                  <Panel title="Reguli de evaluare" Icon={SlidersHorizontal}>
                    <div className="pts-fields-two">
                      <Field label="Metodă de notare">
                        <select
                          value={values.grading}
                          onChange={(e) => update("grading", e.target.value)}
                        >
                          <option value="both">Notă + procent</option>
                          <option value="grade">Doar notă</option>
                          <option value="percent">Doar procent</option>
                        </select>
                      </Field>
                      <Field label="Prag de promovare (%)">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={values.threshold}
                          onChange={(e) => update("threshold", e.target.value)}
                        />
                      </Field>
                      <Field label="Nota maximă">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.1"
                          value={values.maxGrade}
                          onChange={(e) => update("maxGrade", e.target.value)}
                        />
                      </Field>
                      <Field label="Rotunjire notă">
                        <select
                          value={values.rounding}
                          onChange={(e) => update("rounding", e.target.value)}
                        >
                          <option value="one">La o zecimală (ex. 8,5)</option>
                          <option value="integer">Număr întreg</option>
                          <option value="two">La două zecimale</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Punctaj răspunsuri multiple">
                      <select
                        value={values.scoringMode}
                        onChange={(e) => update("scoringMode", e.target.value)}
                      >
                        <option value="exact">Integral sau zero</option>
                        <option value="partial">Parțial (zero dacă există opțiuni greșite)</option>
                        <option value="penalized">Parțial cu penalizare</option>
                      </select>
                    </Field>
                  </Panel>
                )}
                {(isGeneral || section === "attempts") && (
                  <Panel title="Încercări" Icon={RotateCcw}>
                    <div className="pts-control-row">
                      <span>
                        Număr de încercări <Info size={14} />
                      </span>
                      <input
                        className="pts-small-number"
                        aria-label="Număr de încercări"
                        type="number"
                        min="1"
                        max="99"
                        value={values.attempts}
                        onChange={(e) => update("attempts", e.target.value)}
                      />
                    </div>
                    <Switch
                      label="Permite reluarea testului după finalizare"
                      checked={values.allowRetake}
                      onChange={(v) => update("allowRetake", v)}
                    />
                    <div className="pts-control-row">
                      <span>
                        Interval minim între încercări <Info size={14} />
                      </span>
                      <select
                        disabled={!values.allowRetake || Number(values.attempts) < 2}
                        value={values.retryIntervalHours}
                        onChange={(e) => update("retryIntervalHours", e.target.value)}
                      >
                        <option value="0">Fără interval</option>
                        <option value="1">1 oră</option>
                        <option value="24">24 ore</option>
                        <option value="48">48 ore</option>
                      </select>
                    </div>
                  </Panel>
                )}
                {(isGeneral || section === "questions") && (
                  <Panel title="Configurarea întrebărilor" Icon={ListChecks}>
                    <Field label="Navigare între întrebări">
                      <select
                        value={values.navigationMode}
                        onChange={(e) => update("navigationMode", e.target.value)}
                      >
                        <option value="free">Navigare liberă</option>
                        <option value="sequential">Secvențială, fără revenire</option>
                      </select>
                    </Field>
                    <Switch
                      label="Amestecă ordinea întrebărilor"
                      checked={values.shuffleQuestions}
                      onChange={(v) => update("shuffleQuestions", v)}
                    />
                    <Switch
                      label="Amestecă variantele de răspuns"
                      checked={values.shuffleAnswers}
                      onChange={(v) => update("shuffleAnswers", v)}
                    />
                    <Field label="Întrebări per încercare (0 = toate)">
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={values.questionLimit}
                        onChange={(e) => update("questionLimit", e.target.value)}
                      />
                    </Field>
                    <p>
                      Preferințele se aplică testelor noi. Ordinea rămâne stabilă în timpul unei
                      încercări, inclusiv după reîncărcare.
                    </p>
                  </Panel>
                )}
                {(isGeneral || section === "display") && (
                  <Panel title="Afișare rezultate" Icon={Trophy}>
                    <Switch
                      label="Afișează nota / procentul după finalizare"
                      checked={values.showGrade}
                      onChange={(v) => update("showGrade", v)}
                    />
                    <Switch
                      label="Afișează răspunsurile corecte"
                      checked={values.showAnswers}
                      onChange={(v) => update("showAnswers", v)}
                    />
                    <Switch
                      disabled={!values.showAnswers}
                      label="Afișează explicații la răspunsuri"
                      checked={values.showExplanations}
                      onChange={(v) => update("showExplanations", v)}
                    />
                  </Panel>
                )}
                {(isGeneral || section === "notifications") && (
                  <Panel title="Notificări" Icon={Bell}>
                    <Switch
                      label="Notifică la atribuirea unui test"
                      checked={values.notifyAssignment}
                      onChange={(v) => update("notifyAssignment", v)}
                    />
                    <div className="pts-control-row">
                      <span>Notifică înainte de expirarea termenului</span>
                      <div className="pts-inline">
                        <input
                          type="checkbox"
                          aria-label="Activează reminderul înainte de expirare"
                          checked={values.notifyExpiry}
                          onChange={(e) => update("notifyExpiry", e.target.checked)}
                        />
                        <select
                          disabled={!values.notifyExpiry}
                          aria-label="Interval reminder"
                          value={values.expiryHours}
                          onChange={(e) => update("expiryHours", e.target.value)}
                        >
                          <option value="24">24 ore</option>
                          <option value="48">48 ore</option>
                          <option value="72">72 ore</option>
                        </select>
                      </div>
                    </div>
                    <Switch
                      label="Notifică la finalizarea testului (în aplicație)"
                      checked={values.notifyResult}
                      onChange={(v) => update("notifyResult", v)}
                    />
                  </Panel>
                )}
                {(isGeneral || section === "attempts") && (
                  <Panel title="Valabilitate și programare" Icon={CalendarDays}>
                    <div className="pts-control-row">
                      <span>Durată implicită a testului</span>
                      <select
                        value={values.duration}
                        onChange={(e) => update("duration", e.target.value)}
                      >
                        <option value="15">15 minute</option>
                        <option value="30">30 minute</option>
                        <option value="45">45 minute</option>
                        <option value="60">60 minute</option>
                        <option value="90">90 minute</option>
                      </select>
                    </div>
                    <div className="pts-control-row">
                      <span>Perioadă de valabilitate implicită</span>
                      <select
                        value={values.validity}
                        onChange={(e) => update("validity", e.target.value)}
                      >
                        <option value="1">1 zi</option>
                        <option value="7">7 zile</option>
                        <option value="14">14 zile</option>
                        <option value="30">30 zile</option>
                      </select>
                    </div>
                  </Panel>
                )}
                {(isGeneral || section === "attempts") && (
                  <Panel title="Securitate și acces" Icon={ShieldCheck}>
                    <Switch
                      label="Acces autentificat obligatoriu"
                      disabled
                      checked={true}
                      onChange={(v) => update("authenticated", v)}
                    />
                    <div className="pts-control-row">
                      <span>Avertizare de inactivitate</span>
                      <select
                        value={values.idleWarningMinutes}
                        onChange={(e) => update("idleWarningMinutes", e.target.value)}
                      >
                        <option value="0">Dezactivată</option>
                        <option value="2">2 minute</option>
                        <option value="5">5 minute</option>
                        <option value="10">10 minute</option>
                        <option value="15">15 minute</option>
                        <option value="30">30 minute</option>
                      </select>
                    </div>
                    <p>
                      Avertizarea este locală, fără finalizare automată. Timpul testului continuă.
                    </p>
                    <Switch
                      label="Monitorizează ascunderea filei"
                      checked={values.monitorTabs}
                      onChange={(v) => update("monitorTabs", v)}
                    />
                    <Field label="Prag de avertizare">
                      <select
                        disabled={!values.monitorTabs}
                        value={values.tabWarningLimit}
                        onChange={(e) => update("tabWarningLimit", e.target.value)}
                      >
                        {[1, 2, 3, 5, 10].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p>
                      Evenimentele sunt înregistrate, fără finalizare automată. Nu constituie dovadă
                      de fraudă.
                    </p>
                  </Panel>
                )}
              </div>
            )}
            {section === "categories" && (
              <Panel title="Categorii personale" Icon={Layers3}>
                <p>
                  Adaugă opțiuni pentru testele noi. Eliminarea unei opțiuni nu modifică testele
                  existente sau categoriile standard.
                </p>
                <div className="pts-library-input">
                  <input
                    aria-label="Categorie nouă"
                    maxLength={100}
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Categorie nouă"
                  />
                  <button type="button" className="pts-secondary" onClick={addCategory}>
                    Adaugă
                  </button>
                </div>
                {values.personalCategories.map((name) => (
                  <div className="pts-library-row" key={name}>
                    <span>{name}</span>
                    <button
                      className="pts-secondary"
                      type="button"
                      onClick={() =>
                        update(
                          "personalCategories",
                          values.personalCategories.filter((x) => x !== name),
                        )
                      }
                    >
                      Elimină
                    </button>
                  </div>
                ))}
              </Panel>
            )}
            {section === "import" && (
              <Panel title="Import / Export configurație" Icon={Download}>
                <p>
                  Transferă regulile implicite, fără întrebări, rezultate sau destinatari. Importul
                  necesită salvare.
                </p>
                <button type="button" className="pts-secondary" onClick={exportConfig}>
                  Exportă JSON
                </button>
                <label className="pts-library-file">
                  Importă JSON
                  <input type="file" accept=".json,application/json" onChange={importConfig} />
                </label>
              </Panel>
            )}
            {section === "templates" && (
              <Panel title="Șabloane personale" Icon={FileText}>
                <p>
                  Salvează configurația curentă ca șablon (maximum 10). Aplicarea încarcă regulile
                  în formular; apasă Salvează preferințele.
                </p>
                <div className="pts-library-input">
                  <input
                    aria-label="Nume șablon"
                    maxLength={60}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nume șablon"
                  />
                  <button type="button" className="pts-secondary" onClick={addTemplate}>
                    Adaugă
                  </button>
                </div>
                {values.personalTemplates.map((t) => (
                  <div className="pts-library-row" key={t.name}>
                    <span>{t.name}</span>
                    <button
                      type="button"
                      className="pts-secondary"
                      onClick={async () => {
                        if (
                          await confirm(
                            "Aplică șablonul?",
                            "Regulile din formular vor fi înlocuite.",
                          )
                        )
                          setValues((v) => normalizePreferences({ ...v, ...pickConfig(t.config) }));
                      }}
                    >
                      Aplică
                    </button>
                    <button
                      type="button"
                      className="pts-secondary"
                      onClick={() =>
                        update(
                          "personalTemplates",
                          values.personalTemplates.filter((x) => x.name !== t.name),
                        )
                      }
                    >
                      Elimină
                    </button>
                  </div>
                ))}
              </Panel>
            )}
            {section === "permissions" && (
              <Panel title="Permisiuni" Icon={LockKeyhole}>
                <p>
                  Permisiunile reale sunt verificate de backend. Această interfață nu le poate
                  modifica.
                </p>
                <div className="pts-role">
                  Rol curent: <strong>{ctx.user?.role ?? "Nedisponibil"}</strong>
                </div>
              </Panel>
            )}
          </fieldset>
        </main>
      </div>
      <div className="pts-bottom">
        <div>
          <Info size={19} />
          <span>
            {busy
              ? "Se procesează preferințele..."
              : dirty
                ? "Ai modificări nesalvate."
                : loaded
                  ? "Preferințele sunt sincronizate cu serverul."
                  : "Preferințele nu sunt încărcate."}
            {lastSaved && !Number.isNaN(new Date(lastSaved).getTime()) && (
              <small className="pts-saved-at">
                Ultima salvare: {new Date(lastSaved).toLocaleString("ro-RO")}
              </small>
            )}
          </span>
        </div>
        {dirty && (
          <button className="pts-secondary" type="button" onClick={discard} disabled={busy}>
            Renunță
          </button>
        )}
        <button
          className="pts-save"
          type="button"
          onClick={save}
          disabled={busy || !loaded || !dirty}
        >
          <Save size={19} />
          {busy ? "Se procesează..." : "Salvează preferințele"}
        </button>
      </div>
      {error && loaded && (
        <p className="pts-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
