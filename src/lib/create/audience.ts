import { buildSelectedBundle, type ZipBuilder } from "./engine.ts";
import {
  type Device, type GuideAudience, type Instruction, type Knowledge, type Platform,
  type PublishedGuide,
} from "./model.ts";
export { sourceFamilies } from "./model.ts";

export type Audience = Pick<GuideAudience, "schoolLevel" | "environment">;
export const targetSurfaces = {
  chatgpt: "ChatGPT Projects",
  gemini: "Gemini Gems",
  claude: "Claude Projects",
} satisfies Record<Platform, string>;
export type AudienceSelection = GuideAudience & {
  platform: Platform;
  device: Device;
};

type AssetIdentity = Pick<Knowledge, "id" | "sha256">;
type Match =
  | { status: "exact" | "verified-alias"; assets: readonly AssetIdentity[] }
  | { status: "missing" | "ambiguous" | "not-required" };
type Applicability = "required" | "recommended" | "optional" | "out-of-scope" | "scope-pending";
export type AudienceReference = { id: string; label: string; applicability: Applicability; match: Match };

export type AudienceCandidate = {
  sourceFamily: AudienceSelection["sourceFamily"];
  instruction: Omit<Instruction, "coreInstruction">;
  classification: "candidate" | "archive";
  coverage: readonly (Audience & { status: "verified" | "unverified" })[];
  targets: readonly (Pick<AudienceSelection, "platform" | "device"> & {
    compatibility: "verified" | "unverified" | "unsupported";
    handsOn: "verified" | "unverified";
    redistribution: "confirmed" | "unverified";
    review: "approved" | "pending";
    references: readonly AudienceReference[];
  })[];
};

type ReferenceStatus = "available" | "missing" | "ambiguous" | "scope-pending" | "unapproved" | "out-of-scope";
type ReferenceResult = { id: string; label: string; applicability: Applicability; status: ReferenceStatus };
export type AudienceReleaseCheck = "scope" | "compatibility" | "hands-on" | "rights" | "release" | "guide";
export type AudienceGuide = {
  selection: AudienceSelection;
  scope: string;
  guide: PublishedGuide;
  requiredIds: string[];
  recommendedIds: string[];
};
export type AudienceResult =
  | { kind: "unavailable" | "conflict" | "unsupported" }
  | {
    kind: "blocked";
    instruction: AudienceCandidate["instruction"];
    references: ReferenceResult[];
    pendingChecks: AudienceReleaseCheck[];
  }
  | {
    kind: "ready";
    instruction: AudienceCandidate["instruction"];
    references: ReferenceResult[];
    required: Knowledge[];
    recommended: Knowledge[];
    optional: Knowledge[];
    journey: AudienceGuide;
  };

function inspectReference(reference: AudienceReference, approved: ReadonlyMap<string, Knowledge>) {
  const { id, label, applicability, match } = reference;
  const result = (status: ReferenceStatus, files: Knowledge[] = []) => ({
    result: { id, label, applicability, status }, files,
  });
  if (applicability === "out-of-scope" || applicability === "scope-pending") return result(applicability);
  if (match.status === "missing" || match.status === "ambiguous") return result(match.status);
  if (!("assets" in match) || !match.assets.length) return result("ambiguous");
  const files = match.assets.map(({ id, sha256 }) => {
    const file = approved.get(id);
    return file?.sha256 === sha256 ? file : undefined;
  });
  return files.every((file) => file !== undefined) ? result("available", files) : result("unapproved");
}

// Only pass guides from the published-content loader (or explicitly synthetic fixtures).
export function resolveAudience(
  candidates: readonly AudienceCandidate[], selection: AudienceSelection, publishedGuide?: PublishedGuide,
): AudienceResult {
  const matches = candidates.flatMap((candidate) => {
    if (candidate.classification !== "candidate" || candidate.sourceFamily !== selection.sourceFamily) return [];
    return candidate.coverage.filter(({ schoolLevel, environment }) =>
      schoolLevel === selection.schoolLevel && environment === selection.environment,
    ).flatMap((scope) => candidate.targets.filter(({ platform, device }) =>
      platform === selection.platform && device === selection.device,
    ).map((target) => ({ candidate, scope, target })));
  });
  if (!matches.length) return { kind: "unavailable" };
  if (matches.length > 1) return { kind: "conflict" };

  const [{ candidate, scope, target }] = matches;
  if (scope.status === "verified" && target.compatibility === "unsupported" &&
      target.handsOn === "verified" && target.review === "approved") {
    return { kind: "unsupported" };
  }
  const { id, version, sha256 } = candidate.instruction;
  const instruction = { id, version, sha256 };
  const checkedGuide = publishedGuide?.platform === selection.platform && publishedGuide.device === selection.device &&
    publishedGuide.instruction.id === instruction.id && publishedGuide.instruction.version === instruction.version &&
    publishedGuide.instruction.sha256 === instruction.sha256;
  const approved = new Map(
    checkedGuide ? publishedGuide.resources.map((file) => [file.id, file] as const) : [],
  );
  const reviewed = target.references.map((reference) => inspectReference(reference, approved));
  const references = reviewed.map(({ result }) => result);
  const pendingChecks: AudienceReleaseCheck[] = [];
  if (scope.status !== "verified") pendingChecks.push("scope");
  if (target.compatibility !== "verified") pendingChecks.push("compatibility");
  if (target.handsOn !== "verified") pendingChecks.push("hands-on");
  if (target.redistribution !== "confirmed") pendingChecks.push("rights");
  if (target.review !== "approved") pendingChecks.push("release");
  if (!checkedGuide) pendingChecks.push("guide");
  if (!checkedGuide || pendingChecks.length ||
      references.some(({ status, applicability }) =>
        applicability === "scope-pending" || (applicability === "required" && status !== "available"))) {
    return { kind: "blocked", instruction, references, pendingChecks };
  }

  const required = new Map<string, Knowledge>();
  const recommended = new Map<string, Knowledge>();
  const optional = new Map<string, Knowledge>();
  for (const { result, files } of reviewed) {
    const destination = result.applicability === "required" ? required
      : result.applicability === "recommended" ? recommended : optional;
    for (const file of files) destination.set(file.id, file);
  }
  const mandatory = [...required.values()];
  const suggested = [...recommended.values()].filter(({ id }) => !required.has(id));
  const selectable = [...optional.values()].filter(({ id }) => !required.has(id) && !recommended.has(id));
  const journeyScope = [selection.schoolLevel, selection.environment, selection.sourceFamily].map(encodeURIComponent).join("-");
  return {
    kind: "ready", instruction, references, required: mandatory, recommended: suggested, optional: selectable,
    journey: {
      selection, scope: journeyScope,
      guide: { ...publishedGuide, resources: [...mandatory, ...suggested, ...selectable] },
      requiredIds: mandatory.map(({ id }) => id), recommendedIds: suggested.map(({ id }) => id),
    },
  };
}

// Only called after the content loader has verified a published illustrated journey.
export function illustratedAudienceOption(guide: PublishedGuide) {
  const journey = guide.illustratedJourney;
  if (!journey) return undefined;
  const { platform, device, instruction } = guide;
  const { schoolLevel, environment, sourceFamily } = journey.audience;
  const selection: AudienceSelection = { schoolLevel, environment, sourceFamily, platform, device };
  const candidate: AudienceCandidate = {
    sourceFamily,
    instruction: { id: instruction.id, version: instruction.version, sha256: instruction.sha256 },
    classification: "candidate",
    coverage: [{ schoolLevel, environment, status: "verified" }],
    targets: [{
      platform, device, compatibility: "verified", handsOn: "verified", redistribution: "confirmed", review: "approved",
      references: guide.resources.map(({ id, sha256, title }) => ({
        id, label: title,
        applicability: journey.requiredIds.includes(id) ? "required" : journey.recommendedIds.includes(id) ? "recommended" : "optional",
        match: { status: "exact", assets: [{ id, sha256 }] },
      })),
    }],
  };
  return { guide, selection, candidate };
}

export async function buildAudienceBundle(
  candidates: readonly AudienceCandidate[], selection: AudienceSelection, publishedGuide: PublishedGuide | undefined,
  selectedResourceIds: readonly string[],
  load: (path: string, file: Knowledge) => Promise<Blob>, zip: ZipBuilder,
) {
  const result = resolveAudience(candidates, selection, publishedGuide);
  if (result.kind !== "ready") return { kind: "blocked" as const };
  const choices = [...result.recommended, ...result.optional];
  if (selectedResourceIds.some((id) => !choices.some((file) => file.id === id))) return { kind: "blocked" as const };
  const resources = [...result.required, ...choices.filter(({ id }) => selectedResourceIds.includes(id))];
  return buildSelectedBundle(resources, {}, Object.fromEntries(resources.map(({ id }) => [id, true])), load, zip);
}
