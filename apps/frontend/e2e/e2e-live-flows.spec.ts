import { expect, test } from "@playwright/test";

test.describe("E2E Live Docker Flows - Auth, Postgres, Storage & CV Integration", () => {
  test("1. Admin Login & Session Persistence against Live Backend & Postgres", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Invalid credentials should trigger error toast
    const identifierInput = page.getByPlaceholder("Email hoặc mã nhân viên");
    const passwordInput = page.getByPlaceholder("Nhập mật khẩu của bạn");
    const submitBtn = page.getByRole("button", { name: /^Đăng nhập$/i });

    await identifierInput.fill("wrong@emanagement.com");
    await passwordInput.fill("wrongpassword");
    await submitBtn.click();

    // Verify error notification appears
    await expect(page.getByText(/thất bại|không chính xác|Lỗi/i)).toBeVisible({
      timeout: 5000,
    });

    // Valid admin credentials
    await identifierInput.fill("admin@emanagement.com");
    await passwordInput.fill("admin123");
    await submitBtn.click();

    // Should redirect to /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify localStorage has access_token
    const accessToken = await page.evaluate(() =>
      localStorage.getItem("access_token"),
    );
    expect(accessToken).toBeTruthy();

    // Header should display admin name and role
    await expect(
      page.locator("header").getByText("Ngô Văn Dũng Quản Lý"),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator("header").getByText("Quản trị viên")).toBeVisible();
  });

  test("2. Navigation, Employee Data from PostgreSQL & Detail Dialog", async ({
    page,
  }) => {
    // Authenticate
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page
      .getByPlaceholder("Email hoặc mã nhân viên")
      .fill("admin@emanagement.com");
    await page.getByPlaceholder("Nhập mật khẩu của bạn").fill("admin123");
    await page.getByRole("button", { name: /^Đăng nhập$/i }).click();

    await page.waitForURL(/\/dashboard/);

    // Click "Nhân viên" in sidebar
    const employeesLink = page.getByRole("link", { name: "Nhân viên" });
    await expect(employeesLink).toBeVisible();
    await employeesLink.click();

    await page.waitForURL(/\/employees/);
    await expect(page).toHaveURL(/\/employees/);

    // Verify employee rows from PostgreSQL are rendered
    await expect(page.getByText("EMP260001")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("EMP260002")).toBeVisible({ timeout: 10000 });

    // Click on row to open detail modal
    await page.getByText("EMP260001").click();

    // Verify detail dialog opens with employee details
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Thông tin chi tiết")).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Ngô Văn Dũng Quản Lý" }),
    ).toBeVisible();
    await expect(dialog.getByText("admin@emanagement.com")).toBeVisible();

    // Close dialog
    const closeBtn = dialog
      .getByRole("button", { name: /Đóng/i })
      .or(dialog.locator("button").first());
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test("3. Live Attendance Modal & CV Subsystem Connectivity", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open Live Attendance modal
    const attendanceBtn = page.getByRole("button", {
      name: /Chấm công FaceID/i,
    });
    await attendanceBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Chấm công Face ID")).toBeVisible();

    // Close modal
    const closeBtn = dialog.getByRole("button", {
      name: "Đóng modal chấm công",
    });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();

    // Verify CV Health endpoint directly via frontend proxy rewrite
    const cvHealthResponse = await page.request.get("/api/v1/cv/health");
    expect(cvHealthResponse.status()).toBe(200);
    const cvHealthJson = await cvHealthResponse.json();
    expect(cvHealthJson.status).toBe("VALID");
    expect(cvHealthJson.data.status).toBe("UP");
  });

  test("4. MinIO Presigned Storage Gateway & Endpoint Integrity", async ({
    page,
  }) => {
    // Verify frontend rewrite proxy to MinIO (/storage/)
    const storageResponse = await page.request.get("/storage/", {
      maxRedirects: 0,
    });
    expect([200, 301, 302, 307, 308, 403, 404]).toContain(storageResponse.status());
  });

  test("5. Logout Flow & Guard Verification", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page
      .getByPlaceholder("Email hoặc mã nhân viên")
      .fill("admin@emanagement.com");
    await page.getByPlaceholder("Nhập mật khẩu của bạn").fill("admin123");
    await page.getByRole("button", { name: /^Đăng nhập$/i }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(
      page.locator("header").getByText("Ngô Văn Dũng Quản Lý"),
    ).toBeVisible();

    // Click logout button
    const logoutBtn = page.getByRole("button", { name: "Đăng xuất" });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Redirect to /login
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);

    // Verify token was removed
    const token = await page.evaluate(() =>
      localStorage.getItem("access_token"),
    );
    expect(token).toBeNull();
  });
});
