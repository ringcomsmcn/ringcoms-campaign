// RINGCOMS 캠페인 관리 · 영상 검수 (백그라운드 함수, 최대 15분)
// POST /api/review  { id, url, infl, guide, concept }  → 바로 202 응답, 결과는 Firestore reviews/{id} 에 기록
//   status: 영상 받는 중 → 분석 중 → 완료 | 실패,  resultJson: 검수 결과(JSON 문자열)
// 주요 장면: 영상을 10구간으로 나눠 1장씩 캡처(ffmpeg) → guideimg/rv_{id}.frames (유튜브는 유튜브 자동 썸네일 4장)
// 영상 가져오기: 유튜브(공개) = Gemini가 직접 / 구글 드라이브(링크 공개)·영상 파일 주소 = 내려받아 Gemini Files API
//               인스타그램·틱톡 = Apify로 영상 주소 확인 후 내려받기 (APIFY_TOKEN 필요)
// 환경변수: GEMINI_API_KEY (필수), APIFY_TOKEN (인스타·틱톡), APIFY_IG_ACTOR, APIFY_TT_ACTOR
import { gemini, uploadFile, deleteFile, checkEditor, fsPatch } from '../lib/gemini.mjs';
import { createWriteStream, createReadStream, promises as fsp } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APIFY = 'https://api.apify.com/v2';
const IG_ACTOR = process.env.APIFY_IG_ACTOR || 'apify~instagram-scraper';
const TT_ACTOR = process.env.APIFY_TT_ACTOR || 'clockworks~tiktok-scraper';
const MAX_BYTES = 500 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ytId = u => (String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/) || [])[1] || '';
const driveId = u => (String(u).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{10,})/) || String(u).match(/[?&]id=([A-Za-z0-9_-]{10,})/) || [])[1] || '';

/* 영상 주소 열기 → 스트림 그대로 넘김 (내려받은 영상을 메모리에 통째로 담지 않음) */
async function download(url, headers = {}) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, ...headers } });
  if (!r.ok) throw new Error('영상을 내려받지 못했습니다 (' + r.status + ').');
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  if (/text\/html/.test(type)) { try { await r.body.cancel(); } catch (e) {} throw new Error('영상 대신 웹페이지가 열립니다. 구글 드라이브는 공유 설정을 「링크가 있는 모든 사용자」로 바꿔 주세요.'); }
  const len = +(r.headers.get('content-length') || 0);
  if (len > MAX_BYTES) { try { await r.body.cancel(); } catch (e) {} throw new Error('영상이 너무 큽니다 (500MB 이하만 가능).'); }
  const mime = /^video\//.test(type) ? type : 'video/mp4';
  return { stream: r.body, size: len, mime };
}

async function apifyItems(actor, input) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('인스타그램·틱톡 영상을 가져오려면 Netlify 환경변수 APIFY_TOKEN이 필요합니다. 구글 드라이브 링크로 받아 주세요.');
  const r = await fetch(`${APIFY}/acts/${actor}/run-sync-get-dataset-items?timeout=240`, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const d = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(d)) throw new Error('게시물 정보를 가져오지 못했습니다' + (d && d.error ? ' (' + (d.error.message || d.error.type) + ')' : '') + '.');
  return d;
}

/* 링크 → Gemini에 넘길 영상 part (+ 지울 파일 이름) */
/* ffmpeg (ffmpeg-static 패키지) — 없으면 장면 캡처만 건너뜀 */
async function ffmpegPath() { try { const m = await import('ffmpeg-static'); return m.default || m; } catch (e) { return null; } }
const run = (bin, args) => new Promise(res => execFile(bin, args, { maxBuffer: 8 * 1024 * 1024, timeout: 60000 }, (err, stdout, stderr) => res({ err, stdout, stderr: String(stderr || '') })));
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/* 영상 구간을 10등분해 가운데 장면을 1장씩 (가로 360px JPG) */
async function captureFrames(file, n = 10) {
  const bin = await ffmpegPath(); if (!bin) return [];
  const info = await run(bin, ['-hide_banner', '-i', file]);
  const m = info.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/); if (!m) return [];
  const dur = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]); if (!(dur > 0)) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = Math.min(dur - 0.05, (i + 0.5) * dur / n); const jpg = file + '_' + i + '.jpg';
    const r = await run(bin, ['-hide_banner', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '7', '-y', jpg]);
    if (r.err) continue;
    try { const b = await fsp.readFile(jpg); out.push({ t: mmss(t), src: 'data:image/jpeg;base64,' + b.toString('base64') }); await fsp.unlink(jpg).catch(() => {}); } catch (e) {}
  }
  return out;
}
/* 링크 → Gemini에 넘길 영상 part (+ 지울 파일 이름, 장면 캡처) */
async function videoPart(url, id) {
  const yt = ytId(url);
  if (yt) return { part: { fileData: { fileUri: 'https://www.youtube.com/watch?v=' + yt, mimeType: 'video/*' } }, kind: '유튜브',
    frames: [['처음', 'hqdefault'], ['약 25%', '1'], ['약 50%', '2'], ['약 75%', '3']].map(([t, k]) => ({ t, src: `https://i.ytimg.com/vi/${yt}/${k}.jpg` })) };
  let got = null, kind = '';
  if (/drive\.google\.com|docs\.google\.com/.test(url)) {
    const did = driveId(url); if (!did) throw new Error('구글 드라이브 파일 링크가 아닙니다. 파일의 「링크 복사」 주소를 넣어 주세요.');
    got = await download(`https://drive.usercontent.google.com/download?id=${did}&export=download&confirm=t`); kind = '구글 드라이브';
  } else if (/instagram\.com/.test(url)) {
    const it = (await apifyItems(IG_ACTOR, { directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false }))[0] || {};
    const v = it.videoUrl || (Array.isArray(it.childPosts) && (it.childPosts.find(c => c.videoUrl) || {}).videoUrl);
    if (!v) throw new Error('인스타그램 게시물에서 영상을 찾지 못했습니다 (비공개이거나 사진 게시물).');
    got = await download(v); kind = '인스타그램';
  } else if (/tiktok\.com/.test(url)) {
    const it = (await apifyItems(TT_ACTOR, { postURLs: [url], resultsPerPage: 1, shouldDownloadVideos: true, shouldDownloadCovers: false, shouldDownloadSubtitles: false }))[0] || {};
    const v = (Array.isArray(it.mediaUrls) && it.mediaUrls[0]) || (it.videoMeta && (it.videoMeta.downloadAddr || it.videoMeta.playAddr));
    if (!v) throw new Error('틱톡 게시물에서 영상을 찾지 못했습니다.');
    got = await download(v, { referer: 'https://www.tiktok.com/' }); kind = '틱톡';
  } else {
    got = await download(url); kind = '영상 파일';
  }
  // 임시 폴더에 저장 (메모리에 담지 않음) → 장면 캡처 → 파일에서 나눠 올리기
  const tmp = join(tmpdir(), 'rv_' + id + '.mp4');
  let size = 0;
  const counter = new TransformStream({ transform(ch, c) { size += ch.length; if (size > MAX_BYTES) c.error(new Error('영상이 너무 큽니다 (500MB 이하만 가능).')); else c.enqueue(ch); } });
  await pipeline(Readable.fromWeb(got.stream.pipeThrough(counter)), createWriteStream(tmp));
  if (size < 20000) { await fsp.unlink(tmp).catch(() => {}); throw new Error('영상 파일이 아닙니다. 링크를 확인해 주세요.'); }
  let frames = [];
  try { frames = await captureFrames(tmp); } catch (e) { console.error('frames', e.message); }
  try {
    const f = await uploadFile(Readable.toWeb(createReadStream(tmp)), got.mime, 'ringcoms-review', size);
    return { part: { fileData: { fileUri: f.uri, mimeType: f.mime } }, file: f.name, kind, frames };
  } finally { await fsp.unlink(tmp).catch(() => {}); }
}

const L = a => (Array.isArray(a) ? a : []).map(x => String(x || '').trim()).filter(Boolean);
function guideBrief(g, ci) {
  g = g || {}; const P = g.product || {}, S = g.summary || {}, T = g.text || {};
  const cs = (g.concepts || []).filter(c => c && (c.name || (c.scenes || []).length));
  const pick = ci != null && cs[ci] ? [cs[ci]] : cs;
  const out = [];
  out.push(`제품: ${[g.brand, P.name].filter(Boolean).join(' ')} / 채널: ${g.platform || ''} / 길이: ${g.length || ''} / 비율: ${g.ratio || ''}`);
  if (S.one) out.push('핵심 메시지: ' + S.one);
  if (L(S.must).length) out.push('꼭 해 주세요:\n- ' + L(S.must).join('\n- '));
  if (L(S.dont).length) out.push('하지 말아 주세요:\n- ' + L(S.dont).join('\n- '));
  if ((P.points || []).length) out.push('제품 핵심 특징: ' + P.points.filter(x => x && (x.t || x.d)).map(x => `${x.t} (${x.d})`).join(' / '));
  out.push((ci != null && cs[ci] ? '이 영상의 컨셉' : `컨셉 후보 (영상과 가장 가까운 것 1개를 골라 비교)`) + ':');
  pick.forEach((c, i) => {
    out.push(`[컨셉 ${ci != null && cs[ci] ? ci + 1 : i + 1}] ${c.name || ''}${c.hook ? ' / 첫 마디: ' + c.hook : ''}`);
    (c.scenes || []).forEach((s, j) => out.push(`  #${j + 1} ${s.part || ''} ${s.time || ''} | 찍는 법: ${s.shot || '-'} | 예시 멘트: ${s.say || '-'} | 자막: ${s.sub || '-'} | 포인트: ${s.point || '-'}`));
  });
  if ((g.cuts || []).length) out.push('꼭 찍어야 할 컷: ' + g.cuts.filter(k => k && k.name).map(k => `${k.name}(${k.need || '권장'}: ${k.desc || ''})`).join(' / '));
  if (L(T.keywords).length) out.push('필수 키워드 (자막·멘트에): ' + L(T.keywords).join(', '));
  if (T.closing) out.push('마무리 핵심 메시지: ' + T.closing);
  if (T.brandName || T.productName) out.push(`바른 표기: 브랜드 ${T.brandName || '-'} / 제품 ${T.productName || '-'}${L(T.ngNames).length ? ' / 틀린 표기: ' + L(T.ngNames).join(', ') : ''}`);
  if ((g.words || []).length) out.push('쓰면 안 되는 표현: ' + g.words.filter(w => w && w.no).map(w => `「${w.no}」→「${w.yes || ''}」`).join(', '));
  if (L(g.shoot).length) out.push('촬영 규칙:\n- ' + L(g.shoot).join('\n- '));
  return out.join('\n');
}

function reviewPrompt(g, ci, infl) {
  return `너는 MCN 링컴즈의 광고 영상 검수 담당자다. 첨부한 인플루언서 영상이 아래 콘텐츠 가이드대로 만들어졌는지 꼼꼼히 확인한다.
영상의 화면, 화면 글자(자막), 목소리(나레이션)를 모두 확인하고, 시간(분:초)을 근거로 적는다.

[콘텐츠 가이드]
${guideBrief(g, ci)}

[확인할 것]
1. 장면 구성: 가이드의 인트로·바디·아웃트로가 순서대로 있는지, 첫 3초 후킹이 있는지
2. 자막: 자막(또는 목소리)이 있는지, 필수 키워드·제품명이 자막에 바르게 나오는지 (오타·틀린 표기)
3. 나레이션: 핵심 메시지·제품 특징·마무리 메시지를 말하는지
4. 금지 표현: 효능 단정·쓰면 안 되는 표현이 자막·멘트에 있는지
5. 꼭 찍어야 할 컷, 촬영 규칙: 화면 비율, 로고 좌우 반전, 다른 브랜드 노출, 과한 보정 필터, 흔들림·어두움
6. 영상 길이가 가이드에 맞는지
- 캡션·해시태그는 영상만으로 알 수 없으니 판정하지 말고 checks에 넣지 않는다.
- 확인할 수 없는 항목은 status "na".

[판정 기준]
- verdict: "통과"(그대로 업로드 가능) / "수정 필요"(자막·편집으로 고칠 수 있음) / "재촬영 필요"(필수 장면 누락 등)
- score: 0~100 (가이드 준수 정도)
- fixes는 중요한 순서로, priority "필수"(안 고치면 승인 불가)·"권장"·"참고". how는 인플루언서가 바로 따라 할 수 있게 쉽게.
- message: ${infl ? infl + '님에게' : '인플루언서에게'} 보낼 카톡·DM 메시지. 먼저 잘한 점을 1줄 칭찬하고, 「필수」 수정만 번호로 쉽게 정리, 「권장」은 (선택)으로 짧게. 부드러운 존댓말, 이모지는 1~2개만.

JSON만 출력한다:
{"verdict":"","score":0,"duration":"0:00","ratio":"9:16","summary":"한두 문장 요약",
 "fixes":[{"priority":"필수|권장|참고","time":"0:00~0:03 또는 전체","what":"무엇이 문제인지","how":"이렇게 고쳐 주세요"}],
 "structure":[{"part":"인트로 (0~3초)","expected":"가이드 내용","actual":"실제 영상 내용","status":"ok|fix|miss|na"}],
 "checks":[{"item":"확인 항목","status":"ok|fix|miss|na","evidence":"근거와 시간"}],
 "concept":"영상과 가장 가까운 컨셉 이름","narration":"들리는 나레이션 전체 (시간 표시)","subtitles":"화면 자막 전체 (시간 표시)","message":""}`;
}

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) { return; }
  const id = String(body.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) return;
  const who = await checkEditor(req);
  if (!who.ok) return; // 로그인·권한이 없으면 아무것도 쓰지 않음
  const save = (o) => fsPatch(who.tok, 'reviews/' + id, o).catch(e => console.error('save', e.message));
  let file = '';
  try {
    const url = String(body.url || '');
    if (!/^https?:\/\//i.test(url)) throw new Error('영상 링크가 올바르지 않습니다.');
    await save({ status: '영상 받는 중' });
    const v = await videoPart(url, id); file = v.file || '';
    if ((v.frames || []).length) await fsPatch(who.tok, 'guideimg/rv_' + id, { frames: JSON.stringify(v.frames), updatedAt: new Date().toISOString() }).catch(e => console.error('frames save', e.message));
    await save({ status: '분석 중', source: v.kind, frameN: String((v.frames || []).length) });
    const ci = body.concept == null || body.concept === '' ? null : +body.concept;
    const { data, model } = await gemini([v.part, { text: reviewPrompt(body.guide, Number.isFinite(ci) ? ci : null, String(body.infl || '')) }], { temperature: 0.2, maxTokens: 12000, timeoutMs: 300000, thinking: 2048 });
    await save({ status: '완료', resultJson: JSON.stringify(data), model, doneAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    await save({ status: '실패', error: String(e.message || e).slice(0, 500) });
  } finally { if (file) await deleteFile(file); }
};

export const config = { path: '/api/review', background: true };
