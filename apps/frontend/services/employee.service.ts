import { apiClient } from "@/lib/api-client";
import { ApiResponse, PageResponse } from "@/types/common.types";
import {
  BulkImportJob,
  EmployeeCreate,
  EmployeeResponse,
  EmployeeUpdate,
  FaceImagesResponse,
} from "@/types/employee.types";

export const employeeService = {
  getAll: (
    page: number = 0,
    size: number = 10,
    filters?: {
      keyword?: string;
      status?: string;
      hasRegisteredFace?: boolean;
    },
  ): Promise<ApiResponse<PageResponse<EmployeeResponse>>> => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("size", size.toString());
    if (filters?.keyword) params.set("keyword", filters.keyword);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.hasRegisteredFace !== undefined)
      params.set("hasRegisteredFace", filters.hasRegisteredFace.toString());
    return apiClient.get<PageResponse<EmployeeResponse>>(
      `/employees?${params.toString()}`,
    );
  },

  create: (data: EmployeeCreate): Promise<ApiResponse<EmployeeResponse>> => {
    return apiClient.post<EmployeeResponse>("/employees", data);
  },

  update: (
    id: number,
    data: EmployeeUpdate,
  ): Promise<ApiResponse<EmployeeResponse>> => {
    return apiClient.put<EmployeeResponse>(`/employees/${id}`, data);
  },

  delete: (id: number): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/employees/${id}`);
  },

  deleteFaceData: (id: number): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/employees/${id}/face`);
  },

  getFaceImages: (id: number): Promise<ApiResponse<FaceImagesResponse>> => {
    return apiClient.get<FaceImagesResponse>(`/employees/${id}/face-images`);
  },

  submitBulkImport: (file: File): Promise<ApiResponse<BulkImportJob>> => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<BulkImportJob>(
      "/employees/bulk-import",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      },
    );
  },

  getActiveBulkImportJob: (): Promise<ApiResponse<BulkImportJob | null>> => {
    return apiClient.get<BulkImportJob | null>(
      "/employees/bulk-import/jobs/active",
    );
  },

  getBulkImportJob: (id: number): Promise<ApiResponse<BulkImportJob>> => {
    return apiClient.get<BulkImportJob>(
      `/employees/bulk-import/jobs/${id}`,
    );
  },

  downloadBulkImportTemplate: async (): Promise<void> => {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8080/api/v1";
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const response = await fetch(`${baseUrl}/employees/bulk-import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error("Không thể tải tệp mẫu CSV");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_import_template.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
