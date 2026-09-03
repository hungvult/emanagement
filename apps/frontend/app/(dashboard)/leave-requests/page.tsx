"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { leaveService } from "../../../services/leave.service";
import { LeaveRequestResponse, LeaveRequestCreate } from "../../../types/leave.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { Pagination } from "../../../components/ui/pagination";
import { useToast } from "../../../components/ui/toast";
import { formatDateTime } from "../../../lib/utils";
import { Check, X, Plus } from "lucide-react";

export default function LeaveRequestsPage() {
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

  const fetchRequests = async (pageNumber: number) => {
    setIsLoading(true);
    try {
      if (isAdmin) {
        const res = await leaveService.getAll(pageNumber, 15, statusFilter || undefined);
        if (res.status === "SUCCESS" && res.data) {
          setRequests(res.data.content || []);
          setTotalPages(res.data.totalPages || 1);
          setPage(res.data.pageNumber || 0);
        }
      } else if (user) {
        const res = await leaveService.getMyRequests(user.id);
        if (res.status === "SUCCESS" && res.data) {
          setRequests(res.data || []);
          setTotalPages(1);
        }
      }
    } catch (err: any) {
      error("Lỗi khi tải danh sách đơn phép");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchRequests(page);
  }, [page, user, isAdmin, statusFilter]);

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
        error(res.message || "Không thể gửi đơn nghỉ phép");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi gửi đơn xin nghỉ phép");
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
        success(status === "APPROVED" ? "Đã duyệt đơn nghỉ phép" : "Đã từ chối đơn nghỉ phép");
        fetchRequests(page);
      } else {
        error(res.message || "Không thể xử lý đơn");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi xử lý đơn phép");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            {isAdmin ? "Quản lý đơn phép" : "Đơn phép của tôi"}
          </h1>
          <p className="text-text-secondary">
            {isAdmin ? "Xét duyệt đơn xin nghỉ phép của nhân viên." : "Tạo và theo dõi đơn xin nghỉ phép."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              className="rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt (PENDING)</option>
              <option value="APPROVED">Đã duyệt (APPROVED)</option>
              <option value="REJECTED">Từ chối (REJECTED)</option>
            </select>
          )}
          {!isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Tạo đơn mới
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse space-y-4 w-full">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-bg-tertiary rounded-md" />
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
                {isAdmin && <TableHead className="text-right">Hành động</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-8 text-text-secondary">
                    Không có dữ liệu đơn phép
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="font-medium text-text-primary">{req.fullName}</div>
                        <div className="text-xs text-text-secondary">{req.employeeCode}</div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{req.startDate}</TableCell>
                    <TableCell className="font-medium">{req.endDate}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={req.reason}>
                      {req.reason}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          req.status === 'APPROVED' ? 'success' : 
                          req.status === 'REJECTED' ? 'danger' : 'warning'
                        }
                      >
                        {req.status === 'APPROVED' ? 'Đã duyệt' :
                         req.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {req.approvedByName || "—"}
                    </TableCell>
                    <TableCell className="text-text-secondary text-xs">
                      {req.createdAt ? formatDateTime(req.createdAt).split(" ")[0] : "—"}
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
                          <span className="text-xs text-text-secondary">Đã xử lý</span>
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
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Từ ngày *"
              type="date"
              value={createForm.startDate}
              onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
              required
            />
            <Input
              label="Đến ngày *"
              type="date"
              value={createForm.endDate}
              onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-secondary">Lý do xin nghỉ *</label>
            <textarea
              className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[100px]"
              placeholder="VD: Nghỉ phép cá nhân giải quyết việc gia đình..."
              value={createForm.reason}
              onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Gửi đơn
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

