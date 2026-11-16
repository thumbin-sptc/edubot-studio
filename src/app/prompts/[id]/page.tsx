import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { emptyExportSegment } from "@/lib/site-path";
import { PromptWizard } from "@/components/prompts/prompt-wizard";
import { getPromptWizardData, getPublishedPrompt, getPublishedPromptSummaries } from "@/lib/published-prompts";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const prompts = await getPublishedPromptSummaries();
  // Static export requires a param even when the catalog is empty. The reserved ID resolves to 404.
  return prompts.length ? prompts.map(({ id }) => ({ id })) : [{ id: emptyExportSegment }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getPublishedPrompt(id);
  if (!template) notFound();
  return { title: template.title, description: template.summary };
}

export default async function PromptPage({ params }: Props) {
  const { id } = await params;
  const template = await getPublishedPrompt(id);
  if (!template) notFound();
  return <PromptWizard {...await getPromptWizardData(template)} />;
}
