// RINGCOMS 캠페인 관리 · 광고 제안서 섭외 후보 탐색 (백그라운드 함수, 최대 15분)
// POST /api/discover  { pid, job, groups: [{ key, terms: [...] }], platforms: ['tt','ig'] } → 바로 202 응답
// 틱톡: Apify clockworks~tiktok-scraper 키워드 검색(영상) → 작성자별 조회 중앙값·참여율
// 인스타그램: Apify apify~instagram-scraper 사용자 검색(details) → 팔로워·최근 게시물 조회 중앙값
// 결과는 Firestore guides/{pid} 에: discStatus(진행 중 → 완료 | 실패), discResult(JSON 문자열), discError
// 유튜브는 브라우저에서 YouTube Data API 키로 탐색 (키가 사이트 주소로 제한되어 있어 서버에서 못 씀)
import { checkEditor, fsPatch } from '../lib/gemini.mjs';

const APIFY = 'https://api.apify.com/v2';
const IG_ACTOR = process.env.APIFY_IG_ACTOR || 'apify~instagram-scraper';
const TT_ACTOR = process.env.APIFY_TT_ACTOR || 'clockworks~tiktok-scraper';
const HANGUL = /[가-힣]/;
const num = v => (v == null || v === '' || !isFinite(+v)) ? null : +v;
const med = a => { const x = a.filter(v => v != null && isFinite(v)).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };

async function apify(path, opts = {}) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('Apify 토큰이 설정되지 않았습니다 (Netlify 환경변수 APIFY_TOKEN).');
  const r = await fetch(APIFY + path, { ...opts, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const m = (d.error && (d.error.message || d.error.type)) || ('HTTP ' + r.status); throw new Error(/monthly usage|usage limit|credit|payment|plan.*exceed/i.test(m) ? 'Apify 이번 달 무료 사용량을 다 썼습니다.' : /memory/i.test(m) ? 'Apify 동시 실행 메모리 한도 (잠시 뒤 다시 탐색해 주세요)' : m.slice(0, 160)); }
  return d;
}
async function run(actor, input, maxMs = 420000) {
  const st = (await apify(`/acts/${actor}/runs?memory=1024`, { method: 'POST', body: JSON.stringify(input) })).data;
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    await new Promise(r => setTimeout(r, 8000));
    const r = (await apify(`/actor-runs/${encodeURIComponent(st.id)}`)).data;
    if (['READY', 'RUNNING'].includes(r.status)) continue;
    if (r.status !== 'SUCCEEDED') throw new Error('수집 실패 (' + r.status + ')');
    const items = await apify(`/datasets/${r.defaultDatasetId}/items?clean=true&format=json&limit=200`);
    return Array.isArray(items) ? items : [];
  }
  try { await apify(`/actor-runs/${encodeURIComponent(st.id)}/abort`, { method: 'POST' }); } catch (e) {}
  throw new Error('수집 시간 초과');
}

/* 틱톡: 키워드 영상 검색 → 작성자별로 묶기 */
async function tiktok(terms) {
  const items = await run(TT_ACTOR, { searchQueries: terms.slice(0, 2), resultsPerPage: 25, searchSection: '', excludePinnedPosts: true, shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSubtitles: false, shouldDownloadSlideshowImages: false, shouldDownloadAvatars: false });
  const by = {};
  items.forEach(it => {
    const a = it.authorMeta || {}; const id = String(a.name || '').toLowerCase(); if (!id) return;
    const o = by[id] || (by[id] = { plat: 'tt', id: 'tt:' + id, acct: a.name, name: a.nickName || a.name, url: 'https://www.tiktok.com/@' + a.name, followers: num(a.fans), avatar: a.avatar || a.originalAvatarUrl || '', bio: String(a.signature || '').slice(0, 120), plays: [], ers: [], ko: false, text: '', caps: [] });
    const p = num(it.playCount); o.plays.push(p);
    if (p) o.ers.push(((num(it.diggCount) || 0) + (num(it.commentCount) || 0) + (num(it.shareCount) || 0)) / p);
    if (HANGUL.test([a.nickName, a.signature, it.text].join(' '))) o.ko = true;
    if (!o.text) o.text = String(it.text || '').slice(0, 80);
    if (o.caps.length < 4) o.caps.push(String(it.text || '').slice(0, 100));
  });
  return Object.values(by).map(o => ({ plat: o.plat, id: o.id, acct: o.acct, name: o.name, url: o.url, followers: o.followers, avatar: o.avatar, bio: o.bio || o.text, avg: med(o.plays), er: med(o.ers), n: o.plays.length, basis: `검색된 영상 ${o.plays.length}개 조회 중앙값`, ko: o.ko, hay: o.caps.join(' ').slice(0, 400) }));
}

/* 인스타그램: 사용자 검색(프로필 상세) */
async function instagram(term) {
  const items = await run(IG_ACTOR, { search: term, searchType: 'user', searchLimit: 10, resultsType: 'details', resultsLimit: 1, addParentData: false });
  return items.filter(it => it && it.username && !it.private).map(it => {
    const posts = Array.isArray(it.latestPosts) ? it.latestPosts : [];
    const views = posts.map(p => num(p.videoViewCount) ?? num(p.videoPlayCount)).filter(v => v != null);
    const likes = posts.map(p => num(p.likesCount)).filter(v => v != null && v >= 0);
    const fol = num(it.followersCount);
    const ko = HANGUL.test([it.fullName, it.biography, ...posts.slice(0, 3).map(p => p.caption || '')].join(' '));
    return { plat: 'ig', id: 'ig:' + String(it.username).toLowerCase(), acct: it.username, name: it.fullName || it.username, url: 'https://www.instagram.com/' + it.username + '/', followers: fol, avatar: it.profilePicUrlHD || it.profilePicUrl || '', bio: String(it.biography || '').slice(0, 120),
      avg: med(views), er: fol && likes.length ? med(likes) / fol : null, basis: views.length ? `최근 릴스 ${views.length}개 조회 중앙값` : '최근 게시물 기준', erBasis: '좋아요 ÷ 팔로워', ko, cat: it.businessCategoryName || '', n: views.length, hay: posts.slice(0, 4).map(p => String(p.caption || '').slice(0, 100)).join(' ').slice(0, 400) };
  });
}

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) { return; }
  const pid = String(body.pid || '').replace(/[^A-Za-z0-9_-]/g, '');
  const job = String(body.job || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!pid || !job) return;
  const who = await checkEditor(req);
  if (!who.ok) return;
  const save = (o) => fsPatch(who.tok, 'guides/' + pid, { discJob: job, ...o }).catch(e => console.error('save', e.message));
  const groups = (Array.isArray(body.groups) ? body.groups : []).slice(0, 3).map(g => ({ key: String(g.key || '').slice(0, 2), terms: (Array.isArray(g.terms) ? g.terms : []).map(t => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 2) })).filter(g => g.key && g.terms.length);
  const plats = (Array.isArray(body.platforms) ? body.platforms : []).filter(p => ['tt', 'ig'].includes(p));
  const out = {}; const errors = [];
  try {
    groups.forEach(g => { out[g.key] = []; });
    // 무료 요금제 동시 실행 메모리 한도 때문에 틱톡 3개 → 인스타그램 3개 순서로 (각 1GB)
    if (plats.includes('tt')) await Promise.all(groups.map(g => tiktok(g.terms).then(L => out[g.key].push(...L)).catch(e => errors.push(`틱톡(${g.key}): ${e.message}`))));
    if (plats.includes('ig')) await Promise.all(groups.map(g => instagram(g.terms[0]).then(L => out[g.key].push(...L)).catch(e => errors.push(`인스타그램(${g.key}): ${e.message}`))));
    const n = Object.values(out).reduce((a, L) => a + L.length, 0);
    if (!n && errors.length) throw new Error(errors.join(' / '));
    await save({ discStatus: '완료', discResult: JSON.stringify({ groups: out, errors }).slice(0, 700000), discDoneAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    await save({ discStatus: '실패', discError: String(e.message || e).slice(0, 400) });
  }
};

export const config = { path: '/api/discover', background: true };
