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
import { formatDateTime } from "@/lib/utils";
import { leaveService } from "@/services/leave.service";
import { LeaveRequestCreate, LeaveRequestResponse } from "@/types/leave.types";
import { CalendarRange, Check, Plus, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

export default function LeaveRequestsPage() {
  const beginRequest = useLatestRequest();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");

  const [requests, setRequests] = useState<LeaveRequestResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const { error, success } = useToast();

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

  const fetchRequests = useCallback(
    async (pageNumber: number) => {
      const isCurrent = beginRequest();
      setIsLoading(true);
      try {
        if (isAdmin) {
          const res = await leaveService.getAll(
            pageNumber,
            15,
            statusFilter || undefined,
          );
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
            setRequests(res.data || []);
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
    [beginRequest, error, isAdmin, user, statusFilter],
  );

  useEffect(() => {
    // Synchronize this screen with an external request or camera session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) fetchRequests(page);
  }, [page, user, fetchRequests]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!createForm.startDate || !createForm.endDate) {
      error("Vui lòng chọn ngày bắt đầu và kết thúc");
      return;
    }
    if (new Date(createForm.startDate) > new Date(createForm.endDate)) {
      error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }
    if (!createForm.reason || createForm.reason.trim().length < 5) {
      error("Lý do xin nghỉ phép phải từ 5 ký tự trở lên");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: LeaveRequestCreate = {
        userId: user.id,
        startDate: createForm.startDate,
        endDate: createForm.endDate,
        reason: createForm.reason,
      };

      const res = await leaveService.create(payload);
      if (res.status === "SUCCESS") {
        success("Đã gửi đơn xin nghỉ phép thành công!");
        setIsCreateOpen(false);
        setCreateForm({ startDate: "", endDate: "", reason: "" });
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

  const handleApprove = async (id: number, status: "APPROVED" | "REJECTED") => {
    if (!user) return;
    try {
      const res = await leaveService.approve(id, {
        approvedByUserId: user.id,
        status: status,
      });
      if (res.status === "SUCCESS") {
        success(
          status === "APPROVED"
            ? "Đã duyệt đơn nghỉ phép"
            : "Đã từ chối đơn nghỉ phép",
        );
        fetchRequests(page);
      } else {
        error(getErrorMessage(res, "Không thể xử lý đơn"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi xử lý đơn phép"));
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
          {isAdmin && (
            <select
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all w-[200px]"
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
          )}
          {!isAdmin && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 h-11 px-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" /> Tạo đơn mới
            </Button>
          )}
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
                {isAdmin && (
                  <TableHead className="text-right">Hành động</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 8 : 6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Không có dữ liệu đơn phép
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
                      {req.startDate}
                    </TableCell>
                    <TableCell className="font-medium">{req.endDate}</TableCell>
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
                      {req.createdAt
                        ? formatDateTime(req.createdAt).split(" ")[0]
                        : "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {req.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-success hover:bg-success/10 hover:text-success"
                              onClick={() => handleApprove(req.id, "APPROVED")}
                              title="Duyệt"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-danger hover:bg-danger/10 hover:text-danger"
                              onClick={() => handleApprove(req.id, "REJECTED")}
                              title="Từ chối"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Đã xử lý
                          </span>
                        )}
                      </TableCell>
                    )}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                Từ ngày <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={createForm.startDate}
                onChange={(e) =>
                  setCreateForm({ ...createForm, startDate: e.target.value })
                }
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
                onChange={(e) =>
                  setCreateForm({ ...createForm, endDate: e.target.value })
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
    </div>
  );
}
