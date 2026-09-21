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

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor cho response (xử lý lỗi chung như 401 Unauthorized và silent refresh kèm hàng đợi)
instance.interceptors.response.use(
  (response) => {
    return response.data; // Trả về ApiResponse<T>
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      const url = originalRequest?.url || "";
      // Nếu chính request đăng nhập, refresh hoặc logout bị 401 thì không refresh lặp lại
      if (url.includes("/auth/login") || url.includes("/auth/refresh-token") || url.includes("/auth/logout")) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          if (window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return instance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

      if (!refreshToken) {
        isRefreshing = false;
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          if (window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }

      try {
        const baseURL =
          instance.defaults.baseURL ||
          process.env.NEXT_PUBLIC_API_URL ||
          process.env.NEXT_PUBLIC_API_BASE_URL ||
          "http://localhost:8080/api/v1";

        const response = await axios.post(`${baseURL}/auth/refresh-token`, {
          refreshToken,
        });

        const tokenData = response.data?.data || response.data;
        const newAccessToken = tokenData.accessToken;
        const newRefreshToken = tokenData.refreshToken;

        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem("refresh_token", newRefreshToken);
          }
        }

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null, newAccessToken);
        return instance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          if (window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401 && originalRequest?._retry) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        if (window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
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

