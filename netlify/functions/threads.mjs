// RINGCOMS 캠페인 관리 · Threads(스레드) 계정 연동·게시 (로그인한 팀원별)
// POST /api/threads { action, ... }  (로그인 토큰 필요, 마스터·매니저만)
//   config     → { ready, appId }                       화면이 연결 창(threads.net/oauth/authorize)을 여는 데 씀
//   exchange   → { code, redirect } → 장기 토큰(60일)으로 바꿔 threads/{내 이메일}에 저장 → { username }
//   status     → { connected, username, pic, exp }      (토큰은 화면에 내보내지 않음)
//   post       → { text, replyTo } → 글 1개 게시 → { id, permalink }   (이어 쓰기는 replyTo로 하나씩)
// 토큰은 Firestore threads/{이메일} 에 그 팀원의 로그인 권한으로 저장 (보안 규칙: 본인만 읽고 씀)
// 환경변수: THREADS_APP_ID, THREADS_APP_SECRET (Meta 개발자 앱 → Threads API 사용 사례)
import { checkEditor, fsPatch, json, PROJECT } from '../lib/gemini.mjs';

const APP_ID = process.env.THREADS_APP_ID || '';
const SECRET = process.env.THREADS_APP_SECRET || '';
const G = 'https://graph.threads.net';
const V = G + '/v1.0';

async function tj(r) { const j = await r.json().catch(() => ({})); if (!r.ok || j.error) { const m = (j.error && (j.error.error_user_msg || j.error.message)) || j.error_message || ('Threads 오류 ' + r.status); const e = new Error(String(m).slice(0, 300)); e.code = j.error && j.error.code; throw e; } return j; }
const docUrl = (email) => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/threads/${encodeURIComponent(email)}`;
async function readMine(who) {
  const r = await fetch(docUrl(who.email), { headers: { authorization: 'Bearer ' + who.tok } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status === 403 ? '스레드 연결 정보를 읽을 권한이 없습니다. Firestore 보안 규칙을 새로 게시해 주세요.' : '스레드 연결 정보를 읽지 못했습니다 (' + r.status + ').');
  const d = await r.json(); const f = d.fields || {}; const o = {};
  for (const k in f) o[k] = f[k].stringValue ?? f[k].integerValue ?? '';
  return o;
}
const okRedirect = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)ringcoms\.com$|\.netlify\.app$/.test(x.hostname) && x.pathname === '/threads-callback.html'; } catch (e) { return false; } };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 가능합니다.' }, 405);
  const who = await checkEditor(req);
  if (!who.ok) return json({ error: who.error }, who.status);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const action = String(b.action || '');
  try {
    if (action === 'config') return json({ ready: !!(APP_ID && SECRET), appId: APP_ID });
    if (!APP_ID || !SECRET) return json({ error: 'Threads 앱이 아직 연결되지 않았습니다. Netlify 환경변수 THREADS_APP_ID·THREADS_APP_SECRET을 넣어 주세요.' }, 400);

    if (action === 'exchange') {
      const code = String(b.code || '').replace(/#_$/, '').trim();
      const redirect = String(b.redirect || '');
      if (!code || !okRedirect(redirect)) return json({ error: '연결 정보가 올바르지 않습니다. 다시 시도해 주세요.' }, 400);
      const form = new URLSearchParams({ client_id: APP_ID, client_secret: SECRET, grant_type: 'authorization_code', redirect_uri: redirect, code });
      const s = await tj(await fetch(G + '/oauth/access_token', { method: 'POST', body: form }));
      const l = await tj(await fetch(`${G}/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(SECRET)}&access_token=${encodeURIComponent(s.access_token)}`));
      const me = await tj(await fetch(`${V}/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(l.access_token)}`));
      const exp = new Date(Date.now() + (+l.expires_in || 5184000) * 1000).toISOString();
      await fsPatch(who.tok, 'threads/' + who.email, { token: l.access_token, uid: me.id || s.user_id || '', username: me.username || '', pic: me.threads_profile_picture_url || '', exp, at: new Date().toISOString(), email: who.email });
      return json({ ok: true, username: me.username || '', exp });
    }

    const mine = await readMine(who);
    if (action === 'status') {
      if (!mine || !mine.token) return json({ connected: false });
      return json({ connected: true, username: mine.username || '', pic: mine.pic || '', exp: mine.exp || '' });
    }
    if (!mine || !mine.token) return json({ error: '스레드 계정이 연결되어 있지 않습니다. 「스레드 계정 연결」을 먼저 해 주세요.' }, 400);
    let tok = mine.token;
    if (mine.exp && new Date(mine.exp).getTime() < Date.now()) return json({ error: '스레드 연결이 만료되었습니다(60일). 「다시 연결」을 눌러 주세요.', expired: true }, 400);
    // 만료 20일 전부터는 게시할 때 자동으로 60일 연장 (발급 후 24시간이 지나야 연장 가능)
    if (mine.exp && new Date(mine.exp).getTime() - Date.now() < 20 * 864e5) {
      try { const r = await tj(await fetch(`${G}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(tok)}`)); tok = r.access_token; await fsPatch(who.tok, 'threads/' + who.email, { token: tok, exp: new Date(Date.now() + (+r.expires_in || 5184000) * 1000).toISOString() }); } catch (e) { console.warn('refresh', e.message); }
    }

    if (action === 'post') {
      const text = String(b.text || '').trim();
      if (!text) return json({ error: '게시할 글이 비어 있습니다.' }, 400);
      if ([...text].length > 500) return json({ error: `스레드 글은 500자까지입니다 (지금 ${[...text].length}자). 글을 줄이거나 이어 쓰기로 나눠 주세요.` }, 400);
      const uidT = mine.uid || 'me';
      const p = new URLSearchParams({ media_type: 'TEXT', text, access_token: tok });
      if (b.replyTo) p.set('reply_to_id', String(b.replyTo).replace(/[^0-9_]/g, ''));
      const c = await tj(await fetch(`${V}/${uidT}/threads`, { method: 'POST', body: p }));
      // 글은 보통 바로 준비되지만, 준비 중이면 최대 약 8초 기다림
      for (let i = 0; i < 4; i++) {
        const st = await tj(await fetch(`${V}/${c.id}?fields=status,error_message&access_token=${encodeURIComponent(tok)}`)).catch(() => ({}));
        if (!st.status || st.status === 'FINISHED') break;
        if (st.status === 'ERROR' || st.status === 'EXPIRED') throw new Error('스레드가 글을 받지 못했습니다: ' + (st.error_message || st.status));
        await new Promise(r => setTimeout(r, 2000));
      }
      const pub = await tj(await fetch(`${V}/${uidT}/threads_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: tok }) }));
      let permalink = '';
      try { permalink = (await tj(await fetch(`${V}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(tok)}`))).permalink || ''; } catch (e) {}
      return json({ ok: true, id: pub.id, permalink, username: mine.username || '' });
    }
    return json({ error: '알 수 없는 요청입니다.' }, 400);
  } catch (e) {
    console.error(action, e);
    const m = String(e.message || e);
    const hint = e.code === 190 || /token|session/i.test(m) ? ' — 스레드 연결이 끊겼을 수 있습니다. 「다시 연결」을 눌러 주세요.' : '';
    return json({ error: m + hint }, 400);
  }
};

export const config = { path: '/api/threads' };
