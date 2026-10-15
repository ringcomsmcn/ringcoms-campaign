// RINGCOMS 캠페인 관리 · 스트리머 광고 — SOOP · 치지직 방송(다시보기) 목록 불러오기
// POST /api/stream { action, ... }  (로그인 토큰 필요, 마스터·매니저만)
//   vods   → { plat: 'soop'|'chzzk', ch, from?, to? } → { items: [{ id, title, at, views, vodViews, durMin, url, thumb }] }
//   channel → { plat, ch } → { channel: { id, name, img, fol, subs, views }, live: { id, title, viewers, start } | null }
//   status → SOOP · 치지직 공개 데이터에 지금 연결되는지 확인 (연동 관리 화면용)
// 두 플랫폼 모두 채널 페이지가 쓰는 공개 데이터를 읽습니다 (API 키 불필요 · 무료).
// 공식 Open API(SOOP Developers · CHZZK Developers) 키를 받으면 환경변수 SOOP_CLIENT_ID · CHZZK_CLIENT_ID 로
// 바꿔 붙일 수 있도록 플랫폼별 함수를 나눠 두었습니다. 유튜브는 브라우저에서 YouTube API 키로 읽습니다.
import { checkEditor, json } from '../lib/gemini.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const MAX_PAGES = 6;

async function getJson(url, headers = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json, text/plain, */*', ...headers }, signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(t); }
}
const kstIso = s => { const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/); return m ? `${m[1]}T${m[2]}:${m[3] || '00'}+09:00` : (s ? new Date(s).toISOString() : ''); };
const inRange = (iso, from, to) => { const d = String(iso).slice(0, 10); return (!from || d >= from) && (!to || d <= to); };
const num = v => (v == null || v === '' || !isFinite(+v)) ? null : Math.round(+v);

/* 채널 주소 → 채널 ID */
export function soopId(s) { s = String(s || '').trim(); const m = s.match(/(?:sooplive\.co\.kr|afreecatv\.com)\/(?:station\/)?([A-Za-z0-9_]{3,30})/i); if (m && !/^(station|player|live|vod)$/i.test(m[1])) return m[1].toLowerCase(); return /^[A-Za-z0-9_]{3,30}$/.test(s) ? s.toLowerCase() : null; }
export function chzzkId(s) { s = String(s || '').trim(); const m = s.match(/([0-9a-f]{32})/i); return m ? m[1].toLowerCase() : null; }

/* SOOP: 방송국 다시보기 (생방송 종료 후 자동 저장되는 방송) */
async function soopVods(id, from, to) {
  const out = [];
  for (const kind of ['review', 'all']) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      let j; try { j = await getJson(`https://chapi.sooplive.co.kr/api/${encodeURIComponent(id)}/vods/${kind}?page=${page}&per_page=60&orderby=reg_date`, { referer: `https://www.sooplive.co.kr/station/${id}` }); }
      catch (e) { if (page === 1 && kind === 'review') break; throw e; }
      const L = Array.isArray(j.data) ? j.data : [];
      let older = false;
      for (const v of L) {
        const at = kstIso(v.reg_date); if (from && at && at.slice(0, 10) < from) { older = true; continue; }
        if (!inRange(at, from, to)) continue;
        const c = v.count || {}, u = v.ucc || {};
        out.push({ id: 'soop:' + v.title_no, title: String(v.title_name || ''), at, views: num(c.read_cnt), vodViews: num(c.vod_read_cnt), likes: num(c.like_cnt), durMin: u.total_file_duration ? Math.round(+u.total_file_duration / 60000) : null,
          url: `https://vod.sooplive.co.kr/player/${v.title_no}`, thumb: u.thumb ? (String(u.thumb).startsWith('//') ? 'https:' + u.thumb : u.thumb) : '', tags: (u.hash_tags || []).slice(0, 10) });
      }
      const meta = j.meta || {}; if (older || !L.length || (meta.last_page && page >= meta.last_page)) break;
    }
    if (out.length) break;
  }
  return out;
}

/* 치지직: 채널 동영상(다시보기) 목록 */
async function chzzkVods(id, from, to) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const j = await getJson(`https://api.chzzk.naver.com/service/v1/channels/${id}/videos?sortType=LATEST&pagingType=PAGE&page=${page}&size=50&publishDateAt=&videoType=`, { referer: `https://chzzk.naver.com/${id}/videos` });
    const c = j.content || {}; const L = Array.isArray(c.data) ? c.data : [];
    let older = false;
    for (const v of L) {
      const at = kstIso(v.publishDate || (v.publishDateAt ? new Date(v.publishDateAt).toISOString() : ''));
      if (from && at && at.slice(0, 10) < from) { older = true; continue; }
      if (!inRange(at, from, to)) continue;
      out.push({ id: 'chzzk:' + v.videoNo, title: String(v.videoTitle || ''), at, views: num(v.readCount), vodViews: num(v.readCount), likes: null, durMin: v.duration ? Math.round(+v.duration / 60) : null,
        url: `https://chzzk.naver.com/video/${v.videoNo}`, thumb: v.thumbnailImageUrl || '', type: v.videoType || '' });
    }
    if (older || !L.length || (c.totalPages != null && page + 1 >= c.totalPages)) break;
  }
  return out;
}


/* 채널 요약 + 지금 방송 중이면 라이브 정보 */
async function soopChannel(id) {
  const j = await getJson(`https://chapi.sooplive.co.kr/api/${encodeURIComponent(id)}/station`, { referer: `https://www.sooplive.co.kr/station/${id}` });
  const st = j.station || {}, upd = st.upd || {}, b = j.broad || null;
  let img = j.profile_image || ''; if (img.startsWith('//')) img = 'https:' + img;
  return { channel: { id, name: st.user_nick || st.station_name || id, img, fol: num(upd.fan_cnt), subs: num((j.subscription || {}).total), views: num(upd.total_view_cnt), totalBroadMin: st.total_broad_time ? num(+st.total_broad_time / 60) : null },
    live: b && b.broad_no ? { id: String(b.broad_no), title: String(b.broad_title || ''), viewers: num(b.current_sum_viewer), start: kstIso(b.broad_start || st.broad_start || '') || '' } : null };
}
async function chzzkChannel(id) {
  const j = await getJson(`https://api.chzzk.naver.com/service/v1/channels/${id}`, { referer: `https://chzzk.naver.com/${id}` });
  const c = j.content || {};
  let live = null;
  if (c.openLive) { try { const l = (await getJson(`https://api.chzzk.naver.com/service/v2/channels/${id}/live-detail`, { referer: `https://chzzk.naver.com/live/${id}` })).content || {}; if (l.status === 'OPEN' || l.liveTitle) live = { id: String(l.liveId || ''), title: String(l.liveTitle || ''), viewers: num(l.concurrentUserCount), start: kstIso(l.openDate || '') }; } catch (e) {} }
  return { channel: { id, name: c.channelName || id, img: c.channelImageUrl || '', fol: num(c.followerCount), subs: null, views: null }, live };
}

async function probe(plat) {
  try {
    if (plat === 'soop') { const j = await getJson('https://chapi.sooplive.co.kr/api/phonics1/vods/review?page=1&per_page=1'); return { ok: Array.isArray(j.data) }; }
    const j = await getJson('https://api.chzzk.naver.com/service/v1/channels/c7ad22d0a1b88cb1b77de7cd4e7a4b4d/videos?sortType=LATEST&pagingType=PAGE&page=0&size=1&publishDateAt=&videoType=');
    return { ok: !!(j && j.content) };
  } catch (e) { return { ok: false, error: e.message }; }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 가능합니다.' }, 405);
  const who = await checkEditor(req);
  if (!who.ok) return json({ error: who.error }, who.status);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const from = /^\d{4}-\d{2}-\d{2}$/.test(b.from || '') ? b.from : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(b.to || '') ? b.to : '';
  try {
    if (b.action === 'status') {
      const [soop, chzzk] = await Promise.all([probe('soop'), probe('chzzk')]);
      return json({ soop: { ...soop, official: !!process.env.SOOP_CLIENT_ID }, chzzk: { ...chzzk, official: !!process.env.CHZZK_CLIENT_ID } });
    }
    if (b.action === 'channel') {
      const plat = String(b.plat || '');
      if (plat === 'soop') { const id = soopId(b.ch); if (!id) return json({ error: 'SOOP 방송국 주소나 아이디를 확인해 주세요.' }, 400); return json(await soopChannel(id)); }
      if (plat === 'chzzk') { const id = chzzkId(b.ch); if (!id) return json({ error: '치지직 채널 주소를 확인해 주세요.' }, 400); return json(await chzzkChannel(id)); }
      return json({ error: '지원하지 않는 플랫폼입니다.' }, 400);
    }
    if (b.action === 'vods') {
      const plat = String(b.plat || '');
      if (plat === 'soop') { const id = soopId(b.ch); if (!id) return json({ error: 'SOOP 방송국 주소나 아이디를 확인해 주세요. (예: https://www.sooplive.co.kr/station/아이디)' }, 400); return json({ ch: id, items: await soopVods(id, from, to) }); }
      if (plat === 'chzzk') { const id = chzzkId(b.ch); if (!id) return json({ error: '치지직 채널 주소를 확인해 주세요. (예: https://chzzk.naver.com/32자리 채널 ID)' }, 400); return json({ ch: id, items: await chzzkVods(id, from, to) }); }
      return json({ error: '지원하지 않는 플랫폼입니다.' }, 400);
    }
    return json({ error: '알 수 없는 요청입니다.' }, 400);
  } catch (e) {
    const blocked = e.status === 403 || e.status === 429;
    return json({ error: (blocked ? '플랫폼이 잠시 요청을 막았습니다. 잠시 뒤 다시 시도하거나 방송 정보를 직접 입력해 주세요.' : '방송 목록을 불러오지 못했습니다: ' + e.message) }, 502);
  }
};

export const config = { path: '/api/stream' };
