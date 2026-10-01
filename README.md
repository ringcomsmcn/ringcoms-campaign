# RINGCOMS 캠페인 관리 (광고콘텐츠팀)

인플루언서 캠페인(시딩·체험단) 진행관리, 성과 리포트, 광고주 공유를 위한 사이트입니다.

## 구성
| 경로 | 내용 |
|---|---|
| `public/index.html` | 사이트 전체 (화면·로직). Firebase(로그인·데이터)와 연결 |
| `netlify/functions/social-stats.mjs` | 인스타그램·틱톡 성과 수집 서버 함수 (`/api/social-stats`) |
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
