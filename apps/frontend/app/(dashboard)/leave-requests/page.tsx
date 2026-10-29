"use client";
import { getErrorMessage } from "@/lib/errors";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { employeeService } from "@/services/employee.service";
import { leaveService } from "@/services/leave.service";
import { Employee } from "@/types/employee.types";
import { LeaveRequestCreate, LeaveRequestResponse } from "@/types/leave.types";
import { CalendarRange, Check, Eye, Plus, RotateCcw, Search, X } from "lucide-react";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const getTodayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getTomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getInDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function LeaveRequestsPage() {
  return <Suspense fallback={<p>Đang tải đơn nghỉ phép…</p>}><LeaveRequestsContent /></Suspense>;
}

function LeaveRequestsContent() {
  const params = useSearchParams();
  const requestId = params.get("requestId");
  const beginRequest = useLatestRequest();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");

  const [requests, setRequests] = useState<LeaveRequestResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const { error, success } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Detail Modal State (ST5-01 / Issue 2)
  const [detailRequest, setDetailRequest] = useState<LeaveRequestResponse | null>(null);
  useEffect(() => {
    if (!user?.id || !requestId || !/^\d+$/.test(requestId)) return;
    let active = true;
    void leaveService.getById(Number(requestId)).then(response => {
      if (active && response.data) setDetailRequest(response.data);
    }).catch(err => { if (active) error(getErrorMessage(err, "Không thể mở đơn nghỉ phép")); });
    return () => { active = false; };
  }, [requestId, user?.id, error]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    startDate: string;
    endDate: string;
    reason: string;
  }>({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ST5-06 / Issue 3: Admin tạo đơn phép với async debounce search nhân viên
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [empSearchKeyword, setEmpSearchKeyword] = useState("");
  const [isSearchingEmp, setIsSearchingEmp] = useState(false);
  const [selectedEmployeeObj, setSelectedEmployeeObj] = useState<Employee | null>(null);

  // Review / Approval Modal State (ST5-01)
  const [reviewModalState, setReviewModalState] = useState<{
    isOpen: boolean;
    request: LeaveRequestResponse | null;
    status: "APPROVED" | "REJECTED";
  }>({
    isOpen: false,
    request: null,
    status: "APPROVED",
  });
  const [reviewNote, setReviewNote] = useState("");
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

  const fetchRequests = useCallback(
    async (pageNumber: number) => {
      const isCurrent = beginRequest();
      setIsLoading(true);
      try {
        if (isAdmin) {
          const res = await leaveService.getAll(pageNumber, 15, {
            status: statusFilter || undefined,
            keyword: debouncedKeyword.trim() || undefined,
            startDate: fromDate || undefined,
            endDate: toDate || undefined,
          });
          if (!isCurrent()) return;
          if (res.status === "SUCCESS" && res.data) {
            setRequests(res.data.content || []);
            setTotalPages(res.data.totalPages || 1);
            setPage(res.data.pageNumber || 0);
          }
        } else if (user) {
          const res = await leaveService.getMyRequests(user.id);
          if (!isCurrent()) return;
          if (res.status === "SUCCESS" && res.data) {
            let list = res.data || [];
            if (statusFilter) {
              list = list.filter((r) => r.status === statusFilter);
            }
            if (fromDate) {
              list = list.filter((r) => r.endDate >= fromDate);
            }
            if (toDate) {
              list = list.filter((r) => r.startDate <= toDate);
            }
            if (debouncedKeyword.trim()) {
              const kw = debouncedKeyword.trim().toLowerCase();
              list = list.filter(
                (r) =>
                  r.reason?.toLowerCase().includes(kw) ||
                  r.fullName?.toLowerCase().includes(kw) ||
                  r.employeeCode?.toLowerCase().includes(kw),
              );
            }
            setRequests(list);
            setTotalPages(1);
          }
        }
      } catch {
        if (!isCurrent()) return;
        error("Lỗi khi tải danh sách đơn phép");
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [beginRequest, error, isAdmin, user, statusFilter, debouncedKeyword, fromDate, toDate],
  );

  useEffect(() => {
    // Synchronize this screen with an external request or camera session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) fetchRequests(page);
  }, [page, user, fetchRequests]);

  useEffect(() => {
    if (!isCreateOpen || !isAdmin) return;
    const timer = setTimeout(async () => {
      setIsSearchingEmp(true);
      try {
        const res = await employeeService.getAll(0, 50, {
          keyword: empSearchKeyword.trim() || undefined,
        });
        if (res.status === "SUCCESS" && res.data?.content) {
          setEmployees(res.data.content);
        }
      } catch {
        // ignore error
      } finally {
        setIsSearchingEmp(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isCreateOpen, isAdmin, empSearchKeyword]);

  const handleOpenCreateModal = () => {
    const todayStr = getTodayISO();
    setSelectedUserId(user?.id ?? "");
    setSelectedEmployeeObj(null);
    setEmpSearchKeyword("");
    setCreateForm({ startDate: todayStr, endDate: todayStr, reason: "" });
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!createForm.startDate || !createForm.endDate) {
      error("Vui lòng chọn ngày bắt đầu và kết thúc");
      return;
    }
    if (createForm.startDate > createForm.endDate) {
      error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }
    if (!createForm.reason || createForm.reason.trim().length < 5) {
      error("Lý do xin nghỉ phép phải từ 5 ký tự trở lên");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetUserId =
        isAdmin && selectedUserId !== "" ? Number(selectedUserId) : user.id;
      const payload: LeaveRequestCreate = {
        userId: targetUserId,
        startDate: createForm.startDate,
        endDate: createForm.endDate,
        reason: createForm.reason.trim(),
      };

      const res = await leaveService.create(payload);
      if (res.status === "SUCCESS") {
        success("Đã gửi đơn xin nghỉ phép thành công!");
        setIsCreateOpen(false);
        const todayStr = getTodayISO();
        setCreateForm({ startDate: todayStr, endDate: todayStr, reason: "" });
        setSelectedUserId(user?.id ?? "");
        fetchRequests(0);
      } else {
        error(getErrorMessage(res, "Không thể gửi đơn nghỉ phép"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi gửi đơn xin nghỉ phép"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewModal = (
    request: LeaveRequestResponse,
    status: "APPROVED" | "REJECTED",
  ) => {
    setReviewModalState({
      isOpen: true,
      request,
      status,
    });
    setReviewNote("");
  };

  const closeReviewModal = () => {
    if (isReviewSubmitting) return;
    setReviewModalState((prev) => ({ ...prev, isOpen: false }));
    setReviewNote("");
  };

  const handleConfirmReview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !reviewModalState.request || isReviewSubmitting) return;

    if (
      reviewModalState.status === "REJECTED" &&
      reviewNote.trim().length < 3
    ) {
      error("Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự)");
      return;
    }

    setIsReviewSubmitting(true);
    try {
      const res = await leaveService.approve(reviewModalState.request.id, {
        approvedByUserId: user.id,
        status: reviewModalState.status,
        reviewNote: reviewNote.trim() || undefined,
      });
      if (res.status === "SUCCESS") {
        success(
          reviewModalState.status === "APPROVED"
            ? "Đã duyệt đơn nghỉ phép"
            : "Đã từ chối đơn nghỉ phép",
        );
        setReviewModalState((prev) => ({ ...prev, isOpen: false }));
        setReviewNote("");
        fetchRequests(page);
      } else {
        error(getErrorMessage(res, "Không thể xử lý đơn"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi xử lý đơn phép"));
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 rounded-[32px] border border-indigo-100/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <CalendarRange className="h-8 w-8 text-indigo-600" />
            {isAdmin ? "Quản lý đơn phép" : "Đơn phép của tôi"}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
            {isAdmin
              ? "Xét duyệt đơn xin nghỉ phép của nhân viên."
              : "Tạo và theo dõi đơn xin nghỉ phép."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 h-11 px-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
          >
            <Plus className="h-4 w-4" /> Tạo đơn mới
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search keyword input */}
          <div className="relative md:col-span-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                isAdmin
                  ? "Tìm kiếm tên nhân viên, mã NV, lý do..."
                  : "Tìm kiếm theo lý do nghỉ..."
              }
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setPage(0);
              }}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Status select */}
          <div className="md:col-span-3">
            <select
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </div>

          {/* Date range */}
          <div className="md:col-span-4 flex items-center gap-2">
            <div className="flex-1">
              <input
                type="date"
                title="Từ ngày"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(0);
                }}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
            <span className="text-slate-400 text-xs font-bold">–</span>
            <div className="flex-1">
              <input
                type="date"
                title="Đến ngày"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(0);
                }}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {(searchKeyword || statusFilter || fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchKeyword("");
                  setStatusFilter("");
                  setFromDate("");
                  setToDate("");
                  setPage(0);
                }}
                className="h-10 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 shrink-0"
                title="Xóa bộ lọc"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Đặt lại</span>
              </Button>
            )}
          </div>
        </div>
      </div>

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
                <TableHead>Ngày bắt đầu</TableHead>
                <TableHead>Ngày kết thúc</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Người duyệt</TableHead>
                <TableHead>Thời gian gửi</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 8 : 7}
                    className="text-center py-10 text-muted-foreground"
                  >
                    <CalendarRange className="h-10 w-10 mx-auto mb-2 opacity-20 text-indigo-600" />
                    <p className="font-semibold text-slate-600">
                      {searchKeyword || statusFilter || fromDate || toDate
                        ? "Không tìm thấy đơn nghỉ phép nào phù hợp với bộ lọc."
                        : "Không có dữ liệu đơn phép."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {req.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {req.employeeCode}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {formatDate(req.startDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDate(req.endDate)}
                    </TableCell>
                    <TableCell
                      className="max-w-[200px] truncate"
                      title={req.reason}
                    >
                      {req.reason}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          req.status === "APPROVED"
                            ? "success"
                            : req.status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {req.status === "APPROVED"
                          ? "Đã duyệt"
                          : req.status === "REJECTED"
                            ? "Từ chối"
                            : "Chờ duyệt"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {req.approvedByName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTime(req.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1 text-xs font-semibold rounded-lg"
                          onClick={() => setDetailRequest(req)}
                          title="Xem chi tiết đơn"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Chi tiết
                        </Button>
                        {isAdmin && (
                          req.status === "PENDING" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-success hover:bg-success/10 hover:text-success"
                                onClick={() => openReviewModal(req, "APPROVED")}
                                title="Duyệt"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-danger hover:bg-danger/10 hover:text-danger"
                                onClick={() => openReviewModal(req, "REJECTED")}
                                title="Từ chối"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground ml-1">
                              Đã xử lý
                            </span>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {isAdmin && totalPages > 1 && (
            <Pagination
              pageNumber={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Modal Tạo đơn xin nghỉ phép */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo đơn xin nghỉ phép"
        className="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          {isAdmin && user && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                Nhân viên xin nghỉ <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Tìm nhân viên theo tên hoặc mã NV..."
                  value={empSearchKeyword}
                  onChange={(e) => setEmpSearchKeyword(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <select
                  className="w-full h-11 rounded-xl border border-transparent bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all"
                  value={selectedUserId}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : "";
                    setSelectedUserId(val);
                    const found = employees.find((emp) => emp.id === val);
                    if (found) setSelectedEmployeeObj(found);
                  }}
                  required
                >
                  <option value={user.id}>
                    {`Bản thân (${user.fullName} - ${user.employeeCode || "Admin"})`}
                  </option>
                  {selectedEmployeeObj &&
                    selectedEmployeeObj.id !== user.id &&
                    !employees.some((e) => e.id === selectedEmployeeObj.id) && (
                      <option value={selectedEmployeeObj.id}>
                        {`${selectedEmployeeObj.fullName} (${selectedEmployeeObj.employeeCode || "—"})`}
                      </option>
                    )}
                  {employees
                    .filter(
                      (emp) =>
                        emp.id !== user.id &&
                        (!selectedEmployeeObj || emp.id !== selectedEmployeeObj.id),
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {`${emp.fullName} (${emp.employeeCode || "—"})`}
                      </option>
                    ))}
                </select>
                {isSearchingEmp && (
                  <p className="text-[11px] text-slate-400 italic ml-1">
                    Đang tìm kiếm nhân viên...
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Quick Date Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Chọn nhanh ngày nghỉ
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const todayStr = getTodayISO();
                  setCreateForm((prev) => ({
                    ...prev,
                    startDate: todayStr,
                    endDate: todayStr,
                  }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  createForm.startDate === getTodayISO() &&
                  createForm.endDate === getTodayISO()
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                ⚡ Hôm nay (Nghỉ ốm / đột xuất)
              </button>
              <button
                type="button"
                onClick={() => {
                  const tomorrowStr = getTomorrowISO();
                  setCreateForm((prev) => ({
                    ...prev,
                    startDate: tomorrowStr,
                    endDate: tomorrowStr,
                  }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  createForm.startDate === getTomorrowISO() &&
                  createForm.endDate === getTomorrowISO()
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Ngày mai
              </button>
              <button
                type="button"
                onClick={() => {
                  const todayStr = getTodayISO();
                  const endStr = getInDaysISO(2);
                  setCreateForm((prev) => ({
                    ...prev,
                    startDate: todayStr,
                    endDate: endStr,
                  }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  createForm.startDate === getTodayISO() &&
                  createForm.endDate === getInDaysISO(2)
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                3 ngày tới
              </button>
            </div>
            <p className="text-[11px] text-indigo-600 font-medium ml-1">
              💡 Hỗ trợ nộp đơn nghỉ phép ngay trong hôm nay (dành cho trường hợp ốm đau hoặc việc đột xuất).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                Từ ngày <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={createForm.startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setCreateForm((prev) => ({
                    ...prev,
                    startDate: val,
                    endDate: !prev.endDate || prev.endDate < val ? val : prev.endDate,
                  }));
                }}
                className="w-full h-11 rounded-xl border border-transparent bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                Đến ngày <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={createForm.endDate}
                min={createForm.startDate || undefined}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full h-11 rounded-xl border border-transparent bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Lý do xin nghỉ <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all min-h-[120px] resize-none"
              placeholder="VD: Nghỉ phép cá nhân giải quyết việc gia đình..."
              value={createForm.reason}
              onChange={(e) =>
                setCreateForm({ ...createForm, reason: e.target.value })
              }
              required
            />
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
              isLoading={isSubmitting}
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-6"
            >
              Gửi đơn
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal xác nhận Duyệt / Từ chối đơn nghỉ phép (ST5-01) */}
      <Modal
        isOpen={reviewModalState.isOpen}
        onClose={closeReviewModal}
        title={
          reviewModalState.status === "APPROVED"
            ? "Xác nhận duyệt đơn nghỉ phép"
            : "Xác nhận từ chối đơn nghỉ phép"
        }
        className="max-w-md"
      >
        {reviewModalState.request && (
          <form onSubmit={handleConfirmReview} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Nhân viên:</span>
                <span className="font-semibold text-slate-900">
                  {reviewModalState.request.fullName || "—"} -{" "}
                  {reviewModalState.request.employeeCode || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Khoảng ngày nghỉ:</span>
                <span className="font-semibold text-slate-900">
                  {formatDate(reviewModalState.request.startDate)} –{" "}
                  {formatDate(reviewModalState.request.endDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block mb-1">
                  Lý do xin nghỉ:
                </span>
                <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/60 text-sm whitespace-pre-wrap">
                  {reviewModalState.request.reason || "—"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                {reviewModalState.status === "APPROVED" ? (
                  "Ghi chú phản hồi (khuyến nghị)"
                ) : (
                  <>
                    Lý do từ chối <span className="text-rose-500">*</span>
                  </>
                )}
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all min-h-[90px] resize-none"
                placeholder={
                  reviewModalState.status === "APPROVED"
                    ? "Nhập ghi chú phản hồi cho nhân viên (nếu có)..."
                    : "Nhập lý do từ chối đơn phép (bắt buộc, tối thiểu 3 ký tự)..."
                }
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                disabled={isReviewSubmitting}
              />
              {reviewModalState.status === "REJECTED" && (
                <p className="text-xs text-slate-400 ml-1">
                  Bắt buộc nhập tối thiểu 3 ký tự để tránh thao tác nhầm.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={closeReviewModal}
                disabled={isReviewSubmitting}
                className="rounded-xl font-semibold hover:bg-slate-100"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                isLoading={isReviewSubmitting}
                disabled={isReviewSubmitting}
                className={`rounded-xl font-bold px-5 ${
                  reviewModalState.status === "APPROVED"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20"
                }`}
              >
                {reviewModalState.status === "APPROVED"
                  ? "Xác nhận duyệt"
                  : "Xác nhận từ chối"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal chi tiết đơn xin nghỉ phép */}
      <Modal
        isOpen={Boolean(detailRequest)}
        onClose={() => setDetailRequest(null)}
        title="Chi tiết đơn xin nghỉ phép"
        className="max-w-md"
      >
        {detailRequest && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nhân viên:</span>
                <span className="font-semibold text-slate-900">
                  {detailRequest.fullName || "—"} ({detailRequest.employeeCode || "—"})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Thời gian nghỉ:</span>
                <span className="font-semibold text-slate-900">
                  {formatDate(detailRequest.startDate)} – {formatDate(detailRequest.endDate)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Trạng thái:</span>
                <Badge
                  variant={
                    detailRequest.status === "APPROVED"
                      ? "success"
                      : detailRequest.status === "REJECTED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {detailRequest.status === "APPROVED"
                    ? "Đã duyệt"
                    : detailRequest.status === "REJECTED"
                      ? "Từ chối"
                      : "Chờ duyệt"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Người duyệt:</span>
                <span className="font-semibold text-slate-900">
                  {detailRequest.approvedByName || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Thời điểm gửi:</span>
                <span className="text-xs text-slate-600 font-mono">
                  {formatDateTime(detailRequest.createdAt)}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Lý do xin nghỉ:
              </span>
              <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200 text-sm whitespace-pre-wrap">
                {detailRequest.reason || "—"}
              </p>
            </div>

            {detailRequest.reviewNote && (
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Ghi chú / Lý do phản hồi:
                </div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap">
                  {detailRequest.reviewNote}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setDetailRequest(null)}
                className="rounded-xl font-semibold"
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
