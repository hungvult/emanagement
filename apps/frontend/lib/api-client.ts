import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { ApiResponse } from "../types/common.types";

// Tạo instance axios với cấu hình mặc định
const instance: AxiosInstance = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8080/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Thêm interceptor để tự động gắn token vào request
instance.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor cho response (xử lý lỗi chung như 401 Unauthorized)
instance.interceptors.response.use(
  (response) => {
    return response.data; // Trả về ApiResponse<T>
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Wrapper methods để TypeScript type inference chính xác ApiResponse<T>
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.get(url, config) as unknown as Promise<ApiResponse<T>>;
  },
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.post(url, data, config) as unknown as Promise<ApiResponse<T>>;
  },
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.put(url, data, config) as unknown as Promise<ApiResponse<T>>;
  },
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.delete(url, config) as unknown as Promise<ApiResponse<T>>;
  },
};

