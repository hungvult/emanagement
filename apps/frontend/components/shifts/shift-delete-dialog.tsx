"use client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AlertTriangle } from "lucide-react";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "isDeleteShiftOpen"
  | "setIsDeleteShiftOpen"
  | "deletingShift"
  | "handleDeleteShiftSubmit"
  | "replaceShiftId"
  | "setReplaceShiftId"
  | "shifts"
  | "isDeletingShift"
>;

export function ShiftDeleteDialog({
  isDeleteShiftOpen,
  setIsDeleteShiftOpen,
  deletingShift,
  handleDeleteShiftSubmit,
  replaceShiftId,
  setReplaceShiftId,
  shifts,
  isDeletingShift,
}: Props) {
  return (
    <>
      <Modal
        isOpen={isDeleteShiftOpen}
        onClose={() => setIsDeleteShiftOpen(false)}
        title="Xóa hoặc Ngừng sử dụng ca"
      >
        {deletingShift && (
          <form onSubmit={handleDeleteShiftSubmit} className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                Xác nhận xử lý ca: {deletingShift.name} (
                {deletingShift.shiftCode})
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Nếu ca chưa từng được phân cho nhân viên nào, hệ thống sẽ{" "}
                <strong>xóa hoàn toàn</strong>. Nếu ca đã có dữ liệu phân ca
                hoặc chấm công trong quá khứ, ca sẽ được chuyển sang trạng thái{" "}
                <strong>Ngừng sử dụng</strong> để bảo toàn lịch sử.
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
                <option value="">
                  -- Không chọn (chỉ xóa nếu không có lịch tương lai) --
                </option>
                {shifts
                  .filter((s) => s.id !== deletingShift.id && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime.slice(0, 5)} –{" "}
                      {s.endTime.slice(0, 5)})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-slate-500">
                Nếu ca đang có lịch làm việc trong tương lai, nhân viên sẽ tự
                động được chuyển sang ca thay thế này và nhận thông báo.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeleteShiftOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="destructive"
                isLoading={isDeletingShift}
              >
                Xác nhận xử lý
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
