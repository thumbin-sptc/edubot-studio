import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { DataManager } from "@/components/prompts/data-manager";

const title = "내 데이터 관리";
export const metadata: Metadata = { title };

export default function DataPage() {
  return (
    <PageIntro title={title} description="이 기기의 브라우저에 저장한 작성 내용을 관리하는 공간입니다.">
      <DataManager />
    </PageIntro>
  );
}
