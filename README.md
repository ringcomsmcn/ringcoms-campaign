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

## 도메인
`ad.ringcoms.com` → Netlify (DNS: 카페24에서 CNAME `ad` → `<사이트>.netlify.app`)
도메인을 바꾸면 Firebase 승인된 도메인, YouTube API 키 웹사이트 제한에도 추가해야 합니다.
