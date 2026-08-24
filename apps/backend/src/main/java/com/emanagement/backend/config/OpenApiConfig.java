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

import java.util.Map;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "Bearer Authentication";

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

            // Đăng ký schema ApiResponseError vào components.schemas
            if (openApi.getComponents().getSchemas() == null || !openApi.getComponents().getSchemas().containsKey("ApiResponseError")) {
                Map<String, Schema> schemas = ModelConverters.getInstance().readAll(ApiResponse.class);
                if (schemas.containsKey("ApiResponse")) {
                    openApi.getComponents().addSchemas("ApiResponseError", schemas.get("ApiResponse"));
                } else if (!schemas.isEmpty()) {
                    openApi.getComponents().addSchemas("ApiResponseError", schemas.values().iterator().next());
                } else {
                    Schema<Object> fallbackSchema = new Schema<>()
                            .type("object")
                            .addProperty("status", new Schema<>().type("string").example("ERROR"))
                            .addProperty("message", new Schema<>().type("string").example("Thông báo lỗi chi tiết"))
                            .addProperty("data", new Schema<>().type("object").nullable(true))
                            .addProperty("timestamp", new Schema<>().type("string").format("date-time").example("2026-08-24T12:00:00"));
                    openApi.getComponents().addSchemas("ApiResponseError", fallbackSchema);
                }
            }

            Content errorContent = new Content().addMediaType(
                    org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                    new MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiResponseError"))
            );

            if (openApi.getPaths() != null) {
                openApi.getPaths().values().forEach(pathItem -> pathItem.readOperations().forEach(operation -> {
                    ApiResponses responses = operation.getResponses();

                    if (!responses.containsKey("400")) {
                        responses.addApiResponse("400", new io.swagger.v3.oas.models.responses.ApiResponse()
                                .description("Yêu cầu không hợp lệ hoặc lỗi nghiệp vụ (Bad Request / Business Exception)")
                                .content(errorContent));
                    }
                    if (!responses.containsKey("401")) {
                        responses.addApiResponse("401", new io.swagger.v3.oas.models.responses.ApiResponse()
                                .description("Chưa xác thực hoặc Token không hợp lệ (Unauthorized)")
                                .content(errorContent));
                    }
                    if (!responses.containsKey("403")) {
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
                }));
            }
        };
    }
}
