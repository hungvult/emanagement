package com.emanagement.backend.modules.notification;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import com.emanagement.backend.modules.attendance.*;
import com.emanagement.backend.modules.employee.*;
import com.emanagement.backend.modules.shift.*;
import com.emanagement.backend.modules.leave.*;
import com.emanagement.backend.modules.face.FaceDataRepository;
import com.emanagement.backend.modules.bulkimport.*;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AttendanceNotificationScheduler {
    private final EmployeeShiftRepository shifts;
    private final AttendanceRecordRepository attendance;
    private final LeaveRequestRepository leaves;
    private final UserRepository users;
    private final FaceDataRepository faces;
    private final NotificationService notifications;
    private final BulkImportJobRepository jobs;
    private final ImportNotificationService imports;

    @Value("${notifications.shift-reminder-minutes:15}")
    private int reminderMinutes = 15;
    @Value("${notifications.checkout-wait-minutes:30}")
    private int checkoutWaitMinutes = 30;

    @Scheduled(fixedDelayString = "${notifications.poll-ms:60000}", initialDelayString = "${notifications.initial-delay-ms:60000}")
    @Transactional
    public void tick() {
        process(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    void process(LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        List<EmployeeShift> assignments = shifts.findByAssignedDateBetweenOrderByAssignedDateAsc(today, today);
        Set<Long> userIds = assignments.stream().map(s -> s.getUser().getId()).collect(Collectors.toSet());
        Map<Long, List<AttendanceRecord>> records = userIds.isEmpty() ? Map.of()
                : attendance.findByUserIdInAndCheckInTimeBetween(userIds, today.atStartOfDay(), today.atTime(LocalTime.MAX))
                .stream().collect(Collectors.groupingBy(a -> a.getUser().getId()));
        Set<Long> onLeave = userIds.isEmpty() ? Set.of() : leaves.findApprovedOverlapping(userIds, today, today)
                .stream().map(l -> l.getUser().getId()).collect(Collectors.toSet());
        List<User> admins = users.findActiveAdmins();
        notifications.dismissUnassignedReminders(assignments.stream().map(EmployeeShift::getId).toList());
        for (EmployeeShift s : assignments) {
            User user = s.getUser();
            String upcoming = "upcoming:" + s.getId();
            String missingIn = "missing-in:" + s.getId();
            String missingOut = "missing-out:" + s.getId();
            List<String> stale = new ArrayList<>(List.of(upcoming, missingIn, missingOut));
            admins.forEach(a -> { stale.add(missingIn + ":admin:" + a.getId()); stale.add(missingOut + ":admin:" + a.getId()); });
            if (!"ACTIVE".equals(user.getStatus()) || onLeave.contains(user.getId())) {
                notifications.dismiss(stale);
                continue;
            }
            List<AttendanceRecord> personal = records.getOrDefault(user.getId(), List.of()).stream()
                    .filter(a -> !a.getCheckInTime().isAfter(now) && a.getShift() != null && a.getShift().getId().equals(s.getShift().getId())).toList();
            boolean checkedIn = !personal.isEmpty();
            boolean checkedOut = checkedIn && personal.stream().allMatch(a -> a.getCheckOutTime() != null && !a.getCheckOutTime().isAfter(now));
            LocalDateTime start = today.atTime(s.getStartTime());
            LocalDateTime end = today.atTime(s.getEndTime());
            String target = "/attendance?startDate=" + today + "&endDate=" + today;
            if (checkedIn) {
                notifications.dismiss(List.of(upcoming, missingIn));
                notifications.dismiss(admins.stream().map(a -> missingIn + ":admin:" + a.getId()).toList());
            } else if (!now.isBefore(start.minusMinutes(reminderMinutes)) && now.isBefore(start)) {
                notifications.notifyOnce(user, NotificationType.SHIFT_REMINDER, "Ca làm sắp bắt đầu",
                        s.getShiftName() + " bắt đầu lúc " + s.getStartTime() + " hôm nay.", s.getId(),
                        "/my-schedule", upcoming, start);
            } else if (now.isAfter(start.plusMinutes(s.getGracePeriodMinutes() == null ? 15 : s.getGracePeriodMinutes()))
                    && now.isBefore(end)) {
                notifications.notifyOnce(user, NotificationType.MISSING_CHECK_IN, "Bạn chưa chấm công vào",
                        "Ca " + s.getShiftName() + " hôm nay đã bắt đầu. Vui lòng kiểm tra chấm công.", s.getId(),
                        target, missingIn, today.plusDays(1).atStartOfDay());
            }
            if (checkedOut) {
                notifications.dismiss(List.of(missingOut));
                notifications.dismiss(admins.stream().map(a -> missingOut + ":admin:" + a.getId()).toList());
            } else if (checkedIn && !now.isBefore(end.plusMinutes(checkoutWaitMinutes))) {
                notifications.notifyOnce(user, NotificationType.MISSING_CHECK_OUT, "Bạn chưa chấm công ra",
                        "Ca " + s.getShiftName() + " hôm nay đã kết thúc. Vui lòng kiểm tra giờ ra.", s.getId(),
                        target, missingOut, today.plusDays(1).atStartOfDay());
                for (User admin : admins) notifications.notifyOnce(admin, NotificationType.MISSING_CHECK_OUT,
                        "Nhân viên thiếu chấm công ra", user.getFullName() + " (" + user.getEmployeeCode()
                                + ") chưa chấm công ra ca " + s.getShiftName() + ".", s.getId(),
                        target + "&search=" + user.getEmployeeCode(), missingOut + ":admin:" + admin.getId(),
                        today.plusDays(1).atStartOfDay());
            }
        }
        for (BulkImportJob job : jobs.findByStatusInAndFinishedAtAfter(
                List.of(BulkImportStatus.COMPLETED, BulkImportStatus.FAILED),
                now.minusDays(2).atOffset(ZoneOffset.ofHours(7)))) imports.notifyResult(job);
    }

    @Scheduled(cron = "${notifications.daily-summary-cron:0 30 18 * * *}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void dailySummary() {
        summarize(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    void summarize(LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        List<EmployeeShift> assignments = shifts.findByAssignedDateBetweenOrderByAssignedDateAsc(today, today);
        Set<Long> ids = assignments.stream().map(s -> s.getUser().getId()).collect(Collectors.toSet());
        List<AttendanceRecord> records = ids.isEmpty() ? List.of() : attendance.findByUserIdInAndCheckInTimeBetween(
                ids, today.atStartOfDay(), today.atTime(LocalTime.MAX));
        Map<String, EmployeeShift> planned = assignments.stream().collect(Collectors.toMap(
                s -> s.getUser().getId() + ":" + s.getShift().getId(), s -> s, (a, b) -> a));
        int late = 0, early = 0, missing = 0;
        Set<String> present = new HashSet<>();
        for (AttendanceRecord record : records) {
            EmployeeShift s = record.getShift() == null ? null : planned.get(record.getUser().getId() + ":" + record.getShift().getId());
            if (s == null || record.getCheckInTime().isAfter(now)) continue;
            present.add(record.getUser().getId() + ":" + record.getShift().getId());
            if (record.getCheckInTime().isAfter(today.atTime(s.getStartTime()).plusMinutes(s.getGracePeriodMinutes() == null ? 15 : s.getGracePeriodMinutes()))) late++;
            if (record.getCheckOutTime() != null && !record.getCheckOutTime().isAfter(now)
                    && record.getCheckOutTime().isBefore(today.atTime(s.getEndTime()))) early++;
            if (record.getCheckOutTime() == null && now.isAfter(today.atTime(s.getEndTime()).plusMinutes(checkoutWaitMinutes))) missing++;
        }
        Set<Long> onLeave = ids.isEmpty() ? Set.of() : leaves.findApprovedOverlapping(ids, today, today)
                .stream().map(l -> l.getUser().getId()).collect(Collectors.toSet());
        long absent = assignments.stream().filter(s -> "ACTIVE".equals(s.getUser().getStatus())
                && !onLeave.contains(s.getUser().getId())
                && now.isAfter(today.atTime(s.getStartTime()).plusMinutes(s.getGracePeriodMinutes() == null ? 15 : s.getGracePeriodMinutes()))
                && !present.contains(s.getUser().getId() + ":" + s.getShift().getId())).count();
        notifications.notifyAdminsOnce(NotificationType.DAILY_ATTENDANCE_SUMMARY, "Tổng hợp chấm công ngày " + today,
                late + " lượt đi muộn, " + early + " lượt về sớm, " + absent + " lượt chưa chấm công vào, " + missing + " lượt thiếu giờ ra.", null,
                "/attendance?startDate=" + today + "&endDate=" + today, "daily:" + today, null);
    }

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void remindFaceRegistration() {
        Set<Long> registered = new HashSet<>(faces.findRegisteredUserIds());
        for (User user : users.findActiveEmployees()) {
            String key = "face-registration:" + user.getId();
            if (registered.contains(user.getId())) notifications.dismiss(List.of(key));
            else notifications.notifyOnce(user, NotificationType.FACE_REGISTRATION_REQUIRED,
                    "Hoàn tất đăng ký khuôn mặt", "Vui lòng liên hệ quản trị viên để đăng ký khuôn mặt trước khi chấm công.",
                    user.getId(), "/profile", key, null);
        }
    }
}
