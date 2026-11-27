import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/utils";
import { AccountMenu } from "./AccountMenu";

describe("AccountMenu", () => {
  it("opens with theme radios, applies a theme, and Escape closes and returns focus", async () => {
    renderWithProviders(<AccountMenu />);
    const button = screen.getByRole("button", { name: /Settings/ });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });
});
