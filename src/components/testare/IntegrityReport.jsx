import React, { useRef } from "react";
import "./IntegrityReport.css";

export function integrityCount(row) {
  if (row.tab_event_count == null || row.tab_event_count === "") return null;
  const n = Number(row.tab_event_count);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
const threshold = (row) => {
  const n = Number(row.tab_warning_limit);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const stateOf = (row) => {
  if (row.monitor_tabs === false) return "off";
  const count = integrityCount(row);
  if (row.monitor_tabs !== true || count === null) return "unknown";
  if (count === 0) return "zero";
  return threshold(row) !== null && count >= threshold(row) ? "threshold" : "events";
};
export function integrityMatches(row, filter) {
  const state = stateOf(row);
  return (
    filter === "all" ||
    (filter === "events" ? ["events", "threshold"].includes(state) : state === filter)
  );
}
export function integrityLabel(row) {
  return {
    off: "Nemonitorizat",
    unknown: "Date indisponibile",
    zero: "Fără evenimente înregistrate",
    events: "Cu evenimente",
    threshold: "Prag atins",
  }[stateOf(row)];
}
const dateText = (value) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("ro-RO", {
        timeZone: "Europe/Chisinau",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
};
const csvCell = (value) =>
  `"${String(value ?? "")
    .replace(/^\s*[=+@-]|^[\t\r\n]/, "'$&")
    .replace(/"/g, '""')}"`;
export default function IntegrityReport({ row, name, title }) {
  const ref = useRef(null);
  const state = stateOf(row);
  const count = integrityCount(row);
  const limit = threshold(row);
  const times = Array.isArray(row.tab_event_times) ? row.tab_event_times : [];
  const canReport = row.monitor_tabs === true && count !== null;
  const exportReport = () => {
    const lines = [
      [
        "Încercare",
        "Participant",
        "Test",
        "Status",
        "Total evenimente",
        "Prag",
        "Evenimente incluse",
        "Data/ora (Europe/Chisinau)",
      ],
      ...(times.length ? times : [null]).map((t) => [
        row.attempt_id ?? row.id,
        name,
        title,
        integrityLabel(row),
        count,
        limit,
        times.length,
        t ? dateText(t) : "",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `BORDER-integritate-${row.attempt_id ?? row.id ?? "raport"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <button
        type="button"
        className={`pt-integrity-badge is-${state}`}
        disabled={!canReport}
        onClick={() => ref.current?.showModal()}
        title={integrityLabel(row)}
      >
        {canReport ? `${count} evenimente` : integrityLabel(row)}
        {state === "threshold" && <span> · Prag atins</span>}
      </button>
      {canReport && (
        <dialog
          ref={ref}
          className="pt-integrity-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) ref.current?.close();
          }}
          aria-label="Raport de integritate"
        >
          <div className="pt-integrity-content">
            <header>
              <div>
                <h2>Raport de integritate</h2>
                <p>
                  {name} · {title || "Test profesional"}
                </p>
              </div>
              <button
                type="button"
                className="pt-integrity-close"
                onClick={() => ref.current?.close()}
                aria-label="Închide raportul"
              >
                ×
              </button>
            </header>
            <div className="pt-integrity-metrics">
              <div>
                <small>Evenimente înregistrate</small>
                <strong>{count}</strong>
              </div>
              <div>
                <small>Prag de avertizare</small>
                <strong>{limit ?? "—"}</strong>
              </div>
            </div>
            <p className={`pt-integrity-state is-${state}`}>{integrityLabel(row)}</p>
            <h3>Istoricul evenimentelor</h3>
            {count > times.length && (
              <p>
                Se afișează {times.length} dintre cele {count} evenimente (maximum 100, cele mai
                recente).
              </p>
            )}
            {times.length ? (
              <ol className="pt-integrity-events">
                {times.map((t, i) => (
                  <li key={`${t}-${i}`}>
                    <span>Fila testului a fost ascunsă</span>
                    <time>{dateText(t)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                {count === 0
                  ? "Nu există evenimente înregistrate."
                  : "Istoricul nu este disponibil."}
              </p>
            )}
            <p className="pt-integrity-note">
              Evenimentele de vizibilitate nu dovedesc copierea și nu indică site-ul accesat sau
              durata petrecută în afara testului. Pot exista evenimente neînregistrate.
            </p>
            <footer>
              <button type="button" onClick={exportReport}>
                Exportă istoricul afișat (CSV)
              </button>
              <button type="button" onClick={() => ref.current?.close()}>
                Închide
              </button>
            </footer>
          </div>
        </dialog>
      )}
    </>
  );
}
