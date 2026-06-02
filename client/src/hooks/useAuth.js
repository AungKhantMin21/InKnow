import { useState, useEffect, createContext, useContext } from "react";
import { saveAuth, getToken, getUser, clearAuth } from "../lib/auth.js";
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
} from "../lib/api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then(({ data }) => setUser(data.data.employee))
      .catch(() => {
        clearAuth();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await apiLogin({ email, password });
    saveAuth(data.data.token, data.data.employee);
    setUser(data.data.employee);
    return data.data.employee;
  };

  const register = async (name, email, password, role_id) => {
    const { data } = await apiRegister({ name, email, password, role_id });
    saveAuth(data.data.token, data.data.employee);
    setUser(data.data.employee);
    return data.data.employee;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
