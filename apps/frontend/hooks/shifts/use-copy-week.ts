"use client";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { addDays, getMondayOfWeek, toISODate } from "@/lib/shifts-helpers";
import { shiftService } from "@/services/shift.service";
import { BulkAssignResult, CopyWeekRequest } from "@/types/shift.types";
import { useEffect, useState } from "react";

export function useCopyWeek({
  weekStart,
  fetchSchedule,
}: {
  weekStart: Date;
  fetchSchedule: () => Promise<void>;
}) {
  const { error, success } = useToast();

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
    if (
      copyWeekForm.targetMode === "CUSTOM" &&
      copyWeekForm.selectedUserIds.length === 0
    ) {
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
        userIds:
          copyWeekForm.targetMode === "CUSTOM"
            ? copyWeekForm.selectedUserIds
            : undefined,
        overwrite: copyWeekForm.overwrite,
        dryRun,
      };

      const res = await shiftService.copyWeek(payload);
      if (res.status === "SUCCESS" && res.data) {
        setCopyResult(res.data);
        if (!dryRun) {
          success(
            `Sao chép lịch thành công: ${res.data.created} tạo mới, ${res.data.updated} cập nhật!`,
          );
          setIsCopyWeekOpen(false);
          fetchSchedule();
        }
      } else {
        error(res.message || "Không thể sao chép lịch tuần");
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi sao chép lịch tuần"));
    } finally {
      setIsCopyPreviewing(false);
      setIsCopySubmitting(false);
    }
  };

  // Cập nhật tuần nguồn của sao chép khi đổi tuần xem
  useEffect(() => {
    // Keep copy-week defaults aligned with the week selected in the schedule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCopyWeekForm((prev) => ({
      ...prev,
      sourceWeekStart: toISODate(weekStart),
      targetWeekStart: toISODate(addDays(weekStart, 7)),
    }));
  }, [weekStart]);
  return {
    isCopyWeekOpen,
    setIsCopyWeekOpen,
    copyWeekForm,
    setCopyWeekForm,
    isCopyPreviewing,
    setIsCopyPreviewing,
    isCopySubmitting,
    setIsCopySubmitting,
    copyResult,
    setCopyResult,
    handleOpenCopyWeek,
    executeCopyWeek,
  };
}
