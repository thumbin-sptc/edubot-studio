import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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

  const summaries = await Promise.all(filenames.map(async (filename) => {
    const file = await readFile(join(promptDirectory, filename), "utf8");
    const template = JSON.parse(file) as Record<string, unknown> | null;

    if (template?.publicationStatus !== "published") return null;

    const { id, title, summary } = template;
    if (typeof id !== "string" || !id.trim() || typeof title !== "string" || !title.trim()) {
      throw new Error(`Invalid published prompt metadata in ${filename}`);
    }

    return {
      id,
      title,
      summary: typeof summary === "string" ? summary : undefined,
    };
  }));

  return summaries.filter((summary) => summary !== null);
}
