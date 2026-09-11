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
