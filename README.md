# RINGCOMS 캠페인 관리 (광고콘텐츠팀)

인플루언서 캠페인(시딩·체험단·공동구매·라이브커머스) 진행관리, 성과 리포트, 광고주 공유, 광고주 계정(클라이언트)을 위한 사이트입니다.

## 구성
| 경로 | 내용 |
|---|---|
| `public/index.html` | 사이트 전체 (화면·로직). Firebase(로그인·데이터)와 연결 |
| `public/l.html` | 인플루언서 전용 단축 링크(`/l/{코드}`)가 여는 브릿지 페이지 (로그인 없음, 방문·버튼 클릭 집계) |
| `netlify/functions/social-stats.mjs` | 인스타그램·틱톡 성과·게시일·썸네일 수집 서버 함수 (`/api/social-stats`) |
| `netlify/functions/ops.mjs` | 업데이트 제안 읽기·승인 서버 함수 (`/api/ops`, GitHub `ops` 브랜치의 `ops/suggestions.json`) |
| `public/tools.js` | 도구 화면: 콘텐츠 가이드 · 영상 검수 · AI 영상 제작(틀), 캠페인 만들기 4단계, 상단 계정 선택, 풀 선택 삭제 |
| `public/img/ringcoms-wide.png` | 가로형 RINGCOMS 로고 (흰색, 가이드 PPT·PDF 우상단 · 광고주 색으로 자동 변환) |
| `netlify/functions/ai.mjs` | AI 연결 상태 확인 (`/api/ai`) |
| `netlify/functions/guide.mjs` | 콘텐츠 가이드 AI 백그라운드 함수 (`/api/guide`): 광고주 링크 읽기 → Gemini 표준 가이드 초안 → `guides/{id}.aiResult` → 화면이 자동 적용 |
| `netlify/lib/guide.mjs` | 광고주 페이지 읽기·가이드 프롬프트 공용 모듈 |
| `netlify/functions/review.mjs` | 영상 검수 백그라운드 함수 (`/api/review`, 최대 15분): 영상 → Gemini → `reviews/{id}`에 결과 |
| `netlify/lib/gemini.mjs` | Gemini 호출·파일 업로드·팀원 확인 공용 모듈 (함수 폴더 밖이라 단독 배포 안 됨) |
| `public/changelog.json` | 업데이트 이력 (버전별 변경 사항) — 배포할 때마다 맨 앞에 추가 |
| `firestore.rules` | Firestore 보안 규칙 (Firebase 콘솔에 게시해야 적용) |
| `netlify.toml` | Netlify 배포 설정 |

## 배포
`main` 브랜치에 올리면 Netlify가 자동으로 배포합니다. 빌드 과정은 없습니다.

## 환경변수 (Netlify → Site configuration → Environment variables)
| 이름 | 필수 | 설명 |
|---|---|---|
| `APIFY_TOKEN` | 예 | Apify API 토큰 (인스타그램 수집, 틱톡 보조 수집) |
| `APIFY_IG_ACTOR` | 아니오 | 기본 `apify~instagram-scraper` |
| `APIFY_TT_ACTOR` | 아니오 | 기본 `clockworks~tiktok-scraper` |
| `FIREBASE_PROJECT_ID` | 아니오 | 기본 `ringcoms-campaign` |
| `GEMINI_API_KEY` | 가이드·검수에 필요 | Google AI Studio API 키 (프로젝트 「Gemini API」, 무료 등급) |
| `GEMINI_MODEL` | 아니오 | 기본 `gemini-flash-latest` → 붐비거나 없으면 `gemini-2.5-flash` → `gemini-flash-lite-latest` |
| `GITHUB_TOKEN` | 업데이트 제안에 필요 | fine-grained 토큰, 이 저장소만 · Contents 읽기·쓰기 |

## 성과 불러오기 동작
- 유튜브: 브라우저에서 YouTube Data API 직접 호출 (키는 팀원 관리 → 연동 설정)
- 틱톡: 서버 함수가 공개 페이지를 읽음 → 실패 시 Apify
- 인스타그램: 서버 함수가 Apify 실행 → 30초~1분 뒤 결과 반영 (조회수·좋아요·댓글·썸네일)
- 서버 함수는 로그인한 팀원(마스터·매니저)만 호출 가능 (Firestore 보안 규칙으로 확인)
- 게시자 계정이 진행관리의 계정 ID와 다르면 반영하지 않고 결과 창에 표시

## 링크 자동 채우기
- **채널 링크**(직접 입력·엑셀 업로드): 링크 모양으로 채널·계정 ID를 바로 채우고, 이어서 팔로워/구독자·카테고리를 불러옴. 진행관리의 「채널 정보 불러오기」로 다시 불러올 수 있음(선택한 행만 가능).
  - 인스타그램: `/api/social-stats` `action: profile` → Apify `instagram-scraper`(resultsType: details)
  - 틱톡: 공개 프로필 페이지를 바로 읽고, 실패하면 Apify `tiktok-scraper`(profiles)
  - 유튜브: 브라우저에서 YouTube Data API `channels`(구독자·주제) — YouTube 키 필요
  - 팔로워·계정 ID는 새 값으로 덮어쓰고, 카테고리·이름은 비어 있을 때만 채움(카테고리는 플랫폼 카테고리·주제·소개글 키워드로 추정)
- **콘텐츠 링크**: 링크 모양으로 콘텐츠 유형을 맞춤(인스타 /reel/ → 릴스, /p/ → 피드, 유튜브 /shorts/ → 쇼츠 등). 인스타그램 /p/ 링크는 「성과 불러오기」 때 실제 게시물 형식으로 릴스·피드를 다시 맞춤.

## 링크 트래킹 (인플루언서별 전용 링크)
- 캠페인 → 「링크 트래킹」 탭에서 방식을 고른다: **브릿지 페이지**(버튼 최대 8개 — 웹 페이지 / 앱 다운로드) 또는 **바로 이동**(원링크·웹 주소 1개)
- 「인플루언서별 링크 생성」을 누르면 진행관리의 인플루언서마다 `https://ad.ringcoms.com/l/{6자리 코드}` 링크가 만들어진다 (`links/{코드}`)
- 방문·버튼 클릭은 `linkstat/{코드}_{슬롯}`에 +1로 쌓인다 (슬롯: `v` 방문, `c` 버튼을 누른 방문자, 버튼 id). 같은 브라우저 재방문은 고유 수에 넣지 않고, 링크 미리보기 수집기·`?preview=1`은 세지 않는다
- 「광고주 분석 도구용 구분값」을 켜면 이동 주소에 `utm_*`(또는 AppsFlyer `af_sub1`, Adjust `label`)이 붙어, 앱 설치·가입·구매는 광고주 GA4·MMP에서 인플루언서별로 확인한다. Google Play 주소는 `referrer`로 전달
- 설정을 바꾸고 「저장하고 모든 링크에 반영」을 누르면 이미 나간 링크의 화면·이동 주소도 바뀐다 (링크 주소는 그대로)
- 성과 리포트·광고주 공유 리포트에 「링크 트래킹 성과」가 들어간다 (탭에서 광고주 리포트 포함 여부 선택). 「클릭 수를 성과 지표에 반영」은 진행관리 「클릭」 칸을 채워 CTR·CPC 계산에 쓴다
- 일별·기기 집계는 `linkday/{캠페인id}_{YYYYMMDD}` (방문 v·고유 u·버튼 클릭 c·ios/aos/pc). 「링크 분석 대시보드」(반응 퍼널·일별 추이·기기·상위 인플루언서)와 광고주 리포트 「전환 트래킹 성과」에 쓰인다. 광고주 공유 탭 「전환 트래킹 성과 공개」로 노출 선택(링크를 만든 캠페인은 기본 공개)
- 보안 규칙(`links`, `linkstat`, `linkday`)이 추가되었으므로 `firestore.rules`를 Firebase 콘솔에 게시해야 동작한다

## 리포트 PDF
- PDF 다운로드는 PPT와 같은 슬라이드 구성(16:9, 한 장씩)으로 그려 인쇄 창을 엶 — 인쇄 창에서 「PDF로 저장」.

## 도메인
`ad.ringcoms.com` → Netlify (카페24 DNS CNAME `ad` → `cheery-conkies-713ddb.netlify.app`). 기존 주소도 계속 열림.
도메인을 바꾸면 Firebase 승인된 도메인, YouTube API 키 웹사이트 제한에도 추가해야 합니다.

## 캠페인 종류
- 시딩 / 체험단(무상협찬) / 공동구매 / 라이브커머스 — `campaigns.kind` = `seed`·`trial`·`gb`·`live`
- 공동구매·라이브: 단계 `컨택→…→정산완료`, 공구 기간·판매 링크·공구 코드 / 방송 일시·플랫폼·시청자, 주문(`conv`)·판매 수량(`qty`)·매출(`rev`), 판매수수료율(행 > 캠페인 기본값) → 판매수수료·정산액·ROAS 자동 계산
- 일정이 지나면 단계 자동 이동(판매중·판매종료·방송완료), 진행관리 「정산서 엑셀」

## 광고주 계정 (클라이언트)
- `accounts/{id}` 광고주 계정, `admins/{email}.acct`·`role`(`client`·`clientAdmin`) — 초대한 Google 계정만 로그인
- 캠페인 `acct`가 광고주 계정이면 `cview/{캠페인id}`(비용·연락처·주소 제외 진행 현황)가 만들어지고, 클라이언트 컨펌은 `cconfirm/{캠페인id}`
- `managed: 'ringcoms'` = 링컴즈 운영 캠페인(클라이언트 관리자는 보기·컨펌만), 빈 값 = 광고주가 직접 운영
- 데모: `?demo=1&as=client` / `?demo=1&as=clientAdmin`

## 업데이트 관리
- Claude 정기 실행(매주 일요일 09:47 KST)이 `ops` 브랜치의 `ops/suggestions.json`에 다음 주 제안을 쓰고, 그 주에 마스터가 「업데이트 진행」으로 승인한 항목을 한 번에 적용·테스트 후 `main`에 배포 1회, `public/changelog.json`에 기록 (승인 항목이 없으면 배포 없음)
- 업데이트 진행·보류·제외·삭제는 마스터만(체크박스로 건별 선택 가능), 요청 남기기는 마스터·매니저
- `netlify.toml`의 `ignore` 설정으로 `main` 이외 브랜치(work·ops)는 빌드하지 않음
- 사이트는 `/api/ops`로 읽고 승인 (`GITHUB_TOKEN` 필요)

## 주소
- 화면마다 주소(`#/c/캠페인id/report` 등)가 있어 브라우저 뒤로 가기로 직전 화면으로 돌아감

## 롤백 (안정 버전으로 되돌리기)
- 안정 버전 저장: 브랜치 `stable-v0.12` (2026-10-07 배포본, 커밋 69e0395). 버전을 올려 안정이 확인되면 `stable-vX.YY` 브랜치를 새로 만듦
- 가장 빠른 방법: Netlify → Deploys → 안정 버전 배포(10/7 「업데이트 이력 v0.12 커밋 기록」)를 열고 **Publish deploy** (새 빌드 없이 즉시 되돌림)
- 코드까지 되돌리기: `git revert`로 문제 커밋을 되돌려 main에 푸시 (강제 푸시 금지). `stable-v0.12`와 비교: `git diff stable-v0.12 main`
- Firestore 규칙 되돌리기: 콘솔 → Firestore → 규칙 → 기록(History)에서 이전 버전 선택, 또는 `git show stable-v0.12:firestore.rules` 내용을 붙여넣고 게시

## 콘텐츠 가이드 (도구 → 콘텐츠 가이드)
- 표준 구성(첨부 가이드 3종 공통 구조): 표지 → 이것만 꼭 지켜 주세요(핵심 메시지·✅/❌) → 제품 정보(특징·사용법·주의) → 컨셉 고르기(1~4개, 택 1) → 컨셉별 장면 가이드(인트로·바디·아웃트로: 찍는 법·예시 멘트·자막·포인트·참고 영상·장면 이미지) → 꼭 찍어야 할 컷 + 마무리 핵심 메시지 → 문구·해시태그·바른 표기 → 이렇게 말하면 안 돼요 → 촬영·업로드 주의사항 → 제출 방법·일정 → E.O.D
- 광고주 홈페이지·상품 링크(최대 3개)와 붙여넣은 상품 정보로 AI가 빈 칸을 채움 (「빈 칸 채우기」 / 「새로 만들기」). 스마트스토어처럼 스크립트로만 그려지는 페이지는 상품 정보를 붙여넣기
- PPT(Pretendard, 우상단 가로형 로고, 가이드 색 = 광고주 톤) · PDF(인쇄 창 → PDF로 저장) 다운로드
- 데이터: `guides/{id}`, 장면 이미지 `guideimg/{id}` (가이드당 약 1MB까지)

## 장면 이미지 · Canva
- 지금(반자동): 장면의 「Canva로 만들기」 → 이미지 프롬프트 복사 + Canva 열림 → Canva AI(Magic Media)로 만들고 다운로드 → 「이미지 넣기」
- 완전 자동 연동 검토 결과 (나중에 추가할 때):
  - Canva Connect API로 가능한 것: 브랜드 템플릿 자동 채우기(autofill)로 디자인 만들기, 이미지 업로드, PNG·PDF 내보내기 → 장면 텍스트·이미지를 넣은 가이드 디자인을 자동 생성 가능
  - 조건: Canva Pro·Teams·Enterprise 계정 + 2단계 인증, Canva 개발자 포털에서 통합(Integration) 생성·OAuth 연결, 범위 `design:content`·`design:meta`·`brandtemplate:meta/content`·`asset`
  - 한계: AI 이미지 생성 API는 공개돼 있지 않음 → 장면 이미지 자동 생성은 Gemini/Imagen 등 이미지 생성 API로 만들고 Canva에는 업로드·배치만 맡기는 구조가 현실적
  - 추가 작업: Netlify 환경변수 `CANVA_CLIENT_ID`·`CANVA_CLIENT_SECRET`, 서버 함수 `/api/canva`(OAuth 토큰 보관·autofill·export), 가이드 화면 「Canva 디자인으로 만들기」 버튼

## 영상 검수 (도구 → 영상 검수)
- 기준 가이드·컨셉 선택 → 영상 링크 → 「검수 시작」 → 1~5분 뒤 결과 (점수·판정·수정 요청 표·장면 구성 비교·체크리스트·나레이션/자막 받아쓰기·인플루언서에게 보낼 메시지)
- 지원 링크: 유튜브(공개), 구글 드라이브(「링크가 있는 모든 사용자」), 영상 파일 주소, 인스타그램·틱톡 게시물(Apify 사용) · 1GB 이하 (8MB씩 나눠 올려 서버 메모리를 거의 쓰지 않음)
- 업로드 전 초안은 구글 드라이브 링크로 받는 것을 권장. 캡션·해시태그는 영상만으로 확인할 수 없어 판정하지 않음
- 데이터: `reviews/{id}` (진행 상태·결과 JSON)

## AI 영상 제작 (틀만 구축)
- 가이드·컨셉을 고르면 장면별 영상 프롬프트를 만들어 복사 가능. 실제 생성 버튼은 연동 전 비활성
- 연동 시: 서비스(Veo·Runway·Kling) 결정 → API 키 → Netlify 환경변수 `AI_VIDEO_PROVIDER`·키 → `/api/ai`의 `video` 동작 구현 → 생성 영상 저장소(Firebase Storage는 Blaze 요금제)

