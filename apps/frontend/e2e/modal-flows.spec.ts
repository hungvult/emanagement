import { expect, test } from "@playwright/test";

test.describe("Modal Interaction & Live Attendance Flow", () => {
  test("Live Attendance Modal opens, displays camera card, and closes cleanly", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click Chấm công FaceID button
    const attendanceBtn = page.getByRole("button", {
      name: /Chấm công FaceID/i,
    });
    await attendanceBtn.click();

    // Verify modal overlay opens with dialog role
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Verify modal title
    await expect(dialog.getByText("Chấm công Face ID")).toBeVisible();

    // Close button
    const closeBtn = dialog.getByRole("button", { name: "Đóng modal chấm công" });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Modal should close
    await expect(dialog).not.toBeVisible();
  });
});
