import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { unzipSync } from "fflate";
import { buildSelectedBundle } from "../src/lib/create/engine.ts";
import { createKnowledgeZip, fetchKnowledgeBlob } from "../src/lib/create/zip-client.ts";
import { isOriginalFilename, knowledgePathBasename, uniqueZipNames, zipLimits } from "../src/lib/create/zip-policy.ts";

const origin = "https://fixture.invalid";
const fixtures = new Map([
  ["/downloads/common.txt", Buffer.from("합성 텍스트\r\n", "utf8")],
  ["/downloads/context.csv", Buffer.from([0x61, 0x2c, 0x62, 0x0a, 0x31, 0x2c, 0x32])],
  ["/downloads/excluded.pdf", Buffer.from([0x00, 0xff, 0x7f, 0x80, 0x01])],
]);
const originalNames = ["가상 교육 자료 (초등).txt", "가상.자료 (2).csv", "excluded.pdf"];
const resources = [...fixtures].map(([path, data], index) => ({
  id: `file-${index}`, path, originalFilename: originalNames[index],
  category: index === 0 ? "common" : "optional", fileSize: data.length,
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
      return new Response(fixtures.get(url.pathname.slice("/edubot-studio".length)));
    }), createKnowledgeZip);
  assert.equal(result.kind, "ready");
  assert.equal(result.zip.type, "application/zip");
  const extracted = unzipSync(new Uint8Array(await result.zip.arrayBuffer()));
  assert.deepEqual(Object.keys(extracted), originalNames.slice(0, 2));
  for (const file of resources.slice(0, 2)) {
    const data = extracted[file.originalFilename];
    assert.deepEqual(Buffer.from(data), fixtures.get(file.path));
    assert.equal(createHash("sha256").update(data).digest("hex"), file.sha256);
  }
  assert.deepEqual(requests, ["/edubot-studio/downloads/common.txt", "/edubot-studio/downloads/context.csv"]);
});

test("original names allow ordinary Unicode and ASCII characters but reject Windows and traversal hazards", () => {
  for (const name of [
    "한글 및 공백 (2).PDF", "가상.자료.xlsx", "★ Thema café.txt", "data-2.txt",
    "a".repeat(251) + ".txt", "가".repeat(83) + ".txt",
  ]) assert.equal(isOriginalFilename(name), true, name);
  for (const name of [
    "", ".", "..", ".pdf", "자료", " 자료.pdf", "자료.pdf ", "자료.pdf.",
    "../자료.pdf", "a/자료.pdf", "a\\자료.pdf", "C:자료.pdf", "a<.pdf", "a>.pdf", 'a".pdf',
    "a|.pdf", "a?.pdf", "a*.pdf", "자료\t.pdf", "자료\0.pdf", "자료\u007f.pdf", "자료\n.pdf",
    "자료\u202E.pdf", "자료\u2066.pdf", "자료\u00a0.pdf", "자료\uD800.pdf",
    "CON.txt", "nul .pdf", "Lpt2.자료.pdf", "COM¹.txt", "CONOUT$.pdf",
    "a".repeat(252) + ".txt", "가".repeat(84) + ".txt",
  ]) assert.equal(isOriginalFilename(name), false, JSON.stringify(name));
  assert.equal(uniqueZipNames(["자료 (A).PDF", "자료 (a).pdf"]), false);
  assert.equal(uniqueZipNames(["가상.pdf", "가상.pdf".normalize("NFD")]), false);
  assert.equal(uniqueZipNames(["café.txt", "café.txt".normalize("NFD")]), false);
  for (const path of [
    "/downloads/자료.pdf", "/downloads/file name.pdf", "/downloads/COM1/file.txt",
    "/downloads/../file.txt", "/downloads/%2E%2E/file.txt", "/downloads/a\\file.txt",
    "/downloads/file.txt?alias=X", "/downloads/file.txt\n",
  ]) assert.equal(knowledgePathBasename(path), undefined);
  assert.equal(knowledgePathBasename("/downloads/group/qa-01.pdf"), "qa-01.pdf");
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
    [first, { ...first, id: "other", path: "/downloads/sub/COMMON.txt", originalFilename: first.originalFilename.normalize("NFD") }],
    [{ ...first, path: "/downloads/../private.txt" }],
    [{ ...first, path: "/downloads/%2e%2e/private.txt" }],
    [{ ...first, path: "https://fixture.invalid/downloads/common.txt" }],
    [{ ...first, originalFilename: "도망.xlsx" }],
    [{ ...first, originalFilename: "../파일.txt" }],
  ]) {
    assert.deepEqual(await buildSelectedBundle(invalid, {}, {}, noLoad, createKnowledgeZip), { kind: "failed", alternatives: invalid });
  }
  for (const names of [[], ["../file.txt"], ["file.txt", "FILE.txt"], ["가.txt", "가.txt"], ["LPT1.xlsx"]]) {
    await assert.rejects(createKnowledgeZip(names.map((name) => ({ name, data: new Blob(["test"]) }))), /Invalid ZIP selection/);
  }
});

test("ZIP admits exactly 20 files and 24 MiB and rejects excess before fetching", async () => {
  const block = 1024 * 1024;
  const files = Array.from({ length: zipLimits.files }, (_, index) => ({
    ...resources[0], id: `bound-${index}`, path: `/downloads/bound-${index}.pdf`,
    originalFilename: `가상 한도 (${index}).pdf`, fileSize: index === 0 ? 5 * block : block,
  }));
  let loaded = 0;
  const result = await buildSelectedBundle(files, {}, {}, async (_, { fileSize }) => {
    loaded++;
    return new Blob([new Uint8Array(fileSize)]);
  }, createKnowledgeZip);
  assert.equal(result.kind, "ready");
  assert.equal(loaded, 20);
  const extracted = unzipSync(new Uint8Array(await result.zip.arrayBuffer()));
  assert.deepEqual(Object.keys(extracted), files.map(({ originalFilename }) => originalFilename));
  assert.equal(Object.values(extracted).reduce((sum, data) => sum + data.length, 0), zipLimits.bytes);
  const over = [{ ...files[0], fileSize: files[0].fileSize + 1 }, ...files.slice(1)];
  const noLoad = () => assert.fail("Should not fetch");
  assert.deepEqual(await buildSelectedBundle(over, {}, {}, noLoad, createKnowledgeZip), { kind: "limit", alternatives: over });
  await assert.rejects(fetchKnowledgeBlob({ ...files[0], fileSize: zipLimits.bytes + 1 }, origin, noLoad),
    /Invalid approved file metadata/);
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
