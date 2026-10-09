export interface AnomalyAlert {
  id: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  shiftId?: number | null;
  shiftName?: string | null;
  alertType: string;
  alertDate: string;
  description: string;
  isResolved: boolean;
  resolvedByName: string | null;
  createdAt: string;
}

export interface AlertFilters {
  isResolved?: boolean;
  startDate?: string;
  endDate?: string;
  shiftId?: number | string;
}

export interface ResolveAlertRequest {
  resolvedByUserId: number;
}
