// src/lib/socket.ts
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';

/** ================= ENV & URL NORMALIZATION ================= */

const RAW_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://192.168.1.9:8000'; // fallback dev

// Cho phép rỗng (root namespace). Nếu có giá trị, đảm bảo có leading slash.
const RAW_NS = process.env.EXPO_PUBLIC_SOCKET_NAMESPACE ?? '';
const PATH = process.env.EXPO_PUBLIC_SOCKET_PATH ?? '/socket.io';

// Chuẩn hoá để tránh thừa/thiếu dấu gạch chéo
const BASE = RAW_BASE.replace(/\/+$/, '');
const NS = RAW_NS ? (RAW_NS.startsWith('/') ? RAW_NS : `/${RAW_NS}`) : '';

/** URL cuối cùng để connect. Ví dụ:
 *  BASE=https://api.domain.com, NS="/realtime-pos"
 *  => SOCKET_URL=https://api.domain.com/realtime-pos
 */
export const SOCKET_URL = `${BASE}${NS}`;
export const SOCKET_PATH = PATH;

/** ================= INTERNAL STATE (SINGLETON) ================= */

let socket: Socket | null = null;
let authToken: string | null = null; // JWT Bearer (tuỳ chọn)
let initializedAppState = false;

/** ================= PUBLIC API ================= */

/**
 * Đặt/đổi JWT token dùng cho Handshake.
 * Gọi trước khi getSocket() để token có hiệu lực ngay từ kết nối đầu tiên.
 * Nếu socket đã tồn tại, sẽ disconnect và connect lại với token mới.
 */
export function setAuthToken(token?: string | null) {
  const next = token || null;
  if (authToken === next) return;
  authToken = next;

  // Nếu đã có socket -> cập nhật và reconnect để token áp dụng ngay
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }
}

/**
 * Lấy singleton Socket. Nếu chưa có sẽ khởi tạo.
 * Sẽ tự thêm các listener log cơ bản và quản lý reconnect khi app trở lại foreground.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = createSocket();

    // Log cơ bản
    socket.on('connect', () => {
      console.log('[socket] ✅ connected:', socket!.id, 'url=', SOCKET_URL, 'path=', SOCKET_PATH);
    });

    socket.on('connect_error', (e: any) => {
      // In càng nhiều ngữ cảnh càng tốt để debug thực chiến
      console.error(
        '[socket] ❌ connect_error:',
        e?.message || e,
        '| data:', e?.data,
        '| desc:', e?.description,
        '| context:', e?.context
      );
    });

    socket.on('error', (e: any) => {
      console.error('[socket] ❌ error:', e?.message || e, e);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[socket] ⚠️ disconnect:', reason);
    });

    socket.io.on('reconnect_attempt', (n) => {
      console.log('[socket] … reconnect_attempt #', n);
    });
    socket.io.on('reconnect', (n) => {
      console.log('[socket] 🔁 reconnected on attempt #', n);
    });
    socket.io.on('reconnect_error', (e) => {
      console.error('[socket] ❌ reconnect_error:', e?.message || e);
    });

    // Quản lý AppState: khi app trở lại active -> nếu chưa connect thì connect lại
    if (!initializedAppState) {
      initializedAppState = true;
      AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          if (!socket) {
            socket = createSocket();
          } else if (socket.disconnected) {
            try {
              console.log('[socket] AppState active -> trying connect()');
              socket.connect();
            } catch {}
          }
        }
      });
    }
  }

  return socket;
}

/**
 * Ngắt kết nối và huỷ singleton.
 * Hữu ích khi logout hoặc đổi user.
 */
export function disconnectSocket() {
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {}
  }
  socket = null;
}

/**
 * Chờ đến khi socket connect (hoặc time-out).
 * Dùng trong các màn cần đảm bảo channel sẵn sàng trước khi emit.
 */
export async function waitUntilConnected(timeoutMs = 10_000): Promise<void> {
  const s = getSocket();
  if (s.connected) return;

  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => {
      cleanup();
      reject(new Error(`Socket connect timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (e: any) => {
      cleanup();
      reject(e instanceof Error ? e : new Error(String(e?.message || e)));
    };

    const cleanup = () => {
      clearTimeout(to);
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      s.off('error', onError);
    };

    s.once('connect', onConnect);
    s.once('connect_error', onError);
    s.once('error', onError);

    // Nếu đang disconnected cứng, thử connect
    if (s.disconnected) {
      try {
        s.connect();
      } catch {}
    }
  });
}

/**
 * Emit an toàn — sẽ tự chờ connect nếu cần, ném lỗi nếu thất bại.
 * Ví dụ: await emitSafe('joinRoom', { roomId });
 */
export async function emitSafe<T = any>(event: string, payload?: T, timeoutMs = 10_000) {
  const s = getSocket();
  await waitUntilConnected(timeoutMs);
  s.emit(event, payload);
}

/**
 * Sugar helpers để đăng ký/hủy đăng ký sự kiện.
 * Ví dụ:
 *   on('ticket:created', handler)
 *   off('ticket:created', handler)
 */
export function on<T = any>(event: string, handler: (data: T) => void) {
  getSocket().on(event, handler);
}
export function off<T = any>(event: string, handler: (data: T) => void) {
  getSocket().off(event, handler);
}

/** ================= INTERNAL: CREATION ================= */

function createSocket(): Socket {
  const url = SOCKET_URL;

  const s = io(url, {
    path: SOCKET_PATH,              // phải khớp với BE
    transports: ['websocket'],      // ép websocket-only để tránh vấn đề CORS/polling
    withCredentials: false,         // dùng Bearer thay vì cookie trên mobile
    timeout: 15_000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    auth: authToken ? { token: `Bearer ${authToken}` } : undefined,
    // Nếu backend đọc header thay vì auth:
    // extraHeaders: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });

  console.log('[socket:init]', { url, path: SOCKET_PATH });

  return s;
}
