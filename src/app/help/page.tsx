import type { Metadata } from "next";
import { PageIntro, StatusPanel } from "@/components/page-intro";

const title = "이용 안내";
export const metadata: Metadata = { title };

export default function HelpPage() {
  return (
    <PageIntro
      title={title}
      description="EDU-BOT Studio는 중도중복장애교육연구회가 특수학교·특수학급 교사를 위해 준비하는 무료 웹앱입니다."
    >
      <section className="info-panel">
        <h2>학생 개인정보 보호</h2>
        <p>외부 AI에 내용을 입력하거나 파일을 첨부하기 전에 학생 이름은 가명으로 바꾸고, 학생을 식별할 수 있는 정보는 지워 주세요.</p>
      </section>
      <StatusPanel>플랫폼별 상세 이용 안내와 문제 해결 방법은 검증을 마친 뒤 공개할 예정입니다.</StatusPanel>
    </PageIntro>
  );
}
