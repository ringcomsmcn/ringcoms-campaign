# RINGCOMS 캠페인 관리 (광고콘텐츠팀)

인플루언서 캠페인(시딩·체험단·공동구매·라이브커머스) 진행관리, 성과 리포트, 광고주 공유, 광고주 계정(클라이언트)을 위한 사이트입니다.

## 구성
| 경로 | 내용 |
|---|---|
| `public/index.html` | 사이트 전체 (화면·로직). Firebase(로그인·데이터)와 연결 |
| `netlify/functions/social-stats.mjs` | 인스타그램·틱톡 성과·게시일·썸네일 수집 서버 함수 (`/api/social-stats`) |
| `netlify/functions/ops.mjs` | 업데이트 제안 읽기·승인 서버 함수 (`/api/ops`, GitHub `ops` 브랜치의 `ops/suggestions.json`) |
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
- 업데이트 진행·보류·제외는 마스터만, 요청 남기기는 마스터·매니저
- `netlify.toml`의 `ignore` 설정으로 `main` 이외 브랜치(work·ops)는 빌드하지 않음
- 사이트는 `/api/ops`로 읽고 승인 (`GITHUB_TOKEN` 필요)

## 주소
- 화면마다 주소(`#/c/캠페인id/report` 등)가 있어 브라우저 뒤로 가기로 직전 화면으로 돌아감

## 롤백 (안정 버전으로 되돌리기)
- 안정 버전 저장: 브랜치 `stable-v0.12` (2026-10-07 배포본, 커밋 69e0395). 버전을 올려 안정이 확인되면 `stable-vX.YY` 브랜치를 새로 만듦
- 가장 빠른 방법: Netlify → Deploys → 안정 버전 배포(10/7 「업데이트 이력 v0.12 커밋 기록」)를 열고 **Publish deploy** (새 빌드 없이 즉시 되돌림)
- 코드까지 되돌리기: `git revert`로 문제 커밋을 되돌려 main에 푸시 (강제 푸시 금지). `stable-v0.12`와 비교: `git diff stable-v0.12 main`
- Firestore 규칙 되돌리기: 콘솔 → Firestore → 규칙 → 기록(History)에서 이전 버전 선택, 또는 `git show stable-v0.12:firestore.rules` 내용을 붙여넣고 게시
