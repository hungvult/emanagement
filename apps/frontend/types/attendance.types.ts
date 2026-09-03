export interface AttendanceHistory {
  id: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  kioskName: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: "ON_TIME" | "LATE" | "EARLY_LEAVE";
  snapshotUrl: string | null;
}
