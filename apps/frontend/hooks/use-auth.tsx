"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import axios from "axios";
import { UserProfile } from "../types/auth.types";
import { authService } from "../services/auth.service";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (accessToken: string, refreshToken?: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const router = useRouter();

  const logout = useCallback(async () => {
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
    requestVersion.current += 1;
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    setUser(null);
    setAuthError(null);
    setIsLoading(false);
    if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
      router.push("/login");
    }
    if (refreshToken) {
      try { await authService.logout(refreshToken); } catch { /* Session is already cleared locally. */ }
    }
  }, [router]);

  const fetchUser = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await authService.getCurrentUser();
      if (version !== requestVersion.current) throw new Error("Phiên đăng nhập đã thay đổi");
      if (response && response.status === "SUCCESS" && response.data) {
        setUser(response.data);
      } else {
        throw new Error(response?.message || "Không thể tải thông tin tài khoản");
      }
    } catch (error) {
      if (version === requestVersion.current) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 || status === 403 || !localStorage.getItem("access_token")) {
          void logout();
        } else {
          setAuthError("Không thể tải thông tin tài khoản. Vui lòng kiểm tra kết nối và thử lại.");
        }
      }
      throw error;
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const token = localStorage.getItem("access_token");
      if (token) void fetchUser().catch(() => {});
      else setIsLoading(false);
    });

    // Đồng bộ trạng thái đăng xuất giữa các tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "access_token" && !e.newValue) {
        requestVersion.current += 1;
        setUser(null);
        setAuthError(null);
        setIsLoading(false);
        if (window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
          router.push("/login");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      active = false;
      requestVersion.current += 1;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [fetchUser, router]);

  const login = async (accessToken: string, refreshToken?: string) => {
    localStorage.setItem("access_token", accessToken);
    if (refreshToken) {
      localStorage.setItem("refresh_token", refreshToken);
    } else {
      localStorage.removeItem("refresh_token");
    }
    setIsLoading(true);
    await fetchUser();
  };

  const hasRole = (role: string) => {
    return user?.roles?.includes(role) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authError,
        login,
        logout,
        hasRole,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

