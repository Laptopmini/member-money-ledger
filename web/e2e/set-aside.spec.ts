import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { openOctober, resetState } from "./helpers";

// Seed, Q4 (Sep-Dec 2026): income $8,500, deductible $23.00 (meals at 50%), 25% rate,
// estimate $2,119.25. Marking Blue Bottle as personal drops deductible to 0: $2,125.00.
// reset_mirror does not clear SetAsideMark (append-only), so earlier marks can persist across
// runs: assertions on "set aside so far" are relative to what the API reports at the start.

// Each test mutates state; B depends on nothing from A.
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await resetState();
});

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

async function setAside(page: Page) {
  const res = await page.request.get("/api/tax/set-aside");
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    estimate_cents: number;
    set_aside_cents: number;
    gap_cents: number;
  };
}

const card = (page: Page) =>
  page.getByRole("region", { name: /Set aside for taxes · Q4 \(Sep–Dec\)/ });

test("set-aside A (trap 20): estimate shown, mark $1,000 moves the progress bar", async ({
  page,
}) => {
  await openOctober(page);
  const c = card(page);
  await expect(c).toBeVisible();

  const before = await setAside(page);
  expect(before.estimate_cents).toBe(211925);
  await expect(c.getByText("$2,119.25", { exact: true }).first()).toBeVisible();
  // Marks are append-only and survive reset_mirror, so earlier runs may already cover the gap.
  if (before.gap_cents > 0) {
    await expect(c.getByText(`${money(before.gap_cents)} behind`)).toBeVisible();
  } else {
    await expect(c.getByText("On track")).toBeVisible();
  }

  await c.getByRole("button", { name: "Mark as set aside" }).click();
  await c.getByLabel("Amount set aside ($)").fill("1000.00");
  await c.getByRole("button", { name: "Save" }).click();
  await expect(c.getByText("Nice. $1,000.00 set aside for Q4.")).toBeVisible();
  const afterMark = await setAside(page);
  expect(afterMark.set_aside_cents).toBe(before.set_aside_cents + 100000);
  await expect(c.getByRole("progressbar", { name: "Set aside so far" })).toHaveAttribute(
    "aria-valuenow",
    String(Math.min(100, Math.round((afterMark.set_aside_cents / 211925) * 100))),
  );
});

test("set-aside B (trap 20): meals to personal raises the estimate, axe clean", async ({
  page,
}) => {
  await resetState(); // mirror back to seed (marks are not cleared)
  await openOctober(page);
  const c = card(page);
  await expect(c.getByText("$2,119.25", { exact: true }).first()).toBeVisible();

  // Meals count 50%, personal 0%: deductible $23.00 -> $0, estimate $2,119.25 -> $2,125.00.
  await page.getByLabel("Category for Blue Bottle Coffee").selectOption("personal");
  await expect(page.getByText("Saved to Ledgerly")).toBeVisible();
  await expect(c.getByText("$2,125.00", { exact: true }).first()).toBeVisible();
  expect((await setAside(page)).estimate_cents).toBe(212500);

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
});
