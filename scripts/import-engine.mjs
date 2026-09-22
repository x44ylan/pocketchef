import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "acorn";
import { simple } from "acorn-walk";

const revision = "49d1a5634a67a3b806c6db0fdca7dcecb41a776c";
const container = process.argv[2] || "cyberchef";
const actual = execFileSync(
  "docker",
  [
    "inspect",
    container,
    "--format",
    '{{index .Config.Labels "org.opencontainers.image.revision"}}',
  ],
  { encoding: "utf8" },
).trim();
if (actual !== revision)
  throw new Error(
    `Expected pinned CyberChef revision ${revision}; found ${actual}`,
  );
const dest = new URL("../public/engine/", import.meta.url);
await mkdir(dest, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "pocket-chef-"));
try {
  execFileSync("docker", [
    "cp",
    `${container}:/usr/share/nginx/html/assets/main.js`,
    join(temp, "main.js"),
  ]);
  const bundle = await readFile(join(temp, "main.js"), "utf8");
  const expectedHash =
    "d37d6c86c02a2154feb9e923d57f8e43d237dbf7a280244b14f30866bf01ae5b";
  if (createHash("sha256").update(bundle).digest("hex") !== expectedHash)
    throw new Error(
      "The compiled bundle does not match the pinned 11.4.0 artifact",
    );
  const candidates = [];
  simple(parse(bundle, { ecmaVersion: "latest" }), {
    Literal(node) {
      if (
        typeof node.value === "string" &&
        node.value.includes("workerLoaded") &&
        node.value.includes("self.chef=")
      )
        candidates.push(node.value);
    },
  });
  if (candidates.length !== 1)
    throw new Error("Expected exactly one compiled Chef worker");
  const worker = candidates[0];
  await writeFile(new URL("ChefWorker.js", dest), worker);
  execFileSync("docker", [
    "cp",
    `${container}:/usr/share/nginx/html/modules`,
    dest.pathname,
  ]);
  await mkdir(new URL("assets/", dest), { recursive: true });
  for (const asset of ["fonts", "forge", "tesseract"]) {
    execFileSync("docker", [
      "cp",
      `${container}:/usr/share/nginx/html/assets/${asset}`,
      new URL("assets/", dest).pathname,
    ]);
  }
  const categories = await fetch(
    `https://raw.githubusercontent.com/gchq/CyberChef/${revision}/src/core/config/Categories.json`,
  );
  if (!categories.ok)
    throw new Error("Could not fetch the pinned operation categories");
  await writeFile(
    new URL("../src/data/cyberchef-categories.json", import.meta.url),
    await categories.text(),
  );
  execFileSync("docker", [
    "cp",
    `${container}:/usr/share/nginx/html/ChefWorker.js.LICENSE.txt`,
    dest.pathname,
  ]);
  const license = await fetch(
    `https://raw.githubusercontent.com/gchq/CyberChef/${revision}/LICENSE`,
  );
  if (!license.ok) throw new Error("Could not fetch upstream license");
  await writeFile(new URL("LICENSE", dest), await license.text());
  await writeFile(
    new URL("provenance.json", dest),
    JSON.stringify(
      {
        version: "11.4.0",
        revision,
        source: "https://github.com/gchq/CyberChef",
        workerSha256: createHash("sha256").update(worker).digest("hex"),
        bundleSha256: createHash("sha256").update(bundle).digest("hex"),
      },
      null,
      2,
    ),
  );
  console.log(
    `Imported unmodified CyberChef 11.4.0 worker (${worker.length} bytes) and operation modules.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
