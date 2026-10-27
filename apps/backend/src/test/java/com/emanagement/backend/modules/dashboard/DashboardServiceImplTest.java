package com.emanagement.backend.modules.dashboard;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.dashboard.controller.DashboardController;
import com.emanagement.backend.modules.dashboard.dto.DashboardDailyTrendDto;
import com.emanagement.backend.modules.dashboard.dto.DashboardOverviewResponseDto;
import com.emanagement.backend.modules.dashboard.service.DashboardService;
import com.emanagement.backend.modules.dashboard.service.DashboardServiceImpl;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("DashboardServiceImpl & DashboardController Unit Tests")
class DashboardServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private LeaveRequestRepository leaveRequestRepository;

    @Mock
    private AttendanceRecordRepository attendanceRecordRepository;

    @InjectMocks
    private DashboardServiceImpl dashboardService;

    private static final LocalTime WORK_START = LocalTime.of(8, 30);

    @Nested
    @DisplayName("DashboardServiceImpl - getOverview()")
    class GetOverviewTests {

        @Test
        @DisplayName("getOverview() không tham số nên lấy ngày hôm nay và tính toán đúng số liệu")
        void getOverview_noArgs_shouldUseTodayAndCalculateCorrectly() {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime startOfNextDay = today.plusDays(1).atStartOfDay();
            LocalDateTime lateThreshold = today.atTime(WORK_START);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(100L);
            when(attendanceRecordRepository.countDistinctPresentUsers(startOfDay, startOfNextDay)).thenReturn(80L);
            when(attendanceRecordRepository.countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold)).thenReturn(15L);
            when(leaveRequestRepository.countApprovedLeaveOnDate("APPROVED", today)).thenReturn(10L);

            DashboardOverviewResponseDto result = dashboardService.getOverview();

            assertNotNull(result);
            assertEquals(100L, result.getTotalEmployees());
            assertEquals(80L, result.getPresentToday());
            assertEquals(15L, result.getLateToday());
            assertEquals(10L, result.getOnLeaveToday());
            // absentToday = 100 - 80 - 10 = 10
            assertEquals(10L, result.getAbsentToday());

            verify(userRepository, times(1)).countByStatus("ACTIVE");
            verify(attendanceRecordRepository, times(1)).countDistinctPresentUsers(startOfDay, startOfNextDay);
            verify(attendanceRecordRepository, times(1)).countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold);
            verify(leaveRequestRepository, times(1)).countApprovedLeaveOnDate("APPROVED", today);
        }

        @Test
        @DisplayName("getOverview(null) nên mặc định về ngày hôm nay")
        void getOverview_nullDate_shouldFallbackToToday() {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime startOfNextDay = today.plusDays(1).atStartOfDay();
            LocalDateTime lateThreshold = today.atTime(WORK_START);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(50L);
            when(attendanceRecordRepository.countDistinctPresentUsers(startOfDay, startOfNextDay)).thenReturn(30L);
            when(attendanceRecordRepository.countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold)).thenReturn(5L);
            when(leaveRequestRepository.countApprovedLeaveOnDate("APPROVED", today)).thenReturn(8L);

            DashboardOverviewResponseDto result = dashboardService.getOverview(null);

            assertNotNull(result);
            assertEquals(50L, result.getTotalEmployees());
            assertEquals(30L, result.getPresentToday());
            assertEquals(5L, result.getLateToday());
            assertEquals(8L, result.getOnLeaveToday());
            // absentToday = 50 - 30 - 8 = 12
            assertEquals(12L, result.getAbsentToday());
        }

        @Test
        @DisplayName("getOverview(targetDate) với ngày trong quá khứ tính đúng vắng mặt")
        void getOverview_pastDate_shouldCalculateCorrectAbsent() {
            LocalDate pastDate = LocalDate.now().minusDays(5);
            LocalDateTime startOfDay = pastDate.atStartOfDay();
            LocalDateTime startOfNextDay = pastDate.plusDays(1).atStartOfDay();
            LocalDateTime lateThreshold = pastDate.atTime(WORK_START);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(40L);
            when(attendanceRecordRepository.countDistinctPresentUsers(startOfDay, startOfNextDay)).thenReturn(35L);
            when(attendanceRecordRepository.countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold)).thenReturn(7L);
            when(leaveRequestRepository.countApprovedLeaveOnDate("APPROVED", pastDate)).thenReturn(3L);

            DashboardOverviewResponseDto result = dashboardService.getOverview(pastDate);

            assertNotNull(result);
            assertEquals(40L, result.getTotalEmployees());
            assertEquals(35L, result.getPresentToday());
            assertEquals(7L, result.getLateToday());
            assertEquals(3L, result.getOnLeaveToday());
            // absentToday = 40 - 35 - 3 = 2
            assertEquals(2L, result.getAbsentToday());
        }

        @Test
        @DisplayName("getOverview(targetDate) khi present + onLeave > totalEmployees thì absentToday không âm (bằng 0)")
        void getOverview_presentAndLeaveExceedsTotal_absentShouldBeZero() {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime startOfNextDay = today.plusDays(1).atStartOfDay();
            LocalDateTime lateThreshold = today.atTime(WORK_START);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(20L);
            when(attendanceRecordRepository.countDistinctPresentUsers(startOfDay, startOfNextDay)).thenReturn(15L);
            when(attendanceRecordRepository.countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold)).thenReturn(2L);
            when(leaveRequestRepository.countApprovedLeaveOnDate("APPROVED", today)).thenReturn(10L);

            DashboardOverviewResponseDto result = dashboardService.getOverview(today);

            assertNotNull(result);
            assertEquals(20L, result.getTotalEmployees());
            assertEquals(15L, result.getPresentToday());
            assertEquals(2L, result.getLateToday());
            assertEquals(10L, result.getOnLeaveToday());
            // total(20) - present(15) - onLeave(10) = -5 -> Math.max(0, -5) = 0
            assertEquals(0L, result.getAbsentToday());
        }

        @Test
        @DisplayName("getOverview(targetDate) với ngày tương lai thì absentToday phải bằng 0")
        void getOverview_futureDate_absentTodayMustBeZero() {
            LocalDate futureDate = LocalDate.now().plusDays(3);
            LocalDateTime startOfDay = futureDate.atStartOfDay();
            LocalDateTime startOfNextDay = futureDate.plusDays(1).atStartOfDay();
            LocalDateTime lateThreshold = futureDate.atTime(WORK_START);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(50L);
            when(attendanceRecordRepository.countDistinctPresentUsers(startOfDay, startOfNextDay)).thenReturn(0L);
            when(attendanceRecordRepository.countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold)).thenReturn(0L);
            when(leaveRequestRepository.countApprovedLeaveOnDate("APPROVED", futureDate)).thenReturn(5L);

            DashboardOverviewResponseDto result = dashboardService.getOverview(futureDate);

            assertNotNull(result);
            assertEquals(50L, result.getTotalEmployees());
            assertEquals(0L, result.getPresentToday());
            assertEquals(0L, result.getLateToday());
            assertEquals(5L, result.getOnLeaveToday());
            // Ngày tương lai -> absentToday luôn là 0L
            assertEquals(0L, result.getAbsentToday());
        }

        @Test
        @DisplayName("getOverview() khi tổng nhân viên = 0 thì không gặp lỗi và absent = 0")
        void getOverview_zeroEmployees_returnsZeros() {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime startOfNextDay = today.plusDays(1).atStartOfDay();
            LocalDateTime lateThreshold = today.atTime(WORK_START);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(0L);
            when(attendanceRecordRepository.countDistinctPresentUsers(startOfDay, startOfNextDay)).thenReturn(0L);
            when(attendanceRecordRepository.countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold)).thenReturn(0L);
            when(leaveRequestRepository.countApprovedLeaveOnDate("APPROVED", today)).thenReturn(0L);

            DashboardOverviewResponseDto result = dashboardService.getOverview();

            assertNotNull(result);
            assertEquals(0L, result.getTotalEmployees());
            assertEquals(0L, result.getPresentToday());
            assertEquals(0L, result.getLateToday());
            assertEquals(0L, result.getOnLeaveToday());
            assertEquals(0L, result.getAbsentToday());
        }
    }

    @Nested
    @DisplayName("DashboardServiceImpl - getTrends()")
    class GetTrendsTests {

        @Test
        @DisplayName("getTrends(null, null) mặc định lấy 7 ngày gần nhất tính đến hôm nay")
        void getTrends_bothDatesNull_returnsSevenDays() {
            LocalDate today = LocalDate.now();
            LocalDate expectedStart = today.minusDays(6);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(100L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(80L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(LocalDateTime.class), any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(10L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any(LocalDate.class))).thenReturn(5L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(null, null);

            assertNotNull(trends);
            assertEquals(7, trends.size());
            for (int i = 0; i < 7; i++) {
                assertEquals(expectedStart.plusDays(i), trends.get(i).getDate());
            }

            // Check calculation for an element
            DashboardDailyTrendDto day0 = trends.get(0);
            assertEquals(100L, day0.getTotalEmployees());
            assertEquals(80L, day0.getPresentCount());
            assertEquals(10L, day0.getLateCount());
            // onTimeCount = 80 - 10 = 70
            assertEquals(70L, day0.getOnTimeCount());
            assertEquals(5L, day0.getOnLeaveCount());
            // absentCount = 100 - 80 - 5 = 15
            assertEquals(15L, day0.getAbsentCount());

            // totalEmployees chỉ đếm 1 lần duy nhất ngoài vòng lặp
            verify(userRepository, times(1)).countByStatus("ACTIVE");
            verify(attendanceRecordRepository, times(7)).countDistinctPresentUsers(any(), any());
            verify(attendanceRecordRepository, times(7)).countDistinctLateUsers(any(), any(), any());
            verify(leaveRequestRepository, times(7)).countApprovedLeaveOnDate(eq("APPROVED"), any());
        }

        @Test
        @DisplayName("getTrends(null, endDate) mặc định lùi lại 6 ngày từ endDate (tổng 7 ngày)")
        void getTrends_startDateNull_returnsSevenDaysUntilEndDate() {
            LocalDate customEnd = LocalDate.of(2026, 10, 20);
            LocalDate expectedStart = customEnd.minusDays(6); // 2026-10-14

            when(userRepository.countByStatus("ACTIVE")).thenReturn(50L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(40L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(5L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(2L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(null, customEnd);

            assertNotNull(trends);
            assertEquals(7, trends.size());
            assertEquals(expectedStart, trends.get(0).getDate());
            assertEquals(customEnd, trends.get(6).getDate());
        }

        @Test
        @DisplayName("getTrends(startDate, null) mặc định chạy từ startDate đến hôm nay")
        void getTrends_endDateNull_returnsFromStartDateToToday() {
            LocalDate today = LocalDate.now();
            LocalDate customStart = today.minusDays(3);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(30L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(25L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(3L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(1L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(customStart, null);

            assertNotNull(trends);
            assertEquals(4, trends.size()); // 4 days: start, start+1, start+2, today
            assertEquals(customStart, trends.get(0).getDate());
            assertEquals(today, trends.get(3).getDate());
        }

        @Test
        @DisplayName("getTrends tính đúng onTimeCount = Math.max(0, present - late) kể cả khi late > present")
        void getTrends_presentLessThanLate_onTimeCountIsZeroNotNegative() {
            LocalDate day = LocalDate.now().minusDays(1);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(50L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(5L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(8L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(2L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(day, day);

            assertEquals(1, trends.size());
            DashboardDailyTrendDto item = trends.get(0);
            assertEquals(5L, item.getPresentCount());
            assertEquals(8L, item.getLateCount());
            // onTimeCount = Math.max(0, 5 - 8) = 0
            assertEquals(0L, item.getOnTimeCount());
        }

        @Test
        @DisplayName("getTrends tính đúng absentCount không âm khi present + onLeave > totalEmployees")
        void getTrends_presentPlusLeaveExceedsTotal_absentCountIsZeroNotNegative() {
            LocalDate day = LocalDate.now().minusDays(1);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(10L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(8L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(1L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(5L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(day, day);

            assertEquals(1, trends.size());
            DashboardDailyTrendDto item = trends.get(0);
            // absentCount = Math.max(0, 10 - 8 - 5) = 0
            assertEquals(0L, item.getAbsentCount());
        }

        @Test
        @DisplayName("getTrends trả về absentCount = 0 cho các ngày trong tương lai")
        void getTrends_futureDates_absentCountMustBeZero() {
            LocalDate today = LocalDate.now();
            LocalDate futureDay = today.plusDays(2);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(100L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(0L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(0L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(3L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(today, futureDay);

            assertEquals(3, trends.size()); // today, today+1, today+2

            // today: absentCount = 100 - 0 - 3 = 97
            assertEquals(97L, trends.get(0).getAbsentCount());

            // today + 1: future -> absentCount = 0
            assertEquals(0L, trends.get(1).getAbsentCount());

            // today + 2: future -> absentCount = 0
            assertEquals(0L, trends.get(2).getAbsentCount());
        }

        @Test
        @DisplayName("getTrends ném BusinessException khi startDate lớn hơn endDate")
        void getTrends_startDateAfterEndDate_throwsBusinessException() {
            LocalDate today = LocalDate.now();
            LocalDate tomorrow = today.plusDays(1);

            BusinessException exception = assertThrows(BusinessException.class, () ->
                    dashboardService.getTrends(tomorrow, today));

            assertEquals("Ngày bắt đầu không được lớn hơn ngày kết thúc", exception.getMessage());
            verifyNoInteractions(userRepository, attendanceRecordRepository, leaveRequestRepository);
        }

        @Test
        @DisplayName("getTrends ném BusinessException khi khoảng cách giữa 2 ngày vượt quá 60 ngày (> 60)")
        void getTrends_rangeExceeds60Days_throwsBusinessException() {
            LocalDate startDate = LocalDate.of(2026, 1, 1);
            LocalDate endDate = startDate.plusDays(61); // Khoảng cách là 61 ngày

            BusinessException exception = assertThrows(BusinessException.class, () ->
                    dashboardService.getTrends(startDate, endDate));

            assertEquals("Khoảng thời gian thống kê tối đa không vượt quá 60 ngày", exception.getMessage());
            verifyNoInteractions(userRepository, attendanceRecordRepository, leaveRequestRepository);
        }

        @Test
        @DisplayName("getTrends với khoảng cách đúng 60 ngày (61 ngày tất cả) không ném exception và chạy thành công")
        void getTrends_rangeExactly60Days_success() {
            LocalDate startDate = LocalDate.of(2026, 1, 1);
            LocalDate endDate = startDate.plusDays(60); // ChronoUnit.DAYS.between == 60

            when(userRepository.countByStatus("ACTIVE")).thenReturn(50L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(40L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(5L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(2L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(startDate, endDate);

            assertNotNull(trends);
            assertEquals(61, trends.size());
            assertEquals(startDate, trends.get(0).getDate());
            assertEquals(endDate, trends.get(60).getDate());
        }

        @Test
        @DisplayName("getTrends với 1 ngày duy nhất (startDate == endDate) trả về danh sách 1 phần tử")
        void getTrends_singleDay_returnsOneItem() {
            LocalDate day = LocalDate.of(2026, 5, 20);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(10L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(8L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(2L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(1L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(day, day);

            assertNotNull(trends);
            assertEquals(1, trends.size());
            assertEquals(day, trends.get(0).getDate());
            assertEquals(8L, trends.get(0).getPresentCount());
            assertEquals(2L, trends.get(0).getLateCount());
            assertEquals(6L, trends.get(0).getOnTimeCount()); // 8 - 2
            assertEquals(1L, trends.get(0).getOnLeaveCount());
            // absent = 10 - 8 - 1 = 1
            assertEquals(1L, trends.get(0).getAbsentCount());
        }

        @Test
        @DisplayName("getTrends ném BusinessException khi startDate ở tương lai và endDate == null (vì endDate mặc định là today)")
        void getTrends_startDateInFutureAndEndDateNull_throwsBusinessException() {
            LocalDate futureStart = LocalDate.now().plusDays(2);

            BusinessException exception = assertThrows(BusinessException.class, () ->
                    dashboardService.getTrends(futureStart, null));

            assertEquals("Ngày bắt đầu không được lớn hơn ngày kết thúc", exception.getMessage());
            verifyNoInteractions(userRepository, attendanceRecordRepository, leaveRequestRepository);
        }

        @Test
        @DisplayName("getTrends ném BusinessException khi startDate cách hôm nay 61 ngày và endDate == null (> 60 ngày)")
        void getTrends_startDate61DaysAgoAndEndDateNull_throwsBusinessException() {
            LocalDate today = LocalDate.now();
            LocalDate start61DaysAgo = today.minusDays(61);

            BusinessException exception = assertThrows(BusinessException.class, () ->
                    dashboardService.getTrends(start61DaysAgo, null));

            assertEquals("Khoảng thời gian thống kê tối đa không vượt quá 60 ngày", exception.getMessage());
            verifyNoInteractions(userRepository, attendanceRecordRepository, leaveRequestRepository);
        }

        @Test
        @DisplayName("getTrends với startDate đúng 60 ngày trước và endDate == null trả về đúng 61 ngày thành công")
        void getTrends_startDate60DaysAgoAndEndDateNull_success() {
            LocalDate today = LocalDate.now();
            LocalDate start60DaysAgo = today.minusDays(60);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(50L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(40L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(5L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(2L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(start60DaysAgo, null);

            assertNotNull(trends);
            assertEquals(61, trends.size());
            assertEquals(start60DaysAgo, trends.get(0).getDate());
            assertEquals(today, trends.get(60).getDate());
        }

        @Test
        @DisplayName("getTrends với toàn bộ dải ngày trong tương lai thì tất cả absentCount đều bằng 0")
        void getTrends_allFutureDates_absentCountsAreZero() {
            LocalDate today = LocalDate.now();
            LocalDate futureStart = today.plusDays(2);
            LocalDate futureEnd = today.plusDays(4);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(80L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(0L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(0L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(2L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(futureStart, futureEnd);

            assertEquals(3, trends.size());
            for (DashboardDailyTrendDto day : trends) {
                assertTrue(day.getDate().isAfter(today));
                assertEquals(0L, day.getAbsentCount(), "Ngày trong tương lai phải có absentCount = 0");
            }
        }

        @Test
        @DisplayName("getTrends khi hệ thống chưa có nhân viên nào (totalEmployees = 0) trả về các chỉ số đều bằng 0")
        void getTrends_zeroEmployees_returnsZeros() {
            LocalDate day = LocalDate.now().minusDays(1);

            when(userRepository.countByStatus("ACTIVE")).thenReturn(0L);
            when(attendanceRecordRepository.countDistinctPresentUsers(any(), any())).thenReturn(0L);
            when(attendanceRecordRepository.countDistinctLateUsers(any(), any(), any())).thenReturn(0L);
            when(leaveRequestRepository.countApprovedLeaveOnDate(eq("APPROVED"), any())).thenReturn(0L);

            List<DashboardDailyTrendDto> trends = dashboardService.getTrends(day, day);

            assertEquals(1, trends.size());
            DashboardDailyTrendDto item = trends.get(0);
            assertEquals(0L, item.getTotalEmployees());
            assertEquals(0L, item.getPresentCount());
            assertEquals(0L, item.getLateCount());
            assertEquals(0L, item.getOnTimeCount());
            assertEquals(0L, item.getOnLeaveCount());
            assertEquals(0L, item.getAbsentCount());
        }
    }

    @Nested
    @DisplayName("DashboardController Unit Tests")
    class DashboardControllerTests {

        private DashboardService mockDashboardService;
        private DashboardController dashboardController;

        @BeforeEach
        void setUp() {
            mockDashboardService = mock(DashboardService.class);
            dashboardController = new DashboardController(mockDashboardService);
        }

        @Test
        @DisplayName("controller.getOverview(null) nên gọi dashboardService.getOverview() không tham số")
        void getOverview_nullDate_callsServiceNoArgs() {
            DashboardOverviewResponseDto mockResponse = DashboardOverviewResponseDto.builder()
                    .totalEmployees(100)
                    .presentToday(80)
                    .lateToday(10)
                    .onLeaveToday(5)
                    .absentToday(15)
                    .build();

            when(mockDashboardService.getOverview()).thenReturn(mockResponse);

            ResponseEntity<ApiResponse<DashboardOverviewResponseDto>> response =
                    dashboardController.getOverview(null);

            assertNotNull(response);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals("SUCCESS", response.getBody().getStatus());
            assertEquals("Lấy dữ liệu dashboard thành công", response.getBody().getMessage());
            assertEquals(mockResponse, response.getBody().getData());

            verify(mockDashboardService, times(1)).getOverview();
            verify(mockDashboardService, never()).getOverview(any(LocalDate.class));
        }

        @Test
        @DisplayName("controller.getOverview(date) nên gọi dashboardService.getOverview(date)")
        void getOverview_specificDate_callsServiceWithDate() {
            LocalDate date = LocalDate.of(2026, 10, 15);
            DashboardOverviewResponseDto mockResponse = DashboardOverviewResponseDto.builder()
                    .totalEmployees(50)
                    .presentToday(40)
                    .lateToday(5)
                    .onLeaveToday(2)
                    .absentToday(8)
                    .build();

            when(mockDashboardService.getOverview(date)).thenReturn(mockResponse);

            ResponseEntity<ApiResponse<DashboardOverviewResponseDto>> response =
                    dashboardController.getOverview(date);

            assertNotNull(response);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals("SUCCESS", response.getBody().getStatus());
            assertEquals("Lấy dữ liệu dashboard thành công", response.getBody().getMessage());
            assertEquals(mockResponse, response.getBody().getData());

            verify(mockDashboardService, times(1)).getOverview(date);
            verify(mockDashboardService, never()).getOverview();
        }

        @Test
        @DisplayName("controller.getTrends(startDate, endDate) nên gọi dashboardService.getTrends(startDate, endDate)")
        void getTrends_callsServiceGetTrends() {
            LocalDate start = LocalDate.of(2026, 10, 1);
            LocalDate end = LocalDate.of(2026, 10, 7);
            List<DashboardDailyTrendDto> mockTrends = List.of(
                    DashboardDailyTrendDto.builder().date(start).totalEmployees(50).presentCount(45).build(),
                    DashboardDailyTrendDto.builder().date(end).totalEmployees(50).presentCount(48).build()
            );

            when(mockDashboardService.getTrends(start, end)).thenReturn(mockTrends);

            ResponseEntity<ApiResponse<List<DashboardDailyTrendDto>>> response =
                    dashboardController.getTrends(start, end);

            assertNotNull(response);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals("SUCCESS", response.getBody().getStatus());
            assertEquals("Lấy dữ liệu xu hướng chấm công thành công", response.getBody().getMessage());
            assertEquals(mockTrends, response.getBody().getData());

            verify(mockDashboardService, times(1)).getTrends(start, end);
        }

        @Test
        @DisplayName("controller.getTrends(null, null) nên ủy quyền gọi dashboardService.getTrends(null, null)")
        void getTrends_nullDates_callsServiceGetTrendsWithNulls() {
            List<DashboardDailyTrendDto> mockTrends = List.of(
                    DashboardDailyTrendDto.builder().date(LocalDate.now()).totalEmployees(50).presentCount(45).build()
            );

            when(mockDashboardService.getTrends(null, null)).thenReturn(mockTrends);

            ResponseEntity<ApiResponse<List<DashboardDailyTrendDto>>> response =
                    dashboardController.getTrends(null, null);

            assertNotNull(response);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals("SUCCESS", response.getBody().getStatus());
            assertEquals("Lấy dữ liệu xu hướng chấm công thành công", response.getBody().getMessage());
            assertEquals(mockTrends, response.getBody().getData());

            verify(mockDashboardService, times(1)).getTrends(null, null);
        }
    }
}
