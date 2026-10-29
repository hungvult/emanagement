"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRequest } from "@/hooks/use-latest-request";
import { toISODate, addDays } from "@/lib/shifts-helpers";
import { leaveService } from "@/services/leave.service";
import { shiftService } from "@/services/shift.service";
import type { LeaveRequestResponse } from "@/types/leave.types";
import type { EmployeeShiftResponse } from "@/types/shift.types";

export function useMySchedule(start: string, end: string) {
  const beginRequest = useLatestRequest();
  const [data, setData] = useState<{
    range: string;
    schedule: EmployeeShiftResponse[];
    upcoming: EmployeeShiftResponse[];
    leaves: LeaveRequestResponse[];
    loadedAt: Date;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastRefresh = useRef(0);
  const range = `${start}/${end}`;

  const refresh = useCallback(async () => {
    const isCurrent = beginRequest();
    lastRefresh.current = Date.now();
    setIsLoading(true);
    setLoadError(null);
    const now = new Date();
    const today = toISODate(now);
    const horizon = toISODate(addDays(now, 30));
    try {
      const [schedule, upcoming, leaves] = await Promise.all([
        shiftService.getMySchedule(start, end),
        shiftService.getMySchedule(today, horizon),
        leaveService.getMyRequests(),
      ]);
      if (!isCurrent()) return;
      if (schedule.status !== "SUCCESS" || !schedule.data ||
          upcoming.status !== "SUCCESS" || !upcoming.data ||
          leaves.status !== "SUCCESS" || !leaves.data) {
        throw new Error("Không thể tải đầy đủ lịch làm việc và nghỉ phép.");
      }
      setData({ range, schedule: schedule.data, upcoming: upcoming.data,
        leaves: leaves.data.filter((leave) => leave.status === "APPROVED"), loadedAt: now });
    } catch {
      if (isCurrent()) setLoadError("Không thể cập nhật lịch làm việc và nghỉ phép. Vui lòng thử lại.");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [start, end, range, beginRequest]);

  useEffect(() => {
    // Fetch the selected range and invalidate older responses through useLatestRequest.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 1000) {
        void refresh();
      }
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh]);

  return { data: data?.range === range ? data : null, isLoading, loadError, refresh };
}
