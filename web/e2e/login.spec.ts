import { expect, test } from "@playwright/test";
import { EMAIL, PASSWORD } from "./helpers";

// Anonymous: ignore the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

// TODO(frontend Stage 4): remove fixme once the login form (labels "Email", "Password",
// button "Sign in") ships. Until then the unauthenticated app shows no form.
test.fixme("login: wrong password shows an error, correct one shows the app (trap 25)", async ({
  page,
}) => {
  await page.goto("/?month=2026-10");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("region", { name: /Summary for/ })).toBeVisible();
});
