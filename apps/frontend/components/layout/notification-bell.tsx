"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { notificationDate, notificationLink } from "@/lib/notification-utils";
import { useRouter } from "next/navigation";
import { alertService } from "@/services/alert.service";
import { notificationService } from "@/services/notification.service";
import { NotificationResponse } from "@/types/notification.types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertTriangle, Bell, X } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

function parseDate(raw: unknown): Date {
  return notificationDate(raw);
}

export const NotificationBell = () => {
  const router = useRouter();
  const { hasRole, user } = useAuth();
  const isAdmin =
    typeof hasRole === "function"
      ? hasRole("ROLE_ADMIN")
      : Boolean(user?.roles?.includes("ROLE_ADMIN"));
  const [notifications, setNotifications] = useState<NotificationResponse[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [unresolvedAlertCount, setUnresolvedAlertCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const mutationPendingRef = useRef(false);
  const requestVersionRef = useRef(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    if (mutationPendingRef.current) return;
    const version = ++requestVersionRef.current;
    try {
      const [countRes, notifRes, alertRes] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getMyNotifications(0, 10),
        isAdmin
          ? alertService.getUnresolvedCount().catch(() => null)
          : Promise.resolve(null),
      ]);
      if (version !== requestVersionRef.current) return;
      if (countRes.status === "SUCCESS" && countRes.data !== undefined) {
        setUnreadCount(countRes.data);
      }
      if (notifRes.status === "SUCCESS" && notifRes.data) {
        setNotifications(notifRes.data.content);
      }
      if (
        isAdmin &&
        alertRes &&
        (alertRes.status === "SUCCESS" || alertRes.data !== undefined)
      ) {
        setUnresolvedAlertCount(Number(alertRes.data) || 0);
      } else if (!isAdmin) {
        setUnresolvedAlertCount(0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    // Synchronize this screen with an external request or camera session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    const refresh = () => { void fetchNotifications(); };
    window.addEventListener("notifications-changed", refresh);
    return () => {
      window.removeEventListener("notifications-changed", refresh);
      clearInterval(interval);
      requestVersionRef.current += 1;
    };
  }, [fetchNotifications]);

  // Đóng khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    if (
      mutationPendingRef.current ||
      !notifications.some((n) => n.id === id && !n.read)
    )
      return;
    mutationPendingRef.current = true;
    const version = ++requestVersionRef.current;
    setIsUpdating(true);
    try {
      await notificationService.markAsRead(id);
      if (version !== requestVersionRef.current) return;
      // Cập nhật trực tiếp state để UX mượt – không cần gọi API lại
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    } finally {
      mutationPendingRef.current = false;
      if (version === requestVersionRef.current) {
        setIsUpdating(false);
        void fetchNotifications();
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (mutationPendingRef.current) return;
    mutationPendingRef.current = true;
    const version = ++requestVersionRef.current;
    setIsUpdating(true);
    try {
      await notificationService.deleteNotification(id);
      if (version !== requestVersionRef.current) return;
      const deleted = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    } finally {
      mutationPendingRef.current = false;
      if (version === requestVersionRef.current) {
        setIsUpdating(false);
        void fetchNotifications();
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (mutationPendingRef.current) return;
    mutationPendingRef.current = true;
    const version = ++requestVersionRef.current;
    setIsUpdating(true);
    try {
      await notificationService.markAllAsRead();
      if (version !== requestVersionRef.current) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    } finally {
      mutationPendingRef.current = false;
      if (version === requestVersionRef.current) {
        setIsUpdating(false);
        void fetchNotifications();
      }
    }
  };

  const totalBadgeCount = unreadCount + (isAdmin ? unresolvedAlertCount : 0);

  const handleOpenNotification = async (notification: NotificationResponse) => {
    if (isUpdating) return;
    if (!notification.read) await handleMarkAsRead(notification.id);
    setIsOpen(false);
    router.push(notificationLink(notification));
  };

  return (
    <div className="relative" ref={bellRef}>
      {/* Nút chuông */}
      <button
        onClick={() => { if (!isOpen) void fetchNotifications(); setIsOpen(!isOpen); }}
        className="relative rounded-full p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200 focus:outline-none"
        aria-label="Thông báo"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {totalBadgeCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
            {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] bg-white rounded-[24px] shadow-2xl ring-1 ring-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 bg-white">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900">
                Thông báo
              </h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isUpdating}
                className="h-auto p-0 text-xs font-bold text-indigo-600 hover:bg-transparent hover:text-indigo-800 transition-colors"
              >
                Đánh dấu tất cả đã đọc
              </Button>
            )}
          </div>

          {/* Danh sách thông báo */}
          <div className="max-h-[380px] overflow-y-auto px-2 py-2 space-y-1">
            {isAdmin && unresolvedAlertCount > 0 && (
              <Link
                href="/alerts"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100/80 transition-all font-bold text-xs mb-1"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span className="flex-1">
                  {`Có ${unresolvedAlertCount} cảnh báo an ninh AI chưa xử lý`}
                </span>
              </Link>
            )}
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                  <Bell className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold">Không có thông báo nào.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const date = parseDate(notif.createdAt);
                return (
                  <div
                    key={notif.id}
                    className={`group relative flex items-start gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                      !notif.read
                        ? "bg-indigo-50/50 hover:bg-indigo-50"
                        : "hover:bg-slate-50"
                    }`}
                    aria-disabled={isUpdating}
                  >
                    {/* Chấm chưa đọc */}
                    <div className="mt-2 shrink-0">
                      {!notif.read ? (
                        <div className="h-2 w-2 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-transparent" />
                      )}
                    </div>

                    {/* Nội dung */}
                    <Link href={notificationLink(notif)} onClick={(event) => {
                      event.preventDefault();
                      void handleOpenNotification(notif);
                    }} className="flex-1 min-w-0 pr-6 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500">
                      <p
                        className={`text-sm leading-snug ${!notif.read ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                      >
                        {notif.title}
                      </p>
                      <p
                        className={`text-[13px] mt-1 line-clamp-2 ${!notif.read ? "text-slate-600 font-medium" : "text-slate-500"}`}
                      >
                        {notif.message}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400 mt-1.5">
                        {formatDistanceToNow(date, {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </p>
                    </Link>

                    {/* Nút xóa – hiện khi hover */}
                    <button
                      onClick={(e) => handleDelete(e, notif.id)}
                      disabled={isUpdating}
                      className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-all sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      title="Xóa thông báo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <Link href="/notifications" onClick={() => setIsOpen(false)} className="block border-t border-slate-100 px-5 py-3 text-center text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
};
