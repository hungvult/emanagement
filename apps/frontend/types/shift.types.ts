export interface ShiftResponse {
  id: number;
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  active: boolean;
}

export interface ShiftCreate {
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
}

export interface ShiftUpdate {
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
  effectiveFrom?: string; // YYYY-MM-DD
  active?: boolean;
}

export interface AssignShift {
  userId: number;
  shiftId: number;
  assignedDate: string;
}

export interface BulkAssignRequest {
  userIds?: number[];
  shiftId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysOfWeek?: string[]; // e.g. ["MONDAY", "TUESDAY", ...]
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface BulkAssignItem {
  userId: number;
  employeeCode: string;
  fullName: string;
  date: string;
  action: "CREATED" | "UPDATED" | "UNCHANGED" | "SKIPPED";
  reason?: string | null;
}

export interface BulkAssignResult {
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  items: BulkAssignItem[];
}

export interface CopyWeekRequest {
  sourceWeekStart: string; // YYYY-MM-DD
  targetWeekStart: string; // YYYY-MM-DD
  userIds?: number[];
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface EmployeeShiftResponse {
  id: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  shiftId: number;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
  assignedDate: string; // YYYY-MM-DD
}

