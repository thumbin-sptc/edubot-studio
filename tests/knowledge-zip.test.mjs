import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { unzipSync } from "fflate";
import { buildSelectedBundle } from "../src/lib/create/engine.ts";
import { createKnowledgeZip, fetchKnowledgeBlob } from "../src/lib/create/zip-client.ts";
import { zipLimits } from "../src/lib/create/zip-policy.ts";

const origin = "https://fixture.invalid";
const fixtures = new Map([
  ["/downloads/common.txt", Buffer.from("합성 텍스트\r\n", "utf8")],
  ["/downloads/context.csv", Buffer.from([0x61, 0x2c, 0x62, 0x0a, 0x31, 0x2c, 0x32])],
  ["/downloads/excluded.pdf", Buffer.from([0x00, 0xff, 0x7f, 0x80, 0x01])],
]);
const resources = [...fixtures].map(([path, data], index) => ({
  id: `file-${index}`, path, category: index === 0 ? "common" : "optional", fileSize: data.length,
  sha256: createHash("sha256").update(data).digest("hex"),
}));

test("the downloaded ZIP contains exactly the selected names and original bytes", async () => {
  const requests = [];
  const result = await buildSelectedBundle(resources, {}, { "file-1": true, "file-2": false }, (_, file) =>
    fetchKnowledgeBlob(file, origin, async (url, options) => {
      assert.equal(url.origin, origin);
      assert.equal(options.mode, "same-origin");
      assert.equal(options.redirect, "error");
      assert.equal(options.credentials, "omit");
      requests.push(url.pathname);
      return new Response(fixtures.get(url.pathname));
    }), createKnowledgeZip);
  assert.equal(result.kind, "ready");
  assert.equal(result.zip.type, "application/zip");
  const extracted = unzipSync(new Uint8Array(await result.zip.arrayBuffer()));
  assert.deepEqual(Object.keys(extracted).sort(), ["common.txt", "context.csv"]);
  assert.deepEqual(Buffer.from(extracted["common.txt"]), fixtures.get("/downloads/common.txt"));
  assert.deepEqual(Buffer.from(extracted["context.csv"]), fixtures.get("/downloads/context.csv"));
  assert.deepEqual(requests, ["/downloads/common.txt", "/downloads/context.csv"]);
});

test("empty, over-limit, duplicate and unsafe selections do not fetch files", async () => {
  const noLoad = async () => assert.fail("Should not fetch");
  const [first] = resources;
  const overrides = { [first.id]: false };
  assert.deepEqual(await buildSelectedBundle([first], {}, overrides, noLoad, createKnowledgeZip), { kind: "empty" });
  for (const invalid of [
    [{ ...first, fileSize: zipLimits.bytes + 1 }],
    Array.from({ length: zipLimits.files + 1 }, (_, index) => ({ ...first, id: `file-${index}`, path: `/downloads/${index}.txt` })),
  ]) {
    assert.deepEqual(await buildSelectedBundle(invalid, {}, {}, noLoad, createKnowledgeZip), { kind: "limit", alternatives: invalid });
  }
  for (const invalid of [
    [first, { ...first, id: "other", path: "/downloads/sub/COMMON.txt" }],
    [{ ...first, path: "/downloads/../private.txt" }],
    [{ ...first, path: "/downloads/%2e%2e/private.txt" }],
    [{ ...first, path: "https://fixture.invalid/downloads/common.txt" }],
  ]) {
    assert.deepEqual(await buildSelectedBundle(invalid, {}, {}, noLoad, createKnowledgeZip), { kind: "failed", alternatives: invalid });
  }
  for (const names of [[], ["../file.txt"], ["file.txt", "FILE.txt"]]) {
    await assert.rejects(createKnowledgeZip(names.map((name) => ({ name, data: new Blob(["test"]) }))), /Invalid ZIP selection/);
  }
});

test("HTTP, redirect and corrupt response failures leave approved individual alternatives", async () => {
  const [first] = resources;
  for (const response of [
    () => new Response("not found", { status: 404 }),
    () => new Response("error", { status: 500 }),
    () => new Response(null, { status: 302, headers: { location: "https://elsewhere.invalid" } }),
    () => new Response(Buffer.alloc(first.fileSize, 0x42)),
    () => new Response(Buffer.alloc(first.fileSize + 1)),
    () => new Response(Buffer.alloc(first.fileSize - 1)),
    () => { throw new Error("Network error"); },
  ]) {
    const result = await buildSelectedBundle([first], {}, {}, (_, file) =>
      fetchKnowledgeBlob(file, origin, async () => response()), createKnowledgeZip);
    assert.deepEqual(result, { kind: "failed", alternatives: [first] });
  }
});
