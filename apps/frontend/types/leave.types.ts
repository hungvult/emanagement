export interface LeaveRequestResponse {
  id: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedByName: string | null;
  createdAt: string;
}

export interface LeaveRequestCreate {
  userId: number;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveApproval {
  approvedByUserId: number;
  status: "APPROVED" | "REJECTED";
}
