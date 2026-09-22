import { test, expect } from "@playwright/test";

async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#bake")).toBeEnabled();
}
async function importRecipe(page, recipe) {
  await page.locator('[data-tab="recipe"]').click();
  await page.getByRole("button", { name: "Workspace menu" }).click();
  await page.locator("#import-recipe").click();
  await page.locator("#recipe-json").fill(JSON.stringify(recipe));
  await page.locator("#apply-import").click();
  await expect(page.locator("#import-dialog")).not.toBeVisible();
}

const cases = [
  {
    name: "Base64 decoding",
    input: "SGVsbG8sIHdvcmxkLg==",
    recipe: [{ op: "From Base64", args: ["A-Za-z0-9+/=", true, false] }],
  },
  {
    name: "Unicode encoding",
    input: "Hello, café ☕",
    recipe: [{ op: "To Base64", args: ["A-Za-z0-9+/="] }],
  },
  {
    name: "URL and hex chain",
    input: "hello%20world%21",
    recipe: [
      { op: "URL Decode", args: [true] },
      { op: "To Hex", args: ["Space", 0] },
    ],
  },
  {
    name: "SHA-256 module",
    input: "abc",
    recipe: [{ op: "SHA2", args: ["256", 64, 160] }],
  },
  {
    name: "Compression roundtrip",
    input: "Hello, world. ".repeat(100),
    recipe: [
      { op: "Gzip", args: ["Dynamic Huffman Coding", "", "", false] },
      { op: "Gunzip", args: [] },
    ],
  },
  {
    name: "JSON presentation",
    input: '{"b":2,"a":"<hello>"}',
    recipe: [{ op: "JSON Beautify", args: ["  ", true, true] }],
  },
  {
    name: "Disabled operation",
    input: "hello",
    recipe: [
      { op: "To Upper case", args: ["All"], disabled: true },
      { op: "To Base64", args: ["A-Za-z0-9+/="] },
    ],
  },
];
for (const fixture of cases) {
  test(`parity with running CyberChef: ${fixture.name}`, async ({
    page,
    context,
  }) => {
    test.skip(
      !process.env.CYBERCHEF_URL,
      "Set CYBERCHEF_URL to run against the desktop instance.",
    );
    await ready(page);
    const actual = await page.evaluate(async ({ input, recipe }) => {
      const { ChefEngine } = await import("/src/engine.js");
      const engine = new ChefEngine();
      try {
        const result = await engine.bake(input, recipe);
        return {
          bytes: Array.from(new Uint8Array(await engine.bytes(result.dish))),
          result: result.result,
        };
      } finally {
        engine.fail(new Error("Test complete"));
      }
    }, fixture);
    const desktop = await context.newPage();
    await desktop.goto(
      `${process.env.CYBERCHEF_URL}/#recipe=${encodeURIComponent(JSON.stringify(fixture.recipe))}`,
    );
    await desktop.waitForFunction(() => window.app?.appLoaded && !app.baking);
    // Enter input after startup; the desktop app can rewrite its initial URL.
    await desktop.locator("#input-text .cm-content").fill(fixture.input);
    await desktop.waitForFunction(
      (input) =>
        window.app?.appLoaded &&
        app.manager.input.inputEditorView.state.doc.toString() === input &&
        app.bakeStateId === app.stateChangeId &&
        !app.baking &&
        Object.values(app.manager.output.outputs).some(
          (o) => o.status === "baked" && o.data?.dish,
        ),
      fixture.input,
    );
    const expected = await desktop.evaluate(async () => {
      const out = Object.values(app.manager.output.outputs).find(
        (o) => o.status === "baked",
      );
      return Array.from(
        new Uint8Array(await app.manager.output.getDishBuffer(out.data.dish)),
      );
    });
    expect(actual.bytes).toEqual(expected);
    await desktop.close();
  });
}

test("phone flow, settings, stale output and no horizontal overflow", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Workspace menu" }).click();
  await page.locator("#example").click();
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("Hello, world.");
  await expect(page.locator("#panel-output")).toBeVisible();
  await page.locator('[data-tab="input"]').click();
  await page.locator("#input").fill("SGk=");
  await page.locator('[data-tab="output"]').click();
  await expect(page.locator("#output-state")).toHaveText("Out of date");
  await page.locator('[data-tab="recipe"]').click();
  await page.locator(".step summary").click();
  await expect(page.getByLabel("Alphabet", { exact: true })).toBeVisible();
  await page.locator("#add-operation").click();
  await page.getByRole("combobox", { name: "Search operations" }).fill("upper");
  await page.locator('[data-operation="To Upper case"]').click();
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("HI");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("import validates unsupported operations and preserves recipe; export roundtrip", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Workspace menu" }).click();
  await page.locator("#example").click();
  await page.locator('[data-tab="recipe"]').click();
  await page.getByRole("button", { name: "Workspace menu" }).click();
  await page.locator("#import-recipe").click();
  await page.locator("#recipe-json").fill('[{"op":"Nonexistent","args":[]}]');
  await page.locator("#apply-import").click();
  await expect(page.locator("#import-error")).toContainText("not available");
  await page.locator('[data-close="import-dialog"]').click();
  await expect(page.locator(".step h3")).toContainText("From Base64");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Workspace menu" }).click();
  await page.locator("#export-recipe").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const recipe = JSON.parse(Buffer.concat(chunks).toString());
  await page.locator("#clear-recipe").click();
  await importRecipe(page, recipe);
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("Hello, world.");
});

test("binary file remains byte-exact when downloaded", async ({ page }) => {
  await ready(page);
  const input = Buffer.from([0, 255, 128, 10, 13, 65, 0]);
  await page.locator("#file-input").setInputFiles({
    name: "bytes.bin",
    mimeType: "application/octet-stream",
    buffer: input,
  });
  await expect(page.locator("#input-kind")).toHaveText("FILE");
  await page.locator("#bake").click();
  await expect(page.locator("#output-state")).toHaveText("Baked");
  const promise = page.waitForEvent("download");
  await page.locator("#download-output").click();
  const download = await promise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  expect(Buffer.concat(chunks)).toEqual(input);
});

test("step reorder, disable and remove", async ({ page }) => {
  await ready(page);
  await page.locator("#input").fill("hello");
  await importRecipe(page, [
    { op: "To Upper case", args: ["All"] },
    { op: "To Base64", args: ["A-Za-z0-9+/="] },
  ]);
  await page.getByRole("button", { name: "Step 2 menu" }).click();
  await page.getByRole("menuitem", { name: "Move step 2 up" }).click();
  await expect(page.locator(".step h3").first()).toContainText("To Base64");
  await page
    .getByRole("switch", { name: "Enable To Upper case step 2" })
    .uncheck();
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("aGVsbG8=");
  await page.locator('[data-tab="recipe"]').click();
  await page.getByRole("button", { name: "Step 1 menu" }).click();
  await page.getByRole("menuitem", { name: "Remove To Base64 step 1" }).click();
  await expect(page.locator(".step")).toHaveCount(1);
});

test("engine cancellation settles the request and can bake again", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { ChefEngine } = await import("/src/engine.js");
    const engine = new ChefEngine();
    await engine.ready;
    const baking = engine
      .bake("x".repeat(1000000), [{ op: "SHA2", args: ["256", 64, 160] }])
      .then(
        () => "completed",
        (e) => e.name,
      );
    engine.cancel();
    const outcome = await baking;
    const next = await engine.bake("hello", [
      { op: "To Base64", args: ["A-Za-z0-9+/="] },
    ]);
    engine.fail(new Error("Test complete"));
    return { outcome, next: next.result };
  });
  expect(result).toEqual({ outcome: "AbortError", next: "aGVsbG8=" });
});

test("JSON output is readable text and markup never runs", async ({ page }) => {
  await ready(page);
  await page
    .locator("#input")
    .fill('{"message":"<img src=x onerror=alert(1)>"}');
  await importRecipe(page, [
    { op: "JSON Beautify", args: ["  ", false, true] },
  ]);
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  expect(await page.locator("#output img").count()).toBe(0);
});

test("light, dark and system modes persist and follow OS appearance", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await ready(page);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("#bake")).toBeEnabled();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "System", exact: true })
    .click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("dark mode picker and recipe remain usable on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "dark" });
  await ready(page);
  await page.getByRole("button", { name: "Workspace menu" }).click();
  await page.locator("#example").click();
  await page.locator('[data-tab="recipe"]').click();
  await page.locator("#add-operation").click();
  await page.getByRole("combobox", { name: "Search operations" }).fill("hex");
  await page.locator('[data-operation="To Hex"]').click();
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText(
    "48 65 6c 6c 6f 2c 20 77 6f 72 6c 64 2e",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
