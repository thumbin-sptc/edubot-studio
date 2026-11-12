import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePublishedPrompt, promptIdPattern } from "./prompt-template";

type PublishedPromptSummary = {
  id: string;
  title: string;
  summary?: string;
};

const promptDirectory = join(process.cwd(), "content", "prompts");

export async function getPublishedPromptSummaries(): Promise<PublishedPromptSummary[]> {
  const entries = await readdir(promptDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const templates = await Promise.all(filenames.map((filename) => getPublishedPrompt(filename.slice(0, -5))));
  return templates.flatMap((template) => template
    ? [{ id: template.id, title: template.title, summary: template.summary }]
    : []);
}

export async function getPublishedPrompt(id: string) {
  if (!promptIdPattern.test(id)) return null;

  let file: string;
  try {
    file = await readFile(join(promptDirectory, `${id}.json`), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return parsePublishedPrompt(JSON.parse(file), id);
}
