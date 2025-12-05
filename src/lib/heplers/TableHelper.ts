export const fmtMoney = (n: number) => {
  try {
    return n.toLocaleString('vi-VN');
  } catch {
    return String(n);
  }
};

export const minutesBetween = (iso?: string) => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  const diff = Date.now() - (isNaN(t) ? 0 : t);
  return Math.max(0, Math.round(diff / 60000));
};

export function fmtElapsed(iso?: string) {
  if (!iso) return "";

  // 1️⃣ Ưu tiên parse chuẩn ISO (có Z / +07:00 / .sss ...)
  let t = Date.parse(iso);
  if (Number.isNaN(t)) {
    // 2️⃣ Fallback: tự bóc yyyy-mm-dd hh:mm[:ss] và coi là giờ local
    const m = iso.match(
      /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (!m) return "";

    const [, y, mo, d, h, mi, s] = m;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      s ? Number(s) : 0
    );
    t = dt.getTime();
  }

  // 3️⃣ Tính chênh lệch
  let diff = Date.now() - t;
  if (diff < 0) diff = 0;

  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);

  if (hours > 0) return `${hours}g${String(mins % 60).padStart(2, "0")}p`;
  if (mins > 0) return `${mins} phút`;
  return "Vừa xong";
}


// loại bỏ dấu tiếng Việt và chuyển thành chữ thường
export function stripVN(s: string = ''): string {
  return s
    .normalize('NFD')                 // tách chữ + dấu riêng biệt
    .replace(/[\u0300-\u036f]/g, '')  // xoá toàn bộ dấu
    .replace(/đ/g, 'd')               // thay "đ" -> "d"
    .replace(/Đ/g, 'D');              // thay "Đ" -> "D"
}
