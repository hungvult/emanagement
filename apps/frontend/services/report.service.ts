import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/common.types";

export interface MonthlyReportRow {
  userId: number;
  employeeCode: string;
  fullName: string;
  assignedMinutes: number;
  actualMinutes: number;
  earlyCount: number;
  lateCount: number;
  missingCheckoutCount: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  generatedAt: string;
  employees: MonthlyReportRow[];
}

export const reportService = {
  monthly: (year: number, month: number): Promise<ApiResponse<MonthlyReport>> =>
    apiClient.get<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`),
};
