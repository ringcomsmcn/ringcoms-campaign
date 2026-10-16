/* RINGCOMS 캠페인 관리 · 모바일 앱형 화면 (v0.24)
   폭 720px 이하에서만 동작 — PC 화면·기능은 그대로입니다.
   - 하단 탭 5개: 홈 · 캠페인 · 인플루언서 · 도구 · 더보기 (나머지 메뉴는 섹션 안 상단 칩으로 이동)
   - 홈: 진행 중 캠페인 · 확인 필요 · 바로가기
   - PC에서 쓰는 편이 나은 기능은 「PC에서 사용할 수 있어요」 안내 (제안서 편집 · AI 영상 제작 · 가이드 편집은 미리보기만) */
const MQ=window.matchMedia?window.matchMedia('(max-width:720px)'):null;
function isMob(){return !!(MQ&&MQ.matches)}
if(MQ){const f=()=>{if(typeof render==='function'&&A.user)render()};MQ.addEventListener?MQ.addEventListener('change',f):MQ.addListener(f)}
A.mLast=A.mLast||{camp:'list',infl:'pool',tool:'guides'};

const M_SEC={
  camp:{l:'캠페인',items:[['list','시딩'],['trial','체험단'],['gb','공동구매'],['live','라이브커머스'],['stream','스트리머']]},
  infl:{l:'인플루언서',items:[['pool','인플루언서 풀'],['recruit','인플루언서 모집'],['spool','스트리머 풀'],['sdata','스트리머 데이터']]},
  tool:{l:'도구',items:[['guides','콘텐츠 가이드'],['review','영상 검수'],['proposals','광고 제안서'],['aivideo','AI 영상']]}};
const M_IC={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/></svg>',
  camp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  infl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.6 5 5.8"/></svg>',
  tool:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>'};
/* 지금 화면이 어느 탭인지 */
function mSecOf(){const v=A.view;if(v==='mhome')return 'home';if(['list','trial','gb','live','stream','campaign','create'].includes(v))return 'camp';if(['pool','recruit','spool','sdata'].includes(v))return 'infl';if(['guides','review','proposals','aivideo'].includes(v))return 'tool';return 'more'}
function mCnt(v){return ''}

/* ---- 하단 탭 ---- */
function mNav(){if(typeof isClientView==='function'&&isClientView())return null;const sec=mSecOf();
  const b=(k,l,v)=>`<button class="${sec===k?'on':''}" data-act="mTab" data-k="${k}"${v?` data-v="${v}"`:''}>${M_IC[k]}<span>${l}</span>${k==='more'&&typeof updBadge==='function'&&updBadge()?'<i class="dot"></i>':''}</button>`;
  const nav=`<nav class="mnav m2 noprint" style="grid-template-columns:repeat(5,1fr)">${b('home','홈')}${b('camp','캠페인')}${b('infl','인플루언서')}${b('tool','도구')}${b('more','더보기')}</nav>`;
  const sheet=A.more?`<div class="msheet-bg noprint" data-act="moreToggle"></div><div class="msheet m2 noprint">${mMore()}</div>`:'';
  return nav+sheet}
function mMore(){const it=(v,l,tt,extra)=>`<button data-act="nav" data-v="${v}"${tt?` data-tt="${tt}"`:''}><span>${l}</span>${extra||''}</button>`;
  return `<div class="ms-who"><b>${esc(A.user.email)}</b><span class="small muted">${esc((typeof ROLES!=='undefined'&&ROLES[A.role])||A.role||'')}</span></div>
   <div class="ms-sec">구성요소 관리</div>${it('team','팀원 · 권한','members')}${it('team','광고주 계정','accts')}${it('team','연동 관리','int')}${it('updates','업데이트 제안','',typeof updBadge==='function'&&updBadge()?`<em class="nw">${updBadge()}</em>`:'')}${it('history','업데이트 이력')}
   <div class="ms-sec">계정</div>${DB.mode==='demo'?'<button data-act="demoReset"><span>데모 초기화</span></button>':''}<button data-act="signOut"><span>${DB.mode==='demo'?'데모 종료':'로그아웃'}</span></button>
   <p class="small muted" style="margin:6px 12px 2px">표 편집 · 제안서 · 디자인 작업은 PC 화면이 더 편해요.</p>`}

/* ---- 섹션 안 상단 칩 ---- */
function mSub(){if(!isMob())return '';const sec=mSecOf();const S=M_SEC[sec];if(!S)return '';if(A.view==='campaign'||A.view==='create'||(A.view==='guides'&&A.gid)||(A.view==='proposals'&&A.pid)||(A.view==='recruit'&&A.rcid))return '';
  return `<div class="msub noprint">${S.items.map(([v,l])=>{const k=mCnt(v);const pc=v==='aivideo';return `<button class="${A.view===v?'on':''}" data-act="nav" data-v="${v}">${l}${k!==''&&k!=null&&sec==='camp'?` <em>${k}</em>`:''}${pc?' <i>PC</i>':''}</button>`}).join('')}</div>`}

/* ---- 홈 ---- */
function viewMHome(){const camps=Object.entries(A.campaigns||{}).filter(([,c])=>inAcctScope(c));const run=camps.filter(([,c])=>campStatus(c)==='진행 중');
  const al=camps.filter(([,c])=>n((c.summary||{}).alerts)>0).sort((a,b)=>n(b[1].summary.alerts)-n(a[1].summary.alerts));const alN=al.reduce((t,[,c])=>t+n(c.summary.alerts),0);
  const recent=camps.slice().sort((a,b)=>String(b[1].updatedAt||b[1].createdAt||'').localeCompare(String(a[1].updatedAt||a[1].createdAt||''))).slice(0,6);
  const nm=String((A.admins&&A.admins[A.user.email]&&A.admins[A.user.email].memo)||'').split(/\s/)[0];
  const card=([id,c])=>{const s=c.summary||{};const st=campStatus(c);return `<button class="mh-card" data-act="open" data-id="${id}"><div class="row" style="gap:6px"><span class="pill">${esc((KINDS[kindOf(c)]||{}).label||'')}</span><span class="pill ${STATUS_CLS[st]||''}">${esc(st)}</span>${n(s.alerts)?`<span class="pill crit">확인 ${s.alerts}</span>`:''}</div><b>${esc(c.name||'이름 없음')}</b><span class="small muted">${esc(c.advertiser||'')}${c.start?' · '+md(c.start)+'~'+md(c.end):''}</span>
    <div class="mh-bar"><i style="width:${s.n?Math.round(n(s.uploaded)/s.n*100):0}%"></i></div><span class="small">업로드 ${fmt(s.uploaded||0)}/${fmt(s.n||0)}명${isCom(c)?` · 매출 ${compact(s.rev||0)}원`:` · 조회 ${compact(s.views||0)}`}</span></button>`};
  const q=(v,l,ic)=>`<button class="mh-q" data-act="nav" data-v="${v}"><span>${ic}</span>${l}</button>`;
  return `${mCss()}<div class="mh-hello"><div class="small muted">${new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})}</div><h1>${nm?esc(nm)+'님, ':''}안녕하세요</h1></div>
   <div class="mh-tiles"><button data-act="mGoRun"><span>진행 중 캠페인</span><b>${fmt(run.length)}</b></button><button data-act="mGoAlert" class="${alN?'crit':''}"><span>확인 필요</span><b>${fmt(alN)}</b></button></div>
   ${al.length?`<div class="mh-h">확인이 필요한 캠페인</div><div class="mh-list">${al.slice(0,4).map(([id,c])=>`<button class="mh-row" data-act="mOpenStatus" data-id="${id}"><b>${esc(c.name||'')}</b><span class="pill crit">${c.summary.alerts}</span></button>`).join('')}</div>`:''}
   <div class="mh-h">바로가기</div><div class="mh-qs">${q('list','시딩 캠페인','📣')}${q('trial','체험단','🎁')}${q('pool','인플루언서 풀','👥')}${q('recruit','인플루언서 모집','🧵')}${q('review','영상 검수','🎬')}${q('stream','스트리머 광고','📺')}</div>
   <div class="mh-h">최근 캠페인</div><div class="mh-cards">${recent.map(card).join('')||'<div class="panel empty">아직 캠페인이 없습니다.</div>'}</div>`}

/* ---- PC 전용 안내 ---- */
function pcOnly(title,desc,extra){return `${mCss()}<div class="pc-only"><div class="pc-ic">🖥️</div><h2>${esc(title)}</h2><p>${desc}</p>${extra||''}<button class="btn" data-act="mBack">이전 화면으로</button></div>`}
function mGate(){if(!isMob()||!A.user||(typeof isClientView==='function'&&isClientView()))return null;const v=A.view;
  if(v==='mhome')return viewMHome();
  if(v==='aivideo')return pcOnly('AI 영상 제작은 PC에서 사용할 수 있어요','장면 프롬프트를 고르고 영상을 만드는 작업이라 넓은 화면이 필요합니다.');
  if(v==='proposals'&&A.pid){const P=A.props&&A.props[A.pid];return pcOnly('광고 제안서 편집은 PC에서 사용할 수 있어요',`<b>${esc((P&&P.title)||'제안서')}</b><br>장표를 보면서 문구·이미지·디자인을 고치는 작업이라 PC 화면에서 열어 주세요. 모바일에서는 목록 확인만 할 수 있어요.`)}
  if(v==='guides'&&A.gid&&typeof curG==='function'){const g=curG();if(!g)return null;setTimeout(()=>typeof schedGPv==='function'&&schedGPv(true),0);
    return `${mCss()}<div class="page-h"><div><button class="btn sm ghost" data-act="guideBack">← 가이드 목록</button><h1 style="margin-top:6px">${esc(g.title||'콘텐츠 가이드')}</h1><div class="sub">${esc([g.advertiser,g.brand,g.platform].filter(Boolean).join(' · '))}</div></div></div>
     <div class="banner info" style="margin:0 0 12px">🖥️ 가이드 편집·디자인은 PC에서 할 수 있어요. 모바일에서는 미리보기와 PDF 저장만 됩니다.</div>
     <div class="row" style="gap:8px;margin-bottom:12px"><button class="btn" data-act="guidePdf">PDF 저장</button><button class="btn" data-act="gotoReview">이 가이드로 영상 검수</button></div>
     <div class="g-pv all" data-gpv="all"><div class="empty small">미리보기를 만드는 중…</div></div>`}
  return null}

Object.assign(ACT,{
  mTab(a){const k=a.dataset.k;A.more=false;if(k==='more'){A.more=true;render();return}const v=k==='home'?'mhome':A.mLast[k]||M_SEC[k].items[0][0];
    if(k===mSecOf()&&k!=='home'){/* 같은 탭을 다시 누르면 그 섹션 첫 화면으로 */const first=M_SEC[k].items.find(x=>x[0]===A.mLast[k])?A.mLast[k]:M_SEC[k].items[0][0];if(A.view===first){A.rcid='';A.gid='';A.pid='';A.sid=''}ACT.nav({dataset:{v:first}});return}
    ACT.nav({dataset:{v}})},
  mGoRun(){A.statusF='진행 중';ACT.nav({dataset:{v:A.mLast.camp||'list'}});A.statusF='진행 중';render()},
  mGoAlert(){const c=Object.entries(A.campaigns||{}).filter(([,c])=>inAcctScope(c)&&n((c.summary||{}).alerts)>0).sort((a,b)=>n(b[1].summary.alerts)-n(a[1].summary.alerts))[0];if(c)openCampaign(c[0],'status');else toast('확인이 필요한 캠페인이 없습니다.')},
  mOpenStatus(a){openCampaign(a.dataset.id,'status')},
  mBack(){history.length>1?history.back():ACT.nav({dataset:{v:'mhome'}})}
});
/* 섹션별 마지막 화면 기억 */
(function(){const prev=ACT.nav;ACT.nav=function(a){const v=a&&a.dataset&&a.dataset.v;for(const k in M_SEC)if(M_SEC[k].items.some(x=>x[0]===v))A.mLast[k]=v;return prev.apply(this,arguments)}})();

function mCss(){if(mCss.done)return '';mCss.done=1;document.head.insertAdjacentHTML('beforeend',`<style id="m-css">
.msub{display:none}
@media (max-width:720px){
 .top .email,.top .who .role-pill{display:none}.top .who{gap:6px}.top .who .btn[data-act=signOut]{display:none}
 .mnav.m2 button{font-size:10.5px}
 .msheet.m2{max-height:calc(100vh - 120px);overflow:auto;padding:6px}
 .msheet.m2 button{padding:12px 14px}.msheet.m2 .ms-sec{font-size:11px;font-weight:700;color:var(--muted);padding:10px 14px 4px;letter-spacing:.04em}
 .msheet.m2 .ms-who{display:flex;flex-direction:column;gap:2px;padding:10px 14px;border-bottom:1px solid var(--line);margin-bottom:4px}
 .msub{display:flex;gap:6px;overflow-x:auto;margin:-4px -16px 14px;padding:4px 16px 6px;position:sticky;top:56px;z-index:6;background:var(--bg);scrollbar-width:none}.msub::-webkit-scrollbar{display:none}
 .msub button{all:unset;flex:none;padding:7px 13px;border-radius:99px;background:var(--surface);border:1px solid var(--line);font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer}
 .msub button.on{background:var(--ink,#161B26);color:#fff;border-color:transparent}.msub button em{font-style:normal;opacity:.6;margin-left:2px}.msub button i{font-style:normal;font-size:10px;opacity:.6;margin-left:2px}
 .page-h h1{font-size:21px}.page-h{gap:10px}.page-h .sub{font-size:12.5px}
 .panel{padding:14px;border-radius:14px}.tiles{gap:8px}
 .tabs{overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}.tabs button{flex:none}
 .mcard{border-radius:14px}
 main .wrap{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
 .page-h [data-act=xlsx]{display:none}
}
.mh-hello{margin:4px 0 14px}.mh-hello h1{font-size:22px;margin:2px 0 0}
.mh-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.mh-tiles button{all:unset;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:4px}.mh-tiles span{font-size:12px;color:var(--muted)}.mh-tiles b{font-size:26px}.mh-tiles .crit b{color:var(--crit)}
.mh-h{font-size:13px;font-weight:700;margin:4px 2px 8px;color:var(--ink2)}
.mh-list{display:flex;flex-direction:column;gap:6px;margin-bottom:18px}.mh-row{all:unset;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.mh-qs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}.mh-q{all:unset;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:500;text-align:center}.mh-q span{font-size:22px}
.mh-cards{display:flex;flex-direction:column;gap:10px}.mh-card{all:unset;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:6px}.mh-card b{font-size:15px}
.mh-bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden}.mh-bar i{display:block;height:100%;background:var(--accent);border-radius:3px}
.pc-only{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:40px 18px;background:var(--surface);border:1px solid var(--line);border-radius:16px;margin-top:8px}.pc-only .pc-ic{font-size:40px}.pc-only h2{font-size:17px;margin:0}.pc-only p{margin:0;color:var(--ink2);font-size:13.5px;line-height:1.6}
</style>`);return ''}
mCss();
