"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "isAssignOpen"
  | "setIsAssignOpen"
  | "setOverwriteWarning"
  | "handleAssignSubmit"
  | "assignForm"
  | "setAssignForm"
  | "activeEmployees"
  | "activeShiftsForAssign"
  | "overwriteWarning"
  | "isAssigning"
>;

export function AssignShiftDialog({
  isAssignOpen,
  setIsAssignOpen,
  setOverwriteWarning,
  handleAssignSubmit,
  assignForm,
  setAssignForm,
  activeEmployees,
  activeShiftsForAssign,
  overwriteWarning,
  isAssigning,
}: Props) {
  return (
    <>
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
            <label className="text-sm font-medium text-foreground">
              Chọn nhân viên *
            </label>
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
            <label className="text-sm font-medium text-foreground">
              Chọn ca làm việc *
            </label>
            <select
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={assignForm.shiftId}
              onChange={(e) =>
                setAssignForm({ ...assignForm, shiftId: e.target.value })
              }
              required
            >
              <option value="">-- Chọn ca làm việc --</option>
              {activeShiftsForAssign.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.startTime.slice(0, 5)} –{" "}
                  {shift.endTime.slice(0, 5)})
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
              <span className="text-amber-500 text-lg leading-none mt-0.5">
                ⚠
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Nhân viên đã có ca trong ngày này
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  Ca hiện tại:{" "}
                  <strong>{overwriteWarning.existingShiftName}</strong>. Xác
                  nhận để thay thế bằng ca mới.
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
              <Button
                type="submit"
                isLoading={isAssigning}
                className="bg-amber-500 hover:bg-amber-600"
              >
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
    </>
  );
}
