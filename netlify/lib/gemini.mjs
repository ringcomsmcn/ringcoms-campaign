// RINGCOMS 캠페인 관리 · AI 공통 (Gemini 호출·로그인 확인·Firestore 기록)
// 이 파일은 netlify/functions 의 함수들이 import 하는 공용 모듈입니다 (함수 폴더 밖이라 단독 배포되지 않음).
// 환경변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택 — 비우면 아래 순서로 시도)

export const PROJECT = process.env.FIREBASE_PROJECT_ID || 'ringcoms-campaign';
export const GKEY = process.env.GEMINI_API_KEY || '';
const API = 'https://generativelanguage.googleapis.com';
export const MODELS = [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'].filter(Boolean))];
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/* 호출한 사람이 링컴즈 팀원(마스터·매니저)인지: 그 사람의 로그인 토큰으로 Firestore 팀원 문서를 읽어 봄 (보안 규칙이 판정) */
export async function checkEditor(req) {
  const h = req.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok) return { ok: false, status: 401, error: '로그인이 필요합니다.' };
  let email = '';
  try { email = String(JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).email || '').toLowerCase(); } catch (e) {}
  if (!email) return { ok: false, status: 401, error: '로그인 정보를 확인할 수 없습니다.' };
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/admins/${encodeURIComponent(email)}`, { headers: { authorization: 'Bearer ' + tok } });
  if (!r.ok) return { ok: false, status: 403, error: '팀원만 사용할 수 있습니다.' };
  const d = await r.json().catch(() => ({}));
  const role = (((d.fields || {}).role || {}).stringValue) || 'viewer';
  const acct = (((d.fields || {}).acct || {}).stringValue) || 'ringcoms';
  if (!(acct === 'ringcoms' && ['master', 'manager'].includes(role))) return { ok: false, status: 403, error: '마스터·매니저만 사용할 수 있습니다.' };
  return { ok: true, email, role, tok };
}

/* Firestore 문서 일부 수정 (호출한 사람의 토큰으로 → 보안 규칙 그대로 적용) */
export async function fsPatch(tok, path, obj) {
  const keys = Object.keys(obj);
  const fields = {};
  keys.forEach(k => { fields[k] = { stringValue: String(obj[k] ?? '') }; });
  const q = keys.map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}?${q}`, {
    method: 'PATCH', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ fields })
  });
  if (!r.ok) throw new Error('결과 저장 실패 (' + r.status + ')');
}

/* 응답 글자에서 JSON 꺼내기 (```json 감싸기 대비) */
export function parseJsonText(t) {
  const s = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error('AI 응답을 읽지 못했습니다.');
}

/* Gemini generateContent — 모델이 없으면(404) 다음 모델로 */
export async function gemini(parts, { temperature = 0.4, maxTokens = 8192, timeoutMs = 50000, thinking = null, totalMs = 0 } = {}) {
  const end = totalMs ? Date.now() + totalMs : 0;
  if (!GKEY) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. Netlify 환경변수에 추가해 주세요.');
  let last = null;
  for (const m of MODELS) {
    const left = end ? end - Date.now() : timeoutMs; if (left < 4000) break;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Math.min(timeoutMs, left));
    let r;
    try {
      r = await fetch(`${API}/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': GKEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json', ...(thinking != null && /2\.5/.test(m) ? { thinkingConfig: { thinkingBudget: thinking } } : {}) } })
      });
    } catch (e) { clearTimeout(t); last = new Error(e.name === 'AbortError' ? 'AI 응답 시간이 초과되었습니다.' : 'AI 서버에 연결하지 못했습니다.'); continue; }
    clearTimeout(t);
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 || (r.status === 400 && /model/i.test(JSON.stringify(j.error || '')) && /not (found|supported)/i.test(JSON.stringify(j.error || '')))) { last = new Error('모델 없음: ' + m); continue; }
    if (!r.ok) {
      const msg = (j.error && j.error.message) || ('AI 오류 ' + r.status);
      if (r.status === 503 || r.status === 500 || /high demand|overloaded|UNAVAILABLE/i.test(msg)) { last = new Error('AI 서버가 잠시 붐빕니다. 잠시 후 다시 시도해 주세요.'); continue; }
      if (r.status === 429) throw new Error('AI 무료 사용량을 초과했습니다. 잠시 후 다시 시도해 주세요. (' + msg.slice(0, 120) + ')');
      if (r.status === 400 && /API key/i.test(msg)) throw new Error('Gemini API 키가 올바르지 않습니다. Netlify 환경변수 GEMINI_API_KEY를 확인해 주세요.');
      throw new Error(msg.slice(0, 300));
    }
    const cand = (j.candidates || [])[0] || {};
    const text = ((cand.content || {}).parts || []).map(p => p.text || '').join('');
    if (!text) throw new Error('AI가 답을 주지 않았습니다' + (cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.');
    return { data: parseJsonText(text), model: m };
  }
  throw last || new Error('사용 가능한 Gemini 모델이 없습니다.');
}

/* Files API: 영상 올리기 → ACTIVE까지 기다림 */
export async function uploadFile(buf, mime, name) {
  const st = await fetch(`${API}/upload/v1beta/files`, {
    method: 'POST',
    headers: { 'x-goog-api-key': GKEY, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(buf.length), 'X-Goog-Upload-Header-Content-Type': mime, 'content-type': 'application/json' },
    body: JSON.stringify({ file: { display_name: name || 'review-video' } })
  });
  const url = st.headers.get('x-goog-upload-url');
  if (!st.ok || !url) throw new Error('영상을 AI에 올리지 못했습니다 (' + st.status + ').');
  const up = await fetch(url, { method: 'POST', headers: { 'Content-Length': String(buf.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: buf });
  const uj = await up.json().catch(() => ({}));
  const f = uj.file || {};
  if (!f.name) throw new Error('영상을 AI에 올리지 못했습니다.');
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`${API}/v1beta/${f.name}`, { headers: { 'x-goog-api-key': GKEY } });
    const j = await r.json().catch(() => ({}));
    if (j.state === 'ACTIVE') return { name: f.name, uri: j.uri || f.uri, mime: j.mimeType || mime };
    if (j.state === 'FAILED') throw new Error('AI가 영상을 처리하지 못했습니다.');
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('영상 처리 시간이 너무 오래 걸립니다.');
}
export async function deleteFile(name) { try { await fetch(`${API}/v1beta/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': GKEY } }); } catch (e) {} }
