"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "isCreateOpen"
  | "setIsCreateOpen"
  | "handleCreateSubmit"
  | "createForm"
  | "setCreateForm"
  | "isCreating"
>;

export function ShiftCreateDialog({
  isCreateOpen,
  setIsCreateOpen,
  handleCreateSubmit,
  createForm,
  setCreateForm,
  isCreating,
}: Props) {
  return (
    <>
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo ca làm việc mới"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Tên ca làm việc *"
            placeholder="VD: Ca Hành Chính, Ca Sáng, Ca Chiều"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm({ ...createForm, name: e.target.value })
            }
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Giờ bắt đầu *"
              type="time"
              step="1"
              value={createForm.startTime}
              onChange={(e) =>
                setCreateForm({ ...createForm, startTime: e.target.value })
              }
              required
            />
            <Input
              label="Giờ kết thúc *"
              type="time"
              step="1"
              value={createForm.endTime}
              onChange={(e) =>
                setCreateForm({ ...createForm, endTime: e.target.value })
              }
              required
            />
          </div>
          <Input
            label="Số phút cho phép đi trễ (0 - 120)"
            type="number"
            min="0"
            max="120"
            value={createForm.gracePeriodMinutes}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                gracePeriodMinutes: Number(e.target.value),
              })
            }
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Tạo ca làm việc
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
