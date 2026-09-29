import { apiClient } from "../lib/api-client";
import { ApiResponse, PageResponse } from "../types/common.types";
import { NotificationResponse } from "../types/notification.types";

export const notificationService = {
  getMyNotifications: (page: number = 0, size: number = 10): Promise<ApiResponse<PageResponse<NotificationResponse>>> => {
    return apiClient.get<PageResponse<NotificationResponse>>(`/notifications/my?page=${page}&size=${size}`);
  },

  getUnreadCount: (): Promise<ApiResponse<number>> => {
    return apiClient.get<number>("/notifications/unread-count");
  },

  markAsRead: (notificationId: number): Promise<ApiResponse<void>> => {
    return apiClient.put<void>(`/notifications/${notificationId}/read`);
  },

  markAllAsRead: (): Promise<ApiResponse<void>> => {
    return apiClient.put<void>("/notifications/read-all");
  },

  deleteNotification: (notificationId: number): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/notifications/${notificationId}`);
  },
};
