"use client";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { addDays, toISODate } from "@/lib/shifts-helpers";
import { shiftService } from "@/services/shift.service";
import { ShiftCreate, ShiftResponse, ShiftUpdate } from "@/types/shift.types";
import React, { useState } from "react";

export function useShiftCatalog({
  fetchShifts,
  fetchSchedule,
}: {
  fetchShifts: () => Promise<void>;
  fetchSchedule: () => Promise<void>;
}) {
  const { error, success } = useToast();

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

  const [deletingShift, setDeletingShift] = useState<ShiftResponse | null>(
    null,
  );

  const [replaceShiftId, setReplaceShiftId] = useState<string>("");

  const [isDeletingShift, setIsDeletingShift] = useState(false);

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
        startTime:
          createForm.startTime.length === 5
            ? `${createForm.startTime}:00`
            : createForm.startTime,
        endTime:
          createForm.endTime.length === 5
            ? `${createForm.endTime}:00`
            : createForm.endTime,
        gracePeriodMinutes: Number(createForm.gracePeriodMinutes) || 0,
      };
      const res = await shiftService.create(payload);
      if (res.status === "SUCCESS") {
        success("Tạo mới ca làm việc thành công!");
        setIsCreateOpen(false);
        setCreateForm({
          name: "",
          startTime: "08:00:00",
          endTime: "17:30:00",
          gracePeriodMinutes: 15,
        });
        fetchShifts();
      } else {
        error(res.message || "Không thể tạo ca làm việc");
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi tạo ca làm việc"));
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
        startTime:
          editForm.startTime.length === 5
            ? `${editForm.startTime}:00`
            : editForm.startTime,
        endTime:
          editForm.endTime.length === 5
            ? `${editForm.endTime}:00`
            : editForm.endTime,
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
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi cập nhật ca làm việc"));
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
        success(
          action === "DELETED"
            ? "Đã xóa ca làm việc thành công!"
            : "Đã chuyển ca sang trạng thái Ngừng sử dụng!",
        );
        setIsDeleteShiftOpen(false);
        setDeletingShift(null);
        fetchShifts();
        fetchSchedule();
      } else {
        error(res.message || "Không thể xóa ca làm việc");
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi xóa ca làm việc"));
    } finally {
      setIsDeletingShift(false);
    }
  };
  return {
    isCreateOpen,
    setIsCreateOpen,
    createForm,
    setCreateForm,
    isCreating,
    setIsCreating,
    isEditOpen,
    setIsEditOpen,
    editingShift,
    setEditingShift,
    editForm,
    setEditForm,
    isUpdating,
    setIsUpdating,
    isDeleteShiftOpen,
    setIsDeleteShiftOpen,
    deletingShift,
    setDeletingShift,
    replaceShiftId,
    setReplaceShiftId,
    isDeletingShift,
    setIsDeletingShift,
    handleCreateSubmit,
    handleOpenEdit,
    handleEditSubmit,
    handleOpenDelete,
    handleDeleteShiftSubmit,
  };
}
