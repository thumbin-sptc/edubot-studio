import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { approvedResultSources, indexInventory, publicPromptSummary, relatedPublicPrompts } from "./prompt-catalog";
import { parsePublishedPrompt, promptIdPattern, type PublishedPrompt, type WizardTemplate } from "./prompt-template";

const promptDirectory = join(process.cwd(), "content", "prompts");
const inventoryPath = join(process.cwd(), "content", "prompt-inventory.json");

const getPublishedPrompts = cache(async (): Promise<PublishedPrompt[]> => {
  const entries = await readdir(promptDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const templates = await Promise.all(filenames.map((filename) => getPublishedPrompt(filename.slice(0, -5))));
  return templates.filter((template) => template !== null);
});

export const getPublishedPrompt = cache(async (id: string) => {
  if (!promptIdPattern.test(id)) return null;

  let file: string;
  try {
    file = await readFile(join(promptDirectory, `${id}.json`), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return parsePublishedPrompt(JSON.parse(file), id);
});

export const getPublishedPromptSummaries = cache(async () => {
  const templates = await getPublishedPrompts();
  if (!templates.length) return [];
  const inventory = indexInventory(JSON.parse(await readFile(inventoryPath, "utf8")));
  return templates.map((template) => publicPromptSummary(template, inventory.get(template.id)));
});

export async function getPromptWizardData(prompt: PublishedPrompt) {
  const [catalog, published] = await Promise.all([getPublishedPromptSummaries(), getPublishedPrompts()]);
  const { id, title, summary, version, mode, templateText, fields, attachments, steps } = prompt;
  const template: WizardTemplate = { id, title, summary, version, mode, templateText, fields, attachments, steps };
  return {
    template,
    related: relatedPublicPrompts(prompt, catalog),
    imports: approvedResultSources(prompt, published),
  };
}
