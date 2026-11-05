import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

async function outputDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "rinsesoft-llms-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function generate(directory: string, build: boolean, siteUrl = "") {
  return spawnSync(process.execPath, [fileURLToPath(new URL("./llms-txt.ts", import.meta.url))], {
    encoding: "utf8",
    env: {
      ...process.env,
      BASCIK_OUT_DIR: directory,
      BASCIK_BUILD: build ? "1" : "0",
      BASCIK_SITE_URL: siteUrl,
    },
  });
}

const page = `<!doctype html><html lang="en"><head>
  <title>Example page</title>
  <meta name="description" content="Example description.">
  <link rel="canonical" href="https://example.com/">
</head><body></body></html>`;

test("development without a site URL explicitly skips llms.txt", async (t) => {
  const directory = await outputDirectory(t);
  await writeFile(join(directory, "index.html"),
    page.replace('<link rel="canonical" href="https://example.com/">', ""));
  const result = generate(directory, false);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skipping llms\.txt.*BASCIK_SITE_URL/);
  assert.deepEqual(await readdir(directory), ["index.html"]);
});

test("production without a site URL fails with an actionable error", async (t) => {
  const directory = await outputDirectory(t);
  const result = generate(directory, true);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BASCIK_SITE_URL is required/);
});

for (const build of [false, true]) {
  test(`configured ${build ? "production" : "development"} generates only indexable pages`, async (t) => {
    const directory = await outputDirectory(t);
    await writeFile(join(directory, "index.html"), page);
    await writeFile(join(directory, "success.html"),
      page.replace("<title>", '<meta name="robots" content="noindex, follow"><title>'));
    const result = generate(directory, build, "https://example.com");
    assert.equal(result.status, 0, result.stderr);
    const text = await readFile(join(directory, "llms.txt"), "utf8");
    assert.match(text, /# Rinsesoft/);
    assert.equal(text.match(/^- \[Example page\]/gm)?.length, 1);
    assert.match(text, /\[Example page\]\(https:\/\/example\.com\/\): Example description\./);
    assert.match(text, /## Company profiles/);
  });
}

test("configured generation still fails when a canonical URL is missing", async (t) => {
  const directory = await outputDirectory(t);
  await writeFile(join(directory, "index.html"),
    page.replace('<link rel="canonical" href="https://example.com/">', ""));
  const result = generate(directory, true, "https://example.com");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing title, canonical or description/);
});
