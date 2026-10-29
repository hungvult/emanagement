"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRequest } from "@/hooks/use-latest-request";
import { monthBounds, monthlyAttendance } from "@/lib/monthly-attendance";
import { attendanceService } from "@/services/attendance.service";
import { shiftService } from "@/services/shift.service";
import type { AttendanceHistory } from "@/types/attendance.types";

export function useMonthlyAttendance(month: string, refreshToken?: number) {
  const beginRequest = useLatestRequest();
  const [data, setData] = useState<{ month: string; summary: ReturnType<typeof monthlyAttendance> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const isCurrent = beginRequest();
    lastRefresh.current = Date.now();
    setIsLoading(true);
    setLoadError(null);
    try {
      const { start, end } = monthBounds(month);
      const [schedule, first] = await Promise.all([
        shiftService.getMySchedule(start, end),
        attendanceService.getMyHistory(undefined, 0, 100, { startDate: start, endDate: end, recordedOnly: true }),
      ]);
      if (!isCurrent()) return;
      if (schedule.status !== "SUCCESS" || !schedule.data || first.status !== "SUCCESS" || !first.data) {
        throw new Error("Không tải được thống kê");
      }
      const records: AttendanceHistory[] = [...first.data.content];
      // Read every page, including when the employee has several attendance sessions per day.
      for (let page = 1; page < first.data.totalPages; page++) {
        const response = await attendanceService.getMyHistory(undefined, page, 100,
          { startDate: start, endDate: end, recordedOnly: true });
        if (!isCurrent()) return;
        if (response.status !== "SUCCESS" || !response.data) throw new Error("Thiếu dữ liệu chấm công");
        records.push(...response.data.content);
      }
      setData({ month, summary: monthlyAttendance(month, schedule.data, records) });
    } catch {
      if (isCurrent()) setLoadError("Không tải được thống kê tháng. Vui lòng thử lại.");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [month, beginRequest]);

  useEffect(() => {
    // Refresh on month selection or the schedule's manual refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh, refreshToken]);

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 1000) void refresh();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh]);
  return { summary: data?.month === month ? data.summary : null, isLoading, loadError, refresh };
}
