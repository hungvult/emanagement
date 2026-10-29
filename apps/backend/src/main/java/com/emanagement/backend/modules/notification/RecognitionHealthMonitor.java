package com.emanagement.backend.modules.notification;

import java.net.URI;
import java.net.http.*;
import java.time.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RecognitionHealthMonitor {
    private final NotificationService notifications;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    @Value("${ai-service.base-url:http://localhost:8000}")
    private String serviceUrl;
    private int consecutiveFailures;
    private String incident;

    @Scheduled(fixedDelayString = "${notifications.health-poll-ms:60000}", initialDelay = 60000)
    public void check() {
        boolean healthy;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(serviceUrl + "/api/v1/cv/health"))
                    .timeout(Duration.ofSeconds(5)).GET().build();
            healthy = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return;
        } catch (Exception unavailable) { healthy = false; }
        update(healthy, LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    void update(boolean healthy, LocalDateTime now) {
        if (healthy) {
            consecutiveFailures = 0;
            if (incident != null) {
                notifications.notifyAdminsOnce(NotificationType.SERVICE_RECOVERED, "Dịch vụ nhận diện đã phục hồi",
                        "Dịch vụ nhận diện khuôn mặt đã kết nối lại. Có thể tiếp tục chấm công.", null,
                        "/notifications", "cv-recovered:" + incident, null);
                incident = null;
            }
        } else if (++consecutiveFailures >= 3 && incident == null) {
            String key = now.toString();
            notifications.notifyAdminsOnce(NotificationType.SERVICE_UNAVAILABLE, "Dịch vụ nhận diện mất kết nối",
                    "Không kết nối được dịch vụ nhận diện trong 3 lần kiểm tra liên tiếp. Vui lòng kiểm tra hệ thống chấm công.",
                    null, "/notifications", "cv-unavailable:" + key, null);
            incident = key;
        }
    }
}
