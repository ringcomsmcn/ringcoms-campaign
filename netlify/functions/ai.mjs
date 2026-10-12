// RINGCOMS 캠페인 관리 · AI 서버 함수 (콘텐츠 가이드)
// POST /api/ai
//   { action: 'status' }                                  → Gemini 키 설정 여부 (팀원)
//   { action: 'guide', links: [...], memo, base }         → (짧은 요청용) 가이드 초안 바로 받기 — 화면은 시간이 오래 걸려 /api/guide(백그라운드)를 씀
//   { action: 'insight', lang: 'ko'|'en', data } → 성과 리포트 「인사이트 및 제안」 초안 (리포트 수치 기반 3~5문장)
//   { action: 'video' }                                   → AI 영상 생성 자리 (연동 전 — 501)
// 환경변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택)
import { json, gemini, GKEY, MODELS, checkEditor } from '../lib/gemini.mjs';
import { readPage, guidePrompt } from '../lib/guide.mjs';

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
  if (body.action === 'insight') {
    const d = body.data || {};
    if (!d.T) return json({ error: '리포트 수치가 없습니다.' }, 400);
    const en = body.lang === 'en';
    try {
      const { data, model } = await gemini([{ text: insightPrompt(d, en) }], { temperature: 0.5, maxTokens: 2048, timeoutMs: 24000, thinking: 256, totalMs: 26000 });
      return json({ text: String((data && data.text) || '').trim(), model });
    } catch (e) { return json({ error: String(e.message || e) }, 502); }
  }
  if (body.action === 'video') return json({ error: 'AI 영상 생성 서비스가 아직 연결되지 않았습니다. (비용 결정 후 연동)' }, 501);
  return json({ error: '알 수 없는 요청입니다.' }, 400);
};

export const config = { path: '/api/ai' };

/* 인사이트 코멘트 초안: 화면에서 계산한 리포트 수치(이미 단위가 붙은 값)만 근거로 씀 */
function insightPrompt(d, en) {
  return `너는 한국 MCN 링컴즈(RINGCOMS) 광고콘텐츠팀의 인플루언서 캠페인 리포트 작성자다.
아래 [리포트 수치]만 근거로, 광고주에게 보내는 성과 리포트 하단 「${en ? 'Insights & Recommendations' : '인사이트 및 제안'}」 코멘트 초안을 쓴다.

[규칙]
- ${en ? 'Write in natural business English.' : '한국어 존댓말(~습니다/~입니다)로 쓴다.'} 3~5문장, 한 문장에 한 가지 내용.
- 순서: ① 전체 성과 요약(목표 대비 달성률이 있으면 먼저) ② 잘된 점 — 성과가 좋은 티어·채널·그룹·상위 콘텐츠를 숫자로 근거 제시 ③ 다음 캠페인 제안 1~2가지(구체적 실행: 어떤 티어·형식 비중을 늘릴지, 2차 활용 등).
- 수치는 [리포트 수치]에 있는 값만 그대로 쓴다. 없는 수치·비교 기준(업계 평균 등)을 지어내지 않는다. 비율·단가는 적힌 표기 그대로.
- 인플루언서 이름은 names가 true일 때만 쓴다. 과장(폭발적, 역대급 등)·확정 단정(매출이 오를 것) 금지.
- 각 문장 끝에서 줄을 바꾼다(문장마다 \n).

[리포트 수치]
${JSON.stringify(d).slice(0, 12000)}

JSON으로만 답한다: {"text": "코멘트 본문"}`;
}
