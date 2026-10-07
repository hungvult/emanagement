export function parseDateInput(text: string): string | null {
  const parts = text.trim().replace(/[-.]/g, "/").split("/");
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part)))
    return null;
  const [day, month, year] = parts.map(Number);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1)
    return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1)
    return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isDateWithinBounds(
  date: string,
  min?: string,
  max?: string,
): boolean {
  return (!min || date >= min) && (!max || date <= max);
}
