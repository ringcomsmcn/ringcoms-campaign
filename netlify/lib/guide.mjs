// 콘텐츠 가이드 AI 공용: 광고주 페이지 읽기 · 가이드 프롬프트
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* 링크 1개 읽기: 제목·설명·본문 글자 (최대 12,000자) */
export async function readPage(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('bad');
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(u.href, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' } });
    clearTimeout(t);
    if (!r.ok) return { url, ok: false, error: 'HTTP ' + r.status };
    const html = (await r.text()).slice(0, 1500000);
    const meta = (n) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']*)`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${n}["']`, 'i')); return m ? m[1] : ''; };
    const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || meta('og:title') || '').trim();
    const desc = meta('og:description') || meta('description');
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 12000);
    const ok = (text.length + desc.length) > 200;
    return { url, ok, title, desc, text, error: ok ? '' : '페이지 내용을 읽지 못했습니다 (스크립트로만 그려지는 페이지)' };
  } catch (e) { return { url, ok: false, error: e.name === 'AbortError' ? '응답 시간 초과' : '열 수 없는 주소' }; }
}

const SCHEMA = `{
 "advertiser": "광고주(회사)명",
 "brand": "브랜드명",
 "summary": { "one": "핵심 메시지 한 줄 (20자 안팎)", "must": ["꼭 해 주세요 (5~6개)"], "dont": ["하지 말아 주세요 (3~5개)"] },
 "product": { "name": "제품명", "price": "정가 (예: 275,000원, 모르면 빈 문자열)", "sale": "판매가·할인", "option": "옵션·사이즈·용량", "intro": "한 줄 소개",
   "points": [{ "t": "핵심 특징 제목 (12자 안팎)", "d": "쉬운 설명 1~2문장" }], "howto": ["사용 방법 순서"], "caution": "사용·촬영 시 주의 (전후 비교 조건 등)" },
 "concepts": [{ "name": "컨셉 이름 (예: 3초 화잘먹 루틴)", "hook": "첫 마디 후킹 문구",
   "scenes": [{ "part": "인트로|바디|아웃트로", "time": "0~3초", "shot": "이렇게 찍어요 (구체적 행동·앵글)", "say": "예시 멘트 (인플루언서 말투, 1~3문장)", "sub": "화면 자막 (짧게)", "point": "강조 포인트", "prompt": "이 장면을 그림으로 설명한 이미지 프롬프트 (한국어, 인물·배경·구도·조명)" }] }],
 "cuts": [{ "name": "꼭 찍어야 할 컷 이름 (썸네일·인트로(후킹)·사용 장면·사용 전후 비교·아웃트로 등)", "desc": "이렇게 찍어요 (1문장)", "need": "필수|권장|선택" }],
 "text": { "keywords": ["본문·자막·멘트 필수 키워드"], "closing": "아웃트로 마무리 핵심 메시지 한 문장", "tagsMust": ["#필수해시태그"], "tagsRec": ["#권장해시태그"], "account": "@공식계정 (모르면 빈 문자열)", "brandName": "브랜드 바른 표기 (예: 포즈닉 (Pozenic))", "productName": "제품 바른 표기", "ngNames": ["틀린 표기 예시"] },
 "words": [{ "no": "쓰면 안 되는 표현", "yes": "이렇게 바꿔 말해요" }],
 "shoot": ["촬영할 때 주의사항 (이 제품에 맞게, 한 줄에 한 가지)"],
 "upload": ["업로드할 때 주의사항 (한 줄에 한 가지)"],
 "submitHow": ["제출·진행 순서 (STEP 순서대로, 예: 가이드 보고 촬영 → 초안 보내기 → 검수 → 승인 후 업로드 → 링크 전달)"]
}`;

export function guidePrompt(pages, memo, base) {
  const L = base.level === 'light';
  const n = Math.min(4, Math.max(1, +base.conceptN || (L ? 1 : 2)));
  return `너는 한국 MCN 링컴즈(RINGCOMS)의 인플루언서 광고 콘텐츠 가이드 작가다.
아래 광고주 정보로 인플루언서에게 보낼 「콘텐츠 가이드」 초안을 만든다.

[가장 중요한 원칙]
- 인플루언서는 가이드를 꼼꼼히 읽지 않는다. 초등학생도 이해할 만큼 쉽고 짧게, 한 문장에 한 가지만 쓴다.
- 「~해 주세요」「~해요」 같은 부드러운 존댓말. 전문용어·영어 약어는 풀어 쓴다.
- 장면 설명(shot)은 "무엇을, 어떤 앵글로" 바로 따라 할 수 있게 구체적으로 쓴다.
- 예시 멘트(say)는 실제 인플루언서가 말하듯 자연스러운 구어체로 쓴다.
- 광고주 정보에 없는 수치·효능을 지어내지 않는다. 의학적 효능 단정(치료·완치·살이 빠진다·100% 등)은 쓰지 않고 words에 바꿔 말하기를 넣는다.
- 공정위 지침: tagsMust 맨 앞은 반드시 "#협찬".

[구성 규칙 — 분량: ${L ? 'Light (인플루언서가 5장 안에 다 읽는 요약판)' : 'Detail (항목별로 자세히)'}]
- 채널·형식: ${base.platform || '인스타그램 릴스'} / 영상 길이: ${base.length || '30초 이내'}
- 컨셉은 정확히 ${n}개. ${n > 1 ? '서로 다른 소재(예: 고민 해결형, 비교형, 상황극형, 루틴형)로 만든다.' : ''}
- 컨셉마다 장면 ${L ? '3~4' : '4~5'}개: 인트로(0~3초 후킹) → 바디(제품 소개·사용·전후 비교) → 아웃트로(핵심 메시지·구매 유도). time은 영상 길이에 맞게 나눈다.${L ? ' 멘트(say)는 1~2문장으로 짧게.' : ''}
- summary.must ${L ? '4' : '5~6'}개: 이 제품에서 꼭 보여 줄 장면·꼭 말할 특징 ${L ? '2' : '3~4'}개 + 공통 2개(「#협찬은 본문 맨 앞에 넣어 주세요.」「업로드 전에 초안 영상을 먼저 보내 주세요.」). 같은 뜻의 문장을 두 번 쓰지 않는다.
- summary.dont ${L ? '3' : '3~5'}개: 이 제품 분야(예: 화장품·식품·기기)에 맞는 금지 사항만. 다른 분야 표현(화장품에 '살이 빠진다' 등)은 넣지 않는다. 같은 뜻 반복 금지.
- words(이렇게 말하면 안 돼요) ${L ? '3' : '4~6'}개: 이 제품 광고에서 실제로 나오기 쉬운 과장·효능 단정 표현 → 바꿔 말할 표현. summary.dont와 겹치지 않게 구체적인 말로.
- shoot(촬영 주의) ${L ? '4' : '6~8'}개: 9:16·화질, 밝기·흔들림, 보정 필터, 로고 좌우 반전, 다른 브랜드 노출, 저작권 음원 등 공통 규칙 + 이 제품만의 촬영 주의(전후 비교 조건 등).
- upload(업로드 주의) ${L ? '3' : '5~6'}개: 오타, #협찬 맨 앞, 댓글 창 열어 두기, 승인 후 업로드, 재판매 금지, 2차 활용 안내 등에서 이 캠페인에 맞는 것.
- submitHow(진행 순서) ${L ? '4' : '5'}단계: 짧은 문장으로.
- product.points는 ${L ? '3' : '3~5'}개, howto는 사용 순서 ${L ? '3' : '3~5'}단계.
- cuts는 ${L ? '3~4' : '4~6'}개 (썸네일·인트로(후킹)·사용 장면·전후 비교(해당 시)·아웃트로 등).
- keywords ${L ? '3~4' : '3~6'}개, tagsRec ${L ? '4~6' : '5~10'}개.
${base.brand ? `- 브랜드: ${base.brand}` : ''}${base.advertiser ? `\n- 광고주: ${base.advertiser}` : ''}${base.productName ? `\n- 제품: ${base.productName}` : ''}

[광고주 페이지]
${pages.filter(p => p.ok).map((p, i) => `--- 페이지 ${i + 1}: ${p.url}\n제목: ${p.title}\n설명: ${p.desc}\n${p.text}`).join('\n\n') || '(읽은 페이지 없음)'}

[담당자가 붙여넣은 상품 정보·요청사항]
${String(memo || '').slice(0, 8000) || '(없음)'}

아래 JSON 형식 그대로, JSON만 출력한다:
${SCHEMA}`;
}

