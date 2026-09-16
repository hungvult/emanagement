package com.emanagement.backend.modules.kiosk;

import com.emanagement.backend.modules.kiosk.dto.KioskCheckInRequestDto;
import com.emanagement.backend.modules.kiosk.dto.KioskCheckInResponseDto;
import com.emanagement.backend.modules.kiosk.dto.KioskRegisterDto;

public interface KioskService {
    KioskCheckInResponseDto processCheckIn(String deviceToken, KioskCheckInRequestDto request);

    Kiosk registerKiosk(KioskRegisterDto dto);

    Kiosk getKioskByToken(String deviceToken);

    java.util.List<com.emanagement.backend.modules.kiosk.dto.KioskResponseDto> getAllKiosks();

    com.emanagement.backend.modules.kiosk.dto.KioskResponseDto updateKiosk(Long id, com.emanagement.backend.modules.kiosk.dto.KioskUpdateDto dto);

    com.emanagement.backend.modules.kiosk.dto.KioskResponseDto regenerateKioskToken(Long id);

    com.emanagement.backend.modules.kiosk.dto.KioskHeartbeatResponseDto processHeartbeat(String deviceToken);
}
