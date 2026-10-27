package com.emanagement.backend.config;

import org.springdoc.core.customizers.GlobalOpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.emanagement.backend.common.dto.ApiResponse;

import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

import java.util.Collections;
import java.util.Map;
import java.util.Set;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "Bearer Authentication";

    private static final Set<String> PUBLIC_ENDPOINTS = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/refresh-token",
            "/api/v1/auth/logout",
            "/api/v1/auth/send-otp",
            "/api/v1/auth/verify-otp",
            "/api/v1/auth/reset-password",
            "/api/v1/kiosks/check-in"
    );

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("eManagement Backend API")
                        .version("1.0.0")
                        .description("API chuẩn RESTful cho hệ thống chấm công AI & quản lý nhân sự eManagement"))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Nhập token theo định dạng: Bearer <token>")));
    }

    @Bean
    public GlobalOpenApiCustomizer globalOpenApiCustomizer() {
        return openApi -> {
            // Đảm bảo components tồn tại
            if (openApi.getComponents() == null) {
                openApi.setComponents(new Components());
            }

            // Đăng ký schema ApiResponseError chuẩn OpenAPI 3.1 hỗ trợ data nullable
            Schema<Object> errorSchema = new Schema<>()
                    .type("object")
                    .description("Đối tượng phản hồi tiêu chuẩn của hệ thống")
                    .addProperty("status", new Schema<>().type("string").example("ERROR").description("Trạng thái phản hồi"))
                    .addProperty("message", new Schema<>().type("string").example("Thông báo lỗi chi tiết").description("Thông điệp phản hồi"))
                    .addProperty("data", new Schema<>().types(Set.of("object", "null")).description("Dữ liệu trả về"))
                    .addProperty("timestamp", new Schema<>().type("string").format("date-time").example("2026-08-24T12:00:00Z").description("Thời điểm phản hồi"));
            openApi.getComponents().addSchemas("ApiResponseError", errorSchema);

            Content errorContent = new Content().addMediaType(
                    org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                    new MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiResponseError"))
            );

            if (openApi.getPaths() != null) {
                openApi.getPaths().forEach((path, pathItem) -> {
                    boolean isPublic = PUBLIC_ENDPOINTS.contains(path);
                    pathItem.readOperations().forEach(operation -> {
                        if (isPublic) {
                            operation.setSecurity(Collections.emptyList());
                        }

                        ApiResponses responses = operation.getResponses();

                        if (!responses.containsKey("400")) {
                            responses.addApiResponse("400", new io.swagger.v3.oas.models.responses.ApiResponse()
                                    .description("Yêu cầu không hợp lệ hoặc lỗi nghiệp vụ (Bad Request / Business Exception)")
                                    .content(errorContent));
                        }
                        if (!responses.containsKey("401") && !isPublic) {
                            responses.addApiResponse("401", new io.swagger.v3.oas.models.responses.ApiResponse()
                                    .description("Chưa xác thực hoặc Token không hợp lệ (Unauthorized)")
                                    .content(errorContent));
                        }
                        if (!responses.containsKey("403") && !isPublic) {
                            responses.addApiResponse("403", new io.swagger.v3.oas.models.responses.ApiResponse()
                                    .description("Không có quyền truy cập tài nguyên (Forbidden)")
                                    .content(errorContent));
                        }
                        if (!responses.containsKey("404")) {
                            responses.addApiResponse("404", new io.swagger.v3.oas.models.responses.ApiResponse()
                                    .description("Không tìm thấy tài nguyên (Resource Not Found)")
                                    .content(errorContent));
                        }
                        if (!responses.containsKey("500")) {
                            responses.addApiResponse("500", new io.swagger.v3.oas.models.responses.ApiResponse()
                                    .description("Lỗi hệ thống nội bộ (Internal Server Error)")
                                    .content(errorContent));
                        }
                    });
                });
            }
        };
    }
}
