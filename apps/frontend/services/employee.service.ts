import { apiClient } from "../lib/api-client";
import { ApiResponse, PageResponse } from "../types/common.types";
import {
  EmployeeResponse,
  EmployeeCreate,
  EmployeeUpdate,
  LiveEkycEnrollRequest,
  LiveEkycEnrollResponse,
} from "../types/employee.types";

export const employeeService = {
  getAll: (page: number = 0, size: number = 10): Promise<ApiResponse<PageResponse<EmployeeResponse>>> => {
    return apiClient.get<PageResponse<EmployeeResponse>>(`/employees?page=${page}&size=${size}`);
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
};

