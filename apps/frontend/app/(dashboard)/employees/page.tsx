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
  Columns3,
  X,
  ScanFace,
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Loader2,
  Sparkles,
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
        <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 md:p-8 rounded-[24px] border border-slate-100 shadow-sm animate-in fade-in duration-500">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          <div className="relative z-10">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Quản lý nhân viên</h1>
            <p className="text-sm font-medium text-slate-500 mt-1.5 max-w-lg">
              Quản lý danh sách nhân sự, phân quyền và dữ liệu nhận diện khuôn mặt (eKYC).
            </p>
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:w-auto mt-4 lg:mt-0">
            {/* Search */}
            <div className="relative w-full lg:w-64 group shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                placeholder="Tìm tên, mã, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-transparent rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 hide-scrollbar shrink-0 w-full lg:w-auto">
              {/* Filter toggle */}
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className={`flex shrink-0 items-center gap-2 rounded-xl h-[42px] px-4 font-semibold transition-all ${
                  showFilters 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Filter className="h-4 w-4" />
                <span>Bộ lọc</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full h-5 w-5 flex items-center justify-center shadow-sm border-2 border-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {/* Column picker toggle */}
              <Button
                variant={showColumnPicker ? "default" : "outline"}
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className={`flex shrink-0 items-center gap-2 rounded-xl h-[42px] px-4 font-semibold transition-all ${
                  showColumnPicker 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Columns3 className="h-4 w-4" />
                <span>Cột hiển thị</span>
              </Button>

              <Button onClick={() => setIsCreateOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl h-[42px] px-5 font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg transition-all">
                <Plus className="h-4 w-4" /> Thêm mới
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <Filter className="h-4 w-4 text-indigo-500" />
              </div>
              <span className="text-sm font-bold text-slate-800">Bộ lọc:</span>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5">
                <label className="text-sm font-semibold text-slate-500">Trạng thái</label>
                <select
                  className="rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white hover:bg-white transition-all shadow-sm"
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">🟢 Đang hoạt động (ACTIVE)</option>
                  <option value="INACTIVE">🔴 Vô hiệu hóa (INACTIVE)</option>
                </select>
              </div>
              <div className="flex items-center gap-2.5">
                <label className="text-sm font-semibold text-slate-500">Face ID</label>
                <select
                  className="rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white hover:bg-white transition-all shadow-sm"
                  value={filterFace}
                  onChange={(e) => {
                    setFilterFace(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả</option>
                  <option value="true">✅ Đã đăng ký</option>
                  <option value="false">❌ Chưa đăng ký</option>
                </select>
              </div>
            </div>
            {(filterStatus || filterFace) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterStatus("");
                  setFilterFace("");
                }}
                className="ml-auto text-sm font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl px-4"
              >
                <X className="h-4 w-4 mr-1.5" /> Xóa bộ lọc
              </Button>
            )}
          </div>
        )}

        {/* Column Picker */}
        {showColumnPicker && (
          <div className="flex flex-wrap items-center gap-3 bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 mr-2">
              <div className="h-8 w-8 rounded-full bg-violet-50 flex items-center justify-center">
                <Columns3 className="h-4 w-4 text-violet-500" />
              </div>
              <span className="text-sm font-bold text-slate-800">Hiển thị cột:</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {(Object.keys(COLUMN_LABELS) as Array<keyof EmployeeColumnVisibility>).map((col) => (
                <button
                  key={col}
                  onClick={() => toggleColumn(col)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                    columnVis[col]
                      ? "bg-indigo-50/50 text-indigo-700 border-indigo-500/20 hover:border-indigo-500/40"
                      : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${columnVis[col] ? "bg-indigo-500 border-indigo-500" : "border-slate-300"}`}>
                    {columnVis[col] && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  {COLUMN_LABELS[col]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-16 px-6">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="text-sm font-semibold text-slate-500">Đang tải dữ liệu nhân viên...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                      {columnVis.employeeCode && <TableHead className="font-bold text-slate-600 h-14">Mã NV</TableHead>}
                      {columnVis.fullName && <TableHead className="font-bold text-slate-600 h-14">Họ Tên</TableHead>}
                      {columnVis.emailPhone && <TableHead className="font-bold text-slate-600 h-14">Email / SĐT</TableHead>}
                      {columnVis.status && <TableHead className="font-bold text-slate-600 h-14">Trạng thái</TableHead>}
                      {columnVis.ekycFaceId && <TableHead className="font-bold text-slate-600 h-14">eKYC Face ID</TableHead>}
                      {columnVis.createdAt && <TableHead className="font-bold text-slate-600 h-14">Ngày tạo</TableHead>}
                      {columnVis.actions && <TableHead className="text-right font-bold text-slate-600 h-14 pr-6">Hành động</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={Object.values(columnVis).filter(Boolean).length || 7}
                          className="text-center py-16 text-slate-400 font-medium h-32"
                        >
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                              <Search className="h-6 w-6 text-slate-300" />
                            </div>
                            <p>Không tìm thấy nhân viên nào phù hợp</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((emp) => (
                        <TableRow 
                          key={emp.id} 
                          className="group cursor-pointer hover:bg-slate-50/80 transition-colors border-slate-100 h-16" 
                          onClick={() => openDetailModal(emp)}
                        >
                          {columnVis.employeeCode && (
                            <TableCell className="font-bold text-slate-700">{emp.employeeCode}</TableCell>
                          )}
                          {columnVis.fullName && (
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                                  {emp.fullName?.charAt(0) || "U"}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{emp.fullName}</span>
                                  {emp.roles.includes("ROLE_ADMIN") && (
                                    <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-inset ring-rose-500/20 mt-0.5">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          )}
                          {columnVis.emailPhone && (
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-700">{emp.email || "—"}</span>
                                <span className="text-[13px] font-medium text-slate-400">{emp.phone || "—"}</span>
                              </div>
                            </TableCell>
                          )}
                          {columnVis.status && (
                            <TableCell>
                              {emp.status === "ACTIVE" ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-sm">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200 shadow-sm">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                  INACTIVE
                                </span>
                              )}
                            </TableCell>
                          )}
                          {columnVis.ekycFaceId && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {emp.hasRegisteredFace ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600 border border-emerald-100 shadow-sm">
                                    <Check className="h-3 w-3" /> Đã có Face ID
                                  </span>
                                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-100 rounded-lg shadow-sm overflow-hidden">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openFaceModal(emp)}
                                      title="Xem khuôn mặt"
                                      className="h-8 w-8 p-0 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 rounded-none border-r border-slate-100"
                                    >
                                      <ScanFace className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEkycModal(emp)}
                                      title="Quét lại Face ID"
                                      className="h-8 w-8 p-0 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 rounded-none border-r border-slate-100"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteFace(emp)}
                                      title="Xóa dữ liệu khuôn mặt"
                                      className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-none"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEkycModal(emp)}
                                  className="text-xs font-bold text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 shadow-sm h-7 rounded-md px-2.5 flex items-center gap-1.5"
                                >
                                  <Camera className="h-3.5 w-3.5" /> Quét khuôn mặt
                                </Button>
                              )}
                            </TableCell>
                          )}
                          {columnVis.createdAt && (
                            <TableCell className="text-[13px] font-medium text-slate-500">
                              {formatDateTime(emp.createdAt)}
                            </TableCell>
                          )}
                          {columnVis.actions && (
                            <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  onClick={() => handleOpenEdit(emp)}
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
              </div>

              <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                <Pagination pageNumber={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </>
          )}
        </div>

        {/* ============================================== */}
        {/* Modal: Thêm nhân viên mới                      */}
        {/* ============================================== */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Thêm nhân viên mới">
          <form onSubmit={handleCreateSubmit} className="space-y-5 px-1 py-2">
            <div className="space-y-4">
              <Input
                label="Họ và tên *"
                placeholder="VD: Nguyễn Văn A"
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                required
                className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
              />
              <Input
                label="Email (Tùy chọn)"
                type="email"
                placeholder="VD: nhanvien@congty.com"
                value={createForm.email || ""}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
              />
              <Input
                label="Số điện thoại (Tùy chọn)"
                placeholder="VD: 0912345678"
                value={createForm.phone || ""}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
              />
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Mã nhân viên sẽ được hệ thống tự động sinh theo chuẩn EMP26XXXX.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-semibold hover:bg-slate-100">
                Hủy
              </Button>
              <Button type="submit" isLoading={isCreating} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-6">
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
          title={`Chỉnh sửa: ${editingEmployee?.employeeCode}`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-5 px-1 py-2">
            <div className="space-y-4">
              <Input
                label="Họ và tên *"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                required
                className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
              />
              <Input
                label="Số điện thoại"
                value={editForm.phone || ""}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
              />
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Trạng thái tài khoản</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all shadow-sm"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value as "ACTIVE" | "INACTIVE" })
                  }
                >
                  <option value="ACTIVE">🟢 Đang hoạt động (ACTIVE)</option>
                  <option value="INACTIVE">🔴 Vô hiệu hóa (INACTIVE)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl font-semibold hover:bg-slate-100">
                Hủy
              </Button>
              <Button type="submit" isLoading={isUpdating} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-6">
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
                  <h3 className="text-lg font-extrabold text-slate-900 truncate">{detailEmployee.fullName}</h3>
                  <p className="text-sm font-semibold text-slate-500">{detailEmployee.employeeCode}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {detailEmployee.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span> INACTIVE
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
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Họ và tên" value={detailEmployee.fullName} />
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
                  value={detailEmployee.hasRegisteredFace ? "Đã đăng ký" : "Chưa đăng ký"}
                  valueClassName={detailEmployee.hasRegisteredFace ? "text-emerald-600 font-bold" : "text-amber-500 font-medium"}
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

        {/* ============================================== */}
        {/* Modal: Xem ảnh khuôn mặt eKYC                  */}
        {/* ============================================== */}
        <Modal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          title={`Dữ liệu khuôn mặt eKYC`}
          className="max-w-3xl"
        >
          {isFaceLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <p className="text-sm font-semibold text-slate-500">Đang tải dữ liệu nhận diện...</p>
            </div>
          ) : faceImages ? (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-sm font-medium text-slate-500">
                  Nhân viên: <span className="font-bold text-slate-900">{faceImages.fullName}</span> ({faceImages.employeeCode})
                  <br className="sm:hidden" />
                  <span className="hidden sm:inline"> — </span>
                  Đăng ký lúc: <span className="font-bold text-slate-900">{formatDateTime(faceImages.registeredAt)}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <FaceImageCard label="Chính diện" url={faceImages.frontImageUrl} />
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
              <p className="text-center font-semibold text-slate-500">Không tìm thấy dữ liệu ảnh khuôn mặt.</p>
            </div>
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
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-transparent hover:border-slate-100 group">
      <div className="text-slate-400 shrink-0 group-hover:text-indigo-500 transition-colors bg-white p-1.5 rounded-md shadow-sm">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-slate-500 mb-0.5">{label}</p>
        <p className={`text-sm font-bold text-slate-900 truncate ${valueClassName || ""}`}>{value}</p>
      </div>
    </div>
  );
}

function FaceImageCard({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all group">
      <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden relative">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
            <ScanFace className="h-8 w-8 opacity-30" />
            <span className="text-[11px] font-semibold">Chưa có ảnh</span>
          </div>
        )}
        <div className="absolute inset-0 ring-1 ring-inset ring-slate-900/5 pointer-events-none"></div>
      </div>
      <div className="px-3 py-2.5 bg-white text-center border-t border-slate-50">
        <span className="text-sm font-bold text-slate-700">{label}</span>
      </div>
    </div>
  );
}
