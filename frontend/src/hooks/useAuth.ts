import { useState, useEffect, useCallback } from "react";
import type { User, AuthResponse } from "../types";

const API_URL = "http://localhost:8000";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("crashvision_token")
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Validate existing session token on startup
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          // Expired or invalid token
          localStorage.removeItem("crashvision_token");
          setToken(null);
          setUser(null);
        }
      } catch {
        // Offline / fallback local token user if server unreached
        const savedUser = localStorage.getItem("crashvision_user");
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [token]);

  const login = useCallback(
    async (username_or_email: string, password: string) => {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username_or_email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Invalid login credentials.");
      }

      const data: AuthResponse = await res.json();
      localStorage.setItem("crashvision_token", data.access_token);
      localStorage.setItem("crashvision_user", JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setIsAuthModalOpen(false);
      return data.user;
    },
    []
  );

  const register = useCallback(
    async (username: string, email: string, password: string, full_name?: string) => {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, full_name: full_name || "Operator" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Registration failed.");
      }

      const data: AuthResponse = await res.json();
      localStorage.setItem("crashvision_token", data.access_token);
      localStorage.setItem("crashvision_user", JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setIsAuthModalOpen(false);
      return data.user;
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("crashvision_token");
    localStorage.removeItem("crashvision_user");
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    loading,
    isAuthModalOpen,
    setIsAuthModalOpen,
    login,
    register,
    logout,
  };
}
