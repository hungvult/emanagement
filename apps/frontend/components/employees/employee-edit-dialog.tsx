"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { useEmployees } from "@/hooks/employees/use-employees";

type Props = Pick<
  ReturnType<typeof useEmployees>,
  | "isEditOpen"
  | "setIsEditOpen"
  | "editingEmployee"
  | "handleEditSubmit"
  | "editForm"
  | "setEditForm"
  | "isUpdating"
>;

export function EmployeeEditDialog({
  isEditOpen,
  setIsEditOpen,
  editingEmployee,
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
        title={`Chỉnh sửa: ${editingEmployee?.employeeCode}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-5 px-1 py-2">
          <div className="space-y-4">
            <Input
              label="Họ và tên *"
              value={editForm.fullName}
              onChange={(e) =>
                setEditForm({ ...editForm, fullName: e.target.value })
              }
              required
              className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
            />
            <Input
              label="Số điện thoại"
              value={editForm.phone || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
              className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
            />
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">
                Trạng thái tài khoản
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all shadow-sm"
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    status: e.target.value as "ACTIVE" | "INACTIVE",
                  })
                }
              >
                <option value="ACTIVE">🟢 Đang hoạt động (ACTIVE)</option>
                <option value="INACTIVE">🔴 Vô hiệu hóa (INACTIVE)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              className="rounded-xl font-semibold hover:bg-slate-100"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={isUpdating}
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-6"
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
