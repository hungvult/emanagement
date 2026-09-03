import { apiClient } from "../lib/api-client";
import { ApiResponse, PageResponse } from "../types/common.types";
import { AttendanceHistory } from "../types/attendance.types";

export const attendanceService = {
  getMyHistory: (userId: number, page: number = 0, size: number = 10): Promise<ApiResponse<PageResponse<AttendanceHistory>>> => {
    return apiClient.get<PageResponse<AttendanceHistory>>(`/attendances/my-history?userId=${userId}&page=${page}&size=${size}`);
  },

  getAllRecords: (page: number = 0, size: number = 10): Promise<ApiResponse<PageResponse<AttendanceHistory>>> => {
    return apiClient.get<PageResponse<AttendanceHistory>>(`/attendances/records?page=${page}&size=${size}`);
  },
};

