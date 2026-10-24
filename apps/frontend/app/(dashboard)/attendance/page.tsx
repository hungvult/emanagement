"use client";
import NextImage from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { useLatestRequest } from "@/hooks/use-latest-request";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  AttendanceFilters,
  attendanceService,
} from "@/services/attendance.service";
import { employeeService } from "@/services/employee.service";
import { shiftService } from "@/services/shift.service";
import {
  AttendanceHistory,
  ManualAttendancePayload,
} from "@/types/attendance.types";
import { EmployeeResponse } from "@/types/employee.types";
import { ShiftResponse } from "@/types/shift.types";
import {
  Clock,
  Download,
  Eye,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

function extractTime(dt?: string | null): string {
  if (!dt) return "";
  const match = dt.match(/[T ](\d{2}:\d{2})/);
  if (match) return match[1];
  return "";
}

function getTodayString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AttendancePage() {
  const beginRequest = useLatestRequest();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");
  const { success, error } = useToast();

  const [records, setRecords] = useState<AttendanceHistory[]>([]);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<AttendanceHistory | null>(null);

  // --- Filter state ---
  const [searchFilter, setSearchFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<AttendanceFilters>({});

  // --- Manual Attendance Modal State (ST5-05) ---
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<AttendanceHistory | null>(null);
  const [manualUserId, setManualUserId] = useState("");
  const [manualShiftId, setManualShiftId] = useState("");
  const [manualWorkDate, setManualWorkDate] = useState("");
  const [manualCheckInTime, setManualCheckInTime] = useState("");
  const [manualCheckOutTime, setManualCheckOutTime] = useState("");
  const [manualStatus, setManualStatus] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Tải danh sách ca làm việc để lọc và chọn
  useEffect(() => {
    shiftService
      .getAll(true)
      .then((res) => {
        if (res && res.data) {
          setShifts(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(
    async (pageNumber: number, filters: AttendanceFilters) => {
      const isCurrent = beginRequest();
      setIsLoading(true);
      try {
        let res;
        if (isAdmin) {
          res = await attendanceService.getAllRecords(pageNumber, 15, filters);
        } else if (user) {
          res = await attendanceService.getMyHistory(
            user.id,
            pageNumber,
            15,
            filters,
          );
        }

        if (!isCurrent()) return;
        if (res && res.status === "SUCCESS" && res.data) {
          setRecords(res.data.content);
          setTotalPages(res.data.totalPages);
          setPage(res.data.pageNumber);
        }
      } catch {
        if (!isCurrent()) return;
        error("Lỗi khi tải dữ liệu chấm công");
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [beginRequest, error, isAdmin, user],
  );

  useEffect(() => {
    if (user) {
      // Synchronize this screen with an external request or camera session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRecords(page, appliedFilters);
    }
  }, [page, user, appliedFilters, fetchRecords]);

  const handleApplyFilters = () => {
    const filters: AttendanceFilters = {};
    if (searchFilter.trim()) filters.search = searchFilter.trim();
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (statusFilter) filters.status = statusFilter;
    if (shiftFilter) filters.shiftId = shiftFilter;
    setAppliedFilters(filters);
    setPage(0);
  };

  const handleResetFilters = () => {
    setSearchFilter("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("");
    setShiftFilter("");
    setAppliedFilters({});
    setPage(0);
  };

  const hasActiveFilter = !!(
    appliedFilters.search ||
    appliedFilters.startDate ||
    appliedFilters.endDate ||
    appliedFilters.status ||
    appliedFilters.shiftId
  );

  // ST5-03: Xuất báo cáo CSV
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const blob = await attendanceService.exportCsv(appliedFilters);
      const url = window.URL.createObjectURL(blob);
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const filename = `bang_cham_cong_${yyyy}${mm}${dd}.csv`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
      success("Đã xuất báo cáo chấm công CSV thành công");
    } catch {
      error("Lỗi khi xuất báo cáo chấm công");
    } finally {
      setIsExporting(false);
    }
  };

  // ST5-05: Mở modal Thêm mới chấm công thủ công
  const handleOpenCreateModal = async () => {
    setEditingRecord(null);
    const todayStr = getTodayString();
    setManualWorkDate(todayStr);
    const firstShiftId = shifts.length > 0 ? String(shifts[0].id) : "";
    setManualShiftId(firstShiftId);
    setManualCheckInTime(
      shifts.length > 0 && shifts[0].startTime
        ? shifts[0].startTime.slice(0, 5)
        : "08:00",
    );
    setManualCheckOutTime(
      shifts.length > 0 && shifts[0].endTime
        ? shifts[0].endTime.slice(0, 5)
        : "",
    );
    setManualStatus("");
    setManualNote("");
    setManualUserId(employees.length > 0 ? String(employees[0].id) : "");
    setIsManualModalOpen(true);

    if (employees.length === 0) {
      setIsLoadingEmployees(true);
      try {
        const res = await employeeService.getAll(0, 200);
        if (res && res.data && res.data.content) {
          setEmployees(res.data.content);
          if (res.data.content.length > 0) {
            setManualUserId(String(res.data.content[0].id));
          }
        }
      } catch {
        error("Lỗi khi tải danh sách nhân viên");
      } finally {
        setIsLoadingEmployees(false);
      }
    }
  };

  // ST5-05: Mở modal Sửa / Giải trình chấm công từ dòng bảng
  const handleOpenEditModal = (rec: AttendanceHistory) => {
    setEditingRecord(rec);
    const wDate =
      rec.workDate ||
      (rec.checkInTime ? rec.checkInTime.slice(0, 10) : "") ||
      getTodayString();
    setManualWorkDate(wDate);
    setManualUserId(String(rec.userId || ""));
    setManualShiftId(
      rec.shiftId
        ? String(rec.shiftId)
        : shifts.length > 0
          ? String(shifts[0].id)
          : "",
    );

    let defaultInTime = "08:00";
    let defaultOutTime = "";
    if (rec.shiftId) {
      const matchShift = shifts.find((s) => s.id === rec.shiftId);
      if (matchShift?.startTime) {
        defaultInTime = matchShift.startTime.slice(0, 5);
      }
      if (matchShift?.endTime) {
        defaultOutTime = matchShift.endTime.slice(0, 5);
      }
    }

    setManualCheckInTime(extractTime(rec.checkInTime) || defaultInTime);
    setManualCheckOutTime(
      extractTime(rec.checkOutTime) ||
        (rec.status === "NO_DATA" || rec.id < 0 ? defaultOutTime : ""),
    );
    setManualStatus(rec.status && rec.status !== "NO_DATA" ? rec.status : "");
    setManualNote(rec.note || "");
    setIsManualModalOpen(true);
  };

  // ST5-05: Xử lý lưu chấm công thủ công
  const handleSaveManualRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord && !manualUserId) {
      error("Vui lòng chọn nhân viên");
      return;
    }
    if (!manualWorkDate) {
      error("Vui lòng chọn ngày làm việc");
      return;
    }
    if (!manualCheckInTime || !manualCheckInTime.trim()) {
      error("Vui lòng nhập giờ vào ca");
      return;
    }

    const inTime = manualCheckInTime.trim();
    const inTimeFormatted =
      inTime.length === 5 ? `${inTime}:00` : inTime;
    const checkInDateTime = `${manualWorkDate}T${inTimeFormatted}`;

    let checkOutDateTime: string | null = null;
    const outTime = manualCheckOutTime.trim();
    if (outTime) {
      const outTimeFormatted =
        outTime.length === 5 ? `${outTime}:00` : outTime;
      if (outTimeFormatted <= inTimeFormatted) {
        error("Thời gian ra ca phải sau thời gian vào ca");
        return;
      }
      checkOutDateTime = `${manualWorkDate}T${outTimeFormatted}`;
    }

    const payload: ManualAttendancePayload = {
      userId: editingRecord
        ? (editingRecord.userId ?? (manualUserId ? Number(manualUserId) : undefined))
        : Number(manualUserId),
      shiftId: manualShiftId ? Number(manualShiftId) : null,
      workDate: manualWorkDate,
      checkInTime: checkInDateTime,
      checkOutTime: checkOutDateTime,
      status: manualStatus || null,
      note: manualNote.trim() || null,
    };

    setIsSubmittingManual(true);
    try {
      if (editingRecord) {
        await attendanceService.updateManualRecord(editingRecord.id, payload);
        success(
          editingRecord.id < 0 || editingRecord.status === "NO_DATA"
            ? "Bổ sung bản ghi chấm công thành công"
            : "Cập nhật bản ghi chấm công thành công",
        );
      } else {
        await attendanceService.createManualRecord(payload);
        success("Thêm mới bản ghi chấm công thành công");
      }
      setIsManualModalOpen(false);
      fetchRecords(page, appliedFilters);
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Lỗi khi lưu bản ghi chấm công";
      error(msg);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 rounded-[32px] border border-indigo-100/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Clock className="h-8 w-8 text-indigo-600" />
            {isAdmin ? "Nhật ký chấm công" : "Lịch sử chấm công của tôi"}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
            {isAdmin
              ? "Xem và quản lý dữ liệu check-in/out của toàn bộ nhân viên."
              : "Theo dõi thời gian làm việc của bạn."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Button
              onClick={handleExportCsv}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 shadow-sm"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Đang xuất..." : "Xuất báo cáo (CSV)"}
            </Button>
            <Button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 h-11 px-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" />
              Chấm công bổ sung
            </Button>
          </div>
        )}
      </div>

      {/* Thanh bộ lọc (ST5-04) */}
      <div className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 flex flex-wrap gap-4 w-full">
          {isAdmin && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                Tìm kiếm nhân viên
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplyFilters();
                    }
                  }}
                  placeholder="Nhập tên hoặc mã nhân viên..."
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Từ ngày
            </label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Đến ngày
            </label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Ca làm việc
            </label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
            >
              <option value="">Tất cả ca</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ON_TIME">Đúng giờ</option>
              <option value="LATE">Đi muộn</option>
              <option value="EARLY_LEAVE">Về sớm</option>
              <option value="NO_DATA">Chưa vào ca</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end w-full md:w-auto h-11">
          <Button
            onClick={handleApplyFilters}
            className="flex items-center justify-center gap-2 h-full px-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 flex-1 md:flex-none"
          >
            <Search className="h-4 w-4" />
            Lọc
          </Button>
          {hasActiveFilter && (
            <Button
              onClick={handleResetFilters}
              variant="outline"
              className="flex items-center justify-center gap-2 h-full px-4 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-slate-200"
              title="Xóa bộ lọc"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Bảng dữ liệu (ST5-07) */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse space-y-4 w-full">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-md" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Nhân viên</TableHead>}
                <TableHead>Ngày làm việc</TableHead>
                <TableHead>Ca làm việc</TableHead>
                <TableHead>Trạm Kiosk</TableHead>
                <TableHead>Thời gian Vào</TableHead>
                <TableHead>Thời gian Ra</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hình ảnh bằng chứng</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Thao tác</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 9 : 7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Không có dữ liệu chấm công
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {record.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {record.employeeCode}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                      {formatDate(
                        record.workDate ||
                          (record.checkInTime
                            ? record.checkInTime.slice(0, 10)
                            : null),
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {record.shiftName || "Ca hành chính"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-slate-600">
                      {record.kioskName || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {record.checkInTime
                        ? formatDateTime(record.checkInTime)
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {record.checkOutTime
                        ? formatDateTime(record.checkOutTime)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.status === "ON_TIME"
                            ? "success"
                            : record.status === "LATE"
                              ? "warning"
                              : record.status === "EARLY_LEAVE"
                                ? "danger"
                                : "secondary"
                        }
                      >
                        {record.status === "ON_TIME"
                          ? "Đúng giờ"
                          : record.status === "LATE"
                            ? "Đi muộn"
                            : record.status === "EARLY_LEAVE"
                              ? "Về sớm"
                              : record.status === "NO_DATA"
                                ? "Chưa vào ca"
                                : record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.snapshotUrl || record.checkoutSnapshotUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecord(record)}
                          className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-1.5 h-8 text-xs font-bold rounded-lg transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Xem ảnh
                          {record.snapshotUrl && record.checkoutSnapshotUrl && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-indigo-100 text-indigo-700 font-extrabold ml-1">
                              2
                            </span>
                          )}
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-sm font-medium">
                          —
                        </span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(record)}
                          className="text-xs font-semibold h-8 px-2.5 rounded-lg border-slate-200 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1.5"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {record.status === "NO_DATA" || record.id < 0
                            ? "Bổ sung công"
                            : "Sửa công"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pagination
            pageNumber={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {/* ST5-05: Modal Thêm mới / Sửa / Bổ sung công thủ công */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title={
          editingRecord
            ? editingRecord.status === "NO_DATA" || editingRecord.id < 0
              ? "Bổ sung chấm công thủ công"
              : "Điều chỉnh / Giải trình chấm công"
            : "Chấm công bổ sung thủ công"
        }
      >
        <form onSubmit={handleSaveManualRecord} className="space-y-4">
          {editingRecord ? (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-sm space-y-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Nhân viên
              </div>
              <div className="font-bold text-slate-900">
                {editingRecord.fullName}{" "}
                <span className="text-slate-500 font-medium">
                  ({editingRecord.employeeCode})
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nhân viên <span className="text-rose-500">*</span>
              </label>
              {isLoadingEmployees ? (
                <div className="text-sm text-slate-400 py-2">
                  Đang tải danh sách nhân viên...
                </div>
              ) : (
                <select
                  value={manualUserId}
                  onChange={(e) => setManualUserId(e.target.value)}
                  required
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ngày làm việc <span className="text-rose-500">*</span>
              </label>
              <DatePicker
                value={manualWorkDate}
                onChange={setManualWorkDate}
                placeholder="dd/mm/yyyy"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ca làm việc
              </label>
              <select
                value={manualShiftId}
                onChange={(e) => {
                  const sId = e.target.value;
                  setManualShiftId(sId);
                  if (sId) {
                    const matchShift = shifts.find((s) => String(s.id) === sId);
                    if (matchShift?.startTime) {
                      setManualCheckInTime(matchShift.startTime.slice(0, 5));
                    }
                    if (matchShift?.endTime) {
                      setManualCheckOutTime(matchShift.endTime.slice(0, 5));
                    }
                  }
                }}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
              >
                <option value="">Tự động theo lịch / Mặc định</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime.slice(0, 5)} -{" "}
                    {s.endTime.slice(0, 5)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Giờ vào ca <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={manualCheckInTime}
                onChange={(e) => setManualCheckInTime(e.target.value)}
                required
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Giờ ra ca (tùy chọn)
              </label>
              <input
                type="time"
                value={manualCheckOutTime}
                onChange={(e) => setManualCheckOutTime(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Trạng thái chấm công
            </label>
            <select
              value={manualStatus}
              onChange={(e) => setManualStatus(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
            >
              <option value="">Tự động theo ca</option>
              <option value="ON_TIME">Đúng giờ (ON_TIME)</option>
              <option value="LATE">Đi muộn (LATE)</option>
              <option value="EARLY_LEAVE">Về sớm (EARLY_LEAVE)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ghi chú / Giải trình
            </label>
            <textarea
              rows={3}
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Nhập lý do điều chỉnh hoặc giải trình chấm công (tối đa 500 ký tự)..."
              maxLength={500}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsManualModalOpen(false)}
              disabled={isSubmittingManual}
              className="rounded-xl font-bold"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmittingManual}
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              {isSubmittingManual ? "Đang lưu..." : "Lưu dữ liệu"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Preview Snapshot đối soát ảnh Vào/Ra ca */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={`Ảnh đối soát chấm công: ${selectedRecord?.fullName || ""} (${selectedRecord?.employeeCode || ""})`}
      >
        {selectedRecord && (
          <div className="flex flex-col space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Khung ảnh vào ca */}
              <div className="flex flex-col space-y-2 rounded-xl border border-border p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Ảnh vào ca (Check-in)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedRecord.checkInTime
                      ? formatDateTime(selectedRecord.checkInTime)
                      : "—"}
                  </span>
                </div>
                <div className="relative aspect-video w-full rounded-lg bg-black/5 dark:bg-black/30 overflow-hidden border border-border flex items-center justify-center">
                  {selectedRecord.snapshotUrl ? (
                    <NextImage
                      unoptimized
                      width={640}
                      height={480}
                      src={selectedRecord.snapshotUrl}
                      alt="Ảnh Check-in"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                      <span className="text-xs">Không có ảnh</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Khung ảnh ra ca */}
              <div className="flex flex-col space-y-2 rounded-xl border border-border p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Ảnh ra ca (Check-out)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedRecord.checkOutTime
                      ? formatDateTime(selectedRecord.checkOutTime)
                      : "Chưa chấm công ra"}
                  </span>
                </div>
                <div className="relative aspect-video w-full rounded-lg bg-black/5 dark:bg-black/30 overflow-hidden border border-border flex items-center justify-center">
                  {selectedRecord.checkoutSnapshotUrl ? (
                    <NextImage
                      unoptimized
                      width={640}
                      height={480}
                      src={selectedRecord.checkoutSnapshotUrl}
                      alt="Ảnh Check-out"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                      <span className="text-xs">
                        {selectedRecord.checkOutTime
                          ? "Không có ảnh"
                          : "Chưa hoàn thành ca"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Ca:{" "}
                <strong className="text-foreground">
                  {selectedRecord.shiftName || "Ca hành chính"}
                </strong>{" "}
                | Trạm:{" "}
                <strong className="text-foreground">
                  {selectedRecord.kioskName}
                </strong>{" "}
                | Trạng thái:{" "}
                <strong
                  className={
                    selectedRecord.status === "ON_TIME"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : selectedRecord.status === "LATE"
                        ? "text-amber-500"
                        : selectedRecord.status === "EARLY_LEAVE"
                          ? "text-rose-500"
                          : "text-slate-500"
                  }
                >
                  {selectedRecord.status === "ON_TIME"
                    ? "Đúng giờ"
                    : selectedRecord.status === "LATE"
                      ? "Đi muộn"
                      : selectedRecord.status === "EARLY_LEAVE"
                        ? "Về sớm"
                        : selectedRecord.status === "NO_DATA"
                          ? "Chưa vào ca"
                          : selectedRecord.status}
                </strong>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRecord(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
