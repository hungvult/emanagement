"use client";

import React, { useEffect, useState, useRef } from "react";
import { Bell, X } from "lucide-react";
import { notificationService } from "../../services/notification.service";
import { NotificationResponse } from "../../types/notification.types";
import { Button } from "../ui/button";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

function parseDate(raw: unknown): Date {
  if (Array.isArray(raw)) {
    return new Date(raw[0], raw[1] - 1, raw[2], raw[3] || 0, raw[4] || 0, raw[5] || 0);
  }
  return new Date((raw as string) || Date.now());
}

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const [countRes, notifRes] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getMyNotifications(0, 10),
      ]);
      if (countRes.status === "SUCCESS" && countRes.data !== undefined) {
        setUnreadCount(countRes.data);
      }
      if (notifRes.status === "SUCCESS" && notifRes.data) {
        setNotifications(notifRes.data.content);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

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
    try {
      await notificationService.markAsRead(id);
      // Cập nhật trực tiếp state để UX mượt – không cần gọi API lại
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      const deleted = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      {/* Nút chuông */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted transition-all duration-200 focus:outline-none"
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] bg-popover rounded-xl shadow-lg ring-1 ring-border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-auto p-0 text-xs text-primary hover:bg-transparent hover:underline"
              >
                Đánh dấu tất cả đã đọc
              </Button>
            )}
          </div>

          {/* Danh sách thông báo */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/50">
            {notifications.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-20" />
                <p className="text-sm">Không có thông báo nào.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const date = parseDate(notif.createdAt);
                return (
                  <div
                    key={notif.id}
                    className={`group relative flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      !notif.read
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/40"
                    }`}
                    onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                  >
                    {/* Chấm chưa đọc */}
                    <div className="mt-1.5 shrink-0">
                      {!notif.read ? (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-transparent" />
                      )}
                    </div>

                    {/* Nội dung */}
                    <div className="flex-1 min-w-0 pr-6">
                      <p className={`text-sm leading-snug ${!notif.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(date, { addSuffix: true, locale: vi })}
                      </p>
                    </div>

                    {/* Nút xóa – hiện khi hover */}
                    <button
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="absolute top-2.5 right-3 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                      title="Xóa thông báo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
