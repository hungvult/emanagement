"use client";

import { useLatestRequest } from "../../../hooks/use-latest-request";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { attendanceService, AttendanceFilters } from "../../../services/attendance.service";
import { shiftService } from "../../../services/shift.service";
import { AttendanceHistory } from "../../../types/attendance.types";
import { ShiftResponse } from "../../../types/shift.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { Pagination } from "../../../components/ui/pagination";
import { useToast } from "../../../components/ui/toast";
import { formatDateTime } from "../../../lib/utils";
import { Image as ImageIcon, Eye, Search, X, Clock, CalendarDays } from "lucide-react";
import { DatePicker } from "../../../components/ui/date-picker";

function formatDateVi(dateStr?: string | null) {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export default function AttendancePage() {
  const beginRequest = useLatestRequest();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");

  const [records, setRecords] = useState<AttendanceHistory[]>([]);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceHistory | null>(null);
  const { error } = useToast();

  // --- Filter state (những gì đang nhập) ---
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  // Applied filters (chỉ cập nhật khi bấm "Lọc")
  const [appliedFilters, setAppliedFilters] = useState<AttendanceFilters>({});

  // Tải danh sách ca làm việc để lọc
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

  const fetchRecords = async (pageNumber: number, filters: AttendanceFilters) => {
    const isCurrent = beginRequest();
    setIsLoading(true);
    try {
      let res;
      if (isAdmin) {
        res = await attendanceService.getAllRecords(pageNumber, 15, filters);
      } else if (user) {
        res = await attendanceService.getMyHistory(user.id, pageNumber, 15, filters);
      }

      if (!isCurrent()) return;
      if (res && res.status === "SUCCESS" && res.data) {
        setRecords(res.data.content);
        setTotalPages(res.data.totalPages);
        setPage(res.data.pageNumber);
      }
    } catch (err: any) {
      if (!isCurrent()) return;
      error("Lỗi khi tải dữ liệu chấm công");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRecords(page, appliedFilters);
    }
  }, [page, user, isAdmin, appliedFilters]);

  const handleApplyFilters = () => {
    const filters: AttendanceFilters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (statusFilter) filters.status = statusFilter;
    if (shiftFilter) filters.shiftId = shiftFilter;
    setAppliedFilters(filters);
    setPage(0);
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("");
    setShiftFilter("");
    setAppliedFilters({});
    setPage(0);
  };

  const hasActiveFilter = !!(
    appliedFilters.startDate ||
    appliedFilters.endDate ||
    appliedFilters.status ||
    appliedFilters.shiftId
  );

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
      </div>

      {/* Thanh bộ lọc */}
      <div className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 flex flex-wrap gap-4 w-full">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Từ ngày</label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Đến ngày</label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Ca làm việc</label>
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-full"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ON_TIME">Đúng giờ</option>
              <option value="LATE">Đi muộn</option>
              <option value="EARLY_LEAVE">Về sớm</option>
              <option value="NO_DATA">Không có dữ liệu</option>
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

      {/* Bảng dữ liệu */}
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
                <TableHead>Ca làm việc</TableHead>
                <TableHead>Trạm Kiosk</TableHead>
                <TableHead>Thời gian Vào</TableHead>
                <TableHead>Thời gian Ra</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hình ảnh bằng chứng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu chấm công
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="font-medium text-foreground">{record.fullName}</div>
                        <div className="text-xs text-muted-foreground">{record.employeeCode}</div>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {record.shiftName || "Ca hành chính"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-slate-600">{record.kioskName || "—"}</TableCell>
                    <TableCell>
                      {record.checkInTime ? (
                        formatDateTime(record.checkInTime)
                      ) : record.workDate ? (
                        <span className="text-slate-500 text-xs font-medium">
                          {formatDateVi(record.workDate)} <span className="text-slate-400 italic">(Chưa vào ca)</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{record.checkOutTime ? formatDateTime(record.checkOutTime) : "—"}</TableCell>
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
                          ? "Không có dữ liệu"
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
                        <span className="text-slate-400 text-sm font-medium">—</span>
                      )}
                    </TableCell>
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
                    {selectedRecord.checkInTime ? formatDateTime(selectedRecord.checkInTime) : "—"}
                  </span>
                </div>
                <div className="relative aspect-video w-full rounded-lg bg-black/5 dark:bg-black/30 overflow-hidden border border-border flex items-center justify-center">
                  {selectedRecord.snapshotUrl ? (
                    <img
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
                    <img
                      src={selectedRecord.checkoutSnapshotUrl}
                      alt="Ảnh Check-out"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                      <span className="text-xs">
                        {selectedRecord.checkOutTime ? "Không có ảnh" : "Chưa hoàn thành ca"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Ca: <strong className="text-foreground">{selectedRecord.shiftName || "Ca hành chính"}</strong> | Trạm: <strong className="text-foreground">{selectedRecord.kioskName}</strong> | Trạng
                thái:{" "}
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
                    ? "Không có dữ liệu"
                    : selectedRecord.status}
                </strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setSelectedRecord(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
