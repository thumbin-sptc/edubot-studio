import type { Metadata } from "next";
import { PageIntro, StatusPanel } from "@/components/page-intro";
import { PromptCatalog } from "@/components/prompts/prompt-catalog";
import { getPublishedPromptSummaries } from "@/lib/published-prompts";

const title = "프롬프트 라이브러리";
export const metadata: Metadata = { title };

export default async function PromptsPage() {
  const prompts = await getPublishedPromptSummaries();

  return (
    <PageIntro title={title} description="검수를 마친 교재 프롬프트를 확인하는 공간입니다.">
      {prompts.length === 0 ? (
        <StatusPanel>현재 공개된 프롬프트가 없습니다. 검수를 마친 자료부터 이곳에 공개할 예정입니다.</StatusPanel>
      ) : (
        <PromptCatalog entries={prompts} />
      )}
    </PageIntro>
  );
}
