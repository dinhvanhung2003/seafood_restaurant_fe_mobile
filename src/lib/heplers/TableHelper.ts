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

export const fmtElapsed = (iso?: string) => {
  const m = minutesBetween(iso);
  const h = Math.floor(m / 60),
    mm = m % 60;
  if (h <= 0 && mm <= 0) return '';
  if (h <= 0) return `${mm}p`;
  return `${h}g ${mm}p`;
};

// loại bỏ dấu tiếng Việt và chuyển thành chữ thường
export function stripVN(s: string = ''): string {
  return s
    .normalize('NFD')                 // tách chữ + dấu riêng biệt
    .replace(/[\u0300-\u036f]/g, '')  // xoá toàn bộ dấu
    .replace(/đ/g, 'd')               // thay "đ" -> "d"
    .replace(/Đ/g, 'D');              // thay "Đ" -> "D"
}
