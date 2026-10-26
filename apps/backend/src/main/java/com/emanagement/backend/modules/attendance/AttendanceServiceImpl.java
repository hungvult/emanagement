package com.emanagement.backend.modules.attendance;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;
import com.emanagement.backend.modules.attendance.dto.ManualAttendanceRequestDto;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.shift.EmployeeShift;
import com.emanagement.backend.modules.shift.EmployeeShiftRepository;
import com.emanagement.backend.modules.shift.Shift;
import com.emanagement.backend.modules.shift.ShiftRepository;

import jakarta.persistence.EntityManager;

@Service
public class AttendanceServiceImpl implements AttendanceService {
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final EmployeeShiftRepository employeeShiftRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final EntityManager entityManager;

    @Autowired
    public AttendanceServiceImpl(
            AttendanceRecordRepository attendanceRecordRepository,
            EmployeeShiftRepository employeeShiftRepository,
            ShiftRepository shiftRepository,
            UserRepository userRepository,
            StorageService storageService,
            EntityManager entityManager) {
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.employeeShiftRepository = employeeShiftRepository;
        this.shiftRepository = shiftRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.entityManager = entityManager;
    }

    public AttendanceServiceImpl(
            AttendanceRecordRepository attendanceRecordRepository,
            EmployeeShiftRepository employeeShiftRepository,
            ShiftRepository shiftRepository,
            StorageService storageService,
            EntityManager entityManager) {
        this(attendanceRecordRepository, employeeShiftRepository, shiftRepository, null, storageService, entityManager);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getUserHistory(Long userId, int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId) {
        return getRecordsInternal(userId, page, size, startDate, endDate, status, shiftId, null);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId) {
        return getAllRecords(page, size, startDate, endDate, status, shiftId, null);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId, String search) {
        return getRecordsInternal(null, page, size, startDate, endDate, status, shiftId, search);
    }

    private PageResponse<AttendanceHistoryDto> getRecordsInternal(Long userId, int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId, String search) {
        PageRequest pageRequest = PageRequest.of(page, size);
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.plusDays(1).atStartOfDay() : null;
        String statusFilter = (status != null && !status.isBlank()) ? status.trim().toUpperCase() : null;
        boolean hasShiftId = shiftId != null;
        String searchParam = (search != null && !search.isBlank()) ? search.trim() : null;
        boolean hasSearch = searchParam != null;

        // Nếu lọc riêng trạng thái "Không có dữ liệu" (NO_DATA)
        if ("NO_DATA".equalsIgnoreCase(statusFilter)) {
            List<AttendanceHistoryDto> unattended = getUnattendedShifts(userId, startDate, endDate, shiftId);
            if (hasSearch) {
                String sLower = searchParam.toLowerCase();
                unattended = unattended.stream()
                        .filter(u -> (u.getFullName() != null && u.getFullName().toLowerCase().contains(sLower))
                                || (u.getEmployeeCode() != null && u.getEmployeeCode().toLowerCase().contains(sLower)))
                        .collect(Collectors.toList());
            }
            unattended.sort(Comparator.comparing(AttendanceHistoryDto::getWorkDate, Comparator.nullsLast(Comparator.reverseOrder())));
            return paginateList(unattended, pageRequest);
        }

        // Nếu lọc các trạng thái check-in cụ thể (ON_TIME, LATE, EARLY_LEAVE)
        if (statusFilter != null) {
            Page<AttendanceRecord> records;
            if (userId != null) {
                records = attendanceRecordRepository.findByUserIdWithFilters(
                        userId,
                        start != null, start,
                        end != null, end,
                        true, statusFilter,
                        hasShiftId, shiftId,
                        pageRequest);
            } else if (hasSearch) {
                records = attendanceRecordRepository.findAllWithExportFilters(
                        start != null, start,
                        end != null, end,
                        true, statusFilter,
                        hasShiftId, shiftId,
                        true, searchParam,
                        pageRequest);
            } else {
                records = attendanceRecordRepository.findAllWithFilters(
                        start != null, start,
                        end != null, end,
                        true, statusFilter,
                        hasShiftId, shiftId,
                        pageRequest);
            }
            return PageResponse.from(records.map(this::mapToDto));
        }

        // Trạng thái = "Tất cả": Gom cả bản ghi đã chấm công VÀ các ca chưa chấm công (NO_DATA)
        List<AttendanceHistoryDto> unattended = getUnattendedShifts(userId, startDate, endDate, shiftId);
        if (hasSearch) {
            String sLower = searchParam.toLowerCase();
            unattended = unattended.stream()
                    .filter(u -> (u.getFullName() != null && u.getFullName().toLowerCase().contains(sLower))
                            || (u.getEmployeeCode() != null && u.getEmployeeCode().toLowerCase().contains(sLower)))
                    .collect(Collectors.toList());
        }

        if (unattended.isEmpty()) {
            Page<AttendanceRecord> records;
            if (userId != null) {
                records = attendanceRecordRepository.findByUserIdWithFilters(
                        userId,
                        start != null, start,
                        end != null, end,
                        false, null,
                        hasShiftId, shiftId,
                        pageRequest);
            } else if (hasSearch) {
                records = attendanceRecordRepository.findAllWithExportFilters(
                        start != null, start,
                        end != null, end,
                        false, "",
                        hasShiftId, shiftId,
                        true, searchParam,
                        pageRequest);
            } else {
                records = attendanceRecordRepository.findAllWithFilters(
                        start != null, start,
                        end != null, end,
                        false, null,
                        hasShiftId, shiftId,
                        pageRequest);
            }
            return PageResponse.from(records.map(this::mapToDto));
        }

        // Lấy toàn bộ bản ghi check-in trong khoảng thời gian để ghép danh sách
        List<AttendanceRecord> attendedRecords;
        if (userId != null) {
            attendedRecords = attendanceRecordRepository.findByUserIdOrderByCheckInTimeDesc(userId, PageRequest.of(0, 1000)).getContent();
            if (start != null) {
                attendedRecords = attendedRecords.stream().filter(r -> r.getCheckInTime() != null && !r.getCheckInTime().isBefore(start)).collect(Collectors.toList());
            }
            if (end != null) {
                attendedRecords = attendedRecords.stream().filter(r -> r.getCheckInTime() != null && r.getCheckInTime().isBefore(end)).collect(Collectors.toList());
            }
            if (hasShiftId) {
                attendedRecords = attendedRecords.stream().filter(r -> r.getShift() != null && r.getShift().getId().equals(shiftId)).collect(Collectors.toList());
            }
        } else if (hasSearch) {
            attendedRecords = attendanceRecordRepository.findAllWithExportFilters(
                    start != null, start,
                    end != null, end,
                    false, "",
                    hasShiftId, shiftId,
                    true, searchParam,
                    PageRequest.of(0, 1000)).getContent();
        } else {
            // Lấy các bản ghi gần nhất (tối đa 1000)
            attendedRecords = attendanceRecordRepository.findAllWithFilters(
                    start != null, start,
                    end != null, end,
                    false, null,
                    hasShiftId, shiftId,
                    PageRequest.of(0, 1000)).getContent();
        }

        List<AttendanceHistoryDto> allList = new ArrayList<>();
        allList.addAll(attendedRecords.stream().map(this::mapToDto).collect(Collectors.toList()));
        allList.addAll(unattended);

        // Sắp xếp giảm dần theo ngày làm việc / thời gian check-in
        allList.sort((a, b) -> {
            LocalDate dateA = a.getWorkDate() != null ? a.getWorkDate() : (a.getCheckInTime() != null ? a.getCheckInTime().toLocalDate() : LocalDate.MIN);
            LocalDate dateB = b.getWorkDate() != null ? b.getWorkDate() : (b.getCheckInTime() != null ? b.getCheckInTime().toLocalDate() : LocalDate.MIN);
            int cmp = dateB.compareTo(dateA);
            if (cmp != 0) return cmp;
            LocalDateTime dtA = a.getCheckInTime() != null ? a.getCheckInTime() : LocalDateTime.MIN;
            LocalDateTime dtB = b.getCheckInTime() != null ? b.getCheckInTime() : LocalDateTime.MIN;
            return dtB.compareTo(dtA);
        });

        return paginateList(allList, pageRequest);
    }

    @Override
    @Transactional
    public AttendanceHistoryDto createManualRecord(ManualAttendanceRequestDto dto) {
        if (dto == null) {
            throw new BusinessException("Dữ liệu chấm công không được để trống");
        }
        if (dto.getCheckInTime() == null) {
            throw new BusinessException("Thời gian vào ca không được để trống");
        }
        if (dto.getCheckOutTime() != null && !dto.getCheckOutTime().isAfter(dto.getCheckInTime())) {
            throw new BusinessException("Thời gian ra ca phải sau thời gian vào ca");
        }
        if (dto.getUserId() == null) {
            throw new BusinessException("ID nhân viên không được để trống");
        }

        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + dto.getUserId()));

        Shift shift = null;
        if (dto.getShiftId() != null) {
            shift = shiftRepository.findById(dto.getShiftId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + dto.getShiftId()));
        }

        LocalDate workDate = dto.getWorkDate() != null ? dto.getWorkDate() : dto.getCheckInTime().toLocalDate();
        if (shift == null) {
            EmployeeShift es = employeeShiftRepository.findByUserIdAndAssignedDate(user.getId(), workDate).orElse(null);
            if (es != null && es.getShift() != null) {
                shift = es.getShift();
            } else {
                shift = shiftRepository.findByShiftCode("SHIFT-001").orElse(null);
            }
        }

        String status = resolveStatus(dto.getStatus(), shift, workDate, dto.getCheckInTime(), dto.getCheckOutTime());

        LocalDate checkInDate = dto.getCheckInTime().toLocalDate();
        LocalDate minDate = workDate.isBefore(checkInDate) ? workDate : checkInDate;
        LocalDate maxDate = workDate.isAfter(checkInDate) ? workDate : checkInDate;
        LocalDateTime startOfDay = minDate.atStartOfDay();
        LocalDateTime endOfDay = maxDate.atTime(LocalTime.MAX);
        List<AttendanceRecord> existingRecords = attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(user.getId(), startOfDay, endOfDay);

        AttendanceRecord recordToSave = null;
        if (!existingRecords.isEmpty()) {
            if (shift != null) {
                final Long sid = shift.getId();
                recordToSave = existingRecords.stream()
                        .filter(r -> r.getShift() != null && r.getShift().getId().equals(sid))
                        .findFirst()
                        .orElse(null);
            } else {
                recordToSave = existingRecords.stream()
                        .filter(r -> r.getShift() == null)
                        .findFirst()
                        .orElse(null);
            }
        }

        if (recordToSave == null) {
            recordToSave = new AttendanceRecord();
            recordToSave.setUser(user);
        }

        recordToSave.setShift(shift);
        recordToSave.setCheckInTime(dto.getCheckInTime());
        recordToSave.setCheckOutTime(dto.getCheckOutTime());
        recordToSave.setStatus(status);

        AttendanceRecord saved = attendanceRecordRepository.save(recordToSave);
        return mapToDto(saved);
    }

    @Override
    @Transactional
    public AttendanceHistoryDto updateManualRecord(Long id, ManualAttendanceRequestDto dto) {
        if (id == null) {
            throw new BusinessException("ID bản ghi chấm công không được để trống");
        }
        if (dto == null) {
            throw new BusinessException("Dữ liệu chấm công không được để trống");
        }
        if (dto.getCheckInTime() == null) {
            throw new BusinessException("Thời gian vào ca không được để trống");
        }
        if (dto.getCheckOutTime() != null && !dto.getCheckOutTime().isAfter(dto.getCheckInTime())) {
            throw new BusinessException("Thời gian ra ca phải sau thời gian vào ca");
        }

        if (id < 0) {
            Long employeeShiftId = -id;
            EmployeeShift es = employeeShiftRepository.findById(employeeShiftId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + employeeShiftId));
            if (dto.getUserId() == null && es.getUser() != null) {
                dto.setUserId(es.getUser().getId());
            }
            if (dto.getShiftId() == null && es.getShift() != null) {
                dto.setShiftId(es.getShift().getId());
            }
            if (dto.getWorkDate() == null && es.getAssignedDate() != null) {
                dto.setWorkDate(es.getAssignedDate());
            }
            return createManualRecord(dto);
        }

        AttendanceRecord record = attendanceRecordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bản ghi chấm công với ID: " + id));

        Shift shift = record.getShift();
        if (dto.getShiftId() != null) {
            shift = shiftRepository.findById(dto.getShiftId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + dto.getShiftId()));
        }

        if (shift == null && record.getUser() != null) {
            LocalDate workDate = dto.getWorkDate() != null ? dto.getWorkDate() : dto.getCheckInTime().toLocalDate();
            EmployeeShift es = employeeShiftRepository.findByUserIdAndAssignedDate(record.getUser().getId(), workDate).orElse(null);
            if (es != null && es.getShift() != null) {
                shift = es.getShift();
            } else {
                shift = shiftRepository.findByShiftCode("SHIFT-001").orElse(null);
            }
        }

        LocalDate targetDate = dto.getWorkDate() != null ? dto.getWorkDate() : dto.getCheckInTime().toLocalDate();
        String status = resolveStatus(dto.getStatus(), shift, targetDate, dto.getCheckInTime(), dto.getCheckOutTime());

        record.setShift(shift);
        record.setCheckInTime(dto.getCheckInTime());
        record.setCheckOutTime(dto.getCheckOutTime());
        record.setStatus(status);

        AttendanceRecord saved = attendanceRecordRepository.save(record);
        return mapToDto(saved);
    }

    private String resolveStatus(String requestedStatus, Shift shift, LocalDate workDate, LocalDateTime checkInTime, LocalDateTime checkOutTime) {
        if (requestedStatus != null && !requestedStatus.isBlank()) {
            return requestedStatus.trim().toUpperCase();
        }
        if (shift != null && shift.getStartTime() != null) {
            int grace = shift.getGracePeriodMinutes() != null ? shift.getGracePeriodMinutes() : 15;
            LocalDate baseDate = workDate != null ? workDate : checkInTime.toLocalDate();
            LocalDateTime shiftStartDt = baseDate.atTime(shift.getStartTime());
            LocalDateTime graceEndDt = shiftStartDt.plusMinutes(grace);

            if (checkInTime.isAfter(graceEndDt)) {
                return "LATE";
            }
            if (checkOutTime != null && shift.getEndTime() != null) {
                LocalDateTime scheduledEndDt;
                if (shift.getEndTime().isBefore(shift.getStartTime())) {
                    // Ca qua đêm (ví dụ: 22h00 - 06h00)
                    scheduledEndDt = baseDate.plusDays(1).atTime(shift.getEndTime());
                } else {
                    scheduledEndDt = baseDate.atTime(shift.getEndTime());
                }
                if (checkOutTime.isBefore(scheduledEndDt)) {
                    return "EARLY_LEAVE";
                }
            }
            return "ON_TIME";
        }
        return "ON_TIME";
    }


    private List<AttendanceHistoryDto> getUnattendedShifts(Long userId, LocalDate startDate, LocalDate endDate, Long shiftId) {
        LocalDate today = LocalDate.now();
        LocalDate effectiveEnd = endDate != null && endDate.isBefore(today) ? endDate : today;
        LocalDate effectiveStart = startDate != null ? startDate : effectiveEnd.minusDays(30);

        if (effectiveStart.isAfter(effectiveEnd)) {
            return Collections.emptyList();
        }

        List<EmployeeShift> scheduledShifts;
        if (userId != null) {
            scheduledShifts = employeeShiftRepository.findByUserIdAndAssignedDateBetweenOrderByAssignedDateAsc(
                    userId, effectiveStart, effectiveEnd);
        } else {
            scheduledShifts = employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(
                    effectiveStart, effectiveEnd);
        }

        if (scheduledShifts.isEmpty()) {
            return Collections.emptyList();
        }

        if (shiftId != null) {
            scheduledShifts = scheduledShifts.stream()
                    .filter(es -> es.getShift() != null && es.getShift().getId().equals(shiftId))
                    .collect(Collectors.toList());
        }

        if (scheduledShifts.isEmpty()) {
            return Collections.emptyList();
        }

        LocalDateTime startDt = effectiveStart.atStartOfDay();
        LocalDateTime endDt = effectiveEnd.plusDays(1).atStartOfDay();

        List<AttendanceRecord> records;
        if (userId != null) {
            records = attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(userId, startDt, endDt);
        } else {
            Set<Long> userIds = scheduledShifts.stream().map(es -> es.getUser().getId()).collect(Collectors.toSet());
            records = attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(userIds, startDt, endDt);
        }

        Set<String> attendedKeys = records.stream()
                .filter(r -> r.getUser() != null && r.getCheckInTime() != null)
                .map(r -> r.getUser().getId() + "_" + r.getCheckInTime().toLocalDate())
                .collect(Collectors.toSet());

        List<AttendanceHistoryDto> unattended = new ArrayList<>();
        for (EmployeeShift es : scheduledShifts) {
            String key = es.getUser().getId() + "_" + es.getAssignedDate();
            if (!attendedKeys.contains(key)) {
                unattended.add(AttendanceHistoryDto.builder()
                        .id(-es.getId())
                        .userId(es.getUser().getId())
                        .employeeCode(es.getUser().getEmployeeCode())
                        .fullName(es.getUser().getFullName())
                        .kioskName("—")
                        .shiftId(es.getShift() != null ? es.getShift().getId() : null)
                        .shiftName(es.getShiftName() != null ? es.getShiftName() : (es.getShift() != null ? es.getShift().getName() : "—"))
                        .workDate(es.getAssignedDate())
                        .checkInTime(null)
                        .checkOutTime(null)
                        .status("NO_DATA")
                        .snapshotUrl(null)
                        .checkoutSnapshotUrl(null)
                        .build());
            }
        }
        return unattended;
    }

    private PageResponse<AttendanceHistoryDto> paginateList(List<AttendanceHistoryDto> list, PageRequest pageRequest) {
        int total = list.size();
        int start = (int) pageRequest.getOffset();
        int end = Math.min((start + pageRequest.getPageSize()), total);
        List<AttendanceHistoryDto> subList = start < total ? list.subList(start, end) : Collections.emptyList();
        Page<AttendanceHistoryDto> page = new PageImpl<>(subList, pageRequest, total);
        return PageResponse.from(page);
    }

    private AttendanceHistoryDto mapToDto(AttendanceRecord record) {
        LocalDate workDate = record.getCheckInTime() != null ? record.getCheckInTime().toLocalDate()
                : (record.getCreatedAt() != null ? record.getCreatedAt().toLocalDate() : null);

        Long shiftId = null;
        String shiftName = null;

        if (record.getShift() != null) {
            shiftId = record.getShift().getId();
            shiftName = record.getShift().getName();
        } else if (workDate != null && record.getUser() != null) {
            // Tra cứu từ employee_shifts đã phân công
            EmployeeShift es = employeeShiftRepository.findByUserIdAndAssignedDate(record.getUser().getId(), workDate).orElse(null);
            if (es != null) {
                shiftId = es.getShift() != null ? es.getShift().getId() : null;
                shiftName = es.getShiftName();
            } else {
                Shift fallback = shiftRepository.findByShiftCode("SHIFT-001").orElse(null);
                if (fallback != null) {
                    shiftId = fallback.getId();
                    shiftName = fallback.getName();
                }
            }
        }

        return AttendanceHistoryDto.builder()
                .id(record.getId())
                .userId(record.getUser().getId())
                .employeeCode(record.getUser().getEmployeeCode())
                .fullName(record.getUser().getFullName())
                .kioskName(record.getKiosk() != null ? record.getKiosk().getName() : "—")
                .shiftId(shiftId)
                .shiftName(shiftName)
                .workDate(workDate)
                .checkInTime(record.getCheckInTime())
                .checkOutTime(record.getCheckOutTime())
                .status(record.getStatus())
                .snapshotUrl(storageService.getPresignedUrl(record.getSnapshotUrl(), 15))
                .checkoutSnapshotUrl(storageService.getPresignedUrl(record.getCheckoutSnapshotUrl(), 15))
                .build();
    }

    private static final byte[] UTF8_BOM = new byte[] { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final String CSV_HEADER = "STT,Mã nhân viên,Họ và tên,Ngày làm việc,Ca làm việc,Giờ vào,Giờ ra,Số giờ làm,Trạng thái,Trạm Kiosk\r\n";

    @Override
    @Transactional(readOnly = true)
    public void exportAttendanceToCsv(OutputStream outputStream, LocalDate startDate, LocalDate endDate,
            String status, Long shiftId, String search) throws IOException {
        LocalDate effectiveStart = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now();

        // 1. Ghi UTF-8 BOM vào đầu stream để Excel Windows/macOS không bị lỗi font tiếng Việt
        outputStream.write(UTF8_BOM);

        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8));
        writer.write(CSV_HEADER);
        writer.flush();

        if (effectiveStart.isAfter(effectiveEnd)) {
            return;
        }

        LocalDateTime start = effectiveStart.atStartOfDay();
        LocalDateTime end = effectiveEnd.plusDays(1).atStartOfDay();
        String statusFilter = (status != null && !status.isBlank()) ? status.trim().toUpperCase() : null;
        boolean hasShiftId = shiftId != null;
        String searchParam = (search != null && !search.isBlank()) ? search.trim() : null;
        boolean hasSearch = searchParam != null;

        long stt = 1;
        final int batchSize = 500;
        Shift fallbackShift = shiftRepository.findByShiftCode("SHIFT-001").orElse(null);

        // 2. Xuất các bản ghi chấm công từ attendance_records chunked theo batchSize
        int page = 0;
        boolean hasStatus = statusFilter != null;
        while (true) {
            Page<AttendanceRecord> records = attendanceRecordRepository.findAllWithExportFilters(
                    true, start,
                    true, end,
                    hasStatus, statusFilter != null ? statusFilter : "",
                    hasShiftId, shiftId,
                    hasSearch, searchParam != null ? searchParam : "",
                    PageRequest.of(page, batchSize));

            for (AttendanceRecord record : records.getContent()) {
                writeRecordCsvRow(writer, stt++, record, fallbackShift);
            }
            writer.flush();
            entityManager.clear();

            if (!records.hasNext()) {
                break;
            }
            page++;
        }

        // 3. Xuất các ca làm việc chưa chấm công từ employee_shifts (cho NO_DATA hoặc khi không lọc trạng thái)
        if (statusFilter == null || "NO_DATA".equals(statusFilter)) {
            List<AttendanceHistoryDto> unattended = getUnattendedShifts(null, effectiveStart, effectiveEnd, shiftId);
            if (hasSearch) {
                String sLower = searchParam.toLowerCase();
                unattended = unattended.stream()
                        .filter(u -> (u.getFullName() != null && u.getFullName().toLowerCase().contains(sLower))
                                || (u.getEmployeeCode() != null && u.getEmployeeCode().toLowerCase().contains(sLower)))
                        .collect(Collectors.toList());
            }
            unattended.sort(Comparator.comparing(AttendanceHistoryDto::getWorkDate, Comparator.nullsLast(Comparator.reverseOrder())));
            for (AttendanceHistoryDto dto : unattended) {
                writeDtoCsvRow(writer, stt++, dto);
            }
        }
        writer.flush();
        outputStream.flush();
    }

    private void writeRecordCsvRow(BufferedWriter writer, long stt, AttendanceRecord record, Shift fallbackShift) throws IOException {
        String empCode = (record.getUser() != null && record.getUser().getEmployeeCode() != null)
                ? record.getUser().getEmployeeCode()
                : "";
        String fullName = (record.getUser() != null && record.getUser().getFullName() != null)
                ? record.getUser().getFullName()
                : "";

        LocalDate workDate = record.getCheckInTime() != null ? record.getCheckInTime().toLocalDate()
                : (record.getCreatedAt() != null ? record.getCreatedAt().toLocalDate() : null);
        String workDateStr = workDate != null ? workDate.toString() : "";

        String shiftName = resolveShiftName(record, workDate, fallbackShift);

        String checkInStr = record.getCheckInTime() != null ? record.getCheckInTime().format(TIME_FORMATTER) : "";
        String checkOutStr = record.getCheckOutTime() != null ? record.getCheckOutTime().format(TIME_FORMATTER) : "";
        String workHoursStr = calculateWorkHours(record.getCheckInTime(), record.getCheckOutTime());

        String statusStr = translateStatus(record.getStatus());
        String kioskName = (record.getKiosk() != null && record.getKiosk().getName() != null)
                ? record.getKiosk().getName()
                : "—";

        String row = String.format(Locale.US, "%d,%s,%s,%s,%s,%s,%s,%s,%s,%s\r\n",
                stt,
                escapeCsvValue(empCode),
                escapeCsvText(fullName),
                workDateStr,
                escapeCsvText(shiftName),
                checkInStr,
                checkOutStr,
                workHoursStr,
                escapeCsvText(statusStr),
                escapeCsvText(kioskName));

        writer.write(row);
    }

    private void writeDtoCsvRow(BufferedWriter writer, long stt, AttendanceHistoryDto dto) throws IOException {
        String empCode = dto.getEmployeeCode() != null ? dto.getEmployeeCode() : "";
        String fullName = dto.getFullName() != null ? dto.getFullName() : "";
        String workDateStr = dto.getWorkDate() != null ? dto.getWorkDate().toString() : "";
        String shiftName = dto.getShiftName() != null ? dto.getShiftName() : "—";
        String checkInStr = dto.getCheckInTime() != null ? dto.getCheckInTime().format(TIME_FORMATTER) : "";
        String checkOutStr = dto.getCheckOutTime() != null ? dto.getCheckOutTime().format(TIME_FORMATTER) : "";
        String workHoursStr = calculateWorkHours(dto.getCheckInTime(), dto.getCheckOutTime());
        String statusStr = translateStatus(dto.getStatus());
        String kioskName = dto.getKioskName() != null ? dto.getKioskName() : "—";

        String row = String.format(Locale.US, "%d,%s,%s,%s,%s,%s,%s,%s,%s,%s\r\n",
                stt,
                escapeCsvValue(empCode),
                escapeCsvText(fullName),
                workDateStr,
                escapeCsvText(shiftName),
                checkInStr,
                checkOutStr,
                workHoursStr,
                escapeCsvText(statusStr),
                escapeCsvText(kioskName));

        writer.write(row);
    }

    private String resolveShiftName(AttendanceRecord record, LocalDate workDate, Shift fallbackShift) {
        if (record.getShift() != null && record.getShift().getName() != null) {
            return record.getShift().getName();
        }
        if (workDate != null && record.getUser() != null && record.getUser().getId() != null) {
            EmployeeShift es = employeeShiftRepository.findByUserIdAndAssignedDate(record.getUser().getId(), workDate).orElse(null);
            if (es != null) {
                if (es.getShiftName() != null && !es.getShiftName().isBlank()) {
                    return es.getShiftName();
                }
                if (es.getShift() != null && es.getShift().getName() != null) {
                    return es.getShift().getName();
                }
            } else if (fallbackShift != null && fallbackShift.getName() != null) {
                return fallbackShift.getName();
            }
        }
        return "—";
    }

    private String calculateWorkHours(LocalDateTime checkIn, LocalDateTime checkOut) {
        if (checkIn == null || checkOut == null) {
            return "";
        }
        long seconds = java.time.Duration.between(checkIn, checkOut).getSeconds();
        if (seconds < 0) {
            return "0.00";
        }
        double hours = seconds / 3600.0;
        return String.format(Locale.US, "%.2f", hours);
    }

    private String translateStatus(String status) {
        if (status == null || status.isBlank()) {
            return "";
        }
        return switch (status.toUpperCase()) {
            case "ON_TIME" -> "Đúng giờ";
            case "LATE" -> "Đi muộn";
            case "EARLY_LEAVE" -> "Về sớm";
            case "NO_DATA" -> "Chưa chấm công";
            default -> status;
        };
    }

    private String escapeCsvText(String value) {
        if (value == null || value.isBlank()) {
            return "\"\"";
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private String escapeCsvValue(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        if (value.contains("\"") || value.contains(",") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
