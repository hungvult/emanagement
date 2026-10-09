"use client";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { addDays, toISODate } from "@/lib/shifts-helpers";
import { shiftService } from "@/services/shift.service";
import {
  BulkAssignRequest,
  BulkAssignResult,
  ShiftResponse,
} from "@/types/shift.types";
import { useState } from "react";

export function useBulkAssignment({
  shifts,
  weekStart,
  fetchSchedule,
}: {
  shifts: ShiftResponse[];
  weekStart: Date;
  fetchSchedule: () => Promise<void>;
}) {
  const { error, success } = useToast();

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
      const nextDays = exists
        ? prev.daysOfWeek.filter((d) => d !== key)
        : [...prev.daysOfWeek, key];
      return { ...prev, daysOfWeek: nextDays };
    });
    setBulkResult(null);
  };

  const toggleBulkUser = (userId: number) => {
    setBulkForm((prev) => {
      const exists = prev.selectedUserIds.includes(userId);
      const nextUsers = exists
        ? prev.selectedUserIds.filter((id) => id !== userId)
        : [...prev.selectedUserIds, userId];
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
    if (
      bulkForm.targetMode === "CUSTOM" &&
      bulkForm.selectedUserIds.length === 0
    ) {
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
        userIds:
          bulkForm.targetMode === "CUSTOM"
            ? bulkForm.selectedUserIds
            : undefined,
        overwrite: bulkForm.overwrite,
        dryRun,
      };

      const res = await shiftService.bulkAssign(payload);
      if (res.status === "SUCCESS" && res.data) {
        setBulkResult(res.data);
        if (!dryRun) {
          success(
            `Phân ca hoàn tất: ${res.data.created} tạo mới, ${res.data.updated} cập nhật!`,
          );
          setIsBulkOpen(false);
          fetchSchedule();
        }
      } else {
        error(res.message || "Không thể thực hiện phân ca hàng loạt");
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi phân ca hàng loạt"));
    } finally {
      setIsBulkPreviewing(false);
      setIsBulkSubmitting(false);
    }
  };
  return {
    isBulkOpen,
    setIsBulkOpen,
    bulkForm,
    setBulkForm,
    isBulkPreviewing,
    setIsBulkPreviewing,
    isBulkSubmitting,
    setIsBulkSubmitting,
    bulkResult,
    setBulkResult,
    handleOpenBulk,
    toggleBulkDay,
    toggleBulkUser,
    executeBulkAssign,
  };
}
