import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Tokens } from "../types/types";

const ACCESS_KEY = "auth_access_token";
const REFRESH_KEY = "auth_refresh_token";

// cache trong RAM để interceptor không đọc AsyncStorage mỗi request
let memory: Tokens | null = null;

export const tokenStore = {
  async load(): Promise<Tokens | null> {
    if (memory) return memory;
    const [accessToken, refreshToken] = await Promise.all([
      AsyncStorage.getItem(ACCESS_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
    ]);
    if (accessToken && refreshToken) {
      memory = { accessToken, refreshToken };
      return memory;
    }
    return null;
  },
  async save(tokens: Tokens) {
    memory = tokens;
    await Promise.all([
      AsyncStorage.setItem(ACCESS_KEY, tokens.accessToken),
      AsyncStorage.setItem(REFRESH_KEY, tokens.refreshToken),
    ]);
  },
  async clear() {
    memory = null;
    await Promise.all([AsyncStorage.removeItem(ACCESS_KEY), AsyncStorage.removeItem(REFRESH_KEY)]);
  },
  getAccess() {
    return memory?.accessToken ?? null;
  },
  getRefresh() {
    return memory?.refreshToken ?? null;
  },
  setAccess(accessToken: string) {
    if (!memory) memory = { accessToken, refreshToken: "" };
    memory.accessToken = accessToken;
    AsyncStorage.setItem(ACCESS_KEY, accessToken);
  },
};
