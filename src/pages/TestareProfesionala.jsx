import TestareUserViews from "../components/testare/TestareUserViews";
import PanouGeneral from "../components/testare/PanouGeneral";
import ListaTeste from "../components/testare/ListaTeste";
import Incercari from "../components/testare/Incercari";
import Atribuiri from "../components/testare/Atribuiri";
import Rezultate from "../components/testare/Rezultate";
import SetariTestare from "../components/testare/SetariTestare";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  GraduationCap,
  Plus,
  RefreshCw,
  Trophy,
  X,
  Pencil,
  ArrowRight,
  Eye,
  Trash2,
  Clock3,
  CheckCircle2,
  FileCheck2,
  Sparkles,
  ShieldCheck,
  LayoutDashboard,
  Search,
  Users,
  BarChart3,
  Settings2,
  CalendarDays,
  Layers3,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Target,
  Activity,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/authStore";
import {
  getAssignedTests,
  getMyTestResults,
  getManagedTests,
  startProfessionalTest,
  deleteProfessionalTest,
  getManagedTestResults,
  getVersionAssignments,
} from "../services/professionalTestingService";
import "../components/testare/testare.css";

const rowsOf = (data, key) => {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[key]) ? data[key] : [];
};

const messageOf = (error) =>
  error?.response?.data?.message || "Solicitarea nu a reușit. Încearcă din nou.";

// Editorul folosește ID-ul versiunii, nu ID-ul testului.
const versionIdOf = (item) =>
  item?.version_id ??
  item?.latest_version_id ??
  item?.current_version_id ??
  item?.version?.id ??
  item?.latest_version?.id ??
  null;

// Afișează o singură dată aceeași versiune, păstrând atribuirile în baza de date.
// Versiunile diferite rămân intrări distincte.
const groupAssigned = (items) => {
  const seen = new Map();
  for (const item of items) {
    const versionId = versionIdOf(item);
    const testId = item.test_id ?? item.professional_test_id ?? item.test?.id;
    // Fără un ID sigur de versiune nu grupăm înregistrările.
    const key =
      versionId == null
        ? `assignment:${item.assignment_id ?? item.id ?? seen.size}`
        : `test:${testId ?? "unknown"}:version:${versionId}`;
    if (!seen.has(key)) seen.set(key, { ...item, _assignmentCount: 1 });
    else seen.get(key)._assignmentCount += 1;
  }
  return [...seen.values()];
};

function TestareProfesionala() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "EDITOR";
  const canDelete = user?.role === "ADMIN";
  const [tab, setTab] = useState(canManage ? "dashboard" : "assigned");
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [testStatus, setTestStatus] = useState("all");
  const [testView, setTestView] = useState("list");
  const [testPage, setTestPage] = useState(1);
  const [dashboardPage, setDashboardPage] = useState(1);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("all");
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [attemptRows, setAttemptRows] = useState([]);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [attemptError, setAttemptError] = useState("");
  const [attemptSearch, setAttemptSearch] = useState("");
  const [attemptStatus, setAttemptStatus] = useState("all");
  const [attemptPage, setAttemptPage] = useState(1);
  const [settingsSection, setSettingsSection] = useState("general");
  const [reportSearch, setReportSearch] = useState("");
  const [reportTest, setReportTest] = useState("all");
  const [reportPage, setReportPage] = useState(1);
  const [assigned, setAssigned] = useState([]);
  const [results, setResults] = useState([]);
  const [managed, setManaged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, r, m] = await Promise.all([
        getAssignedTests(),
        getMyTestResults(),
        canManage ? getManagedTests() : Promise.resolve({ tests: [] }),
      ]);
      setAssigned(groupAssigned(rowsOf(a, "tests")));
      setResults(rowsOf(r, "results"));
      setManaged(rowsOf(m, "tests"));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = (item) => {
    const versionId = versionIdOf(item);
    if (versionId == null) {
      toast.error("Nu am primit ID-ul versiunii. Verifică răspunsul API pentru lista testelor.");
      return;
    }
    navigate(`/testare/${encodeURIComponent(versionId)}/editare`);
  };

  const openAssignedTest = async (item) => {
    const versionId = versionIdOf(item);
    if (versionId == null || startingId != null) return;
    setStartingId(String(versionId));
    try {
      const data = await startProfessionalTest(versionId);
      const attemptId = data?.attempt?.id;
      if (attemptId == null) throw new Error("Serverul nu a returnat ID-ul încercării.");
      navigate(`/testare/incercari/${encodeURIComponent(attemptId)}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Nu s-a putut începe testul.");
    } finally {
      setStartingId(null);
    }
  };

  // Accesarea unei încercări deja încheiate nu pornește o testare nouă.
const openFinishedAttempt = (item) => {
  const attemptId = item?.attempt_id ?? item?.attempt?.id ?? item?.id;

  if (attemptId == null) {
    toast.error("Rezultatul nu conține ID-ul încercării.");
    return;
  }

  navigate(`/testare/incercari/${encodeURIComponent(attemptId)}/rezultat`);
};

  const finishedForVersion = (versionId) => {
    if (versionId == null) return [];
    return results.filter(
      (r) =>
        String(versionIdOf(r)) === String(versionId) &&
        ["SUBMITTED", "EXPIRED", "FINISHED", "COMPLETED"].includes(
          String(r.status ?? r.attempt_status ?? "SUBMITTED").toUpperCase(),
        ),
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting || !canDelete) return;
    const testId = deleteTarget.id;
    setDeleting(true);
    try {
      await deleteProfessionalTest(testId);
      setDeleteTarget(null);
      toast.success("Testul și toate datele asociate au fost șterse definitiv.");
      await load();
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setDeleting(false);
    }
  };

  const loadAttempts = useCallback(async () => {
    if (!canManage) return;
    const versions = [...new Set(managed.map(versionIdOf).filter((id) => id != null))];
    setAttemptLoading(true);
    setAttemptError("");
    try {
      const outcomes = await Promise.allSettled(versions.map((id) => getManagedTestResults(id)));
      const rows = [];
      let failures = 0;
      outcomes.forEach((outcome, index) => {
        if (outcome.status !== "fulfilled") {
          failures += 1;
          return;
        }
        const version = versions[index];
        const test = managed.find((item) => String(versionIdOf(item)) === String(version));
        rowsOf(outcome.value, "results").forEach((attempt) =>
          rows.push({
            ...attempt,
            version_id: version,
            test_title: test?.title ?? test?.test_title ?? "Test profesional",
          }),
        );
      });
      rows.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));
      setAttemptRows(rows);
      if (failures)
        setAttemptError(
          `Nu au putut fi încărcate rezultatele pentru ${failures} versiuni. Datele afișate pot fi incomplete.`,
        );
    } catch (err) {
      setAttemptError(messageOf(err));
    } finally {
      setAttemptLoading(false);
    }
  }, [canManage, managed]);

  useEffect(() => {
    if ((tab === "attempts" || tab === "reports") && canManage && !loading) loadAttempts();
  }, [tab, canManage, loading, loadAttempts]);

  const loadAssignments = useCallback(async () => {
    if (!canManage) return;
    const versions = [...new Set(managed.map(versionIdOf).filter((id) => id != null))];
    setAssignmentLoading(true);
    setAssignmentError("");
    try {
      const responses = await Promise.allSettled(versions.map((id) => getVersionAssignments(id)));
      const all = [];
      let failures = 0;
      responses.forEach((response, index) => {
        if (response.status !== "fulfilled") {
          failures += 1;
          return;
        }
        const versionId = versions[index];
        const test = managed.find((item) => String(versionIdOf(item)) === String(versionId));
        rowsOf(response.value, "assignments").forEach((assignment) =>
          all.push({
            ...assignment,
            version_id: versionId,
            test_title: test?.title ?? test?.test_title ?? "Test profesional",
          }),
        );
      });
      all.sort((a, b) => new Date(b.assigned_at || 0) - new Date(a.assigned_at || 0));
      setAssignmentRows(all);
      if (failures)
        setAssignmentError(
          `Nu s-au încărcat atribuirile pentru ${failures} versiuni. Datele afișate pot fi incomplete.`,
        );
    } catch (err) {
      setAssignmentError(messageOf(err));
    } finally {
      setAssignmentLoading(false);
    }
  }, [canManage, managed]);

  useEffect(() => {
    if (tab === "assignments" && canManage && !loading) loadAssignments();
  }, [tab, canManage, loading, loadAssignments]);

  // Testele proprii sunt disponibile tuturor rolurilor, inclusiv ADMIN și EDITOR.
  const tabs = [
    ...(canManage ? [{ id: "dashboard", label: "Panou general", icon: LayoutDashboard }] : []),
    { id: "assigned", label: "Testele mele", icon: ClipboardList },
    { id: "results", label: "Rezultatele mele", icon: Trophy },
    ...(canManage
      ? [
          { id: "manage", label: "Teste", icon: GraduationCap },
          { id: "attempts", label: "Încercări", icon: Activity },
          { id: "assignments", label: "Atribuiri", icon: Users },
          { id: "reports", label: "Rezultate", icon: Trophy },
          { id: "settings", label: "Setări", icon: Settings2 },
        ]
      : []),
  ];
  const filteredAssignments = assignmentRows.filter((item) => {
    const query = assignmentSearch.trim().toLocaleLowerCase("ro");
    const status = String(item.progress_status ?? "NOT_STARTED").toUpperCase();
    return (
      `${item.full_name ?? ""} ${item.username ?? ""} ${item.test_title ?? ""}`
        .toLocaleLowerCase("ro")
        .includes(query) &&
      (assignmentStatus === "all" || status === assignmentStatus)
    );
  });
  const assignmentPages = Math.max(1, Math.ceil(filteredAssignments.length / 8));
  const safeAssignmentPage = Math.min(assignmentPage, assignmentPages);
  const visibleAssignments = filteredAssignments.slice(
    (safeAssignmentPage - 1) * 8,
    safeAssignmentPage * 8,
  );
  const assignmentFinished = assignmentRows.filter(
    (item) => item.progress_status === "FINISHED",
  ).length;
  const assignmentStarted = assignmentRows.filter(
    (item) => item.progress_status === "IN_PROGRESS",
  ).length;
  const assignmentPending = assignmentRows.filter(
    (item) => item.progress_status === "NOT_STARTED",
  ).length;
  const current = tab === "assigned" ? assigned : tab === "results" ? results : managed;
  const filteredAttempts = attemptRows.filter((item) => {
    const query = attemptSearch.toLocaleLowerCase("ro");
    const status = String(item.status ?? "").toUpperCase();
    return (
      `${item.user_name_snapshot ?? ""} ${item.test_title ?? ""}`
        .toLocaleLowerCase("ro")
        .includes(query) &&
      (attemptStatus === "all" ||
        (attemptStatus === "finished"
          ? ["SUBMITTED", "EXPIRED", "FINISHED", "COMPLETED"].includes(status)
          : ["STARTED", "IN_PROGRESS", "ACTIVE"].includes(status)))
    );
  });
  const attemptPages = Math.max(1, Math.ceil(filteredAttempts.length / 8));
  const safeAttemptPage = Math.min(attemptPage, attemptPages);
  const visibleAttempts = filteredAttempts.slice((safeAttemptPage - 1) * 8, safeAttemptPage * 8);
  const finishedAttempts = attemptRows.filter((item) =>
    ["SUBMITTED", "EXPIRED", "FINISHED", "COMPLETED"].includes(
      String(item.status ?? "").toUpperCase(),
    ),
  );
  const gradedAttempts = finishedAttempts.filter((item) => typeof item.passed === "boolean");
  const attemptPassRate = gradedAttempts.length
    ? Math.round(
        (100 * gradedAttempts.filter((item) => item.passed).length) / gradedAttempts.length,
      )
    : null;
  const reportRows = finishedAttempts.filter((item) => {
    const q = reportSearch.trim().toLocaleLowerCase("ro");
    return (
      `${item.user_name_snapshot ?? ""} ${item.test_title ?? ""}`
        .toLocaleLowerCase("ro")
        .includes(q) &&
      (reportTest === "all" || String(item.version_id) === reportTest)
    );
  });
  const reportPages = Math.max(1, Math.ceil(reportRows.length / 8));
  const safeReportPage = Math.min(reportPage, reportPages);
  const visibleReports = reportRows.slice((safeReportPage - 1) * 8, safeReportPage * 8);
  const reportPercentages = finishedAttempts
    .map((item) => Number(item.percentage ?? item.score_percent))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  const reportAverage = reportPercentages.length
    ? Math.round(reportPercentages.reduce((a, b) => a + b, 0) / reportPercentages.length)
    : null;
  const reportGrades = finishedAttempts
    .map((item) => Number(item.grade))
    .filter((n) => Number.isFinite(n));
  const reportGradeAverage = reportGrades.length
    ? (reportGrades.reduce((a, b) => a + b, 0) / reportGrades.length).toFixed(2)
    : null;
  const reportDistribution = [0, 0, 0, 0, 0];
  for (const value of reportPercentages)
    reportDistribution[Math.min(4, Math.floor(value / 20))] += 1;
  const reportKnownPasses = finishedAttempts.filter(
    (item) => typeof item.passed === "boolean" || typeof item.is_passed === "boolean",
  );
  const reportPassRate = reportKnownPasses.length
    ? Math.round(
        (100 *
          reportKnownPasses.filter((item) => item.passed === true || item.is_passed === true)
            .length) /
          reportKnownPasses.length,
      )
    : null;
  const attemptDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ro-RO");
  };
  const filteredDashboardTests = managed.filter((item) =>
    `${item.title ?? ""} ${item.description ?? ""}`
      .toLocaleLowerCase("ro")
      .includes(dashboardSearch.toLocaleLowerCase("ro")),
  );
  const dashboardPages = Math.max(1, Math.ceil(filteredDashboardTests.length / 4));
  const visibleDashboardTests = filteredDashboardTests.slice(
    (Math.min(dashboardPage, dashboardPages) - 1) * 4,
    Math.min(dashboardPage, dashboardPages) * 4,
  );
  const completedResults = results.filter((r) =>
    ["SUBMITTED", "EXPIRED", "FINISHED", "COMPLETED"].includes(
      String(r.status ?? r.attempt_status ?? "SUBMITTED").toUpperCase(),
    ),
  );
  const passedResults = completedResults.filter(
    (r) =>
      r.passed === true ||
      r.is_passed === true ||
      String(r.result ?? "").toUpperCase() === "PASSED",
  );
  const knownPasses =
    completedResults.length > 0 &&
    completedResults.every(
      (r) =>
        typeof r.passed === "boolean" ||
        typeof r.is_passed === "boolean" ||
        ["PASSED", "FAILED"].includes(String(r.result ?? "").toUpperCase()),
    );
  const passRate = knownPasses
    ? Math.round((passedResults.length / completedResults.length) * 100)
    : null;
  const filteredTests = managed.filter((item) => {
    const searchable =
      `${item.title ?? item.test_title ?? ""} ${item.description ?? ""}`.toLocaleLowerCase("ro");
    const status = String(item.version_status ?? item.status ?? "").toUpperCase();
    return (
      searchable.includes(testSearch.toLocaleLowerCase("ro")) &&
      (testStatus === "all" ||
        (testStatus === "published" ? status === "PUBLISHED" : status === "DRAFT"))
    );
  });
  const testPages = Math.max(1, Math.ceil(filteredTests.length / 5));
  const safeTestPage = Math.min(testPage, testPages);
  const visibleTests = filteredTests.slice((safeTestPage - 1) * 5, safeTestPage * 5);
  const publishedTests = managed.filter(
    (t) => String(t.version_status ?? t.status ?? "").toUpperCase() === "PUBLISHED",
  ).length;
  const draftTests = managed.filter(
    (t) => String(t.version_status ?? t.status ?? "").toUpperCase() === "DRAFT",
  ).length;
  const dashboardStats = [
    { label: "Teste totale", value: managed.length, icon: Layers3, color: "blue" },
    {
      label: "Teste publicate",
      value: managed.filter(
        (t) => String(t.status ?? t.version_status ?? "").toUpperCase() === "PUBLISHED",
      ).length,
      icon: Users,
      color: "violet",
    },
    { label: "Teste atribuite mie", value: assigned.length, icon: ListChecks, color: "cyan" },
    { label: "Rezultatele mele", value: results.length, icon: Trophy, color: "purple" },
  ];

  const sectionCtx = {
    navigate,
    user,
    canManage,
    canDelete,
    tab,
    setTab,
    dashboardSearch,
    setDashboardSearch,
    testSearch,
    setTestSearch,
    testStatus,
    setTestStatus,
    testView,
    setTestView,
    testPage,
    setTestPage,
    dashboardPage,
    setDashboardPage,
    assignmentRows,
    setAssignmentRows,
    assignmentLoading,
    setAssignmentLoading,
    assignmentError,
    setAssignmentError,
    assignmentSearch,
    setAssignmentSearch,
    assignmentStatus,
    setAssignmentStatus,
    assignmentPage,
    setAssignmentPage,
    attemptRows,
    setAttemptRows,
    attemptLoading,
    setAttemptLoading,
    attemptError,
    setAttemptError,
    attemptSearch,
    setAttemptSearch,
    attemptStatus,
    setAttemptStatus,
    attemptPage,
    setAttemptPage,
    settingsSection,
    setSettingsSection,
    reportSearch,
    setReportSearch,
    reportTest,
    setReportTest,
    reportPage,
    setReportPage,
    assigned,
    setAssigned,
    results,
    setResults,
    managed,
    setManaged,
    loading,
    setLoading,
    error,
    setError,
    // Refolosește editorul existent, în modul de creare (fără modal).
    setShowCreate: () => navigate("/testare/nou/editare"),
    startingId,
    setStartingId,
    deleteTarget,
    setDeleteTarget,
    deleting,
    setDeleting,
    load,
    openEditor,
    openAssignedTest,
    openFinishedAttempt,
    finishedForVersion,
    confirmDelete,
    loadAttempts,
    loadAssignments,
    tabs,
    filteredAssignments,
    assignmentPages,
    safeAssignmentPage,
    visibleAssignments,
    assignmentFinished,
    assignmentStarted,
    assignmentPending,
    current,
    filteredAttempts,
    attemptPages,
    safeAttemptPage,
    visibleAttempts,
    finishedAttempts,
    gradedAttempts,
    attemptPassRate,
    reportRows,
    reportPages,
    safeReportPage,
    visibleReports,
    reportPercentages,
    reportAverage,
    reportGrades,
    reportGradeAverage,
    reportDistribution,
    reportKnownPasses,
    reportPassRate,
    attemptDate,
    filteredDashboardTests,
    dashboardPages,
    visibleDashboardTests,
    completedResults,
    passedResults,
    knownPasses,
    passRate,
    filteredTests,
    testPages,
    safeTestPage,
    visibleTests,
    publishedTests,
    draftTests,
    dashboardStats,
    rowsOf,
    messageOf,
    versionIdOf,
    groupAssigned,
  };

  return (
    <section className="pt-page">
      <div className="pt-heading">
        <div className="pt-heading-copy">
          <button className="pt-back-link" type="button" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={17} /> Înapoi la Dashboard
          </button>
          <span className="pt-eyebrow">
            <Sparkles size={14} /> BORDER / TESTARE PROFESIONALĂ
          </span>
          <div className="pt-heading-title">
            <span className="pt-heading-emblem">
              <GraduationCap size={34} />
            </span>
            <div>
              <h1>Testare</h1>
              <p>
                {tab === "results"
                  ? "Rezultatele testelor finalizate, cu punctaj și detalii."
                  : tab === "assigned"
                    ? "Testele atribuite pentru tine. Parcurge instrucțiunile, rezolvă testele și vezi rezultatele."
                    : "Creare teste, configurare, atribuire și analiză rezultate."}
              </p>
            </div>
          </div>
        </div>
        <div className="pt-actions">
          <button
            className="pt-button pt-button-light"
            type="button"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={17} /> Actualizează
          </button>
        </div>
      </div>

      <div className="pt-panel">
        <div className="pt-tabs" role="tablist" aria-label="Secțiuni testare profesională">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`pt-tab ${tab === id ? "pt-tab-active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
        {error && (
          <div className="pt-error" role="alert">
            {error}
          </div>
        )}
        {tab === "settings" && canManage ? (
          <SetariTestare ctx={sectionCtx} />
        ) : tab === "reports" && canManage && !loading && !error ? (
          <Rezultate ctx={sectionCtx} />
        ) : tab === "assignments" && canManage && !loading && !error ? (
          <Atribuiri ctx={sectionCtx} />
        ) : (tab === "attempts" || tab === "reports") && canManage && !loading && !error ? (
          <Incercari ctx={sectionCtx} />
        ) : tab === "manage" && canManage && !loading && !error ? (
          <ListaTeste ctx={sectionCtx} />
        ) : tab === "dashboard" && !loading && !error ? (
          <PanouGeneral ctx={sectionCtx} />
        ) : (tab === "assigned" || tab === "results") && !loading && !error ? (
          <TestareUserViews
            mode={tab}
            assigned={assigned}
            results={results}
            startingId={startingId}
            onStart={openAssignedTest}
            onOpenResult={openFinishedAttempt}
            versionIdOf={versionIdOf}
            finishedForVersion={finishedForVersion}
          />
        ) : loading ? (
          <div className="pt-loading">
            <span className="pt-spinner" aria-hidden="true" /> Se încarcă datele...
          </div>
        ) : !current.length ? (
          <div className="pt-empty">
            <ClipboardList size={36} />
            <h2>
              {tab === "assigned"
                ? "Nu ai teste atribuite"
                : tab === "results"
                  ? "Nu există rezultate"
                  : "Nu există teste create"}
            </h2>
            <p>
              {tab === "manage"
                ? "Creează primul test folosind butonul de mai sus."
                : "Informațiile vor apărea aici când sunt disponibile."}
            </p>
          </div>
        ) : (
          <div className="pt-list">
            {current.map((item, index) => {
              const versionId = versionIdOf(item);
              const completedAttempts = tab === "assigned" ? finishedForVersion(versionId) : [];
              const latestCompleted = completedAttempts[0];
              const maxAttempts = Number(item.max_attempts ?? item.allowed_attempts);
              const exhausted =
                Number.isFinite(maxAttempts) &&
                maxAttempts > 0 &&
                completedAttempts.length >= maxAttempts;
              return (
                <article
                  className={`pt-item pt-item-${tab}`}
                  key={`${tab}-${item.id ?? item.attempt_id ?? index}`}
                >
                  <div className="pt-item-icon">
                    <ClipboardList size={20} />
                  </div>
                  <div className="pt-item-content">
                    <h2>
                      {item.title ??
                        item.test_title ??
                        item.name ??
                        `Înregistrare #${item.id ?? index + 1}`}
                    </h2>
                    {item.description && <p>{item.description}</p>}
                    <div className="pt-meta">
                      {item.status && (
                        <span
                          className={`pt-status pt-status-${String(item.status).toLowerCase()}`}
                        >
                          {item.status === "PUBLISHED"
                            ? "Publicat"
                            : item.status === "DRAFT"
                              ? "Ciornă"
                              : item.status}
                        </span>
                      )}
                      {item.version_number != null && (
                        <span>
                          <FileCheck2 size={13} /> Versiunea {item.version_number}
                        </span>
                      )}
                      {item.score_percent != null && <span>Rezultat: {item.score_percent}%</span>}
                      {item.grade != null && <span>Nota: {item.grade}</span>}
                      {tab === "assigned" && item._assignmentCount > 1 && (
                        <span>Atribuit de {item._assignmentCount} ori</span>
                      )}
                      {item.duration_minutes != null && (
                        <span>
                          <Clock3 size={13} /> {item.duration_minutes} min
                        </span>
                      )}
                    </div>
                    {tab === "assigned" && (
                      <div className="pt-item-actions">
                        {latestCompleted && (
                          <button
                            className="pt-button pt-button-light"
                            type="button"
                            onClick={() => openFinishedAttempt(latestCompleted)}
                          >
                            <Eye size={17} /> Vezi rezultatul
                          </button>
                        )}
                        {!exhausted && (
                          <button
                            className="pt-button pt-button-primary"
                            type="button"
                            disabled={versionId == null || startingId != null}
                            onClick={() => openAssignedTest(item)}
                          >
                            <ArrowRight size={17} />{" "}
                            {startingId === String(versionId) ? "Se deschide..." : "Începe testul"}
                          </button>
                        )}
                        {exhausted && (
                          <span className="pt-state">
                            Încercările disponibile au fost utilizate.
                          </span>
                        )}
                      </div>
                    )}
                    {tab === "results" && (
                      <div className="pt-item-actions">
                        <button
                          className="pt-button pt-button-light"
                          type="button"
                          onClick={() => openFinishedAttempt(item)}
                          disabled={(item.attempt_id ?? item.attempt?.id ?? item.id) == null}
                        >
                          <Eye size={17} /> Vezi rezultatul <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                    {tab === "manage" && canManage && (
                      <div className="pt-item-actions">
                        <button
                          className="pt-button pt-button-light"
                          type="button"
                          onClick={() => openEditor(item)}
                          disabled={versionId == null}
                          title={
                            versionId == null
                              ? "ID-ul versiunii lipsește din răspunsul API"
                              : undefined
                          }
                        >
                          <Pencil size={17} /> Deschide editorul <ArrowRight size={16} />
                        </button>
                        {canDelete && item.id != null && (
                          <button
                            className="pt-button pt-button-danger"
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                id: item.id,
                                title: item.title || `Test #${item.id}`,
                              })
                            }
                            disabled={deleting}
                          >
                            <Trash2 size={17} /> Șterge testul
                          </button>
                        )}
                        {versionId == null && (
                          <p style={{ marginTop: 8, fontSize: 12, color: "#a34c20" }}>
                            Versiunea nu poate fi identificată din datele primite.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && canDelete && (
        <div className="pt-modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            className="pt-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pt-delete-title"
            aria-describedby="pt-delete-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-modal-header">
              <h2 id="pt-delete-title">Ștergere definitivă a testului</h2>
              <button
                type="button"
                className="pt-icon-button"
                aria-label="Închide"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p id="pt-delete-description" className="pt-delete-warning">
              Vei șterge definitiv testul <strong>{deleteTarget.title}</strong>, toate versiunile,
              întrebările, atribuirile, încercările și rezultatele utilizatorilor. Operațiunea nu
              poate fi anulată.
            </p>
            <div className="pt-modal-actions">
              <button
                type="button"
                className="pt-button pt-button-light"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Anulează
              </button>
              <button
                type="button"
                className="pt-button pt-button-danger"
                disabled={deleting}
                onClick={confirmDelete}
              >
                <Trash2 size={17} /> {deleting ? "Se șterge..." : "Șterge definitiv"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TestareProfesionala;
