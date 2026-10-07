"use client";
import { getErrorMessage } from "@/lib/errors";
import { cvService } from "@/services/cv.service";

import { useToast } from "@/components/ui/toast";
import { useLatestRequest } from "@/hooks/use-latest-request";
import {
  loadColumnVisibility,
  saveColumnVisibility,
} from "@/lib/employees-helpers";
import { employeeService } from "@/services/employee.service";
import {
  DEFAULT_COLUMN_VISIBILITY,
  EmployeeColumnVisibility,
  EmployeeCreate,
  EmployeeResponse,
  EmployeeUpdate,
  FaceImagesResponse,
} from "@/types/employee.types";
import React, { useCallback, useEffect, useState } from "react";

export function useEmployees() {
  const beginRequest = useLatestRequest();
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
  const [columnVis, setColumnVis] = useState<EmployeeColumnVisibility>(
    DEFAULT_COLUMN_VISIBILITY,
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  useEffect(() => {
    // Read browser preferences after hydration; server rendering uses defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnVis(loadColumnVisibility());
  }, []);

  const toggleColumn = (col: keyof EmployeeColumnVisibility) => {
    const updated = { ...columnVis, [col]: !columnVis[col] };
    setColumnVis(updated);
    saveColumnVisibility(updated);
  };

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
  }>({
    fullName: "",
    email: "",
    phone: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeResponse | null>(null);
  const [editForm, setEditForm] = useState<EmployeeUpdate>({
    fullName: "",
    phone: "",
    status: "ACTIVE",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // eKYC Modal State
  const [isEkycOpen, setIsEkycOpen] = useState(false);
  const [ekycEmployee, setEkycEmployee] = useState<EmployeeResponse | null>(
    null,
  );

  // Detail Modal State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState<EmployeeResponse | null>(
    null,
  );

  // Face Images Modal State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceImages, setFaceImages] = useState<FaceImagesResponse | null>(null);
  const [isFaceLoading, setIsFaceLoading] = useState(false);

  // ========================================
  // Fetch (server-side filter)
  // ========================================
  const fetchEmployees = useCallback(
    async (pageNumber: number) => {
      const isCurrent = beginRequest();
      setIsLoading(true);
      try {
        const filters: {
          keyword?: string;
          status?: string;
          hasRegisteredFace?: boolean;
        } = {};
        if (searchTerm.trim()) filters.keyword = searchTerm.trim();
        if (filterStatus) filters.status = filterStatus;
        if (filterFace === "true") filters.hasRegisteredFace = true;
        if (filterFace === "false") filters.hasRegisteredFace = false;

        const res = await employeeService.getAll(pageNumber, 10, filters);
        if (!isCurrent()) return;
        if (res.status === "SUCCESS" && res.data) {
          setEmployees(res.data.content);
          setTotalPages(res.data.totalPages);
          setPage(res.data.pageNumber);
        }
      } catch {
        if (!isCurrent()) return;
        error("Lỗi khi tải danh sách nhân viên");
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [searchTerm, filterStatus, filterFace, beginRequest, error],
  );

  useEffect(() => {
    // Fetch external data and show loading immediately when filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchEmployees(0);
  }, [fetchEmployees]);

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
        success(
          `Thêm nhân viên ${res.data.fullName} thành công! Mật khẩu: ${defaultPassword}`,
        );
        setIsCreateOpen(false);
        setCreateForm({ fullName: "", email: "", phone: "" });
        fetchEmployees(0);
      } else {
        error(res.message || "Không thể tạo nhân viên");
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi tạo nhân viên"));
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
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi cập nhật"));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn vô hiệu hóa tài khoản nhân viên này?"))
      return;
    try {
      const res = await employeeService.delete(id);
      if (res.status === "SUCCESS") {
        success("Đã vô hiệu hóa nhân viên");
        fetchEmployees(page);
      } else {
        error(res.message || "Không thể xóa nhân viên");
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi vô hiệu hóa nhân viên"));
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
        `Bạn có chắc chắn muốn xóa dữ liệu Face ID của nhân viên "${emp.fullName}" (${emp.employeeCode})? Sau khi xóa, nhân viên này sẽ cần phải quét mặt lại để điểm danh.`,
      )
    ) {
      return;
    }

    try {
      await employeeService.deleteFaceData(emp.id);
      success(`Đã xóa dữ liệu khuôn mặt của ${emp.fullName}`);
      fetchEmployees(page);
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi xóa dữ liệu khuôn mặt"));
    }
  };

  const handleEnrollComplete = async (allImages: string[]) => {
    if (!ekycEmployee) return;

    await cvService.enroll(ekycEmployee.id, allImages);

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
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi tải ảnh khuôn mặt"));
      setIsFaceModalOpen(false);
    } finally {
      setIsFaceLoading(false);
    }
  };

  const activeFilterCount = [filterStatus, filterFace].filter(Boolean).length;
  return {
    searchTerm,
    setSearchTerm,
    showFilters,
    setShowFilters,
    activeFilterCount,
    showColumnPicker,
    setShowColumnPicker,
    setIsCreateOpen,
    filterStatus,
    setFilterStatus,
    setPage,
    filterFace,
    setFilterFace,
    toggleColumn,
    columnVis,
    isLoading,
    employees,
    openDetailModal,
    openFaceModal,
    openEkycModal,
    handleDeleteFace,
    handleOpenEdit,
    handleDelete,
    page,
    totalPages,
    fetchEmployees,
    isCreateOpen,
    handleCreateSubmit,
    createForm,
    setCreateForm,
    isCreating,
    isEditOpen,
    setIsEditOpen,
    editingEmployee,
    handleEditSubmit,
    editForm,
    setEditForm,
    isUpdating,
    isDetailOpen,
    setIsDetailOpen,
    detailEmployee,
    isFaceModalOpen,
    setIsFaceModalOpen,
    isFaceLoading,
    faceImages,
    isEkycOpen,
    setIsEkycOpen,
    ekycEmployee,
    handleEnrollComplete,
  };
}
