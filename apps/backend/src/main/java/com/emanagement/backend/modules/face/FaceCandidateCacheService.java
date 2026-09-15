package com.emanagement.backend.modules.face;

import com.emanagement.backend.modules.face.dto.AiCandidateDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Service quản lý bộ nhớ đệm (In-Memory Cache) cho các vector đặc trưng khuôn
 * mặt.
 * Giúp triệt tiêu hoàn toàn việc truy vấn DB và parse hàng nghìn chuỗi
 * String-to-Double
 * ở mỗi lượt nhân viên đứng trước camera chấm công.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FaceCandidateCacheService {

    private final FaceDataRepository faceDataRepository;
    private final AtomicReference<List<AiCandidateDto>> cache = new AtomicReference<>(null);

    /**
     * Lấy danh sách vector ứng viên từ cache RAM (0ms latency).
     * Nếu cache rỗng, tải từ DB và parse một lần duy nhất.
     */
    public List<AiCandidateDto> getCandidates() {
        List<AiCandidateDto> current = cache.get();
        if (current != null) {
            return current;
        }

        synchronized (this) {
            current = cache.get();
            if (current != null) {
                return current;
            }

            log.info("Nạp danh sách vector khuôn mặt từ CSDL vào In-Memory Cache...");
            List<FaceData> allFaceData = faceDataRepository.findAll();
            List<AiCandidateDto> loaded = new ArrayList<>(allFaceData.size());

            for (FaceData face : allFaceData) {
                if (face.getUser() != null && face.getFaceVector() != null) {
                    List<Double> vec = parseVectorString(face.getFaceVector());
                    if (!vec.isEmpty()) {
                        loaded.add(new AiCandidateDto(face.getUser().getId(), vec));
                    }
                }
            }

            List<AiCandidateDto> unmodifiable = Collections.unmodifiableList(loaded);
            cache.set(unmodifiable);
            log.info("Đã nạp thành công {} vector khuôn mặt vào Cache.", unmodifiable.size());
            return unmodifiable;
        }
    }

    /**
     * Xóa cache khi có thay đổi dữ liệu nhân viên (đăng ký mới eKYC, xóa face data,
     * xóa nhân viên).
     */
    public void evictCache() {
        log.info("Xóa cache vector ứng viên (dữ liệu eKYC khuôn mặt đã thay đổi).");
        cache.set(null);
    }

    private List<Double> parseVectorString(String vectorStr) {
        List<Double> list = new ArrayList<>();
        if (vectorStr == null || vectorStr.isBlank())
            return list;
        String clean = vectorStr.replace("[", "").replace("]", "").trim();
        if (clean.isEmpty())
            return list;

        String[] parts = clean.split(",");
        for (String p : parts) {
            try {
                list.add(Double.parseDouble(p.trim()));
            } catch (NumberFormatException ignored) {
            }
        }
        return list;
    }
}
