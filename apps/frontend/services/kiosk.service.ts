import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/common.types";
import { KioskCheckInRequest, KioskCheckInResponse } from "@/types/kiosk.types";

export const kioskService = {
  checkIn: (
    deviceToken: string,
    data: KioskCheckInRequest,
  ): Promise<ApiResponse<KioskCheckInResponse>> => {
    return apiClient.post<KioskCheckInResponse>("/kiosks/check-in", data, {
      headers: {
        "X-Kiosk-Token": deviceToken,
      },
    });
  },
};
