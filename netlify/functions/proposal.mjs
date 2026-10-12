// RINGCOMS 캠페인 관리 · 광고 제안서 AI 작성 (백그라운드 함수, 최대 15분)
// POST /api/proposal  { pid, job, info, plan } → 바로 202 응답
// ① 구글 검색 근거로 시장 조사 → ② 소개서·기초 정보·조사 메모로 제안서 문구(JSON)
// 결과는 Firestore guides/{pid} (kind: proposal) 에: aiStatus(진행 중 → 완료 | 실패), aiResult(JSON 문자열), aiError
// 화면(편집 권한 있는 사람)이 결과를 받아 제안서에 넣고 aiStatus를 「적용됨」으로 바꿈
import { gemini, checkEditor, fsPatch } from '../lib/gemini.mjs';
import { readPage } from '../lib/guide.mjs';
import { research, proposalPrompt } from '../lib/proposal.mjs';

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) { return; }
  const pid = String(body.pid || '').replace(/[^A-Za-z0-9_-]/g, '');
  const job = String(body.job || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!pid || !job) return;
  const who = await checkEditor(req);
  if (!who.ok) return;
  const save = (o) => fsPatch(who.tok, 'guides/' + pid, { aiJob: job, ...o }).catch(e => console.error('save', e.message));
  try {
    const info = body.info || {};
    const plan = body.plan || {};
    const links = (Array.isArray(info.links) ? info.links : []).map(String).filter(u => /^https?:\/\//i.test(u)).slice(0, 3);
    const [pages, rs] = await Promise.all([Promise.all(links.map(readPage)), research(info)]);
    if (!String(info.srcText || '').trim() && !pages.some(p => p.ok) && !String(info.memo || '').trim()) throw new Error('상품소개서 내용을 읽지 못했습니다. PDF를 다시 올리거나 소개 문구를 붙여넣어 주세요.');
    await save({ aiStep: '문구 작성 중' });
    const { data, model } = await gemini([{ text: proposalPrompt(info, plan, pages, rs) }], { temperature: 0.7, maxTokens: 24000, timeoutMs: 240000, thinking: 2048 });
    await save({ aiStatus: '완료', aiStep: '', aiResult: JSON.stringify({ ai: data, model, research: { ok: !!rs.text, sources: rs.sources || [], error: rs.error || '' }, pages: pages.map(p => ({ url: p.url, ok: p.ok, error: p.error || '' })) }), aiDoneAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    await save({ aiStatus: '실패', aiStep: '', aiError: String(e.message || e).slice(0, 400) });
  }
};

export const config = { path: '/api/proposal', background: true };
