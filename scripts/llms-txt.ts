import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import { site } from "../src/lib/site.ts";

const outDir = process.env.BASCIK_OUT_DIR;
if (!outDir) throw new Error("BASCIK_OUT_DIR is required to generate llms.txt.");

const lines = [`# ${site.name}`, "", "## Pages", ""];

async function addPages(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await addPages(path);
      continue;
    }
    if (!entry.name.endsWith(".html") || /^(404|500)\.html$/.test(entry.name)) continue;

    const document = parse(await readFile(path, "utf8"));
    const elements: DefaultTreeAdapterMap["element"][] = [];
    const visit = (node: DefaultTreeAdapterMap["node"]): void => {
      if ("tagName" in node) elements.push(node);
      if ("childNodes" in node) node.childNodes.forEach(visit);
    };
    visit(document);
    const attribute = (element: DefaultTreeAdapterMap["element"], name: string) =>
      element.attrs.find((attr) => attr.name === name)?.value;
    const meta = (name: string) => elements.find(
      (element) => element.tagName === "meta" && attribute(element, "name") === name,
    );
    const robots = meta("robots");
    if (robots && attribute(robots, "content")?.split(/[,\s]+/).includes("noindex")) continue;
    const title = elements.find((element) => element.tagName === "title");
    const titleText = title?.childNodes.map((node) => "value" in node ? node.value : "").join("");
    const canonical = elements.find(
      (element) => element.tagName === "link" && attribute(element, "rel") === "canonical",
    );
    const url = canonical && attribute(canonical, "href");
    const description = meta("description");
    if (!titleText || !url || !description) {
      throw new Error(`Missing title, canonical or description in ${path}.`);
    }
    lines.push(`- [${titleText}](${url}): ${attribute(description, "content") ?? ""}`);
  }
}

if (!process.env.BASCIK_SITE_URL) {
  if (process.env.BASCIK_BUILD === "1") {
    throw new Error("BASCIK_SITE_URL is required to generate llms.txt for production.");
  }
  console.log("[llms-txt] Skipping llms.txt: set BASCIK_SITE_URL to generate canonical page links.");
} else {
  await addPages(outDir);
  lines.push("", "## Company profiles", "", ...site.profiles.map(
    (profile) => `- [${profile.label}](${profile.url})`,
  ), "");
  await writeFile(join(outDir, "llms.txt"), lines.join("\n"));
  console.log("[llms-txt] Generated llms.txt from indexable pages.");
}
