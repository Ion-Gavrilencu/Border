import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FolderPlus,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import {
  createTestGroup,
  updateTestGroup,
  addTestGroupMembers,
  removeTestGroupMember,
} from "../../services/professionalTestingService";
import "./TestGroupManager.css";

const message = (error) => error?.response?.data?.message || error?.message || "Operația a eșuat.";
const userLabel = (u) => u?.name || u?.full_name || u?.username || `Utilizator ${u?.id}`;

export default function TestGroupManager({ groups = [], recipients = [], onChanged }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ids, setIds] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const group = groups.find((g) => String(g.id) === selected);
  const members = useMemo(() => (group?.members || []).map((m) => Number(m.id)), [group]);
  const available = useMemo(
    () =>
      recipients.filter(
        (u) =>
          !members.includes(Number(u.id)) &&
          userLabel(u).toLocaleLowerCase("ro").includes(search.trim().toLocaleLowerCase("ro")),
      ),
    [recipients, members, search],
  );
  const canEdit = !group || Boolean(group.can_edit);

  const changeSelection = (id) => {
    setSelected(String(id));
    setIds([]);
    setSearch("");
    setError("");
    setNotice("");
    const next = groups.find((item) => String(item.id) === String(id));
    setName(next?.name || "");
    setDescription(next?.description || "");
  };

  const run = async (operation, success = "Modificările au fost salvate.") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      await onChanged?.();
      setNotice(success);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const saveGroup = () =>
    run(
      async () => {
        if (group) {
          await updateTestGroup(group.id, { name: name.trim(), description });
        } else {
          const response = await createTestGroup({ name: name.trim(), description });
          if (response?.group?.id != null) setSelected(String(response.group.id));
        }
      },
      group ? "Grupul a fost actualizat." : "Grupul a fost creat. Acum poți adăuga membri.",
    );

  const toggleId = (id) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <section className="tgm" aria-label="Administrarea grupurilor de testare">
      <button
        type="button"
        className={`tgm-toggle ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tgm-toggle-icon">
          <UsersRound size={19} />
        </span>
        <span className="tgm-toggle-copy">
          <strong>Administrare grupuri</strong>
          <small>Creează schimburi și gestionează membrii</small>
        </span>
        <span className="tgm-count">
          {groups.length} {groups.length === 1 ? "grup" : "grupuri"}
        </span>
        <ChevronDown size={18} className="tgm-chevron" />
      </button>

      {open && (
        <div className="tgm-panel">
          <div className="tgm-panel-heading">
            <div>
              <h3>Grupuri de utilizatori</h3>
              <p>Organizează angajații pentru atribuirea rapidă a testelor.</p>
            </div>
            <span className="tgm-info">
              <ShieldCheck size={15} /> Acces controlat
            </span>
          </div>

          <div className="tgm-layout">
            <div className="tgm-card">
              <div className="tgm-card-title">
                <span className="tgm-card-icon">
                  <FolderPlus size={18} />
                </span>
                <div>
                  <h4>{group ? "Editează grupul" : "Detalii grup"}</h4>
                  <p>Definește numele și descrierea.</p>
                </div>
              </div>
              <label className="tgm-field">
                <span>Grup existent</span>
                <span className="tgm-select-wrap">
                  <select
                    value={selected}
                    onChange={(e) => changeSelection(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">+ Creează un grup nou</option>
                    {groups.map((g) => (
                      <option key={g.id} value={String(g.id)}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </span>
              </label>
              <label className="tgm-field">
                <span>
                  Nume grup <em>*</em>
                </span>
                <input
                  value={name}
                  maxLength={150}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Schimbul nr. 2"
                  disabled={busy || !canEdit}
                />
              </label>
              <label className="tgm-field">
                <span>
                  Descriere <small>(opțional)</small>
                </span>
                <textarea
                  rows={3}
                  value={description}
                  maxLength={2000}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Echipa din schimbul al doilea"
                  disabled={busy || !canEdit}
                />
              </label>
              {group && !canEdit && (
                <p className="tgm-hint">
                  <ShieldCheck size={15} /> Doar administratorul sau creatorul poate modifica acest
                  grup.
                </p>
              )}
              <button
                type="button"
                className="tgm-primary"
                disabled={busy || !name.trim() || !canEdit}
                onClick={saveGroup}
              >
                {busy ? (
                  <LoaderCircle size={16} className="tgm-spin" />
                ) : group ? (
                  <Pencil size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {group ? "Salvează modificările" : "Creează grupul"}
              </button>
            </div>

            <div className="tgm-card tgm-members-card">
              <div className="tgm-card-title">
                <span className="tgm-card-icon violet">
                  <Users size={18} />
                </span>
                <div>
                  <h4>
                    Membrii grupului <span className="tgm-member-count">{members.length}</span>
                  </h4>
                  <p>
                    {group
                      ? "Adaugă sau elimină utilizatori."
                      : "Selectează un grup pentru a-i gestiona membrii."}
                  </p>
                </div>
              </div>
              {!group ? (
                <div className="tgm-empty">
                  <UsersRound size={30} />
                  <strong>Niciun grup selectat</strong>
                  <span>
                    Creează un grup sau selectează unul existent pentru a gestiona membrii.
                  </span>
                </div>
              ) : (
                <>
                  <div className="tgm-member-list" aria-label="Membri existenți">
                    {(group.members || []).length ? (
                      group.members.map((m) => (
                        <div className="tgm-member" key={m.id}>
                          <span className="tgm-avatar">
                            {userLabel(m).trim().slice(0, 1).toUpperCase()}
                          </span>
                          <span className="tgm-member-name">{userLabel(m)}</span>
                          {canEdit && (
                            <button
                              type="button"
                              className="tgm-remove"
                              title={`Elimină ${userLabel(m)}`}
                              aria-label={`Elimină ${userLabel(m)}`}
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => removeTestGroupMember(group.id, m.id),
                                  "Membrul a fost eliminat.",
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="tgm-empty-members">Grupul nu are încă membri.</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="tgm-add-area">
                      <label className="tgm-field">
                        <span>Adaugă utilizatori</span>
                        <span className="tgm-search">
                          <Search size={17} />
                          <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Caută după nume..."
                            disabled={busy}
                          />
                        </span>
                      </label>
                      <div className="tgm-user-list" aria-label="Utilizatori disponibili">
                        {available.length ? (
                          available.map((u) => {
                            const id = Number(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`tgm-user ${ids.includes(id) ? "checked" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={ids.includes(id)}
                                  disabled={busy}
                                  onChange={() => toggleId(id)}
                                />
                                <span className="tgm-checkbox-mark">
                                  <Check size={13} />
                                </span>
                                <span className="tgm-user-name">{userLabel(u)}</span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="tgm-empty-members">
                            Nu sunt utilizatori disponibili pentru această căutare.
                          </p>
                        )}
                      </div>
                      <div className="tgm-add-footer">
                        <span>{ids.length} selectați</span>
                        <button
                          type="button"
                          className="tgm-primary"
                          disabled={busy || !ids.length}
                          onClick={() =>
                            run(async () => {
                              await addTestGroupMembers(group.id, ids);
                              setIds([]);
                            }, "Membrii au fost adăugați.")
                          }
                        >
                          {busy ? (
                            <LoaderCircle size={16} className="tgm-spin" />
                          ) : (
                            <UserPlus size={16} />
                          )}
                          Adaugă {ids.length} {ids.length === 1 ? "membru" : "membri"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {error && (
            <div className="tgm-feedback error" role="alert">
              <CircleAlert size={17} />
              {error}
              <button type="button" onClick={() => setError("")} aria-label="Închide mesajul">
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="tgm-feedback success" role="status">
              <CheckCircle2 size={17} />
              {notice}
              <button type="button" onClick={() => setNotice("")} aria-label="Închide mesajul">
                <X size={15} />
              </button>
            </div>
          )}
          <p className="tgm-footnote">
            <ShieldCheck size={14} /> Grupurile sunt comune. Modificările sunt permise doar
            administratorului sau creatorului.
          </p>
        </div>
      )}
    </section>
  );
}
