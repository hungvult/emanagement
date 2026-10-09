package com.emanagement.backend.modules.shift;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.util.CodeGeneratorUtils;
import com.emanagement.backend.modules.attendance.AttendanceRecord;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.LeaveRequest;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;
import com.emanagement.backend.modules.notification.NotificationService;
import com.emanagement.backend.modules.notification.NotificationType;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.BulkAssignDto;
import com.emanagement.backend.modules.shift.dto.BulkAssignResultDto;
import com.emanagement.backend.modules.shift.dto.CopyWeekDto;
import com.emanagement.backend.modules.shift.dto.EmployeeShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftUpdateDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {
    private final ShiftRepository shiftRepository;
    private final EmployeeShiftRepository employeeShiftRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final LeaveRequestRepository leaveRequestRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    /** Ca mặc định của hệ thống: Kiosk dùng làm fallback nên không được ngừng/xóa. */
    private static final String DEFAULT_SHIFT_CODE = "SHIFT-001";
    private static final int MAX_RANGE_DAYS = 62;
    private static final int MAX_PLAN_SIZE = 5000;

    /** Một dòng trong "kế hoạch phân ca": nhân viên X làm ca Y vào ngày Z. */
    private record PlanItem(User user, Shift shift, LocalDate date) {
    }

    /** Gom thay đổi theo nhân viên để gửi 1 thông báo gộp thay vì 1 thông báo / ngày. */
    private static class UserChange {
        User user;
        int created;
        int updated;
        LocalDate minDate;
        LocalDate maxDate;
        String shiftName;
        String shiftTime;
        String previousShiftName;
        EmployeeShift lastEntity;
    }

    // =====================================================================
    // CA LÀM VIỆC (Shift)
    // =====================================================================

    @Override
    @Transactional
    public ShiftResponseDto createShift(ShiftCreateDto dto) {
        validateTimeRange(dto.getStartTime(), dto.getEndTime());

        String generatedShiftCode = CodeGeneratorUtils.generateShiftCode(
                code -> shiftRepository.findByShiftCode(code).isPresent());

        Shift shift = new Shift();
        shift.setShiftCode(generatedShiftCode);
        shift.setName(dto.getName());
        shift.setStartTime(dto.getStartTime());
        shift.setEndTime(dto.getEndTime());
        shift.setGracePeriodMinutes(dto.getGracePeriodMinutes() != null ? dto.getGracePeriodMinutes() : 15);

        return mapToDto(shiftRepository.save(shift));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftResponseDto> getAllShifts(boolean includeInactive) {
        List<Shift> shifts = includeInactive
                ? shiftRepository.findAllByOrderByStartTimeAsc()
                : shiftRepository.findByActiveTrueOrderByStartTimeAsc();
        return shifts.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ShiftResponseDto updateShift(Long id, ShiftUpdateDto dto) {
        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + id));

        validateTimeRange(dto.getStartTime(), dto.getEndTime());
        int newGrace = dto.getGracePeriodMinutes() != null ? dto.getGracePeriodMinutes() : 15;
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDate effectiveFrom = dto.getEffectiveFrom() != null ? dto.getEffectiveFrom() : tomorrow;

        boolean timeChanged = !dto.getStartTime().equals(shift.getStartTime())
                || !dto.getEndTime().equals(shift.getEndTime())
                || newGrace != (shift.getGracePeriodMinutes() != null ? shift.getGracePeriodMinutes() : 15);
        boolean nameChanged = !dto.getName().equals(shift.getName());

        if ((timeChanged || nameChanged) && effectiveFrom.isBefore(tomorrow)) {
            throw new BusinessException(
                    "Thay đổi chỉ có hiệu lực từ ngày mai (" + tomorrow.format(DATE_FMT)
                            + ") trở đi để không làm sai lịch sử chấm công");
        }

        shift.setName(dto.getName());
        shift.setStartTime(dto.getStartTime());
        shift.setEndTime(dto.getEndTime());
        shift.setGracePeriodMinutes(newGrace);
        shift.setUpdatedAt(java.time.LocalDateTime.now());
        if (Boolean.TRUE.equals(dto.getActive())) {
            shift.setActive(true);
        }
        Shift saved = shiftRepository.save(shift);

        if (timeChanged || nameChanged) {
            // Chỉ cập nhật snapshot của các lịch từ effectiveFrom trở đi. Quá khứ và hôm nay giữ nguyên.
            List<EmployeeShift> affected = employeeShiftRepository
                    .findByShiftIdAndAssignedDateGreaterThanEqual(id, effectiveFrom);
            Map<Long, User> usersToNotify = new LinkedHashMap<>();
            for (EmployeeShift es : affected) {
                es.applyShift(saved);
                usersToNotify.putIfAbsent(es.getUser().getId(), es.getUser());
            }
            employeeShiftRepository.saveAll(affected);

            if (timeChanged) {
                String msg = saved.getName() + " đổi giờ thành " + timeText(saved) + ", áp dụng từ ngày "
                        + effectiveFrom.format(DATE_FMT) + ".";
                for (User u : usersToNotify.values()) {
                    notificationService.notifyUser(u, NotificationType.SHIFT_CHANGED,
                            "Giờ ca làm việc đã thay đổi", msg, null);
                }
            }
        }
        return mapToDto(saved);
    }

    @Override
    @Transactional
    public String removeShift(Long id, Long replaceWithShiftId) {
        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + id));

        if (DEFAULT_SHIFT_CODE.equals(shift.getShiftCode())) {
            throw new BusinessException("Đây là ca mặc định của hệ thống (dùng cho Kiosk), không thể xóa hoặc ngừng sử dụng");
        }

        LocalDate tomorrow = LocalDate.now().plusDays(1);
        List<EmployeeShift> future = employeeShiftRepository
                .findByShiftIdAndAssignedDateGreaterThanEqual(id, tomorrow);

        if (!future.isEmpty()) {
            if (replaceWithShiftId == null) {
                throw new BusinessException("Ca này đang được phân cho " + future.size()
                        + " lượt làm việc từ ngày mai. Hãy chọn ca thay thế (replaceWithShiftId) hoặc hủy các lượt đó trước");
            }
            if (replaceWithShiftId.equals(id)) {
                throw new BusinessException("Ca thay thế phải khác ca đang xóa");
            }
            Shift replacement = loadActiveShift(replaceWithShiftId);
            Map<Long, User> usersToNotify = new LinkedHashMap<>();
            for (EmployeeShift es : future) {
                es.applyShift(replacement);
                usersToNotify.putIfAbsent(es.getUser().getId(), es.getUser());
            }
            employeeShiftRepository.saveAll(future);
            for (User u : usersToNotify.values()) {
                notificationService.notifyUser(u, NotificationType.SHIFT_CHANGED,
                        "Ca làm việc của bạn đã thay đổi",
                        shift.getName() + " đã ngừng sử dụng, các ngày từ " + tomorrow.format(DATE_FMT)
                                + " được chuyển sang " + replacement.getName() + " (" + timeText(replacement) + ").",
                        null);
            }
        }

        // Chưa từng được phân cho ai -> xóa cứng. Ngược lại xóa mềm để giữ lịch sử.
        if (!employeeShiftRepository.existsByShiftId(id)) {
            shiftRepository.delete(shift);
            return "DELETED";
        }
        shift.setActive(false);
        shift.setUpdatedAt(java.time.LocalDateTime.now());
        shiftRepository.save(shift);
        return "DEACTIVATED";
    }

    // =====================================================================
    // PHÂN CA (EmployeeShift)
    // =====================================================================

    @Override
    @Transactional
    public void assignShift(AssignShiftDto dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + dto.getUserId()));
        Shift shift = shiftRepository.findById(dto.getShiftId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + dto.getShiftId()));

        BulkAssignResultDto result = execute(
                List.of(new PlanItem(user, shift, dto.getAssignedDate())), true, false);

        BulkAssignResultDto.Item item = result.getItems().get(0);
        if (BulkAssignResultDto.SKIPPED.equals(item.getAction())) {
            throw new BusinessException(item.getReason());
        }
    }

    @Override
    @Transactional
    public BulkAssignResultDto bulkAssign(BulkAssignDto dto) {
        LocalDate start = dto.getStartDate();
        LocalDate end = dto.getEndDate();
        if (end.isBefore(start)) {
            throw new BusinessException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }
        if (ChronoUnit.DAYS.between(start, end) > MAX_RANGE_DAYS) {
            throw new BusinessException("Mỗi lần chỉ được phân ca tối đa " + (MAX_RANGE_DAYS + 1) + " ngày");
        }

        Shift shift = shiftRepository.findById(dto.getShiftId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + dto.getShiftId()));

        Set<DayOfWeek> days = (dto.getDaysOfWeek() == null || dto.getDaysOfWeek().isEmpty())
                ? EnumSet.range(DayOfWeek.MONDAY, DayOfWeek.FRIDAY)
                : dto.getDaysOfWeek();

        List<LocalDate> dates = start.datesUntil(end.plusDays(1))
                .filter(d -> days.contains(d.getDayOfWeek()))
                .collect(Collectors.toList());

        List<User> users = resolveUsers(dto.getUserIds());

        List<PlanItem> plan = new ArrayList<>();
        for (User u : users) {
            for (LocalDate d : dates) {
                plan.add(new PlanItem(u, shift, d));
            }
        }
        return execute(plan, Boolean.TRUE.equals(dto.getOverwrite()), Boolean.TRUE.equals(dto.getDryRun()));
    }

    @Override
    @Transactional
    public BulkAssignResultDto copyWeek(CopyWeekDto dto) {
        LocalDate src = dto.getSourceWeekStart();
        LocalDate tgt = dto.getTargetWeekStart();
        if (src.equals(tgt)) {
            throw new BusinessException("Tuần nguồn và tuần đích phải khác nhau");
        }
        long offset = ChronoUnit.DAYS.between(src, tgt);
        LocalDate srcEnd = src.plusDays(6);

        List<EmployeeShift> source = (dto.getUserIds() == null || dto.getUserIds().isEmpty())
                ? employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(src, srcEnd)
                : employeeShiftRepository.findByUserIdInAndAssignedDateBetween(dto.getUserIds(), src, srcEnd);

        List<PlanItem> plan = new ArrayList<>();
        for (EmployeeShift es : source) {
            plan.add(new PlanItem(es.getUser(), es.getShift(), es.getAssignedDate().plusDays(offset)));
        }
        return execute(plan, Boolean.TRUE.equals(dto.getOverwrite()), Boolean.TRUE.equals(dto.getDryRun()));
    }

    /**
     * Lõi dùng chung cho phân ca đơn / hàng loạt / sao chép tuần.
     * Nạp dữ liệu theo lô (ca hiện có, nghỉ phép, chấm công hôm nay), duyệt từng dòng kế hoạch,
     * áp dụng quy tắc nghiệp vụ, rồi ghi một lần. dryRun = true thì không thay đổi gì.
     */
    private BulkAssignResultDto execute(List<PlanItem> plan, boolean overwrite, boolean dryRun) {
        BulkAssignResultDto result = new BulkAssignResultDto();
        result.setDryRun(dryRun);

        if (plan.isEmpty()) {
            throw new BusinessException("Không có nhân viên hoặc ngày nào phù hợp để phân ca");
        }
        if (plan.size() > MAX_PLAN_SIZE) {
            throw new BusinessException("Quá nhiều lượt phân ca (" + plan.size() + "), tối đa " + MAX_PLAN_SIZE
                    + " mỗi lần. Hãy chia nhỏ khoảng ngày hoặc nhóm nhân viên");
        }

        LocalDate today = LocalDate.now();
        Set<Long> userIds = new HashSet<>();
        LocalDate min = plan.get(0).date();
        LocalDate max = min;
        for (PlanItem p : plan) {
            userIds.add(p.user().getId());
            if (p.date().isBefore(min)) {
                min = p.date();
            }
            if (p.date().isAfter(max)) {
                max = p.date();
            }
        }

        // --- Nạp dữ liệu theo lô: 3 truy vấn thay vì hàng nghìn truy vấn ---
        Map<String, EmployeeShift> existing = new HashMap<>();
        for (EmployeeShift es : employeeShiftRepository.findByUserIdInAndAssignedDateBetween(userIds, min, max)) {
            existing.put(key(es.getUser().getId(), es.getAssignedDate()), es);
        }

        Map<Long, List<LeaveRequest>> leaveByUser = leaveRequestRepository.findApprovedOverlapping(userIds, min, max)
                .stream().collect(Collectors.groupingBy(l -> l.getUser().getId()));

        Set<Long> checkedInToday = new HashSet<>();
        if (!today.isBefore(min) && !today.isAfter(max)) {
            for (AttendanceRecord a : attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(
                    userIds, today.atStartOfDay(), today.atTime(LocalTime.MAX))) {
                checkedInToday.add(a.getUser().getId());
            }
        }

        // --- Duyệt kế hoạch ---
        List<EmployeeShift> toSave = new ArrayList<>();
        Map<Long, UserChange> changes = new LinkedHashMap<>();

        for (PlanItem p : plan) {
            User u = p.user();
            LocalDate d = p.date();
            Shift s = p.shift();

            String blocked = blockReason(u, s, d, today, checkedInToday,
                    leaveByUser.getOrDefault(u.getId(), List.of()));
            if (blocked != null) {
                result.add(u.getId(), u.getEmployeeCode(), u.getFullName(), d, BulkAssignResultDto.SKIPPED, blocked);
                continue;
            }

            String k = key(u.getId(), d);
            EmployeeShift cur = existing.get(k);

            if (cur == null) {
                result.add(u.getId(), u.getEmployeeCode(), u.getFullName(), d, BulkAssignResultDto.CREATED, null);
                if (!dryRun) {
                    EmployeeShift es = new EmployeeShift();
                    es.setUser(u);
                    es.setAssignedDate(d);
                    es.applyShift(s);
                    existing.put(k, es); // tránh tạo trùng nếu kế hoạch lặp (user, ngày)
                    toSave.add(es);
                    track(changes, u, d, s, null, es, true);
                }
            } else if (cur.getShift().getId().equals(s.getId())) {
                // Phân lại đúng ca cũ: không lưu, không thông báo
                result.add(u.getId(), u.getEmployeeCode(), u.getFullName(), d, BulkAssignResultDto.UNCHANGED, null);
            } else if (!overwrite) {
                result.add(u.getId(), u.getEmployeeCode(), u.getFullName(), d, BulkAssignResultDto.SKIPPED,
                        "Đã có ca '" + cur.getShiftName() + "' (bật ghi đè để thay thế)");
            } else {
                result.add(u.getId(), u.getEmployeeCode(), u.getFullName(), d, BulkAssignResultDto.UPDATED,
                        "Đổi từ '" + cur.getShiftName() + "'");
                if (!dryRun) {
                    String previous = cur.getShiftName();
                    cur.applyShift(s);
                    toSave.add(cur);
                    track(changes, u, d, s, previous, cur, false);
                }
            }
        }

        if (!dryRun && !toSave.isEmpty()) {
            try {
                employeeShiftRepository.saveAll(toSave);
            } catch (DataIntegrityViolationException e) {
                // UNIQUE(user_id, assigned_date): có người khác vừa phân ca cùng lúc
                throw new BusinessException("Lịch vừa được người khác thay đổi, vui lòng tải lại và thử lại");
            }
            sendChangeNotifications(changes);
        }
        return result;
    }

    /** Trả về lý do không thể phân ca, hoặc null nếu hợp lệ. */
    private String blockReason(User u, Shift s, LocalDate d, LocalDate today,
            Set<Long> checkedInToday, List<LeaveRequest> leaves) {
        if (!"ACTIVE".equals(u.getStatus())) {
            return "Tài khoản nhân viên không ở trạng thái hoạt động";
        }
        if (!Boolean.TRUE.equals(s.getActive())) {
            return "Ca làm việc '" + s.getName() + "' đã ngừng sử dụng";
        }
        if (d.isBefore(today)) {
            return "Không thể thay đổi lịch của ngày đã qua";
        }
        if (d.isEqual(today) && checkedInToday.contains(u.getId())) {
            return "Nhân viên đã chấm công hôm nay, không thể đổi ca";
        }
        for (LeaveRequest l : leaves) {
            if (!d.isBefore(l.getStartDate()) && !d.isAfter(l.getEndDate())) {
                return "Nhân viên có đơn nghỉ phép đã duyệt vào ngày này";
            }
        }
        return null;
    }

    private void track(Map<Long, UserChange> changes, User u, LocalDate d, Shift s,
            String previousShiftName, EmployeeShift entity, boolean isCreate) {
        UserChange c = changes.computeIfAbsent(u.getId(), id -> {
            UserChange nc = new UserChange();
            nc.user = u;
            nc.minDate = d;
            nc.maxDate = d;
            return nc;
        });
        if (isCreate) {
            c.created++;
        } else {
            c.updated++;
        }
        if (d.isBefore(c.minDate)) {
            c.minDate = d;
        }
        if (d.isAfter(c.maxDate)) {
            c.maxDate = d;
        }
        c.shiftName = s.getName();
        c.shiftTime = timeText(s);
        c.previousShiftName = previousShiftName;
        c.lastEntity = entity;
    }

    private void sendChangeNotifications(Map<Long, UserChange> changes) {
        for (UserChange c : changes.values()) {
            int total = c.created + c.updated;
            if (total == 1) {
                String dateText = c.minDate.format(DATE_FMT);
                Long refId = c.lastEntity != null ? c.lastEntity.getId() : null;
                if (c.updated == 0) {
                    notificationService.notifyUser(c.user, NotificationType.SHIFT_ASSIGNED,
                            "Bạn được phân ca làm việc",
                            c.shiftName + " (" + c.shiftTime + ") vào ngày " + dateText + ".", refId);
                } else {
                    notificationService.notifyUser(c.user, NotificationType.SHIFT_CHANGED,
                            "Ca làm việc của bạn đã thay đổi",
                            "Lịch ngày " + dateText + " đã đổi từ " + c.previousShiftName
                                    + " sang " + c.shiftName + " (" + c.shiftTime + ").", refId);
                }
            } else if (total > 1) {
                NotificationType type = c.updated > 0 ? NotificationType.SHIFT_CHANGED : NotificationType.SHIFT_ASSIGNED;
                notificationService.notifyUser(c.user, type,
                        "Lịch làm việc của bạn đã được cập nhật",
                        "Có " + total + " ngày làm việc được phân hoặc thay đổi trong khoảng "
                                + c.minDate.format(DATE_FMT) + " - " + c.maxDate.format(DATE_FMT)
                                + ". Vui lòng xem mục Lịch của tôi.",
                        null);
            }
        }
    }

    @Override
    @Transactional
    public void removeAssignedShift(Long userId, LocalDate date) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + userId));

        EmployeeShift employeeShift = employeeShiftRepository.findByUserIdAndAssignedDate(userId, date)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Nhân viên này không có ca làm việc vào ngày " + date.format(DATE_FMT)));

        LocalDate today = LocalDate.now();
        if (date.isBefore(today)) {
            throw new BusinessException("Không thể hủy ca của ngày đã qua");
        }
        if (date.isEqual(today) && attendanceRecordRepository.existsByUserIdAndCheckInTimeBetween(
                userId, today.atStartOfDay(), today.atTime(LocalTime.MAX))) {
            throw new BusinessException("Nhân viên đã chấm công hôm nay, không thể hủy ca");
        }

        String shiftName = employeeShift.getShiftName();
        employeeShiftRepository.delete(employeeShift);

        notificationService.notifyUser(user, NotificationType.SHIFT_REMOVED,
                "Ca làm việc đã bị hủy",
                shiftName + " vào ngày " + date.format(DATE_FMT) + " đã bị hủy bởi quản trị viên.",
                null);
    }

    @Override
    @Transactional
    public void cancelShiftsForLeave(User user, LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        LocalDate start = from.isBefore(today) ? today : from;
        if (to.isBefore(start)) {
            return;
        }
        List<EmployeeShift> list = new ArrayList<>(
                employeeShiftRepository.findByUserIdAndAssignedDateBetween(user.getId(), start, to));

        boolean checkedInToday = attendanceRecordRepository.existsByUserIdAndCheckInTimeBetween(
                user.getId(), today.atStartOfDay(), today.atTime(LocalTime.MAX));
        if (checkedInToday) {
            list.removeIf(es -> es.getAssignedDate().isEqual(today));
        }
        if (list.isEmpty()) {
            return;
        }
        employeeShiftRepository.deleteAll(list);
        notificationService.notifyUser(user, NotificationType.SHIFT_REMOVED,
                "Ca làm việc đã được hủy do nghỉ phép",
                list.size() + " ca làm việc trong khoảng " + start.format(DATE_FMT) + " - " + to.format(DATE_FMT)
                        + " đã được hủy vì đơn nghỉ phép của bạn được duyệt.",
                null);
    }

    // =====================================================================
    // TRUY VẤN LỊCH
    // =====================================================================

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeShiftResponseDto> getSchedule(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new BusinessException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }
        if (ChronoUnit.DAYS.between(startDate, endDate) > 92) {
            throw new BusinessException("Chỉ được xem lịch tối đa 93 ngày mỗi lần");
        }
        return employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(startDate, endDate)
                .stream().map(this::mapToEmployeeShiftDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeShiftResponseDto> getMySchedule(Long userId, LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new BusinessException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }
        if (ChronoUnit.DAYS.between(startDate, endDate) > 92) {
            throw new BusinessException("Chỉ được xem lịch tối đa 93 ngày mỗi lần");
        }
        return employeeShiftRepository
                .findByUserIdAndAssignedDateBetweenOrderByAssignedDateAsc(userId, startDate, endDate)
                .stream().map(this::mapToEmployeeShiftDto).collect(Collectors.toList());
    }

    // =====================================================================
    // HELPERS
    // =====================================================================

    private List<User> resolveUsers(List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            // Chỉ lấy nhân viên có role ROLE_EMPLOYEE, loại trừ admin/manager
            return userRepository.findActiveEmployees();
        }
        List<User> users = userRepository.findAllById(new HashSet<>(userIds));
        if (users.size() != new HashSet<>(userIds).size()) {
            throw new ResourceNotFoundException("Có nhân viên trong danh sách không tồn tại");
        }
        return users;
    }


    private Shift loadActiveShift(Long id) {
        Shift s = shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + id));
        if (!Boolean.TRUE.equals(s.getActive())) {
            throw new BusinessException("Ca làm việc '" + s.getName() + "' đã ngừng sử dụng");
        }
        return s;
    }

    private void validateTimeRange(LocalTime start, LocalTime end) {
        if (!start.isBefore(end)) {
            throw new BusinessException(
                    "Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)");
        }
    }

    private static String key(Long userId, LocalDate date) {
        return userId + "_" + date;
    }

    private static String timeText(Shift s) {
        return s.getStartTime().format(TIME_FMT) + " - " + s.getEndTime().format(TIME_FMT);
    }



    private ShiftResponseDto mapToDto(Shift shift) {
        return ShiftResponseDto.builder()
                .id(shift.getId())
                .shiftCode(shift.getShiftCode())
                .name(shift.getName())
                .startTime(shift.getStartTime())
                .endTime(shift.getEndTime())
                .gracePeriodMinutes(shift.getGracePeriodMinutes())
                .active(shift.getActive())
                .build();
    }

    /** Dùng giờ/tên đã snapshot trong lịch, không lấy từ bảng shifts (tránh lịch sử bị đổi theo). */
    private EmployeeShiftResponseDto mapToEmployeeShiftDto(EmployeeShift es) {
        return EmployeeShiftResponseDto.builder()
                .id(es.getId())
                .userId(es.getUser().getId())
                .employeeCode(es.getUser().getEmployeeCode())
                .fullName(es.getUser().getFullName())
                .shiftId(es.getShift().getId())
                .shiftName(es.getShiftName())
                .shiftCode(es.getShift().getShiftCode())
                .startTime(es.getStartTime())
                .endTime(es.getEndTime())
                .gracePeriodMinutes(es.getGracePeriodMinutes())
                .assignedDate(es.getAssignedDate())
                .build();
    }
}
