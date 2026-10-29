"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useLatestRequest } from "@/hooks/use-latest-request";
import { getErrorMessage } from "@/lib/errors";
import { notificationDate, notificationLink } from "@/lib/notification-utils";
import { notificationService } from "@/services/notification.service";
import type { NotificationResponse } from "@/types/notification.types";
import { Bell, CheckCheck, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [updating, setUpdating] = useState(false);
  const pending = useRef(false);
  const beginRequest = useLatestRequest();
  const router = useRouter();
  const { error } = useToast();
  const load = useCallback(async () => {
    const isCurrent = beginRequest();
    setLoading(true);
    try {
      const response = await notificationService.getMyNotifications(page, 20);
      if (!isCurrent()) return;
      if (response.status !== "SUCCESS" || !response.data) throw new Error(response.message);
      if (page > 0 && response.data.content.length === 0) { setPage(page - 1); return; }
      setItems(response.data.content);
      setTotalPages(response.data.totalPages);
      setFailure("");
    } catch (err) {
      if (isCurrent()) setFailure(getErrorMessage(err, "Không thể tải thông báo"));
    } finally { if (isCurrent()) setLoading(false); }
  }, [page, beginRequest]);

  useEffect(() => {
    // Synchronize the inbox with its selected page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = setInterval(() => { if (!pending.current && !document.hidden) void load(); }, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const mutate = async (action: () => Promise<unknown>, target?: string) => {
    if (pending.current) return;
    pending.current = true;
    setUpdating(true);
    beginRequest();
    try {
      await action();
      window.dispatchEvent(new Event("notifications-changed"));
      await load();
      if (target) router.push(target);
    } catch (err) { error(getErrorMessage(err, "Không thể cập nhật thông báo")); }
    finally { pending.current = false; setUpdating(false); }
  };

  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900"><Bell className="h-6 w-6 text-indigo-600" />Thông báo</h1>
      <div className="flex gap-2">
        <Button variant="outline" disabled={loading || updating} onClick={() => void load()}><RefreshCw className="h-4 w-4" />Cập nhật</Button>
        <Button disabled={loading || updating} onClick={() => void mutate(() => notificationService.markAllAsRead())}><CheckCheck className="h-4 w-4" />Đọc tất cả</Button>
      </div>
    </div>
    {failure ? <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{failure}</p> : <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm" aria-busy={loading}>
      {loading && items.length === 0 ? <p className="p-10 text-center text-slate-500">Đang tải thông báo…</p> : items.length === 0 ? <p className="p-10 text-center text-slate-500">Bạn chưa có thông báo nào.</p> : items.map(item => <div key={item.id} className={`flex items-start gap-3 border-b border-slate-100 p-5 last:border-0 ${item.read ? "" : "bg-indigo-50/50"}`}>
        <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-slate-200" : "bg-indigo-600"}`} aria-label={item.read ? "Đã đọc" : "Chưa đọc"} />
        <Link href={notificationLink(item)} className="min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500" onClick={event => {
          event.preventDefault();
          if (!item.read) void mutate(() => notificationService.markAsRead(item.id), notificationLink(item));
          else if (!updating) router.push(notificationLink(item));
        }}><h2 className="font-semibold text-slate-900">{item.title}</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{item.message}</p><time className="mt-2 block text-xs text-slate-400" dateTime={notificationDate(item.createdAt).toISOString()}>{notificationDate(item.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time></Link>
        <button type="button" disabled={updating} onClick={() => void mutate(() => notificationService.deleteNotification(item.id))} aria-label={`Xóa thông báo ${item.title}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
      </div>)}
    </div>}
    {totalPages > 1 && <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={loading || updating || page === 0} onClick={() => setPage(p => p - 1)}>Trước</Button><span className="text-sm text-slate-500">Trang {page + 1}/{totalPages}</span><Button variant="outline" disabled={loading || updating || page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Sau</Button></div>}
  </div>;
}
