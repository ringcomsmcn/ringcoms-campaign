// RINGCOMS 캠페인 관리 · AI 서버 함수 (콘텐츠 가이드)
// POST /api/ai
//   { action: 'status' }                                  → Gemini 키 설정 여부 (팀원)
//   { action: 'guide', links: [...], memo, base }         → 광고주 링크·상품 정보로 표준 콘텐츠 가이드 초안(JSON) (마스터·매니저)
//   { action: 'video' }                                   → AI 영상 생성 자리 (연동 전 — 501)
// 환경변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택)
import { json, gemini, GKEY, MODELS, checkEditor } from '../lib/gemini.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* 링크 1개 읽기: 제목·설명·본문 글자 (최대 12,000자) */
async function readPage(url) {
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
 "summary": { "one": "핵심 메시지 한 줄 (20자 안팎)", "must": ["꼭 해 주세요 (3~6개, 한 줄에 한 가지)"], "dont": ["하지 말아 주세요 (2~5개)"] },
 "product": { "name": "제품명", "price": "정가 (예: 275,000원, 모르면 빈 문자열)", "sale": "판매가·할인", "option": "옵션·사이즈·용량", "intro": "한 줄 소개",
   "points": [{ "t": "핵심 특징 제목 (12자 안팎)", "d": "쉬운 설명 1~2문장" }], "howto": ["사용 방법 순서"], "caution": "사용·촬영 시 주의 (전후 비교 조건 등)" },
 "concepts": [{ "name": "컨셉 이름 (예: 3초 화잘먹 루틴)", "hook": "첫 마디 후킹 문구",
   "scenes": [{ "part": "인트로|바디|아웃트로", "time": "0~3초", "shot": "이렇게 찍어요 (구체적 행동·앵글)", "say": "예시 멘트 (인플루언서 말투, 1~3문장)", "sub": "화면 자막 (짧게)", "point": "강조 포인트", "prompt": "이 장면을 그림으로 설명한 이미지 프롬프트 (한국어, 인물·배경·구도·조명)" }] }],
 "cuts": [{ "name": "꼭 찍어야 할 컷 이름 (썸네일·인트로(후킹)·사용 장면·사용 전후 비교·아웃트로 등)", "desc": "이렇게 찍어요 (1문장)", "need": "필수|권장|선택" }],
 "text": { "keywords": ["본문·자막·멘트 필수 키워드"], "closing": "아웃트로 마무리 핵심 메시지 한 문장", "tagsMust": ["#필수해시태그"], "tagsRec": ["#권장해시태그"], "account": "@공식계정 (모르면 빈 문자열)", "brandName": "브랜드 바른 표기 (예: 포즈닉 (Pozenic))", "productName": "제품 바른 표기", "ngNames": ["틀린 표기 예시"] },
 "words": [{ "no": "쓰면 안 되는 표현", "yes": "이렇게 바꿔 말해요" }],
 "shootExtra": ["이 제품에만 해당하는 촬영 주의 (0~3개)"],
 "uploadExtra": ["이 제품에만 해당하는 업로드 주의 (0~2개)"]
}`;

function guidePrompt(pages, memo, base) {
  const n = Math.min(4, Math.max(1, +base.conceptN || 2));
  return `너는 한국 MCN 링컴즈(RINGCOMS)의 인플루언서 광고 콘텐츠 가이드 작가다.
아래 광고주 정보로 인플루언서에게 보낼 「콘텐츠 가이드」 초안을 만든다.

[가장 중요한 원칙]
- 인플루언서는 가이드를 꼼꼼히 읽지 않는다. 초등학생도 이해할 만큼 쉽고 짧게, 한 문장에 한 가지만 쓴다.
- 「~해 주세요」「~해요」 같은 부드러운 존댓말. 전문용어·영어 약어는 풀어 쓴다.
- 장면 설명(shot)은 "무엇을, 어떤 앵글로" 바로 따라 할 수 있게 구체적으로 쓴다.
- 예시 멘트(say)는 실제 인플루언서가 말하듯 자연스러운 구어체로 쓴다.
- 광고주 정보에 없는 수치·효능을 지어내지 않는다. 의학적 효능 단정(치료·완치·살이 빠진다·100% 등)은 쓰지 않고 words에 바꿔 말하기를 넣는다.
- 공정위 지침: tagsMust 맨 앞은 반드시 "#협찬".

[구성 규칙]
- 채널·형식: ${base.platform || '인스타그램 릴스'} / 영상 길이: ${base.length || '30초 이내'}
- 컨셉은 정확히 ${n}개. 서로 다른 소재(예: 고민 해결형, 비교형, 상황극형, 루틴형)로 만든다.
- 컨셉마다 장면 4~5개: 인트로(0~3초 후킹) → 바디 2~3개(제품 소개·사용·전후 비교) → 아웃트로(핵심 메시지·구매 유도). time은 영상 길이에 맞게 나눈다.
- product.points는 3~5개, howto는 사용 순서 3~5단계.
- cuts는 4~6개 (썸네일·인트로(후킹)·사용 장면·전후 비교(해당 시)·아웃트로 등).
- keywords 3~6개, tagsRec 5~10개.
${base.brand ? `- 브랜드: ${base.brand}` : ''}${base.advertiser ? `\n- 광고주: ${base.advertiser}` : ''}${base.productName ? `\n- 제품: ${base.productName}` : ''}

[광고주 페이지]
${pages.filter(p => p.ok).map((p, i) => `--- 페이지 ${i + 1}: ${p.url}\n제목: ${p.title}\n설명: ${p.desc}\n${p.text}`).join('\n\n') || '(읽은 페이지 없음)'}

[담당자가 붙여넣은 상품 정보·요청사항]
${String(memo || '').slice(0, 8000) || '(없음)'}

아래 JSON 형식 그대로, JSON만 출력한다:
${SCHEMA}`;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405);
  const body = await req.json().catch(() => ({}));
  const who = await checkEditor(req);
  if (body.action === 'status') {
    if (!who.ok && who.status === 401) return json({ error: who.error }, 401);
    return json({ gemini: !!GKEY, model: MODELS[0] || '', video: false });
  }
  if (!who.ok) return json({ error: who.error }, who.status);
  if (body.action === 'guide') {
    const links = (Array.isArray(body.links) ? body.links : []).map(String).filter(u => /^https?:\/\//i.test(u)).slice(0, 3);
    if (!links.length && !String(body.memo || '').trim()) return json({ error: '광고주 링크나 상품 정보를 넣어 주세요.' }, 400);
    try {
      const pages = await Promise.all(links.map(readPage));
      if (!pages.some(p => p.ok) && !String(body.memo || '').trim()) return json({ error: '링크 내용을 읽지 못했습니다. 상품 정보를 직접 붙여넣어 주세요.', pages: pages.map(p => ({ url: p.url, ok: false, error: p.error })) }, 422);
      const { data, model } = await gemini([{ text: guidePrompt(pages, body.memo, body.base || {}) }], { temperature: 0.6, maxTokens: 12000, timeoutMs: 46000, thinking: 512, totalMs: 50000 });
      return json({ guide: data, model, pages: pages.map(p => ({ url: p.url, ok: p.ok, title: p.title || '', error: p.error || '' })) });
    } catch (e) { return json({ error: String(e.message || e) }, 502); }
  }
  if (body.action === 'video') return json({ error: 'AI 영상 생성 서비스가 아직 연결되지 않았습니다. (비용 결정 후 연동)' }, 501);
  return json({ error: '알 수 없는 요청입니다.' }, 400);
};

export const config = { path: '/api/ai' };
