import { lstat, realpath, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
