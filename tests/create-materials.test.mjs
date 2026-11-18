import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectCreateContent } from "../src/lib/create/content.ts";
import { firstMaterialsAudience, sameMaterialsAudience } from "../src/lib/create/model.ts";
import { writeFixture } from "./fixtures/synthetic-create.mjs";

const core = "QA-INDEPENDENT-SYNTHETIC\r\n  앞뒤 공백 테스트 \r\n";
const bytes = Buffer.from("QA 합성 파일\r\n");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const rights = { publicationStatus: "published", licenseStatus: "approved", verifiedAt: "2025-01-01", externalAiUse: ["chatgpt"] };
const instruction = { id: "qa-material-core", version: "1.0.0", coreInstruction: core, sha256: sha(core), ...rights };
const knowledge = { id: "qa-material-file", title: "가상 자료", description: "합성 파일 검수 전용", path: "/downloads/qa-material.txt",
  originalFilename: "가상 자료 (검수).txt", fileSize: bytes.length, sha256: sha(bytes), fileVersion: "1.0.0", category: "common", ...rights };
const { platform, device, ...audience } = firstMaterialsAudience;
const binding = { id: "qa-materials", platform, device, audience, publicationStatus: "published" };
const link = (item) => ({ id: item.id, version: item.fileVersion ?? item.version,
  sha256: item.sha256, rightsRecordId: "QA-SYNTHETIC-RECORD" });
const writeBinding = (root, value) => writeFixture(root, "content/create-materials/" + value.id + ".json", value);

function createRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "edubot-materials-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("a verified instruction is exposed verbatim without a guide, knowledge file or media", (t) => {
  const root = createRoot(t);
  writeFixture(root, "content/instructions/qa-material-core.json", instruction);
  writeBinding(root, { ...binding, instruction: link(instruction) });
  const { materials, entries, errors } = inspectCreateContent(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(entries, []);
  assert.equal(materials.length, 1);
  assert.equal(materials[0].instruction.coreInstruction, core);
  assert.equal(sha(materials[0].instruction.coreInstruction), instruction.sha256);
  assert.deepEqual(materials[0].files, []);
  assert.ok(sameMaterialsAudience(materials[0], firstMaterialsAudience));
  for (const patch of [{ sourceFamily: "GEMS" }, { schoolLevel: "중학교" }, { environment: "특수학교" }, { device: "mobile-web" }]) {
    assert.ok(!sameMaterialsAudience(materials[0], { ...firstMaterialsAudience, ...patch }));
  }
  assert.ok(!JSON.stringify(materials).includes("QA-SYNTHETIC-RECORD"));
});

test("independent instruction and file references require an approval record, the exact hash and rights for this AI", (t) => {
  for (const [item, refType, folder] of [[instruction, "instruction", "instructions"], [knowledge, "knowledge", "knowledge"]]) {
    for (const [patch, reference] of [
      [{ publicationStatus: "reviewed" }, link(item)], [{ licenseStatus: "pending" }, link(item)],
      [{ externalAiUse: ["claude"] }, link(item)], [{}, { ...link(item), sha256: "0".repeat(64) }],
      [{}, { ...link(item), version: "1.0.1" }],
      [{}, { ...link(item), rightsRecordId: undefined }],
    ]) {
      const root = createRoot(t);
      writeFixture(root, `content/${folder}/${item.id}.json`, { ...item, ...patch });
      if (refType === "knowledge") writeFixture(root, "public" + knowledge.path, bytes);
      writeBinding(root, { ...binding, [refType]: refType === "knowledge" ? [reference] : reference });
      const { materials, entries, errors } = inspectCreateContent(root);
      assert.deepEqual(materials, []);
      assert.deepEqual(entries, []);
      assert.ok(errors.length);
    }
  }
});

test("only independently approved files enter the export and unbound text is a leak marker", (t) => {
  const root = createRoot(t);
  writeFixture(root, "content/knowledge/qa-material-file.json", knowledge);
  writeFixture(root, "public" + knowledge.path, bytes);
  assert.match(inspectCreateContent(root).errors.join("\n"), /Unapproved public asset/);
  writeBinding(root, { ...binding, knowledge: [link(knowledge)] });
  const privateCore = "QA_UNBOUND_INSTRUCTION_MARKER_33";
  writeFixture(root, "content/instructions/qa-material-core.json",
    { ...instruction, coreInstruction: privateCore, sha256: sha(privateCore) });
  const { entries, materials, errors } = inspectCreateContent(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(entries, []);
  assert.equal(materials[0].files[0].originalFilename, knowledge.originalFilename);
  assert.equal(materials[0].instruction, undefined);

  writeFixture(root, "out" + knowledge.path, bytes);
  writeFixture(root, "out/404.html", Buffer.from("404"));
  for (const route of ["", "create/", "prompts/", "data/", "help/"]) {
    for (const part of ["index.html", "index.txt", "__next._full.txt", "__next._tree.txt"]) {
      writeFixture(root, "out/" + route + part, Buffer.from("synthetic route"));
    }
  }
  const verify = () => spawnSync(process.execPath, [
    fileURLToPath(new URL("../scripts/check-public-build.mjs", import.meta.url)),
  ], { cwd: root, encoding: "utf8" });
  assert.equal(verify().status, 0);
  writeFixture(root, "out/create/__next._full.txt", Buffer.from(privateCore));
  const failure = verify();
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /Unpublished content found/);
});
