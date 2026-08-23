package com.emanagement.backend.modules.kiosk;

import com.emanagement.backend.modules.kiosk.dto.KioskCheckInRequestDto;
import com.emanagement.backend.modules.kiosk.dto.KioskCheckInResponseDto;
import com.emanagement.backend.modules.kiosk.dto.KioskRegisterDto;

public interface KioskService {
    KioskCheckInResponseDto processCheckIn(String deviceToken, KioskCheckInRequestDto request);

    Kiosk registerKiosk(KioskRegisterDto dto);

    Kiosk getKisokByToken(String deviceToken);
}
