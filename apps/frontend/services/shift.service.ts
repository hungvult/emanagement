import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/common.types";
import {
  AssignShift,
  BulkAssignRequest,
  BulkAssignResult,
  CopyWeekRequest,
  EmployeeShiftResponse,
  ShiftCreate,
  ShiftResponse,
  ShiftUpdate,
} from "@/types/shift.types";

export const shiftService = {
  getAll: (includeInactive = false): Promise<ApiResponse<ShiftResponse[]>> => {
    return apiClient.get<ShiftResponse[]>(
      `/shifts?includeInactive=${includeInactive}`,
    );
  },

  create: (data: ShiftCreate): Promise<ApiResponse<ShiftResponse>> => {
    return apiClient.post<ShiftResponse>("/shifts", data);
  },

  update: (
    id: number,
    data: ShiftUpdate,
  ): Promise<ApiResponse<ShiftResponse>> => {
    return apiClient.put<ShiftResponse>(`/shifts/${id}`, data);
  },

  remove: (
    id: number,
    replaceWithShiftId?: number,
  ): Promise<ApiResponse<string>> => {
    const url = replaceWithShiftId
      ? `/shifts/${id}?replaceWithShiftId=${replaceWithShiftId}`
      : `/shifts/${id}`;
    return apiClient.delete<string>(url);
  },

  assign: (data: AssignShift): Promise<ApiResponse<void>> => {
    return apiClient.post<void>("/shifts/assign", data);
  },

  bulkAssign: (
    data: BulkAssignRequest,
  ): Promise<ApiResponse<BulkAssignResult>> => {
    return apiClient.post<BulkAssignResult>("/shifts/bulk-assign", data);
  },

  copyWeek: (data: CopyWeekRequest): Promise<ApiResponse<BulkAssignResult>> => {
    return apiClient.post<BulkAssignResult>("/shifts/copy-week", data);
  },

  getSchedule: (
    startDate: string,
    endDate: string,
  ): Promise<ApiResponse<EmployeeShiftResponse[]>> => {
    return apiClient.get<EmployeeShiftResponse[]>(
      `/shifts/schedule?startDate=${startDate}&endDate=${endDate}`,
    );
  },

  getMySchedule: (
    startDate: string,
    endDate: string,
  ): Promise<ApiResponse<EmployeeShiftResponse[]>> => {
    return apiClient.get<EmployeeShiftResponse[]>(
      `/shifts/my-schedule?startDate=${startDate}&endDate=${endDate}`,
    );
  },

  removeAssignedShift: (
    userId: number,
    assignedDate: string,
  ): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(
      `/shifts/assign?userId=${userId}&assignedDate=${assignedDate}`,
    );
  },
};
