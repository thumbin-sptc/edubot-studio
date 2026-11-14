import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";

async function templates(folder) {
  try {
    return await Promise.all((await readdir(folder)).filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(folder, file), "utf8"))));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const [prompts, guides, instructions, knowledge] = await Promise.all(
  ["prompts", "create", "instructions", "knowledge"].map((folder) => templates(`content/${folder}`)),
);
const publishedPrompts = prompts.filter((prompt) => prompt.publicationStatus === "published");
const hiddenPrompts = prompts.filter((prompt) => prompt.publicationStatus !== "published");
const hiddenGuides = guides.filter((guide) => guide.publicationStatus !== "published" &&
  !guides.some((other) => other.publicationStatus === "published" && other.platform === guide.platform && other.device === guide.device));
const hiddenInstructions = instructions.filter((instruction) => instruction.publicationStatus !== "published");
const publishedGuides = guides.filter((guide) => guide.publicationStatus === "published" && guide.support === "supported");
const publishedText = JSON.stringify([...publishedPrompts, ...publishedGuides,
  ...instructions.filter((instruction) => instruction.publicationStatus === "published")]);
const markers = [
  ...hiddenPrompts.flatMap((prompt) => [prompt.title, prompt.sourceOriginalText, prompt.templateText]),
  ...hiddenInstructions.map((instruction) => instruction.coreInstruction),
  ...hiddenGuides.flatMap((guide) => (guide.steps ?? []).flatMap((step) => [step.title, step.description])),
].filter((value) => typeof value === "string" && value.length >= 8 &&
  !publishedText.includes(JSON.stringify(value).slice(1, -1)));

function assertNoContent(body, path) {
  for (const marker of markers) {
    assert.ok(!body.includes(marker) && !body.includes(JSON.stringify(marker).slice(1, -1)),
      `Unpublished content found in ${path}`);
  }
}

const origin = "http://127.0.0.1:4173";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "4173"],
  { stdio: ["ignore", "pipe", "pipe"] });
const exited = once(server, "exit");
let serverOutput = "";
server.stdout.on("data", (data) => { serverOutput += data; });
server.stderr.on("data", (data) => { serverOutput += data; });

async function request(path, headers) {
  const response = await fetch(origin + path, { headers, redirect: "follow", signal: AbortSignal.timeout(5_000) });
  // Next may redirect bare RSC requests to the same route with a cache-key query.
  const finalUrl = new URL(response.url);
  assert.equal(finalUrl.origin, origin, path);
  assert.equal(finalUrl.pathname, path, path);
  return response;
}

try {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null || attempt === 60) throw new Error("Next.js production server did not start");
    try {
      if ((await request("/")).ok) break;
    } catch {
      // The child process may still be starting.
    }
    await setTimeout(250);
  }
  for (const path of ["/", "/prompts", "/create", "/data", "/help",
    ...publishedPrompts.map(({ id }) => `/prompts/${id}`),
    ...publishedGuides.map(({ platform, device }) => `/create/${platform}/${device}`)]) {
    for (const headers of [{}, { RSC: "1" }]) {
      const response = await request(path, headers);
      assert.equal(response.status, 200, path);
      assertNoContent(await response.text(), path);
    }
  }
  const hiddenPaths = [
    ...hiddenPrompts.flatMap(({ id }) => [`/prompts/${id}`, `/content/prompts/${id}.json`]),
    ...hiddenGuides.map(({ platform, device }) => `/create/${platform}/${device}`),
    ...hiddenInstructions.map(({ id }) => `/content/instructions/${id}.json`),
    ...knowledge.filter((file) => file.publicationStatus !== "published" && file.path?.startsWith("/downloads/") &&
      !knowledge.some((other) => other.publicationStatus === "published" && other.path === file.path)).map(({ path }) => path),
    "/prompts/CI-MISSING-PROMPT",
    "/create/ci-missing-platform/desktop-web",
    "/tests/fixtures/synthetic-create.mjs",
  ];
  for (const path of hiddenPaths) {
    for (const headers of [{}, { RSC: "1" }]) {
      const response = await request(path, headers);
      assert.equal(response.status, 404, path);
      assertNoContent(await response.text(), path);
    }
  }
  for (const file of await readdir(".next/static", { recursive: true })) {
    if (file.endsWith(".js")) assertNoContent(await readFile(join(".next/static", file), "utf8"), file);
  }
  console.log("Production HTTP, RSC and client bundle publication checks passed.");
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  server.kill();
  await exited;
}
