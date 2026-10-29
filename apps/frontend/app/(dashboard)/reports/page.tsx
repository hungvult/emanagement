"use client";

import { RoleGuard } from "@/components/shared/role-guard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useLatestRequest } from "@/hooks/use-latest-request";
import { getErrorMessage } from "@/lib/errors";
import { downloadMonthlyReport } from "@/lib/report-csv";
import { reportService, type MonthlyReport } from "@/services/report.service";
import { BarChart3, Clock, CalendarDays, Download, LogOut, Timer, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find(p => p.type === "year")?.value}-${parts.find(p => p.type === "month")?.value}`;
}

function hours(minutes: number) {
  return `${Math.floor(minutes / 60).toLocaleString("vi-VN")} giờ ${minutes % 60} phút`;
}

export default function ReportsPage() {
  return <RoleGuard allowedRoles={["ROLE_ADMIN"]} fallback={<p>Bạn không có quyền xem báo cáo.</p>}><MonthlyReports /></RoleGuard>;
}

function MonthlyReports() {
  const { error: showError } = useToast();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const beginRequest = useLatestRequest();
  const load = useCallback(async () => {
    const isCurrent = beginRequest();
    setLoading(true);
    setError("");
    try {
      const [year, selectedMonth] = month.split("-").map(Number);
      const response = await reportService.monthly(year, selectedMonth);
      if (!isCurrent()) return;
      if (response.status !== "SUCCESS" || !response.data) throw new Error(response.message || "Không thể tải báo cáo");
      setData(response.data);
    } catch (err) {
      if (!isCurrent()) return;
      setData(null);
      setError(getErrorMessage(err, "Không thể tải báo cáo. Vui lòng thử lại."));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [month, beginRequest]);

  useEffect(() => {
    // Synchronize the selected month with the server report.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const totals = useMemo(() => (data?.employees ?? []).reduce((sum, row) => ({
    assigned: sum.assigned + row.assignedMinutes,
    actual: sum.actual + row.actualMinutes,
    early: sum.early + row.earlyCount,
    late: sum.late + row.lateCount,
    missing: sum.missing + row.missingCheckoutCount,
  }), { assigned: 0, actual: 0, early: 0, late: 0, missing: 0 }), [data]);
  const rows = (data?.employees ?? []).filter(row => `${row.fullName} ${row.employeeCode}`.toLocaleLowerCase("vi").includes(keyword.trim().toLocaleLowerCase("vi")));
  const totalPages = Math.max(1, Math.ceil(rows.length / 20));
  const visiblePage = Math.min(page, totalPages - 1);
  const exportCsv = (filtered: boolean) => {
    if (!data || loading) return;
    const employees = filtered ? rows : data.employees;
    if (employees.length === 0) return;
    try {
      downloadMonthlyReport(data, employees, filtered);
    } catch (err) {
      showError(getErrorMessage(err, "Không thể xuất CSV. Vui lòng thử lại."));
    }
  };
  const cards = [
    { label: "Giờ được phân trong tháng", value: hours(totals.assigned), icon: CalendarDays, color: "bg-indigo-50 text-indigo-600" },
    { label: "Giờ làm thực tế đến hiện tại", value: hours(totals.actual), icon: Clock, color: "bg-emerald-50 text-emerald-600" },
    { label: "Số lần về sớm", value: `${totals.early} lần`, icon: LogOut, color: "bg-amber-50 text-amber-600" },
    { label: "Số lần đi muộn", value: `${totals.late} lần`, icon: Timer, color: "bg-rose-50 text-rose-600" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900"><BarChart3 className="h-7 w-7 text-indigo-600" />Thống kê báo cáo</h1>
          <p className="mt-2 text-sm text-slate-500">Tổng hợp thời gian làm việc và chấm công theo tháng.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="report-month" className="mb-1 block text-sm font-semibold text-slate-700">Tháng báo cáo</label>
            <input id="report-month" type="month" min="1900-01" max="9999-12" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { setMonth(e.target.value); setData(null); setPage(0); } }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <Button onClick={() => void load()} disabled={loading} className="h-10 rounded-xl"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Cập nhật</Button>
        </div>
      </div>
      <p aria-live="polite" className="text-xs text-slate-500">{loading ? "Đang cập nhật báo cáo…" : data ? `Cập nhật lúc ${new Date(data.generatedAt + "+07:00").toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · Tự cập nhật mỗi phút` : ""}</p>
      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error} <button onClick={() => void load()} className="ml-2 font-semibold underline">Thử lại</button></div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{loading && !data ? "—" : value}</p></div>)}</div>
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm" aria-busy={loading}>
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 p-4">
              <Button variant="outline" onClick={() => exportCsv(false)} disabled={loading || !data?.employees.length}>
                <Download className="h-4 w-4" />Xuất CSV toàn bộ ({data?.employees.length ?? 0})
              </Button>
              <Button variant="outline" onClick={() => exportCsv(true)} disabled={loading || !data || !keyword.trim() || rows.length === 0}>
                <Download className="h-4 w-4" />Xuất CSV theo bộ lọc ({rows.length})
              </Button>
            </div>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-bold text-slate-800">Chi tiết nhân viên <span className="ml-2 text-sm font-normal text-slate-500">({rows.length})</span></h2><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Tìm nhân viên theo tên hoặc mã" placeholder="Tìm theo tên hoặc mã nhân viên" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(0); }} className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm sm:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{["Mã nhân viên", "Họ và tên", "Giờ được phân", "Giờ làm thực tế", "Về sớm", "Đi muộn"].map(title => <th key={title} scope="col" className="px-5 py-4 text-left font-semibold">{title}</th>)}</tr></thead><tbody>{loading && !data ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">Đang tải báo cáo…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">{keyword ? "Không tìm thấy nhân viên phù hợp." : "Chưa có nhân viên để thống kê."}</td></tr> : rows.slice(visiblePage * 20, (visiblePage + 1) * 20).map(row => <tr key={row.userId} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-5 py-4 font-medium text-indigo-600">{row.employeeCode}</td><td className="px-5 py-4 font-semibold text-slate-800">{row.fullName}</td><td className="px-5 py-4 tabular-nums">{hours(row.assignedMinutes)}</td><td className="px-5 py-4 tabular-nums">{hours(row.actualMinutes)}{row.missingCheckoutCount > 0 && <p className="mt-1 text-xs text-amber-700">{row.missingCheckoutCount} ngày thiếu giờ ra</p>}</td><td className="px-5 py-4 tabular-nums text-amber-700">{row.earlyCount}</td><td className="px-5 py-4 tabular-nums text-rose-600">{row.lateCount}</td></tr>)}</tbody></table></div>
            {totalPages > 1 && <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-4"><Button variant="outline" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Trước</Button><span className="text-sm text-slate-500">Trang {visiblePage + 1}/{totalPages}</span><Button variant="outline" disabled={visiblePage + 1 >= totalPages} onClick={() => setPage(visiblePage + 1)}>Sau</Button></div>}
          </div>
        </>
      )}
    </div>
  );
}
