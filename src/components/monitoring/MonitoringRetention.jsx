import { useCallback, useEffect, useState } from "react";
import "./MonitoringRetention.css";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  History,
  Info,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  getMonitoringRetention,
  updateMonitoringRetention,
} from "../../services/monitoringRetentionService";

const PERIODS = [7, 14, 30, 60, 90];

const formatDate = (value) => {
  if (!value) return "Nu a fost executată încă";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponibilă";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getError = (error, fallback) => error?.response?.data?.message || fallback;

export default function MonitoringRetention() {
  const [days, setDays] = useState(30);
  const [savedDays, setSavedDays] = useState(30);
  const [lastRun, setLastRun] = useState(null);
  const [lastCount, setLastCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getMonitoringRetention();
      const retention = Number(data.retention_days);
      if (!PERIODS.includes(retention)) {
        throw new Error("Perioada primită nu este acceptată de interfață.");
      }
      setDays(retention);
      setSavedDays(retention);
      setLastRun(data.last_cleanup_at || null);
      setLastCount(Number(data.last_deleted_count) || 0);
      setError("");
      if (isRefresh) toast.success("Informațiile au fost actualizate.");
    } catch (err) {
      const message = getError(err, err?.message || "Nu s-au putut încărca setările de păstrare.");
      setError(message);
      if (isRefresh) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changed = Number(days) !== Number(savedDays);
  const disabled = loading || refreshing || saving || Boolean(error);

  const save = async () => {
    if (disabled || !changed || !PERIODS.includes(Number(days))) return;

    if (Number(days) < Number(savedDays)) {
      const confirmation = await Swal.fire({
        title: "Reduci perioada de păstrare?",
        text: `Istoricul mai vechi de ${days} zile poate fi eliminat la următoarea curățare automată. Înregistrările eliminate nu vor mai fi disponibile în monitorizare.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Da, salvează",
        cancelButtonText: "Anulează",
        confirmButtonColor: "#0867f6",
        reverseButtons: true,
      });
      if (!confirmation.isConfirmed) return;
    }

    setSaving(true);
    try {
      const data = await updateMonitoringRetention(Number(days));
      const retention = Number(data?.retention_days ?? days);
      setSavedDays(retention);
      setDays(retention);
      setError("");
      toast.success("Perioada de păstrare a fost salvată.");
    } catch (err) {
      toast.error(getError(err, "Salvarea perioadei de păstrare a eșuat."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mon-panel mon-retention" aria-label="Păstrarea istoricului">
      <div className="mon-retention-heading">
        <div className="mon-retention-symbol" aria-hidden="true">
          <Database size={23} strokeWidth={1.9} />
        </div>
        <div className="mon-retention-heading-text">
          <h2>Păstrarea istoricului</h2>
          <p>Gestionarea automată a istoricului activităților</p>
        </div>
        <button
          type="button"
          className="mon-retention-refresh"
          onClick={() => load(true)}
          disabled={disabled}
          aria-label="Actualizează informațiile despre păstrarea istoricului"
          title="Actualizează informațiile"
        >
          <RefreshCw size={17} className={refreshing ? "mon-retention-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="mon-retention-error" role="alert">
          <Info size={18} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => load(true)} disabled={refreshing}>
            Reîncearcă
          </button>
        </div>
      )}

      <div className="mon-retention-summary">
        <div className="mon-retention-summary-card">
          <span className="mon-retention-summary-icon blue">
            <History size={19} />
          </span>
          <div>
            <span className="mon-retention-summary-label">Perioada activă</span>
            <strong>{loading ? "—" : `${savedDays} zile`}</strong>
            <small>Setarea salvată</small>
          </div>
        </div>
        <div className="mon-retention-summary-card">
          <span className="mon-retention-summary-icon violet">
            <CalendarClock size={19} />
          </span>
          <div>
            <span className="mon-retention-summary-label">Ultima curățare</span>
            <strong className="mon-retention-summary-date">
              {loading ? "Se încarcă..." : formatDate(lastRun)}
            </strong>
            <small>Conform ultimei execuții înregistrate</small>
          </div>
        </div>
        <div className="mon-retention-summary-card">
          <span className="mon-retention-summary-icon green">
            <Trash2 size={19} />
          </span>
          <div>
            <span className="mon-retention-summary-label">Înregistrări eliminate</span>
            <strong>{loading ? "—" : lastCount.toLocaleString("ro-RO")}</strong>
            <small>La ultima curățare</small>
          </div>
        </div>
      </div>

      <div className="mon-retention-settings">
        <div className="mon-retention-settings-info">
          <div className="mon-retention-settings-title">
            <Clock3 size={18} aria-hidden="true" />
            <h3>Perioada de păstrare</h3>
          </div>
          <p>
            Alege cât timp se păstrează activitățile înregistrate. Modificarea va fi folosită de
            procesul automat de curățare.
          </p>
        </div>
        <div className="mon-retention-controls">
          <label className="mon-retention-select-label" htmlFor="mon-retention-days">
            <span>Durata istoricului</span>
            <span className="mon-retention-select-wrap">
              <select
                id="mon-retention-days"
                value={days}
                disabled={disabled}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                {PERIODS.map((value) => (
                  <option value={value} key={value}>
                    {value} {value === 7 ? "zile" : "de zile"}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} aria-hidden="true" />
            </span>
          </label>
          <button
            className="mon-retention-save"
            type="button"
            onClick={save}
            disabled={disabled || !changed}
          >
            {saving ? (
              <LoaderCircle size={17} className="mon-retention-spin" />
            ) : (
              <Save size={17} />
            )}
            <span>{saving ? "Se salvează..." : "Salvează"}</span>
          </button>
        </div>
      </div>

      <div className="mon-retention-footer">
        <div className="mon-retention-protection">
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            <strong>Datele importante rămân protejate.</strong> Se elimină doar evenimentele vechi
            din istoricul activităților. Sesiunile și documentele nu sunt afectate.
          </p>
        </div>
        {!loading && !error && (
          <span className={`mon-retention-status ${changed ? "pending" : ""}`}>
            {changed ? <Info size={15} /> : <CheckCircle2 size={15} />}
            {changed ? "Modificări nesalvate" : "Setări salvate"}
          </span>
        )}
      </div>
    </section>
  );
}
