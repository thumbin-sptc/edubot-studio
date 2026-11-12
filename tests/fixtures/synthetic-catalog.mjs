import { syntheticSimple, syntheticWizard } from "./synthetic-prompts.mjs";

export const sourcePrompt = {
  ...syntheticSimple,
  id: "QA-SOURCE",
  title: "AI 수업 사례",
  summary: "교수 학습 탐색용 합성 요약",
  publicationStatus: "published",
  version: "2.0.0",
  sourceOriginalText: "QA_ONLY_SOURCE_ORIGINAL",
  templateText: "합성 원본 예시",
  relatedPromptIds: ["QA-TARGET", "QA-REVIEWED", "QA-DRAFT", "QA-INVENTORY"],
};

export const targetPrompt = {
  ...syntheticWizard,
  id: "QA-TARGET",
  title: "IEP 연결 실습",
  summary: "이전 답변 활용",
  publicationStatus: "published",
  display: { category: "IEP", schoolEnvironment: "특수학교" },
  source: { document: "합성 교재 A", section: "2장", pdfPage: 12 },
  previousResultImports: [
    { fieldId: "details", sourcePromptIds: ["QA-SOURCE", "QA-DRAFT", "QA-REVIEWED", "QA-INVENTORY"] },
  ],
};

export const locationlessPrompt = {
  ...syntheticSimple,
  id: "QA-LOCATIONLESS",
  title: "위치 없는 합성 프롬프트",
  publicationStatus: "published",
};

export const hiddenPrompts = [
  { ...syntheticSimple, id: "QA-DRAFT", title: "QA_ONLY_DRAFT_TITLE", sourceOriginalText: "QA_ONLY_DRAFT_BODY" },
  { ...syntheticSimple, id: "QA-REVIEWED", title: "QA_ONLY_REVIEWED_TITLE", publicationStatus: "reviewed" },
];

export const syntheticInventory = {
  items: [
    { id: "QA-SOURCE", title: "QA_ONLY_TENTATIVE_TITLE", category: "수업 설계", schoolEnvironment: "특수학급",
      schoolLevel: "초등", source: "합성 교재 A", section: "1장", pdfPage: 4, sourcePdf: "QA_ONLY_SOURCE_FILE.pdf",
      suggestedNextIds: ["QA-LOCATIONLESS"] },
    { id: "QA-TARGET", title: "QA_ONLY_TENTATIVE_TARGET", category: "덮어쓰면 안 되는 분류", schoolLevel: "중등",
      source: "다른 합성 교재", section: "미사용 장", pdfPage: 99, bookPage: 99 },
    { id: "QA-INVENTORY", title: "QA_ONLY_INVENTORY_TITLE", category: "QA_ONLY_INVENTORY_CATEGORY", source: "QA_ONLY_INVENTORY_SOURCE" },
    { id: "QA-DRAFT", title: "QA_ONLY_DRAFT_METADATA", category: "QA_ONLY_DRAFT_CATEGORY" },
    { id: "QA-REVIEWED", title: "QA_ONLY_REVIEWED_METADATA", category: "QA_ONLY_REVIEWED_CATEGORY" },
  ],
};
