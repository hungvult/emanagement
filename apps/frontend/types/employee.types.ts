export interface EmployeeResponse {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
  roles: string[];
  hasRegisteredFace: boolean;
  createdAt: string;
}

export interface EmployeeCreate {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface EmployeeUpdate {
  fullName: string;
  phone?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface LiveEkycEnrollRequest {
  userId: number;
  faceImagesBase64: string[];
}

export interface LiveEkycEnrollResponse {
  userId: number;
  employeeCode: string;
  vectorCounterSaved: number;
  message: string;
}
