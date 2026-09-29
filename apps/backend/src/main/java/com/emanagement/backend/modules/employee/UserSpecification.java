package com.emanagement.backend.modules.employee;

import com.emanagement.backend.modules.face.FaceData;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

/**
 * Dynamic Specification builder cho bộ lọc nhân viên.
 * Hỗ trợ lọc theo: keyword (tên, mã NV, email, SĐT), status, hasRegisteredFace.
 */
public class UserSpecification {

    private UserSpecification() {
    }

    /**
     * Tìm kiếm theo từ khóa: fullName, employeeCode, email, phone (LIKE %keyword%)
     */
    public static Specification<User> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            if (keyword == null || keyword.isBlank()) {
                return cb.conjunction();
            }
            String pattern = "%" + keyword.trim().toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("fullName")), pattern),
                    cb.like(cb.lower(root.get("employeeCode")), pattern),
                    cb.like(cb.lower(root.get("email")), pattern),
                    cb.like(cb.lower(root.get("phone")), pattern));
        };
    }

    /**
     * Lọc theo trạng thái: ACTIVE, INACTIVE
     */
    public static Specification<User> hasStatus(String status) {
        return (root, query, cb) -> {
            if (status == null || status.isBlank()) {
                return cb.conjunction();
            }
            return cb.equal(root.get("status"), status.trim().toUpperCase());
        };
    }

    /**
     * Lọc theo đã đăng ký Face ID hay chưa (subquery tới bảng face_data)
     */
    public static Specification<User> hasRegisteredFace(Boolean hasRegisteredFace) {
        return (root, query, cb) -> {
            if (hasRegisteredFace == null) {
                return cb.conjunction();
            }
            Subquery<Long> subquery = query.subquery(Long.class);
            Root<FaceData> faceRoot = subquery.from(FaceData.class);
            subquery.select(cb.literal(1L))
                    .where(cb.equal(faceRoot.get("user").get("id"), root.get("id")));

            if (hasRegisteredFace) {
                return cb.exists(subquery);
            } else {
                return cb.not(cb.exists(subquery));
            }
        };
    }
}
