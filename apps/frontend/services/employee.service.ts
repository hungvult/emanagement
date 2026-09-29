import { apiClient } from "../lib/api-client";
import { ApiResponse, PageResponse } from "../types/common.types";
import {
  EmployeeResponse,
  EmployeeCreate,
  EmployeeUpdate,
  LiveEkycEnrollRequest,
  LiveEkycEnrollResponse,
  FaceImagesResponse,
} from "../types/employee.types";

export const employeeService = {
  getAll: (
    page: number = 0,
    size: number = 10,
    filters?: { keyword?: string; status?: string; hasRegisteredFace?: boolean }
  ): Promise<ApiResponse<PageResponse<EmployeeResponse>>> => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("size", size.toString());
    if (filters?.keyword) params.set("keyword", filters.keyword);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.hasRegisteredFace !== undefined)
      params.set("hasRegisteredFace", filters.hasRegisteredFace.toString());
    return apiClient.get<PageResponse<EmployeeResponse>>(`/employees?${params.toString()}`);
  },

  getById: (id: number): Promise<ApiResponse<EmployeeResponse>> => {
    return apiClient.get<EmployeeResponse>(`/employees/${id}`);
  },

  create: (data: EmployeeCreate): Promise<ApiResponse<EmployeeResponse>> => {
    return apiClient.post<EmployeeResponse>("/employees", data);
  },

  update: (id: number, data: EmployeeUpdate): Promise<ApiResponse<EmployeeResponse>> => {
    return apiClient.put<EmployeeResponse>(`/employees/${id}`, data);
  },

  delete: (id: number): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/employees/${id}`);
  },

  enrollEkyc: (data: LiveEkycEnrollRequest): Promise<ApiResponse<LiveEkycEnrollResponse>> => {
    return apiClient.post<LiveEkycEnrollResponse>("/employees/ekyc-enroll", data);
  },

  deleteFaceData: (id: number): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/employees/${id}/face`);
  },

  getFaceImages: (id: number): Promise<ApiResponse<FaceImagesResponse>> => {
    return apiClient.get<FaceImagesResponse>(`/employees/${id}/face-images`);
  },
};
