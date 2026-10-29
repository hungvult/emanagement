import type { NotificationResponse } from "@/types/notification.types";

export function notificationLink(notification: NotificationResponse) {
  const target = notification.targetUrl;
  if (target && /^\/(?:attendance|leave-requests|my-schedule|employees|profile|reports|alerts|notifications)(?:\?|$)/.test(target)) return target;
  if (notification.type.startsWith("SHIFT_")) return "/my-schedule";
  if (notification.type.startsWith("LEAVE_")) return "/leave-requests";
  return "/notifications";
}

export function notificationDate(raw: unknown): Date {
  if (Array.isArray(raw)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = raw;
    return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  }
  const value = typeof raw === "string" ? raw : "";
  const date = new Date(value && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? `${value}+07:00` : value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
