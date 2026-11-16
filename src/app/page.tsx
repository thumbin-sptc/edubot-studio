import { BookOpen, WandSparkles } from "lucide-react";
import { FeatureCard } from "@/components/feature-card";
import { getCreateEntries } from "@/lib/create/published";
import { getPublishedPromptSummaries } from "@/lib/published-prompts";

export default async function HomePage() {
  const prompts = await getPublishedPromptSummaries();
  const guideCount = getCreateEntries().filter(({ support }) => support === "supported").length;
  return (
    <div className="home">
      <div className="shell">
        <div className="home-intro">
          <p className="association">중도중복장애교육연구회</p>
          <h1>특수교육을 위한 AI 작업 공간</h1>
          <p className="page-description">
            교재 프롬프트를 완성하고, 수업에 맞는 에듀봇 제작 안내를 찾아보세요.
          </p>
        </div>
        <div className="feature-grid">
          <FeatureCard
            icon={WandSparkles}
            status={guideCount ? `제작 안내 ${guideCount}건 공개` : "제작 안내 준비 중"}
            title="나만의 에듀봇 만들기"
            description="ChatGPT, Claude, Gemini의 기기별 제작 안내를 확인하세요."
            href="/create"
            action="제작 안내 보기"
          />
          <FeatureCard
            icon={BookOpen}
            status={prompts.length ? `프롬프트 ${prompts.length}건 공개` : "프롬프트 준비 중"}
            title="프롬프트 라이브러리"
            description="특수학급·특수학교 교재에서 필요한 프롬프트를 찾아 단계별로 작성하세요."
            href="/prompts"
            action="라이브러리 보기"
          />
        </div>
      </div>
    </div>
  );
}
