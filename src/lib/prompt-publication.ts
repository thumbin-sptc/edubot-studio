import { createHash } from "node:crypto";
import { isRecord, parsePromptTemplate, tokenPattern, type PublishedPrompt } from "./prompt-template.ts";

function verifyApproval(raw: unknown, template: PublishedPrompt) {
  if (!isRecord(raw)) throw new Error("Missing publicationApproval");
  for (const key of ["recordId", "sourceVersion"] as const) {
    const value = raw[key];
    if (typeof value !== "string" || !value.trim()) throw new Error(`Missing publicationApproval.${key}`);
  }
  if (raw.templateVersion !== template.version) throw new Error("publicationApproval.templateVersion mismatch");
  const date = raw.approvedAt;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(date).toJSON()?.slice(0, 10) !== date) {
    throw new Error("Invalid publicationApproval.approvedAt");
  }
  if (raw.licenseStatus !== "approved" || raw.releaseApproved !== true) {
    throw new Error("publicationApproval needs rights and explicit release approval");
  }
  for (const [key, text] of [
    ["sourceSha256", template.sourceOriginalText],
    ["templateSha256", template.templateText],
  ] as const) {
    const hash = createHash("sha256").update(text, "utf8").digest("hex");
    if (raw[key] !== hash) throw new Error(`publicationApproval.${key} mismatch`);
  }

  const replacements = raw.replacements;
  if (!Array.isArray(replacements)) throw new Error("Missing publicationApproval.replacements");
  let index = 0;
  const reconstructed = template.templateText.replace(tokenPattern, (token) => {
    const replacement: unknown = replacements[index++];
    if (!isRecord(replacement) || replacement.token !== token || typeof replacement.originalText !== "string") {
      throw new Error("publicationApproval.replacements must match each placeholder in order");
    }
    return replacement.originalText;
  });
  if (index !== replacements.length) throw new Error("Unused publicationApproval.replacements");
  if (reconstructed !== template.sourceOriginalText) throw new Error("Original text reconstruction mismatch");
}

export function parsePublishedPrompt(raw: unknown, expectedId: string): PublishedPrompt | null {
  if (!isRecord(raw) || raw.publicationStatus !== "published") return null;
  const template = parsePromptTemplate(raw);
  if (template.id !== expectedId) throw new Error("Published prompt id does not match its filename");
  const published = { ...template, publicationStatus: "published" as const };
  verifyApproval(raw.publicationApproval, published);
  return published;
}
