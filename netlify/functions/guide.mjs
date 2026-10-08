// RINGCOMS 캠페인 관리 · 콘텐츠 가이드 AI 작성 (백그라운드 함수, 최대 15분)
// POST /api/guide  { gid, job, links, memo, base } → 바로 202 응답
// 결과는 Firestore guides/{gid} 에: aiStatus(진행 중 → 완료 | 실패), aiResult(JSON 문자열), aiError
// 화면(편집 권한 있는 사람)이 결과를 받아 가이드에 합친 뒤 aiStatus를 「적용됨」으로 바꿈
import { gemini, checkEditor, fsPatch } from '../lib/gemini.mjs';
import { readPage, guidePrompt } from '../lib/guide.mjs';

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) { return; }
  const gid = String(body.gid || '').replace(/[^A-Za-z0-9_-]/g, '');
  const job = String(body.job || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!gid || !job) return;
  const who = await checkEditor(req);
  if (!who.ok) return;
  const save = (o) => fsPatch(who.tok, 'guides/' + gid, { aiJob: job, ...o }).catch(e => console.error('save', e.message));
  try {
    const links = (Array.isArray(body.links) ? body.links : []).map(String).filter(u => /^https?:\/\//i.test(u)).slice(0, 3);
    const memo = String(body.memo || '');
    const pages = await Promise.all(links.map(readPage));
    if (!pages.some(p => p.ok) && !memo.trim()) throw new Error('링크 내용을 읽지 못했습니다. 상품 정보를 직접 붙여넣어 주세요.');
    const { data, model } = await gemini([{ text: guidePrompt(pages, memo, body.base || {}) }], { temperature: 0.6, maxTokens: 16000, timeoutMs: 180000, thinking: 1024 });
    await save({ aiStatus: '완료', aiResult: JSON.stringify({ guide: data, model, pages: pages.map(p => ({ url: p.url, ok: p.ok, error: p.error || '' })) }), aiDoneAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    await save({ aiStatus: '실패', aiError: String(e.message || e).slice(0, 400) });
  }
};

export const config = { path: '/api/guide', background: true };
