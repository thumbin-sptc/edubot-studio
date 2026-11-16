export const siteBasePath = "/edubot-studio";
export const emptyExportSegment = "_unpublished";

export function publicAssetUrl(path: string) {
  return `${siteBasePath}${path}`;
}
