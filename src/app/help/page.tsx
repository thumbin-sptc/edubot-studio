import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";

const title = "이용 안내";
export const metadata: Metadata = { title };

export default function HelpPage() {
  return (
    <PageIntro
      title={title}
      description="교재 프롬프트를 작성하고 외부 AI에 사용할 때 알아두면 좋은 내용을 모았습니다."
    >
      <section className="info-panel">
        <h2>프롬프트 작성과 에듀봇 제작</h2>
        <p>라이브러리에서 프롬프트를 골라 질문에 답한 뒤 완성본을 복사하세요. 에듀봇 만들기에서는 플랫폼과 기기별 제작 안내의 공개 상태를 확인할 수 있습니다.</p>
        <div className="help-links">
          <Link href="/prompts">프롬프트 라이브러리</Link>
          <Link href="/create">에듀봇 만들기</Link>
        </div>
      </section>
      <section className="info-panel">
        <h2>학생 개인정보 보호</h2>
        <p>외부 AI에 내용을 입력하거나 파일을 첨부하기 전에 학생 이름은 가명으로 바꾸고, 학생을 식별할 수 있는 정보는 지워 주세요.</p>
      </section>
      <section className="info-panel">
        <h2>이 브라우저에 보관한 작성본</h2>
        <p>자동 저장을 켜면 이 브라우저에서 작성본을 다시 열 수 있습니다. 끄기 전에 저장한 내용은 내 데이터 관리에서 열람하거나 삭제할 수 있습니다.</p>
        <div className="help-links"><Link href="/data">내 데이터 관리</Link></div>
      </section>
    </PageIntro>
  );
}
