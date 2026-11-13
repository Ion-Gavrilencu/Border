import api from "./api";
export const getAssignedTests = async () => (await api.get("/testare/atribuite")).data;
export const getMyTestResults = async () => (await api.get("/testare/rezultatele-mele")).data;
export const getManagedTests = async () => (await api.get("/testare/teste")).data;
export const createProfessionalTest = async (payload) =>
  (await api.post("/testare/teste", payload)).data;
export const getTestQuestions = async (id) =>
  (await api.get(`/testare/versiuni/${id}/intrebari`)).data;
export const saveTestSettings = async (id, payload) =>
  (await api.patch(`/testare/versiuni/${id}`, payload)).data;
export const addTestQuestion = async (id, payload) =>
  (await api.post(`/testare/versiuni/${id}/intrebari`, payload)).data;
export const publishTestVersion = async (id) =>
  (await api.post(`/testare/versiuni/${id}/publicare`)).data;
export const createNextTestVersion = async (id) =>
  (await api.post(`/testare/teste/${id}/versiune-noua`)).data;
export const getEligibleTestUsers = async () =>
  (await api.get("/testare/utilizatori-eligibili")).data;
export const assignTestVersion = async (id, payload) =>
  (await api.post(`/testare/versiuni/${id}/atribuiri`, payload)).data;
export const getVersionAssignments = async (id) =>
  (await api.get(`/testare/versiuni/${id}/atribuiri`)).data;
export const getManagedTestResults = async (id) =>
  (await api.get(`/testare/versiuni/${id}/rezultate`)).data;
export const getManagedAttemptReview = async (attemptId) =>
  (await api.get(`/testare/incercari/${attemptId}/revizuire-manager`)).data;
export const getTestVersion = async (id) => (await api.get(`/testare/versiuni/${id}`)).data;
export const editTestQuestion = async (versionId, questionId, payload) =>
  (await api.put(`/testare/versiuni/${versionId}/intrebari/${questionId}`, payload)).data;
export const deleteTestQuestion = async (versionId, questionId) =>
  (await api.delete(`/testare/versiuni/${versionId}/intrebari/${questionId}`)).data;
export const startProfessionalTest = async (versionId) =>
  (await api.post(`/testare/versiuni/${versionId}/incepe`)).data;
export const getProfessionalAttempt = async (attemptId) =>
  (await api.get(`/testare/incercari/${attemptId}`)).data;
export const saveProfessionalAnswer = async (attemptId, payload) =>
  (await api.put(`/testare/incercari/${attemptId}/raspuns`, payload)).data;
export const submitProfessionalAttempt = async (attemptId) =>
  (await api.post(`/testare/incercari/${attemptId}/finalizare`)).data;
export const deleteProfessionalTest = async (testId) =>
  (await api.delete(`/testare/teste/${testId}`)).data;
export const getProfessionalAttemptReview = async (attemptId) =>
  (await api.get(`/testare/incercari/${attemptId}/rezultat`)).data;
// Importul este confirmat separat; previzualizarea nu salvează întrebări.
export const previewTestQuestionsImport = async (versionId, file) => {
  const data = new FormData();
  data.append("file", file);
  return (await api.post(`/testare/versiuni/${versionId}/import-previzualizare`, data)).data;
};
export const confirmTestQuestionsImport = async (versionId, questions) =>
  (await api.post(`/testare/versiuni/${versionId}/import-confirmare`, { questions })).data;

export const getTestPreferences = async () => (await api.get("/testare/preferinte")).data;

export const saveTestPreferences = async (preferences) =>
  (await api.put("/testare/preferinte", { preferences })).data;

// Grupuri comune ADMIN/EDITOR; autorizarea modificărilor este aplicată de server.
export const getTestGroups = async () => (await api.get("/testare/grupuri")).data;
export const getTestGroup = async (groupId) =>
  (await api.get(`/testare/grupuri/${encodeURIComponent(groupId)}`)).data;
export const createTestGroup = async (payload) =>
  (await api.post("/testare/grupuri", payload)).data;
export const updateTestGroup = async (groupId, payload) =>
  (await api.patch(`/testare/grupuri/${encodeURIComponent(groupId)}`, payload)).data;
export const addTestGroupMembers = async (groupId, userIds) =>
  (
    await api.post(`/testare/grupuri/${encodeURIComponent(groupId)}/membri/lot`, {
      user_ids: userIds,
    })
  ).data;
export const removeTestGroupMember = async (groupId, userId) =>
  (
    await api.delete(
      `/testare/grupuri/${encodeURIComponent(groupId)}/membri/${encodeURIComponent(userId)}`,
    )
  ).data;
