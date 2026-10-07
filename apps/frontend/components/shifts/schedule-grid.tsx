"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addDays,
  DAY_NAMES,
  getMondayOfWeek,
  toISODate,
} from "@/lib/shifts-helpers";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserCheck,
} from "lucide-react";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "weekLabel"
  | "setWeekStart"
  | "weekDays"
  | "today"
  | "isLoadingSchedule"
  | "displayEmployees"
  | "scheduleMap"
  | "shiftColorMap"
  | "handleCellClick"
  | "setConfirmRemove"
>;

export function ScheduleGrid({
  weekLabel,
  setWeekStart,
  weekDays,
  today,
  isLoadingSchedule,
  displayEmployees,
  scheduleMap,
  shiftColorMap,
  handleCellClick,
  setConfirmRemove,
}: Props) {
  return (
    <>
      <Card className="border-slate-100 bg-white shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-4 pt-5 px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-base font-bold text-slate-800">
                Lịch phân ca tuần
              </CardTitle>
              <span className="text-sm font-semibold text-slate-500 ml-1">
                ({weekLabel})
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekStart((d) => addDays(d, -7))}
                className="h-8 w-8 p-0 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekStart(getMondayOfWeek(new Date()))}
                className="h-8 px-3 text-xs font-bold text-slate-700 rounded-xl hover:bg-white hover:shadow-xs"
              >
                Tuần hiện tại
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekStart((d) => addDays(d, 7))}
                className="h-8 w-8 p-0 rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-4 px-5 font-bold text-slate-700 w-48 min-w-[180px]">
                    Nhân viên
                  </th>
                  {weekDays.map((day, i) => {
                    const dateStr = toISODate(day);
                    const isToday = dateStr === today;
                    return (
                      <th
                        key={i}
                        className={`text-center py-4 px-2 font-medium w-[calc((100%-180px)/7)] border-l border-slate-100 ${
                          isToday ? "bg-indigo-50/50" : ""
                        }`}
                      >
                        <div
                          className={`text-xs uppercase tracking-wider ${isToday ? "text-indigo-600 font-extrabold" : "text-slate-500 font-bold"}`}
                        >
                          {DAY_NAMES[i]}
                        </div>
                        <div
                          className={`text-[15px] mt-1 ${isToday ? "text-indigo-600 font-extrabold" : "text-slate-800 font-semibold"}`}
                        >
                          {day.getDate()}/{day.getMonth() + 1}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoadingSchedule ? (
                  Array.from({ length: 4 }).map((_, ri) => (
                    <tr key={ri} className="border-b border-border">
                      <td className="py-3 px-4">
                        <div className="h-4 bg-muted animate-pulse rounded w-32" />
                      </td>
                      {weekDays.map((_, ci) => (
                        <td key={ci} className="py-3 px-2 text-center">
                          <div className="h-8 bg-muted animate-pulse rounded mx-1" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>Chưa có nhân viên nào.</p>
                    </td>
                  </tr>
                ) : (
                  displayEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3 px-5 bg-white group-hover:bg-transparent">
                        <div className="font-bold text-slate-800 text-sm truncate max-w-[160px]">
                          {emp.fullName}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 mt-0.5">
                          {emp.employeeCode}
                        </div>
                      </td>
                      {weekDays.map((day, ci) => {
                        const dateStr = toISODate(day);
                        const isToday = dateStr === today;
                        const entry = scheduleMap.get(`${emp.id}_${dateStr}`);
                        const color = entry
                          ? shiftColorMap.get(entry.shiftId)
                          : undefined;
                        return (
                          <td
                            key={ci}
                            className={`py-3 px-2 text-center border-l border-slate-100 ${isToday ? "bg-indigo-50/30" : ""}`}
                            onClick={() => !entry && handleCellClick(emp, day)}
                          >
                            {entry && color ? (
                              <div
                                className={`group/cell relative rounded-xl border-2 ${color.bg} ${color.border} overflow-hidden shadow-sm`}
                              >
                                {/* Thông tin ca */}
                                <div className="px-2 py-2">
                                  <div
                                    className={`text-[11px] font-extrabold ${color.text} leading-tight mb-0.5 uppercase tracking-wide truncate`}
                                  >
                                    {entry.shiftName}
                                  </div>
                                  <div
                                    className={`text-[11px] font-bold ${color.text} opacity-90`}
                                  >
                                    {entry.startTime.slice(0, 5)} –{" "}
                                    {entry.endTime.slice(0, 5)}
                                  </div>
                                </div>
                                {/* Action bar khi hover */}
                                <div className="grid grid-cols-2 border-t border-current/10 opacity-0 group-hover/cell:opacity-100 transition-opacity h-0 group-hover/cell:h-auto overflow-hidden bg-white/60 backdrop-blur-sm">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCellClick(emp, day);
                                    }}
                                    className={`py-1.5 text-[11px] font-bold ${color.text} hover:bg-white/50 transition-colors flex items-center justify-center gap-1 border-r border-current/10`}
                                    title="Đổi ca"
                                  >
                                    ✏️ Đổi
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmRemove({
                                        userId: emp.id,
                                        userName: emp.fullName,
                                        shiftName: entry.shiftName,
                                        date: dateStr,
                                      });
                                    }}
                                    className="py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center gap-1"
                                    title="Hủy ca"
                                  >
                                    🗑 Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl border-2 border-dashed border-slate-200 py-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100">
                                <Plus className="h-4 w-4 mx-auto text-indigo-400" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
