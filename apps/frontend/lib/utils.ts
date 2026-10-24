export { cn } from "cn";

function isDateObject(val: unknown): val is Date {
  return (
    val instanceof Date ||
    (typeof val === "object" &&
      val !== null &&
      Object.prototype.toString.call(val) === "[object Date]")
  );
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

const DATE_ONLY_REGEX = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const LOCAL_DT_REGEX =
  /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?$/;
const OFFSET_DT_REGEX =
  /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

export function formatDate(dateString?: string | Date | null): string {
  const dt = formatDateTime(dateString);
  if (dt === "—") return "—";
  const spaceIndex = dt.indexOf(" ");
  return spaceIndex !== -1 ? dt.slice(spaceIndex + 1) : dt;
}

export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return "—";
  if (isDateObject(dateString)) {
    if (isNaN(dateString.getTime())) return "—";
    const hours = String(dateString.getHours()).padStart(2, "0");
    const minutes = String(dateString.getMinutes()).padStart(2, "0");
    const day = String(dateString.getDate()).padStart(2, "0");
    const month = String(dateString.getMonth() + 1).padStart(2, "0");
    const year = dateString.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }
  if (typeof dateString !== "string") return "—";
  const trimmed = dateString.trim();
  if (!trimmed) return "—";

  // Check pure YYYY-MM-DD format (avoids UTC parsing shift)
  const dateOnlyMatch = DATE_ONLY_REGEX.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!isValidDateParts(year, month, day)) return "—";
    return `00:00 ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  // Check datetime strings without timezone offset to avoid JS roll-over bug and timezone shift
  const localDtMatch = LOCAL_DT_REGEX.exec(trimmed);
  if (localDtMatch) {
    const year = Number(localDtMatch[1]);
    const month = Number(localDtMatch[2]);
    const day = Number(localDtMatch[3]);
    const hours = Number(localDtMatch[4]);
    const minutes = Number(localDtMatch[5]);
    const seconds = localDtMatch[6] ? Number(localDtMatch[6]) : 0;
    if (
      !isValidDateParts(year, month, day) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return "—";
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  // Check ISO datetimes with timezone offset (Z or +/-HH:mm)
  const offsetMatch = OFFSET_DT_REGEX.exec(trimmed);
  if (offsetMatch) {
    const year = Number(offsetMatch[1]);
    const month = Number(offsetMatch[2]);
    const day = Number(offsetMatch[3]);
    const hours = Number(offsetMatch[4]);
    const minutes = Number(offsetMatch[5]);
    const seconds = offsetMatch[6] ? Number(offsetMatch[6]) : 0;
    if (
      !isValidDateParts(year, month, day) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return "—";
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return "—";
    const dHours = String(d.getHours()).padStart(2, "0");
    const dMinutes = String(d.getMinutes()).padStart(2, "0");
    const dDay = String(d.getDate()).padStart(2, "0");
    const dMonth = String(d.getMonth() + 1).padStart(2, "0");
    const dYear = d.getFullYear();
    return `${dHours}:${dMinutes} ${dDay}/${dMonth}/${dYear}`;
  }

  const normalized =
    trimmed.includes(" ") && !trimmed.includes("T")
      ? trimmed.replace(" ", "T")
      : trimmed;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "—";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}
