import { apiClient } from "@/lib/api-client";
import { ApiResponse, PageResponse } from "@/types/common.types";
import {
  EmployeeCreate,
  EmployeeResponse,
  EmployeeUpdate,
  FaceImagesResponse,
} from "@/types/employee.types";

export const employeeService = {
  getAll: (
    page: number = 0,
    size: number = 10,
    filters?: {
      keyword?: string;
      status?: string;
      hasRegisteredFace?: boolean;
    },
  ): Promise<ApiResponse<PageResponse<EmployeeResponse>>> => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("size", size.toString());
    if (filters?.keyword) params.set("keyword", filters.keyword);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.hasRegisteredFace !== undefined)
      params.set("hasRegisteredFace", filters.hasRegisteredFace.toString());
    return apiClient.get<PageResponse<EmployeeResponse>>(
      `/employees?${params.toString()}`,
    );
  },

  create: (data: EmployeeCreate): Promise<ApiResponse<EmployeeResponse>> => {
    return apiClient.post<EmployeeResponse>("/employees", data);
  },

  update: (
    id: number,
    data: EmployeeUpdate,
  ): Promise<ApiResponse<EmployeeResponse>> => {
    return apiClient.put<EmployeeResponse>(`/employees/${id}`, data);
  },

  delete: (id: number): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/employees/${id}`);
  },

  deleteFaceData: (id: number): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/employees/${id}/face`);
  },
  enrollFaceWithAi: async (userId: number, images: string[]): Promise<any> => {
    const aiBaseUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000";
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const res = await fetch(`${aiBaseUrl}/api/v1/cv/enroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        userId,
        images,
      }),
    });
    return res.json();
  },

  getFaceImages: (id: number): Promise<ApiResponse<FaceImagesResponse>> => {
    return apiClient.get<FaceImagesResponse>(`/employees/${id}/face-images`);
  },
};
