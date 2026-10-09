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
