import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility (A11y) Audits via axe-core", () => {
  test("Landing Page (/) should satisfy WCAG 2.1 AA accessibility guidelines", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (scanResults.violations.length > 0) {
      console.log(
        "Landing page violations:",
        JSON.stringify(scanResults.violations, null, 2),
      );
    }
    expect(scanResults.violations).toEqual([]);
  });

  test("Login Page (/login) should satisfy WCAG 2.1 AA accessibility guidelines", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (scanResults.violations.length > 0) {
      console.log(
        "Login page violations:",
        JSON.stringify(scanResults.violations, null, 2),
      );
    }
    expect(scanResults.violations).toEqual([]);
  });

  test("Forgot Password Page (/forgot-password) should satisfy WCAG 2.1 AA accessibility guidelines", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (scanResults.violations.length > 0) {
      console.log(
        "Forgot password violations:",
        JSON.stringify(scanResults.violations, null, 2),
      );
    }
    expect(scanResults.violations).toEqual([]);
  });
});
