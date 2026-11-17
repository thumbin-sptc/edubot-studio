export const zipLimits = { files: 20, bytes: 24 * 1024 * 1024 } as const;
const safeSegment = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const extensionPattern = /\.[A-Za-z0-9]+$/;
const windowsDevice = /^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³]|CONIN\$|CONOUT\$|CLOCK\$)$/i;
const invalidFilenameCharacter = /[<>:"/\\|?*\p{Cc}\p{Cf}\p{Cs}]|[^\S ]/u;
const utf8 = new TextEncoder();

function hasWindowsDeviceName(name: string): boolean {
  return windowsDevice.test(name.split(".", 1)[0].trimEnd());
}

export function knowledgePathBasename(path: string): string | undefined {
  if (!path.startsWith("/downloads/")) return;
  const segments = path.slice("/downloads/".length).split("/");
  if (!segments.every((segment) => safeSegment.test(segment) && !segment.endsWith(".") && !hasWindowsDeviceName(segment))) return;
  const name = segments.at(-1);
  return name && extensionPattern.test(name) ? name : undefined;
}

export function isOriginalFilename(value: unknown): value is string {
  return typeof value === "string" && value.length <= 255 && value === value.trim() && !value.startsWith(".") &&
    extensionPattern.test(value) && !invalidFilenameCharacter.test(value) &&
    !hasWindowsDeviceName(value) && utf8.encode(value).length <= 255;
}

export function sameFilenameExtension(first: string, second: string): boolean {
  const extension = first.match(extensionPattern)?.[0].toLowerCase();
  return extension !== undefined && extension === second.match(extensionPattern)?.[0].toLowerCase();
}

export function uniqueZipNames(names: readonly string[]): boolean {
  return names.every(isOriginalFilename) &&
    new Set(names.map((name) => name.normalize("NFC").toUpperCase().normalize("NFC"))).size === names.length;
}
