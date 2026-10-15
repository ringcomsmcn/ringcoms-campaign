// RINGCOMS 캠페인 관리 · Meta 인스타그램 API 연동 관리 (권한 관리 → 연동 관리)
// POST /api/meta { action, ... }  (로그인 토큰 필요)
//   status → 저장된 연결 정보 (토큰은 앞뒤 몇 글자만) + 실제 연결 확인          · 마스터·매니저
//   save   → { token, igId? } 저장 전에 Meta에 실제로 조회해 보고, 되면 secrets/meta 에 저장 · 마스터만
//   clear  → 사이트에 저장한 토큰 삭제 (Netlify 환경변수 META_IG_TOKEN이 있으면 그걸로 돌아감)   · 마스터만
// 저장 위치: Firestore secrets/meta — 보안 규칙상 마스터만 쓰고, 마스터·매니저만 읽음 (뷰어·광고주는 읽을 수 없음)
//           서버 함수는 호출한 팀원의 로그인 토큰으로 읽으므로 별도 서비스 계정이 필요 없습니다.
// 새 토큰을 발급받으면 여기서 붙여넣기만 하면 바로 적용됩니다 (재배포 불필요).
import { checkEditor, json, PROJECT } from '../lib/gemini.mjs';
import { useMetaCred, withMetaToken, metaStatus, metaTokenInfo, readMetaSecret, metaSrc, SECRET_DOC } from '../lib/meta.mjs';

const DOC = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${SECRET_DOC}`;
const mask = t => { t = String(t || ''); return t.length > 12 ? t.slice(0, 6) + '…' + t.slice(-4) : t ? '…' + t.slice(-2) : ''; };

async function writeDoc(tok, obj) {
  const fields = {}; for (const k in obj) fields[k] = { stringValue: String(obj[k] ?? '') };
  const r = await fetch(DOC, { method: 'PATCH', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(r.status === 403 ? '저장 권한이 없습니다. Firestore 보안 규칙(secrets)을 새로 게시했는지, 마스터 계정인지 확인해 주세요.' : '저장하지 못했습니다 (' + r.status + ').');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 가능합니다.' }, 405);
  const who = await checkEditor(req);
  if (!who.ok) return json({ error: who.error }, who.status);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const action = String(b.action || 'status');
  try {
    if (action === 'status') {
      const s = await readMetaSecret(who.tok);
      await useMetaCred(who.tok);
      const st = await metaStatus();
      const info = st.configured ? await metaTokenInfo() : null;
      return json({ ...st, src: metaSrc(), saved: s && s.token ? { mask: mask(s.token), igId: s.igId || '', account: s.account || '', by: s.by || '', at: s.at || '' } : null, envToken: !!process.env.META_IG_TOKEN, info });
    }
    if (who.role !== 'master') return json({ error: '토큰 연결·변경은 마스터만 할 수 있습니다.' }, 403);
    if (action === 'save') {
      const token = String(b.token || '').trim().replace(/^Bearer\s+/i, '');
      const igIdIn = String(b.igId || '').trim();
      if (token.length < 20) return json({ error: '토큰을 붙여넣어 주세요.' }, 400);
      if (/^IGAA/.test(token)) return json({ error: '인스타그램 로그인 토큰(IGAA…)은 쓸 수 없습니다. 비즈니스 설정 → 시스템 사용자에서 발급한 토큰(EAA…)을 넣어 주세요.' }, 400);
      if (igIdIn && !/^\d{6,25}$/.test(igIdIn)) return json({ error: '인스타그램 계정 ID는 숫자만 넣어 주세요 (17841로 시작).' }, 400);
      const test = await withMetaToken(token, igIdIn, async () => ({ st: await metaStatus(), info: await metaTokenInfo() }));
      if (!test.st.ok) return json({ error: '이 토큰으로 인스타그램 계정을 조회하지 못했습니다. ' + (test.st.error || '') }, 400);
      const at = new Date().toISOString();
      await writeDoc(who.tok, { token, igId: test.st.igId || igIdIn, account: test.st.account || '', by: who.email, at, expires: (test.info && test.info.expires) || '', scopes: ((test.info && test.info.scopes) || []).join(',') });
      return json({ ok: true, account: test.st.account || '', igId: test.st.igId || '', mask: mask(token), info: test.info, at });
    }
    if (action === 'clear') {
      const r = await fetch(DOC, { method: 'DELETE', headers: { authorization: 'Bearer ' + who.tok } });
      if (!r.ok && r.status !== 404) throw new Error('삭제하지 못했습니다 (' + r.status + ').');
      return json({ ok: true, envToken: !!process.env.META_IG_TOKEN });
    }
    return json({ error: '알 수 없는 요청입니다.' }, 400);
  } catch (e) { return json({ error: e.message || String(e) }, 500); }
};

export const config = { path: '/api/meta' };
