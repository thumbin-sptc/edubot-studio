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
        verification: { method: "hands-on", recordId: "QA-SYNTHETIC-VERIFICATION", stepIds: steps.map(({ id }) => id) },
        publicationApproval: { releaseApproved: true, recordId: "QA-SYNTHETIC-APPROVAL", approvedAt: verifiedAt },
        checks: ["role", "knowledge", "personalization"].map((kind) => ({
          kind, prompt: `합성 ${kind} 점검 질문`, criteria: `합성 ${kind} 확인 기준`,
          stepId: kind === "knowledge" ? "files" : "instruction",
        })),
      };
    }));
}

export function syntheticTextGuide(guide = syntheticGuides()[0]) {
  const instructions = {
    intro: ["합성 화면을 열고 테스트 계정을 선택합니다.", "합성 프로젝트 이름을 입력하고 목록에서 다시 엽니다."],
    instruction: ["합성 프로젝트에서 지침을 입력할 항목을 찾습니다.", "합성 지침을 붙여넣고 저장 결과를 확인합니다."],
    files: ["합성 공통 파일을 준비합니다.", "합성 프로젝트에 파일을 추가하고 자료 목록을 확인합니다."],
  };
  const steps = guide.steps.map((step) => {
    const converted = { ...step, format: "text-only", instructions: instructions[step.id] };
    delete converted.media;
    return converted;
  });
  return {
    ...guide, steps,
    verification: { method: "hands-on", recordId: "QA-SYNTHETIC-VERIFICATION", stepIds: steps.map(({ id }) => id) },
    publicationApproval: { releaseApproved: true, recordId: "QA-SYNTHETIC-APPROVAL", approvedAt: verifiedAt },
  };
}

export function syntheticIllustratedGuide(guide = syntheticTextGuide()) {
  const assets = {};
  function example(id) {
    const path = `/tutorials/qa32-${id}.png`;
    assets[path] = still;
    return {
      ...rights, path, sha256: createHash("sha256").update(still).digest("hex"), captureId: `QA32-${id}`,
      source: "hands-on", privacyChecked: true, alt: `브라우저 검수용 합성 표본 ${id}`,
      focusText: "합성 표본에서 예시 화면 확대와 닫기를 시험합니다.",
    };
  }
  return {
    guide: {
      ...guide, steps: guide.steps.map((step) => ({ ...step, example: example(step.id) })),
      verification: { ...guide.verification, completionChecked: true },
      illustratedJourney: {
        audience: { schoolLevel: "초등학교", environment: "특수학급", sourceFamily: "GPTs" },
        help: { kind: "external-link", label: "합성 도움말", url: "https://example.invalid/qa32-help", verifiedAt },
        requiredIds: ["test-common"], recommendedIds: ["test-context"], completionExample: example("completion"),
      },
    }, assets,
  };
}

export function writeFixture(root, relativePath, value) {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value));
}

export function writeCreateFixtures(root, guides = syntheticGuides(), extraAssets = {}) {
  const externalAiUse = [...new Set(guides.map((guide) => guide.platform))];
  writeFixture(root, "content/instructions/test-core.json", {
    id: "test-core", version: "1.0.0", coreInstruction: core,
    sha256: createHash("sha256").update(core).digest("hex"), publicationStatus, ...rights,
    ...(externalAiUse.length && { externalAiUse }),
  });
  for (const [kind, title] of [["common", "공통 합성 자료"], ["context", "조건부 합성 자료"], ["optional", "자율 선택 합성 자료"]]) {
    const path = `/downloads/qa-${kind}.txt`;
    const buffer = Buffer.from(`SYNTHETIC DOWNLOAD ${kind}\n`);
    writeFixture(root, `public${path}`, buffer);
    writeFixture(root, `content/knowledge/test-${kind}.json`, {
      id: `test-${kind}`, title, path, description: "배포 콘텐츠와 무관한 합성 파일",
      ...(kind === "common" ? { originalFilename: "가상 공통 자료 (검수).txt" } : {}),
      category: kind === "common" ? "common" : "optional",
      recommendedFor: kind === "context" ? { schoolLevels: ["초등학교"], environments: ["특수학급"] } : undefined,
      platformNotes: { chatgpt: { text: "합성 플랫폼 참고", verifiedAt } },
      fileSize: buffer.length, fileVersion: "1.0.0", publicationStatus, ...rights,
      ...(externalAiUse.length && { externalAiUse }),
    });
  }
  const mediaPaths = new Set(guides.flatMap(({ steps }) => Array.isArray(steps)
    ? steps.flatMap(({ media }) => [media?.path, media?.stillPath])
    : []));
  if (mediaPaths.has("/tutorials/qa-synthetic.gif")) writeFixture(root, "public/tutorials/qa-synthetic.gif", gif);
  if (mediaPaths.has("/tutorials/qa-still.png")) writeFixture(root, "public/tutorials/qa-still.png", still);
  for (const [path, data] of Object.entries(extraAssets)) writeFixture(root, `public${path}`, data);
  for (const guide of guides) writeFixture(root, `content/create/${guide.id}.json`, guide);
}
