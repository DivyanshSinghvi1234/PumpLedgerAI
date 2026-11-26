import { test, expect } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME || "admin";
const PASSWORD = process.env.E2E_PASSWORD || "admin123";

test.describe("PumpLedgerAI Pre-Deploy Smoke Suite", () => {
  test("login -> dashboard -> inventory -> vouchers -> payments -> bank accounts -> day closing", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel(/username/i).fill(USERNAME);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|login/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible({
      timeout: 15_000,
    });

    // Core navigation smoke checks
    const routes: Array<{ path: string; heading: RegExp }> = [
      { path: "/dashboard/inventory", heading: /Inventory & Pricing/i },
      { path: "/dashboard/vouchers", heading: /Vouchers/i },
      { path: "/dashboard/payments", heading: /Payments/i },
      { path: "/dashboard/bank-accounts", heading: /Bank & Cash Accounts/i },
      { path: "/dashboard/day-closing", heading: /Day Closing/i },
    ];

    for (const r of routes) {
      await page.goto(r.path);
      await expect(page.getByRole("heading", { name: r.heading })).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});
