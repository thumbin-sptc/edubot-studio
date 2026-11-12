import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PromptWizard } from "@/components/prompts/prompt-wizard";
import { getPublishedPrompt, getPublishedPromptSummaries } from "@/lib/published-prompts";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const prompts = await getPublishedPromptSummaries();
  return prompts.map(({ id }) => ({ id }));
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
  return <PromptWizard template={template} />;
}
