export const syntheticWizard = {
  id: "TEST-WIZARD",
  title: "합성 작성 예제",
  version: "1.0.0",
  publicationStatus: "draft",
  sourceOriginalText: "엔진 검사용 합성 기준문. 교재와 무관합니다.",
  templateText: "제목: {{heading}}\n설명: {{details}}\n수: {{count}}\n색: {{color}}\n모양: {{shapes}}\n목록:\n{{items}}\n참고: {{reference}}",
  steps: [
    { id: "basics", title: "기본 입력", fieldIds: ["heading", "details", "count"] },
    { id: "choices", title: "선택 입력", fieldIds: ["color", "shapes"] },
    { id: "entries", title: "반복 입력", fieldIds: ["items"] },
    { id: "result", title: "프롬프트 완성", kind: "generated-output" },
  ],
  fields: [
    { id: "heading", label: "연습 제목", kind: "short-text", required: true, placeholderToken: "{{heading}}", example: "참고 제목" },
    { id: "details", label: "연습 설명", kind: "long-text", required: false, placeholderToken: "{{details}}", privacySensitive: true },
    { id: "count", label: "연습 수", kind: "number", required: true, min: 0, max: 10, placeholderToken: "{{count}}" },
    {
      id: "color", label: "연습 색", kind: "single-select", required: true, allowOther: true,
      options: [{ value: "청색", label: "파랑" }, { value: "적색", label: "빨강" }], placeholderToken: "{{color}}",
    },
    {
      id: "shapes", label: "연습 모양", kind: "multi-select", required: false, allowOther: true,
      options: [{ value: "삼각형", label: "세모" }, { value: "사각형", label: "네모" }], placeholderToken: "{{shapes}}",
    },
    {
      id: "items", label: "연습 항목", kind: "repeatable", required: true, itemType: "long-text",
      minItems: 2, maxItems: 3, format: "각 항목을 • 기호로 시작하는 줄로 정리",
      exampleItems: ["참고 항목"], defaultValue: [], placeholderToken: "{{items}}",
    },
  ],
  attachments: [
    { id: "reference", label: "연습 참고 자료", required: false, allowedModes: ["external-file", "text-input"], inputToken: "{{reference}}" },
  ],
};

export const syntheticSimple = {
  id: "TEST-COPY",
  title: "합성 복사 예제",
  version: "1.0.0",
  publicationStatus: "draft",
  mode: "simple-copy",
  sourceOriginalText: "복사 엔진만 검증하는 한 줄입니다.",
  templateText: "복사 엔진만 검증하는 한 줄입니다.",
  steps: [],
  fields: [],
};

export function validInputs() {
  return {
    fieldValues: {
      heading: "테스트 \$& {{리터럴}}",
      details: "가상의 설명\n두 번째 줄",
      count: "2.5",
      color: { selected: [], useOther: true, other: "초록" },
      shapes: { selected: ["사각형", "삼각형"], useOther: true, other: "원" },
      items: [" 첫째 ", "둘째"],
    },
    attachmentModes: { reference: "text-input" },
    attachmentTexts: { reference: "합성 텍스트" },
  };
}
