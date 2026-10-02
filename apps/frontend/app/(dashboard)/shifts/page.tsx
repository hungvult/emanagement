"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "../../../components/shared/role-guard";
import { shiftService } from "../../../services/shift.service";
import { employeeService } from "../../../services/employee.service";
import { ShiftResponse, ShiftCreate, AssignShift, EmployeeShiftResponse } from "../../../types/shift.types";
import { EmployeeResponse } from "../../../types/employee.types";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { useToast } from "../../../components/ui/toast";
import { Plus, Clock, UserCheck, Calendar, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const SHIFT_COLORS = [
  { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-400" },
  { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-700 dark:text-amber-400" },
  { bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-700 dark:text-violet-400" },
  { bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-700 dark:text-rose-400" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-700 dark:text-cyan-400" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [schedule, setSchedule] = useState<EmployeeShiftResponse[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const { error, success } = useToast();

  // Tuần hiện tại
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Modal Tạo ca
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ShiftCreate>({
    name: "",
    startTime: "08:00:00",
    endTime: "17:30:00",
    gracePeriodMinutes: 15,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Modal Phân ca
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{ userId: string; shiftId: string; assignedDate: string }>({
    userId: "",
    shiftId: "",
    assignedDate: toISODate(new Date()),
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [overwriteWarning, setOverwriteWarning] = useState<{ existingShiftName: string } | null>(null);

  // Xác nhận xóa ca
  const [confirmRemove, setConfirmRemove] = useState<{ userId: number; userName: string; shiftName: string; date: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchSchedule = useCallback(async () => {
    setIsLoadingSchedule(true);
    try {
      const start = toISODate(weekStart);
      const end = toISODate(addDays(weekStart, 6));
      const res = await shiftService.getSchedule(start, end);
      if (res.status === "SUCCESS" && res.data) {
        setSchedule(res.data);
      } else {
        setSchedule([]);
      }
    } catch {
      setSchedule([]);
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [weekStart]);

  useEffect(() => {
    const load = async () => {
      try {
        const [shiftRes, empRes] = await Promise.all([
          shiftService.getAll(),
          employeeService.getAll(0, 200),
        ]);
        if (shiftRes.status === "SUCCESS" && shiftRes.data) setShifts(shiftRes.data);
        if (empRes.status === "SUCCESS" && empRes.data) setEmployees(empRes.data.content);
      } catch {
        error("Lỗi khi tải dữ liệu");
      }
    };
    load();
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) { error("Tên ca không được để trống"); return; }
    setIsCreating(true);
    try {
      const payload: ShiftCreate = {
        name: createForm.name,
        startTime: createForm.startTime.length === 5 ? `${createForm.startTime}:00` : createForm.startTime,
        endTime: createForm.endTime.length === 5 ? `${createForm.endTime}:00` : createForm.endTime,
        gracePeriodMinutes: Number(createForm.gracePeriodMinutes) || 0,
      };
      const res = await shiftService.create(payload);
      if (res.status === "SUCCESS") {
        success("Tạo mới ca làm việc thành công!");
        setIsCreateOpen(false);
        setCreateForm({ name: "", startTime: "08:00:00", endTime: "17:30:00", gracePeriodMinutes: 15 });
        const shiftRes = await shiftService.getAll();
        if (shiftRes.status === "SUCCESS" && shiftRes.data) setShifts(shiftRes.data);
      } else {
        error(res.message || "Không thể tạo ca làm việc");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi tạo ca làm việc");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.userId || !assignForm.shiftId || !assignForm.assignedDate) {
      error("Vui lòng chọn đầy đủ nhân viên, ca và ngày");
      return;
    }

    // Kiểm tra xem ngày đó đã có ca chưa
    const existingEntry = scheduleMap.get(`${assignForm.userId}_${assignForm.assignedDate}`);
    if (existingEntry && !overwriteWarning) {
      setOverwriteWarning({ existingShiftName: existingEntry.shiftName });
      return;
    }

    await doAssign();
  };

  const doAssign = async () => {
    setOverwriteWarning(null);
    setIsAssigning(true);
    try {
      const payload: AssignShift = {
        userId: Number(assignForm.userId),
        shiftId: Number(assignForm.shiftId),
        assignedDate: assignForm.assignedDate,
      };
      const res = await shiftService.assign(payload);
      if (res.status === "SUCCESS") {
        success("Phân ca thành công!");
        setIsAssignOpen(false);
        fetchSchedule();
      } else {
        error(res.message || "Không thể phân ca");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi phân ca");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveShift = async () => {
    if (!confirmRemove) return;
    setIsRemoving(true);
    try {
      const res = await shiftService.removeAssignedShift(confirmRemove.userId, confirmRemove.date);
      if (res.status === "SUCCESS") {
        success(`Đã hủy ca của ${confirmRemove.userName} vào ngày ${confirmRemove.date}!`);
        setConfirmRemove(null);
        fetchSchedule();
      } else {
        error(res.message || "Không thể hủy ca làm việc");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi hủy ca làm việc");
    } finally {
      setIsRemoving(false);
    }
  };

  // Click vào ô trống → mở phân ca với ngày được điền sẵn
  const handleCellClick = (emp: EmployeeResponse, date: Date) => {
    setAssignForm({ userId: String(emp.id), shiftId: "", assignedDate: toISODate(date) });
    setIsAssignOpen(true);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  // Chỉ hiển thị nhân viên có ít nhất 1 phân ca trong tuần hoặc tất cả nếu ít hơn 10
  const displayEmployees = employees.slice(0, 20);

  // Lookup: userId -> dateStr -> schedule entry
  const scheduleMap = new Map<string, EmployeeShiftResponse>();
  schedule.forEach((s) => {
    scheduleMap.set(`${s.userId}_${s.assignedDate}`, s);
  });

  // Màu theo shiftId
  const shiftColorMap = new Map<number, typeof SHIFT_COLORS[0]>();
  shifts.forEach((s, i) => shiftColorMap.set(s.id, SHIFT_COLORS[i % SHIFT_COLORS.length]));

  const today = toISODate(new Date());

  const weekLabel = `${weekDays[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${weekDays[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <RoleGuard allowedRoles={["ROLE_ADMIN"]} fallback={<p>Không có quyền truy cập</p>}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 rounded-[32px] border border-indigo-100/50 shadow-sm">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Calendar className="h-8 w-8 text-indigo-600" />
              Quản lý Ca làm việc
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
              Tạo danh mục ca làm việc và phân ca cho nhân sự.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsAssignOpen(true)}
              className="flex items-center gap-2 h-11 px-5 rounded-xl font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
            >
              <UserCheck className="h-4 w-4" /> Phân ca
            </Button>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 h-11 px-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" /> Tạo ca mới
            </Button>
          </div>
        </div>

        {/* Danh mục ca */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shifts.map((shift, i) => {
            const color = SHIFT_COLORS[i % SHIFT_COLORS.length];
            return (
              <Card key={shift.id} className="hover:border-indigo-200 hover:shadow-md transition-all shadow-sm bg-white border-slate-100 rounded-2xl">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base font-bold text-slate-800">{shift.name}</CardTitle>
                    <Badge variant="outline" className={`text-xs font-semibold ${color.text} ${color.border} ${color.bg}`}>{shift.shiftCode}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 px-5">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock className={`h-4 w-4 ${color.text}`} />
                    <span className="text-sm font-bold text-slate-700">{shift.startTime} – {shift.endTime}</span>
                  </div>
                  <p className="text-[13px] text-slate-500 mt-1.5 font-medium">Cho phép trễ: <strong className="text-slate-700">{shift.gracePeriodMinutes} phút</strong></p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Lịch phân ca tuần */}
        <Card className="border-slate-100 bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-4 pt-5 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold text-foreground">Lịch phân ca tuần</CardTitle>
                <span className="text-sm text-muted-foreground ml-1">{weekLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(d => addDays(d, -7))} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(getMondayOfWeek(new Date()))} className="h-8 px-3 text-xs">
                  Hôm nay
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(d => addDays(d, 7))} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left py-4 px-5 font-bold text-slate-700 w-44 min-w-[160px]">Nhân viên</th>
                    {weekDays.map((day, i) => {
                      const dateStr = toISODate(day);
                      const isToday = dateStr === today;
                      return (
                        <th key={i} className={`text-center py-4 px-2 font-medium w-[calc((100%-160px)/7)] border-l border-slate-100 ${isToday ? "bg-indigo-50/50" : ""}`}>
                          <div className={`text-xs uppercase tracking-wider ${isToday ? "text-indigo-600 font-extrabold" : "text-slate-500 font-bold"}`}>{DAY_NAMES[i]}</div>
                          <div className={`text-[15px] mt-1 ${isToday ? "text-indigo-600 font-extrabold" : "text-slate-800 font-semibold"}`}>
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
                        <td className="py-3 px-4"><div className="h-4 bg-muted animate-pulse rounded w-32" /></td>
                        {weekDays.map((_, ci) => (
                          <td key={ci} className="py-3 px-2 text-center"><div className="h-8 bg-muted animate-pulse rounded mx-1" /></td>
                        ))}
                      </tr>
                    ))
                  ) : displayEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Chưa có nhân viên nào.</p>
                      </td>
                    </tr>
                  ) : (
                    displayEmployees.map((emp) => (
                      <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-5 bg-white group-hover:bg-transparent">
                          <div className="font-bold text-slate-800 text-sm truncate max-w-[140px]">{emp.fullName}</div>
                          <div className="text-xs font-semibold text-slate-500 mt-0.5">{emp.employeeCode}</div>
                        </td>
                        {weekDays.map((day, ci) => {
                          const dateStr = toISODate(day);
                          const isToday = dateStr === today;
                          const entry = scheduleMap.get(`${emp.id}_${dateStr}`);
                          const color = entry ? shiftColorMap.get(entry.shiftId) : undefined;
                          return (
                            <td
                              key={ci}
                              className={`py-3 px-2 text-center border-l border-slate-100 ${isToday ? "bg-indigo-50/30" : ""}`}
                              onClick={() => !entry && handleCellClick(emp, day)}
                            >
                              {entry && color ? (
                                <div className={`group/cell relative rounded-xl border-2 ${color.bg} ${color.border} overflow-hidden shadow-sm`}>
                                  {/* Thông tin ca */}
                                  <div className="px-2 py-2">
                                    <div className={`text-[11px] font-extrabold ${color.text} leading-tight mb-0.5 uppercase tracking-wide`}>{entry.shiftName}</div>
                                    <div className={`text-[11px] font-bold ${color.text} opacity-90`}>{entry.startTime.slice(0,5)} – {entry.endTime.slice(0,5)}</div>
                                  </div>
                                  {/* Action bar – hiện khi hover */}
                                  <div className="grid grid-cols-2 border-t border-current/10 opacity-0 group-hover/cell:opacity-100 transition-opacity h-0 group-hover/cell:h-auto overflow-hidden bg-white/50 backdrop-blur-sm">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCellClick(emp, day); }}
                                      className={`py-1.5 text-[11px] font-bold ${color.text} hover:bg-white/50 transition-colors flex items-center justify-center gap-1 border-r border-current/10`}
                                      title="Đổi ca"
                                    >
                                      ✏️ Đổi
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfirmRemove({ userId: emp.id, userName: emp.fullName, shiftName: entry.shiftName, date: dateStr }); }}
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

        {/* Modal Tạo ca làm việc mới */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Tạo ca làm việc mới">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="Tên ca làm việc *"
              placeholder="VD: Ca Hành Chính, Ca Sáng, Ca Tối"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Giờ bắt đầu *" type="time" step="1" value={createForm.startTime}
                onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })} required />
              <Input label="Giờ kết thúc *" type="time" step="1" value={createForm.endTime}
                onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })} required />
            </div>
            <Input label="Số phút cho phép đi trễ (0 - 120)" type="number" min="0" max="120"
              value={createForm.gracePeriodMinutes}
              onChange={(e) => setCreateForm({ ...createForm, gracePeriodMinutes: Number(e.target.value) })} />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Hủy</Button>
              <Button type="submit" isLoading={isCreating}>Tạo ca làm việc</Button>
            </div>
          </form>
        </Modal>

        {/* Modal Phân ca */}
        <Modal isOpen={isAssignOpen} onClose={() => { setIsAssignOpen(false); setOverwriteWarning(null); }} title="Phân ca làm việc cho nhân viên">
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Chọn nhân viên *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={assignForm.userId}
                onChange={(e) => { setAssignForm({ ...assignForm, userId: e.target.value }); setOverwriteWarning(null); }}
                required
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Chọn ca làm việc *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={assignForm.shiftId}
                onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                required
              >
                <option value="">-- Chọn ca làm việc --</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime} – {shift.endTime})</option>
                ))}
              </select>
            </div>

            <Input label="Ngày phân ca *" type="date" value={assignForm.assignedDate}
              onChange={(e) => { setAssignForm({ ...assignForm, assignedDate: e.target.value }); setOverwriteWarning(null); }} required />

            {/* Cảnh báo ghi đè */}
            {overwriteWarning && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
                <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Nhân viên đã có ca trong ngày này</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                    Ca hiện tại: <strong>{overwriteWarning.existingShiftName}</strong>. Xác nhận để thay thế bằng ca mới.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => { setIsAssignOpen(false); setOverwriteWarning(null); }}>Hủy</Button>
              {overwriteWarning ? (
                <Button type="submit" isLoading={isAssigning} className="bg-amber-500 hover:bg-amber-600">
                  Xác nhận thay thế ca
                </Button>
              ) : (
                <Button type="submit" isLoading={isAssigning}>Xác nhận phân ca</Button>
              )}
            </div>
          </form>
        </Modal>

        {/* Modal xác nhận hủy ca */}
        <Modal isOpen={!!confirmRemove} onClose={() => setConfirmRemove(null)} title="Xác nhận hủy ca làm việc">
          {confirmRemove && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Bạn có chắc muốn hủy ca này không?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nhân viên <strong>{confirmRemove.userName}</strong> sẽ bị xóa ca{" "}
                    <strong>{confirmRemove.shiftName}</strong> vào ngày <strong>{confirmRemove.date}</strong>.
                    Nhân viên sẽ nhận được thông báo về việc hủy ca.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Hủy bỏ</Button>
                <Button
                  variant="destructive"
                  isLoading={isRemoving}
                  onClick={handleRemoveShift}
                >
                  Xác nhận hủy ca
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </RoleGuard>
  );
}
