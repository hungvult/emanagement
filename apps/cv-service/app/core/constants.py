from enum import Enum


class CvStatus(str, Enum):
    VALID = "VALID"
    NO_FACE = "NO_FACE"
    MULTIPLE_FACES = "MULTIPLE_FACES"
    FACE_TOO_SMALL = "FACE_TOO_SMALL"
    FACE_NOT_CENTERED = "FACE_NOT_CENTERED"
    FACE_POSE_INVALID = "FACE_POSE_INVALID"
    FACE_UNSTABLE = "FACE_UNSTABLE"
    IMAGE_TOO_BLURRY = "IMAGE_TOO_BLURRY"
    IMAGE_TOO_DARK = "IMAGE_TOO_DARK"
    LOW_FACE_QUALITY = "LOW_FACE_QUALITY"
    SPOOF_DETECTED = "SPOOF_DETECTED"
    UNKNOWN_FACE = "UNKNOWN_FACE"
    AMBIGUOUS_MATCH = "AMBIGUOUS_MATCH"
    MATCHED = "MATCHED"
    ENROLLMENT_SUCCESS = "ENROLLMENT_SUCCESS"
    INTERNAL_ERROR = "INTERNAL_ERROR"


STATUS_MESSAGES: dict[CvStatus, str] = {
    CvStatus.VALID: "Khung hình hợp lệ.",
    CvStatus.NO_FACE: "Không phát hiện khuôn mặt trong vùng camera.",
    CvStatus.MULTIPLE_FACES: "Phát hiện nhiều khuôn mặt trong vùng camera. Chỉ chấp nhận 1 người.",
    CvStatus.FACE_TOO_SMALL: "Khuôn mặt quá nhỏ. Vui lòng tiến lại gần camera.",
    CvStatus.FACE_NOT_CENTERED: "Khuôn mặt nằm ngoài vùng quét hợp lệ. Vui lòng di chuyển vào giữa.",
    CvStatus.FACE_POSE_INVALID: "Góc nghiêng khuôn mặt không hợp lệ. Vui lòng nhìn thẳng vào camera.",
    CvStatus.FACE_UNSTABLE: "Vị trí khuôn mặt chưa ổn định. Vui lòng giữ nguyên tư thế.",
    CvStatus.IMAGE_TOO_BLURRY: "Hình ảnh bị mờ. Vui lòng giữ yên hoặc kiểm tra ống kính camera.",
    CvStatus.IMAGE_TOO_DARK: "Môi trường quá tối. Vui lòng điều chỉnh ánh sáng.",
    CvStatus.LOW_FACE_QUALITY: "Chất lượng khuôn mặt không đạt yêu cầu.",
    CvStatus.SPOOF_DETECTED: "Phát hiện hành vi giả mạo khuôn mặt (Anti-Spoofing).",
    CvStatus.UNKNOWN_FACE: "Không nhận diện được nhân viên trên hệ thống.",
    CvStatus.AMBIGUOUS_MATCH: "Độ tương đồng giữa các ứng viên quá gần nhau. Không thể xác định chính xác.",
    CvStatus.MATCHED: "Nhận diện thành công.",
    CvStatus.ENROLLMENT_SUCCESS: "Đăng ký dữ liệu khuôn mặt thành công.",
    CvStatus.INTERNAL_ERROR: "Lỗi xử lý nội bộ dịch vụ AI.",
}
