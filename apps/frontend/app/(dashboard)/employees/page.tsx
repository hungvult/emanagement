"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "../../../components/shared/role-guard";
import { employeeService } from "../../../services/employee.service";
import {
  EmployeeResponse,
  EmployeeCreate,
  EmployeeUpdate,
  FaceImagesResponse,
  EmployeeColumnVisibility,
  DEFAULT_COLUMN_VISIBILITY,
} from "../../../types/employee.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { Pagination } from "../../../components/ui/pagination";
import { useToast } from "../../../components/ui/toast";
import { formatDateTime } from "../../../lib/utils";
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Camera,
  Check,
  RefreshCw,
  Filter,
  Eye,
  Columns3,
  X,
  ScanFace,
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Loader2,
} from "lucide-react";
import { BankingEkycModal } from "../../../components/ekyc/banking-ekyc-modal";

// ========================================
// Helpers
// ========================================
const COLUMN_STORAGE_KEY = "emanagement_employee_columns";

function loadColumnVisibility(): EmployeeColumnVisibility {
  if (typeof window === "undefined") return DEFAULT_COLUMN_VISIBILITY;
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (raw) return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_COLUMN_VISIBILITY;
}

function saveColumnVisibility(vis: EmployeeColumnVisibility) {
  if (typeof window !== "undefined") {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(vis));
  }
}

const COLUMN_LABELS: Record<keyof EmployeeColumnVisibility, string> = {
  employeeCode: "Mã NV",
  fullName: "Họ Tên",
  emailPhone: "Email / SĐT",
  status: "Trạng thái",
  ekycFaceId: "eKYC Face ID",
  createdAt: "Ngày tạo",
  actions: "Hành động",
};

// ========================================
// Main Page
// ========================================
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { error, success } = useToast();

  // --- Filters ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFace, setFilterFace] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // --- Column Visibility ---
  const [columnVis, setColumnVis] = useState<EmployeeColumnVisibility>(DEFAULT_COLUMN_VISIBILITY);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  useEffect(() => {
    setColumnVis(loadColumnVisibility());
  }, []);

  const toggleColumn = (col: keyof EmployeeColumnVisibility) => {
    const updated = { ...columnVis, [col]: !columnVis[col] };
    setColumnVis(updated);
    saveColumnVisibility(updated);
  };

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ fullName: string; email: string; phone: string }>({
    fullName: "",
    email: "",
    phone: "",
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

  // Detail Modal State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState<EmployeeResponse | null>(null);

  // Face Images Modal State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceImages, setFaceImages] = useState<FaceImagesResponse | null>(null);
  const [isFaceLoading, setIsFaceLoading] = useState(false);

  // ========================================
  // Fetch (server-side filter)
  // ========================================
  const fetchEmployees = useCallback(
    async (pageNumber: number) => {
      setIsLoading(true);
      try {
        const filters: { keyword?: string; status?: string; hasRegisteredFace?: boolean } = {};
        if (searchTerm.trim()) filters.keyword = searchTerm.trim();
        if (filterStatus) filters.status = filterStatus;
        if (filterFace === "true") filters.hasRegisteredFace = true;
        if (filterFace === "false") filters.hasRegisteredFace = false;

        const res = await employeeService.getAll(pageNumber, 10, filters);
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
    },
    [searchTerm, filterStatus, filterFace]
  );

  useEffect(() => {
    fetchEmployees(0);
  }, [searchTerm, filterStatus, filterFace]);

  // ========================================
  // Handlers
  // ========================================
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim()) {
      error("Họ và tên không được để trống");
      return;
    }

    setIsCreating(true);
    try {
      const defaultPassword = "DefaultPassword@123";
      const payload: EmployeeCreate = {
        ...createForm,
        password: defaultPassword,
      };
      const res = await employeeService.create(payload);
      if (res.status === "SUCCESS") {
        success(`Thêm nhân viên ${res.data.fullName} thành công! Mật khẩu: ${defaultPassword}`);
        setIsCreateOpen(false);
        setCreateForm({ fullName: "", email: "", phone: "" });
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

  const handleOpenEdit = (emp: EmployeeResponse) => {
    setEditingEmployee(emp);
    setEditForm({
      fullName: emp.fullName,
      phone: emp.phone || "",
      status: emp.status,
    });
    setIsEditOpen(true);
  };

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

  // eKYC handlers
  const openEkycModal = (emp: EmployeeResponse) => {
    setEkycEmployee(emp);
    setIsEkycOpen(true);
  };

  const handleDeleteFace = async (emp: EmployeeResponse) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa dữ liệu Face ID của nhân viên "${emp.fullName}" (${emp.employeeCode})? Sau khi xóa, nhân viên này sẽ cần phải quét mặt lại để điểm danh.`
      )
    ) {
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

  const handleEnrollComplete = async (allImages: string[]) => {
    if (!ekycEmployee) return;

    try {
      await employeeService.deleteFaceData(ekycEmployee.id);
    } catch (err) {
      // ignore error if face data doesn't exist
    }

    const token = localStorage.getItem("access_token");

    const response = await fetch("/api/v1/cv/enroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        userId: ekycEmployee.id,
        images: allImages,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.status !== "ENROLLMENT_SUCCESS") {
      throw new Error(data.message || "Lỗi khi xử lý khuôn mặt từ AI");
    }

    success("Đăng ký khuôn mặt eKYC 5 bước thành công!");
    setIsEkycOpen(false);
    fetchEmployees(page);
  };

  // Detail & Face handlers
  const openDetailModal = (emp: EmployeeResponse) => {
    setDetailEmployee(emp);
    setIsDetailOpen(true);
  };

  const openFaceModal = async (emp: EmployeeResponse) => {
    setIsFaceLoading(true);
    setIsFaceModalOpen(true);
    setFaceImages(null);
    try {
      const res = await employeeService.getFaceImages(emp.id);
      if (res.status === "SUCCESS") {
        setFaceImages(res.data);
      } else {
        error(res.message || "Không thể tải ảnh khuôn mặt");
        setIsFaceModalOpen(false);
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi tải ảnh khuôn mặt");
      setIsFaceModalOpen(false);
    } finally {
      setIsFaceLoading(false);
    }
  };

  const activeFilterCount = [filterStatus, filterFace].filter(Boolean).length;

  // ========================================
  // Render
  // ========================================
  return (
    <RoleGuard allowedRoles={["ROLE_ADMIN"]} fallback={<p>Không có quyền truy cập</p>}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Quản lý nhân viên</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Quản lý danh sách, hồ sơ và dữ liệu eKYC khuôn mặt.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Tìm tên, mã, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-input rounded-md py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-all"
              />
            </div>

            {/* Filter toggle */}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 relative"
              title="Bộ lọc"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Lọc</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Column picker toggle */}
            <Button
              variant={showColumnPicker ? "default" : "outline"}
              size="sm"
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-1.5"
              title="Tùy chỉnh cột hiển thị"
            >
              <Columns3 className="h-4 w-4" />
              <span className="hidden sm:inline">Cột</span>
            </Button>

            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" /> Thêm mới
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-xl border border-border shadow-sm animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Trạng thái:</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Tất cả</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Face ID:</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={filterFace}
                onChange={(e) => {
                  setFilterFace(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Tất cả</option>
                <option value="true">Đã đăng ký</option>
                <option value="false">Chưa đăng ký</option>
              </select>
            </div>
            {(filterStatus || filterFace) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatus("");
                  setFilterFace("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" /> Xóa bộ lọc
              </Button>
            )}
          </div>
        )}

        {/* Column Picker */}
        {showColumnPicker && (
          <div className="flex flex-wrap items-center gap-2 bg-card p-4 rounded-xl border border-border shadow-sm animate-in slide-in-from-top-2 duration-200">
            <span className="text-xs font-medium text-muted-foreground mr-2">Hiển thị cột:</span>
            {(Object.keys(COLUMN_LABELS) as Array<keyof EmployeeColumnVisibility>).map((col) => (
              <button
                key={col}
                onClick={() => toggleColumn(col)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  columnVis[col]
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {columnVis[col] && <Check className="h-3 w-3" />}
                {COLUMN_LABELS[col]}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8 bg-muted/30 rounded-xl border border-border p-6">
            <div className="animate-pulse space-y-4 w-full">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-muted rounded-md" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVis.employeeCode && <TableHead>Mã NV</TableHead>}
                  {columnVis.fullName && <TableHead>Họ Tên</TableHead>}
                  {columnVis.emailPhone && <TableHead>Email / SĐT</TableHead>}
                  {columnVis.status && <TableHead>Trạng thái</TableHead>}
                  {columnVis.ekycFaceId && <TableHead>eKYC Face ID</TableHead>}
                  {columnVis.createdAt && <TableHead>Ngày tạo</TableHead>}
                  {columnVis.actions && <TableHead className="text-right">Hành động</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={Object.values(columnVis).filter(Boolean).length || 7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Không tìm thấy nhân viên nào
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => (
                    <TableRow key={emp.id} className="group cursor-pointer" onClick={() => openDetailModal(emp)}>
                      {columnVis.employeeCode && (
                        <TableCell className="font-medium">{emp.employeeCode}</TableCell>
                      )}
                      {columnVis.fullName && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {emp.fullName?.charAt(0) || "U"}
                            </div>
                            <span className="font-medium text-foreground">{emp.fullName}</span>
                            {emp.roles.includes("ROLE_ADMIN") && (
                              <Badge variant="outline" className="text-[10px] ml-2">
                                ADMIN
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {columnVis.emailPhone && (
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{emp.email || "—"}</span>
                            <span className="text-xs text-muted-foreground">{emp.phone || "—"}</span>
                          </div>
                        </TableCell>
                      )}
                      {columnVis.status && (
                        <TableCell>
                          <Badge variant={emp.status === "ACTIVE" ? "default" : "destructive"}>
                            {emp.status}
                          </Badge>
                        </TableCell>
                      )}
                      {columnVis.ekycFaceId && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {emp.hasRegisteredFace ? (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1 w-fit text-xs py-0.5"
                              >
                                <Check className="h-3 w-3" /> Đã có Face ID
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openFaceModal(emp)}
                                title="Xem khuôn mặt"
                                className="h-7 w-7 p-0 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                              >
                                <ScanFace className="h-3.5 w-3.5" />
                              </Button>
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
                      )}
                      {columnVis.createdAt && (
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(emp.createdAt)}
                        </TableCell>
                      )}
                      {columnVis.actions && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => openDetailModal(emp)}
                              title="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <Pagination pageNumber={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}

        {/* ============================================== */}
        {/* Modal: Thêm nhân viên mới                      */}
        {/* ============================================== */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Thêm nhân viên mới">
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

            <p className="text-xs text-muted-foreground">
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

        {/* ============================================== */}
        {/* Modal: Chỉnh sửa thông tin nhân viên           */}
        {/* ============================================== */}
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
              <label className="text-sm font-medium text-muted-foreground">Trạng thái tài khoản</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value as "ACTIVE" | "INACTIVE" })
                }
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

        {/* ============================================== */}
        {/* Modal: Xem chi tiết nhân viên                  */}
        {/* ============================================== */}
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title="Thông tin chi tiết nhân viên"
          className="max-w-xl"
        >
          {detailEmployee && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
                  {detailEmployee.fullName?.charAt(0) || "U"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground truncate">{detailEmployee.fullName}</h3>
                  <p className="text-sm text-muted-foreground">{detailEmployee.employeeCode}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={detailEmployee.status === "ACTIVE" ? "default" : "destructive"}>
                      {detailEmployee.status}
                    </Badge>
                    {detailEmployee.roles.includes("ROLE_ADMIN") && (
                      <Badge variant="outline" className="text-[10px]">
                        ADMIN
                      </Badge>
                    )}
                    {detailEmployee.hasRegisteredFace && (
                      <Badge
                        variant="outline"
                        className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px]"
                      >
                        <Check className="h-3 w-3 mr-0.5" /> Face ID
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Info rows */}
              <div className="grid gap-3">
                <InfoRow icon={<User className="h-4 w-4" />} label="Họ và tên" value={detailEmployee.fullName} />
                <InfoRow
                  icon={<Shield className="h-4 w-4" />}
                  label="Mã nhân viên"
                  value={detailEmployee.employeeCode}
                />
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={detailEmployee.email || "Chưa cập nhật"}
                />
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Số điện thoại"
                  value={detailEmployee.phone || "Chưa cập nhật"}
                />
                <InfoRow
                  icon={<ScanFace className="h-4 w-4" />}
                  label="eKYC Face ID"
                  value={detailEmployee.hasRegisteredFace ? "Đã đăng ký" : "Chưa đăng ký"}
                  valueClassName={detailEmployee.hasRegisteredFace ? "text-emerald-400" : "text-amber-400"}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Ngày tạo"
                  value={formatDateTime(detailEmployee.createdAt)}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                {detailEmployee.hasRegisteredFace && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailOpen(false);
                      openFaceModal(detailEmployee);
                    }}
                    className="flex items-center gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                  >
                    <ScanFace className="h-3.5 w-3.5" /> Xem khuôn mặt
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleOpenEdit(detailEmployee);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Edit className="h-3.5 w-3.5" /> Chỉnh sửa
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============================================== */}
        {/* Modal: Xem ảnh khuôn mặt eKYC                  */}
        {/* ============================================== */}
        <Modal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          title={`Ảnh khuôn mặt eKYC${faceImages ? ` — ${faceImages.fullName}` : ""}`}
          className="max-w-2xl"
        >
          {isFaceLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Đang tải ảnh khuôn mặt...</p>
            </div>
          ) : faceImages ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nhân viên: <span className="font-medium text-foreground">{faceImages.fullName}</span> ({faceImages.employeeCode})
                — Đăng ký lúc: <span className="font-medium text-foreground">{formatDateTime(faceImages.registeredAt)}</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <FaceImageCard label="Chính diện" url={faceImages.frontImageUrl} />
                <FaceImageCard label="Nháy mắt" url={faceImages.blinkImageUrl} />
                <FaceImageCard label="Quay trái" url={faceImages.leftImageUrl} />
                <FaceImageCard label="Quay phải" url={faceImages.rightImageUrl} />
                <FaceImageCard label="Ngửa lên" url={faceImages.upImageUrl} />
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Không có dữ liệu ảnh khuôn mặt.</p>
          )}
        </Modal>

        {/* Modal: Đăng ký Face ID eKYC Live */}
        <BankingEkycModal
          isOpen={isEkycOpen}
          onClose={() => setIsEkycOpen(false)}
          employeeName={ekycEmployee?.fullName || ""}
          employeeCode={ekycEmployee?.employeeCode || ""}
          onCompleteAll={handleEnrollComplete}
        />
      </div>
    </RoleGuard>
  );
}

// ========================================
// Sub-components
// ========================================

function InfoRow({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium text-foreground truncate ${valueClassName || ""}`}>{value}</p>
      </div>
    </div>
  );
}

function FaceImageCard({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <ScanFace className="h-8 w-8 opacity-30" />
            <span className="text-xs">Không có ảnh</span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 text-center">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
