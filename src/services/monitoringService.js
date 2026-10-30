
import api from "./api";

export const getMonitoringOverview = async () => {
  const response = await api.get("/monitoring/overview");
  return response.data;
};

export const getMonitoringActivities = async (params) => {
  const response = await api.get("/monitoring/activities", {
    params,
  });

  return response.data;
};

export const sendMonitoringHeartbeat = async () => {
  const response = await api.post("/monitoring/heartbeat");
  return response.data;
};

export const recordMonitoringPageView = async (path) => {
  const response = await api.post("/monitoring/page-view", {
    path,
  });

  return response.data;
};
