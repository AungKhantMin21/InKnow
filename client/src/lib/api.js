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

// Roles
export const getRoles = () => api.get("/api/roles");

// Sessions
export const createSession = () => api.post("/api/sessions");
export const getSession = (id) => api.get(`/api/sessions/${id}`);
export const sendMessage = (id, content) =>
  api.post(`/api/sessions/${id}/message`, { content });
export const completeSession = (id) => api.post(`/api/sessions/${id}/complete`);

export default api;
