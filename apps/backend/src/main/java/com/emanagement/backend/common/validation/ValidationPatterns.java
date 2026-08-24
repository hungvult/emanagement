package com.emanagement.backend.common.validation;

public final class ValidationPatterns {

    private ValidationPatterns() {
    }

    // RFC 5322 chuẩn hóa: bắt buộc định dạng username@domain.tld (tld >= 2 ký tự)
    public static final String EMAIL_REGEX = "^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,7}$";

    // Số điện thoại Việt Nam chuẩn E.164: bắt đầu 03, 05, 07, 08, 09 hoặc +84 gồm 10 chữ số
    public static final String PHONE_REGEX = "^(0|\\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$";

    // Mã nhân viên chuẩn hệ thống: Cho phép EMP260001, NV001, v.v. (Chữ cái, số, gạch ngang, gạch dưới 3-30 ký tự)
    public static final String EMPLOYEE_CODE_REGEX = "^[A-Z0-9_\\-]{3,30}$";

    // Identifier có thể là Mã nhân viên HOẶC Email hợp lệ HOẶC Số điện thoại hợp lệ
    public static final String IDENTIFIER_REGEX = "^(" + EMPLOYEE_CODE_REGEX + ")|(" + EMAIL_REGEX + ")|(" + PHONE_REGEX + ")$";

    // Mật khẩu an toàn chuẩn 2026: Tối thiểu 8 ký tự, ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số, 1 ký tự đặc biệt
    public static final String PASSWORD_STRONG_REGEX = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!._\\-*]).{8,64}$";

    // Mã ca làm việc: Chữ in hoa, số, gạch ngang, gạch dưới (2 - 50 ký tự)
    public static final String SHIFT_CODE_REGEX = "^[A-Z0-9_\\-]{2,50}$";

    // Mã Kiosk: Chữ in hoa, số, gạch ngang, gạch dưới (3 - 50 ký tự)
    public static final String KIOSK_CODE_REGEX = "^[A-Z0-9_\\-]{3,50}$";

    // Mã OTP: 6 chữ số
    public static final String OTP_CODE_REGEX = "^[0-9]{6}$";

    // Loại OTP: LOGIN_2FA, VERIFY_EMAIL, VERIFY_PHONE, RESET_PASSWORD, UPDATE_PROFILE
    public static final String OTP_TYPE_REGEX = "^(LOGIN_2FA|VERIFY_EMAIL|VERIFY_PHONE|RESET_PASSWORD|UPDATE_PROFILE)$";

    // Trạng thái phê duyệt đơn nghỉ phép
    public static final String LEAVE_STATUS_REGEX = "^(APPROVED|REJECTED)$";

    // Trạng thái nhân viên
    public static final String USER_STATUS_REGEX = "^(ACTIVE|INACTIVE)$";
}
