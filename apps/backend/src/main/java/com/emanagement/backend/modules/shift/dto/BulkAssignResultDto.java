package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class BulkAssignResultDto {
    public static final String CREATED = "CREATED";
    public static final String UPDATED = "UPDATED";
    public static final String UNCHANGED = "UNCHANGED";
    public static final String SKIPPED = "SKIPPED";

    private boolean dryRun;
    private int created;
    private int updated;
    private int unchanged;
    private int skipped;
    private List<Item> items = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        private Long userId;
        private String employeeCode;
        private String fullName;
        private LocalDate date;
        private String action;
        private String reason;
    }

    public void add(Long userId, String employeeCode, String fullName, LocalDate date, String action, String reason) {
        items.add(new Item(userId, employeeCode, fullName, date, action, reason));
        switch (action) {
            case CREATED -> created++;
            case UPDATED -> updated++;
            case UNCHANGED -> unchanged++;
            default -> skipped++;
        }
    }
}
