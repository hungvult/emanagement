import { apiClient } from "../lib/api-client";
import { ApiResponse, PageResponse } from "../types/common.types";
import { AnomalyAlert, ResolveAlertRequest } from "../types/alert.types";

export const alertService = {
  getAll: (page: number = 0, size: number = 10, isResolved?: boolean): Promise<ApiResponse<PageResponse<AnomalyAlert>>> => {
    let url = `/alerts?page=${page}&size=${size}`;
    if (isResolved !== undefined) {
      url += `&isResolved=${isResolved}`;
    }
    return apiClient.get<PageResponse<AnomalyAlert>>(url);
  },

  resolve: (id: number, data: ResolveAlertRequest): Promise<ApiResponse<AnomalyAlert>> => {
    return apiClient.put<AnomalyAlert>(`/alerts/${id}/resolve`, data);
  },
};

