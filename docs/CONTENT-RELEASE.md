# 콘텐츠 승인과 공개 체크리스트

## 1. 검수 작업 공간 준비

- [ ] 공개 저장소의 GitHub 파일, 브랜치, PR, 커밋 이력은 누구나 볼 수 있다. `draft`와 `reviewed`는 Next.js 앱의 노출 상태다. 승인 전 실제 원고를 GitHub에서 관리하려면 먼저 저장소를 Private으로 전환하는 운영 결정을 한다. 전환 전에는 비공개 로컬 작업 공간에서 검수한다.
- [ ] `public/`의 파일은 Next.js가 직접 제공한다. 승인되지 않은 원고·영상·지식 파일은 이 경로에 넣지 않는다. GitHub Pages에는 검증된 `out/`만 게시한다. 승인된 공개 파일은 이 산출물에 복사되며 소스의 `content/`와 테스트는 포함하지 않는다. 이미 공개된 파일은 브랜치나 폴더를 바꿔도 과거 Git 이력에 남을 수 있다.
- [ ] 학생의 실명·학교·생년월일·건강 정보와 식별 가능한 실제 사례는 원고, 예시, 테스트, 지식 파일, 이슈나 PR에 넣지 않는다. 합성 데이터로 실행하고, 실제 외부 AI에 붙여넣거나 파일을 첨부할 때는 해당 서비스의 처리 정책을 따른다.

## 2. 프롬프트 승인

- [ ] 승인 대상의 제목, 교재 유형, PDF 기준 페이지, 확인된 최종 인쇄 교재 장·절과 페이지를 기록한다. `source.pdfPage`와 `source.bookPage`를 구분한다. 확인 전에는 해당 값을 생략한다. 인벤토리는 분류·출처 보강에 사용한다.
- [ ] `content/prompts/<id>.json`의 `sourceOriginalText`를 해당 승인 버전 원문과 대조한다. `templateText`에는 승인된 구간의 치환 토큰만 넣는다. 문장과 고정 문구, 줄바꿈은 원문 기준으로 확인한다.
- [ ] `draft`에서 단계, 필수/선택 입력, 반복·선택·서술 입력, 참고 자료 방식, 가명 안내를 검수한다. `relatedPromptIds`에는 승인한 후속 연결만 기록하고, `previousResultImports`에는 실존하는 `long-text` 필드와 허용 출처 ID를 선언한다.
- [ ] 연구회 검수자가 원문·치환 구간·출처·배포 권리를 확인한 뒤 `reviewed`로 전환한다. 검수자·확인 날짜와 권리 판단 근거를 승인 기록에 남긴다. 원문을 공개할 권리가 확인되기 전에는 승인 기록도 비공개 작업 공간에 둔다.
- [ ] 검수자가 합성 입력으로 실제 생성본·복사·편집·후속 답변 가져오기를 확인하고 PC·모바일 웹에서 화면과 키보드 동작을 점검한다. 배포 승인을 확인한 뒤 운영자가 명시적으로 `published`로 변경한다. CI는 상태를 변경하지 않는다.
- [ ] 원문·치환·질문이 바뀌면 기존 ID를 유지하고 `version`을 올린다. 이전 작성본이 기존 버전으로 남는지 확인한다. 배포 권리를 회수하면 공개 상태와 관련 링크를 다시 검사한다.

### 공개 승인 메타데이터

`published` 템플릿에는 다음 `publicationApproval` 값을 기록합니다. `draft`와 `reviewed`는 이 값 없이 검수할 수 있습니다.

| 필드 | 기록할 값 |
| --- | --- |
| `recordId` | 비공개 검수·권리·게시 결정 기록을 찾을 수 있는 식별자 |
| `sourceVersion`, `templateVersion` | 확인한 교재 판본 식별자와 승인된 템플릿의 `version` |
| `approvedAt`, `licenseStatus`, `releaseApproved` | 명시적 게시 승인 날짜(`YYYY-MM-DD`), 확인된 배포 권리(`approved`), 실제 게시 결정 후의 `true` |
| `sourceSha256`, `templateSha256` | JSON에서 파싱한 `sourceOriginalText`와 `templateText` 각각의 UTF-8 SHA-256 소문자 16진수. 공백과 줄바꿈까지 포함 |
| `replacements` | `templateText`의 왼쪽부터 토큰 출현마다 `{token, originalText}` 한 항목. `token`에는 중괄호까지, `originalText`에는 승인한 원래 구간 그대로 기록. 순수 삽입 위치는 빈 문자열, 토큰이 없는 복사형은 빈 배열 |

CI와 공개용 빌드는 기록의 형식과 상태, 버전·해시 일치, 그리고 토큰별 원문 복원 결과를 확인합니다. 연구회가 실제 원문 대조, 입력 구간과 권리 검수, 게시 결정을 합니다. 기록 식별자만 공개 JSON에 적고 검수자의 개인정보나 권리 근거 문서는 비공개 기록에 보관합니다.

원문·치환 위치·입력 질문이 바뀌면 ID를 유지하고 `version`을 올립니다. 새 버전으로 원문 대조, 응답 검수, 권리·게시 결정을 다시 확인한 뒤 승인 기록·해시·토큰 목록을 갱신합니다. [첫 후보 검수 기록](FIRST-CONTENT-REVIEW.md) · [등록에 필요한 자료](FIRST-CONTENT-INPUTS.md)

## 3. 에듀봇 제작 자료 승인

- [ ] `content/instructions/<id>.json`에는 승인된 `coreInstruction`, `version`, UTF-8 원문의 SHA-256인 `sha256`, `licenseStatus: approved`, 실제 `verifiedAt`을 기록한다. JSON 문자열을 파싱한 값 그대로 해시하고, 개인화가 없어도 정확히 같은 원문이 복사되는지 확인한다.
- [ ] `content/knowledge/<id>.json`의 `path`, `fileSize`(바이트), `fileVersion`, 권리, 확인일을 승인된 `public/downloads/` 실파일과 대조한다. `sha256`을 기록하면 검사기가 실파일과 대조하며, 브라우저는 빌드에서 계산한 해시로 응답 바이트를 확인한다. 공통/선택 분류, 추천 학교급·교육 환경, 플랫폼별 제한과 확인일은 실제 확인값을 쓴다. 같은 조합의 다운로드 이름은 대소문자를 무시하고 고유해야 한다.
- [ ] `content/create/<id>.json`의 ChatGPT·Claude·Gemini × PC·모바일 웹 절차를 조합별로 직접 확인한다. 지침·파일 ID, 단계 순서, 외부 링크 및 확인일, 사용자 자가 확인 문구, 점검 질문과 돌아갈 단계를 실제값으로 작성한다.
- [ ] 시연형 단계에는 권리를 확인한 영상 또는 GIF와 텍스트 대안을 등록한다. 정지 이미지와 필요한 자막도 권리를 확인해 `public/tutorials/`에 배치하고 오류 대안, 재생·정지, 동작 줄이기를 확인한다. 기존 단계의 `media.kind: "video" | "gif"` 구조를 그대로 읽으며 `format: "media"`도 사용할 수 있다.
- [ ] 텍스트 전용 단계에는 `format: "text-only"`를 명시하고 아래의 텍스트와 검수·게시 기록을 작성한다. 한 가이드에서 시연형과 텍스트 전용 단계를 함께 쓸 수 있다.
- [ ] 확인된 조합만 개별적으로 `published`로 전환한다. 미검수 조합은 준비 중으로 둔다. 실제로 미지원임이 확인된 조합에는 확인일과 근거를 기록한다.
- [ ] 가이드 내용을 개정하거나 시연을 추가하면 가이드 ID를 유지하고 버전을 올린다. 기존 진행 기록은 해당 버전에 보관된다. 경로, 파일, 지침의 연결과 해시·크기를 다시 검수하고 회수된 파일은 공개 디렉터리에서 제거한다.

### 텍스트 전용 단계와 승인 필드

| 필드 | 요구 사항과 검증 실패 메시지 |
| --- | --- |
| `steps[].format` | `text-only`를 명시한다. 생략하면 기존 시연형으로 검사한다. 알 수 없는 값은 `Unknown step format`으로 거절한다. |
| `steps[].media` | 텍스트 전용 단계에서는 항목을 생략한다. `null` 포함 선언 시 `Text-only step must not declare media`로 거절한다. |
| `steps[].title`, `description`, `checkLabel` | 제목, 짧은 안내, 외부 서비스에서 직접 확인할 항목을 넣는다. 빈 값은 `Missing text-only …`, 문자나 숫자가 없는 값과 `TODO`·`미정` 같은 임시 표기는 `Incomplete text-only …`로 거절한다. |
| `steps[].instructions` | 실제 조작 순서대로 서로 다른 문장 두 개 이상을 배열로 넣는다. 배열이 아니면 `Invalid text-only instructions`, 중복이면 `Duplicate text-only instructions`, 두 개 미만이면 `Text-only step requires at least two ordered instructions`로 거절한다. |
| `steps[].actions` | 안전한 외부 이동, 지침 복사, 지식 자료 내려받기 중 해당 단계에 필요한 동작을 등록한다. 빈 배열은 `Text-only step requires an action`으로 거절한다. |
| `verifiedAt`, `verification` | 가이드의 실제 조작 검수일과 `{ method: "hands-on", recordId, stepIds }`를 기록한다. 텍스트 전용 단계가 하나라도 있으면 `stepIds`에 가이드의 모든 단계 ID가 정확히 한 번 들어가야 한다. 공식 도움말 대조만으로는 실제 조작 완료를 기록하지 않는다. |
| `publicationApproval` | 별도 공개 결정에 해당하는 `{ releaseApproved: true, recordId, approvedAt }`를 기록한다. 승인일은 실제 조작 검수일과 같거나 이후여야 한다. |

기록 ID는 비공개 검수·승인 자료를 참조합니다. 검수자가 실제 계정으로 각 단계와 완료 점검을 수행하고, 안내문만 읽어도 조작과 결과 확인이 가능한지 확인합니다. 자동 검사는 구조와 기록을 확인합니다. 승인된 기본 지침의 원문·해시, 공통 지식 파일 한 개 이상, 실파일 권리·크기·해시, 지침/자료 동작과 세 종류 완료 점검은 동일하게 검사합니다. 현재 ChatGPT PC 안내 초안은 실제 조작과 자료·게시 승인을 기다리고 있습니다.

## 4. 검사와 배포 확인

- [ ] 합성 공개 데이터는 테스트 또는 격리된 로컬 복제본에서만 쓴다. 합성 템플릿·파일을 운영 `content/`나 `public/`에 커밋하지 않는다.
- [ ] `npm ci`, `npm run validate:content`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`를 실행한다. 빌드 후 `node scripts/check-public-build.mjs`로 정적 페이지, 라우팅 데이터, 브라우저 번들, 승인 파일과 미승인 경로의 부재를 확인한다.
- [ ] 상태·필수 필드·참조·권리·해시·경로 오류는 공개 전에 해결한다. 인벤토리와 템플릿의 추천 불일치, 등록됐지만 아직 미승인인 후속 대상은 경고로 검토한다. 어디에도 등록되지 않은 연결 ID는 오류이며, 미승인 대상은 앱에서 제외된다.
- [ ] GitHub Actions의 커밋별 CI가 성공했는지 확인한 뒤 배포 대상과 SHA를 확인한다. 같은 실행의 `deploy` 작업이 `github-pages` 환경에 성공했는지 확인한다. 배포 후 실제 서비스 URL에서 승인 조합·프롬프트와 미승인 경로를 점검한다.
- [ ] ZIP은 한 번에 **최대 20개, 합계 24 MiB**까지 지원한다. 모바일에서 원본과 ZIP을 동시에 메모리에 두는 브라우저 작업량을 제한하기 위한 값이다. 이 범위를 넘거나 ZIP이 실패하면 승인된 개별 파일 링크를 사용한다. 브라우저의 다운로드 목록에서 파일을 확인한 뒤 외부 AI에 직접 첨부한다.

현재 공개 승인된 프롬프트는 29건, 제작 가이드는 0건이다. 새 판본이나 제작 가이드 등록 시 위 흐름을 다시 점검한다.
