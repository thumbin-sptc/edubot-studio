export const zipLimits = { files: 20, bytes: 24 * 1024 * 1024 } as const;
const safeSegment = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const safeFilename = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.[A-Za-z0-9]+$/;

export function knowledgeFilename(path: string): string | undefined {
  if (!path.startsWith("/downloads/")) return;
  const segments = path.slice("/downloads/".length).split("/");
  if (!segments.every((segment) => safeSegment.test(segment))) return;
  const name = segments.at(-1);
  return name && safeFilename.test(name) ? name : undefined;
}

export function uniqueZipNames(names: readonly string[]): boolean {
  return names.every((name) => safeFilename.test(name)) &&
    new Set(names.map((name) => name.toLowerCase())).size === names.length;
}
