"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { useEmployees } from "@/hooks/employees/use-employees";
import { Sparkles } from "lucide-react";

type Props = Pick<
  ReturnType<typeof useEmployees>,
  | "isCreateOpen"
  | "setIsCreateOpen"
  | "handleCreateSubmit"
  | "createForm"
  | "setCreateForm"
  | "isCreating"
>;

export function EmployeeCreateDialog({
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
        title="Thêm nhân viên mới"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5 px-1 py-2">
          <div className="space-y-4">
            <Input
              label="Họ và tên *"
              placeholder="VD: Nguyễn Văn A"
              value={createForm.fullName}
              onChange={(e) =>
                setCreateForm({ ...createForm, fullName: e.target.value })
              }
              required
              className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
            />
            <Input
              label="Email (Tùy chọn)"
              type="email"
              placeholder="VD: nhanvien@congty.com"
              value={createForm.email || ""}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
            />
            <Input
              label="Số điện thoại (Tùy chọn)"
              placeholder="VD: 0912345678"
              value={createForm.phone || ""}
              onChange={(e) =>
                setCreateForm({ ...createForm, phone: e.target.value })
              }
              className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
            />
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Mã nhân viên sẽ được hệ thống tự động sinh theo chuẩn EMP26XXXX.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl font-semibold hover:bg-slate-100"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={isCreating}
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-6"
            >
              Tạo nhân viên
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
