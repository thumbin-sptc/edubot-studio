import { lstat, readdir, realpath, rename, rm, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { emptyExportSegment } from "../src/lib/site-path.ts";

// Next.js requires one static param per dynamic route. Remove the reserved
// not-found exports so a static host returns HTTP 404 for those paths too.
const output = resolve("out");
for (const section of ["prompts", "create"]) {
  const parent = resolve(output, section);
  const target = resolve(parent, emptyExportSegment);
  const info = await lstat(target).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (!info) continue;
  if (!info.isDirectory() || dirname(await realpath(target)) !== parent) {
    throw new Error(`Unexpected static export path: ${target}`);
  }
  await rm(target, { recursive: true });
}

// On Windows, Next.js uses native separators while writing prefetch files,
// but the browser always requests dot-delimited filenames.
async function flattenSegments(directory, filename) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    const destination = filename + "." + entry.name;
    if (entry.isDirectory()) {
      await flattenSegments(source, destination);
    } else if (entry.isFile() && entry.name.endsWith(".txt")) {
      await rename(source, destination);
    }
  }
  await rmdir(directory);
}

async function normalizeWindowsPrefetch(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || ["_next", "downloads", "tutorials"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.name.startsWith("__next.")) {
      await flattenSegments(path, path);
    } else {
      await normalizeWindowsPrefetch(path);
    }
  }
}

if (process.platform === "win32") await normalizeWindowsPrefetch(output);
