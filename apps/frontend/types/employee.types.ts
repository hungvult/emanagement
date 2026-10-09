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

export interface FaceImagesResponse {
  userId: number;
  employeeCode: string;
  fullName: string;
  frontImageUrl: string | null;
  blinkImageUrl: string | null;
  leftImageUrl: string | null;
  rightImageUrl: string | null;
  upImageUrl: string | null;
  registeredAt: string;
}

export interface EmployeeColumnVisibility {
  employeeCode: boolean;
  fullName: boolean;
  emailPhone: boolean;
  status: boolean;
  ekycFaceId: boolean;
  createdAt: boolean;
  actions: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: EmployeeColumnVisibility = {
  employeeCode: true,
  fullName: true,
  emailPhone: true,
  status: true,
  ekycFaceId: true,
  createdAt: true,
  actions: true,
};

export type BulkImportStatus =
  | "PENDING"
  | "VALIDATING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface BulkImportJob {
  id: number;
  fileName: string;
  fileSize: number;
  status: BulkImportStatus;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  failedCount: number;
  progressPercentage: number;
  errorLog?: string | null;
  createdByUserName?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}


