"use client";

import { useLatestRequest } from "../../../hooks/use-latest-request";
import React, { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "../../../components/shared/role-guard";
import { shiftService } from "../../../services/shift.service";
import { ShiftResponse, EmployeeShiftResponse } from "../../../types/shift.types";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "../../../components/ui/toast";
import { Badge } from "../../../components/ui/badge";

// --- Helpers ---
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

const SHIFT_COLORS = [
  { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-400" },
  { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-700 dark:text-amber-400" },
  { bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-700 dark:text-violet-400" },
  { bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-700 dark:text-rose-400" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-700 dark:text-cyan-400" },
];

export default function MySchedulePage() {
  const beginRequest = useLatestRequest();
  const [schedule, setSchedule] = useState<EmployeeShiftResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { error } = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchMySchedule = useCallback(async () => {
    const isCurrent = beginRequest();
    setIsLoading(true);
    try {
      const start = toISODate(weekStart);
      const end = toISODate(addDays(weekStart, 6));
      const res = await shiftService.getMySchedule(start, end);
      if (!isCurrent()) return;
      if (res.status === "SUCCESS" && res.data) {
        setSchedule(res.data);
      } else {
        setSchedule([]);
      }
    } catch {
      if (!isCurrent()) return;
      error("Lỗi khi tải lịch làm việc của bạn");
      setSchedule([]);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [weekStart, beginRequest]);

  useEffect(() => {
    fetchMySchedule();
  }, [fetchMySchedule]);

  const scheduleMap = new Map<string, EmployeeShiftResponse>();
  schedule.forEach((s) => {
    scheduleMap.set(s.assignedDate, s);
  });

  const today = toISODate(new Date());
  const weekLabel = `${weekDays[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${weekDays[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

  return (
    <RoleGuard allowedRoles={["ROLE_USER", "ROLE_ADMIN"]} fallback={<p>Không có quyền truy cập</p>}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 rounded-[32px] border border-indigo-100/50 shadow-sm">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Calendar className="h-8 w-8 text-indigo-600" />
              Lịch làm việc của tôi
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
              Xem chi tiết các ca làm việc đã được phân công.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50/50 p-1.5 rounded-[20px] w-fit border border-slate-100 shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(d => addDays(d, -7))} className="h-10 w-10 p-0 rounded-[14px] hover:bg-white hover:text-indigo-600 hover:shadow-sm">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="px-4 flex items-center gap-2 text-sm font-extrabold text-slate-700 bg-white h-10 rounded-[14px] shadow-sm border border-slate-100">
              <Calendar className="h-4 w-4 text-indigo-500" />
              {weekLabel}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(d => addDays(d, 7))} className="h-10 w-10 p-0 rounded-[14px] hover:bg-white hover:text-indigo-600 hover:shadow-sm">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(getMondayOfWeek(new Date()))} className="h-10 ml-2 px-5 text-[13px] font-bold rounded-[14px] text-indigo-600 border-indigo-100 hover:bg-indigo-50">
              Hôm nay
            </Button>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2 pt-4">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="h-16 bg-muted rounded w-full"></div>
                </CardContent>
              </Card>
            ))
          ) : (
            weekDays.map((day, i) => {
              const dateStr = toISODate(day);
              const isToday = dateStr === today;
              const entry = scheduleMap.get(dateStr);
              
              // Define color statically or based on shift ID modulo
              const color = entry ? SHIFT_COLORS[entry.shiftId % SHIFT_COLORS.length] : null;

              return (
                <Card key={i} className={`border-slate-100 transition-all rounded-[24px] ${isToday ? "border-indigo-200 shadow-md ring-2 ring-indigo-50 bg-white" : "hover:border-indigo-100 hover:shadow-sm bg-slate-50/30"}`}>
                  <CardHeader className={`pb-3 pt-5 border-b border-slate-100 px-5 ${isToday ? "bg-indigo-50/50" : "bg-transparent"}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-[15px] font-extrabold ${isToday ? "text-indigo-600" : "text-slate-700"}`}>
                        {DAY_NAMES[i]}
                      </span>
                      <span className={`text-sm font-bold ${isToday ? "text-indigo-600" : "text-slate-500"}`}>
                        {day.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    {entry && color ? (
                      <div className={`p-4 rounded-2xl border-2 shadow-sm ${color.bg} ${color.border}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-bold text-sm ${color.text}`}>{entry.shiftName}</h4>
                          <Badge variant="outline" className={`text-[10px] ${color.text}`}>{entry.shiftCode}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className={`h-4 w-4 ${color.text} opacity-80`} />
                          <span className={`text-sm font-medium ${color.text}`}>
                            {entry.startTime.slice(0, 5)} - {entry.endTime.slice(0, 5)}
                          </span>
                        </div>
                        {entry.gracePeriodMinutes !== undefined && entry.gracePeriodMinutes !== null && (
                          <div className={`text-[11px] font-semibold mt-1 opacity-80 ${color.text}`}>
                            Cho phép trễ: {entry.gracePeriodMinutes} phút
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[88px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                        <span className="text-sm font-semibold text-slate-400">Không có ca làm việc</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
