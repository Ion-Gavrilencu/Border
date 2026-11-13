import React, { useMemo, useState } from "react";
import {
  Users,
  UserRound,
  UsersRound,
  CalendarDays,
  Clock3,
  Bell,
  Hourglass,
  LockKeyhole,
  RotateCcw,
  Eye,
  Search,
  ChevronDown,
  Settings2,
  ListFilter,
  Info,
  Check,
} from "lucide-react";

import TestGroupManager from "./TestGroupManager";
import "./Atribuire.css";

const displayName = (item) =>
  item.name || item.label || item.full_name || item.username || item.email || String(item.id);

const normalizeId = (id) => String(id ?? "");

const getMemberId = (member) => member.user_id ?? member.userId ?? member.id;

const toValidDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

export default function Atribuire({
  form,
  set,
  recipientSearch = "",
  setRecipientSearch = () => {},
  recipients = [],
  groups = [],
  groupsLoading = false,
  groupsError = "",
  onGroupsChanged,
  filteredRecipients,
  selectRecipient,
}) {
  const [showRecipients, setShowRecipients] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  const type = form.assignmentType || "individual";

  const group = normalizeId(form.assignmentGroupId);

  const selectedIds = Array.isArray(form.assignments) ? form.assignments : [];

  const users = Array.isArray(recipients) ? recipients : [];

  const reminderHours = Number(form.reminderHours ?? 24);

  const availableGroups = useMemo(() => {
    const source = Array.isArray(groups) ? groups : [];

    return source.map((g) => {
      const members = Array.isArray(g.members) ? g.members : [];

      return {
        id: normalizeId(g.id),
        name: g.name || `Grup ${g.id}`,
        membersLoaded: g.membersLoaded !== false,

        users: members.map((member) => {
          const memberId = getMemberId(member);

          const existingUser = users.find((user) => normalizeId(user.id) === normalizeId(memberId));

          return (
            existingUser || {
              id: memberId,
              name: member.full_name || member.username || member.name || `Utilizator ${memberId}`,
            }
          );
        }),
      };
    });
  }, [groups, users]);

  const selectedGroup = availableGroups.find((item) => item.id === group);

  const selectedUsers = useMemo(() => {
    const source = type === "group" ? selectedGroup?.users || [] : users;

    return source.filter((user) =>
      selectedIds.some((id) => normalizeId(id) === normalizeId(user.id)),
    );
  }, [type, selectedGroup, users, selectedIds]);

  const visibleUsers = useMemo(() => {
    if (Array.isArray(filteredRecipients)) {
      return filteredRecipients;
    }

    const search = recipientSearch.trim().toLocaleLowerCase("ro");

    if (!search) return users;

    return users.filter((user) => displayName(user).toLocaleLowerCase("ro").includes(search));
  }, [filteredRecipients, users, recipientSearch]);

  const assignIds = (items) => {
    const ids = [
      ...new Set(
        items
          .map((item) => item.id)
          .filter((id) => id !== null && id !== undefined && id !== "")
          .map(normalizeId),
      ),
    ];

    set("assignments", ids);
  };

  const changeType = (nextType) => {
    if (nextType === type) return;

    set("assignmentType", nextType);

    if (nextType === "all") {
      assignIds(users);
      return;
    }

    if (nextType === "group") {
      const members = selectedGroup?.membersLoaded ? selectedGroup.users : [];

      assignIds(members);
      return;
    }

    set("assignments", []);
  };

  const changeGroup = (id) => {
    set("assignmentGroupId", id);

    const nextGroup = availableGroups.find((item) => item.id === normalizeId(id));

    if (!nextGroup?.membersLoaded) {
      set("assignments", []);
      return;
    }

    assignIds(nextGroup.users);
  };

  const option = (key, fallback = false) => form[key] ?? fallback;

  const toggle = (key, fallback = false) => {
    set(key, !Boolean(option(key, fallback)));
  };

  const startDate = toValidDate(form.availableFrom);
  const endDate = toValidDate(form.availableUntil);

  const hasPeriod = Boolean(startDate && endDate && endDate.getTime() > startDate.getTime());

  const hasRecipients =
    type === "group"
      ? Boolean(selectedGroup && selectedGroup.membersLoaded && selectedGroup.users.length > 0)
      : type === "all"
        ? users.length > 0
        : selectedIds.length > 0;

  const valid = hasPeriod && hasRecipients;

  const options = [
    {
      key: "notifyOnAssignment",
      label: "Notifică utilizatorii la atribuire",
      icon: Bell,
      fallback: false,
    },
    {
      key: "sendReminder",
      label: "Trimite reminder înainte de expirare",
      icon: Hourglass,
      fallback: false,
    },
    {
      key: "blockAfterExpiry",
      label: "Blochează efectuarea după expirare",
      icon: LockKeyhole,
      fallback: true,
    },
    {
      key: "allowRetake",
      label: "Permite reluarea testului",
      icon: RotateCcw,
      fallback: true,
    },
    {
      key: "showInAssignedTests",
      label: 'Afișează testul în lista "Teste atribuite"',
      icon: Eye,
      fallback: true,
    },
  ];

  return (
    <section className="pta-card">
      <div className="pta-heading">
        <span className="pta-heading-icon">
          <UsersRound size={27} />
        </span>

        <div>
          <h2>Atribuire test</h2>
          <p>Stabilește cui va fi atribuit testul și perioada de participare.</p>
        </div>
      </div>

      {/* TIPUL ATRIBUIRII */}

      <div className="pta-section">
        <h3>
          <ListFilter size={22} />
          Tipul atribuirii
        </h3>

        <div className="pta-type-grid">
          {[
            {
              id: "group",
              title: "Către un grup",
              desc: "Atribuie testul unui grup de utilizatori",
              icon: UsersRound,
            },
            {
              id: "individual",
              title: "Către utilizatori individuali",
              desc: "Selectează unul sau mai mulți utilizatori",
              icon: UserRound,
            },
            {
              id: "all",
              title: "Către toți utilizatorii",
              desc: "Atribuie testul tuturor utilizatorilor eligibili",
              icon: Users,
            },
          ].map(({ id, title, desc, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`pta-type ${type === id ? "is-selected" : ""}`}
              onClick={() => changeType(id)}
              aria-pressed={type === id}
            >
              <span className="pta-radio" />

              <Icon size={29} />

              <span>
                <strong>{title}</strong>
                <small>{desc}</small>
              </span>
            </button>
          ))}
        </div>

        {/* GRUPURI */}

        {type === "group" && (
          <>
            <div className="pta-group-row">
              <label>
                Selectează grupul <b>*</b>
                <span className="pta-select-wrap">
                  <UsersRound size={19} />

                  <select
                    value={group}
                    onChange={(event) => changeGroup(event.target.value)}
                    disabled={groupsLoading}
                  >
                    <option value="">Selectează un grup</option>

                    {availableGroups
                      .filter((item) =>
                        item.name
                          .toLocaleLowerCase("ro")
                          .includes(groupSearch.toLocaleLowerCase("ro")),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (
                          {item.membersLoaded
                            ? `${item.users.length} utilizatori`
                            : "membri indisponibili"}
                          )
                        </option>
                      ))}
                  </select>

                  <ChevronDown size={18} />
                </span>
              </label>

              <label>
                Caută grup
                <span className="pta-search-wrap">
                  <Search size={19} />

                  <input
                    value={groupSearch}
                    onChange={(event) => setGroupSearch(event.target.value)}
                    placeholder="Caută grup..."
                  />
                </span>
              </label>
            </div>

            <TestGroupManager groups={groups} recipients={users} onChanged={onGroupsChanged} />
          </>
        )}

        {/* CĂUTARE UTILIZATORI */}

        {type === "individual" && (
          <label className="pta-user-search">
            Caută destinatari
            <span className="pta-search-wrap">
              <Search size={19} />

              <input
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Caută utilizator..."
              />
            </span>
          </label>
        )}

        {/* DESTINATARI SELECTAȚI */}

        <div className="pta-selected-heading">
          <strong>
            Destinatari selectați (
            {type === "all"
              ? users.length
              : type === "group"
                ? selectedGroup?.users.length || 0
                : selectedIds.length}
            )
          </strong>

          {selectedUsers.length > 0 && (
            <button
              type="button"
              className="pta-button"
              onClick={() => setShowRecipients((value) => !value)}
            >
              <Users size={17} />

              {showRecipients ? "Ascunde lista" : "Vezi lista"}
            </button>
          )}
        </div>

        {type === "group" && groupsLoading && <p className="pta-hint">Se încarcă grupurile...</p>}

        {type === "group" && groupsError && (
          <p className="pta-hint" role="alert">
            {groupsError}
          </p>
        )}

        {type === "group" && selectedGroup && (
          <div className="pta-selected-box">
            <UsersRound size={23} />

            <div>
              <strong>{selectedGroup.name}</strong>
              <span>{selectedGroup.users.length} utilizatori</span>
            </div>
          </div>
        )}

        {type === "all" && (
          <div className="pta-selected-box">
            <Users size={23} />

            <div>
              <strong>Toți utilizatorii disponibili</strong>

              <span>{users.length} utilizatori din sursa conectată</span>
            </div>
          </div>
        )}

        {type === "individual" && !showRecipients && selectedUsers.length > 0 && (
          <div className="pta-selected-box">
            <Users size={23} />

            <div>
              <strong>{selectedUsers.length} utilizatori selectați</strong>

              <span>{selectedUsers.map(displayName).join(", ")}</span>
            </div>
          </div>
        )}

        {/* LISTA UTILIZATORILOR */}

        {type === "individual" && (
          <div className="pta-users-list">
            {visibleUsers.map((user) => (
              <label key={user.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.some((id) => normalizeId(id) === normalizeId(user.id))}
                  onChange={(event) => selectRecipient(user.id, event.target.checked)}
                />

                <span>{displayName(user)}</span>
              </label>
            ))}
          </div>
        )}

        {showRecipients && type !== "individual" && (
          <div className="pta-users-list">
            {selectedUsers.map((user) => (
              <div key={user.id} className="pta-user-line">
                <Check size={16} />
                {displayName(user)}
              </div>
            ))}
          </div>
        )}

        {!users.length && (
          <p className="pta-hint">
            <Info size={16} />
            Lista utilizatorilor nu este conectată. Transmite datele reale prin prop-ul{" "}
            <code>recipients</code>.
          </p>
        )}

        {type === "group" && availableGroups.length === 0 && !groupsLoading && (
          <p className="pta-hint">
            <Info size={16} />
            Nu există grupuri. Creează un grup în administrarea grupurilor.
          </p>
        )}
      </div>

      {/* PERIOADA DE PARTICIPARE */}

      <div className="pta-section">
        <h3>
          <CalendarDays size={22} />
          Perioada de participare
        </h3>

        <div className="pta-period">
          <label>
            Disponibil de la <b>*</b>
            <span className="pta-date">
              <CalendarDays size={18} />

              <input
                type="datetime-local"
                value={form.availableFrom || ""}
                onChange={(event) => set("availableFrom", event.target.value)}
              />
            </span>
          </label>

          <label>
            Disponibil până la <b>*</b>
            <span className="pta-date">
              <CalendarDays size={18} />

              <input
                type="datetime-local"
                min={form.availableFrom || undefined}
                value={form.availableUntil || ""}
                onChange={(event) => set("availableUntil", event.target.value)}
              />
            </span>
          </label>

          <label>
            Durată test
            <span className="pta-duration">
              <Clock3 size={21} />
              {form.duration ?? 30} minute
            </span>
          </label>
        </div>
      </div>

      {/* OPȚIUNI SUPLIMENTARE */}

      <div className="pta-section">
        <h3>
          <Settings2 size={22} />
          Opțiuni suplimentare
        </h3>

        <div className="pta-options">
          {options.map(({ key, label, icon: Icon, fallback }) => (
            <div className="pta-option" key={key}>
              <Icon size={20} />

              <span>{label}</span>

              {key === "sendReminder" && (
                <select
                  aria-label="Interval reminder"
                  value={reminderHours}
                  disabled={!option("sendReminder")}
                  onChange={(event) => set("reminderHours", Number(event.target.value))}
                >
                  <option value={24}>24 ore</option>

                  <option value={48}>48 ore</option>

                  <option value={72}>72 ore</option>
                </select>
              )}

              <label className="pta-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(option(key, fallback))}
                  onChange={() => toggle(key, fallback)}
                />

                <span />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* VALIDAREA ATRIBUIRII */}

      <div className={`pta-status ${valid ? "is-valid" : ""}`} role="status">
        {valid ? <Check size={18} /> : <Info size={18} />}

        {valid
          ? "Destinatarii și perioada sunt configurați."
          : !hasRecipients
            ? "Selectează destinatarii testului."
            : !hasPeriod
              ? "Selectează o perioadă validă pentru atribuire."
              : "Verifică informațiile atribuirii."}
      </div>
    </section>
  );
}
