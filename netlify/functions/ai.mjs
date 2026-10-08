// RINGCOMS 캠페인 관리 · AI 서버 함수 (콘텐츠 가이드)
// POST /api/ai
//   { action: 'status' }                                  → Gemini 키 설정 여부 (팀원)
//   { action: 'guide', links: [...], memo, base }         → (짧은 요청용) 가이드 초안 바로 받기 — 화면은 시간이 오래 걸려 /api/guide(백그라운드)를 씀
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
  if (body.action === 'video') return json({ error: 'AI 영상 생성 서비스가 아직 연결되지 않았습니다. (비용 결정 후 연동)' }, 501);
  return json({ error: '알 수 없는 요청입니다.' }, 400);
};

export const config = { path: '/api/ai' };
