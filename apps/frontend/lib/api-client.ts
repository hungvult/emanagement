import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { ApiResponse } from "../types/common.types";

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

const storage = () => typeof window === "undefined" ? null : window.localStorage;
let refreshPromise: Promise<string> | null = null;
const LOCK_DURATION = 20000;
const WAIT_TIMEOUT = 40000;

const purgeSessionAndRedirect = () => {
  const store = storage();
  store?.removeItem("access_token");
  store?.removeItem("refresh_token");
  if (typeof window !== "undefined" && !["/login", "/forgot-password"].includes(window.location.pathname)) {
    window.location.assign("/login");
  }
};

const refreshAccessToken = async (requestToken: string | null): Promise<string> => {
  const store = storage();
  const currentToken = store?.getItem("access_token");
  if (currentToken && currentToken !== requestToken) return currentToken;
  const refreshToken = store?.getItem("refresh_token");
  if (!refreshToken) {
    purgeSessionAndRedirect();
    throw new Error("Phiên đăng nhập đã hết hạn");
  }
  try {
    const response = await axios.post(`${instance.defaults.baseURL}/auth/refresh-token`, { refreshToken }, { timeout: 15000 });
    const tokenData = response.data?.data || response.data;
    if (!tokenData?.accessToken || typeof tokenData.accessToken !== "string") {
      throw new Error("Máy chủ không trả về access token hợp lệ");
    }
    // Do not revive a session after logout or overwrite a new login.
    if (store?.getItem("refresh_token") !== refreshToken) throw new Error("Phiên đăng nhập đã thay đổi");
    // Publish the access token after its matching refresh token.
    if (typeof tokenData.refreshToken === "string" && tokenData.refreshToken) {
      store?.setItem("refresh_token", tokenData.refreshToken);
    }
    store?.setItem("access_token", tokenData.accessToken);
    return tokenData.accessToken;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if ((status === 400 || status === 401 || status === 403) && store?.getItem("refresh_token") === refreshToken) {
      purgeSessionAndRedirect();
    }
    // Preserve the session on network/5xx failures so the user can retry.
    throw error;
  }
};

const coordinateRefresh = async (requestToken: string | null): Promise<string> => {
  if (typeof navigator !== "undefined" && navigator.locks) {
    // Browser-owned locks are released automatically when a tab is closed.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WAIT_TIMEOUT);
    try {
      return await navigator.locks.request("emanagement-token-refresh", { signal: controller.signal }, () => refreshAccessToken(requestToken));
    } finally {
      clearTimeout(timer);
    }
  }
  // Fallback: bounded polling and an expiring lease, including takeover of a closed tab.
  const store = storage();
  const deadline = Date.now() + WAIT_TIMEOUT;
  while (Date.now() < deadline) {
    const currentToken = store?.getItem("access_token");
    if (!currentToken) throw new Error("Phiên đăng nhập đã kết thúc");
    if (currentToken !== requestToken) return currentToken;
    const existing = store?.getItem("refresh_in_progress");
    const startedAt = Number(existing?.split(":")[0]);
    if (!existing || !Number.isFinite(startedAt) || Date.now() - startedAt >= LOCK_DURATION) {
      const lease = `${Date.now()}:${Math.random()}`;
      store?.setItem("refresh_in_progress", lease);
      // Allow competing tabs to publish their leases before checking ownership.
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (store?.getItem("refresh_in_progress") !== lease) continue;
      try {
        return await refreshAccessToken(requestToken);
      } finally {
        if (store?.getItem("refresh_in_progress") === lease) store.removeItem("refresh_in_progress");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chờ làm mới phiên đăng nhập quá lâu. Vui lòng thử lại.");
};

instance.interceptors.request.use((config) => {
  const token = storage()?.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const request = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!request || error.response?.status !== 401) return Promise.reject(error);
    // Public auth failures must not invalidate an existing session.
    if (request.url?.startsWith("/auth/") && !["/auth/me", "/auth/profile", "/auth/change-password"].includes(request.url)) {
      return Promise.reject(error);
    }
    if (request._retry) {
      purgeSessionAndRedirect();
      return Promise.reject(error);
    }
    request._retry = true;
    const header = request.headers.Authorization;
    const requestToken = typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : null;
    if (!refreshPromise) {
      refreshPromise = coordinateRefresh(requestToken).finally(() => { refreshPromise = null; });
    }
    try {
      const token = await refreshPromise;
      if (request.signal?.aborted) return Promise.reject(new axios.CanceledError());
      request.headers.Authorization = `Bearer ${token}`;
      return instance(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => instance.get(url, config) as unknown as Promise<ApiResponse<T>>,
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => instance.post(url, data, config) as unknown as Promise<ApiResponse<T>>,
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => instance.put(url, data, config) as unknown as Promise<ApiResponse<T>>,
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => instance.delete(url, config) as unknown as Promise<ApiResponse<T>>,
};

