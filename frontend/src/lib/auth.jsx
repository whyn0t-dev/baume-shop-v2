import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchMe, loginUser, logoutUser, registerUser, updateMe } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // null = authenticated user object
  const [status, setStatus] = useState("loading"); // 'loading' | 'authenticated' | 'guest'

  const refreshMe = useCallback(async () => {
    try {
      const data = await fetchMe();
      setUser(data);
      setStatus("authenticated");
      return data;
    } catch {
      setUser(null);
      setStatus("guest");
      return null;
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const data = await loginUser({ email, password });
    setUser(data);
    setStatus("authenticated");
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await registerUser(payload);
    setUser(data);
    setStatus("authenticated");
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutUser(); } catch { /* ignore */ }
    setUser(null);
    setStatus("guest");
  }, []);

  const saveProfile = useCallback(async (payload) => {
    const data = await updateMe(payload);
    setUser(data);
    return data;
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, isAuth: status === "authenticated", login, register, logout, refreshMe, saveProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
