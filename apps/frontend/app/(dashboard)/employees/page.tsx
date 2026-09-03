"use client";

import React, { useEffect, useState, useRef } from "react";
import { RoleGuard } from "../../../components/shared/role-guard";
import { employeeService } from "../../../services/employee.service";
import { EmployeeResponse, EmployeeCreate, EmployeeUpdate } from "../../../types/employee.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { Pagination } from "../../../components/ui/pagination";
import { useToast } from "../../../components/ui/toast";
import { formatDateTime } from "../../../lib/utils";
import { Search, Plus, Trash2, Edit, Camera, Sparkles, Check, RefreshCw } from "lucide-react";
import { BankingEkycModal } from "../../../components/ekyc/banking-ekyc-modal";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { error, success } = useToast();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EmployeeCreate>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeResponse | null>(null);
  const [editForm, setEditForm] = useState<EmployeeUpdate>({
    fullName: "",
    phone: "",
    status: "ACTIVE",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // eKYC Modal State
  const [isEkycOpen, setIsEkycOpen] = useState(false);
  const [ekycEmployee, setEkycEmployee] = useState<EmployeeResponse | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const fetchEmployees = async (pageNumber: number) => {
    setIsLoading(true);
    try {
      const res = await employeeService.getAll(pageNumber, 10);
      if (res.status === "SUCCESS" && res.data) {
        setEmployees(res.data.content);
        setTotalPages(res.data.totalPages);
        setPage(res.data.pageNumber);
      }
    } catch (err: any) {
      error("Lỗi khi tải danh sách nhân viên");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(page);
  }, [page]);

  // Handle Create Employee
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim()) {
      error("Họ và tên không được để trống");
      return;
    }
    if (!createForm.password || createForm.password.length < 8) {
      error("Mật khẩu phải từ 8 ký tự trở lên (bao gồm chữ hoa, thường, số, ký tự đặc biệt)");
      return;
    }

    setIsCreating(true);
    try {
      const res = await employeeService.create(createForm);
      if (res.status === "SUCCESS") {
        success(`Thêm nhân viên ${res.data.fullName} (${res.data.employeeCode}) thành công!`);
        setIsCreateOpen(false);
        setCreateForm({ fullName: "", email: "", phone: "", password: "" });
        fetchEmployees(0);
      } else {
        error(res.message || "Không thể tạo nhân viên");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi tạo nhân viên");
    } finally {
      setIsCreating(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (emp: EmployeeResponse) => {
    setEditingEmployee(emp);
    setEditForm({
      fullName: emp.fullName,
      phone: emp.phone || "",
      status: emp.status,
    });
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!editForm.fullName.trim()) {
      error("Họ và tên không được để trống");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await employeeService.update(editingEmployee.id, editForm);
      if (res.status === "SUCCESS") {
        success("Cập nhật thông tin nhân viên thành công!");
        setIsEditOpen(false);
        fetchEmployees(page);
      } else {
        error(res.message || "Không thể cập nhật nhân viên");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi cập nhật");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Delete Employee
  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn vô hiệu hóa tài khoản nhân viên này?")) return;
    try {
      const res = await employeeService.delete(id);
      if (res.status === "SUCCESS") {
        success("Đã vô hiệu hóa nhân viên");
        fetchEmployees(page);
      } else {
        error(res.message || "Không thể xóa nhân viên");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi vô hiệu hóa nhân viên");
    }
  };

  // eKYC Modal Handlers
  const openEkycModal = (emp: EmployeeResponse) => {
    setEkycEmployee(emp);
    setIsEkycOpen(true);
  };

  const handleDeleteFace = async (emp: EmployeeResponse) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa dữ liệu Face ID của nhân viên "${emp.fullName}" (${emp.employeeCode})? Sau khi xóa, nhân viên này sẽ cần phải quét mặt lại để điểm danh.`)) {
      return;
    }

    try {
      await employeeService.deleteFaceData(emp.id);
      success(`Đã xóa dữ liệu khuôn mặt của ${emp.fullName}`);
      fetchEmployees(page);
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi xóa dữ liệu khuôn mặt");
    }
  };

  const handleCaptureFrame = async (base64: string, idx: number) => {
    if (!ekycEmployee) return;

    if (idx === 0) {
      try {
        await employeeService.deleteFaceData(ekycEmployee.id);
      } catch (err) {
        // ignore error if face data doesn't exist
      }
    }

    const token = localStorage.getItem("access_token");

    // Gọi trực tiếp CV-Service (Python) ở port 8000 để xử lý ảnh
    const response = await fetch("http://localhost:8000/api/v1/cv/enroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        userId: ekycEmployee.id,
        images: [base64],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.status !== "ENROLLMENT_SUCCESS") {
      throw new Error(data.message || "Lỗi khi xử lý khuôn mặt từ AI");
    }
  };

  const handleEnrollComplete = () => {
    success("Đăng ký khuôn mặt eKYC thành công!");
    setIsEkycOpen(false);
    fetchEmployees(page);
  };

  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    return (
      emp.fullName?.toLowerCase().includes(term) ||
      emp.employeeCode?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.phone?.toLowerCase().includes(term)
    );
  });

  return (
    <RoleGuard allowedRoles={["ROLE_ADMIN"]} fallback={<p>Không có quyền truy cập</p>}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-secondary/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-lg">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary">Quản lý nhân viên</h1>
            <p className="text-sm text-text-secondary mt-1">Quản lý danh sách, hồ sơ và dữ liệu eKYC khuôn mặt.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input 
                placeholder="Tìm tên, mã, email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-bg-tertiary/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 shadow-lg shadow-accent/20 whitespace-nowrap rounded-xl">
              <Plus className="h-4 w-4" /> Thêm mới
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8 bg-bg-secondary/20 rounded-2xl border border-white/5 backdrop-blur-sm p-6">
            <div className="animate-pulse space-y-4 w-full">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-bg-tertiary/50 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã NV</TableHead>
                  <TableHead>Họ Tên</TableHead>
                  <TableHead>Email / SĐT</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>eKYC Face ID</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-text-secondary">
                      Không tìm thấy nhân viên nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.employeeCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                            {emp.fullName?.charAt(0) || "U"}
                          </div>
                          <span className="font-medium text-text-primary">{emp.fullName}</span>
                          {emp.roles.includes("ROLE_ADMIN") && (
                            <Badge variant="outline" className="text-[10px] ml-2">ADMIN</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{emp.email || "—"}</span>
                          <span className="text-xs text-text-secondary">{emp.phone || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.status === "ACTIVE" ? "success" : "danger"}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {emp.hasRegisteredFace ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1 w-fit text-xs py-0.5">
                              <Check className="h-3 w-3" /> Đã có Face ID
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEkycModal(emp)}
                              title="Quét lại Face ID"
                              className="h-7 w-7 p-0 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFace(emp)}
                              title="Xóa dữ liệu khuôn mặt"
                              className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEkycModal(emp)}
                            className="text-xs text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 py-1 h-7 flex items-center gap-1"
                          >
                            <Camera className="h-3.5 w-3.5" /> Quét khuôn mặt
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {emp.createdAt ? formatDateTime(emp.createdAt).split(" ")[0] : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleOpenEdit(emp)}
                            title="Chỉnh sửa"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger/10"
                            onClick={() => handleDelete(emp.id)}
                            disabled={emp.roles.includes("ROLE_ADMIN")}
                            title="Vô hiệu hóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

        {/* Modal Thêm nhân viên mới */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Thêm nhân viên mới"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="Họ và tên *"
              placeholder="VD: Nguyễn Văn A"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              required
            />
            <Input
              label="Email (Tùy chọn)"
              type="email"
              placeholder="VD: nhanvien@congty.com"
              value={createForm.email || ""}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
            <Input
              label="Số điện thoại (Tùy chọn)"
              placeholder="VD: 0912345678"
              value={createForm.phone || ""}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            />
            <Input
              label="Mật khẩu khởi tạo *"
              type="password"
              placeholder="Ít nhất 8 ký tự, gồm hoa, thường, số, ký tự đặc biệt"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />
            <p className="text-xs text-text-secondary">
              Mã nhân viên sẽ được hệ thống tự động sinh theo chuẩn EMP26XXXX.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" isLoading={isCreating}>
                Tạo nhân viên
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Chỉnh sửa thông tin nhân viên */}
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Chỉnh sửa nhân viên: ${editingEmployee?.employeeCode}`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              label="Họ và tên *"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              required
            />
            <Input
              label="Số điện thoại"
              value={editForm.phone || ""}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">Trạng thái tài khoản</label>
              <select
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as "ACTIVE" | "INACTIVE" })}
              >
                <option value="ACTIVE">ACTIVE (Hoạt động)</option>
                <option value="INACTIVE">INACTIVE (Vô hiệu hóa)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" isLoading={isUpdating}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Đăng ký Face ID eKYC Live Chuẩn Ngân Hàng */}
        <BankingEkycModal
          isOpen={isEkycOpen}
          onClose={() => setIsEkycOpen(false)}
          employeeName={ekycEmployee?.fullName || ""}
          employeeCode={ekycEmployee?.employeeCode || ""}
          onCaptureFrame={handleCaptureFrame}
          onCompleteAll={handleEnrollComplete}
        />
      </div>
    </RoleGuard>
  );
}

