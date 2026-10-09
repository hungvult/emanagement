"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "isCopyWeekOpen"
  | "setIsCopyWeekOpen"
  | "copyWeekForm"
  | "setCopyWeekForm"
  | "setCopyResult"
  | "activeEmployees"
  | "copyResult"
  | "isCopyPreviewing"
  | "executeCopyWeek"
  | "isCopySubmitting"
>;

export function CopyWeekDialog({
  isCopyWeekOpen,
  setIsCopyWeekOpen,
  copyWeekForm,
  setCopyWeekForm,
  setCopyResult,
  activeEmployees,
  copyResult,
  isCopyPreviewing,
  executeCopyWeek,
  isCopySubmitting,
}: Props) {
  return (
    <>
      <Modal
        isOpen={isCopyWeekOpen}
        onClose={() => setIsCopyWeekOpen(false)}
        title="Sao chép lịch phân ca tuần"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900 leading-relaxed">
            Tính năng này cho phép sao chép nguyên vẹn lịch phân ca 7 ngày từ
            một tuần sang tuần khác (ví dụ: tuần sau hoặc tuần tới).
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Thứ 2 tuần nguồn *"
              type="date"
              value={copyWeekForm.sourceWeekStart}
              onChange={(e) => {
                setCopyWeekForm({
                  ...copyWeekForm,
                  sourceWeekStart: e.target.value,
                });
                setCopyResult(null);
              }}
            />
            <Input
              label="Thứ 2 tuần đích *"
              type="date"
              value={copyWeekForm.targetWeekStart}
              onChange={(e) => {
                setCopyWeekForm({
                  ...copyWeekForm,
                  targetWeekStart: e.target.value,
                });
                setCopyResult(null);
              }}
            />
          </div>

          {/* Đối tượng */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="text-sm font-medium text-slate-700">
              Nhân viên cần sao chép
            </label>
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
                    const checked = copyWeekForm.selectedUserIds.includes(
                      emp.id,
                    );
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          const exists = copyWeekForm.selectedUserIds.includes(
                            emp.id,
                          );
                          const next = exists
                            ? copyWeekForm.selectedUserIds.filter(
                                (id) => id !== emp.id,
                              )
                            : [...copyWeekForm.selectedUserIds, emp.id];
                          setCopyWeekForm((p) => ({
                            ...p,
                            selectedUserIds: next,
                          }));
                          setCopyResult(null);
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          checked
                            ? "bg-indigo-50 border border-indigo-200"
                            : "bg-white hover:bg-slate-100"
                        }`}
                      >
                        <span className="font-semibold text-slate-800">
                          {emp.fullName}{" "}
                          <span className="text-slate-500">
                            ({emp.employeeCode})
                          </span>
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
                  setCopyWeekForm({
                    ...copyWeekForm,
                    overwrite: e.target.checked,
                  });
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
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Kết quả xem trước
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="font-extrabold text-emerald-700">
                    {copyResult.created}
                  </div>
                  <div className="text-emerald-600">Mới</div>
                </div>
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="font-extrabold text-blue-700">
                    {copyResult.updated}
                  </div>
                  <div className="text-blue-600">Đổi ca</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                  <div className="font-extrabold text-slate-700">
                    {copyResult.unchanged}
                  </div>
                  <div className="text-slate-600">Trùng</div>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="font-extrabold text-amber-700">
                    {copyResult.skipped}
                  </div>
                  <div className="text-amber-600">Bỏ qua</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCopyWeekOpen(false)}
            >
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
    </>
  );
}
