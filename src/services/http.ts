import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { tokenStore } from "./tokenStore";


const BASE_URL = process.env.BASE_URL || "http://10.144.210.175:8000";

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
});

// --- gắn Authorization cho mọi request ---
http.interceptors.request.use(async (config) => {
  const token = tokenStore.getAccess() ?? (await tokenStore.load())?.accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- refresh queue để tránh gọi refresh nhiều lần cùng lúc ---
let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

const processQueue = (newToken: string | null) => {
  pendingQueue.forEach((cb) => cb(newToken));
  pendingQueue = [];
};

async function refreshToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh() ?? (await tokenStore.load())?.refreshToken;
  if (!refresh) return null;

  try {
    // Backend của bạn hiển thị /auth/refresh (POST) không body.
    // Gửi refresh token trong Authorization: Bearer <refresh>
    const resp = await axios.post(
      `${BASE_URL}/auth/refresh`,
      {},
      { headers: { Authorization: `Bearer ${refresh}` } }
    );

    // backend có thể trả data ở response.response.data hoặc response.data
    const tokens =
      resp.data?.response?.data ??
      resp.data?.data ?? {
        accessToken: resp.data?.accessToken,
        refreshToken: resp.data?.refreshToken,
      };

    if (tokens?.accessToken) {
      // nếu refreshToken mới cũng trả về, lưu luôn; nếu không, giữ refresh cũ
      await tokenStore.save({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? refresh,
      });
      return tokens.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

// --- interceptor response: tự refresh khi 401 ---
http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = (error.response && (error.response as any).status) || 0;

    // không retry cho login/refresh để tránh vòng lặp
    const url = (original?.url ?? "").toLowerCase();
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/logout");

    if (status === 401 && !original._retry && !isAuthCall) {
      // xếp hàng đợi nếu đang refresh
      if (isRefreshing) {
        const newToken: string = await new Promise((resolve) => {
          pendingQueue.push((t) => resolve(t ?? ""));
        });
        if (!newToken) return Promise.reject(error);
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        original._retry = true;
        return http.request(original);
      }

      // bắt đầu refresh
      isRefreshing = true;
      const newAccess = await refreshToken();
      isRefreshing = false;
      processQueue(newAccess);

      if (newAccess) {
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
        original._retry = true;
        return http.request(original);
      } else {
        // hết hạn luôn -> xoá token
        await tokenStore.clear();
      }
    }
    return Promise.reject(error);
  }
);

export default http;
