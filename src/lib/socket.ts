// Expo (React Native) socket
import { io, type Socket } from "socket.io-client";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL|| "http://192.168.1.9:8000";
const NS   = process.env.EXPO_PUBLIC_SOCKET_NAMESPACE ?? "/realtime-pos";
const PATH = process.env.EXPO_PUBLIC_SOCKET_PATH ?? "/socket.io";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(`${BASE}${NS}`, {
    path: PATH,
      transports: ["websocket", "polling"], // tạm thời
    withCredentials: false,
    timeout: 15000,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
  });

console.log("[socket:init] URL =", `${BASE}${NS}`, "PATH=", PATH);
  socket.on("connect", () => console.log("[socket] ✅ connected:", socket!.id));
  socket.on("connect_error", (e: any) =>
    console.error("[socket] ❌ connect_error:", e?.message || e)
  );

  return socket;
}
