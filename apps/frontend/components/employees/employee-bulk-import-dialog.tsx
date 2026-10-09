"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  FileArchive,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { employeeService } from "@/services/employee.service";
import { BulkImportJob, BulkImportStatus } from "@/types/employee.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EmployeeBulkImportDialog({ isOpen, onClose, onSuccess }: Props) {
  const { error, success } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJob, setCurrentJob] = useState<BulkImportJob | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Kiểm tra job đang chạy dở dang khi mở Modal (Reconnect on F5/mount)
  const checkActiveJob = useCallback(async () => {
    try {
      const res = await employeeService.getActiveBulkImportJob();
      if (res.data) {
        setCurrentJob(res.data);
      }
    } catch (err) {
      // Ignored
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkActiveJob();
    } else {
      // Reset khi đóng nếu job đã kết thúc
      if (currentJob?.status === "COMPLETED" || currentJob?.status === "FAILED") {
        setCurrentJob(null);
        setSelectedFile(null);
      }
    }
  }, [isOpen, checkActiveJob, currentJob?.status]);

  // Polling tiến độ theo thời gian thực (1.5 giây / lần)
  useEffect(() => {
    if (!currentJob) return;

    const isActive =
      currentJob.status === "PENDING" ||
      currentJob.status === "VALIDATING" ||
      currentJob.status === "PROCESSING";

    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await employeeService.getBulkImportJob(currentJob.id);
        if (res.data) {
          setCurrentJob(res.data);
          if (res.data.status === "COMPLETED") {
            success(
              `Hoàn tất nhập dữ liệu! Thành công ${res.data.successCount}/${res.data.totalRecords} nhân viên.`,
            );
            onSuccess();
          } else if (res.data.status === "FAILED") {
            error("Tiến trình nhập dữ liệu hàng loạt thất bại.");
          }
        }
      } catch (err) {
        console.error("Lỗi cập nhật tiến trình:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentJob, error, success, onSuccess]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      error("Chỉ chấp nhận tệp định dạng .zip");
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      error("Dung lượng tệp ZIP không được vượt quá 150MB");
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      error("Vui lòng chọn tệp ZIP trước khi tải lên.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await employeeService.submitBulkImport(selectedFile);
      if (res.data) {
        setCurrentJob(res.data);
        success("Đã tải lên tệp ZIP. Đang xử lý bóc tách và trích xuất AI...");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể bắt đầu tiến trình nhập hàng loạt";
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await employeeService.downloadBulkImportTemplate();
      success("Đã tải tệp mẫu CSV thành công.");
    } catch (err) {
      error("Không thể tải tệp mẫu CSV.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const isJobActive =
    currentJob &&
    (currentJob.status === "PENDING" ||
      currentJob.status === "VALIDATING" ||
      currentJob.status === "PROCESSING");

  const getStatusBadge = (status: BulkImportStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="h-3 w-3 animate-spin" /> Đang chờ hàng đợi
          </span>
        );
      case "VALIDATING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="h-3 w-3 animate-spin" /> Đang giải nén & kiểm tra
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Loader2 className="h-3 w-3 animate-spin" /> Đang trích xuất AI & nạp DB
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Hoàn tất thành công
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" /> Thất bại
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isJobActive ? () => {} : onClose}
      title="Nhập nhân viên hàng loạt (Bulk Import)"
      className="max-w-2xl"
    >
      <div className="space-y-6 py-2">
        {/* Hướng dẫn và Nút tải template */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
              <Archive className="h-4 w-4 text-indigo-600" />
              Quy chuẩn tệp nén ZIP
            </h4>
            <p className="text-xs text-indigo-700 leading-relaxed max-w-md">
              Tệp ZIP chứa file <b>CSV</b> danh sách nhân viên và thư mục ảnh chân dung (VD: <code>val/1.jpg</code>).
              Hỗ trợ cả bộ dữ liệu FairFace 10,000 ảnh.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="shrink-0 bg-white hover:bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold gap-1.5 rounded-xl shadow-xs"
          >
            {isDownloadingTemplate ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Tải mẫu CSV
          </Button>
        </div>

        {/* Khung tải file nếu chưa có job hoặc job đã xong và người dùng muốn nạp mới */}
        {(!currentJob || currentJob.status === "COMPLETED" || currentJob.status === "FAILED") && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50/40"
                  : selectedFile
                    ? "border-emerald-400 bg-emerald-50/30"
                    : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex flex-col items-center justify-center gap-3">
                <div
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                    selectedFile
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  {selectedFile ? (
                    <FileArchive className="h-6 w-6" />
                  ) : (
                    <UploadCloud className="h-6 w-6" />
                  )}
                </div>

                {selectedFile ? (
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Dung lượng: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <p className="text-xs text-indigo-600 font-medium mt-2">
                      Nhấp để chọn tệp khác
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Kéo thả tệp ZIP vào đây, hoặc <span className="text-indigo-600 underline">duyệt tệp</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Giới hạn tối đa 150MB. Tự động kiểm tra chất lượng & trích xuất 128D AI.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-xl font-semibold"
              >
                Đóng
              </Button>
              <Button
                type="button"
                disabled={!selectedFile || isSubmitting}
                onClick={handleSubmit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lên...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" /> Bắt đầu nạp hàng loạt
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Khung hiển thị tiến độ thời gian thực (Live Progress Tracker) */}
        {currentJob && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {currentJob.fileName}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kích thước: {(currentJob.fileSize / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              {getStatusBadge(currentJob.status)}
            </div>

            {/* Thanh tiến trình Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Tiến độ xử lý</span>
                <span>{currentJob.progressPercentage}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    currentJob.status === "COMPLETED"
                      ? "bg-emerald-500"
                      : currentJob.status === "FAILED"
                        ? "bg-rose-500"
                        : "bg-indigo-600"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, currentJob.progressPercentage))}%` }}
                />
              </div>
            </div>

            {/* 4 Thẻ chỉ số Counter Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[11px] font-bold text-slate-500">Tổng cộng</p>
                <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {currentJob.totalRecords}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-center">
                <p className="text-[11px] font-bold text-blue-600">Đã xử lý</p>
                <p className="text-lg font-extrabold text-blue-900 mt-0.5">
                  {currentJob.processedRecords}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-center">
                <p className="text-[11px] font-bold text-emerald-600">Thành công</p>
                <p className="text-lg font-extrabold text-emerald-900 mt-0.5">
                  {currentJob.successCount}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100 text-center">
                <p className="text-[11px] font-bold text-rose-600">Từ chối / Lỗi</p>
                <p className="text-lg font-extrabold text-rose-900 mt-0.5">
                  {currentJob.failedCount}
                </p>
              </div>
            </div>

            {/* Nhật ký lỗi nếu có */}
            {currentJob.errorLog && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  Chi tiết lỗi từ chối chất lượng / định dạng:
                </p>
                <div className="max-h-36 overflow-y-auto p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {currentJob.errorLog}
                </div>
              </div>
            )}

            {/* Nút hành động khi hoàn tất hoặc thất bại */}
            {!isJobActive && (
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentJob(null);
                    setSelectedFile(null);
                  }}
                  className="rounded-xl font-semibold"
                >
                  Nhập tệp khác
                </Button>
                <Button
                  type="button"
                  onClick={onClose}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
                >
                  Đóng
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
