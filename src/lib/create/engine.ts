import {
  personalizationFields,
  type CompletionCheck, type CompletionKind, type Knowledge, type Personalization, type PublishedGuide,
} from "./model.ts";

export const completionLabels: Record<CompletionKind, string> = {
  role: "에듀봇 역할 확인",
  knowledge: "지식 자료 활용 확인",
  personalization: "개인화 적용 확인",
};

function personalLines(input: Personalization) {
  return (Object.keys(personalizationFields) as Array<keyof Personalization>).flatMap((field) => {
    const value = input[field]?.trim();
    return value ? [`${personalizationFields[field]}: ${value}`] : [];
  });
}

export function composeInstruction(coreInstruction: string, input: Personalization): string {
  const lines = personalLines(input);
  return lines.length ? `${coreInstruction}\n\n[개인화 설정]\n${lines.join("\n")}` : coreInstruction;
}

export function getCompletionChecks(checks: CompletionCheck[], input: Personalization) {
  return checks.filter(({ kind }) => kind !== "personalization" || personalLines(input).length > 0);
}

export function isRecommended(file: Knowledge, input: Personalization): boolean {
  const rules = file.recommendedFor;
  if (file.category === "common" || !rules || !(rules.schoolLevels?.length || rules.environments?.length)) return false;
  const school = !rules.schoolLevels?.length || rules.schoolLevels.includes(input.schoolLevel ?? "");
  const environment = !rules.environments?.length || rules.environments.includes(input.environment ?? "");
  return school && environment;
}

export function isSelected(file: Knowledge, input: Personalization, overrides: Record<string, boolean>) {
  return Object.hasOwn(overrides, file.id) ? overrides[file.id] : file.category === "common" || isRecommended(file, input);
}

export function guideRevision(guide: PublishedGuide) {
  const { platform, device, id, version, instruction } = guide;
  return `${platform}/${device}/${id}@${version}/${instruction.id}@${instruction.version}/${instruction.sha256}`;
}

export type ZipBuilder = (files: Array<{ name: string; data: Blob }>) => Promise<Blob>;

export async function buildSelectedBundle(
  resources: Knowledge[],
  input: Personalization,
  overrides: Record<string, boolean>,
  load: (path: string) => Promise<Blob>,
  zip: ZipBuilder,
) {
  const selected = resources.filter((file) => isSelected(file, input, overrides));
  if (!selected.length) return { kind: "empty" as const };
  try {
    const files = await Promise.all(selected.map(async ({ path }) => ({
      name: path.split("/").at(-1)!,
      data: await load(path),
    })));
    return { kind: "ready" as const, zip: await zip(files) };
  } catch {
    return { kind: "failed" as const, alternatives: selected };
  }
}
