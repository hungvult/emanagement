export type NotificationType = "SHIFT_ASSIGNED" | "SHIFT_CHANGED" | "LEAVE_APPROVED" | "LEAVE_REJECTED" | "SYSTEM_ALERT";

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceId: number | null;
  read: boolean;
  createdAt: string;
}
