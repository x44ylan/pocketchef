import { test, expect } from "@playwright/test";

async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#bake")).toBeEnabled();
}
async function defaults(page, names) {
  return page.evaluate(async (names) => {
    const { ChefEngine } = await import("/src/engine.js");
    const { defaultArgs } = await import("/src/recipes.js");
    const engine = new ChefEngine();
    const catalog = await engine.ready;
    const recipe = names.map((op) => ({ op, args: defaultArgs(catalog[op]) }));
    engine.fail(new Error("done"));
    return recipe;
  }, names);
}
async function importRecipe(page, recipe) {
  await page.getByRole("button", { name: "Workspace menu" }).click();
  await page.locator("#import-recipe").click();
  await page.locator("#recipe-json").fill(JSON.stringify(recipe));
  await page.locator("#apply-import").click();
  await expect(page.locator("#import-dialog")).not.toBeVisible();
}
async function add(page, name) {
  await page.locator('[data-tab="recipe"]').click();
  await page.getByRole("combobox", { name: "Search operations" }).fill(name);
  await page
    .locator("[data-operation]")
    .filter({ hasText: new RegExp(`^${name}$`) })
    .click();
  await page.locator(".step summary").last().click();
}

test("all 504 catalogue entries roundtrip, render, and are searchable inline", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const data = await page.evaluate(async () => {
    const { ChefEngine } = await import("/src/engine.js");
    const { defaultArgs, validateRecipe, operationGroups } =
      await import("/src/recipes.js");
    const engine = new ChefEngine();
    const catalog = await engine.ready;
    const recipes = Object.entries(catalog).map(([op, spec]) => ({
      op,
      args: defaultArgs(spec),
    }));
    for (const recipe of recipes)
      validateRecipe(JSON.parse(JSON.stringify([recipe])), catalog);
    const types = [
      ...new Set(
        Object.values(catalog).flatMap((spec) =>
          spec.args.map((arg) => arg.type),
        ),
      ),
    ];
    const groupNames = [
      ...new Set(operationGroups(catalog).flatMap((group) => group.ops)),
    ];
    engine.fail(new Error("done"));
    return { recipes, types, groupNames };
  });
  expect(data.recipes).toHaveLength(504);
  expect(data.types).toHaveLength(15);
  expect(data.groupNames).toHaveLength(504);
  await page.locator('[data-tab="recipe"]').click();
  await page.getByRole("combobox", { name: "Search operations" }).fill("render image");
  await expect(page.locator('[data-operation="Render Image"]')).toBeVisible();
  await page.getByRole("combobox", { name: "Search operations" }).fill("");
  await expect(page.locator("[data-operation]")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Search operations" })
    .fill("definitely-not-an-operation");
  await expect(page.getByText("No operations found.")).toBeVisible();
  await page.getByRole("combobox", { name: "Search operations" }).fill("");
  for (let i = 0; i < data.recipes.length; i += 50) {
    const chunk = data.recipes.slice(i, i + 50);
    await importRecipe(page, chunk);
    await expect(page.locator(".step")).toHaveCount(chunk.length);
    expect(await page.locator(".step h3").allTextContents()).toEqual(
      chunk.map((step, j) => `${String(j + 1).padStart(2, "0")}${step.op}`),
    );
  }
  expect(errors).toEqual([]);
});

test("AES key encodings and conditional arguments work with a known vector", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#input").fill("00112233445566778899aabbccddeeff");
  await add(page, "AES Encrypt");
  await page.locator("#arg-0-0").fill("000102030405060708090a0b0c0d0e0f");
  await expect(page.getByLabel("Key encoding")).toHaveValue("Hex");
  await page.getByLabel("Mode", { exact: true }).selectOption("GCM");
  await expect(page.locator("#arg-0-5")).toBeVisible();
  await page.getByLabel("Mode", { exact: true }).selectOption("ECB/NoPadding");
  await expect(page.locator("#arg-0-5")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Input", exact: true })
    .selectOption("Hex");
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText(
    "69c4e0d86a7b0430d8cdb78070b4c55a",
  );
});

test("regex presets populate the multiline editor and run", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#input").fill("Local sample: 192.0.2.1 and 198.51.100.2");
  await add(page, "Regular expression");
  await page.getByLabel("Built in regexes").selectOption("IPv4 address");
  await expect(page.getByLabel("Regex", { exact: true })).not.toHaveValue("");
  await page.getByLabel("Output format").selectOption("List matches");
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("192.0.2.1\n198.51.100.2");
});

test("multi-field presets, default indices and label arguments preserve upstream values", async ({
  page,
}) => {
  await ready(page);
  const recipe = await defaults(page, ["Enigma", "Colossus", "Multiple Bombe"]);
  expect(recipe[0].args[7]).toBe("AJDKSIRUXBLHWTMCQGZNPYFVOE<F");
  expect(recipe[0].args[10]).toBe("BDFHJLCPRTXVZNYEIWGAKMUSQO<W");
  await importRecipe(page, recipe.slice(2));
  await page.locator(".step summary").click();
  await page
    .getByLabel("Standard Enigmas")
    .selectOption("German Service Enigma (Third - 4 rotor)");
  await expect(page.getByLabel("Main rotors")).toHaveValue(
    /EKMFLGDQVZNTOWYHXUSPAIBRCJ/,
  );
  await expect(page.getByLabel("4th rotor")).toHaveValue(
    "FSOKANUERHMBTIYCWLQPZXVGJD",
  );
  await expect(page.getByLabel("Reflectors")).toHaveValue(
    "AE BN CK DQ FU GY HW IJ LO MP RX SZ TV",
  );
});

test("flow control runs and QR output renders without enabling scripts", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#input").fill("one\ntwo");
  await importRecipe(
    page,
    await defaults(page, ["Fork", "To Base64", "Merge"]),
  );
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("b25l\ndHdv");
  await importRecipe(page, await defaults(page, ["Generate QR Code"]));
  await page.locator("#bake").click();
  const frame = page.frameLocator('iframe[title="Output preview"]');
  await expect(frame.locator("img")).toBeVisible();
  await expect(page.locator('iframe[title="Output preview"]')).toHaveAttribute(
    "sandbox",
    "",
  );
  expect(
    await frame
      .locator("img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
});

test("archive files retain filenames and download their original bytes", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#input").fill("hello archive");
  const recipe = await defaults(page, ["Zip", "Unzip"]);
  recipe[0].args[0] = "hello.txt";
  await importRecipe(page, recipe);
  await page.locator("#bake").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "hello.txt", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("hello.txt");
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe("hello archive");
});

test("rich output strips active content and cannot request remote resources", async ({
  page,
}) => {
  await ready(page);
  const requests = [];
  page.on("request", (req) => {
    if (req.url().includes("example.invalid")) requests.push(req.url());
  });
  await page.evaluate(async () => {
    const { previewDocument } = await import("/src/output.js");
    const frame = document.createElement("iframe");
    frame.title = "Hostile output fixture";
    frame.setAttribute("sandbox", "");
    frame.srcdoc = previewDocument(
      '<script>parent.compromised=true</script><img src="https://example.invalid/image" onerror="parent.compromised=true"><iframe src="https://example.invalid/frame"></iframe><meta http-equiv="refresh" content="0;url=https://example.invalid"><p>Readable</p>',
      false,
    );
    document.body.append(frame);
  });
  const frame = page.frameLocator('iframe[title="Hostile output fixture"]');
  await expect(frame.getByText("Readable")).toBeVisible();
  await expect(frame.locator("script,iframe,img[src]")).toHaveCount(0);
  expect(await page.evaluate(() => window.compromised)).toBeUndefined();
  expect(requests).toEqual([]);
});

test("OCR auxiliary assets load and recognise a local image", async ({
  page,
}) => {
  test.setTimeout(60000);
  await ready(page);
  const output = await page.evaluate(async () => {
    const { ChefEngine } = await import("/src/engine.js");
    const { defaultArgs } = await import("/src/recipes.js");
    const engine = new ChefEngine();
    const catalog = await engine.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 600, 140);
    ctx.fillStyle = "black";
    ctx.font = "48px sans-serif";
    ctx.fillText("POCKET CHEF", 30, 90);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    try {
      const result = await engine.bake(await blob.arrayBuffer(), [
        {
          op: "Optical Character Recognition",
          args: defaultArgs(catalog["Optical Character Recognition"]),
        },
      ]);
      return result.result;
    } finally {
      engine.fail(new Error("done"));
    }
  });
  expect(output).toMatch(/POCKET\s*CHEF/i);
});

test("image fonts and PDF downloads use bundled assets and original bytes", async ({
  page,
}) => {
  await ready(page);
  const image = await page.evaluate(async () => {
    const { ChefEngine } = await import("/src/engine.js");
    const { defaultArgs } = await import("/src/recipes.js");
    const engine = new ChefEngine();
    const catalog = await engine.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    const args = defaultArgs(catalog["Add Text To Image"]);
    args[0] = "Hi";
    try {
      const result = await engine.bake(await blob.arrayBuffer(), [
        { op: "Add Text To Image", args },
      ]);
      return { type: result.type, result: result.result.slice(0, 35) };
    } finally {
      engine.fail(new Error("done"));
    }
  });
  expect(image.type).toBe("html");
  expect(image.result).toContain("data:image/png");
  const pdf = "%PDF-1.4\n%%EOF";
  await page.locator("#input").fill(btoa(pdf));
  await importRecipe(page, await defaults(page, ["Render PDF"]));
  await page.locator("#bake").click();
  await expect(page.locator("#output")).toHaveText("PDF ready to download.");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "output.pdf", exact: true }).click();
  const download = await pending;
  const chunks = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(pdf);
});
