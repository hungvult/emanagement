export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const DAY_OF_WEEK_OPTIONS = [
  { key: "MONDAY", label: "T2", fullLabel: "Thứ 2" },
  { key: "TUESDAY", label: "T3", fullLabel: "Thứ 3" },
  { key: "WEDNESDAY", label: "T4", fullLabel: "Thứ 4" },
  { key: "THURSDAY", label: "T5", fullLabel: "Thứ 5" },
  { key: "FRIDAY", label: "T6", fullLabel: "Thứ 6" },
  { key: "SATURDAY", label: "T7", fullLabel: "Thứ 7" },
  { key: "SUNDAY", label: "CN", fullLabel: "Chủ Nhật" },
];

export const SHIFT_COLORS = [
  { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary" },
  {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-700 dark:text-amber-400",
  },
  {
    bg: "bg-violet-500/15",
    border: "border-violet-500/40",
    text: "text-violet-700 dark:text-violet-400",
  },
  {
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    text: "text-rose-700 dark:text-rose-400",
  },
  {
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/40",
    text: "text-cyan-700 dark:text-cyan-400",
  },
];

export function parseTimeToSeconds(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

export function getTimeValidationError(
  startTime?: string,
  endTime?: string,
): string | null {
  if (!startTime || !endTime) {
    return "Giờ bắt đầu và giờ kết thúc ca không được để trống";
  }
  const startSec = parseTimeToSeconds(startTime);
  const endSec = parseTimeToSeconds(endTime);
  if (startSec === null || endSec === null) {
    return "Định dạng thời gian không hợp lệ";
  }
  if (endSec <= startSec) {
    return "Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)";
  }
  const durationMinutes = Math.floor((endSec - startSec) / 60);
  if (durationMinutes < 30) {
    return "Thời lượng ca làm việc tối thiểu phải từ 30 phút trở lên";
  }
  if (durationMinutes > 16 * 60) {
    return "Thời lượng ca làm việc tối đa không được vượt quá 16 giờ";
  }
  return null;
}

