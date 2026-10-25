import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/common.types";

export interface DashboardOverview {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
}

export interface DashboardDailyTrend {
  date: string; // YYYY-MM-DD
  totalEmployees: number;
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  onLeaveCount: number;
}

export const dashboardService = {
  getOverview: (date?: string): Promise<ApiResponse<DashboardOverview>> => {
    if (date && date.trim()) {
      return apiClient.get<DashboardOverview>(
        `/dashboard/overview?date=${encodeURIComponent(date.trim())}`,
      );
    }
    return apiClient.get<DashboardOverview>("/dashboard/overview");
  },

  getTrends: (
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<DashboardDailyTrend[]>> => {
    const params = new URLSearchParams();
    if (startDate && startDate.trim()) {
      params.append("startDate", startDate.trim());
    }
    if (endDate && endDate.trim()) {
      params.append("endDate", endDate.trim());
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<DashboardDailyTrend[]>(`/dashboard/trends${query}`);
  },
};
