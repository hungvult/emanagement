"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DAY_OF_WEEK_OPTIONS } from "@/lib/shifts-helpers";
import { Info, Search } from "lucide-react";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "isBulkOpen"
  | "setIsBulkOpen"
  | "bulkForm"
  | "setBulkForm"
  | "setBulkResult"
  | "activeShiftsForAssign"
  | "toggleBulkDay"
  | "activeEmployees"
  | "toggleBulkUser"
  | "bulkResult"
  | "isBulkPreviewing"
  | "executeBulkAssign"
  | "isBulkSubmitting"
>;

export function BulkAssignDialog({
  isBulkOpen,
  setIsBulkOpen,
  bulkForm,
  setBulkForm,
  setBulkResult,
  activeShiftsForAssign,
  toggleBulkDay,
  activeEmployees,
  toggleBulkUser,
  bulkResult,
  isBulkPreviewing,
  executeBulkAssign,
  isBulkSubmitting,
}: Props) {
  return (
    <>
      <Modal
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        title="Phân ca làm việc hàng loạt"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Chọn Ca */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Ca làm việc áp dụng *
            </label>
            <select
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={bulkForm.shiftId}
              onChange={(e) => {
                setBulkForm({ ...bulkForm, shiftId: e.target.value });
                setBulkResult(null);
              }}
            >
              <option value="">-- Chọn ca làm việc --</option>
              {activeShiftsForAssign.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>

          {/* Khoảng ngày */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Từ ngày *"
              type="date"
              value={bulkForm.startDate}
              onChange={(e) => {
                setBulkForm({ ...bulkForm, startDate: e.target.value });
                setBulkResult(null);
              }}
            />
            <Input
              label="Đến ngày *"
              type="date"
              value={bulkForm.endDate}
              onChange={(e) => {
                setBulkForm({ ...bulkForm, endDate: e.target.value });
                setBulkResult(null);
              }}
            />
          </div>

          {/* Chọn các thứ trong tuần */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Các thứ trong tuần áp dụng *
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkForm((p) => ({
                      ...p,
                      daysOfWeek: [
                        "MONDAY",
                        "TUESDAY",
                        "WEDNESDAY",
                        "THURSDAY",
                        "FRIDAY",
                      ],
                    }));
                    setBulkResult(null);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  T2 – T6
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setBulkForm((p) => ({
                      ...p,
                      daysOfWeek: [
                        "MONDAY",
                        "TUESDAY",
                        "WEDNESDAY",
                        "THURSDAY",
                        "FRIDAY",
                        "SATURDAY",
                        "SUNDAY",
                      ],
                    }));
                    setBulkResult(null);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Cả tuần
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAY_OF_WEEK_OPTIONS.map((day) => {
                const selected = bulkForm.daysOfWeek.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleBulkDay(day.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {day.fullLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Đối tượng nhân viên */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="text-sm font-medium text-slate-700">
              Nhân viên áp dụng
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="bulkTargetMode"
                  checked={bulkForm.targetMode === "ALL"}
                  onChange={() => {
                    setBulkForm((p) => ({ ...p, targetMode: "ALL" }));
                    setBulkResult(null);
                  }}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Tất cả nhân viên hoạt động ({activeEmployees.length})
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="bulkTargetMode"
                  checked={bulkForm.targetMode === "CUSTOM"}
                  onChange={() => {
                    setBulkForm((p) => ({ ...p, targetMode: "CUSTOM" }));
                    setBulkResult(null);
                  }}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Chọn nhân viên cụ thể ({bulkForm.selectedUserIds.length})
              </label>
            </div>

            {/* Danh sách chọn nhân viên nếu CUSTOM */}
            {bulkForm.targetMode === "CUSTOM" && (
              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2 mt-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm nhân viên theo tên hoặc mã..."
                      value={bulkForm.searchUser}
                      onChange={(e) =>
                        setBulkForm((p) => ({
                          ...p,
                          searchUser: e.target.value,
                        }))
                      }
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBulkForm((p) => ({
                          ...p,
                          selectedUserIds: activeEmployees.map((e) => e.id),
                        }));
                        setBulkResult(null);
                      }}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Chọn hết
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkForm((p) => ({ ...p, selectedUserIds: [] }));
                        setBulkResult(null);
                      }}
                      className="text-xs font-bold text-slate-500 hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {activeEmployees
                    .filter(
                      (e) =>
                        e.fullName
                          .toLowerCase()
                          .includes(bulkForm.searchUser.toLowerCase()) ||
                        e.employeeCode
                          .toLowerCase()
                          .includes(bulkForm.searchUser.toLowerCase()),
                    )
                    .map((emp) => {
                      const checked = bulkForm.selectedUserIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleBulkUser(emp.id)}
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

          {/* Checkbox Ghi đè */}
          <div className="pt-1">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkForm.overwrite}
                onChange={(e) => {
                  setBulkForm({ ...bulkForm, overwrite: e.target.checked });
                  setBulkResult(null);
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Ghi đè ca khác nếu ngày đó đã có ca phân công
            </label>
          </div>

          {/* Bảng kết quả Preview nếu có */}
          {bulkResult && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-indigo-600" /> Kết quả xem trước
                </h4>
                <Badge variant="outline" className="text-xs font-bold bg-white">
                  Tổng: {bulkResult.items.length} lượt
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="font-extrabold text-emerald-700 text-base">
                    {bulkResult.created}
                  </div>
                  <div className="text-emerald-600 font-medium">Tạo mới</div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="font-extrabold text-blue-700 text-base">
                    {bulkResult.updated}
                  </div>
                  <div className="text-blue-600 font-medium">Cập nhật</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <div className="font-extrabold text-slate-700 text-base">
                    {bulkResult.unchanged}
                  </div>
                  <div className="text-slate-600 font-medium">Không đổi</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="font-extrabold text-amber-700 text-base">
                    {bulkResult.skipped}
                  </div>
                  <div className="text-amber-600 font-medium">Bỏ qua / Lỗi</div>
                </div>
              </div>

              {bulkResult.skipped > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-amber-700">
                    Chi tiết các lượt bị bỏ qua:
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs">
                    {bulkResult.items
                      .filter((i) => i.action === "SKIPPED")
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-white border border-amber-100 text-slate-600 flex justify-between"
                        >
                          <span className="font-semibold text-slate-800">
                            {item.fullName} ({item.date}):
                          </span>
                          <span className="text-amber-700">
                            {item.reason || "Bỏ qua"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsBulkOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              variant="outline"
              isLoading={isBulkPreviewing}
              onClick={() => executeBulkAssign(true)}
              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
            >
              Xem trước
            </Button>
            <Button
              type="button"
              isLoading={isBulkSubmitting}
              onClick={() => executeBulkAssign(false)}
              className="bg-indigo-600 hover:bg-indigo-700 font-bold"
            >
              Xác nhận phân ca
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
