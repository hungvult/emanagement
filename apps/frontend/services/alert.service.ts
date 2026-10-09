import { apiClient } from "@/lib/api-client";
import {
  AlertFilters,
  AnomalyAlert,
  ResolveAlertRequest,
} from "@/types/alert.types";
import { ApiResponse, PageResponse } from "@/types/common.types";

export const alertService = {
  getAll: (
    page: number = 0,
    size: number = 10,
    filters?: AlertFilters,
  ): Promise<ApiResponse<PageResponse<AnomalyAlert>>> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (filters?.isResolved !== undefined) {
      params.append("isResolved", String(filters.isResolved));
    }
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.shiftId) params.append("shiftId", String(filters.shiftId));
    return apiClient.get<PageResponse<AnomalyAlert>>(
      `/alerts?${params.toString()}`,
    );
  },

  resolve: (
    id: number,
    data: ResolveAlertRequest,
  ): Promise<ApiResponse<AnomalyAlert>> => {
    return apiClient.put<AnomalyAlert>(`/alerts/${id}/resolve`, data);
  },
};
