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

// Helper làm sạch session và điều hướng về trang đăng nhập
const purgeSessionAndRedirect = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh_in_progress");
    if (window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
      window.location.href = "/login";
    }
  }
};

// Xử lý hàng đợi: nếu không có token hoặc có lỗi, reject tất cả promises để tránh treo request
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error || !token) {
      prom.reject(error || new Error("Failed to refresh token"));
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Multi-Tab Session Coordination: Lắng nghe sự kiện thay đổi localStorage từ các tab khác
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === "access_token") {
      if (event.newValue) {
        // Tab khác đã refresh token thành công, giải phóng hàng đợi ở tab này
        if (isRefreshing) {
          isRefreshing = false;
          processQueue(null, event.newValue);
        }
      } else {
        // Tab khác đã đăng xuất
        purgeSessionAndRedirect();
      }
    }
  });
}

// Interceptor cho response: unwrap ApiResponse<T>, xử lý 401 với silent refresh và hàng đợi
instance.interceptors.response.use(
  (response) => {
    return response.data; // Trả về ApiResponse<T>
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      const url = originalRequest?.url || "";

      // Không lặp refresh nếu chính request đăng nhập, refresh hoặc logout bị 401
      if (url.includes("/auth/login") || url.includes("/auth/refresh-token") || url.includes("/auth/logout")) {
        purgeSessionAndRedirect();
        return Promise.reject(error);
      }

      // Multi-Tab Coordination: Kiểm tra xem token trong localStorage đã được cập nhật bởi tab khác hay chưa
      const authHeader = originalRequest?.headers?.Authorization;
      const requestToken = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "") : null;
      const currentStoredToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

      if (currentStoredToken && requestToken && currentStoredToken !== requestToken) {
        originalRequest._retry = true;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${currentStoredToken}`;
        }
        return instance(originalRequest);
      }

      // Kiểm tra xem có tab khác hoặc tác vụ nội bộ đang thực hiện refresh hay không
      const refreshLock = typeof window !== "undefined" ? localStorage.getItem("refresh_in_progress") : null;
      const isAnotherTabRefreshing = refreshLock && (Date.now() - parseInt(refreshLock, 10)) < 10000;

      if (isRefreshing || isAnotherTabRefreshing) {
        isRefreshing = true;
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest._retry = true;
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
        purgeSessionAndRedirect();
        return Promise.reject(error);
      }

      // Đánh dấu khóa refresh để các tab khác không gọi trùng lặp
      if (typeof window !== "undefined") {
        localStorage.setItem("refresh_in_progress", Date.now().toString());
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
        const newAccessToken = tokenData?.accessToken;
        const newRefreshToken = tokenData?.refreshToken;

        // Xác thực nghiêm ngặt access token mới
        if (!newAccessToken || typeof newAccessToken !== "string") {
          throw new Error("Invalid access token received from refresh endpoint");
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", newAccessToken);
          // Chỉ lưu refresh token nếu là chuỗi hợp lệ, tránh ghi chuỗi "undefined"
          if (newRefreshToken && typeof newRefreshToken === "string") {
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
        purgeSessionAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        if (typeof window !== "undefined") {
          localStorage.removeItem("refresh_in_progress");
        }
      }
    }

    // Nếu request đã qua retry mà vẫn bị 401 thì thu hồi session và điều hướng
    if (error.response?.status === 401 && originalRequest?._retry) {
      purgeSessionAndRedirect();
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

