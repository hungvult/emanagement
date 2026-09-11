export interface KioskRegisterRequest {
  name: string;
}

export interface KioskCheckInRequest {
  imageFrameBase64: string;
}

export interface KioskCheckInResponse {
  userId: number;
  employeeCode: string;
  fullName: string;
  checkType: string;
  checkTime: string;
  attendanceStatus: string;
  confidence: number;
  message: string;
}
