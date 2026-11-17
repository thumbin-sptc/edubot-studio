import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { inspectCreateContent } from "../src/lib/create/content.ts";
import { guideAssetPaths } from "../src/lib/create/model.ts";
import { siteBasePath } from "../src/lib/site-path.ts";

async function templates(folder) {
  try {
    return await Promise.all((await readdir(folder)).filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(folder, file), "utf8"))));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function listExport(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = prefix + entry.name;
    if (entry.isDirectory()) return listExport(join(directory, entry.name), path + "/");
    assert.ok(entry.isFile(), `Unexpected export entry: ${path}`);
    return [path];
  }))).flat();
}

const [prompts, guides, instructions] = await Promise.all(
  ["prompts", "create", "instructions"].map((folder) => templates(`content/${folder}`)),
);
const { entries, errors } = inspectCreateContent(process.cwd());
assert.deepEqual(errors, [], "Validate approved asset inventory before publishing");
const publishedPrompts = prompts.filter((prompt) => prompt.publicationStatus === "published");
const publishedGuides = entries.filter((guide) => guide.support === "supported");
const publishedText = JSON.stringify([...publishedPrompts, ...publishedGuides,
  ...instructions.filter((instruction) => instruction.publicationStatus === "published")]);
const markers = [
  ...prompts.filter((prompt) => prompt.publicationStatus !== "published")
    .flatMap((prompt) => [prompt.title, prompt.sourceOriginalText, prompt.templateText]),
  ...instructions.filter((instruction) => instruction.publicationStatus !== "published")
    .map((instruction) => instruction.coreInstruction),
  ...guides.filter((guide) => guide.publicationStatus !== "published")
    .flatMap((guide) => [
      ...(Array.isArray(guide.steps) ? guide.steps.flatMap((step) => [
        step?.title, step?.description, step?.checkLabel,
        ...(Array.isArray(step?.instructions) ? step.instructions : []),
      ]) : []),
      ...(Array.isArray(guide.checks) ? guide.checks.flatMap((check) => [check?.prompt, check?.criteria]) : []),
    ]),
].filter((value) => typeof value === "string" && value.length >= 8 &&
  !publishedText.includes(JSON.stringify(value).slice(1, -1)));

const pages = ["", "prompts/", "create/", "data/", "help/",
  ...publishedPrompts.map(({ id }) => `prompts/${id}/`),
  ...publishedGuides.map(({ platform, device }) => `create/${platform}/${device}/`)];
const frameworkPages = ["404/", "_not-found/"];
const assets = new Set(publishedGuides.flatMap(guideAssetPaths).map((path) => path.slice(1)));
const files = new Set(await listExport("out"));
assert.ok(files.has("404.html"), "GitHub Pages requires a root 404.html for missing URLs");
for (const page of pages) {
  for (const file of ["index.html", "index.txt", "__next._full.txt", "__next._tree.txt"]) {
    assert.ok(files.has(page + file), `Missing exported page or route payload: ${page}${file}`);
  }
}
for (const asset of assets) {
  assert.ok(files.has(asset), `Missing approved asset: ${asset}`);
  assert.ok((await readFile(join("out", asset))).equals(await readFile(join("public", asset))),
    `Exported asset differs from approved file: ${asset}`);
}

const routePayload = /^__next\.[^/]+\.txt$/;
const staticAsset = /^_next\/static\/.+\.(?:js|css|woff2)$/;
const brandAsset = /^_next\/static\/media\/(?:(symbol)\.[\w-]+\.png|wordmark\.[\w-]+\.svg)$/;
const pagePrefixes = [...pages, ...frameworkPages].sort((a, b) => b.length - a.length);
for (const file of files) {
  const brand = brandAsset.exec(file);
  if (brand) {
    const source = new URL(`../src/assets/brand/${brand[1] ? "symbol.png" : "wordmark.svg"}`, import.meta.url);
    assert.ok((await readFile(join("out", file))).equals(await readFile(source)),
      `Exported brand asset differs from approved file: ${file}`);
    continue;
  }
  const prefix = pagePrefixes.find((page) => file.startsWith(page));
  const filename = file.slice(prefix.length);
  const allowedRouteFile = ["index.html", "index.txt"].includes(filename) || routePayload.test(filename);
  assert.ok(allowedRouteFile || file === "404.html" || staticAsset.test(file) || assets.has(file),
    `Unexpected file in Pages export: ${file}`);

  const extension = extname(file);
  if (![".html", ".txt", ".js", ".css"].includes(extension)) continue;
  const body = await readFile(join("out", file), "utf8");
  for (const marker of markers) {
    assert.ok(!body.includes(marker) && !body.includes(JSON.stringify(marker).slice(1, -1)),
      `Unpublished content found in ${file}`);
  }
  if (extension !== ".html") continue;
  for (const [, url] of body.matchAll(/\b(?:href|src|poster)="(\/[^"/][^"]*)"/g)) {
    assert.ok(url.startsWith(siteBasePath + "/"), `Unprefixed URL in ${file}: ${url}`);
    const path = decodeURIComponent(url.slice(siteBasePath.length + 1).split(/[?#]/)[0]);
    assert.ok(files.has(path.endsWith("/") || !path ? path + "index.html" : path),
      `Missing local URL in ${file}: ${url}`);
  }
}
console.log(`Pages export publication checks passed (${publishedPrompts.length} public prompts, ${publishedGuides.length} public guides).`);
