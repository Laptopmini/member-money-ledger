import { expect, test } from "@playwright/test";
import { EMAIL, PASSWORD } from "./helpers";

// Anonymous: ignore the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test("login: wrong password shows an error, correct one shows the app (trap 25)", async ({
  page,
}) => {
  await page.goto("/?month=2026-10");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /don.t match/ })).toBeVisible();

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("region", { name: /Summary for/ })).toBeVisible();
});
