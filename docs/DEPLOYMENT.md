# Vercel 배포 준비

GitHub Pages는 문서 게시에 사용한다. Next.js 운영 앱의 주소와 배포 상태는 Vercel 프로젝트에서 확인한다. GitHub `main` 반영, Actions 성공, Pages 게시 성공은 각각 GitHub에서 확인하는 상태다.

## 1. 연결 전에 확인

- [ ] 배포할 `main` 커밋의 GitHub Actions가 성공했는지 확인한다. CI는 설치, 콘텐츠 검사, 테스트, 린트, 타입 검사, 빌드와 프로덕션 공개 경계를 검증한다.
- [ ] 현재는 공개 프롬프트와 제작 가이드가 각각 0건이다. 실제 자료를 등록할 때는 [콘텐츠 공개 체크리스트](CONTENT-RELEASE.md)를 먼저 적용한다. 합성 시연 자료는 격리된 로컬 검수에서 사용한다.
- [ ] 이 앱은 Next.js App Router의 기본 Node.js 실행 환경을 사용한다. 서버 로더가 저장소 루트 기준으로 `content/`의 파일을 읽으며, 빌드에서 공개 검증을 통과한 상세 경로만 생성한다. `dynamicParams = false`로 등록되지 않은 상세 URL은 404를 반환한다. 저장소 전체를 Next.js 프로젝트로 빌드하고 기본 출력을 사용한다. [Next.js 경로 설정](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) · [상세 경로 생성](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)

## 2. Vercel 프로젝트 연결

1. Vercel Dashboard에서 배포할 계정 또는 팀을 선택한다. 연결된 프로젝트가 있으면 그 프로젝트의 Git 설정을 확인한다. 처음 연결하는 경우 **Add New → Project**에서 GitHub의 `thumbin-sptc/edubot-studio`를 가져온다. 저장소가 목록에 없으면 Vercel GitHub 앱의 접근 범위를 확인한다. [Vercel Git 연결](https://vercel.com/docs/git)
2. 프로젝트의 **Build and Deployment**에서 아래 값을 확인한다. 첫 연결 화면에 표시되는 항목은 그 화면에서 설정할 수 있다. [Vercel 빌드 설정](https://vercel.com/docs/builds/configure-a-build)

   | 항목 | 값 |
   | --- | --- |
   | Framework Preset | **Next.js** |
   | Root Directory | 저장소 루트 `./` |
   | Install Command | `npm ci` |
   | Build Command | `npm run build` |
   | Output Directory | Next.js 기본값, Override 끔 |
   | Node.js Version | CI와 같은 **24.x**를 선택하고 실제 빌드 로그에서 버전을 확인 |
   | Environment Variables | 현재 앱에 필요한 항목 없음 |

   Vercel은 `package.json`의 `engines.node` 범위에 따라 UI의 Node.js 선택을 재정의할 수 있다. 이 저장소는 22.13 이상인 22.x, 24.x, 26.x를 허용한다. 실제 버전 확인이 필요하면 Build Command를 일시적으로 `node -v && npm run build`로 실행해 기록한다. [Vercel Node.js 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

3. **Settings → Environments → Production → Branch Tracking**에서 `main`을 확인한다. 저장소 연결 후 `main` 푸시는 프로덕션 배포를 시작할 수 있다. GitHub Actions와 Vercel 배포 상태는 각각 확인한다. [Vercel 프로덕션 브랜치](https://vercel.com/docs/git#production-branch)
4. 첫 배포는 검증한 `main`을 대상으로 실행한다. **Deployments**에서 **Production**, **Ready**, Source의 커밋 SHA를 확인한다. Vercel이 표시하는 프로덕션 도메인을 열고 아래 항목을 확인한 후 URL과 SHA를 운영 기록에 남긴다. [Vercel 배포 확인](https://vercel.com/docs/deployments)

## 3. 콘텐츠 0건 배포 점검

| 경로 | 기대 결과 |
| --- | --- |
| `/` | 두 기능 카드와 메뉴가 표시되고 각 시작 화면으로 이동 |
| `/create` | 플랫폼 3종 × PC 웹·모바일 웹 6개 조합 모두 준비 중 |
| `/prompts` | 공개 프롬프트 없음 |
| `/data` | 새 브라우저 프로필에서 자동 저장 OFF, 저장본 없음 |
| `/help` | 이용 안내와 학생 개인정보 보호 안내 표시 |
| `/prompts/SC-001`, `/prompts/SS-001`, 미존재 프롬프트 | HTTP 404 |
| `/create/chatgpt/desktop-web` 등 제작 상세 6개 | HTTP 404 |
| `/content/prompts/SC-001.json`, `/content/prompts/SS-001.json` | HTTP 404 |

- [ ] 브라우저에서 프로덕션 도메인으로 직접 접속해 확인한다. 개발·Preview 빌드와 실제 운영 도메인을 구분해 기록한다.
- [ ] PC·모바일에서 메뉴, 키보드 포커스, 저장 기본값을 확인한다. 첫 승인 자료를 등록한 뒤 실제 시연·파일·원고를 사용해 작성·제작 흐름을 다시 확인한다.
- [ ] GitHub Pages 문서 사이트에서는 루트 문서가 열리고, `content/`, `public/`, `tests/`의 파일은 게시되지 않는지 확인한다. 저장소의 공개 Git 이력은 별도로 관리한다.

## 4. 운영 장애와 롤백

1. **Deployments**에서 현재 운영 SHA와 이전에 정상 동작한 프로덕션 배포를 확인한다. 첫 배포처럼 되돌릴 대상이 없으면 `main`에서 원인을 수정하고 검증한 후 다시 배포한다.
2. 정상 배포가 있으면 대상 행의 메뉴에서 **Instant Rollback**을 선택한다. 대상 SHA, 운영 도메인, 콘텐츠 승인 상태를 확인한 뒤 적용한다. 권리가 회수된 자료가 있는 경우 이전 배포에서도 해당 자료의 노출을 확인한다.
3. 롤백 후 운영 도메인이 선택한 배포를 가리키는지 확인하고 위 화면·404 검사를 반복한다. 수정 커밋의 검증을 마치면 Vercel에서 롤백을 종료하거나 정상 배포를 다시 프로덕션으로 지정하고, 이후 푸시의 자동 도메인 할당 상태를 확인한다. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)

현재 확인 가능한 배포 기록은 GitHub Pages 문서 게시이며, Vercel 연결·프로덕션 URL·롤백은 프로젝트 계정에서 확인이 필요하다.
