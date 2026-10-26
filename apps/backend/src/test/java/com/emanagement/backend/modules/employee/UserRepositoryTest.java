package com.emanagement.backend.modules.employee;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserRepository default findEmployeesForWeeklySchedule Tests")
class UserRepositoryTest {

    @Mock
    private UserRepository userRepository;

    private LocalDate startDate;
    private LocalDate endDate;
    private Pageable pageable;
    private Page<User> emptyPage;

    @BeforeEach
    void setUp() {
        startDate = LocalDate.of(2026, 10, 20);
        endDate = LocalDate.of(2026, 10, 26);
        pageable = PageRequest.of(0, 20);
        emptyPage = new PageImpl<>(Collections.emptyList());

        when(userRepository.findEmployeesForWeeklySchedule(any(), any(), any(), any()))
                .thenCallRealMethod();
    }

    @Nested
    @DisplayName("Blank or Null Keyword Delegation")
    class BlankOrNullKeywordTests {

        @Test
        @DisplayName("Kiểm tra khi keyword là null: ủy quyền sang findEmployeesForWeeklyScheduleWithoutKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordIsNull_DelegatesToWithoutKeyword() {
            when(userRepository.findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule(null, startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithKeyword(any(), any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra khi keyword là \"\" (rỗng): ủy quyền sang findEmployeesForWeeklyScheduleWithoutKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordIsEmpty_DelegatesToWithoutKeyword() {
            when(userRepository.findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("", startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithKeyword(any(), any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra khi keyword là \"   \" (chỉ khoảng trắng): ủy quyền sang findEmployeesForWeeklyScheduleWithoutKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordIsWhitespace_DelegatesToWithoutKeyword() {
            when(userRepository.findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("   ", startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithKeyword(any(), any(), any(), any());
        }

        @ParameterizedTest(name = "keyword = \"{0}\"")
        @NullSource
        @ValueSource(strings = {"", " ", "   ", "\t", "\n", "\r\n", "\t \n \r  ", "\u3000", "\u2000"})
        @DisplayName("Kiểm tra các biến thể null, empty, whitespace và unicode blank: đều ủy quyền sang findEmployeesForWeeklyScheduleWithoutKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordIsBlankOrNull_DelegatesToWithoutKeyword(String keyword) {
            when(userRepository.findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule(keyword, startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithKeyword(any(), any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra khi keyword null kết hợp startDate, endDate, pageable null: ủy quyền đúng các giá trị null sang withoutKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordIsNullAndDatesNull_DelegatesToWithoutKeywordWithNulls() {
            when(userRepository.findEmployeesForWeeklyScheduleWithoutKeyword(null, null, null))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule(null, null, null, null);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithoutKeyword(null, null, null);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithKeyword(any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("Valid Keyword Delegation and Trimming")
    class ValidKeywordTests {

        @Test
        @DisplayName("Kiểm tra khi keyword có khoảng trắng hai đầu \"  Nguyen  \": phải trim chuỗi thành \"Nguyen\" và ủy quyền sang findEmployeesForWeeklyScheduleWithKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordHasUntrimmedWhitespace_TrimsAndDelegatesToWithKeyword() {
            when(userRepository.findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("  Nguyen  ", startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithoutKeyword(any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra khi keyword đã chuẩn hóa \"Nguyen\": ủy quyền trực tiếp sang findEmployeesForWeeklyScheduleWithKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordIsAlreadyTrimmed_DelegatesToWithKeyword() {
            when(userRepository.findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("Nguyen", startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithoutKeyword(any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra khi keyword chứa khoảng trắng ở giữa \"   Nguyen Van A   \": chỉ trim hai đầu và giữ nguyên khoảng trắng bên trong")
        void findEmployeesForWeeklySchedule_WhenKeywordHasInternalSpaces_PreservesInternalSpacesAndTrims() {
            when(userRepository.findEmployeesForWeeklyScheduleWithKeyword("Nguyen Van A", startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("   Nguyen Van A   ", startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithKeyword("Nguyen Van A", startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithoutKeyword(any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra khi keyword có tabs và xuống dòng hai đầu \"\\t\\r\\n  Nguyen  \\r\\n\\t\": trim chính xác về \"Nguyen\"")
        void findEmployeesForWeeklySchedule_WhenKeywordHasTabsAndNewlines_TrimsAndDelegatesToWithKeyword() {
            when(userRepository.findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("\t\r\n  Nguyen  \r\n\t", startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithoutKeyword(any(), any(), any());
        }

        @ParameterizedTest(name = "rawKeyword = \"{0}\" -> trimmed = \"{1}\"")
        @ValueSource(strings = {
            "  EMP-001  :EMP-001",
            "\tuser@company.com \n:user@company.com",
            "  0987654321  :0987654321",
            " a :a"
        })
        @DisplayName("Kiểm tra các kiểu keyword thực tế (mã nhân viên, email, số điện thoại, ký tự đơn) được trim chính xác")
        void findEmployeesForWeeklySchedule_WithDomainKeywords_TrimsAndDelegatesCorrectly(String testCase) {
            String[] parts = testCase.split(":");
            String rawKeyword = parts[0];
            String expectedTrimmed = parts[1];

            when(userRepository.findEmployeesForWeeklyScheduleWithKeyword(expectedTrimmed, startDate, endDate, pageable))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule(rawKeyword, startDate, endDate, pageable);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithKeyword(expectedTrimmed, startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithoutKeyword(any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra khi keyword hợp lệ nhưng startDate, endDate, pageable null: ủy quyền đúng các giá trị null sang withKeyword")
        void findEmployeesForWeeklySchedule_WhenKeywordValidAndDatesNull_DelegatesToWithKeywordWithNulls() {
            when(userRepository.findEmployeesForWeeklyScheduleWithKeyword("Nguyen", null, null, null))
                    .thenReturn(emptyPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("  Nguyen  ", null, null, null);

            assertSame(emptyPage, result);
            verify(userRepository).findEmployeesForWeeklyScheduleWithKeyword("Nguyen", null, null, null);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithoutKeyword(any(), any(), any());
        }

        @Test
        @DisplayName("Kiểm tra bảo toàn dữ liệu Page<User> khi delegate trả về trang chứa entity User thực tế")
        void findEmployeesForWeeklySchedule_PreservesPageContentAndMetadata() {
            User testUser = User.builder()
                    .id(1L)
                    .employeeCode("EMP001")
                    .fullName("Nguyen Van A")
                    .email("nguyenvana@example.com")
                    .phone("0987654321")
                    .build();
            Page<User> populatedPage = new PageImpl<>(List.of(testUser), pageable, 1);

            when(userRepository.findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable))
                    .thenReturn(populatedPage);

            Page<User> result = userRepository.findEmployeesForWeeklySchedule("  Nguyen  ", startDate, endDate, pageable);

            assertNotNull(result);
            assertSame(populatedPage, result);
            assertEquals(1, result.getTotalElements());
            assertEquals("EMP001", result.getContent().getFirst().getEmployeeCode());
            assertEquals("Nguyen Van A", result.getContent().getFirst().getFullName());
            verify(userRepository).findEmployeesForWeeklyScheduleWithKeyword("Nguyen", startDate, endDate, pageable);
            verify(userRepository, never()).findEmployeesForWeeklyScheduleWithoutKeyword(any(), any(), any());
        }
    }
}
