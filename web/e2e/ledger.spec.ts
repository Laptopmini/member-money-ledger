import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { compose, openOctober, resetState, STATE_FILE, VENDOR, waitForVendor } from "./helpers";

// Seed: Oct 2026 income $8,500.00, spend $45.99, net +$8,454.01, +$312.75 pending,
// 1 uncategorized (Delta, pending). Figma refund nets software to $0.00.
// Tests run serially and share vendor state; the recategorize test mutates it and later
// tests re-reset in beforeAll where they depend on the seed.

const summary = (page: Page) => page.getByRole("region", { name: /Summary for/ });
const rows = (page: Page) => page.getByRole("list", { name: "Transactions" }).getByRole("listitem");
const rowFor = (page: Page, merchant: string) =>
  rows(page).filter({ has: page.getByLabel(`Category for ${merchant}`) });

test.describe.configure({ mode: "serial" });

test("default-month (trap 21): opens on empty November, jump shows October", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No transactions in November yet")).toBeVisible();
  await page.getByRole("button", { name: "Jump to October 2026" }).click();

  const s = summary(page);
  await expect(s).toBeVisible();
  const item = (name: string) =>
    s.locator("div", { has: page.getByText(name, { exact: true }) }).first();
  await expect(item("Income")).toContainText("$8,500.00");
  await expect(item("Spend")).toContainText("$45.99");
  await expect(item("Spend")).toContainText("+ $312.75 pending");
  await expect(item("Net")).toContainText("+$8,454.01");
  await expect(s.getByRole("button", { name: /1 transaction needs a category/ })).toBeVisible();
});

test("filter: uncategorized nudge, clear, search", async ({ page }) => {
  await openOctober(page);
  await expect(rows(page)).toHaveCount(5);

  await page.getByRole("button", { name: /1 transaction needs a category/ }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Delta Air Lines");

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows(page)).toHaveCount(5);

  await page.getByLabel("Search").fill("figma");
  await expect(rows(page)).toHaveCount(2);
});

test("recategorize (traps 3, 8, 12): Delta to Travel persists, then Blue Bottle to software", async ({
  page,
  request,
}) => {
  await openOctober(page);
  const nudge = page.getByRole("button", { name: /needs a category/ });
  await expect(nudge).toBeVisible();

  await rowFor(page, "Delta Air Lines")
    .getByLabel("Category for Delta Air Lines")
    .selectOption("travel");
  await expect(page.getByText("Saved to Ledgerly")).toBeVisible();
  await expect(
    rowFor(page, "Delta Air Lines").getByLabel("Category for Delta Air Lines"),
  ).toHaveValue("travel");
  await expect(nudge).toHaveCount(0);

  // Pending spend stays out of Spend.
  const s = summary(page);
  await expect(s.locator("dd").nth(1)).toContainText("$45.99");

  // Persisted in the vendor, and survives a reload.
  const res = await request.get(`${VENDOR}/v1/transactions/txn_000004`);
  expect((await res.json()).category).toBe("travel");
  await page.reload();
  await expect(
    rowFor(page, "Delta Air Lines").getByLabel("Category for Delta Air Lines"),
  ).toHaveValue("travel");
  await expect(page.getByRole("button", { name: /needs a category/ })).toHaveCount(0);

  // Moving the only Meals row away removes the Meals bar; Spend is unchanged.
  const bars = page.getByRole("list", { name: "Spend by category" });
  await expect(bars).toContainText("Meals");
  await rowFor(page, "Blue Bottle Coffee")
    .getByLabel("Category for Blue Bottle Coffee")
    .selectOption("software");
  await expect(bars).not.toContainText("Meals", { timeout: 15_000 });
  await expect(summary(page).locator("dd").nth(1)).toContainText("$45.99");
});

test.describe("vendor down (trap 8, 17)", () => {
  test.beforeAll(async () => {
    await resetState();
  });
  test.afterAll(async () => {
    compose("start", "vendor");
    await waitForVendor();
  });

  test("banner, cached rows stay, recategorize blocked", async ({ page }) => {
    await openOctober(page);
    await expect(rows(page)).toHaveCount(5);

    compose("stop", "vendor");
    await page.getByRole("button", { name: "Refresh" }).first().click();

    await expect(page.getByText("We can't reach your bank feed right now.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(rows(page)).toHaveCount(5);
    const select = page.getByLabel("Category for Blue Bottle Coffee");
    await expect(select).toBeDisabled();
    await expect(
      page.getByText("Changes can't be saved until your bank feed is back.").first(),
    ).toBeVisible();
  });
});

test("mobile: no horizontal scroll, summary and list visible", async ({ browser }) => {
  await resetState();
  const ctx = await browser.newContext({
    storageState: STATE_FILE,
    viewport: { width: 375, height: 812 },
  });
  const page = await ctx.newPage();
  await openOctober(page);
  await expect(summary(page)).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(375);
  await ctx.close();
});

for (const scheme of ["light", "dark"] as const) {
  test(`a11y: axe on October (${scheme})`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE_FILE, colorScheme: scheme });
    const page = await ctx.newPage();
    await openOctober(page);
    await expect(summary(page)).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);
    await ctx.close();
  });
}
