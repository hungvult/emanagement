import { apiClient } from "../lib/api-client";
import { ApiResponse, PageResponse } from "../types/common.types";
import { AttendanceHistory } from "../types/attendance.types";

export interface AttendanceFilters {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status?: string;    // ON_TIME | LATE | EARLY_LEAVE | NO_DATA
  shiftId?: number | string;
}

export const attendanceService = {
  getMyHistory: (
    userId: number,
    page: number = 0,
    size: number = 10,
    filters?: AttendanceFilters
  ): Promise<ApiResponse<PageResponse<AttendanceHistory>>> => {
    const params = new URLSearchParams({ userId: String(userId), page: String(page), size: String(size) });
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.shiftId) params.append("shiftId", String(filters.shiftId));
    return apiClient.get<PageResponse<AttendanceHistory>>(`/attendances/my-history?${params.toString()}`);
  },

  getAllRecords: (
    page: number = 0,
    size: number = 10,
    filters?: AttendanceFilters
  ): Promise<ApiResponse<PageResponse<AttendanceHistory>>> => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.shiftId) params.append("shiftId", String(filters.shiftId));
    return apiClient.get<PageResponse<AttendanceHistory>>(`/attendances/records?${params.toString()}`);
  },
};
