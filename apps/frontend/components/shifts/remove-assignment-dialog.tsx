"use client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Trash2 } from "lucide-react";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  "confirmRemove" | "setConfirmRemove" | "isRemoving" | "handleRemoveShift"
>;

export function RemoveAssignmentDialog({
  confirmRemove,
  setConfirmRemove,
  isRemoving,
  handleRemoveShift,
}: Props) {
  return (
    <>
      <Modal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Xác nhận hủy ca làm việc"
      >
        {confirmRemove && (
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Bạn có chắc muốn hủy ca này không?
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Nhân viên <strong>{confirmRemove.userName}</strong> sẽ bị xóa
                  ca <strong>{confirmRemove.shiftName}</strong> vào ngày{" "}
                  <strong>{confirmRemove.date}</strong>. Nhân viên sẽ nhận được
                  thông báo về việc hủy ca.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
                Hủy bỏ
              </Button>
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
    </>
  );
}
