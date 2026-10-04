export interface AttendanceHistory {
  id: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  kioskName: string;
  shiftId?: number | null;
  shiftName?: string | null;
  workDate?: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: "ON_TIME" | "LATE" | "EARLY_LEAVE" | "NO_DATA" | string;
  snapshotUrl: string | null;
  checkoutSnapshotUrl?: string | null;
}
