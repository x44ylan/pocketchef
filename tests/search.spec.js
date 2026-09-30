import { test, expect } from "@playwright/test";

// Failure cases: nested borders/padding, clipped focus, narrow-screen overflow,
// unreadable themes, lost keyboard selection, missing empty state, failed bake.
test("inline search stays compact and adds working operations across layouts and themes", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.POCKETCHEF_URL || "/");
  await expect(page.locator("#bake")).toBeEnabled();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    if (width <= 900) await page.locator('[data-tab="recipe"]').click();
    for (const theme of ["Dark", "Light"]) {
      await page.getByRole("button", { name: "Appearance", exact: true }).click();
      await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
      const search = page.getByRole("combobox", { name: "Search operations" });
      await expect(search).toHaveAttribute("placeholder", "Search operations…");
      await search.focus();
      const geometry = await page.locator("#operation-search").evaluate(root => {
        const group = root.querySelector('[data-slot="input-group"]');
        const wrapper = root.querySelector('[data-slot="command-input-wrapper"]');
        return {
          outerBorder: getComputedStyle(root).borderTopWidth,
          padding: getComputedStyle(wrapper).paddingTop,
          fieldHeight: group.getBoundingClientRect().height,
          focus: getComputedStyle(group).boxShadow,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry.outerBorder).toBe("0px");
      expect(geometry.padding).toBe("0px");
      expect(geometry.fieldHeight).toBe(44);
      expect(geometry.focus).not.toBe("none");
      expect(geometry.overflow).toBe(false);
      await search.fill("nothing-matches-this-operation");
      await expect(page.getByText("No operations found.")).toBeVisible();
      await search.fill("base64 from");
      await expect(page.locator('[data-operation="From Base64"]')).toBeVisible();
      await page.locator("#operation-search").screenshot({ path: test.info().outputPath(`search-${width}-${theme.toLowerCase()}.png`) });
      await search.press("ArrowDown");
      await search.press("Enter");
      await expect(page.locator(".step h3")).toContainText("From Base64");
      await expect(search).toHaveValue("");
      await expect(page.locator(".operation-list")).toHaveCount(0);
      await page.locator("#clear-recipe").click();
    }
  }
  await page.locator("#input").fill("SGVsbG8sIHdvcmxkLg==");
  await page.getByRole("combobox", { name: "Search operations" }).fill("From Base64");
  await page.locator('[data-operation="From Base64"]').click();
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("Hello, world.");
  expect(errors).toEqual([]);
});
