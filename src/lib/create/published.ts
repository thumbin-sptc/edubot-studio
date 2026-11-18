import "server-only";

import { cache } from "react";
import { inspectCreateContent } from "./content";

export const getCreateContent = cache(() => {
  const { entries, materials, errors } = inspectCreateContent(process.cwd());
  if (errors.length) throw new Error(`제작 콘텐츠 검증 실패\n${errors.join("\n")}`);
  return { entries, materials };
});

export function getCreateEntries() {
  return getCreateContent().entries;
}
