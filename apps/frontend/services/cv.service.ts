import { apiClient } from "@/lib/api-client";

export interface FrameValidationResponse {
  status: string;
  message?: string;
}

// CV responses use their own status envelope, unlike the business API.
export const cvService = {
  async validateFrame(
    image: string,
    checkPose: boolean,
  ): Promise<FrameValidationResponse> {
    const response: unknown = await apiClient.post(
      "/cv/validate-frame",
      {
        image,
        check_pose: checkPose,
      },
      { baseURL: "/api/v1" },
    );
    if (
      !response ||
      typeof response !== "object" ||
      !("status" in response) ||
      typeof response.status !== "string"
    ) {
      throw new Error("Phản hồi kiểm tra ảnh không hợp lệ");
    }
    return response as FrameValidationResponse;
  },
  async enroll(userId: number, images: string[]): Promise<void> {
    const response: unknown = await apiClient.post(
      "/cv/enroll",
      {
        userId,
        images,
      },
      { baseURL: "/api/v1", timeout: 60000 },
    );
    if (
      !response ||
      typeof response !== "object" ||
      !("status" in response) ||
      response.status !== "ENROLLMENT_SUCCESS"
    ) {
      const message =
        response &&
        typeof response === "object" &&
        "message" in response &&
        typeof response.message === "string"
          ? response.message
          : "Lỗi khi xử lý khuôn mặt từ AI";
      throw new Error(message);
    }
  },
};
