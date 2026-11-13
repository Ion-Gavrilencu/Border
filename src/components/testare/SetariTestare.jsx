import React, { useEffect, useMemo, useState } from "react";
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
import {
  getTestPreferences,
  saveTestPreferences,
} from "../../services/professionalTestingService";

const STORAGE_KEY = "border:testare:ui-settings:v1";
const defaults = {
  grading: "both",
  threshold: 50,
  maxGrade: 10,
  rounding: "one",
  attempts: 1,
  allowRetake: true,
  retryInterval: "24",
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
};
const sections = [
  { id: "general", label: "Generale", Icon: Settings },
  { id: "evaluation", label: "Evaluare și notare", Icon: Trophy },
  { id: "attempts", label: "Încercări și acces", Icon: RotateCcw },
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
function Sparkline({ color = "#2363ff" }) {
  return (
    <svg className="pts-spark" viewBox="0 0 90 40" aria-hidden="true">
      <path
        d="M2 31 C13 15 19 34 29 24 S43 11 50 16 S65 7 71 10 S82 3 88 2"
        stroke={color}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Switch({ checked, onChange, label }) {
  return (
    <label className="pts-switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
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
  const [section, setSection] = useState("general");
  const [values, setValues] = useState(readSaved);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    getTestPreferences()
      .then((result) => {
        if (active) setValues({ ...defaults, ...(result.preferences || {}) });
      })
      .catch(() => {
        if (active) setError("Nu s-au putut încărca preferințele din server.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const [error, setError] = useState("");
  const update = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };
  const reset = () => {
    setValues({ ...defaults });
    setSaved(false);
  };
  const save = async () => {
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const result = await saveTestPreferences(values);
      setValues({ ...defaults, ...result.preferences });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || "Nu s-au putut salva preferințele pe server.");
    } finally {
      setBusy(false);
    }
  };
  const testCount = Array.isArray(ctx.managed) ? ctx.managed.length : 0;
  const userCount = Array.isArray(ctx.assignmentRows)
    ? new Set(ctx.assignmentRows.map((x) => x.user_id ?? x.userId).filter(Boolean)).size
    : null;
  const passRate = typeof ctx.reportPassRate === "number" ? ctx.reportPassRate : null;
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
                <p>Configurează preferințele interfeței modulului de testare</p>
              </div>
            </div>
            <button className="pts-reset" type="button" onClick={reset}>
              <RotateCcw size={18} /> Reset la valori implicite
            </button>
          </div>
          <div className="pts-info" role="status">
            <Info size={18} />
            <span>
              <strong>Preferințe personale:</strong> valorile se salvează în contul tău pe server.
              Nu schimbă automat regulile testelor, permisiunile sau notificările efective.
            </span>
          </div>
          {isGeneral && (
            <div className="pts-stats">
              <div className="pts-stat">
                <span className="pts-stat-icon blue">
                  <Layers3 />
                </span>
                <div>
                  <strong>{testCount}</strong>
                  <span>Teste create</span>
                </div>
                <Sparkline />
              </div>
              <div className="pts-stat">
                <span className="pts-stat-icon purple">
                  <Users />
                </span>
                <div>
                  <strong>{userCount ?? "—"}</strong>
                  <span>Destinatari identificați</span>
                </div>
                <Sparkline color="#9651ff" />
              </div>
              <div className="pts-stat">
                <span className="pts-stat-icon green">
                  <Trophy />
                </span>
                <div>
                  <strong>{passRate == null ? "—" : `${passRate}%`}</strong>
                  <span>Rată de promovare</span>
                </div>
                <Sparkline color="#1abf55" />
              </div>
            </div>
          )}
          {(isGeneral ||
            section === "evaluation" ||
            section === "attempts" ||
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
                        onChange={(e) =>
                          update("threshold", Math.min(100, Math.max(0, Number(e.target.value))))
                        }
                      />
                    </Field>
                    <Field label="Nota maximă">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={values.maxGrade}
                        onChange={(e) =>
                          update("maxGrade", Math.min(100, Math.max(1, Number(e.target.value))))
                        }
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
                      type="number"
                      min="1"
                      max="99"
                      value={values.attempts}
                      onChange={(e) =>
                        update("attempts", Math.max(1, Math.min(99, Number(e.target.value))))
                      }
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
                      value={values.retryInterval}
                      onChange={(e) => update("retryInterval", e.target.value)}
                    >
                      <option value="0">Fără interval</option>
                      <option value="1">1 oră</option>
                      <option value="24">24 ore</option>
                      <option value="48">48 ore</option>
                    </select>
                  </div>
                </Panel>
              )}
              {(isGeneral || section === "display") && (
                <Panel title="Afișare rezultate" Icon={Trophy}>
                  <Switch
                    label="Afișează nota imediat după finalizare"
                    checked={values.showGrade}
                    onChange={(v) => update("showGrade", v)}
                  />
                  <Switch
                    label="Afișează răspunsurile corecte"
                    checked={values.showAnswers}
                    onChange={(v) => update("showAnswers", v)}
                  />
                  <Switch
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
                        checked={values.notifyExpiry}
                        onChange={(e) => update("notifyExpiry", e.target.checked)}
                      />
                      <select
                        disabled={!values.notifyExpiry}
                        value={values.expiryHours}
                        onChange={(e) => update("expiryHours", e.target.value)}
                      >
                        <option value="1">1 oră</option>
                        <option value="12">12 ore</option>
                        <option value="24">24 ore</option>
                        <option value="48">48 ore</option>
                      </select>
                    </div>
                  </div>
                  <Switch
                    label="Notifică la publicarea unui test nou"
                    checked={values.notifyPublish}
                    onChange={(v) => update("notifyPublish", v)}
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
                    label="Acces doar pentru utilizatorii autentificați"
                    checked={values.authenticated}
                    onChange={(v) => update("authenticated", v)}
                  />
                  <div className="pts-control-row">
                    <span>Limită de inactivitate în timpul testului</span>
                    <select
                      value={values.idleTimeout}
                      onChange={(e) => update("idleTimeout", e.target.value)}
                    >
                      <option value="5">5 minute</option>
                      <option value="10">10 minute</option>
                      <option value="15">15 minute</option>
                      <option value="30">30 minute</option>
                    </select>
                  </div>
                  <Switch
                    label="Blochează navigarea în alte pagini în timpul testului"
                    checked={values.blockNavigation}
                    onChange={(v) => update("blockNavigation", v)}
                  />
                </Panel>
              )}
            </div>
          )}
          {section === "categories" && (
            <Panel title="Categorii" Icon={Layers3}>
              <p>
                Categoriile sunt gestionate în editorul testelor. Această pagină nu modifică datele
                din server.
              </p>
              <button
                className="pts-secondary"
                type="button"
                onClick={() => ctx.setTab?.("manage")}
              >
                Deschide lista testelor
              </button>
            </Panel>
          )}
          {section === "import" && (
            <Panel title="Import / Export" Icon={Download}>
              <p>
                Importul și exportul real al testelor se realizează din editor, dacă
                funcționalitatea este disponibilă.
              </p>
              <button
                className="pts-secondary"
                type="button"
                onClick={() => ctx.setTab?.("manage")}
              >
                Deschide lista testelor
              </button>
            </Panel>
          )}
          {section === "templates" && (
            <Panel title="Șabloane" Icon={FileText}>
              <p>
                Șabloanele globale necesită suport backend. Poți crea și configura un test din
                secțiunea Teste.
              </p>
              <button
                className="pts-secondary"
                type="button"
                onClick={() => ctx.setTab?.("manage")}
              >
                Deschide lista testelor
              </button>
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
        </main>
      </div>
      <div className="pts-bottom">
        <div>
          <Info size={19} />
          <span>
            Preferințele sunt salvate în contul tău. Testele publicate își păstrează regulile
            existente.
          </span>
        </div>
        <button className="pts-save" type="button" onClick={save} disabled={busy}>
          <Save size={19} />
          {busy ? "Se procesează..." : saved ? "Salvat pe server" : "Salvează preferințele"}
        </button>
      </div>
      {error && (
        <p className="pts-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
