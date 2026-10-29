"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useMonthlyAttendance } from "@/hooks/shifts/use-monthly-attendance";
import { formatMinutes } from "@/lib/monthly-attendance";
import { toISODate } from "@/lib/shifts-helpers";

function timeLabel(value: string | null) {
  return value ? new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function MonthlyAttendanceSummary({ refreshToken }: { refreshToken?: number }) {
  const [month, setMonth] = useState(() => toISODate(new Date()).slice(0, 7));
  const { summary, isLoading, loadError, refresh } = useMonthlyAttendance(month, refreshToken);
  const busy = isLoading || !summary;
  const metrics = summary ? [
    { label: "Ca được phân", value: summary.planned, detail: formatMinutes(summary.plannedMinutes) + " theo lịch" },
    { label: "Ca đã chấm công", value: summary.attended, detail: `${summary.completed} ca có giờ vào và ra` },
    { label: "Giờ đã ghi nhận", value: formatMinutes(summary.workedMinutes), detail: "Từ các lượt có đủ giờ vào và ra hợp lệ" },
    { label: "Đi muộn", value: `${summary.late} lượt`, detail: "Theo trạng thái chấm công của hệ thống" },
    { label: "Về sớm", value: `${summary.earlyLeave} lượt`, detail: "Ra trước giờ kết thúc ca" },
  ] : [];

  return (
    <section className="space-y-4" aria-labelledby="monthly-summary-title" aria-busy={isLoading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="monthly-summary-title" className="text-xl font-bold">Thống kê chấm công tháng</h2>
          <p className="text-sm text-muted-foreground">Xem số ca, giờ làm và thời gian vào/ra trong tháng được chọn.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="attendance-summary-month" className="text-sm font-medium">Tháng thống kê</label>
          <input id="attendance-summary-month" type="month" value={month} min="1900-01" max="9999-12"
            onChange={(event) => {
              if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value);
            }}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          <Button variant="outline" onClick={() => void refresh()} disabled={isLoading}>Cập nhật thống kê</Button>
        </div>
      </div>
      {loadError ? (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p>{loadError}</p>
          <Button variant="outline" className="mt-2" onClick={() => void refresh()}>Thử lại</Button>
        </div>
      ) : busy ? (
        <p role="status" className="rounded-2xl border p-6 text-muted-foreground">Đang tải thống kê tháng…</p>
      ) : summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <Card key={metric.label}>
                <CardHeader><h3 className="text-sm font-medium text-muted-foreground">{metric.label}</h3></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {(summary.late > 0 || summary.earlyLeave > 0 || summary.missingCheckout > 0 || summary.invalidTime > 0) && (
            <div role="status" className="space-y-1 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Các mục cần kiểm tra trong tháng {month.split("-").reverse().join("/")}</p>
              {summary.late > 0 && <p>Có {summary.late} lượt đi muộn. Kiểm tra ngày và giờ vào bên dưới.</p>}
              {summary.earlyLeave > 0 && <p>Có {summary.earlyLeave} lượt về trước giờ kết thúc ca.</p>}
              {summary.missingCheckout > 0 && <p>Có {summary.missingCheckout} lượt chưa có giờ ra (có thể đang làm việc). Chưa cộng các lượt này vào tổng giờ.</p>}
              {summary.invalidTime > 0 && <p>Có {summary.invalidTime} lượt có giờ vào/ra không hợp lệ, chưa được cộng giờ. Vui lòng liên hệ quản lý để kiểm tra.</p>}
            </div>
          )}
          
          {summary.unmatched > 0 && <p className="text-xs text-muted-foreground">
            {summary.unmatched} lượt không có lịch ca tương ứng để đối chiếu thời gian đi muộn/về sớm; trạng thái chấm công vẫn được giữ nguyên.
          </p>}
          <details className="rounded-2xl border bg-card">
            <summary className="cursor-pointer px-4 py-3 font-semibold">Chi tiết vào/ra ({summary.rows.length} lượt)</summary>
            {summary.rows.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Chưa có lượt chấm công trong tháng này.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <caption className="sr-only">Chi tiết chấm công tháng {month}</caption>
                  <thead className="border-y bg-muted/40"><tr>
                    {["Ngày", "Ca / Giờ theo lịch", "Giờ vào", "Giờ ra", "Thời gian ghi nhận", "Đối chiếu"].map((label) => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
                  </tr></thead>
                  <tbody>{summary.rows.map((row) => (
                    <tr key={row.record.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{row.date.split("-").reverse().join("/")}</td>
                      <td className="px-4 py-3">
                        <p>{row.record.shiftName ?? row.shift?.shiftName ?? "Chưa xác định ca"}</p>
                        {row.shift && <p className="text-xs text-muted-foreground">{row.shift.startTime.slice(0, 5)} – {row.shift.endTime.slice(0, 5)}</p>}
                      </td>
                      <td className="px-4 py-3">{timeLabel(row.record.checkInTime)}</td>
                      <td className="px-4 py-3">{timeLabel(row.record.checkOutTime)}{row.record.checkOutTime && row.record.checkOutTime.slice(0, 10) !== row.date && <p className="text-xs">{row.record.checkOutTime.slice(0, 10).split("-").reverse().join("/")}</p>}</td>
                      <td className="px-4 py-3">{row.valid ? formatMinutes(row.minutes) : "Chưa tính"}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">
                        {row.late && <Badge variant="outline" className="text-amber-700">Muộn{row.lateMinutes !== null ? ` ${Math.ceil(row.lateMinutes)} phút` : ""}</Badge>}
                        {row.earlyLeave && <Badge variant="outline" className="text-amber-700">Về sớm</Badge>}
                        {row.record.status === "ON_TIME" && <Badge variant="outline">Vào đúng giờ</Badge>}
                        {row.missingCheckout && <Badge variant="outline">Chưa có giờ ra</Badge>}
                        {row.invalidTime && <Badge variant="outline" className="text-red-700">Giờ vào/ra không hợp lệ</Badge>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </details>
        </>
      )}
    </section>
  );
}
