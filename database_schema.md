# Lược đồ cơ sở dữ liệu

```mermaid
erDiagram
    ROLES ||--o{ USERS : "có"
    USERS ||--o{ FACE_DATA : "đăng ký eKYC live"
    USERS ||--o{ EMPLOYEE_SHIFTS : "được gán"
    SHIFTS ||--o{ EMPLOYEE_SHIFTS : "quy định trong"
    USERS ||--o{ ATTENDANCE_RECORDS : "chấm công AI"
    KIOSKS ||--o{ ATTENDANCE_RECORDS : "ghi nhận tại trạm"
    SHIFTS ||--o{ ATTENDANCE_RECORDS : "áp dụng"
    USERS ||--o{ LEAVE_REQUESTS : "nộp đơn"
    USERS ||--o{ LEAVE_REQUESTS : "phê duyệt"
    USERS ||--o{ ANOMALY_ALERTS : "nhận cảnh báo"

    KIOSKS {
        bigint id PK
        varchar kiosk_code UK
        varchar name
        varchar device_token UK
        varchar status
        timestamp created_at
    }

    ROLES {
        bigint id PK
        varchar name UK
        text description
    }

    USERS {
        bigint id PK
        varchar employee_code UK
        varchar full_name
        varchar email UK
        varchar phone
        varchar password_hash
        varchar avatar_url
        bigint role_id FK
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    FACE_DATA {
        bigint id PK
        bigint user_id FK
        varchar minio_image_url
        text embedding_vector
        boolean is_active
        timestamp created_at
    }

    SHIFTS {
        bigint id PK
        varchar shift_code UK
        varchar name
        time start_time
        time end_time
        integer grace_period_minutes
        timestamp created_at
    }

    EMPLOYEE_SHIFTS {
        bigint id PK
        bigint user_id FK
        bigint shift_id FK
        date effective_date
        timestamp created_at
    }

    ATTENDANCE_RECORDS {
        bigint id PK
        bigint user_id FK
        bigint kiosk_id FK
        bigint shift_id FK
        timestamp check_in_time
        timestamp check_out_time
        varchar check_in_image_url
        varchar check_out_image_url
        float confidence_score
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    LEAVE_REQUESTS {
        bigint id PK
        bigint user_id FK
        varchar leave_type
        date start_date
        date end_date
        text reason
        varchar status
        bigint approved_by FK
        text admin_comment
        timestamp created_at
    }

    ANOMALY_ALERTS {
        bigint id PK
        bigint user_id FK
        varchar alert_type
        date alert_date
        text description
        boolean is_resolved
        bigint resolved_by FK
        timestamp created_at
    }
```
