import { apiClient } from "@/lib/api-client";
import { ApiResponse, PageResponse } from "@/types/common.types";
import {
  LeaveApproval,
  LeaveRequestCreate,
  LeaveRequestResponse,
} from "@/types/leave.types";

export const leaveService = {
  getById: (id: number): Promise<ApiResponse<LeaveRequestResponse>> =>
    apiClient.get<LeaveRequestResponse>(`/leave-requests/${id}`),
  getMyRequests: (
    userId?: number,
  ): Promise<ApiResponse<LeaveRequestResponse[]>> => {
    return apiClient.get<LeaveRequestResponse[]>(
      userId === undefined
        ? "/leave-requests/my-requests"
        : `/leave-requests/my-requests?userId=${userId}`,
    );
  },

  getAll: (
    page: number = 0,
    size: number = 10,
    filtersOrStatus?:
      | string
      | {
          status?: string;
          keyword?: string;
          startDate?: string;
          endDate?: string;
        },
  ): Promise<ApiResponse<PageResponse<LeaveRequestResponse>>> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (typeof filtersOrStatus === "string") {
      if (filtersOrStatus.trim()) {
        params.set("status", filtersOrStatus.trim());
      }
    } else if (filtersOrStatus) {
      if (filtersOrStatus.status?.trim()) {
        params.set("status", filtersOrStatus.status.trim());
      }
      if (filtersOrStatus.keyword?.trim()) {
        params.set("keyword", filtersOrStatus.keyword.trim());
      }
      if (filtersOrStatus.startDate?.trim()) {
        params.set("startDate", filtersOrStatus.startDate.trim());
      }
      if (filtersOrStatus.endDate?.trim()) {
        params.set("endDate", filtersOrStatus.endDate.trim());
      }
    }
    return apiClient.get<PageResponse<LeaveRequestResponse>>(
      `/leave-requests?${params.toString()}`,
    );
  },

  create: (
    data: LeaveRequestCreate,
  ): Promise<ApiResponse<LeaveRequestResponse>> => {
    return apiClient.post<LeaveRequestResponse>("/leave-requests", data);
  },

  approve: (
    id: number,
    data: LeaveApproval,
  ): Promise<ApiResponse<LeaveRequestResponse>> => {
    return apiClient.put<LeaveRequestResponse>(
      `/leave-requests/${id}/approve`,
      data,
    );
  },
};
