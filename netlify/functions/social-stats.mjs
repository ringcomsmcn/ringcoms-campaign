// RINGCOMS 캠페인 관리 · 인스타그램/틱톡 성과 수집 서버 함수
// POST /api/social-stats
//   { action: 'start', urls: [...] }  → 틱톡은 바로 수집, 인스타그램(및 틱톡 실패분)은 Apify 실행 시작
//   { action: 'poll',  jobs: [...] }  → Apify 실행이 끝났으면 결과 반환
// 호출 권한: Firebase에 로그인한 팀원(마스터·매니저)만. Apify 토큰은 Netlify 환경변수 APIFY_TOKEN에만 보관.

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'ringcoms-campaign';
const APIFY = 'https://api.apify.com/v2';
const IG_ACTOR = process.env.APIFY_IG_ACTOR || 'apify~instagram-scraper';
const TT_ACTOR = process.env.APIFY_TT_ACTOR || 'clockworks~tiktok-scraper';
const MAX_URLS = 100;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const num = v => (v == null || v === '' || !isFinite(+v) || +v < 0) ? null : Math.round(+v);
export const platformOf = u => /instagram\.com/i.test(u) ? 'ig' : /tiktok\.com/i.test(u) ? 'tt' : null;
export const igCode = u => (String(u).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i) || [])[1] || null;
export const ttId = u => (String(u).match(/\/video\/(\d+)/) || [])[1] || null;

/* 1) 호출한 사람이 팀원인지 확인: 그 사람의 로그인 토큰으로 Firestore 팀원 문서를 직접 읽어 봄 (보안 규칙이 판정) */
async function checkMember(req) {
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
  if (!['master', 'manager'].includes(role)) return { ok: false, status: 403, error: '보기 전용(뷰어) 권한으로는 성과를 불러올 수 없습니다.' };
  return { ok: true, email, role };
}

/* 2) 틱톡: 공개 페이지의 데이터를 바로 읽기 */
export function parseTikTokHtml(html) {
  const m = String(html).match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  const j = JSON.parse(m[1]);
  const it = (((j.__DEFAULT_SCOPE__ || {})['webapp.video-detail'] || {}).itemInfo || {}).itemStruct;
  if (!it) return null;
  const s = it.statsV2 || it.stats || {};
  return { owner: (it.author && it.author.uniqueId) || null, views: num(s.playCount), likes: num(s.diggCount), cmts: num(s.commentCount), shares: num(s.shareCount), saves: num(s.collectCount), thumbUrl: (it.video && (it.video.cover || it.video.originCover)) || null };
}
async function tiktokDirect(url) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' }, redirect: 'follow', signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return parseTikTokHtml(await r.text());
  } catch (e) { return null; }
}

/* 3) Apify 실행 시작 / 상태 확인 */
async function apify(path, opts = {}) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('NO_TOKEN');
  const r = await fetch(APIFY + path, { ...opts, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const msg = (d.error && (d.error.message || d.error.type)) || ('HTTP ' + r.status); throw new Error(msg); }
  return d;
}
async function startRun(actor, input) { const d = await apify(`/acts/${actor}/runs`, { method: 'POST', body: JSON.stringify(input) }); return { runId: d.data.id }; }

export function mapIg(it) {
  const code = it.shortCode || igCode(it.url || it.inputUrl || '');
  const likes = num(it.likesCount);
  return { key: 'ig:' + code, owner: it.ownerUsername || null, views: num(it.videoPlayCount) ?? num(it.videoViewCount), likes, cmts: num(it.commentsCount), shares: null, saves: null, thumbUrl: it.displayUrl || null, likesHidden: likes == null };
}
export function mapTt(it) {
  const id = String(it.id || ttId(it.webVideoUrl || it.submittedVideoUrl || '') || '');
  return { key: 'tt:' + id, owner: (it.authorMeta && it.authorMeta.name) || null, views: num(it.playCount), likes: num(it.diggCount), cmts: num(it.commentCount), shares: num(it.shareCount), saves: num(it.collectCount), thumbUrl: (it.videoMeta && (it.videoMeta.coverUrl || it.videoMeta.originalCoverUrl)) || null };
}
const keyOf = u => platformOf(u) === 'ig' ? 'ig:' + igCode(u) : 'tt:' + ttId(u);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405);
  const who = await checkMember(req);
  if (!who.ok) return json({ error: who.error }, who.status);
  let body = {};
  try { body = await req.json(); } catch (e) { return json({ error: '요청 형식이 올바르지 않습니다.' }, 400); }

  if (body.action === 'start') {
    const urls = [...new Set((body.urls || []).map(String).filter(u => platformOf(u)))].slice(0, MAX_URLS);
    const results = {}; const ig = [], ttFail = [];
    // 틱톡은 먼저 직접 읽기 (동시에)
    await Promise.all(urls.map(async u => {
      const p = platformOf(u);
      if (p === 'ig') { if (igCode(u)) ig.push(u); else results[u] = { error: '인스타그램 게시물 주소 형식이 아닙니다.' }; return; }
      const d = await tiktokDirect(u);
      if (d) results[u] = { ...d, via: 'direct' }; else ttFail.push(u);
    }));
    const jobs = []; const warnings = [];
    try {
      if (ig.length) jobs.push({ platform: 'ig', urls: ig, ...(await startRun(IG_ACTOR, { directUrls: ig, resultsType: 'posts', resultsLimit: 1, addParentData: false })) });
      if (ttFail.length) jobs.push({ platform: 'tt', urls: ttFail, ...(await startRun(TT_ACTOR, { postURLs: ttFail, resultsPerPage: 1, shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSubtitles: false })) });
    } catch (e) {
      const msg = e.message === 'NO_TOKEN' ? 'Apify 토큰이 설정되지 않았습니다 (Netlify 환경변수 APIFY_TOKEN).' : /limit|credit|usage|payment/i.test(e.message) ? 'Apify 이번 달 무료 사용량을 다 썼습니다. 다음 달에 초기화됩니다.' : 'Apify 실행을 시작하지 못했습니다: ' + e.message;
      warnings.push(msg);
      [...ig, ...ttFail].forEach(u => { if (!results[u]) results[u] = { error: msg }; });
    }
    return json({ results, jobs, warnings, done: jobs.length === 0 });
  }

  if (body.action === 'poll') {
    const jobs = (body.jobs || []).slice(0, 4);
    const results = {}; let done = true; const warnings = [];
    for (const job of jobs) {
      try {
        const run = (await apify(`/actor-runs/${encodeURIComponent(job.runId)}`)).data;
        if (['READY', 'RUNNING'].includes(run.status)) { done = false; continue; }
        if (run.status !== 'SUCCEEDED') { warnings.push(`${job.platform === 'ig' ? '인스타그램' : '틱톡'} 수집이 실패했습니다 (${run.status}).`); (job.urls || []).forEach(u => results[u] = { error: '수집 실패 (' + run.status + ')' }); continue; }
        const items = await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&format=json`);
        const byKey = {};
        (Array.isArray(items) ? items : []).forEach(it => { const m = job.platform === 'ig' ? mapIg(it) : mapTt(it); if (m.key && !byKey[m.key]) byKey[m.key] = m; });
        (job.urls || []).forEach(u => { const m = byKey[keyOf(u)]; results[u] = m ? { ...m, via: 'apify' } : { error: '게시물을 찾지 못했습니다 (삭제·비공개일 수 있음).' }; });
      } catch (e) { done = false; warnings.push('상태 확인 중 오류: ' + e.message); }
    }
    return json({ results, done, warnings });
  }

  return json({ error: 'action은 start 또는 poll이어야 합니다.' }, 400);
};

export const config = { path: '/api/social-stats' };
