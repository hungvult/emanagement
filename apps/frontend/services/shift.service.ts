import { apiClient } from "../lib/api-client";
import { ApiResponse } from "../types/common.types";
import { ShiftResponse, ShiftCreate, AssignShift, EmployeeShiftResponse } from "../types/shift.types";

export const shiftService = {
  getAll: (): Promise<ApiResponse<ShiftResponse[]>> => {
    return apiClient.get<ShiftResponse[]>("/shifts");
  },

  create: (data: ShiftCreate): Promise<ApiResponse<ShiftResponse>> => {
    return apiClient.post<ShiftResponse>("/shifts", data);
  },

  assign: (data: AssignShift): Promise<ApiResponse<void>> => {
    return apiClient.post<void>("/shifts/assign", data);
  },

  getSchedule: (startDate: string, endDate: string): Promise<ApiResponse<EmployeeShiftResponse[]>> => {
    return apiClient.get<EmployeeShiftResponse[]>(`/shifts/schedule?startDate=${startDate}&endDate=${endDate}`);
  },
};
