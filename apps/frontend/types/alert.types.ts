export interface AnomalyAlert {
  id: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  alertType: string;
  alertDate: string;
  description: string;
  isResolved: boolean;
  resolvedByName: string | null;
  createdAt: string;
}

export interface ResolveAlertRequest {
  resolvedByUserId: number;
}
