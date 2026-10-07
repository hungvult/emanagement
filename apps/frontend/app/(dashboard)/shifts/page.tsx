"use client";

import { useLatestRequest } from "../../../hooks/use-latest-request";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { RoleGuard } from "../../../components/shared/role-guard";
import { shiftService } from "../../../services/shift.service";
import { employeeService } from "../../../services/employee.service";
import {
  ShiftResponse,
  ShiftCreate,
  ShiftUpdate,
  AssignShift,
  BulkAssignRequest,
  BulkAssignResult,
  CopyWeekRequest,
  EmployeeShiftResponse,
} from "../../../types/shift.types";
import { EmployeeResponse } from "../../../types/employee.types";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { useToast } from "../../../components/ui/toast";
import {
  Plus,
  Clock,
  UserCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Copy,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Users,
  Info,
  Check,
} from "lucide-react";

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

const DAY_OF_WEEK_OPTIONS = [
  { key: "MONDAY", label: "T2", fullLabel: "Thứ 2" },
  { key: "TUESDAY", label: "T3", fullLabel: "Thứ 3" },
  { key: "WEDNESDAY", label: "T4", fullLabel: "Thứ 4" },
  { key: "THURSDAY", label: "T5", fullLabel: "Thứ 5" },
  { key: "FRIDAY", label: "T6", fullLabel: "Thứ 6" },
  { key: "SATURDAY", label: "T7", fullLabel: "Thứ 7" },
  { key: "SUNDAY", label: "CN", fullLabel: "Chủ Nhật" },
];

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
  const beginScheduleRequest = useLatestRequest();
  const beginShiftsRequest = useLatestRequest();
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
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

  // Modal Sửa ca
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftResponse | null>(null);
  const [editForm, setEditForm] = useState<ShiftUpdate>({
    name: "",
    startTime: "08:00:00",
    endTime: "17:30:00",
    gracePeriodMinutes: 15,
    effectiveFrom: toISODate(addDays(new Date(), 1)),
    active: true,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal Xóa / Ngừng sử dụng ca
  const [isDeleteShiftOpen, setIsDeleteShiftOpen] = useState(false);
  const [deletingShift, setDeletingShift] = useState<ShiftResponse | null>(null);
  const [replaceShiftId, setReplaceShiftId] = useState<string>("");
  const [isDeletingShift, setIsDeletingShift] = useState(false);

  // Modal Phân ca đơn lẻ
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{ userId: string; shiftId: string; assignedDate: string }>({
    userId: "",
    shiftId: "",
    assignedDate: toISODate(new Date()),
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [overwriteWarning, setOverwriteWarning] = useState<{ existingShiftName: string } | null>(null);

  // Modal Phân ca hàng loạt (Bulk Assign)
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    shiftId: "",
    startDate: toISODate(new Date()),
    endDate: toISODate(addDays(new Date(), 6)),
    daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    targetMode: "ALL" as "ALL" | "CUSTOM",
    selectedUserIds: [] as number[],
    searchUser: "",
    overwrite: false,
  });
  const [isBulkPreviewing, setIsBulkPreviewing] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkAssignResult | null>(null);

  // Modal Sao chép tuần (Copy Week)
  const [isCopyWeekOpen, setIsCopyWeekOpen] = useState(false);
  const [copyWeekForm, setCopyWeekForm] = useState({
    sourceWeekStart: toISODate(getMondayOfWeek(new Date())),
    targetWeekStart: toISODate(addDays(getMondayOfWeek(new Date()), 7)),
    targetMode: "ALL" as "ALL" | "CUSTOM",
    selectedUserIds: [] as number[],
    searchUser: "",
    overwrite: false,
  });
  const [isCopyPreviewing, setIsCopyPreviewing] = useState(false);
  const [isCopySubmitting, setIsCopySubmitting] = useState(false);
  const [copyResult, setCopyResult] = useState<BulkAssignResult | null>(null);

  // Xác nhận hủy ca phân công
  const [confirmRemove, setConfirmRemove] = useState<{ userId: number; userName: string; shiftName: string; date: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchShifts = useCallback(async () => {
    const isCurrent = beginShiftsRequest();
    try {
      const res = await shiftService.getAll(includeInactive);
      if (!isCurrent()) return;
      if (res.status === "SUCCESS" && res.data) {
        setShifts(res.data);
      }
    } catch {
      if (!isCurrent()) return;
      error("Lỗi khi tải danh mục ca làm việc");
    }
  }, [includeInactive, beginShiftsRequest]);

  const fetchSchedule = useCallback(async () => {
    const isCurrent = beginScheduleRequest();
    setIsLoadingSchedule(true);
    try {
      const start = toISODate(weekStart);
      const end = toISODate(addDays(weekStart, 6));
      const res = await shiftService.getSchedule(start, end);
      if (!isCurrent()) return;
      if (res.status === "SUCCESS" && res.data) {
        setSchedule(res.data);
      } else {
        setSchedule([]);
      }
    } catch {
      if (!isCurrent()) return;
      setSchedule([]);
    } finally {
      if (isCurrent()) setIsLoadingSchedule(false);
    }
  }, [weekStart, beginScheduleRequest]);

  useEffect(() => {
    const loadInit = async () => {
      try {
        const empRes = await employeeService.getAll(0, 500);
        if (empRes.status === "SUCCESS" && empRes.data) {
          setEmployees(empRes.data.content);
        }
      } catch {
        error("Lỗi khi tải danh sách nhân viên");
      }
    };
    loadInit();
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Cập nhật tuần nguồn của sao chép khi đổi tuần xem
  useEffect(() => {
    setCopyWeekForm((prev) => ({
      ...prev,
      sourceWeekStart: toISODate(weekStart),
      targetWeekStart: toISODate(addDays(weekStart, 7)),
    }));
  }, [weekStart]);

  // ── Handlers: Danh mục ca ──────────────────────────────────────────────────

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      error("Tên ca không được để trống");
      return;
    }
    setIsCreating(true);
    try {
      const payload: ShiftCreate = {
        name: createForm.name.trim(),
        startTime: createForm.startTime.length === 5 ? `${createForm.startTime}:00` : createForm.startTime,
        endTime: createForm.endTime.length === 5 ? `${createForm.endTime}:00` : createForm.endTime,
        gracePeriodMinutes: Number(createForm.gracePeriodMinutes) || 0,
      };
      const res = await shiftService.create(payload);
      if (res.status === "SUCCESS") {
        success("Tạo mới ca làm việc thành công!");
        setIsCreateOpen(false);
        setCreateForm({ name: "", startTime: "08:00:00", endTime: "17:30:00", gracePeriodMinutes: 15 });
        fetchShifts();
      } else {
        error(res.message || "Không thể tạo ca làm việc");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi tạo ca làm việc");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEdit = (shift: ShiftResponse) => {
    setEditingShift(shift);
    setEditForm({
      name: shift.name,
      startTime: shift.startTime.slice(0, 8),
      endTime: shift.endTime.slice(0, 8),
      gracePeriodMinutes: shift.gracePeriodMinutes,
      effectiveFrom: toISODate(addDays(new Date(), 1)),
      active: shift.active,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;
    if (!editForm.name.trim()) {
      error("Tên ca không được để trống");
      return;
    }
    setIsUpdating(true);
    try {
      const payload: ShiftUpdate = {
        name: editForm.name.trim(),
        startTime: editForm.startTime.length === 5 ? `${editForm.startTime}:00` : editForm.startTime,
        endTime: editForm.endTime.length === 5 ? `${editForm.endTime}:00` : editForm.endTime,
        gracePeriodMinutes: Number(editForm.gracePeriodMinutes) || 0,
        effectiveFrom: editForm.effectiveFrom,
        active: editForm.active,
      };
      const res = await shiftService.update(editingShift.id, payload);
      if (res.status === "SUCCESS") {
        success("Cập nhật ca làm việc thành công!");
        setIsEditOpen(false);
        setEditingShift(null);
        fetchShifts();
        fetchSchedule();
      } else {
        error(res.message || "Không thể cập nhật ca làm việc");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi cập nhật ca làm việc");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenDelete = (shift: ShiftResponse) => {
    setDeletingShift(shift);
    setReplaceShiftId("");
    setIsDeleteShiftOpen(true);
  };

  const handleDeleteShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingShift) return;
    setIsDeletingShift(true);
    try {
      const replaceIdNum = replaceShiftId ? Number(replaceShiftId) : undefined;
      const res = await shiftService.remove(deletingShift.id, replaceIdNum);
      if (res.status === "SUCCESS") {
        const action = res.data;
        success(action === "DELETED" ? "Đã xóa ca làm việc thành công!" : "Đã chuyển ca sang trạng thái Ngừng sử dụng!");
        setIsDeleteShiftOpen(false);
        setDeletingShift(null);
        fetchShifts();
        fetchSchedule();
      } else {
        error(res.message || "Không thể xóa ca làm việc");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi xóa ca làm việc");
    } finally {
      setIsDeletingShift(false);
    }
  };

  // ── Handlers: Phân ca đơn lẻ ───────────────────────────────────────────────

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.userId || !assignForm.shiftId || !assignForm.assignedDate) {
      error("Vui lòng chọn đầy đủ nhân viên, ca và ngày");
      return;
    }

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

  const handleCellClick = (emp: EmployeeResponse, date: Date) => {
    setAssignForm({ userId: String(emp.id), shiftId: "", assignedDate: toISODate(date) });
    setIsAssignOpen(true);
  };

  // ── Handlers: Phân ca hàng loạt ───────────────────────────────────────────

  const handleOpenBulk = () => {
    setBulkForm({
      shiftId: shifts.find((s) => s.active)?.id.toString() || "",
      startDate: toISODate(weekStart),
      endDate: toISODate(addDays(weekStart, 6)),
      daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      targetMode: "ALL",
      selectedUserIds: [],
      searchUser: "",
      overwrite: false,
    });
    setBulkResult(null);
    setIsBulkOpen(true);
  };

  const toggleBulkDay = (key: string) => {
    setBulkForm((prev) => {
      const exists = prev.daysOfWeek.includes(key);
      const nextDays = exists ? prev.daysOfWeek.filter((d) => d !== key) : [...prev.daysOfWeek, key];
      return { ...prev, daysOfWeek: nextDays };
    });
    setBulkResult(null);
  };

  const toggleBulkUser = (userId: number) => {
    setBulkForm((prev) => {
      const exists = prev.selectedUserIds.includes(userId);
      const nextUsers = exists ? prev.selectedUserIds.filter((id) => id !== userId) : [...prev.selectedUserIds, userId];
      return { ...prev, selectedUserIds: nextUsers };
    });
    setBulkResult(null);
  };

  const executeBulkAssign = async (dryRun: boolean) => {
    if (!bulkForm.shiftId) {
      error("Vui lòng chọn ca làm việc");
      return;
    }
    if (!bulkForm.startDate || !bulkForm.endDate) {
      error("Vui lòng chọn ngày bắt đầu và kết thúc");
      return;
    }
    if (bulkForm.endDate < bulkForm.startDate) {
      error("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu");
      return;
    }
    if (bulkForm.daysOfWeek.length === 0) {
      error("Vui lòng chọn ít nhất một thứ trong tuần");
      return;
    }
    if (bulkForm.targetMode === "CUSTOM" && bulkForm.selectedUserIds.length === 0) {
      error("Vui lòng chọn ít nhất một nhân viên");
      return;
    }

    if (dryRun) {
      setIsBulkPreviewing(true);
    } else {
      setIsBulkSubmitting(true);
    }

    try {
      const payload: BulkAssignRequest = {
        shiftId: Number(bulkForm.shiftId),
        startDate: bulkForm.startDate,
        endDate: bulkForm.endDate,
        daysOfWeek: bulkForm.daysOfWeek,
        userIds: bulkForm.targetMode === "CUSTOM" ? bulkForm.selectedUserIds : undefined,
        overwrite: bulkForm.overwrite,
        dryRun,
      };

      const res = await shiftService.bulkAssign(payload);
      if (res.status === "SUCCESS" && res.data) {
        setBulkResult(res.data);
        if (!dryRun) {
          success(`Phân ca hoàn tất: ${res.data.created} tạo mới, ${res.data.updated} cập nhật!`);
          setIsBulkOpen(false);
          fetchSchedule();
        }
      } else {
        error(res.message || "Không thể thực hiện phân ca hàng loạt");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi phân ca hàng loạt");
    } finally {
      setIsBulkPreviewing(false);
      setIsBulkSubmitting(false);
    }
  };

  // ── Handlers: Sao chép lịch tuần ──────────────────────────────────────────

  const handleOpenCopyWeek = () => {
    setCopyWeekForm({
      sourceWeekStart: toISODate(weekStart),
      targetWeekStart: toISODate(addDays(weekStart, 7)),
      targetMode: "ALL",
      selectedUserIds: [],
      searchUser: "",
      overwrite: false,
    });
    setCopyResult(null);
    setIsCopyWeekOpen(true);
  };

  const executeCopyWeek = async (dryRun: boolean) => {
    if (!copyWeekForm.sourceWeekStart || !copyWeekForm.targetWeekStart) {
      error("Vui lòng chọn tuần nguồn và tuần đích");
      return;
    }
    if (copyWeekForm.sourceWeekStart === copyWeekForm.targetWeekStart) {
      error("Tuần nguồn và tuần đích phải khác nhau");
      return;
    }
    if (copyWeekForm.targetMode === "CUSTOM" && copyWeekForm.selectedUserIds.length === 0) {
      error("Vui lòng chọn ít nhất một nhân viên");
      return;
    }

    if (dryRun) {
      setIsCopyPreviewing(true);
    } else {
      setIsCopySubmitting(true);
    }

    try {
      const payload: CopyWeekRequest = {
        sourceWeekStart: copyWeekForm.sourceWeekStart,
        targetWeekStart: copyWeekForm.targetWeekStart,
        userIds: copyWeekForm.targetMode === "CUSTOM" ? copyWeekForm.selectedUserIds : undefined,
        overwrite: copyWeekForm.overwrite,
        dryRun,
      };

      const res = await shiftService.copyWeek(payload);
      if (res.status === "SUCCESS" && res.data) {
        setCopyResult(res.data);
        if (!dryRun) {
          success(`Sao chép lịch thành công: ${res.data.created} tạo mới, ${res.data.updated} cập nhật!`);
          setIsCopyWeekOpen(false);
          fetchSchedule();
        }
      } else {
        error(res.message || "Không thể sao chép lịch tuần");
      }
    } catch (err: any) {
      error(err.message || "Lỗi khi sao chép lịch tuần");
    } finally {
      setIsCopyPreviewing(false);
      setIsCopySubmitting(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "ACTIVE"), [employees]);

  const displayEmployees = useMemo(() => {
    // Hiển thị những nhân viên có lịch tuần này trước, sau đó là nhân viên khác
    const assignedUserIds = new Set(schedule.map((s) => s.userId));
    const sorted = [...employees].sort((a, b) => {
      const hasA = assignedUserIds.has(a.id);
      const hasB = assignedUserIds.has(b.id);
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
    return sorted.slice(0, 25);
  }, [employees, schedule]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, EmployeeShiftResponse>();
    schedule.forEach((s) => {
      map.set(`${s.userId}_${s.assignedDate}`, s);
    });
    return map;
  }, [schedule]);

  const shiftColorMap = useMemo(() => {
    const map = new Map<number, (typeof SHIFT_COLORS)[0]>();
    shifts.forEach((s, i) => map.set(s.id, SHIFT_COLORS[i % SHIFT_COLORS.length]));
    return map;
  }, [shifts]);

  const today = toISODate(new Date());

  const weekLabel = `${weekDays[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${weekDays[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

  const activeShiftsForAssign = shifts.filter((s) => s.active);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <RoleGuard allowedRoles={["ROLE_ADMIN"]} fallback={<p>Không có quyền truy cập</p>}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 rounded-[32px] border border-indigo-100/50 shadow-sm">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Calendar className="h-8 w-8 text-indigo-600" />
              Quản lý Ca làm việc & Phân ca
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
              Thiết lập danh mục ca, phân ca theo ngày, phân ca hàng loạt và sao chép lịch tuần tự động.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              onClick={handleOpenCopyWeek}
              className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"
            >
              <Copy className="h-4 w-4" /> Sao chép tuần
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenBulk}
              className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
            >
              <Layers className="h-4 w-4" /> Phân ca hàng loạt
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAssignOpen(true)}
              className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 border-slate-200"
            >
              <UserCheck className="h-4 w-4" /> Phân ca đơn
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
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" /> Danh mục ca làm việc ({shifts.length})
            </h2>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Hiển thị ca đã ngừng sử dụng
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shifts.map((shift, i) => {
              const color = SHIFT_COLORS[i % SHIFT_COLORS.length];
              const isDefault = shift.shiftCode === "DEFAULT";
              return (
                <Card
                  key={shift.id}
                  className={`hover:border-indigo-200 hover:shadow-md transition-all shadow-sm bg-white border-slate-100 rounded-2xl relative group ${
                    !shift.active ? "opacity-60 bg-slate-50 border-dashed" : ""
                  }`}
                >
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-800 line-clamp-1">{shift.name}</CardTitle>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className={`text-[11px] font-semibold ${color.text} ${color.border} ${color.bg}`}>
                            {shift.shiftCode}
                          </Badge>
                          {!shift.active && (
                            <Badge variant="secondary" className="text-[10px] font-bold bg-slate-200 text-slate-600">
                              Ngừng dùng
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Nút Sửa / Xóa */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(shift)}
                          title="Chỉnh sửa ca"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {!isDefault && (
                          <button
                            onClick={() => handleOpenDelete(shift)}
                            title="Xóa / Ngừng sử dụng ca"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 px-5">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className={`h-4 w-4 ${color.text}`} />
                      <span className="text-sm font-bold text-slate-700">
                        {shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-500 mt-1.5 font-medium">
                      Cho phép trễ: <strong className="text-slate-700">{shift.gracePeriodMinutes} phút</strong>
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Lịch phân ca tuần */}
        <Card className="border-slate-100 bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-4 pt-5 px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <CardTitle className="text-base font-bold text-slate-800">Lịch phân ca tuần</CardTitle>
                <span className="text-sm font-semibold text-slate-500 ml-1">({weekLabel})</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                <Button variant="ghost" size="sm" onClick={() => setWeekStart((d) => addDays(d, -7))} className="h-8 w-8 p-0 rounded-xl">
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
                <Button variant="ghost" size="sm" onClick={() => setWeekStart((d) => addDays(d, 7))} className="h-8 w-8 p-0 rounded-xl">
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
                    <th className="text-left py-4 px-5 font-bold text-slate-700 w-48 min-w-[180px]">Nhân viên</th>
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
                          <div className={`text-xs uppercase tracking-wider ${isToday ? "text-indigo-600 font-extrabold" : "text-slate-500 font-bold"}`}>
                            {DAY_NAMES[i]}
                          </div>
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
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Chưa có nhân viên nào.</p>
                      </td>
                    </tr>
                  ) : (
                    displayEmployees.map((emp) => (
                      <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-5 bg-white group-hover:bg-transparent">
                          <div className="font-bold text-slate-800 text-sm truncate max-w-[160px]">{emp.fullName}</div>
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
                                    <div className={`text-[11px] font-extrabold ${color.text} leading-tight mb-0.5 uppercase tracking-wide truncate`}>
                                      {entry.shiftName}
                                    </div>
                                    <div className={`text-[11px] font-bold ${color.text} opacity-90`}>
                                      {entry.startTime.slice(0, 5)} – {entry.endTime.slice(0, 5)}
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

        {/* Modal: Tạo ca làm việc mới */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Tạo ca làm việc mới">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="Tên ca làm việc *"
              placeholder="VD: Ca Hành Chính, Ca Sáng, Ca Chiều"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Giờ bắt đầu *"
                type="time"
                step="1"
                value={createForm.startTime}
                onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                required
              />
              <Input
                label="Giờ kết thúc *"
                type="time"
                step="1"
                value={createForm.endTime}
                onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                required
              />
            </div>
            <Input
              label="Số phút cho phép đi trễ (0 - 120)"
              type="number"
              min="0"
              max="120"
              value={createForm.gracePeriodMinutes}
              onChange={(e) => setCreateForm({ ...createForm, gracePeriodMinutes: Number(e.target.value) })}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" isLoading={isCreating}>
                Tạo ca làm việc
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Chỉnh sửa ca làm việc */}
        <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Chỉnh sửa ca làm việc">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              label="Tên ca làm việc *"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Giờ bắt đầu *"
                type="time"
                step="1"
                value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                required
              />
              <Input
                label="Giờ kết thúc *"
                type="time"
                step="1"
                value={editForm.endTime}
                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                required
              />
            </div>
            <Input
              label="Số phút cho phép đi trễ (0 - 120)"
              type="number"
              min="0"
              max="120"
              value={editForm.gracePeriodMinutes}
              onChange={(e) => setEditForm({ ...editForm, gracePeriodMinutes: Number(e.target.value) })}
            />

            <div className="space-y-1">
              <Input
                label="Áp dụng giờ mới từ ngày *"
                type="date"
                min={toISODate(addDays(new Date(), 1))}
                value={editForm.effectiveFrom}
                onChange={(e) => setEditForm({ ...editForm, effectiveFrom: e.target.value })}
                required
              />
              <p className="text-xs text-slate-500">
                Lưu ý: Giờ mới chỉ cập nhật cho các lịch phân ca từ ngày này trở đi để bảo toàn lịch sử chấm công đã qua.
              </p>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Kích hoạt ca làm việc (cho phép phân ca mới)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" isLoading={isUpdating}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Xóa / Ngừng sử dụng ca */}
        <Modal isOpen={isDeleteShiftOpen} onClose={() => setIsDeleteShiftOpen(false)} title="Xóa hoặc Ngừng sử dụng ca">
          {deletingShift && (
            <form onSubmit={handleDeleteShiftSubmit} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  Xác nhận xử lý ca: {deletingShift.name} ({deletingShift.shiftCode})
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Nếu ca chưa từng được phân cho nhân viên nào, hệ thống sẽ <strong>xóa hoàn toàn</strong>. Nếu ca đã có dữ liệu phân ca hoặc chấm
                  công trong quá khứ, ca sẽ được chuyển sang trạng thái <strong>Ngừng sử dụng</strong> để bảo toàn lịch sử.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Ca thay thế (nếu còn lịch tương lai từ ngày mai)
                </label>
                <select
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={replaceShiftId}
                  onChange={(e) => setReplaceShiftId(e.target.value)}
                >
                  <option value="">-- Không chọn (chỉ xóa nếu không có lịch tương lai) --</option>
                  {shifts
                    .filter((s) => s.id !== deletingShift.id && s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)})
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500">
                  Nếu ca đang có lịch làm việc trong tương lai, nhân viên sẽ tự động được chuyển sang ca thay thế này và nhận thông báo.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsDeleteShiftOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="destructive" isLoading={isDeletingShift}>
                  Xác nhận xử lý
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Modal: Phân ca đơn lẻ */}
        <Modal
          isOpen={isAssignOpen}
          onClose={() => {
            setIsAssignOpen(false);
            setOverwriteWarning(null);
          }}
          title="Phân ca làm việc cho nhân viên"
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Chọn nhân viên *</label>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={assignForm.userId}
                onChange={(e) => {
                  setAssignForm({ ...assignForm, userId: e.target.value });
                  setOverwriteWarning(null);
                }}
                required
              >
                <option value="">-- Chọn nhân viên --</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Chọn ca làm việc *</label>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={assignForm.shiftId}
                onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                required
              >
                <option value="">-- Chọn ca làm việc --</option>
                {activeShiftsForAssign.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Ngày phân ca *"
              type="date"
              value={assignForm.assignedDate}
              onChange={(e) => {
                setAssignForm({ ...assignForm, assignedDate: e.target.value });
                setOverwriteWarning(null);
              }}
              required
            />

            {/* Cảnh báo ghi đè */}
            {overwriteWarning && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsAssignOpen(false);
                  setOverwriteWarning(null);
                }}
              >
                Hủy
              </Button>
              {overwriteWarning ? (
                <Button type="submit" isLoading={isAssigning} className="bg-amber-500 hover:bg-amber-600">
                  Xác nhận thay thế ca
                </Button>
              ) : (
                <Button type="submit" isLoading={isAssigning}>
                  Xác nhận phân ca
                </Button>
              )}
            </div>
          </form>
        </Modal>

        {/* Modal: Phân ca hàng loạt (Bulk Assign) */}
        <Modal
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          title="Phân ca làm việc hàng loạt"
          className="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Chọn Ca */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Ca làm việc áp dụng *</label>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={bulkForm.shiftId}
                onChange={(e) => {
                  setBulkForm({ ...bulkForm, shiftId: e.target.value });
                  setBulkResult(null);
                }}
              >
                <option value="">-- Chọn ca làm việc --</option>
                {activeShiftsForAssign.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)})
                  </option>
                ))}
              </select>
            </div>

            {/* Khoảng ngày */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Từ ngày *"
                type="date"
                value={bulkForm.startDate}
                onChange={(e) => {
                  setBulkForm({ ...bulkForm, startDate: e.target.value });
                  setBulkResult(null);
                }}
              />
              <Input
                label="Đến ngày *"
                type="date"
                value={bulkForm.endDate}
                onChange={(e) => {
                  setBulkForm({ ...bulkForm, endDate: e.target.value });
                  setBulkResult(null);
                }}
              />
            </div>

            {/* Chọn các thứ trong tuần */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Các thứ trong tuần áp dụng *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkForm((p) => ({ ...p, daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] }));
                      setBulkResult(null);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    T2 – T6
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkForm((p) => ({
                        ...p,
                        daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
                      }));
                      setBulkResult(null);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Cả tuần
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAY_OF_WEEK_OPTIONS.map((day) => {
                  const selected = bulkForm.daysOfWeek.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleBulkDay(day.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        selected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {day.fullLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Đối tượng nhân viên */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="text-sm font-medium text-slate-700">Nhân viên áp dụng</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="bulkTargetMode"
                    checked={bulkForm.targetMode === "ALL"}
                    onChange={() => {
                      setBulkForm((p) => ({ ...p, targetMode: "ALL" }));
                      setBulkResult(null);
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Tất cả nhân viên hoạt động ({activeEmployees.length})
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="bulkTargetMode"
                    checked={bulkForm.targetMode === "CUSTOM"}
                    onChange={() => {
                      setBulkForm((p) => ({ ...p, targetMode: "CUSTOM" }));
                      setBulkResult(null);
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Chọn nhân viên cụ thể ({bulkForm.selectedUserIds.length})
                </label>
              </div>

              {/* Danh sách chọn nhân viên nếu CUSTOM */}
              {bulkForm.targetMode === "CUSTOM" && (
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2 mt-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm nhân viên theo tên hoặc mã..."
                        value={bulkForm.searchUser}
                        onChange={(e) => setBulkForm((p) => ({ ...p, searchUser: e.target.value }))}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkForm((p) => ({ ...p, selectedUserIds: activeEmployees.map((e) => e.id) }));
                          setBulkResult(null);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Chọn hết
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBulkForm((p) => ({ ...p, selectedUserIds: [] }));
                          setBulkResult(null);
                        }}
                        className="text-xs font-bold text-slate-500 hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {activeEmployees
                      .filter(
                        (e) =>
                          e.fullName.toLowerCase().includes(bulkForm.searchUser.toLowerCase()) ||
                          e.employeeCode.toLowerCase().includes(bulkForm.searchUser.toLowerCase())
                      )
                      .map((emp) => {
                        const checked = bulkForm.selectedUserIds.includes(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => toggleBulkUser(emp.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                              checked ? "bg-indigo-50 border border-indigo-200" : "bg-white hover:bg-slate-100"
                            }`}
                          >
                            <span className="font-semibold text-slate-800">
                              {emp.fullName} <span className="text-slate-500">({emp.employeeCode})</span>
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Checkbox Ghi đè */}
            <div className="pt-1">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkForm.overwrite}
                  onChange={(e) => {
                    setBulkForm({ ...bulkForm, overwrite: e.target.checked });
                    setBulkResult(null);
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Ghi đè ca khác nếu ngày đó đã có ca phân công
              </label>
            </div>

            {/* Bảng kết quả Preview nếu có */}
            {bulkResult && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-indigo-600" /> Kết quả xem trước
                  </h4>
                  <Badge variant="outline" className="text-xs font-bold bg-white">
                    Tổng: {bulkResult.items.length} lượt
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="font-extrabold text-emerald-700 text-base">{bulkResult.created}</div>
                    <div className="text-emerald-600 font-medium">Tạo mới</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="font-extrabold text-blue-700 text-base">{bulkResult.updated}</div>
                    <div className="text-blue-600 font-medium">Cập nhật</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                    <div className="font-extrabold text-slate-700 text-base">{bulkResult.unchanged}</div>
                    <div className="text-slate-600 font-medium">Không đổi</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="font-extrabold text-amber-700 text-base">{bulkResult.skipped}</div>
                    <div className="text-amber-600 font-medium">Bỏ qua / Lỗi</div>
                  </div>
                </div>

                {bulkResult.skipped > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-amber-700">Chi tiết các lượt bị bỏ qua:</div>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs">
                      {bulkResult.items
                        .filter((i) => i.action === "SKIPPED")
                        .map((item, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-white border border-amber-100 text-slate-600 flex justify-between">
                            <span className="font-semibold text-slate-800">
                              {item.fullName} ({item.date}):
                            </span>
                            <span className="text-amber-700">{item.reason || "Bỏ qua"}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsBulkOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="outline"
                isLoading={isBulkPreviewing}
                onClick={() => executeBulkAssign(true)}
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
              >
                Xem trước
              </Button>
              <Button
                type="button"
                isLoading={isBulkSubmitting}
                onClick={() => executeBulkAssign(false)}
                className="bg-indigo-600 hover:bg-indigo-700 font-bold"
              >
                Xác nhận phân ca
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Sao chép lịch tuần (Copy Week) */}
        <Modal
          isOpen={isCopyWeekOpen}
          onClose={() => setIsCopyWeekOpen(false)}
          title="Sao chép lịch phân ca tuần"
          className="max-w-lg"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900 leading-relaxed">
              Tính năng này cho phép sao chép nguyên vẹn lịch phân ca 7 ngày từ một tuần sang tuần khác (ví dụ: tuần sau hoặc tuần tới).
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Thứ 2 tuần nguồn *"
                type="date"
                value={copyWeekForm.sourceWeekStart}
                onChange={(e) => {
                  setCopyWeekForm({ ...copyWeekForm, sourceWeekStart: e.target.value });
                  setCopyResult(null);
                }}
              />
              <Input
                label="Thứ 2 tuần đích *"
                type="date"
                value={copyWeekForm.targetWeekStart}
                onChange={(e) => {
                  setCopyWeekForm({ ...copyWeekForm, targetWeekStart: e.target.value });
                  setCopyResult(null);
                }}
              />
            </div>

            {/* Đối tượng */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="text-sm font-medium text-slate-700">Nhân viên cần sao chép</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="copyTargetMode"
                    checked={copyWeekForm.targetMode === "ALL"}
                    onChange={() => {
                      setCopyWeekForm((p) => ({ ...p, targetMode: "ALL" }));
                      setCopyResult(null);
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Tất cả nhân viên
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="copyTargetMode"
                    checked={copyWeekForm.targetMode === "CUSTOM"}
                    onChange={() => {
                      setCopyWeekForm((p) => ({ ...p, targetMode: "CUSTOM" }));
                      setCopyResult(null);
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Chỉ định nhân viên ({copyWeekForm.selectedUserIds.length})
                </label>
              </div>

              {copyWeekForm.targetMode === "CUSTOM" && (
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2 mt-2">
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {activeEmployees.map((emp) => {
                      const checked = copyWeekForm.selectedUserIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            const exists = copyWeekForm.selectedUserIds.includes(emp.id);
                            const next = exists
                              ? copyWeekForm.selectedUserIds.filter((id) => id !== emp.id)
                              : [...copyWeekForm.selectedUserIds, emp.id];
                            setCopyWeekForm((p) => ({ ...p, selectedUserIds: next }));
                            setCopyResult(null);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                            checked ? "bg-indigo-50 border border-indigo-200" : "bg-white hover:bg-slate-100"
                          }`}
                        >
                          <span className="font-semibold text-slate-800">
                            {emp.fullName} <span className="text-slate-500">({emp.employeeCode})</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyWeekForm.overwrite}
                  onChange={(e) => {
                    setCopyWeekForm({ ...copyWeekForm, overwrite: e.target.checked });
                    setCopyResult(null);
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Ghi đè nếu tuần đích đã có ca phân công
              </label>
            </div>

            {/* Kết quả preview */}
            {copyResult && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">Kết quả xem trước</div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="font-extrabold text-emerald-700">{copyResult.created}</div>
                    <div className="text-emerald-600">Mới</div>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="font-extrabold text-blue-700">{copyResult.updated}</div>
                    <div className="text-blue-600">Đổi ca</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                    <div className="font-extrabold text-slate-700">{copyResult.unchanged}</div>
                    <div className="text-slate-600">Trùng</div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="font-extrabold text-amber-700">{copyResult.skipped}</div>
                    <div className="text-amber-600">Bỏ qua</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsCopyWeekOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="outline"
                isLoading={isCopyPreviewing}
                onClick={() => executeCopyWeek(true)}
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
              >
                Xem trước
              </Button>
              <Button
                type="button"
                isLoading={isCopySubmitting}
                onClick={() => executeCopyWeek(false)}
                className="bg-indigo-600 hover:bg-indigo-700 font-bold"
              >
                Xác nhận sao chép
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Xác nhận hủy ca của 1 nhân viên trong ngày */}
        <Modal isOpen={!!confirmRemove} onClose={() => setConfirmRemove(null)} title="Xác nhận hủy ca làm việc">
          {confirmRemove && (
            <div className="space-y-4">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Bạn có chắc muốn hủy ca này không?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nhân viên <strong>{confirmRemove.userName}</strong> sẽ bị xóa ca <strong>{confirmRemove.shiftName}</strong> vào ngày{" "}
                    <strong>{confirmRemove.date}</strong>. Nhân viên sẽ nhận được thông báo về việc hủy ca.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
                  Hủy bỏ
                </Button>
                <Button variant="destructive" isLoading={isRemoving} onClick={handleRemoveShift}>
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
