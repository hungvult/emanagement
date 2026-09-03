export interface LoginRequest {
  identifier: string;
  password: string;
  otpCode?: string;
}

export interface JwtResponse {
  accessToken: string;
  tokenType: string;
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  roles: string[];
}

export interface SendOtpRequest {
  identifier: string;
  type: "LOGIN_2FA" | "VERIFY_EMAIL" | "VERIFY_PHONE" | "RESET_PASSWORD" | "UPDATE_PROFILE";
}

export interface VerifyOtpRequest {
  identifier: string;
  otpCode: string;
  type: string;
}

export interface ResetPasswordRequest {
  identifier: string;
  otpCode: string;
  newPassword: string;
}

export interface UserProfile {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string | null;
  phone?: string | null;
  roles: string[];
  avatarUrl?: string | null;
}

export interface UpdateProfileRequest {
  fullName: string;
  email?: string;
  phone?: string;
  otpCode: string;
}

export interface ChangePasswordRequest {
  oldPassword?: string;
  newPassword?: string;
}

