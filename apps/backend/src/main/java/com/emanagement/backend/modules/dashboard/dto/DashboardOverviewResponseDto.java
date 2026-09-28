package com.emanagement.backend.modules.dashboard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter 
@Setter 
@AllArgsConstructor 
@NoArgsConstructor 
@Builder
@Data
public class DashboardOverviewResponseDto {
    private long totalEmployees;
    private long presentToday; // di lam hom nay
    private long absentToday; // khong di lam hom nay
    private long lateToday; // di lam muon hom nay
    private long onLeaveToday; // nghi phep hom nay
}
