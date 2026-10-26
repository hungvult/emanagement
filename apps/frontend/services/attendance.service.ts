import { apiClient } from "@/lib/api-client";
import {
  AttendanceHistory,
  ManualAttendancePayload,
} from "@/types/attendance.types";
import { ApiResponse, PageResponse } from "@/types/common.types";

export interface AttendanceFilters {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  status?: string; // ON_TIME | LATE | EARLY_LEAVE | NO_DATA
  shiftId?: number | string;
  search?: string;
}

export const attendanceService = {
  getMyHistory: (
    userId: number,
    page: number = 0,
    size: number = 10,
    filters?: AttendanceFilters,
  ): Promise<ApiResponse<PageResponse<AttendanceHistory>>> => {
    const params = new URLSearchParams({
      userId: String(userId),
      page: String(page),
      size: String(size),
    });
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.shiftId) params.append("shiftId", String(filters.shiftId));
    return apiClient.get<PageResponse<AttendanceHistory>>(
      `/attendances/my-history?${params.toString()}`,
    );
  },

  getAllRecords: (
    page: number = 0,
    size: number = 10,
    filters?: AttendanceFilters,
  ): Promise<ApiResponse<PageResponse<AttendanceHistory>>> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.shiftId) params.append("shiftId", String(filters.shiftId));
    if (filters?.search?.trim()) params.append("search", filters.search.trim());
    return apiClient.get<PageResponse<AttendanceHistory>>(
      `/attendances/records?${params.toString()}`,
    );
  },

  exportCsv: async (filters?: AttendanceFilters): Promise<Blob> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.shiftId) params.append("shiftId", String(filters.shiftId));
    if (filters?.search?.trim()) params.append("search", filters.search.trim());
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await apiClient.get<Blob>(`/attendances/export${query}`, {
      responseType: "blob",
    });
    return res instanceof Blob
      ? res
      : new Blob([res as unknown as BlobPart], {
          type: "text/csv;charset=utf-8;",
        });
  },

  createManualRecord: (
    payload: ManualAttendancePayload,
  ): Promise<ApiResponse<AttendanceHistory>> => {
    return apiClient.post<AttendanceHistory>("/attendances/manual", payload);
  },

  updateManualRecord: (
    id: number,
    payload: ManualAttendancePayload,
  ): Promise<ApiResponse<AttendanceHistory>> => {
    return apiClient.put<AttendanceHistory>(`/attendances/${id}`, payload);
  },
};
