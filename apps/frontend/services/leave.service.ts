import { apiClient } from "../lib/api-client";
import { ApiResponse, PageResponse } from "../types/common.types";
import { LeaveRequestResponse, LeaveRequestCreate, LeaveApproval } from "../types/leave.types";

export const leaveService = {
  getMyRequests: (userId: number): Promise<ApiResponse<LeaveRequestResponse[]>> => {
    return apiClient.get<LeaveRequestResponse[]>(`/leave-requests/my-requests?userId=${userId}`);
  },

  getAll: (page: number = 0, size: number = 10, status?: string): Promise<ApiResponse<PageResponse<LeaveRequestResponse>>> => {
    const statusParam = status ? `&status=${status}` : "";
    return apiClient.get<PageResponse<LeaveRequestResponse>>(`/leave-requests?page=${page}&size=${size}${statusParam}`);
  },

  create: (data: LeaveRequestCreate): Promise<ApiResponse<LeaveRequestResponse>> => {
    return apiClient.post<LeaveRequestResponse>("/leave-requests", data);
  },

  approve: (id: number, data: LeaveApproval): Promise<ApiResponse<LeaveRequestResponse>> => {
    return apiClient.put<LeaveRequestResponse>(`/leave-requests/${id}/approve`, data);
  },
};

