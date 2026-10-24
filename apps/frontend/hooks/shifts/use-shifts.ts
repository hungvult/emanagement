"use client";
import { useToast } from "@/components/ui/toast";
import { useBulkAssignment } from "@/hooks/shifts/use-bulk-assignment";
import { useCopyWeek } from "@/hooks/shifts/use-copy-week";
import { useShiftCatalog } from "@/hooks/shifts/use-shift-catalog";
import { useLatestRequest } from "@/hooks/use-latest-request";
import { getErrorMessage } from "@/lib/errors";
import {
  addDays,
  getMondayOfWeek,
  SHIFT_COLORS,
  toISODate,
} from "@/lib/shifts-helpers";
import { employeeService } from "@/services/employee.service";
import { shiftService } from "@/services/shift.service";
import { EmployeeResponse } from "@/types/employee.types";
import {
  AssignShift,
  EmployeeShiftResponse,
  ShiftResponse,
} from "@/types/shift.types";
import React, { useCallback, useEffect, useMemo, useState } from "react";

export function useShifts() {
  const beginScheduleRequest = useLatestRequest();
  const beginShiftsRequest = useLatestRequest();
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [schedule, setSchedule] = useState<EmployeeShiftResponse[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const { error, success } = useToast();

  // Phân trang & tìm kiếm cho Lịch phân ca tuần
  const [schedulePage, setSchedulePage] = useState(0);
  const schedulePageSize = 20;
  const [serverScheduleTotalPages, setServerScheduleTotalPages] = useState(0);
  const [serverScheduleTotalElements, setServerScheduleTotalElements] =
    useState(0);
  const [scheduleKeyword, setScheduleKeyword] = useState("");
  const [debouncedScheduleKeyword, setDebouncedScheduleKeyword] = useState("");
  const [pagedEmployees, setPagedEmployees] = useState<EmployeeResponse[]>([]);

  const handleScheduleKeywordChange = useCallback((val: string) => {
    setScheduleKeyword(val);
    if (!val) {
      setDebouncedScheduleKeyword("");
      setSchedulePage(0);
    }
  }, []);

  useEffect(() => {
    if (!scheduleKeyword) return;
    const timer = setTimeout(() => {
      setDebouncedScheduleKeyword(scheduleKeyword);
      setSchedulePage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [scheduleKeyword]);

  // Tuần hiện tại
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getMondayOfWeek(new Date()),
  );
  const handleSetWeekStart = useCallback(
    (updaterOrDate: Date | ((prev: Date) => Date)) => {
      setWeekStart(updaterOrDate);
      setSchedulePage(0);
    },
    [],
  );
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Modal Phân ca đơn lẻ
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{
    userId: string;
    shiftId: string;
    assignedDate: string;
  }>({
    userId: "",
    shiftId: "",
    assignedDate: toISODate(new Date()),
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [overwriteWarning, setOverwriteWarning] = useState<{
    existingShiftName: string;
  } | null>(null);

  // Xác nhận hủy ca phân công
  const [confirmRemove, setConfirmRemove] = useState<{
    userId: number;
    userName: string;
    shiftName: string;
    date: string;
  } | null>(null);
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
  }, [includeInactive, beginShiftsRequest, error]);

  const fetchSchedule = useCallback(async () => {
    const isCurrent = beginScheduleRequest();
    setIsLoadingSchedule(true);
    try {
      const start = toISODate(weekStart);
      const end = toISODate(addDays(weekStart, 6));
      if (typeof shiftService.getSchedulePaged === "function") {
        const res = await shiftService.getSchedulePaged(
          start,
          end,
          schedulePage,
          schedulePageSize,
          debouncedScheduleKeyword,
        );
        if (!isCurrent()) return;
        if (res.status === "SUCCESS" && res.data) {
          const empPage = res.data.employees;
          setPagedEmployees(empPage?.content || []);
          setSchedule(res.data.assignments || []);
          setServerScheduleTotalPages(empPage?.totalPages || 0);
          setServerScheduleTotalElements(
            empPage?.totalElement ?? empPage?.totalElements ?? 0,
          );
          if (
            schedulePage > 0 &&
            empPage &&
            schedulePage >= empPage.totalPages
          ) {
            setSchedulePage(0);
          }
        } else {
          setPagedEmployees([]);
          setSchedule([]);
          setServerScheduleTotalPages(0);
          setServerScheduleTotalElements(0);
        }
      } else {
        const res = await shiftService.getSchedule(start, end);
        if (!isCurrent()) return;
        if (res.status === "SUCCESS" && res.data) {
          setSchedule(res.data);
        } else {
          setSchedule([]);
        }
      }
    } catch {
      if (!isCurrent()) return;
      setPagedEmployees([]);
      setSchedule([]);
      setServerScheduleTotalPages(0);
      setServerScheduleTotalElements(0);
    } finally {
      if (isCurrent()) setIsLoadingSchedule(false);
    }
  }, [weekStart, schedulePage, debouncedScheduleKeyword, beginScheduleRequest]);

  const {
    isCreateOpen,
    setIsCreateOpen,
    createForm,
    setCreateForm,
    isCreating,
    isEditOpen,
    setIsEditOpen,
    editForm,
    setEditForm,
    isUpdating,
    isDeleteShiftOpen,
    setIsDeleteShiftOpen,
    deletingShift,
    replaceShiftId,
    setReplaceShiftId,
    isDeletingShift,
    handleCreateSubmit,
    handleOpenEdit,
    handleEditSubmit,
    handleOpenDelete,
    handleDeleteShiftSubmit,
  } = useShiftCatalog({ fetchShifts, fetchSchedule });
  const {
    isBulkOpen,
    setIsBulkOpen,
    bulkForm,
    setBulkForm,
    isBulkPreviewing,
    isBulkSubmitting,
    bulkResult,
    setBulkResult,
    handleOpenBulk,
    toggleBulkDay,
    toggleBulkUser,
    executeBulkAssign,
  } = useBulkAssignment({ shifts, weekStart, fetchSchedule });
  const {
    isCopyWeekOpen,
    setIsCopyWeekOpen,
    copyWeekForm,
    setCopyWeekForm,
    isCopyPreviewing,
    isCopySubmitting,
    copyResult,
    setCopyResult,
    handleOpenCopyWeek,
    executeCopyWeek,
  } = useCopyWeek({ weekStart, fetchSchedule });

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
  }, [error]);

  useEffect(() => {
    // Synchronize the shift catalog with its active-status filter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchShifts();
  }, [fetchShifts]);

  useEffect(() => {
    // Synchronize the displayed week with the remote schedule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSchedule();
  }, [fetchSchedule]);

  // ── Handlers: Phân ca đơn lẻ ───────────────────────────────────────────────

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.userId || !assignForm.shiftId || !assignForm.assignedDate) {
      error("Vui lòng chọn đầy đủ nhân viên, ca và ngày");
      return;
    }

    const existingEntry = scheduleMap.get(
      `${assignForm.userId}_${assignForm.assignedDate}`,
    );
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
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi phân ca"));
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveShift = async () => {
    if (!confirmRemove) return;
    setIsRemoving(true);
    try {
      const res = await shiftService.removeAssignedShift(
        confirmRemove.userId,
        confirmRemove.date,
      );
      if (res.status === "SUCCESS") {
        success(
          `Đã hủy ca của ${confirmRemove.userName} vào ngày ${confirmRemove.date}!`,
        );
        setConfirmRemove(null);
        fetchSchedule();
      } else {
        error(res.message || "Không thể hủy ca làm việc");
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi hủy ca làm việc"));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCellClick = (emp: EmployeeResponse, date: Date) => {
    setAssignForm({
      userId: String(emp.id),
      shiftId: "",
      assignedDate: toISODate(date),
    });
    setIsAssignOpen(true);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activeEmployees = useMemo(() => {
    const map = new Map<number, EmployeeResponse>();
    for (const emp of employees) {
      if (emp.status === "ACTIVE") {
        map.set(emp.id, emp);
      }
    }
    for (const emp of pagedEmployees) {
      if (emp.status === "ACTIVE") {
        map.set(emp.id, emp);
      }
    }
    if (assignForm.userId) {
      const selectedId = Number(assignForm.userId);
      const selected =
        pagedEmployees.find((e) => e.id === selectedId) ||
        employees.find((e) => e.id === selectedId);
      if (selected && !map.has(selected.id)) {
        map.set(selected.id, selected);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    );
  }, [employees, pagedEmployees, assignForm.userId]);

  const displayEmployees = useMemo(() => {
    if (typeof shiftService.getSchedulePaged === "function") {
      return pagedEmployees;
    }
    // Fallback cho môi trường test mock cũ chỉ có getSchedule
    let list = employees;
    if (debouncedScheduleKeyword.trim()) {
      const kw = debouncedScheduleKeyword.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.fullName?.toLowerCase().includes(kw) ||
          e.employeeCode?.toLowerCase().includes(kw),
      );
    }
    const assignedUserIds = new Set(schedule.map((s) => s.userId));
    const sorted = [...list].sort((a, b) => {
      const hasA = assignedUserIds.has(a.id);
      const hasB = assignedUserIds.has(b.id);
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
    return sorted;
  }, [pagedEmployees, employees, schedule, debouncedScheduleKeyword]);

  const scheduleTotalElements =
    typeof shiftService.getSchedulePaged === "function"
      ? serverScheduleTotalElements
      : displayEmployees.length;
  const scheduleTotalPages =
    typeof shiftService.getSchedulePaged === "function"
      ? serverScheduleTotalPages
      : Math.ceil(displayEmployees.length / schedulePageSize) || 0;

  const scheduleMap = new Map<string, EmployeeShiftResponse>(
    schedule.map((assignment) => [
      `${assignment.userId}_${assignment.assignedDate}`,
      assignment,
    ]),
  );

  const shiftColorMap = useMemo(() => {
    const map = new Map<number, (typeof SHIFT_COLORS)[0]>();
    shifts.forEach((s, i) =>
      map.set(s.id, SHIFT_COLORS[i % SHIFT_COLORS.length]),
    );
    return map;
  }, [shifts]);

  const today = toISODate(new Date());

  const weekLabel = `${weekDays[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${weekDays[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

  const activeShiftsForAssign = shifts.filter((s) => s.active);
  return {
    handleOpenCopyWeek,
    handleOpenBulk,
    setIsAssignOpen,
    setIsCreateOpen,
    shifts,
    includeInactive,
    setIncludeInactive,
    handleOpenEdit,
    handleOpenDelete,
    weekLabel,
    setWeekStart: handleSetWeekStart,
    weekDays,
    today,
    isLoadingSchedule,
    displayEmployees,
    pagedEmployees,
    scheduleKeyword,
    debouncedScheduleKeyword,
    handleScheduleKeywordChange,
    schedulePage,
    setSchedulePage,
    schedulePageSize,
    scheduleTotalPages,
    scheduleTotalElements,
    scheduleMap,
    shiftColorMap,
    handleCellClick,
    setConfirmRemove,
    isCreateOpen,
    handleCreateSubmit,
    createForm,
    setCreateForm,
    isCreating,
    isEditOpen,
    setIsEditOpen,
    handleEditSubmit,
    editForm,
    setEditForm,
    isUpdating,
    isDeleteShiftOpen,
    setIsDeleteShiftOpen,
    deletingShift,
    handleDeleteShiftSubmit,
    replaceShiftId,
    setReplaceShiftId,
    isDeletingShift,
    isAssignOpen,
    setOverwriteWarning,
    handleAssignSubmit,
    assignForm,
    setAssignForm,
    activeEmployees,
    activeShiftsForAssign,
    overwriteWarning,
    isAssigning,
    isBulkOpen,
    setIsBulkOpen,
    bulkForm,
    setBulkForm,
    setBulkResult,
    toggleBulkDay,
    toggleBulkUser,
    bulkResult,
    isBulkPreviewing,
    executeBulkAssign,
    isBulkSubmitting,
    isCopyWeekOpen,
    setIsCopyWeekOpen,
    copyWeekForm,
    setCopyWeekForm,
    setCopyResult,
    copyResult,
    isCopyPreviewing,
    executeCopyWeek,
    isCopySubmitting,
    confirmRemove,
    isRemoving,
    handleRemoveShift,
  };
}
