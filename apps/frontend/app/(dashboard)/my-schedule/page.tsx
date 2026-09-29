"use client";

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
  return d.toISOString().split("T")[0];
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
  const [schedule, setSchedule] = useState<EmployeeShiftResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { error } = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchMySchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const start = toISODate(weekStart);
      const end = toISODate(addDays(weekStart, 6));
      const res = await shiftService.getMySchedule(start, end);
      if (res.status === "SUCCESS" && res.data) {
        setSchedule(res.data);
      } else {
        setSchedule([]);
      }
    } catch {
      error("Lỗi khi tải lịch làm việc của bạn");
      setSchedule([]);
    } finally {
      setIsLoading(false);
    }
  }, [weekStart]); // Removed 'error' from dependencies to prevent infinite loop

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Lịch làm việc của tôi</h1>
            <p className="text-muted-foreground text-sm mt-1">Xem chi tiết các ca làm việc đã được phân công.</p>
          </div>
          <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border border-border shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(d => addDays(d, -7))} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {weekLabel}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(d => addDays(d, 7))} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekStart(getMondayOfWeek(new Date()))} className="h-8 ml-2 px-3 text-xs">
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
                <Card key={i} className={`border-border transition-colors ${isToday ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "hover:border-primary/30"}`}>
                  <CardHeader className={`pb-2 pt-4 border-b ${isToday ? "bg-primary/5" : "bg-muted/10"}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                        {DAY_NAMES[i]}
                      </span>
                      <span className={`text-sm ${isToday ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {day.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 pb-4">
                    {entry && color ? (
                      <div className={`p-3 rounded-lg border ${color.bg} ${color.border}`}>
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
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[76px] rounded-lg border border-dashed border-border bg-muted/20">
                        <span className="text-sm text-muted-foreground">Không có ca làm việc</span>
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
