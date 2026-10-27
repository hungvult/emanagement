import { expect, test } from "@playwright/test";

test.describe("Navigation, Authentication & Route Guarding", () => {
  test("Landing Page renders brand, live clock, and CTA actions", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Brand title
    await expect(page.locator("header")).toContainText("eManagement");

    // Header Navigation Link
    const loginLink = page.locator("header").getByRole("link", { name: "Đăng nhập" });
    await expect(loginLink).toBeVisible();

    // Hero headline
    await expect(
      page.getByRole("heading", { name: /Kỷ nguyên mới của/i }),
    ).toBeVisible();

    // Live Attendance Trigger Button
    const attendanceBtn = page.getByRole("button", {
      name: /Chấm công FaceID/i,
    });
    await expect(attendanceBtn).toBeVisible();
  });

  test("Protected dashboard route redirects unauthenticated user to login with redirect parameter", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Should be redirected by AuthGuard to /login?redirect=%2Fdashboard
    await page.waitForURL(/\/login\?redirect=%2Fdashboard/);
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);

    // Form inputs should be visible
    await expect(
      page.getByPlaceholder("Email hoặc mã nhân viên"),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Nhập mật khẩu của bạn"),
    ).toBeVisible();
  });

  test("Protected alerts route redirects unauthenticated user to login with redirect parameter", async ({
    page,
  }) => {
    await page.goto("/alerts");
    await page.waitForURL(/\/login\?redirect=%2Falerts/);
    await expect(page).toHaveURL(/\/login\?redirect=%2Falerts/);
  });

  test("Protected shifts route redirects unauthenticated user to login with redirect parameter", async ({
    page,
  }) => {
    await page.goto("/shifts");
    await page.waitForURL(/\/login\?redirect=%2Fshifts/);
    await expect(page).toHaveURL(/\/login\?redirect=%2Fshifts/);
  });

  test("Login page client validation and password visibility toggle", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const passwordInput = page.getByPlaceholder("Nhập mật khẩu của bạn");
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click toggle password button (has accessible name "Hiện mật khẩu")
    const toggleBtn = page.getByRole("button", { name: "Hiện mật khẩu" });
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to hide (has accessible name "Ẩn mật khẩu")
    const hideBtn = page.getByRole("button", { name: "Ẩn mật khẩu" });
    await hideBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Submit empty form -> check toast error
    const submitBtn = page.getByRole("button", { name: /^Đăng nhập$/i });
    await submitBtn.click();

    // Verify error toast message appears
    await expect(
      page.getByText("Vui lòng nhập tài khoản và mật khẩu"),
    ).toBeVisible();
  });
});
