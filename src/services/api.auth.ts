import type { LoginBody, LoginResponse, Tokens } from "../types/types";
import http from "./http";

export const AuthAPI = {
  async login(body: LoginBody): Promise<Tokens> {
    const res = await http.post<LoginResponse>("/auth/login", body);
    const data =
      res.data?.response?.data ??
      res.data?.data ?? {
        accessToken: (res.data as any)?.accessToken,
        refreshToken: (res.data as any)?.refreshToken,
      };
    return data as Tokens;
  },

  async logout() {
    try {
      await http.post("/auth/logout", {});
    } catch {
      // ignore
    }
  },
};
