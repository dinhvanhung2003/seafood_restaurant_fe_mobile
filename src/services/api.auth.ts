import type { LoginBody, LoginResponse, Tokens } from "../types/types";
import http from "./http";

/** ===== Kiểu Profile dùng cho app ===== */
export type Profile = {
  id: string;            // user.id
  displayName: string;   // data.fullName
  email?: string;        // user.email
  role?: string;         // user.role
  avatar?: string;       // data.avatar
  employeeCode?: string; // hiện BE chưa trả -> sẽ undefined
};

/** ===== Kiểu response /profile/me đúng JSON thực tế ===== */
type MeResponse = {
  code: number;
  success: boolean;
  message: string;
  data: {
    id: string;
    fullName?: string | null;
    dob?: string | null;
    avatar?: string | null;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    addressList?: string | null;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string | null;
    updatedBy?: string | null;
    user: {
      id: string;
      email?: string | null;
      phoneNumber?: string | null;
      username?: string | null;
      role?: string | null;
      status?: string | null;
      isActive?: boolean;
      lastLogin?: string | null;
      createdAt?: string;
      updatedAt?: string;
    };
  };
};

/** Chuẩn hoá response -> Profile gọn cho app */
function normalizeProfile(resp: MeResponse): Profile {
  const d = resp.data;
  return {
    id: d.user?.id ?? d.id,
    displayName: d.fullName ?? "",
    email: d.user?.email ?? undefined,
    role: d.user?.role ?? undefined,
    avatar: d.avatar ?? undefined,
    employeeCode: undefined, // backend hiện chưa trả mã NV
  };
}

export const AuthAPI = {
  async login(body: LoginBody): Promise<Tokens> {
    const res = await http.post<LoginResponse>("/auth/login", body);
    const data =
      (res.data as any)?.response?.data ??
      (res.data as any)?.data ?? {
        accessToken: (res.data as any)?.accessToken,
        refreshToken: (res.data as any)?.refreshToken,
      };
    return data as Tokens;
  },

  /** Lấy hồ sơ người dùng hiện tại */
  async me(): Promise<Profile> {
    const res = await http.get<MeResponse>("/profile/me");
    return normalizeProfile(res.data);
  },

  async logout() {
    try {
      await http.post("/auth/logout", {});
    } catch {
      // ignore
    }
  },
};
