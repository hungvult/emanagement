"use client";
import { FaceImageCard } from "@/components/employees/employees-presentation";
import { Modal } from "@/components/ui/modal";
import type { useEmployees } from "@/hooks/employees/use-employees";
import { formatDateTime } from "@/lib/utils";
import { Loader2, ScanFace } from "lucide-react";

type Props = Pick<
  ReturnType<typeof useEmployees>,
  "isFaceModalOpen" | "setIsFaceModalOpen" | "isFaceLoading" | "faceImages"
>;

export function EmployeeFacesDialog({
  isFaceModalOpen,
  setIsFaceModalOpen,
  isFaceLoading,
  faceImages,
}: Props) {
  return (
    <>
      <Modal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        title={`Dữ liệu khuôn mặt eKYC`}
        className="max-w-3xl"
      >
        {isFaceLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <p className="text-sm font-semibold text-slate-500">
              Đang tải dữ liệu nhận diện...
            </p>
          </div>
        ) : faceImages ? (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-sm font-medium text-slate-500">
                Nhân viên:{" "}
                <span className="font-bold text-slate-900">
                  {faceImages.fullName}
                </span>{" "}
                ({faceImages.employeeCode})
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> — </span>
                Đăng ký lúc:{" "}
                <span className="font-bold text-slate-900">
                  {formatDateTime(faceImages.registeredAt)}
                </span>
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <FaceImageCard
                label="Chính diện"
                url={faceImages.frontImageUrl}
              />
              <FaceImageCard label="Nháy mắt" url={faceImages.blinkImageUrl} />
              <FaceImageCard label="Quay trái" url={faceImages.leftImageUrl} />
              <FaceImageCard label="Quay phải" url={faceImages.rightImageUrl} />
              <FaceImageCard label="Ngửa lên" url={faceImages.upImageUrl} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
              <ScanFace className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-center font-semibold text-slate-500">
              Không tìm thấy dữ liệu ảnh khuôn mặt.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
