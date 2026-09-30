import { test, expect } from "@playwright/test";

// Failure cases: SVG tied only to OS, dark PNG/ICO absent, lost transparency,
// stored theme ignored on load, system changes ignored, stale icon on toggles.
test("all favicon formats follow appearance, persist, and remain transparent", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const os of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: os });
      await page.goto("/");
      await expect(page.locator("#bake")).toBeEnabled();
      for (const theme of ["light", "dark", "system"]) {
        await page.getByRole("button", { name: "Appearance", exact: true }).click();
        await page.getByRole("menuitemradio", { name: theme[0].toUpperCase() + theme.slice(1), exact: true }).click();
        for (const reload of [false, true]) {
          if (reload) await page.reload();
          const resolved = theme === "system" ? os : theme;
          const suffix = resolved === "dark" ? "-dark" : "";
          const hrefs = [`/favicon${suffix}.ico?v=5`, `/favicon${suffix}.png?v=5`, `/icon-${resolved}.svg?v=5`];
          await expect.poll(() => page.locator('link[rel="icon"]').evaluateAll(nodes => nodes.map(n => n.getAttribute("href")))).toEqual(hrefs);
          for (const href of hrefs) {
            const response = await page.request.get(href);
            expect(response.status()).toBe(200);
            expect(response.headers()["content-type"]).toMatch(/image\//);
            const pixels = await page.evaluate(async (href) => {
              const image = new Image();
              image.src = href;
              await image.decode();
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 32;
              const context = canvas.getContext("2d");
              context.drawImage(image, 0, 0, 32, 32);
              const data = context.getImageData(0, 0, 32, 32).data;
              let total = 0, count = 0;
              for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 100) { total += data[i]; count++; }
              return { corner: data[3], color: total / count, count };
            }, href);
            expect(pixels.corner).toBe(0);
            expect(pixels.count).toBeGreaterThan(40);
            if (resolved === "dark") expect(pixels.color).toBeGreaterThan(230);
            else expect(pixels.color).toBeLessThan(45);
          }
        }
      }
      await page.emulateMedia({ colorScheme: os === "dark" ? "light" : "dark" });
      await expect(page.locator("#favicon")).toHaveAttribute("href", `/icon-${os === "dark" ? "light" : "dark"}.svg?v=5`);
    }
  }
});
