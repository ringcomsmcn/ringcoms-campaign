// RINGCOMS 캠페인 관리 · 업데이트 제안 서버 함수
// POST /api/ops
//   { action: 'list' }                         → 업데이트 제안 목록 (팀원 모두)
//   { action: 'approve', ids: [...] }          → 「업데이트 진행」: 승인 표시 → 다음 정기 실행(매일 09:47·18:47)에 Claude가 적용·배포 (마스터·매니저)
//   { action: 'hold' | 'dismiss' | 'reopen', ids: [...] } → 보류 / 제외 / 다시 새 제안으로 (마스터·매니저)
//   { action: 'add', title, detail }           → 팀이 직접 남기는 업데이트 요청 (마스터·매니저)
// 저장 위치: GitHub 저장소의 ops 브랜치 ops/suggestions.json (배포되지 않는 브랜치)
// 필요한 환경변수: GITHUB_TOKEN (저장소 Contents 읽기·쓰기 권한의 fine-grained 토큰)

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'ringcoms-campaign';
const REPO = process.env.GITHUB_REPO || 'ringcomsmcn/ringcoms-campaign';
const BRANCH = process.env.OPS_BRANCH || 'ops';
const FILE = 'ops/suggestions.json';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/* 호출한 사람: 링컴즈 팀원만 (광고주 계정 제외) */
async function who(req) {
  const h = req.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok) return { ok: false, status: 401, error: '로그인이 필요합니다.' };
  let email = '';
  try { email = String(JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).email || '').toLowerCase(); } catch (e) {}
  if (!email) return { ok: false, status: 401, error: '로그인 정보를 확인할 수 없습니다.' };
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/admins/${encodeURIComponent(email)}`, { headers: { authorization: 'Bearer ' + tok } });
  if (!r.ok) return { ok: false, status: 403, error: '팀원만 사용할 수 있습니다.' };
  const d = await r.json().catch(() => ({}));
  const f = d.fields || {};
  const role = (f.role && f.role.stringValue) || 'viewer';
  const acct = (f.acct && f.acct.stringValue) || 'ringcoms';
  if (acct !== 'ringcoms' || !['master', 'manager', 'viewer'].includes(role)) return { ok: false, status: 403, error: '링컴즈 팀원만 사용할 수 있습니다.' };
  return { ok: true, email, role, edit: role === 'master' || role === 'manager' };
}

async function gh(path, opts = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { const e = new Error('NO_TOKEN'); throw e; }
  const r = await fetch('https://api.github.com' + path, { ...opts, headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'ringcoms-campaign-ops', ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}
/* 제안 파일 읽기 (없으면 빈 목록) */
export async function readFile() {
  const r = await gh(`/repos/${REPO}/contents/${FILE}?ref=${encodeURIComponent(BRANCH)}`);
  if (r.status === 404) return { data: { items: [] }, sha: null, missing: true };
  if (!r.ok) throw new Error('GitHub 읽기 실패 (' + r.status + '): ' + ((r.d && r.d.message) || ''));
  const text = Buffer.from(r.d.content || '', 'base64').toString('utf8');
  let data = { items: [] };
  try { data = JSON.parse(text); } catch (e) {}
  if (!Array.isArray(data.items)) data.items = [];
  return { data, sha: r.d.sha };
}
async function writeFile(data, sha, message) {
  const body = { message, branch: BRANCH, content: Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64'), ...(sha ? { sha } : {}) };
  const r = await gh(`/repos/${REPO}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  if (r.status === 409 || r.status === 422) return { conflict: true };
  if (!r.ok) throw new Error('GitHub 저장 실패 (' + r.status + '): ' + ((r.d && r.d.message) || ''));
  return { ok: true };
}
/* 상태 바꾸기 (동시에 바뀌면 최신 파일로 다시 시도) */
export function applyAction(data, action, ids, me, extra) {
  const now = new Date().toISOString();
  const set = new Set(ids || []);
  if (action === 'add') {
    const id = 'team-' + Date.now().toString(36);
    data.items.unshift({ id, date: now.slice(0, 10), createdAt: now, source: 'team', by: me, title: String(extra.title || '').slice(0, 120), why: String(extra.detail || '').slice(0, 2000), what: [], effort: '', needs: [], cautions: [], impact: '보통', area: '', status: 'requested' });
    return id;
  }
  const to = { approve: 'approved', hold: 'hold', dismiss: 'dismissed', reopen: 'new' }[action];
  let n = 0;
  data.items.forEach(it => {
    if (!set.has(it.id)) return;
    if (action === 'approve' && !['new', 'hold', 'requested', 'failed'].includes(it.status)) return;
    if (action === 'reopen' && !['hold', 'dismissed', 'failed'].includes(it.status)) return;
    it.status = to; it[to + 'By'] = me; it[to + 'At'] = now; n++;
  });
  return n;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405);
  const w = await who(req);
  if (!w.ok) return json({ error: w.error }, w.status);
  let body = {};
  try { body = await req.json(); } catch (e) { return json({ error: '요청 형식이 올바르지 않습니다.' }, 400); }
  if (!process.env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN 환경변수가 없습니다.', setup: true }, 503);
  try {
    if (body.action === 'list') {
      const { data } = await readFile();
      return json({ ...data, edit: w.edit });
    }
    if (!['approve', 'hold', 'dismiss', 'reopen', 'add'].includes(body.action)) return json({ error: 'action은 list·approve·hold·dismiss·reopen·add 중 하나여야 합니다.' }, 400);
    if (!w.edit) return json({ error: '마스터·매니저만 바꿀 수 있습니다.' }, 403);
    if (body.action === 'add' && !String(body.title || '').trim()) return json({ error: '요청 제목을 입력하세요.' }, 400);
    for (let i = 0; i < 3; i++) {
      const { data, sha } = await readFile();
      const res = applyAction(data, body.action, (body.ids || []).map(String).slice(0, 50), w.email, body);
      if (body.action !== 'add' && !res) return json({ ...data, changed: 0 });
      data.updatedAt = new Date().toISOString();
      const label = { approve: '업데이트 진행 승인', hold: '보류', dismiss: '제외', reopen: '다시 열기', add: '팀 요청 추가' }[body.action];
      const wr = await writeFile(data, sha, `업데이트 제안: ${label} (${w.email})`);
      if (wr.ok) return json({ ...data, changed: body.action === 'add' ? 1 : res, edit: true });
    }
    return json({ error: '다른 변경과 겹쳤습니다. 잠시 후 다시 시도하세요.' }, 409);
  } catch (e) {
    return json({ error: e.message === 'NO_TOKEN' ? 'GITHUB_TOKEN 환경변수가 없습니다.' : e.message, setup: e.message === 'NO_TOKEN' }, 502);
  }
};

export const config = { path: '/api/ops' };
