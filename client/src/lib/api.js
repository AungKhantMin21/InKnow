import axios from "axios";
import { getToken } from "./auth.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const register = (data) => api.post("/api/auth/register", data);
export const login = (data) => api.post("/api/auth/login", data);
export const getMe = () => api.get("/api/auth/me");

// Sessions
export const listSessions = () => api.get("/api/sessions");
export const createSession = () => api.post("/api/sessions");
export const getSession = (id) => api.get(`/api/sessions/${id}`);
export const sendMessage = (id, content) =>
  api.post(`/api/sessions/${id}/message`, { content });
export const completeSession = (id) => api.post(`/api/sessions/${id}/complete`);
export const retryArticleGeneration = (id) => api.post(`/api/sessions/${id}/articles`);

// Knowledge
export const saveArticle = (data) => api.post("/api/knowledge", data);
export const getArticles = (params) => api.get("/api/knowledge", { params });
export const getArticle = (id) => api.get(`/api/knowledge/${id}`);
export const updateArticle = (id, data) => api.patch(`/api/knowledge/${id}`, data);

export const getSessionArticles = (id) => api.get(`/api/sessions/${id}/articles`);
export const updateKnowledgeArticle = (data) => api.post("/api/knowledge/update", data);

// Manager
export const getManagerStats = () => api.get("/api/manager/stats");
export const getManagerCoverage = () => api.get("/api/manager/coverage");
export const getPendingArticles = () => api.get("/api/manager/pending");
export const approveArticle = (id) => api.patch(`/api/knowledge/${id}/approve`);
export const rejectArticle = (id) => api.patch(`/api/knowledge/${id}/reject`);

// Copilot
export const queryCopilot = (question) => api.post("/api/copilot/query", { question });
export const submitFeedback = (query_id, feedback) => api.post("/api/copilot/feedback", { query_id, feedback });

// Groups (admin)
export const getGroups = () => api.get("/api/groups");
export const createGroup = (data) => api.post("/api/groups", data);
export const updateGroup = (id, data) => api.patch(`/api/groups/${id}`, data);
export const archiveGroup = (id) => api.patch(`/api/groups/${id}/archive`);
export const getGroupMembers = (id) => api.get(`/api/groups/${id}/members`);
export const addGroupMember = (groupId, employee_id) =>
  api.post(`/api/groups/${groupId}/members`, { employee_id });
export const removeGroupMember = (groupId, employeeId) =>
  api.delete(`/api/groups/${groupId}/members/${employeeId}`);
export const createGroupInvite = (groupId, data) =>
  api.post(`/api/groups/${groupId}/invites`, data);

// Invites
export const getInvite = (token) => api.get(`/api/invites/${token}`);
export const acceptInvite = (token) => api.post(`/api/invites/${token}/accept`);

// Admin
export const getAdminStats = () => api.get("/api/admin/stats");
export const getAdminEmployees = (params) => api.get("/api/admin/employees", { params });
export const updateEmployeeRole = (id, data) =>
  api.patch(`/api/admin/employees/${id}/role`, data);

// Article visibility + core
export const setArticleVisibility = (id, visibility) =>
  api.patch(`/api/knowledge/${id}/visibility`, { visibility });
export const setArticleCore = (id, is_core) =>
  api.patch(`/api/knowledge/${id}/core`, { is_core });

export default api;
