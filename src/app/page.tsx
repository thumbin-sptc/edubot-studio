import { BookOpen, WandSparkles } from "lucide-react";
import { FeatureCard } from "@/components/feature-card";

export default function HomePage() {
  return (
    <div className="home">
      <div className="shell">
        <div className="home-intro">
          <p className="association">중도중복장애교육연구회</p>
          <h1>특수교육을 위한<br />AI 활용 안내</h1>
          <p className="page-description">
            특수교육 교사를 위한 무료 웹앱입니다. 에듀봇 제작 안내와
            교재 프롬프트를 준비하고 있어요.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          <FeatureCard
            icon={WandSparkles}
            tone="sky"
            title="나만의 에듀봇 만들기"
            description="ChatGPT, Claude, Gemini에서 교사가 직접 에듀봇을 구성할 수 있도록 단계별 안내를 준비하고 있어요."
            href="/create"
            action="제작 안내 보기"
          />
          <FeatureCard
            icon={BookOpen}
            tone="mint"
            title="프롬프트 라이브러리"
            description="교재 프롬프트를 찾고 질문에 답하며 완성할 수 있도록, 검수를 마친 자료부터 공개할 예정이에요."
            href="/prompts"
            action="라이브러리 보기"
          />
        </div>
      </div>
    </div>
  );
}
