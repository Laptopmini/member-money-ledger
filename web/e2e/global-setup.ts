import { loginAndSaveState, resetState, waitForApp } from "./helpers";

// Build first (the prod images bake the code): `make e2e` runs
// `docker compose --profile prod up -d --build api_prod web_prod` before playwright.
export default async function globalSetup(): Promise<void> {
  await waitForApp();
  await resetState(); // trap 11: restart the vendor, clear the mirror, sync the 5 seed rows
  await waitForApp();
  await loginAndSaveState();
}
