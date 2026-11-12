import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const verifiedAt = "2025-01-01";
export const core = "QA_ONLY_SYNTHETIC_CORE\r\n가상 테스트 문장.\n";
export const rights = { licenseStatus: "approved", verifiedAt };
const publicationStatus = "published";
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const still = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAIAAACwpMoFAAAA60lEQVR4nO3RAQkAIBDAwO+f0QSGEFOIMA4uwGCz9iFsvhfwlMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdwnMFxBscZHGdw3AXtPJoWmFGhbwAAAABJRU5ErkJggg==",
  "base64",
);
const phases = ["intro", "instruction", "files"];
const orders = [[0, 1, 2], [1, 2, 0], [2, 1, 0], [0, 2, 1], [1, 0, 2], [2, 0, 1]];

export function syntheticGuides() {
  return ["chatgpt", "claude", "gemini"].flatMap((platform, platformIndex) =>
    ["desktop-web", "mobile-web"].map((device, deviceIndex) => {
      const prefix = `${platform}-${device}`;
      const steps = orders[platformIndex * 2 + deviceIndex].map((index) => {
        const phase = phases[index];
        const actions = phase === "intro"
          ? [{ kind: "external-link", label: "가상 외부 링크", url: "https://example.invalid/qa-fixture", verifiedAt }]
          : [{ kind: phase === "instruction" ? "instruction" : "knowledge" }];
        return {
          id: phase,
          title: `합성 ${prefix} ${phase}`,
          description: `가상 ${phase} 단계 설명`,
          media: {
            kind: "gif",
            path: "/tutorials/qa-synthetic.gif",
            stillPath: "/tutorials/qa-still.png",
            fallbackText: "합성 시연의 텍스트 대안",
            ...rights,
          },
          actions,
          checkLabel: `외부 작업 ${phase} 직접 확인`,
          ...(deviceIndex && phase === "intro" ? { desktopAlternative: "합성 PC 대체 안내" } : {}),
        };
      });
      return {
        id: `test-${prefix}`, platform, device, version: "1.0.0", verifiedAt, publicationStatus,
        support: "supported", instructionId: "test-core", knowledgeIds: ["test-common", "test-context", "test-optional"],
        steps,
        checks: ["role", "knowledge", "personalization"].map((kind) => ({
          kind, prompt: `합성 ${kind} 점검 질문`, criteria: `합성 ${kind} 확인 기준`,
          stepId: kind === "knowledge" ? "files" : "instruction",
        })),
      };
    }));
}

export function writeFixture(root, relativePath, value) {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value));
}

export function writeCreateFixtures(root, guides = syntheticGuides(), extraAssets = {}) {
  writeFixture(root, "content/instructions/test-core.json", {
    id: "test-core", version: "1.0.0", coreInstruction: core,
    sha256: createHash("sha256").update(core).digest("hex"), publicationStatus, ...rights,
  });
  for (const [kind, title] of [["common", "공통 합성 자료"], ["context", "조건부 합성 자료"], ["optional", "자율 선택 합성 자료"]]) {
    const path = `/downloads/qa-${kind}.txt`;
    const buffer = Buffer.from(`SYNTHETIC DOWNLOAD ${kind}\n`);
    writeFixture(root, `public${path}`, buffer);
    writeFixture(root, `content/knowledge/test-${kind}.json`, {
      id: `test-${kind}`, title, path, description: "배포 콘텐츠와 무관한 합성 파일",
      category: kind === "common" ? "common" : "optional",
      recommendedFor: kind === "context" ? { schoolLevels: ["초등학교"], environments: ["특수학급"] } : undefined,
      platformNotes: { chatgpt: { text: "합성 플랫폼 참고", verifiedAt } },
      fileSize: buffer.length, fileVersion: "1.0.0", publicationStatus, ...rights,
    });
  }
  writeFixture(root, "public/tutorials/qa-synthetic.gif", gif);
  writeFixture(root, "public/tutorials/qa-still.png", still);
  for (const [path, data] of Object.entries(extraAssets)) writeFixture(root, `public${path}`, data);
  for (const guide of guides) writeFixture(root, `content/create/${guide.id}.json`, guide);
}
