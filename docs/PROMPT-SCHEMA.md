# 프롬프트 및 튜토리얼 데이터 설계 원칙 (코드 작성 전)

## 불변 원칙

- 원문 `originalText`는 교재 출처와 일치하는 기준 원본이다.
- 변수 치환은 선언된 `{{variableId}}`에만 적용한다.
- 선택 문단을 제거할 필요가 있으면 `optionalBlock`을 **사전에 명시**한다. 임의의 본문 문장 삭제·재작성 금지.
- 미정 값은 임의의 예시로 조용히 채우지 않음. 필수 입력 부족 시 완료 방지, 선택 블록 미입력 시 해당 블록만 제거.
- 사용자가 마지막 화면에서 편집한 텍스트는 `editedOutput`으로 별도 보관하고 `originalText`를 덮어쓰지 않는다.
- 파일 첨부 방식은 `external-file`(외부 AI로 업로드 안내) / `text-input`(지정 영역에 텍스트 추가).

## 논리적 템플릿 엔터티(구조 예시, 실제 데이터 아님)

```ts
interface PromptTemplate {
  id: string;
  title: string;
  summary: string;
  categoryIds: string[];
  textbook: { chapter: string; section?: string; page?: number };
  version: string;
  originalText: string; // 교재 원문; 앱이 임의 재작성 금지
  steps: PromptStep[];
  fields: PromptField[];
  optionalBlocks?: OptionalBlock[]; // 미입력 시 제거 가능한 지정 영역
  attachments?: ReferenceRequirement[];
  relatedPromptIds?: string[];
}

interface PromptStep {
  id: string;
  title: string;
  fieldIds: string[];
  helpText?: string;
}

type FieldKind =
  | 'single-select' | 'multi-select'
  | 'short-text' | 'long-text'
  | 'number' | 'repeatable';

interface PromptField {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  placeholderToken: string; // originalText의 지정 위치
  helpText?: string;
  example?: string;
  options?: { value: string; label: string }[];
  allowOther?: boolean;
}

interface OptionalBlock {
  id: string;
  dependentFieldIds: string[];
  // 구체 표현식·구문은 구현 시 정하되 원문에 사전 선언된 구간만 제거
}

interface ReferenceRequirement {
  id: string;
  label: string;
  required: boolean;
  allowedModes: ('external-file' | 'text-input')[];
  inputToken?: string; // 텍스트 직접 입력 시 삽입할 원문상의 지정 위치
}
```

**중요:** 실제 교재 원문에 placeholder가 없으면 연구회가 삽입 위치를 검토·승인한 후 템플릿화한다. 원문 보존의 의미는 새로운 임의 지시문 추가가 아닌, 사용자 값을 넣을 대상만 설계한다는 것이다.

## 런타임 데이터(개념)

```ts
interface PromptDraft {
  promptId: string;
  templateVersion: string;
  currentStepId: string;
  fieldValues: Record<string, unknown>;
  attachmentModes: Record<string, 'external-file' | 'text-input'>;
  editedOutput?: string;
  externalAiResult?: string; // 사용자가 직접 붙여넣음
  updatedAt: string;
}
```

- `storageEnabled`가 true인 경우에만 영속 저장한다.
- 데이터 버전과 `templateVersion`을 기록하여 템플릿 변경 후 기존 작성 내용이 잘못 치환되지 않도록 안내할 수 있어야 한다.
- 프롬프트별 삭제는 참조된 이전 결과와 연결 관계의 잔존 데이터도 함께 고려해야 한다.

## 지식 파일 논리 메타데이터

`id`, `title`, `description`, `filePath`, `fileSize`, `category`(common/optional), `recommendedFor`(학교급·환경 등), `licenseStatus`(배포 가능 확인 여부), `lastVerifiedAt`.

초기에는 저작권·배포 가능 여부가 확인된 파일만 정적 경로에 둔다. 실제 파일 목록을 공급받기 전까지 가짜 지식 파일을 최종 제품에 포함하지 않는다.

## 제작 튜토리얼 논리 메타데이터

`platform`(chatgpt/claude/gemini), `device`(desktop-web/mobile-web), `steps[]`(id/title/description/videoPath/staticFallbackPath/actions/checks), `verifiedAt`, `supportNotes`.

플랫폼·기기 조합별 단계 배열 길이와 순서를 독립 정의한다. 외부 UI가 바뀌면 해당 조합만 수정한다.

## 변환 검증 필수

1. 선언된 모든 placeholder는 `templateText`에 존재하며 승인한 원문 대체 구간에만 대응하는가?
2. `templateText` 내 모든 placeholder는 `fields` 또는 승인된 참고 자료·선택 블록에서 선언되었는가?
3. 필수 필드의 기본값 누락을 오류로 처리하는가?
4. 비선택 영역의 원문 텍스트가 치환 전후 동일한가?
5. 파일 첨부와 직접 입력 경로에서 필요한 자료 안내가 누락되지 않는가?
6. 수동 편집 사본은 원본 불변성을 해치지 않는가?
7. 저장 OFF에서 영속 작성 데이터가 남지 않는가?

## v0.3 실제 데이터 호환 및 버전

- 초기 분석본 2건의 키는 `sourceOriginalText`, `templateText`, `fields`, `steps`, `source`이며 논리 명세의 `originalText`와는 다르다. **이름 차이를 무시하지 말고** 런타임 로더에서 명시적으로 정규화한다.
- 공통 템플릿 식별자 `id`는 버전 간 유지. `version`은 승인된 원문이나 입력 위치가 변할 때 증가. `publicationStatus`는 `draft` / `reviewed` / `published`이며 **published만 공개 리스트·라우트에 노출**한다.
- 템플릿 메타데이터 변경만으로도 UI가 렌더링되어야 한다. 엔진 코드에 프롬프트 ID별 분기문을 추가하지 않는다.
- IEP 등 추후 분야도 동일 스키마를 이용하되 필드·단계는 개별 데이터로 선언한다.
- `sourceOriginalText`는 PDF에서 편집 주석과 PDF 줄바꿈을 정리한 전사본이므로, 책 확정본에 대한 2차 원문 대조·승인이 필요하다.
- 템플릿 갱신 시 기존 로컬 작성 초안은 기존 버전으로 유지하거나 명시적 이관을 확인받는다.

- 짧은 한 줄 프롬프트는 향후 `mode: simple-copy`(steps 및 fields 빈 배열 허용, 템플릿 placeholder 없음)로 추가할 수 있다. 단계별 생성형은 `mode: wizard`(기본값)를 사용한다. 실제 콘텐츠 검수 전 자동 공개 금지.
