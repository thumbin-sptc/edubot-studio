import type { Metadata } from "next";
import { PageIntro, StatusPanel } from "@/components/page-intro";

const title = "나만의 에듀봇 만들기";
export const metadata: Metadata = { title };

export default function CreatePage() {
  return (
    <PageIntro
      title={title}
      description="ChatGPT, Claude, Gemini에서 교사가 직접 에듀봇을 구성하는 방법을 안내하는 공간입니다."
    >
      <StatusPanel>
        플랫폼별 PC·모바일 웹 제작 절차는 검증 후 공개합니다. 연구회 기본 지침과 지식 파일도 준비 중입니다.
      </StatusPanel>
    </PageIntro>
  );
}
