export type NotificationType = "SHIFT_ASSIGNED" | "SHIFT_CHANGED" | "SHIFT_REMOVED"
  | "LEAVE_REQUESTED" | "LEAVE_APPROVED" | "LEAVE_REJECTED" | "ATTENDANCE_ADJUSTED"
  | "IMPORT_COMPLETED" | "IMPORT_FAILED" | "FACE_REGISTRATION_REQUIRED" | "SHIFT_REMINDER"
  | "MISSING_CHECK_IN" | "MISSING_CHECK_OUT" | "DAILY_ATTENDANCE_SUMMARY"
  | "SERVICE_UNAVAILABLE" | "SERVICE_RECOVERED";

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceId: number | null;
  targetUrl?: string | null;
  read: boolean;
  createdAt: string;
}
