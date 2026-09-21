import { apiClient } from "../lib/api-client";
import { ApiResponse } from "../types/common.types";
import {
  LoginRequest,
  JwtResponse,
  SendOtpRequest,
  VerifyOtpRequest,
  ResetPasswordRequest,
  UserProfile,
  UpdateProfileRequest,
  TokenRefreshResponse,
} from "../types/auth.types";

export const authService = {
  login: (data: LoginRequest): Promise<ApiResponse<JwtResponse>> => {
    return apiClient.post<JwtResponse>("/auth/login", data);
  },

  refreshToken: (refreshToken: string): Promise<ApiResponse<TokenRefreshResponse>> => {
    return apiClient.post<TokenRefreshResponse>("/auth/refresh-token", { refreshToken });
  },

  logout: (refreshToken?: string): Promise<ApiResponse<void>> => {
    return apiClient.post<void>("/auth/logout", { refreshToken });
  },

  sendOtp: (data: SendOtpRequest): Promise<ApiResponse<void>> => {
    return apiClient.post<void>("/auth/send-otp", data);
  },

  verifyOtp: (data: VerifyOtpRequest): Promise<ApiResponse<boolean>> => {
    return apiClient.post<boolean>("/auth/verify-otp", data);
  },

  resetPassword: (data: ResetPasswordRequest): Promise<ApiResponse<void>> => {
    return apiClient.post<void>("/auth/reset-password", data);
  },

  getCurrentUser: (): Promise<ApiResponse<UserProfile>> => {
    return apiClient.get<UserProfile>("/auth/me");
  },

  updateProfile: (data: UpdateProfileRequest): Promise<ApiResponse<UserProfile>> => {
    return apiClient.put<UserProfile>("/auth/profile", data);
  },

  changePassword: (data: any): Promise<ApiResponse<void>> => {
    return apiClient.put<void>("/auth/change-password", data);
  },
};

