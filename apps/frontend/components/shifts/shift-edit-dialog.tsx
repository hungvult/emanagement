"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { addDays, toISODate } from "@/lib/shifts-helpers";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "isEditOpen"
  | "setIsEditOpen"
  | "handleEditSubmit"
  | "editForm"
  | "setEditForm"
  | "isUpdating"
>;

export function ShiftEditDialog({
  isEditOpen,
  setIsEditOpen,
  handleEditSubmit,
  editForm,
  setEditForm,
  isUpdating,
}: Props) {
  return (
    <>
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Chỉnh sửa ca làm việc"
      >
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
              onChange={(e) =>
                setEditForm({ ...editForm, startTime: e.target.value })
              }
              required
            />
            <Input
              label="Giờ kết thúc *"
              type="time"
              step="1"
              value={editForm.endTime}
              onChange={(e) =>
                setEditForm({ ...editForm, endTime: e.target.value })
              }
              required
            />
          </div>
          <Input
            label="Số phút cho phép đi trễ (0 - 120)"
            type="number"
            min="0"
            max="120"
            value={editForm.gracePeriodMinutes}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                gracePeriodMinutes: Number(e.target.value),
              })
            }
          />

          <div className="space-y-1">
            <Input
              label="Áp dụng giờ mới từ ngày *"
              type="date"
              min={toISODate(addDays(new Date(), 1))}
              value={editForm.effectiveFrom}
              onChange={(e) =>
                setEditForm({ ...editForm, effectiveFrom: e.target.value })
              }
              required
            />
            <p className="text-xs text-slate-500">
              Lưu ý: Giờ mới chỉ cập nhật cho các lịch phân ca từ ngày này trở
              đi để bảo toàn lịch sử chấm công đã qua.
            </p>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) =>
                  setEditForm({ ...editForm, active: e.target.checked })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Kích hoạt ca làm việc (cho phép phân ca mới)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isUpdating}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
