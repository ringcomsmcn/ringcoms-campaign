// RINGCOMS 캠페인 관리 · 모두싸인 API 연동 (인플루언서 계약 관리 2단계)
// POST /api/modusign { action, ... }  (로그인 토큰 필요, 마스터·매니저만 · 키 저장·삭제는 마스터만)
//   status    → 저장된 연결 정보(키는 가림) + 실제 연결 확인 + 템플릿 목록
//   save      → { email, key, limit?, until? } 모두싸인에 실제로 조회해 보고 secrets/modusign 에 저장 (마스터)
//   clear     → 저장한 키 삭제 (마스터)
//   templates → 템플릿 목록 (id · 제목 · 서명자 역할 · 요청자 입력 라벨)
//   send      → { templateId, title, participants:[{role,name,type,value}], inputs:[{dataLabel,value}], meta:{cid,rid} }
//               템플릿으로 서명 요청 (모두싸인 API 서명 1건 사용) → { id, status }
//   sync      → { ids:[문서 ID…] } 문서 상태·서명자 상태·완료 파일 주소 조회 (사용량 없음)
//   remind    → { id } 서명 요청 알림 다시 보내기
// 인증: Authorization: Basic base64("모두싸인 계정 이메일:API KEY") · https://api.modusign.co.kr
// 키는 Firestore secrets/modusign 에 저장 (보안 규칙: 마스터만 쓰고 마스터·매니저만 읽음). 서버 함수는 호출한 팀원의 로그인 토큰으로 읽습니다.
import { checkEditor, json, PROJECT } from '../lib/gemini.mjs';

const API = 'https://api.modusign.co.kr';
const DOC = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/secrets/modusign`;
const mask = t => { t = String(t || ''); return t.length > 10 ? t.slice(0, 4) + '…' + t.slice(-4) : t ? '…' + t.slice(-2) : ''; };

async function readSecret(tok) {
  const r = await fetch(DOC, { headers: { authorization: 'Bearer ' + tok } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status === 403 ? '모두싸인 연결 정보를 읽을 권한이 없습니다 (마스터·매니저만).' : '모두싸인 연결 정보를 읽지 못했습니다 (' + r.status + ').');
  const f = ((await r.json()).fields) || {}; const o = {};
  for (const k in f) o[k] = f[k].stringValue ?? f[k].integerValue ?? '';
  return o;
}
async function writeSecret(tok, obj) {
  const fields = {}; for (const k in obj) fields[k] = { stringValue: String(obj[k] ?? '') };
  const r = await fetch(DOC, { method: 'PATCH', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(r.status === 403 ? '저장 권한이 없습니다. 마스터 계정인지 확인해 주세요.' : '저장하지 못했습니다 (' + r.status + ').');
}
const authOf = (email, key) => 'Basic ' + Buffer.from(`${email}:${key}`, 'utf8').toString('base64');

async function ms(cred, method, path, body) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  let r;
  try {
    r = await fetch(API + path, { method, headers: { accept: 'application/json', authorization: authOf(cred.email, cred.key), ...(body ? { 'content-type': 'application/json; charset=utf-8' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
  } catch (e) { throw new Error('모두싸인 서버에 연결하지 못했습니다.'); }
  finally { clearTimeout(t); }
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = { raw: txt.slice(0, 300) }; }
  if (!r.ok) {
    const m = (j && (j.message || j.title || (j.error && (j.error.message || j.error)))) || ('HTTP ' + r.status);
    const e = new Error(r.status === 401 ? '모두싸인 인증 실패 — 이메일 또는 API Key를 확인해 주세요 (키 만료 여부 포함).' : r.status === 403 ? '모두싸인 권한이 없습니다: ' + m : r.status === 429 ? '모두싸인 호출 한도에 걸렸습니다. 잠시 뒤 다시 시도해 주세요.' : '모두싸인 오류: ' + String(m).slice(0, 200));
    e.status = r.status; throw e;
  }
  return j || {};
}
/* 응답 모양이 조금 달라도 읽을 수 있게 */
const arr = (j, ...keys) => { for (const k of keys) if (Array.isArray(j && j[k])) return j[k]; return Array.isArray(j) ? j : []; };
function findUrl(o, depth = 0) { if (!o || depth > 5) return ''; if (typeof o === 'object') { for (const k of Object.keys(o)) { if (/download.?url|fileurl|^url$/i.test(k) && typeof o[k] === 'string' && /^https?:/.test(o[k])) return o[k]; } for (const k of Object.keys(o)) { const u = findUrl(o[k], depth + 1); if (u) return u; } } return ''; }
function mapTemplate(t) {
  const roles = arr(t, 'participants', 'participantRoles').map(p => ({ role: p.role || p.name || '', order: p.signingOrder ?? p.order ?? null })).filter(p => p.role);
  const inputs = arr(t, 'requesterInputs', 'requesterInputFields').map(x => x.dataLabel || x.label || '').filter(Boolean);
  return { id: t.id, title: t.title || t.name || '(제목 없음)', roles, inputs, updatedAt: t.updatedAt || t.createdAt || '' };
}
function mapDoc(d) {
  const ps = arr(d, 'participants').map(p => ({ id: p.id || '', name: p.name || '', role: p.role || '', status: p.status || p.signingStatus || '', signedAt: p.signedAt || p.signingCompletedAt || '', method: (p.signingMethod && p.signingMethod.type) || '' }));
  return { id: d.id, title: d.title || '', status: d.status || '', createdAt: d.createdAt || '', updatedAt: d.updatedAt || '', completedAt: d.completedAt || (d.status === 'COMPLETED' ? (d.updatedAt || '') : ''), participants: ps, file: findUrl(d.file || d.signedFile || {}) || '' };
}
async function templates(cred) {
  const j = await ms(cred, 'GET', '/templates?offset=0&limit=100');
  return arr(j, 'templates', 'items', 'data').map(mapTemplate);
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 가능합니다.' }, 405);
  const who = await checkEditor(req);
  if (!who.ok) return json({ error: who.error }, who.status);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const action = String(b.action || 'status');
  try {
    if (action === 'save' || action === 'clear') {
      if (who.role !== 'master') return json({ error: '모두싸인 API Key 연결·변경은 마스터만 할 수 있습니다.' }, 403);
      if (action === 'clear') { const r = await fetch(DOC, { method: 'DELETE', headers: { authorization: 'Bearer ' + who.tok } }); if (!r.ok && r.status !== 404) throw new Error('삭제하지 못했습니다 (' + r.status + ').'); return json({ ok: true }); }
      const email = String(b.email || '').trim(), key = String(b.key || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: '모두싸인에 로그인하는 계정 이메일을 넣어 주세요.' }, 400);
      if (key.length < 10) return json({ error: 'API Key를 붙여넣어 주세요.' }, 400);
      const cred = { email, key };
      const list = await ms(cred, 'GET', '/documents?offset=0&limit=1');   // 실제 인증 확인 (사용량 없음)
      let tps = []; try { tps = await templates(cred); } catch (e) {}
      const at = new Date().toISOString();
      await writeSecret(who.tok, { email, key, by: who.email, at, limit: String(+b.limit || 30), until: String(b.until || ''), docCount: String(list.count ?? '') });
      return json({ ok: true, email, mask: mask(key), templates: tps, at });
    }
    const s = await readSecret(who.tok);
    if (!s || !s.key) return json(action === 'status' ? { configured: false } : { error: '모두싸인 API Key가 연결되지 않았습니다. 권한 관리 → 연동 관리에서 마스터가 연결해 주세요.' }, action === 'status' ? 200 : 400);
    const cred = { email: s.email, key: s.key };
    if (action === 'status') {
      let ok = true, err = '', tps = [], count = null;
      try { const j = await ms(cred, 'GET', '/documents?offset=0&limit=1'); count = j.count ?? null; tps = await templates(cred).catch(() => []); } catch (e) { ok = false; err = e.message; }
      return json({ configured: true, ok, error: err, email: s.email, mask: mask(s.key), by: s.by || '', at: s.at || '', limit: +s.limit || 30, until: s.until || '', templates: tps, docCount: count });
    }
    if (action === 'templates') return json({ templates: await templates(cred) });
    if (action === 'send') {
      const templateId = String(b.templateId || ''); const title = String(b.title || '').slice(0, 200);
      const ps = (Array.isArray(b.participants) ? b.participants : []).slice(0, 10).map(p => ({ role: String(p.role || ''), name: String(p.name || '').slice(0, 60), signingMethod: { type: ['EMAIL', 'KAKAO', 'SECURE_LINK'].includes(p.type) ? p.type : 'EMAIL', value: String(p.value || '').trim() } }));
      if (!templateId || !title || !ps.length) return json({ error: '템플릿 · 문서 제목 · 서명자를 확인해 주세요.' }, 400);
      if (ps.some(p => !p.role || !p.name || (p.signingMethod.type !== 'SECURE_LINK' && !p.signingMethod.value))) return json({ error: '서명자의 역할 · 이름 · 이메일(또는 휴대폰 번호)을 모두 채워 주세요.' }, 400);
      ps.forEach(p => { if (p.signingMethod.type === 'KAKAO') p.signingMethod.value = p.signingMethod.value.replace(/[^0-9]/g, ''); if (p.signingMethod.type === 'SECURE_LINK') delete p.signingMethod.value; });
      const inputs = (Array.isArray(b.inputs) ? b.inputs : []).filter(x => x && x.dataLabel && x.value != null && String(x.value).trim() !== '').slice(0, 50).map(x => ({ dataLabel: String(x.dataLabel), value: String(x.value).slice(0, 500) }));
      const meta = b.meta || {};
      const body = { templateId, document: { title, participantMappings: ps, ...(inputs.length ? { requesterInputMappings: inputs } : {}), metadatas: [{ key: 'source', value: 'ad.ringcoms.com' }, ...(meta.cid ? [{ key: 'cid', value: String(meta.cid) }] : []), ...(meta.rid ? [{ key: 'rid', value: String(meta.rid) }] : [])] } };
      let d;
      try { d = await ms(cred, 'POST', '/documents/request-with-template', body); }
      catch (e) { if (e.status === 400 && /metadata/i.test(e.message)) { delete body.document.metadatas; d = await ms(cred, 'POST', '/documents/request-with-template', body); } else throw e; }
      return json({ ok: true, doc: mapDoc(d) });
    }
    if (action === 'sync') {
      const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(String).filter(x => /^[A-Za-z0-9_-]{6,80}$/.test(x)))].slice(0, 40);
      const out = {}, errors = {};
      await Promise.all(ids.map(async id => { try { out[id] = mapDoc(await ms(cred, 'GET', '/documents/' + encodeURIComponent(id))); } catch (e) { errors[id] = e.message; } }));
      return json({ docs: out, errors });
    }
    if (action === 'remind') {
      const id = String(b.id || ''); if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return json({ error: '문서 ID가 올바르지 않습니다.' }, 400);
      await ms(cred, 'POST', '/documents/' + encodeURIComponent(id) + '/remind-signing');
      return json({ ok: true });
    }
    return json({ error: '알 수 없는 요청입니다.' }, 400);
  } catch (e) { return json({ error: e.message || String(e) }, e.status && e.status < 500 ? 400 : 500); }
};

export const config = { path: '/api/modusign' };
