// RINGCOMS 캠페인 관리 · 인플루언서 모집 AI 작성 (백그라운드 함수, 최대 15분)
// POST /api/recruit  { rid, job, links, src: { memo, srcText }, conf, ctx } → 바로 202 응답
// 결과는 Firestore recruits/{rid} 에: aiStatus(진행 중 → 완료 | 실패), aiResult(JSON 문자열), aiError
// 화면(편집 권한 있는 사람)이 결과를 받아 게시물·폼 문항에 넣고 aiStatus를 「적용됨」으로 바꿈
import { gemini, checkEditor, fsPatch } from '../lib/gemini.mjs';
import { readPage } from '../lib/guide.mjs';
import { recruitPrompt } from '../lib/recruit.mjs';

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) { return; }
  const rid = String(body.rid || '').replace(/[^A-Za-z0-9_-]/g, '');
  const job = String(body.job || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!rid || !job) return;
  const who = await checkEditor(req);
  if (!who.ok) return;
  const save = (o) => fsPatch(who.tok, 'recruits/' + rid, { aiJob: job, ...o }).catch(e => console.error('save', e.message));
  try {
    const links = (Array.isArray(body.links) ? body.links : []).map(String).filter(u => /^https?:\/\//i.test(u)).slice(0, 4);
    const src = body.src || {};
    const pages = await Promise.all(links.map(readPage));
    if (!pages.some(p => p.ok) && !String(src.memo || '').trim() && !String(src.srcText || '').trim()) throw new Error('링크 내용을 읽지 못했습니다. 상품소개서를 올리거나 상품 정보를 메모에 붙여넣어 주세요.');
    const { data, model } = await gemini([{ text: recruitPrompt(src, body.conf || {}, pages, body.ctx || {}) }], { temperature: 0.7, maxTokens: 8192, timeoutMs: 150000, thinking: 1024 });
    await save({ aiStatus: '완료', aiResult: JSON.stringify({ ai: data, model, pages: pages.map(p => ({ url: p.url, ok: p.ok, error: p.error || '' })) }), aiDoneAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    await save({ aiStatus: '실패', aiError: String(e.message || e).slice(0, 400) });
  }
};

export const config = { path: '/api/recruit', background: true };
