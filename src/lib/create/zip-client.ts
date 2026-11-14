import type { ZipBuilder } from "./engine.ts";
import type { Knowledge } from "./model.ts";
import { knowledgeFilename, uniqueZipNames, zipLimits } from "./zip-policy.ts";

export const createKnowledgeZip: ZipBuilder = async (files) => {
  const names = files.map(({ name }) => name);
  if (!files.length || files.length > zipLimits.files || !uniqueZipNames(names) ||
      files.reduce((bytes, file) => bytes + file.data.size, 0) > zipLimits.bytes) {
    throw new Error("Invalid ZIP selection");
  }

  const { zipSync } = await import("fflate");
  const entries = Object.fromEntries(await Promise.all(files.map(async ({ name, data }) =>
    [name, new Uint8Array(await data.arrayBuffer())] as const)));
  return new Blob([zipSync(entries, { level: 0 })], { type: "application/zip" });
};

export async function fetchKnowledgeBlob(file: Knowledge, origin: string, request = fetch): Promise<Blob> {
  if (!knowledgeFilename(file.path) || !Number.isSafeInteger(file.fileSize) || file.fileSize < 1 ||
      file.fileSize > zipLimits.bytes || !/^[a-f0-9]{64}$/.test(file.sha256)) {
    throw new Error("Invalid approved file metadata");
  }
  const response = await request(new URL(file.path, origin), {
    mode: "same-origin",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 200 || response.redirected || !response.body) {
    await response.body?.cancel();
    throw new Error("Knowledge download failed");
  }
  const bytes = new Uint8Array(file.fileSize);
  const reader = response.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.length > bytes.length - size) {
        await reader.cancel();
        throw new Error("Unexpected knowledge file size");
      }
      bytes.set(value, size);
      size += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  if (size !== bytes.length) throw new Error("Unexpected knowledge file size");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== file.sha256) throw new Error("Unexpected knowledge file content");
  return new Blob([bytes]);
}

export function requestZipDownload(zip: Blob) {
  if (!zip.size || zip.type !== "application/zip") throw new Error("Invalid ZIP result");
  const url = URL.createObjectURL(zip);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = "edubot-knowledge.zip";
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to consume the object URL after the click, including during navigation.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
