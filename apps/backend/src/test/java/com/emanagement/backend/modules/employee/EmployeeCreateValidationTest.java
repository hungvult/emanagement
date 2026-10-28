package com.emanagement.backend.modules.employee;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import com.emanagement.backend.modules.employee.dto.EmployeeCreateDto;
import jakarta.validation.Validation;

class EmployeeCreateValidationTest {
    @Test
    void requiresNameAndEmailButAllowsMissingPhone() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var dto = new EmployeeCreateDto("Nguyen Van A", "employee@example.com", null, "DefaultPassword@123");
            assertTrue(validator.validate(dto).isEmpty());
            for (String email : new String[] { null, "", "   ", "invalid-email" }) {
                dto.setEmail(email);
                assertTrue(validator.validate(dto).stream().anyMatch(v -> v.getPropertyPath().toString().equals("email")));
            }
            dto.setEmail("employee@example.com");
            for (String name : new String[] { null, "", "   " }) {
                dto.setFullName(name);
                assertTrue(validator.validate(dto).stream().anyMatch(v -> v.getPropertyPath().toString().equals("fullName")));
            }
        }
    }
}
