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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/authStore";
import {
  getAssignedTests,
  getMyTestResults,
  getManagedTests,
  createProfessionalTest,
  startProfessionalTest,
  deleteProfessionalTest,
} from "../services/professionalTestingService";
import "./TestareProfesionala.css";

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
  const [tab, setTab] = useState("assigned");
  const [assigned, setAssigned] = useState([]);
  const [results, setResults] = useState([]);
  const [managed, setManaged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
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
    navigate(`/testare/incercari/${encodeURIComponent(attemptId)}`);
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

  const createTest = async (event) => {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const created = await createProfessionalTest({
        title: title.trim(),
        description: description.trim(),
      });
      const versionId = versionIdOf(created?.data ?? created);
      toast.success("Testul a fost creat.");
      setTitle("");
      setDescription("");
      setShowCreate(false);
      setTab("manage");
      if (versionId != null) {
        navigate(`/testare/${encodeURIComponent(versionId)}/editare`);
      } else {
        toast.info("Testul a fost creat. Selectează-l din lista de administrare.");
        await load();
      }
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setSaving(false);
    }
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

  const tabs = [
    { id: "assigned", label: "Teste atribuite", icon: ClipboardList },
    { id: "results", label: "Rezultatele mele", icon: Trophy },
    ...(canManage ? [{ id: "manage", label: "Administrare teste", icon: GraduationCap }] : []),
  ];
  const current = tab === "assigned" ? assigned : tab === "results" ? results : managed;

  return (
    <section className="pt-page">
      <div className="pt-heading">
        <div>
          <span className="pt-eyebrow">
            <Sparkles size={14} /> BORDER / FORMARE PROFESIONALĂ
          </span>
          <h1>Testare profesională</h1>
          <p>Accesează testele atribuite și urmărește rezultatele evaluărilor.</p>
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
          {canManage && (
            <button
              className="pt-button pt-button-primary"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={17} /> Creează test
            </button>
          )}
        </div>
      </div>

      <div className="pt-overview" aria-label="Rezumat testare profesională">
        <div className="pt-overview-item">
          <div className="pt-overview-icon pt-overview-blue">
            <ClipboardList size={20} />
          </div>
          <div>
            <span>Teste atribuite</span>
            <strong>{assigned.length}</strong>
          </div>
        </div>
        <div className="pt-overview-item">
          <div className="pt-overview-icon pt-overview-green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Rezultate înregistrate</span>
            <strong>{results.length}</strong>
          </div>
        </div>
        {canManage && (
          <div className="pt-overview-item">
            <div className="pt-overview-icon pt-overview-violet">
              <GraduationCap size={20} />
            </div>
            <div>
              <span>Teste administrate</span>
              <strong>{managed.length}</strong>
            </div>
          </div>
        )}
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
        {loading ? (
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

      {showCreate && canManage && (
        <div className="pt-modal-backdrop" onClick={() => !saving && setShowCreate(false)}>
          <div
            className="pt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pt-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-modal-header">
              <h2 id="pt-modal-title">Creează un test profesional</h2>
              <button
                type="button"
                className="pt-icon-button"
                aria-label="Închide"
                onClick={() => setShowCreate(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={createTest}>
              <label htmlFor="pt-title">Denumirea testului *</label>
              <input
                id="pt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="Ex. Test de verificare profesională"
              />
              <label htmlFor="pt-description">Descriere</label>
              <textarea
                id="pt-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Descrierea testului (opțional)"
              />
              <div className="pt-modal-actions">
                <button
                  type="button"
                  className="pt-button pt-button-light"
                  disabled={saving}
                  onClick={() => setShowCreate(false)}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="pt-button pt-button-primary"
                  disabled={saving || !title.trim()}
                >
                  {saving ? "Se salvează..." : "Creează testul"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default TestareProfesionala;
