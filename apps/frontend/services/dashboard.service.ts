import { apiClient } from "../lib/api-client";
import { ApiResponse } from "../types/common.types";

export interface DashboardOverview {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
}

export const dashboardService = {
  getOverview: (): Promise<ApiResponse<DashboardOverview>> => {
    return apiClient.get<DashboardOverview>("/dashboard/overview");
  },
};
