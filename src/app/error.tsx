"use client";

import { ActionLink } from "@/components/action-link";
import { PageIntro } from "@/components/page-intro";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <PageIntro title="페이지를 불러오지 못했어요" description="잠시 후 다시 시도하거나 홈으로 이동해 주세요.">
      <div className="flex flex-wrap gap-3">
        <button className="action" type="button" onClick={retry}>다시 시도</button>
        <ActionLink href="/">홈으로 돌아가기</ActionLink>
      </div>
    </PageIntro>
  );
}
