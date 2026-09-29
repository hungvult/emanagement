export interface ShiftResponse {
  id: number;
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
}

export interface ShiftCreate {
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
}

export interface AssignShift {
  userId: number;
  shiftId: number;
  assignedDate: string;
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
  assignedDate: string; // YYYY-MM-DD
}
