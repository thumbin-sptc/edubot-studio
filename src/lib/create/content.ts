import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { isRecord, promptIdPattern, versionPattern } from "../prompt-template.ts";
import {
  environments, guideAssetPaths, isDevice, isPlatform, sameMaterialsAudience, schoolLevels, sourceFamilies,
  type CompletionCheck, type CreateAction, type CreateMedia, type CreateStep, type GuideAudience, type IllustratedJourney,
  type Instruction, type Knowledge, type Platform, type PublishedCreateEntry, type PublishedMaterials, type ScreenExample, type VerifiedNote,
} from "./model.ts";
import { isOriginalFilename, knowledgePathBasename, sameFilenameExtension, uniqueZipNames } from "./zip-policy.ts";

const imageExtensions = [".png", ".jpg", ".jpeg", ".webp"];
const downloadExtensions = [".pdf", ".txt", ".md", ".csv", ".docx", ".xlsx", ".pptx"];
const pathSegment = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

function record(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${name}`);
  return value;
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function id(value: unknown): string {
  const result = text(value, "id");
  if (!promptIdPattern.test(result)) throw new Error("Invalid id");
  return result;
}

function version(value: unknown): string {
  const result = text(value, "version");
  if (!versionPattern.test(result)) throw new Error("Invalid version");
  return result;
}

function verifiedAt(value: unknown, field = "verifiedAt"): string {
  const date = text(value, field);
  const timestamp = Date.parse(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== date || timestamp > Date.now()) {
    throw new Error(`Invalid verification date (${field})`);
  }
  return date;
}

function verifyRights(value: Record<string, unknown>): string {
  if (value.licenseStatus !== "approved") throw new Error("Missing rights approval");
  return verifiedAt(value.verifiedAt);
}

function unique(values: string[], name: string) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${name}`);
}

function externalAiUse(value: unknown): Platform[] | undefined {
  if (value === undefined) return undefined;
  const platforms = array(value, "approved AI use").map((platform) => {
    if (!isPlatform(platform)) throw new Error("Invalid approved AI platform");
    return platform;
  });
  unique(platforms, "approved AI platform");
  return platforms;
}

function list(path: string) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function publishedRecords(root: string, folder: string, errors: string[]) {
  const directory = join(root, "content", folder);
  return list(directory).flatMap((file) => {
    if (!file.name.endsWith(".json")) return [];
    try {
      if (!file.isFile()) throw new Error("Content entry must be a regular JSON file");
      const raw: unknown = JSON.parse(readFileSync(join(directory, file.name), "utf8"));
      if (!isRecord(raw) || (raw.publicationStatus !== "draft" && raw.publicationStatus !== "reviewed" &&
          raw.publicationStatus !== "published")) {
        throw new Error("Invalid publicationStatus");
      }
      if (id(raw.id) !== file.name.slice(0, -5)) throw new Error("Content id does not match filename");
      if (raw.publicationStatus !== "published") return [];
      return [{ file: file.name, raw }];
    } catch (error) {
      errors.push(`content/${folder}/${file.name}: ${(error as Error).message}`);
      return [];
    }
  });
}

function asset(root: string, raw: unknown, folder: string, extensions: string[]) {
  const path = text(raw, "asset path");
  const prefix = `/${folder}/`;
  if (!path.startsWith(prefix) || !path.slice(prefix.length).split("/").every((segment) => pathSegment.test(segment)) ||
      !extensions.includes(extname(path))) throw new Error(`Invalid ${folder} asset path`);
  const diskPath = join(root, "public", ...path.slice(1).split("/"));
  const metadata = lstatSync(diskPath);
  if (!metadata.isFile() || !metadata.size || relative(diskPath, realpathSync(diskPath)) !== "") {
    throw new Error(`Invalid ${folder} asset file`);
  }
  return { path, diskPath, size: metadata.size };
}

function parseInstruction(raw: Record<string, unknown>): Instruction {
  verifyRights(raw);
  const coreInstruction = text(raw.coreInstruction, "coreInstruction");
  const sha256 = createHash("sha256").update(coreInstruction, "utf8").digest("hex");
  if (raw.sha256 !== sha256) throw new Error("Instruction hash mismatch");
  return { id: id(raw.id), version: version(raw.version), sha256, coreInstruction, externalAiUse: externalAiUse(raw.externalAiUse) };
}

function recommendationValues(value: unknown, allowed: readonly string[], name: string): string[] | undefined {
  if (value === undefined) return undefined;
  return array(value, name).map((item) => {
    const option = text(item, name);
    if (!allowed.includes(option)) throw new Error(`Invalid ${name}`);
    return option;
  });
}

function parseKnowledge(root: string, raw: Record<string, unknown>): Knowledge {
  const verification = verifyRights(raw);
  const path = text(raw.path, "asset path");
  const internalName = knowledgePathBasename(path);
  if (!internalName) throw new Error("Invalid downloads asset path");
  const originalFilename = raw.originalFilename === undefined ? internalName : raw.originalFilename;
  if (!isOriginalFilename(originalFilename)) throw new Error("Invalid originalFilename");
  if (!sameFilenameExtension(originalFilename, internalName)) throw new Error("Knowledge filename extension mismatch");
  const file = asset(root, raw.path, "downloads", downloadExtensions);
  if (raw.fileSize !== file.size) throw new Error("Knowledge file size mismatch");
  const sha256 = createHash("sha256").update(readFileSync(file.diskPath)).digest("hex");
  if (raw.sha256 !== undefined && raw.sha256 !== sha256) throw new Error("Knowledge file hash mismatch");
  if (raw.category !== "common" && raw.category !== "optional") throw new Error("Invalid knowledge category");
  const rules = raw.recommendedFor === undefined ? undefined : record(raw.recommendedFor, "recommendation");
  const platformNotes: Partial<Record<Platform, VerifiedNote>> = {};
  if (raw.platformNotes !== undefined) {
    for (const [platform, value] of Object.entries(record(raw.platformNotes, "platform notes"))) {
      if (!isPlatform(platform)) throw new Error("Invalid platform note");
      const note = record(value, "platform note");
      platformNotes[platform] = { text: text(note.text, "platform note"), verifiedAt: verifiedAt(note.verifiedAt) };
    }
  }
  return {
    id: id(raw.id),
    title: text(raw.title, "knowledge title"),
    description: text(raw.description, "knowledge description"),
    path: file.path,
    originalFilename,
    fileSize: file.size,
    sha256,
    fileVersion: version(raw.fileVersion),
    category: raw.category,
    verifiedAt: verification,
    recommendedFor: rules && {
      schoolLevels: recommendationValues(rules.schoolLevels, schoolLevels, "school levels"),
      environments: recommendationValues(rules.environments, environments, "school environments"),
    },
    platformNotes,
    externalAiUse: externalAiUse(raw.externalAiUse),
  };
}

function parseMedia(root: string, raw: unknown): CreateMedia {
  const data = record(raw, "approved demonstration media");
  verifyRights(data);
  if (data.kind !== "video" && data.kind !== "gif") throw new Error("Unsupported demonstration media");
  if (data.captionsPath !== undefined && data.kind !== "video") throw new Error("Captions require a video");
  return {
    kind: data.kind,
    path: asset(root, data.path, "tutorials", data.kind === "gif" ? [".gif"] : [".mp4", ".webm"]).path,
    fallbackText: text(data.fallbackText, "text alternative"),
    stillPath: data.stillPath === undefined ? undefined : asset(root, data.stillPath, "tutorials", imageExtensions).path,
    captionsPath: data.captionsPath === undefined ? undefined : asset(root, data.captionsPath, "tutorials", [".vtt"]).path,
  };
}

function parseAction(raw: unknown): CreateAction {
  const action = record(raw, "step action");
  if (action.kind === "instruction" || action.kind === "knowledge") return { kind: action.kind };
  if (action.kind !== "external-link") throw new Error("Unsupported step action");
  const url = new URL(text(action.url, "external URL"));
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Unsafe external URL");
  return { kind: action.kind, url: url.href, label: text(action.label, "external link label"), verifiedAt: verifiedAt(action.verifiedAt) };
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
}

function requiredGuideText(raw: unknown, field: string): string {
  const value = text(raw, field);
  const normalized = normalizedText(value);
  if (!/[\p{L}\p{N}]/u.test(normalized) || /^(?:todo|tbd|미정|준비 중|검증 대기)[.!?]*$/u.test(normalized)) {
    throw new Error(`Incomplete ${field}`);
  }
  return value;
}

function parseScreenExample(root: string, raw: unknown): ScreenExample {
  const example = record(raw, "screen example");
  const verified = verifyRights(example);
  if (example.source !== "hands-on" || example.privacyChecked !== true) {
    throw new Error("Screen example requires a hands-on capture and privacy review");
  }
  const file = asset(root, example.path, "tutorials", [".png", ".jpg", ".jpeg"]);
  const bytes = readFileSync(file.diskPath);
  if (createHash("sha256").update(bytes).digest("hex") !== example.sha256) {
    throw new Error("Screen example hash mismatch");
  }
  const png = bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  if (extname(file.path) === ".png" ? !png || bytes.includes(Buffer.from("acTL")) : !jpeg) {
    throw new Error("Screen example must be a still PNG or JPEG");
  }
  return {
    captureId: id(example.captureId), path: file.path, verifiedAt: verified,
    alt: requiredGuideText(example.alt, "screen example alt text"),
    focusText: requiredGuideText(example.focusText, "screen example focus text"),
  };
}

function parseStep(root: string, raw: unknown, mobile: boolean): CreateStep {
  const step = record(raw, "step");
  if (step.format !== undefined && step.format !== "media" && step.format !== "text-only") {
    throw new Error("Unknown step format");
  }
  const isText = step.format === "text-only";
  const requiredText = isText ? requiredGuideText : text;
  const fieldPrefix = isText ? "text-only " : "";
  const mascot = step.mascot === undefined ? undefined : record(step.mascot, "official mascot");
  if (mascot) verifyRights(mascot);
  if (!mobile && step.desktopAlternative !== undefined) throw new Error("PC alternative is only for mobile steps");
  const base = {
    id: id(step.id),
    title: requiredText(step.title, fieldPrefix + "step title"),
    description: requiredText(step.description, fieldPrefix + "step description"),
    actions: array(step.actions, fieldPrefix + "step actions").map(parseAction),
    checkLabel: requiredText(step.checkLabel, fieldPrefix + "self-check label"),
    desktopAlternative: step.desktopAlternative === undefined ? undefined : text(step.desktopAlternative, "PC alternative"),
    mascot: mascot && { path: asset(root, mascot.path, "tutorials", imageExtensions).path, text: text(mascot.text, "mascot guidance") },
  };
  if (!isText) {
    if (step.example !== undefined) throw new Error("Screen examples require ordered text instructions");
    return { ...base, format: "media", media: parseMedia(root, step.media) };
  }

  if (Object.hasOwn(step, "media")) throw new Error("Text-only step must not declare media");
  if (!base.actions.length) throw new Error("Text-only step requires an action");
  const instructions = array(step.instructions, "text-only instructions")
    .map((value) => requiredGuideText(value, "text-only instruction"));
  unique(instructions.map(normalizedText), "text-only instructions");
  if (instructions.length < 2) throw new Error("Text-only step requires at least two ordered instructions");
  const example = step.example === undefined ? undefined : parseScreenExample(root, step.example);
  return { ...base, format: "text-only", instructions, example };
}

function verifyGuideRelease(raw: Record<string, unknown>, steps: CreateStep[], checkedAt: string) {
  const verification = record(raw.verification, "hands-on verification");
  if (verification.method !== "hands-on") throw new Error("Guide requires hands-on verification");
  id(verification.recordId);
  const stepIds = array(verification.stepIds, "verified step IDs").map(id);
  unique(stepIds, "verified step IDs");
  if (stepIds.length !== steps.length || steps.some(({ id }) => !stepIds.includes(id))) {
    throw new Error("Hands-on verification must cover every step");
  }
  const approval = record(raw.publicationApproval, "publication approval");
  if (approval.releaseApproved !== true) throw new Error("Guide requires separate release approval");
  id(approval.recordId);
  if (verifiedAt(approval.approvedAt, "approvedAt") < checkedAt) {
    throw new Error("Release approval predates hands-on verification");
  }
}

function parseChecks(raw: unknown, steps: CreateStep[]): CompletionCheck[] {
  const checks = array(raw, "completion checks").map((value): CompletionCheck => {
    const check = record(value, "completion check");
    if (check.kind !== "role" && check.kind !== "knowledge" && check.kind !== "personalization") {
      throw new Error("Unsupported completion check");
    }
    const stepId = id(check.stepId);
    if (!steps.some((step) => step.id === stepId)) throw new Error("Unknown completion check step");
    return { kind: check.kind, stepId, prompt: text(check.prompt, "check prompt"), criteria: text(check.criteria, "check criteria") };
  });
  unique(checks.map(({ kind }) => kind), "completion checks");
  if (checks.length !== 3) throw new Error("Role, knowledge and personalization checks are required");
  return checks;
}

function parseAudience(raw: unknown): GuideAudience {
  const { schoolLevel, environment, sourceFamily } = record(raw, "creation audience");
  const selectedLevel = schoolLevels.find((level) => level === schoolLevel);
  const selectedEnvironment = environments.find((value) => value === environment);
  const selectedFamily = sourceFamilies.find((family) => family === sourceFamily);
  if (!selectedLevel || !selectedEnvironment || !selectedFamily) throw new Error("Invalid creation audience");
  return { schoolLevel: selectedLevel, environment: selectedEnvironment, sourceFamily: selectedFamily };
}

function parseIllustratedJourney(root: string, raw: Record<string, unknown>,
  resources: Knowledge[], steps: CreateStep[], checkedAt: string): IllustratedJourney {
  const journey = record(raw.illustratedJourney, "illustrated journey");
  const audience = parseAudience(journey.audience);
  const requiredIds = array(journey.requiredIds, "required files").map(id);
  const recommendedIds = array(journey.recommendedIds, "recommended files").map(id);
  unique([...requiredIds, ...recommendedIds], "illustrated journey file classifications");
  if (!requiredIds.length || ![...requiredIds, ...recommendedIds].every((key) => resources.some((file) => file.id === key)) ||
      resources.some((file) => file.category === "common" && !requiredIds.includes(file.id))) {
    throw new Error("Illustrated journey requires approved common files and valid file classifications");
  }
  const help = parseAction(journey.help);
  if (help.kind !== "external-link") throw new Error("Illustrated journey requires an external help link");
  const completionExample = parseScreenExample(root, journey.completionExample);
  const examples = steps.map((step) => step.format === "text-only" && step.example);
  if (examples.some((example) => !example)) throw new Error("Every illustrated step requires a verified screen example");
  const captures = [...examples.filter((example): example is ScreenExample => Boolean(example)), completionExample];
  unique(captures.map(({ captureId }) => captureId), "screen capture IDs");
  if (captures.some((capture) => capture.verifiedAt > checkedAt)) {
    throw new Error("Screen example verification cannot postdate guide verification");
  }
  if (record(raw.verification, "illustrated journey verification").completionChecked !== true) {
    throw new Error("Illustrated journey requires hands-on completion checks");
  }
  return { audience, requiredIds, recommendedIds, help, completionExample };
}

function parseGuide(root: string, raw: Record<string, unknown>, instructions: Map<string, Instruction>,
  knowledge: Map<string, Knowledge>): PublishedCreateEntry {
  if (!isPlatform(raw.platform) || !isDevice(raw.device)) throw new Error("Unknown platform or web device");
  const entry = {
    id: id(raw.id), platform: raw.platform, device: raw.device, version: version(raw.version), verifiedAt: verifiedAt(raw.verifiedAt),
  };
  if (raw.support === "unsupported") {
    if (raw.steps !== undefined && array(raw.steps, "unsupported guide steps").length) throw new Error("Unsupported combination has steps");
    return { ...entry, support: raw.support, reason: text(raw.reason, "verified support limitation") };
  }
  if (raw.support !== "supported") throw new Error("Missing verification of guide support");
  const instruction = instructions.get(id(raw.instructionId));
  if (!instruction) throw new Error("Guide requires an approved instruction");
  const resources = array(raw.knowledgeIds, "knowledge ids").map((value) => {
    const file = knowledge.get(id(value));
    if (!file) throw new Error("Guide references an unapproved or missing knowledge file");
    return file;
  });
  unique(resources.map((file) => file.id), "knowledge ids");
  if (!uniqueZipNames(resources.map((file) => file.originalFilename))) {
    throw new Error("Invalid or duplicate knowledge filenames");
  }
  if (!resources.some((file) => file.category === "common")) throw new Error("Guide requires approved common knowledge");
  const steps = array(raw.steps, "guide steps").map((step) => parseStep(root, step, raw.device === "mobile-web"));
  unique(steps.map((step) => step.id), "step ids");
  const actions = steps.flatMap((step) => step.actions);
  if (!actions.some((action) => action.kind === "instruction") || !actions.some((action) => action.kind === "knowledge")) {
    throw new Error("Guide requires instruction and knowledge steps");
  }
  verifyGuideRelease(raw, steps, entry.verifiedAt);
  if (!instruction.externalAiUse?.includes(entry.platform) ||
      resources.some((file) => !file.externalAiUse?.includes(entry.platform))) {
    throw new Error("Guide requires separate external AI use rights for its instruction and files");
  }
  const illustratedJourney = raw.illustratedJourney === undefined ? undefined
    : parseIllustratedJourney(root, raw, resources, steps, entry.verifiedAt);
  return { ...entry, support: raw.support, instruction, resources, steps, checks: parseChecks(raw.checks, steps), illustratedJourney };
}

function approvedMaterial<T extends Instruction | Knowledge>(
  raw: unknown, available: ReadonlyMap<string, T>, platform: Platform, label: string,
): T {
  const binding = record(raw, label);
  if (Object.keys(binding).some((key) => !["id", "rightsRecordId", "sha256", "version"].includes(key))) {
    throw new Error("Unexpected material reference field");
  }
  id(binding.rightsRecordId);
  const material = available.get(id(binding.id));
  const approvedVersion = material && ("fileVersion" in material ? material.fileVersion : material.version);
  if (!material || binding.version !== approvedVersion ||
      binding.sha256 !== material.sha256 || !material.externalAiUse?.includes(platform)) {
    throw new Error(`Independent access requires approved ${label} with matching version, SHA-256 and AI use rights`);
  }
  return material;
}

function parseMaterials(raw: Record<string, unknown>, instructions: ReadonlyMap<string, Instruction>,
  knowledge: ReadonlyMap<string, Knowledge>): PublishedMaterials {
  if (Object.keys(raw).some((key) => !["id", "publicationStatus", "platform", "device", "audience", "instruction", "knowledge"].includes(key)) ||
      Object.keys(record(raw.audience, "creation audience")).some((key) => !["schoolLevel", "environment", "sourceFamily"].includes(key))) {
    throw new Error("Unexpected material catalog field");
  }
  const { platform, device } = raw;
  if (!isPlatform(platform) || !isDevice(device)) throw new Error("Unknown materials platform or web device");
  const audience = parseAudience(raw.audience);
  const instruction = raw.instruction === undefined ? undefined
    : approvedMaterial(raw.instruction, instructions, platform, "instruction");
  const files = raw.knowledge === undefined ? [] : array(raw.knowledge, "materials knowledge files")
    .map((item) => approvedMaterial(item, knowledge, platform, "knowledge file"));
  if (!instruction && !files.length) throw new Error("Published materials require at least one approved item");
  unique(files.map((file) => file.id), "materials knowledge IDs");
  return {
    platform, device, ...audience,
    instruction: instruction && { version: instruction.version, coreInstruction: instruction.coreInstruction, sha256: instruction.sha256 },
    files: files.map(({ id, title, path, originalFilename, description }) => ({ id, title, path, originalFilename, description })),
  };
}

function verifyPublicInventory(root: string, approved: Set<string>, errors: string[]) {
  function walk(path: string) {
    for (const entry of list(join(root, "public", path.slice(1)))) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (!entry.isFile() || !approved.has(child)) errors.push(`Unapproved public asset: ${child}`);
    }
  }
  walk("");
}

export function inspectCreateContent(root: string) {
  const errors: string[] = [];
  const approvedAssets = new Set<string>();
  const instructions = new Map<string, Instruction>();
  const knowledge = new Map<string, Knowledge>();
  const knowledgePaths = new Set<string>();
  const entries: PublishedCreateEntry[] = [];
  const materials: PublishedMaterials[] = [];
  function inspect(folder: string, parse: (raw: Record<string, unknown>) => void) {
    for (const { raw, file } of publishedRecords(root, folder, errors)) {
      try {
        parse(raw);
      } catch (error) {
        errors.push(`content/${folder}/${file}: ${(error as Error).message}`);
      }
    }
  }
  inspect("instructions", (raw) => {
    const instruction = parseInstruction(raw);
    instructions.set(instruction.id, instruction);
  });
  inspect("knowledge", (raw) => {
    const file = parseKnowledge(root, raw);
    const path = file.path.toLowerCase();
    if (knowledgePaths.has(path)) throw new Error("Duplicate knowledge asset path");
    knowledgePaths.add(path);
    knowledge.set(file.id, file);
  });
  inspect("create-materials", (raw) => {
    const selection = parseMaterials(raw, instructions, knowledge);
    if (materials.some((item) => sameMaterialsAudience(item, selection))) throw new Error("Duplicate creation materials audience");
    materials.push(selection);
    for (const file of selection.files) approvedAssets.add(file.path);
  });
  inspect("create", (raw) => entries.push(parseGuide(root, raw, instructions, knowledge)));
  const combinations = entries.map(({ platform, device }) => `${platform}/${device}`);
  const published = entries.filter((_, index) => {
    if (combinations.indexOf(combinations[index]) === combinations.lastIndexOf(combinations[index])) return true;
    errors.push(`Duplicate published combination: ${combinations[index]}`);
    return false;
  });
  for (const entry of published) {
    if (entry.support !== "supported") continue;
    for (const path of guideAssetPaths(entry)) approvedAssets.add(path);
  }
  verifyPublicInventory(root, approvedAssets, errors);
  return { entries: published, materials, errors };
}
