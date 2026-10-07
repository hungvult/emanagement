"use client";
import { InfoRow } from "@/components/employees/employees-presentation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { useEmployees } from "@/hooks/employees/use-employees";
import { formatDateTime } from "@/lib/utils";
import {
  Calendar,
  Check,
  Edit,
  Mail,
  Phone,
  ScanFace,
  Shield,
  User,
} from "lucide-react";

type Props = Pick<
  ReturnType<typeof useEmployees>,
  | "isDetailOpen"
  | "setIsDetailOpen"
  | "detailEmployee"
  | "openFaceModal"
  | "handleOpenEdit"
>;

export function EmployeeDetailDialog({
  isDetailOpen,
  setIsDetailOpen,
  detailEmployee,
  openFaceModal,
  handleOpenEdit,
}: Props) {
  return (
    <>
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Thông tin chi tiết"
        className="max-w-2xl"
      >
        {detailEmployee && (
          <div className="space-y-4">
            {/* Header Profile */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100/50 rounded-2xl shadow-sm">
              <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-xl shrink-0 shadow-inner">
                {detailEmployee.fullName?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold text-slate-900 truncate">
                  {detailEmployee.fullName}
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  {detailEmployee.employeeCode}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {detailEmployee.status === "ACTIVE" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>{" "}
                      ACTIVE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>{" "}
                      INACTIVE
                    </span>
                  )}
                  {detailEmployee.roles.includes("ROLE_ADMIN") && (
                    <span className="inline-flex items-center rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-inset ring-rose-500/20">
                      ADMIN
                    </span>
                  )}
                  {detailEmployee.hasRegisteredFace && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                      <Check className="h-2.5 w-2.5" /> Face ID
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info grid rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <InfoRow
                icon={<User className="h-3.5 w-3.5" />}
                label="Họ và tên"
                value={detailEmployee.fullName}
              />
              <InfoRow
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Mã nhân viên"
                value={detailEmployee.employeeCode}
              />
              <InfoRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Email"
                value={detailEmployee.email || "Chưa cập nhật"}
              />
              <InfoRow
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Số điện thoại"
                value={detailEmployee.phone || "Chưa cập nhật"}
              />
              <InfoRow
                icon={<ScanFace className="h-3.5 w-3.5" />}
                label="Face ID"
                value={
                  detailEmployee.hasRegisteredFace
                    ? "Đã đăng ký"
                    : "Chưa đăng ký"
                }
                valueClassName={
                  detailEmployee.hasRegisteredFace
                    ? "text-emerald-600 font-bold"
                    : "text-amber-500 font-medium"
                }
              />
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Ngày tạo tài khoản"
                value={formatDateTime(detailEmployee.createdAt)}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              {detailEmployee.hasRegisteredFace && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailOpen(false);
                    openFaceModal(detailEmployee);
                  }}
                  className="flex items-center gap-2 rounded-xl text-indigo-600 font-bold border-indigo-200 bg-indigo-50 hover:bg-indigo-100 shadow-sm"
                >
                  <ScanFace className="h-4 w-4" /> Xem ảnh khuôn mặt
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailOpen(false);
                  handleOpenEdit(detailEmployee);
                }}
                className="flex items-center gap-2 rounded-xl font-bold bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
              >
                <Edit className="h-4 w-4" /> Chỉnh sửa hồ sơ
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
