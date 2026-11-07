import api from "./api";
export const getMonitoringRetention = async () => (await api.get("/monitoring/retention")).data;
export const updateMonitoringRetention = async (days) =>
  (await api.put("/monitoring/retention", { retention_days: days })).data;
