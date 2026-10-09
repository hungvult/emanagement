package com.emanagement.backend.modules.shift;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import com.emanagement.backend.modules.employee.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "employee_shifts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeShift {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @Column(name = "assigned_date", nullable = false)
    private LocalDate assignedDate;

    // ---- Snapshot thông tin ca tại thời điểm phân (sửa ca sau này không làm đổi lịch sử) ----
    @Column(name = "shift_name", nullable = false, length = 100)
    private String shiftName;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "grace_period_minutes", nullable = false)
    private Integer gracePeriodMinutes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Gán ca và chụp lại (snapshot) tên + giờ + grace của ca vào bản ghi phân công. */
    public void applyShift(Shift s) {
        this.shift = s;
        this.shiftName = s.getName();
        this.startTime = s.getStartTime();
        this.endTime = s.getEndTime();
        this.gracePeriodMinutes = s.getGracePeriodMinutes() != null ? s.getGracePeriodMinutes() : 15;
    }
}
