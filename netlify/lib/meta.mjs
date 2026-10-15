// RINGCOMS 캠페인 관리 · Meta 인스타그램 공식 API (Business Discovery)
// 링컴즈 인스타그램 프로페셔널 계정으로 다른 비즈니스·크리에이터 계정의 공개 데이터를 조회합니다 (무료).
//   - 프로필: 팔로워·게시물 수·소개글·프로필 사진
//   - 게시물: 조회·좋아요·댓글·게시일·릴스/피드 구분·썸네일·영상 주소
// 개인 계정·비공개 계정·연령 제한 계정은 조회되지 않아 → 호출한 쪽에서 Apify로 대체합니다.
// 토큰: ① 사이트 「연동 관리」에서 마스터가 넣은 토큰 (Firestore secrets/meta — 마스터만 쓰고 마스터·매니저만 읽음, 재배포 불필요)
//       ② 없으면 Netlify 환경변수 META_IG_TOKEN (예전 방식, 그대로 동작)
// 환경변수: META_IG_TOKEN (시스템 사용자 토큰 권장 — 만료 없음),
//           META_IG_USER_ID (선택 — 비우면 토큰에 연결된 페이지의 인스타그램 비즈니스 계정을 자동으로 찾음),
//           META_GRAPH_VERSION (선택, 기본 v24.0)
// 이 파일은 netlify/functions 의 함수들이 import 하는 공용 모듈입니다 (단독 배포되지 않음).

const VER = process.env.META_GRAPH_VERSION || 'v24.0';
import { PROJECT } from './gemini.mjs';
/* 이번 요청에서 쓸 토큰 (useMetaCred로 사이트 저장 토큰을 읽어 둠) */
let CRED = null; // { token, igId, src: 'site' | 'env' }
const TOKEN = () => (CRED && CRED.token) || process.env.META_IG_TOKEN || '';
const IGID = () => (CRED && CRED.token ? CRED.igId || '' : process.env.META_IG_USER_ID || '');
export const metaOn = () => !!TOKEN();
export const metaSrc = () => (CRED && CRED.token ? 'site' : process.env.META_IG_TOKEN ? 'env' : '');
export const SECRET_DOC = 'secrets/meta';
/* 사이트에 저장한 토큰 읽기 — 호출한 팀원의 로그인 토큰으로 읽으므로 보안 규칙(마스터·매니저만)이 그대로 적용됨 */
export async function readMetaSecret(tok) {
  if (!tok) return null;
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${SECRET_DOC}`, { headers: { authorization: 'Bearer ' + tok } });
    if (!r.ok) return null;
    const f = ((await r.json()).fields) || {}; const o = {};
    for (const k in f) o[k] = f[k].stringValue ?? '';
    return o;
  } catch (e) { return null; }
}
export async function useMetaCred(tok) {
  const s = await readMetaSecret(tok);
  const next = s && s.token ? { token: s.token, igId: s.igId || '', src: 'site' } : null;
  if ((next && next.token) !== (CRED && CRED.token)) cachedId = null; // 토큰이 바뀌면 계정 ID를 다시 찾음
  CRED = next; return metaSrc();
}
/* 저장 전 검사용: 잠깐 다른 토큰으로 바꿔 실행 */
export async function withMetaToken(token, igIdIn, fn) {
  const prev = CRED, prevId = cachedId; CRED = { token, igId: igIdIn || '', src: 'test' }; cachedId = null;
  try { return await fn(); } finally { CRED = prev; cachedId = prevId; }
}

const MEDIA_FIELDS = 'id,permalink,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,comments_count,view_count';
const MAX_PAGES = 4;   // 계정당 최근 게시물 최대 4페이지(약 200개)까지 찾아봄
const PAGE = 50;

const num = v => (v == null || v === '' || !isFinite(+v) || +v < 0) ? null : Math.round(+v);
export const codeOfPermalink = u => (String(u || '').match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i) || [])[1] || null;
export const handleOf = s => { const m = String(s || '').trim().replace(/^@/, '').match(/^[A-Za-z0-9._]{1,30}$/); return m ? m[0].toLowerCase() : null; };

/* 오류 종류: TOKEN(토큰 문제 → 전체 중단), RATE(호출 한도 → 이번엔 Apify로), NOT_FOUND(개인·비공개 계정 → 그 계정만 Apify로) */
export class MetaError extends Error { constructor(kind, msg) { super(msg); this.kind = kind; } }
function classify(err, status) {
  const e = err || {}; const code = +e.code, sub = +e.error_subcode; const msg = String(e.message || ('HTTP ' + status));
  if (code === 190 || code === 102 || code === 10 || code === 200 || (code >= 200 && code < 300)) return new MetaError('TOKEN', 'Meta 토큰·권한 오류: ' + msg);
  if ([4, 17, 32, 613, 80002].includes(code)) return new MetaError('RATE', 'Meta 호출 한도에 걸렸습니다. 이번에는 Apify로 대신 수집합니다.');
  if (code === 100 && /nonexist(ing|ent) field|Unknown field|Syntax error/i.test(msg)) return new MetaError('OTHER', 'Meta 요청 형식 오류: ' + msg.slice(0, 160));
  if (code === 110 || code === 100 || sub === 2207013) return new MetaError('NOT_FOUND', '프로페셔널(비즈니스·크리에이터) 계정이 아니거나 찾을 수 없는 계정입니다.');
  return new MetaError('OTHER', 'Meta 응답 오류: ' + msg.slice(0, 160));
}

async function graph(path, params = {}) {
  const q = new URLSearchParams({ ...params, access_token: TOKEN() });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  let r;
  try { r = await fetch(`https://graph.facebook.com/${VER}/${path}?${q}`, { signal: ctl.signal }); }
  catch (e) { throw new MetaError('OTHER', 'Meta 서버에 연결하지 못했습니다.'); }
  finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw classify(d.error, r.status);
  return d;
}
/* 조회에 쓸 링컴즈 인스타그램 계정 ID: 환경변수 → 없으면 토큰의 페이지에서 찾기 (함수 인스턴스 동안 기억) */
let cachedId = null;
async function igId() {
  if (IGID()) return { id: IGID(), username: '' };
  if (cachedId) return cachedId;
  let d, first = null;
  try { d = await graph('me/accounts', { fields: 'name,instagram_business_account{id,username}', limit: '100' }); }
  catch (e) { first = e; }
  let hit = d ? (d.data || []).map(p => p.instagram_business_account).find(x => x && x.id) : null;
  /* 페이지 토큰이면 me 자체가 페이지 → 연결된 인스타그램 계정을 바로 읽음 */
  if (!hit) { try { const me = await graph('me', { fields: 'instagram_business_account{id,username}' }); if (me.instagram_business_account && me.instagram_business_account.id) hit = me.instagram_business_account; } catch (e) { /* 무시 */ } }
  if (!hit && first) throw new MetaError('TOKEN', '토큰으로 페이지 목록을 읽지 못했습니다 (' + first.message + '). 해결: ① 연동 관리 「Meta 인스타그램」의 「인스타그램 계정 ID」 칸(또는 Netlify 환경변수 META_IG_USER_ID)에 링컴즈 인스타그램 비즈니스 계정 ID(17841로 시작하는 숫자)를 넣으면 이 단계를 건너뜁니다. ② 또는 비즈니스 설정 → 시스템 사용자에 페이스북 페이지·인스타그램 계정을 자산으로 할당하고 pages_show_list·instagram_basic·business_management 권한으로 토큰을 다시 발급하세요. (인스타그램 로그인 토큰 IGAA…는 이 방식에 쓸 수 없습니다)');
  if (!hit) throw new MetaError('TOKEN', '토큰에 연결된 인스타그램 비즈니스 계정을 찾지 못했습니다. 시스템 사용자에 페이스북 페이지·인스타그램 계정이 할당되어 있는지, 토큰 권한에 pages_show_list가 있는지 확인해 주세요.');
  cachedId = { id: hit.id, username: hit.username || '' };
  return cachedId;
}
export const metaIgId = () => igId();
const bd = async (user, inner) => graph((await igId()).id, { fields: `business_discovery.username(${user}){${inner}}` }).then(d => d.business_discovery || {});

/* 토큰 정보: 종류·만료·권한 (같은 토큰으로 debug_token 조회 — 실패해도 무시) */
export async function metaTokenInfo() {
  try { const d = (await graph('debug_token', { input_token: TOKEN() })).data || {}; return { type: d.type || '', expires: d.expires_at ? (d.expires_at > 0 ? new Date(d.expires_at * 1000).toISOString() : 'never') : 'never', scopes: d.scopes || [], app: d.application || '' }; }
  catch (e) { return null; }
}
/* 연결 확인 (연결 현황 화면용) */
export async function metaStatus() {
  if (!metaOn()) return { configured: false };
  try { const me = await igId(); const d = await graph(me.id, { fields: 'username,name' }); return { configured: true, ok: true, account: d.username || me.username || '', igId: me.id, auto: !IGID(), src: metaSrc() }; }
  catch (e) { return { configured: true, ok: false, error: e.message, kind: e.kind, src: metaSrc() }; }
}

/* 게시물 하나를 사이트 형식으로 */
export function mapMetaMedia(m, owner) {
  const code = codeOfPermalink(m.permalink);
  const likes = num(m.like_count);
  const video = m.media_type === 'VIDEO' || m.media_product_type === 'REELS';
  return {
    key: 'ig:' + code, owner: owner || null,
    views: num(m.view_count), likes, cmts: num(m.comments_count), shares: null, saves: null,
    thumbUrl: m.thumbnail_url || (!video ? m.media_url : null) || null, videoUrl: video ? (m.media_url || null) : null,
    likesHidden: likes == null, kind: video ? 'reel' : 'feed', posted: m.timestamp ? new Date(m.timestamp).toISOString() : null
  };
}

/* 프로필 */
export async function metaProfile(user) {
  const u = handleOf(user); if (!u) throw new MetaError('NOT_FOUND', '계정명 형식이 아닙니다.');
  const p = await bd(u, 'username,name,biography,followers_count,media_count,profile_picture_url');
  return { key: 'igp:' + String(p.username || u).toLowerCase(), acct: p.username || u, name: p.name || '', bio: p.biography || '', followers: num(p.followers_count), category: '', private: false, avatar: p.profile_picture_url || '' };
}

/* 한 계정의 게시물 중 원하는 shortcode들 찾기 → { code: 결과 } (못 찾은 코드는 빠짐) */
export async function metaPosts(user, codes) {
  const u = handleOf(user); if (!u) throw new MetaError('NOT_FOUND', '계정명 형식이 아닙니다.');
  const want = new Set(codes.filter(Boolean)); const found = {};
  let after = '';
  for (let i = 0; i < MAX_PAGES && want.size; i++) {
    const edge = `media${after ? `.after(${after})` : ''}.limit(${PAGE}){${MEDIA_FIELDS}}`;
    const p = await bd(u, `username,${edge}`);
    const media = p.media || {}; const list = media.data || [];
    for (const m of list) { const r = mapMetaMedia(m, p.username || u); const c = r.key.slice(3); if (want.has(c)) { found[c] = r; want.delete(c); } }
    after = (media.paging && media.paging.cursors && media.paging.cursors.after) || '';
    if (!after || !list.length) break;
  }
  return found;
}
