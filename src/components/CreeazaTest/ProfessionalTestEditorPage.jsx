import { useCallback, useEffect, useState } from "react";
import PreviewTestModal from "./PreviewTestModal";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ProfessionalTestEditor from "./ProfessionalTestEditor";
import {
  createProfessionalTest,
  getTestVersion,
  getTestQuestions,
  getEligibleTestUsers,
  getTestGroups,
  getTestGroup,
  saveTestSettings,
  addTestQuestion,
  editTestQuestion,
  deleteTestQuestion,
  publishTestVersion,
  assignTestVersion,
  previewTestQuestionsImport,
} from "../../services/professionalTestingService";

const localDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const numericId = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;
const mapQuestion = (q) => ({
  id: Number(q.id),
  text: q.question_text,
  type:
    q.question_type === "TRUE_FALSE"
      ? "truefalse"
      : q.question_type === "MULTIPLE_CHOICE"
        ? "multiple"
        : "single",
  points: Number(q.points),
  explanation: q.explanation || "",
  answers: (q.options || []).map((o) => ({ text: o.option_text, correct: o.is_correct })),
});
const mapForm = (v, questions) => ({
  title: v.title || "",
  category: v.category || "",
  description: v.description || "",
  duration: v.duration_minutes,
  maxAttempts: v.max_attempts,
  passThreshold: Number(v.passing_percentage),
  maxGrade: Number(v.max_grade),
  grading: v.grading_mode,
  rounding: v.rounding_mode,
  allowRetake: v.allow_retake,
  showGrade: v.show_grade,
  showCorrect: v.reveal_answers === "AFTER_SUBMISSION",
  showExplanations: v.show_explanations,
  shuffleQuestions: v.shuffle_questions,
  shuffleAnswers: v.shuffle_options,
  availableFrom: v.available_from ? localDateTime(v.available_from) : "",
  availableUntil: v.available_until ? localDateTime(v.available_until) : "",
  questions: questions.map(mapQuestion),
  assignments: [],
});
const questionPayload = (q) => ({
  question_type:
    q.type === "truefalse"
      ? "TRUE_FALSE"
      : q.type === "multiple"
        ? "MULTIPLE_CHOICE"
        : "SINGLE_CHOICE",
  question_text: q.text.trim(),
  points: Number(q.points),
  explanation: q.explanation || null,
  options: (q.answers || []).map((a) => ({ option_text: a.text.trim(), is_correct: !!a.correct })),
});
const settings = (form) => ({
  duration_minutes: Number(form.duration),
  max_attempts: Number(form.maxAttempts),
  passing_percentage: Number(form.passThreshold),
  max_grade: Number(form.maxGrade),
  grading_mode: form.grading,
  rounding_mode: form.rounding,
  allow_retake: form.allowRetake,
  show_grade: form.showGrade,
  reveal_answers: form.showCorrect ? "AFTER_SUBMISSION" : "NEVER",
  show_explanations: form.showExplanations,
  shuffle_questions: form.shuffleQuestions,
  shuffle_options: form.shuffleAnswers,
  available_from: form.availableFrom ? new Date(form.availableFrom).toISOString() : null,
  available_until: form.availableUntil ? new Date(form.availableUntil).toISOString() : null,
});
const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Eroare necunoscută";

export default function ProfessionalTestEditorPage() {
  const { testId } = useParams(); // În ruta BORDER, parametrul este ID-ul VERSIUNII.
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentOnly = searchParams.get("mod") === "atribuire";
  const [initialData, setInitialData] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState("");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [versionForImport, setVersionForImport] = useState(null);
  const [previewForm, setPreviewForm] = useState(null);
  const isNew = testId === "nou" || testId === "new";
  const refreshGroups = useCallback(async () => {
    // Grupurile sunt încărcate separat: un grup gol trebuie să fie vizibil.
    setGroupsLoading(true);
    setGroupsError("");
    try {
      const response = await getTestGroups();
      const groupRows = Array.isArray(response?.groups) ? response.groups : [];
      const details = await Promise.allSettled(groupRows.map((g) => getTestGroup(g.id)));
      setGroups(
        groupRows.map((g, index) => ({
          ...g,
          members:
            details[index].status === "fulfilled"
              ? (details[index].value.members || []).filter((m) => m.is_active !== false)
              : [],
          membersLoaded: details[index].status === "fulfilled",
        })),
      );
      if (details.some((d) => d.status === "rejected"))
        setGroupsError("Nu au putut fi încărcați membrii tuturor grupurilor.");
    } catch (groupError) {
      setGroups([]);
      setGroupsError(errorMessage(groupError));
    } finally {
      setGroupsLoading(false);
    }
  }, []);
  const load = useCallback(async () => {
    setError("");
    setInitialData(null);
    setReadOnly(false);
    try {
      // Încărcarea destinatarilor este independentă de încărcarea ciornei.
      // Un eșec al listei nu trebuie să blocheze editarea testului.
      setRecipientsLoading(true);
      setRecipientsError("");
      try {
        const response = await getEligibleTestUsers();
        const payload = response?.data ?? response;
        const userList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.users)
            ? payload.users
            : Array.isArray(payload?.recipients)
              ? payload.recipients
              : Array.isArray(payload?.data?.users)
                ? payload.data.users
                : null;
        if (!userList)
          throw new Error("API-ul nu a returnat o listă de utilizatori în formatul așteptat.");
        setRecipients(
          userList
            .filter((user) => user?.id != null)
            .map((user) => ({
              id: Number(user.id),
              name:
                user.full_name ||
                user.fullName ||
                user.name ||
                user.username ||
                user.email ||
                `Utilizator ${user.id}`,
              groupId: user.group_id ?? user.groupId ?? null,
              groupName: user.group_name ?? user.groupName ?? "",
            }))
            .filter((user) => Number.isSafeInteger(user.id) && user.id > 0),
        );
      } catch (usersError) {
        setRecipients([]);
        setRecipientsError(errorMessage(usersError));
      } finally {
        setRecipientsLoading(false);
      }
      await refreshGroups();
      if (isNew) {
        if (assignmentOnly) throw new Error("Selectează un test publicat pentru atribuire.");
        setInitialData({});
        return;
      }
      if (!numericId(testId)) throw new Error("ID versiune invalid.");
      const [versionResponse, questionsResponse] = await Promise.all([
        getTestVersion(testId),
        getTestQuestions(testId),
      ]);
      if (assignmentOnly) {
        if (versionResponse.version.status !== "PUBLISHED")
          throw new Error("Atribuirea nouă este permisă doar pentru versiuni publicate.");
      } else if (
        versionResponse.version.status !== "DRAFT" &&
        versionResponse.version.status !== "PUBLISHED"
      ) {
        throw new Error("Starea versiunii nu permite deschiderea editorului.");
      }
      setReadOnly(!assignmentOnly && versionResponse.version.status === "PUBLISHED");
      setVersionForImport(Number(testId));
      setInitialData(mapForm(versionResponse.version, questionsResponse.questions || []));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [testId, isNew, assignmentOnly, refreshGroups]);
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const persist = async (form) => {
    if (readOnly) throw new Error("Versiunea publicată poate fi doar vizualizată.");
    if (form.questions.some((q) => q.type === "open"))
      throw new Error(
        "Întrebările cu răspuns deschis necesită evaluare manuală și nu sunt încă suportate de API.",
      );
    if (form.questions.some((q) => !q.text?.trim() || !q.answers?.length))
      throw new Error("Completează întrebările înainte de salvare.");
    let versionId = isNew ? null : Number(testId);
    if (!versionId) {
      const created = await createProfessionalTest({
        title: form.title,
        category: form.category,
        description: form.description,
        ...settings(form),
      });
      versionId = created.version.id;
      // Din acest punct ciorna există pe server chiar dacă o operație ulterioară eșuează.
      setVersionForImport(versionId);
      navigate(`/testare/${versionId}/editare`, { replace: true });
    } else {
      await saveTestSettings(versionId, {
        ...settings(form),
        title: form.title,
        category: form.category,
        description: form.description,
      });
    }
    const existing = (await getTestQuestions(versionId)).questions || [];
    const existingIds = new Set(existing.map((q) => Number(q.id)));
    for (const q of form.questions) {
      const payload = questionPayload(q);
      if (numericId(q.id) && existingIds.has(Number(q.id))) {
        await editTestQuestion(versionId, q.id, payload);
      } else {
        await addTestQuestion(versionId, payload);
      }
    }
    const kept = new Set(form.questions.filter((q) => numericId(q.id)).map((q) => Number(q.id)));
    for (const q of existing) {
      if (!kept.has(Number(q.id))) await deleteTestQuestion(versionId, q.id);
    }
    const fresh = (await getTestQuestions(versionId)).questions || [];
    return { versionId, questions: fresh.map(mapQuestion) };
  };
  const save = async (form) => {
    if (assignmentOnly || readOnly) throw new Error("Versiunea publicată nu poate fi editată.");
    return persist(form);
  };
  const importQuestions = async (currentQuestions, applyQuestions) => {
    if (readOnly) throw new Error("Importul nu este permis pentru versiuni publicate.");
    const id = versionForImport || (!isNew ? Number(testId) : null);
    if (!id) {
      window.alert("Salvează mai întâi ciorna, apoi importă întrebările.");
      return;
    }
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".docx,.xlsx,.csv,.txt,.json,.pdf";
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error("Fișierul depășește 5 MB.");
        const preview = await previewTestQuestionsImport(id, file);
        const errors = preview.errors || [];
        if (errors.length)
          throw new Error(
            `Importul conține ${errors.length} întrebări invalide. Prima eroare: rândul ${errors[0].row}. ${errors[0].message}`,
          );
        const imported = (preview.questions || []).map((q) => ({
          id: globalThis.crypto?.randomUUID?.() || `import-${Date.now()}-${Math.random()}`,
          text: q.question_text,
          type:
            q.question_type === "TRUE_FALSE"
              ? "truefalse"
              : q.question_type === "MULTIPLE_CHOICE"
                ? "multiple"
                : "single",
          points: Number(q.points || 1),
          explanation: q.explanation || "",
          answers: (q.options || []).map((o) => ({ text: o.option_text, correct: !!o.is_correct })),
        }));
        if (!imported.length) throw new Error("Documentul nu conține întrebări valide.");
        if (
          window.confirm(
            `Adaugi ${imported.length} întrebări în editor? Vor fi salvate când apeși «Salvează ciornă».`,
          )
        ) {
          applyQuestions([...(currentQuestions || []), ...imported]);
        }
      } catch (e) {
        window.alert(errorMessage(e));
      }
    };
    picker.click();
  };
  const exportQuestions = async (questions) => {
    if (!questions?.length) throw new Error("Nu există întrebări de exportat.");
    // Necesită: npm install exceljs (în proiectul frontend).
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Întrebări");
    sheet.columns = [
      { header: "Nr.", key: "number", width: 8 },
      { header: "Întrebare", key: "text", width: 65 },
      { header: "Tip", key: "type", width: 24 },
      { header: "Punctaj", key: "points", width: 12 },
      { header: "Varianta", key: "option", width: 55 },
      { header: "Corect", key: "correct", width: 12 },
      { header: "Explicație", key: "explanation", width: 65 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2457D6" } };
    questions.forEach((q, index) => {
      const type =
        q.type === "truefalse"
          ? "Adevărat sau fals"
          : q.type === "multiple"
            ? "Răspuns multiplu"
            : "Un singur răspuns";
      const answers = q.answers?.length ? q.answers : [{ text: "", correct: false }];
      answers.forEach((answer, answerIndex) => {
        sheet.addRow({
          number: answerIndex === 0 ? index + 1 : "",
          text: answerIndex === 0 ? q.text || "" : "",
          type: answerIndex === 0 ? type : "",
          points: answerIndex === 0 ? Number(q.points || 0) : "",
          option: answer.text || "",
          correct: answer.correct ? "DA" : "NU",
          explanation: answerIndex === 0 ? q.explanation || "" : "",
        });
      });
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "G1" };
    const bytes = await workbook.xlsx.writeBuffer();
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BORDER-intrebari-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openPreview = (form) => {
    if (!form?.questions?.length) {
      window.alert("Adaugă cel puțin o întrebare pentru previzualizare.");
      return;
    }
    setPreviewForm({
      ...form,
      questions: form.questions.map((q) => ({
        ...q,
        answers: (q.answers || []).map((a) => ({ ...a })),
      })),
    });
  };

  const publish = async (form) => {
    if (readOnly) throw new Error("Versiunea publicată nu poate fi republicată.");
    if (!assignmentOnly && !form.questions.length)
      throw new Error("Adaugă întrebări înainte de publicare.");
    if (
      !form.availableFrom ||
      !form.availableUntil ||
      !Number.isFinite(Date.parse(form.availableFrom)) ||
      !Number.isFinite(Date.parse(form.availableUntil)) ||
      Date.parse(form.availableUntil) <= Date.parse(form.availableFrom)
    ) {
      throw new Error("Selectează o perioadă de atribuire validă.");
    }
    const targets =
      form.assignmentType === "all"
        ? [{ target_type: "ALL" }]
        : form.assignmentType === "group"
          ? [{ target_type: "GROUP", group_id: Number(form.assignmentGroupId) }]
          : form.assignments.map((id) => ({ target_type: "USER", user_id: Number(id) }));
    if (!targets.length || targets.some((t) => t.target_type === "GROUP" && !t.group_id))
      throw new Error("Selectează destinatari valizi înainte de publicare.");
    // Validăm toți destinatarii înainte de publicare (operație ireversibilă).
    if (
      targets.some(
        (t) => t.target_type === "USER" && (!Number.isSafeInteger(t.user_id) || t.user_id <= 0),
      )
    ) {
      throw new Error("Lista conține destinatari invalizi.");
    }
    // Pentru versiuni publicate nu modificăm întrebările sau regulile testului.
    const saved = assignmentOnly
      ? { versionId: Number(testId), questions: [] }
      : await persist(form);
    const { versionId, questions } = saved;
    if (!assignmentOnly) await publishTestVersion(versionId);
    for (const target of targets) {
      await assignTestVersion(versionId, {
        ...target,
        available_from: new Date(form.availableFrom).toISOString(),
        deadline_at: new Date(form.availableUntil).toISOString(),
        notify_on_assignment: form.notifyOnAssignment !== false,
        send_reminder: form.sendReminder === true,
        reminder_hours: Number(form.reminderHours ?? 24),
        block_after_expiry: form.blockAfterExpiry !== false,
        allow_retake: form.allowRetake !== false,
        show_in_assigned_tests: form.showInAssignedTests !== false,
      });
    }
    navigate("/testare");
    return { questions };
  };
  if (error)
    return (
      <main role="alert" style={{ padding: 24 }}>
        <p>{error}</p>
        <button onClick={() => setReloadKey((v) => v + 1)}>Reîncearcă</button>
      </main>
    );
  if (initialData === null) return <main style={{ padding: 24 }}>Se încarcă editorul...</main>;
  return (
    <>
      <ProfessionalTestEditor
        initialData={initialData}
        assignmentOnly={assignmentOnly}
        readOnly={readOnly}
        recipients={recipients}
        groups={groups}
        groupsLoading={groupsLoading}
        groupsError={groupsError}
        onGroupsChanged={refreshGroups}
        recipientsLoading={recipientsLoading}
        recipientsError={recipientsError}
        onSaveDraft={save}
        onPublish={publish}
        onImportQuestions={assignmentOnly ? undefined : importQuestions}
        onExportQuestions={exportQuestions}
        onPreview={openPreview}
        onRefresh={() => setReloadKey((v) => v + 1)}
        onCancel={() => navigate("/testare")}
      />
      {previewForm && <PreviewTestModal form={previewForm} onClose={() => setPreviewForm(null)} />}
    </>
  );
}
