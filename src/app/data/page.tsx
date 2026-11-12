import type { Metadata } from "next";
import { PageIntro, StatusPanel } from "@/components/page-intro";

const title = "내 데이터 관리";
export const metadata: Metadata = { title };

export default function DataPage() {
  return (
    <PageIntro title={title} description="이 기기의 브라우저에 저장한 작성 내용을 관리하는 공간입니다.">
      <StatusPanel>
        저장 및 삭제 기능을 준비하고 있습니다. 현재 버전은 작성 내용을 입력받거나 저장하지 않습니다.
      </StatusPanel>
    </PageIntro>
  );
}
