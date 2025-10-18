// src/lib/tw.ts

// Kiểu cho tw: callable + có .style() và .color()
type Tw = ((...args: any[]) => any) & {
  style: (...args: any[]) => any;
  color: (...args: any[]) => string;
};

let cached: Tw | null = null;

function createStub(): Tw {
  // Stub chạy an toàn ở Node/SSR/static export
  const fn: any = () => ({});
  fn.style = () => ({});
  fn.color = () => "";
  return fn as Tw;
}

function initTw(): Tw {
  const isRN =
    typeof navigator !== "undefined" && (navigator as any).product === "ReactNative";

  if (!isRN) return createStub();

  // Chỉ require khi đang chạy trong RN thật
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("twrnc");
  const create = mod?.default ?? mod?.create;

  let rnVer: any = undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require("react-native");
    rnVer = Platform?.constants?.reactNativeVersion;
  } catch {
    rnVer = { major: 0, minor: 0, patch: 0 };
  }

  const instance = create({ reactNativeVersion: rnVer });
  return instance as Tw; // ép kiểu để có .style và .color
}

const tw: Tw = (() => {
  if (!cached) cached = initTw();
  return cached!;
})();

export default tw;
