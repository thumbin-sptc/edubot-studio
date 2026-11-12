import type { Metadata } from "next";
import { ActionLink } from "@/components/action-link";
import { PageIntro, StatusPanel } from "@/components/page-intro";
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
        <ul className="grid gap-3" aria-label="공개 프롬프트">
          {prompts.map(({ id, title, summary }) => (
            <li key={id} className="info-panel">
              <h2>{title}</h2>
              {summary && <p>{summary}</p>}
              <div className="mt-4">
                <ActionLink href={`/prompts/${id}`}>{title} 작성하기</ActionLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageIntro>
  );
}
