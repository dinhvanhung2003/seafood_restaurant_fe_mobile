import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { showMessage } from 'react-native-flash-message';
import { AuthAPI } from "../services/api.auth";
import { tokenStore } from "../services/tokenStore";
import type { Tokens } from "../types/types";
type AuthCtx = {
  tokens: Tokens | null;
  isAuthenticated: boolean;
  loading: boolean;
  submitting: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

// 🔹 đặt tên context dễ đọc, export để dùng ở nơi khác nếu cần
export const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await tokenStore.load();
      setTokens(t);
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setSubmitting(true);
    try {
      const t = await AuthAPI.login({ email, password });
      await tokenStore.save(t);
      setTokens(t);
      return true;
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.response?.message ||
        "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
      showMessage({
        type: 'danger',
        message: 'Đăng nhập thất bại',
        description: msg,
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    try { await AuthAPI.logout(); } catch {}
    await tokenStore.clear();
    setTokens(null);
  };

  const value = useMemo<AuthCtx>(
    () => ({ tokens, isAuthenticated: !!tokens?.accessToken, loading, submitting, login, logout }),
    [tokens, loading, submitting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
