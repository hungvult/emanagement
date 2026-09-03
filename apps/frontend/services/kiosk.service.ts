import { apiClient } from "../lib/api-client";
import { ApiResponse } from "../types/common.types";
import { KioskRegisterRequest, KioskCheckInRequest, KioskCheckInResponse } from "../types/kiosk.types";

export const kioskService = {
  register: (data: KioskRegisterRequest): Promise<ApiResponse<any>> => {
    return apiClient.post<any>("/kiosks/register", data);
  },

  checkIn: (deviceToken: string, data: KioskCheckInRequest): Promise<ApiResponse<KioskCheckInResponse>> => {
    return apiClient.post<KioskCheckInResponse>("/kiosks/check-in", data, {
      headers: {
        "X-Kiosk-Token": deviceToken,
      },
    });
  },
};

