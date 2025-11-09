// src/providers/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { showMessage } from "react-native-flash-message";
import { AuthAPI, type Profile } from "../services/api.auth";
import { tokenStore } from "../services/tokenStore";
import type { Tokens } from "../types/types";

type AuthCtx = {
  tokens: Tokens | null;
  isAuthenticated: boolean;
  loading: boolean;          // loading khởi động (load token/profile)
  submitting: boolean;       // đang login
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  profile: Profile | null;   // <<-- THÊM VÀO
};

export const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); // <<-- THÊM VÀO
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Khởi động: load token + profile
  useEffect(() => {
    (async () => {
      try {
        const t = await tokenStore.load();
        setTokens(t);
        if (t?.accessToken) {
          try {
            const me = await AuthAPI.me();
            setProfile(me);
          } catch {
            setProfile(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setSubmitting(true);
    try {
      const t = await AuthAPI.login({ email, password });
      await tokenStore.save(t);
      setTokens(t);

      // Sau login -> lấy profile
      try {
        const me = await AuthAPI.me();
        setProfile(me);
      } catch {
        setProfile(null);
      }
      return true;
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.response?.message ||
        "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
      showMessage({
        type: "danger",
        message: "Đăng nhập thất bại",
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
    setProfile(null); // <<-- THÊM VÀO
  };

  const value = useMemo<AuthCtx>(
    () => ({
      tokens,
      isAuthenticated: !!tokens?.accessToken,
      loading,
      submitting,
      login,
      logout,
      profile, // <<-- THÊM VÀO
    }),
    [tokens, loading, submitting, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
