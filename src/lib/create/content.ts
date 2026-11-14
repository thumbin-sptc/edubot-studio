import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { isRecord, promptIdPattern, versionPattern } from "../prompt-template.ts";
import {
  environments, isDevice, isPlatform, schoolLevels,
  type CompletionCheck, type CreateAction, type CreateMedia, type CreateStep, type Instruction,
  type Knowledge, type Platform, type PublishedCreateEntry, type VerifiedNote,
} from "./model.ts";
import { knowledgeFilename, uniqueZipNames } from "./zip-policy.ts";

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

function verifiedAt(value: unknown): string {
  const date = text(value, "verifiedAt");
  const timestamp = Date.parse(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== date || timestamp > Date.now()) {
    throw new Error("Invalid verification date");
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
  return { id: id(raw.id), version: version(raw.version), sha256, coreInstruction };
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

function parseStep(root: string, raw: unknown, mobile: boolean): CreateStep {
  const step = record(raw, "step");
  const mascot = step.mascot === undefined ? undefined : record(step.mascot, "official mascot");
  if (mascot) verifyRights(mascot);
  if (!mobile && step.desktopAlternative !== undefined) throw new Error("PC alternative is only for mobile steps");
  return {
    id: id(step.id),
    title: text(step.title, "step title"),
    description: text(step.description, "step description"),
    media: parseMedia(root, step.media),
    actions: array(step.actions, "step actions").map(parseAction),
    checkLabel: text(step.checkLabel, "self-check label"),
    desktopAlternative: step.desktopAlternative === undefined ? undefined : text(step.desktopAlternative, "PC alternative"),
    mascot: mascot && { path: asset(root, mascot.path, "tutorials", imageExtensions).path, text: text(mascot.text, "mascot guidance") },
  };
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
  if (!uniqueZipNames(resources.map((file) => knowledgeFilename(file.path) ?? ""))) {
    throw new Error("Invalid or duplicate knowledge filenames");
  }
  if (!resources.some((file) => file.category === "common")) throw new Error("Guide requires approved common knowledge");
  const steps = array(raw.steps, "guide steps").map((step) => parseStep(root, step, raw.device === "mobile-web"));
  unique(steps.map((step) => step.id), "step ids");
  const actions = steps.flatMap((step) => step.actions);
  if (!actions.some((action) => action.kind === "instruction") || !actions.some((action) => action.kind === "knowledge")) {
    throw new Error("Guide requires instruction and knowledge steps");
  }
  return { ...entry, support: raw.support, instruction, resources, steps, checks: parseChecks(raw.checks, steps) };
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
  inspect("create", (raw) => entries.push(parseGuide(root, raw, instructions, knowledge)));
  const combinations = entries.map(({ platform, device }) => `${platform}/${device}`);
  const published = entries.filter((_, index) => {
    if (combinations.indexOf(combinations[index]) === combinations.lastIndexOf(combinations[index])) return true;
    errors.push(`Duplicate published combination: ${combinations[index]}`);
    return false;
  });
  for (const entry of published) {
    if (entry.support !== "supported") continue;
    for (const file of entry.resources) approvedAssets.add(file.path);
    for (const { media, mascot } of entry.steps) {
      for (const path of [media.path, media.stillPath, media.captionsPath, mascot?.path]) {
        if (path) approvedAssets.add(path);
      }
    }
  }
  verifyPublicInventory(root, approvedAssets, errors);
  return { entries: published, errors };
}
