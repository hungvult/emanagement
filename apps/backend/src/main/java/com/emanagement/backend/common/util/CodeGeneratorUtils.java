package com.emanagement.backend.common.util;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.function.Function;

public final class CodeGeneratorUtils {

    private static final DateTimeFormatter YEAR_FORMAT = DateTimeFormatter.ofPattern("yy"); // 26
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyMM"); // 2608

    private CodeGeneratorUtils() {
    }

    /**
     * Quy tắc sinh Mã Nhân Viên: EMP + Năm(2 chữ số) + Số thứ tự 4 số (Ví dụ: EMP260001, EMP260002)
     */
    public static String generateEmployeeCode(Function<String, Boolean> existsChecker) {
        String yearPrefix = "EMP" + LocalDate.now().format(YEAR_FORMAT);
        return generateSequenceCode(yearPrefix, 4, existsChecker);
    }

    /**
     * Quy tắc sinh Mã Trạm Kiosk: KSK- NămTháng(4 chữ số) - Số thứ tự 3 số (Ví dụ: KSK-2608-001, KSK-2608-002)
     */
    public static String generateKioskCode(Function<String, Boolean> existsChecker) {
        String monthPrefix = "KSK-" + LocalDate.now().format(MONTH_FORMAT) + "-";
        return generateSequenceCode(monthPrefix, 3, existsChecker);
    }

    /**
     * Quy tắc sinh Mã Ca Làm Việc: SHIFT- Số thứ tự 3 số (Ví dụ: SHIFT-001, SHIFT-002)
     */
    public static String generateShiftCode(Function<String, Boolean> existsChecker) {
        return generateSequenceCode("SHIFT-", 3, existsChecker);
    }

    private static String generateSequenceCode(String prefix, int digitCount, Function<String, Boolean> existsChecker) {
        int sequence = 1;
        String format = prefix + "%0" + digitCount + "d";
        while (true) {
            String candidateCode = String.format(format, sequence);
            if (!existsChecker.apply(candidateCode)) {
                return candidateCode;
            }
            sequence++;
        }
    }
}
