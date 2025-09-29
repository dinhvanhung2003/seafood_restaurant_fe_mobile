import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { AuthAPI } from "../services/api.auth";
import { tokenStore } from "../services/tokenStore";
import type { Tokens } from "../types/types";

export function useAuth() {
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

  const login = useCallback(async (email: string, password: string) => {
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
      Alert.alert("Thông báo", msg);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await AuthAPI.logout();
    await tokenStore.clear();
    setTokens(null);
  }, []);

  return { tokens, isAuthenticated: !!tokens?.accessToken, loading, submitting, login, logout };
}
