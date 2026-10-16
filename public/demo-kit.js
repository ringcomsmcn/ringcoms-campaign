/* RINGCOMS 캠페인 관리 · 체험판 (v0.27)
   광고주·대행사에게 링크로 보내는 체험판입니다. ad.ringcoms.com/demo/ 에서 유형을 고르면 열립니다.
   - ?demo=inf  인플루언서 캠페인 (시딩·체험단·공동구매·라이브커머스 · 인플루언서 풀·모집 · 콘텐츠 도구 · 제안서)
   - ?demo=str  스트리머 광고 (스트리머 광고 · 스트리머 풀·방송 데이터 · 콘텐츠 가이드 · 제안서)
   - 데이터는 미리 만들어 둔 가상 캠페인입니다. 방문자가 바꾼 내용은 그 브라우저에만 남고, 서버에는 아무것도 저장·발송되지 않습니다.
   - 마스터: ?demo=inf&edit=1 에서 내용을 고친 뒤 「체험판에 게시」하면 모든 방문자에게 적용됩니다
     (Firestore public/demo_{inf|str} · 조각 public/demo_{inf|str}_{n} — 누구나 읽기, 마스터만 쓰기 버튼 노출)
   - 게시본이 없으면 /demo/{inf|str}.json(기본 체험판)을 씁니다. 날짜는 열 때마다 오늘 기준으로 옮겨 항상 진행 중인 캠페인처럼 보입니다. */
const DEMO_META={
  inf:{l:'인플루언서 캠페인',who:'인플루언서 캠페인 광고주 · 대행사',home:'list',infl:'pool',
    tour:[['캠페인 목록','nav','list'],['캠페인 개요','c','inf_seed1:overview'],['인플루언서 관리','c','inf_seed1:grid'],['성과 리포트','c','inf_seed1:report'],['링크 트래킹','c','inf_seed1:track'],['광고주 공유','c','inf_seed1:share'],['콘텐츠 가이드','g','gd_lumi_g1'],['체험단','nav','trial'],['인플루언서 풀','nav','pool'],['광고 제안서','p','pp_moabebe']]},
  str:{l:'스트리머 광고',who:'스트리머 광고 광고주 · 대행사',home:'stream',infl:'spool',
    tour:[['스트리머 광고 목록','nav','stream'],['캠페인 개요','c','str_ppl1:overview'],['스트리머 관리','c','str_ppl1:grid'],['성과 리포트','c','str_ppl1:report'],['광고주 공유','c','str_ppl1:share'],['스트리머 풀','nav','spool'],['방송 데이터','nav','sdata'],['PPL 가이드','g','gd_astra_ppl'],['광고 제안서','p','pp_eden']]}};
function demoKind(){try{const p=new URLSearchParams(location.search).get('demo');return DEMO_META[p]?p:''}catch(e){return ''}}
window.DEMO_KIND=demoKind();
const DEMO_EDIT=(()=>{try{return !!window.DEMO_KIND&&new URLSearchParams(location.search).get('edit')==='1'}catch(e){return false}})();
const DEMO_PUB='demo_';const DEMO_CHUNK=250000;
function demoQs(){return 'demo='+window.DEMO_KIND+(DEMO_EDIT?'&edit=1':'')}

/* ---- 체험판 데이터: 게시본(Firestore) → 없으면 기본 JSON ---- */
async function demoFetchPublished(k){const cfg=window.FIREBASE_CONFIG||{};if(!cfg.projectId)return null;
  const base=`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/public/`;const q='?key='+encodeURIComponent(cfg.apiKey||'');
  const get=async id=>{const r=await fetch(base+id+q,{cache:'no-store'});if(!r.ok)return null;const j=await r.json();return j&&j.fields||null};
  const h=await get(DEMO_PUB+k);if(!h||!h.parts)return null;const N=+(h.parts.integerValue||0);if(!N||N>60)return null;
  const parts=await Promise.all([...Array(N)].map((_,i)=>get(DEMO_PUB+k+'_'+i)));if(parts.some(p=>!p||!p.d))return null;
  const snap=JSON.parse(parts.map(p=>p.d.stringValue||'').join(''));snap.v=(h.v&&h.v.stringValue)||snap.v;snap.src='published';snap.at=(h.at&&h.at.stringValue)||'';snap.by=(h.by&&h.by.stringValue)||'';return snap}
async function demoFetchDefault(k){const r=await fetch('/demo/'+k+'.json?v=0.27',{cache:'no-cache'});if(!r.ok)throw new Error('demo data');const s=await r.json();s.src='default';return s}
/* 기준일(base) → 오늘로 날짜 옮기기: 문자열 안의 YYYY-MM-DD 를 같은 날짜 수만큼 이동 */
function demoShift(snap){const base=snap.base;const now=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);if(!base||base===now)return snap.data;
  const days=Math.round((Date.parse(now)-Date.parse(base))/864e5);if(!days)return snap.data;
  const s=JSON.stringify(snap.data).replace(/\b(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?=T|\b)/g,m=>{const t=Date.parse(m+'T00:00:00Z');return isNaN(t)?m:new Date(t+days*864e5).toISOString().slice(0,10)});
  const s2=s.replace(/(_|"d":")(20\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?=["/])/g,(m,p,y,mo,da)=>{const t=Date.parse(`${y}-${mo}-${da}T00:00:00Z`);return isNaN(t)?m:p+new Date(t+days*864e5).toISOString().slice(0,10).replace(/-/g,'')});
  return JSON.parse(s2)}
async function demoKitStore(k){let snap=null;
  try{snap=await demoFetchPublished(k)}catch(e){console.warn('demo published',e)}
  if(!snap)snap=await demoFetchDefault(k);
  A.demoSnap={v:snap.v,src:snap.src,at:snap.at||'',by:snap.by||'',base:snap.base};
  const key='ringcoms_demo_'+k+(DEMO_EDIT?'_edit':'');
  const data=demoShift(snap);
  const st=demoStore({key,snap:{v:snap.v+'|'+new Date(Date.now()+9*3600e3).toISOString().slice(0,10),data}});
  st.kit=k;return st}

/* ---- 외부 연동 막기: 체험판에서는 서버 함수·외부 API를 부르지 않음 ---- */
const DEMO_BLOCK_MSG='체험판에서는 실제 외부 연동(데이터 수집·AI·발송)이 실행되지 않습니다. 도입하시면 바로 쓸 수 있어요.';
if(window.DEMO_KIND){const of=window.fetch.bind(window);
  window.fetch=function(u,o){const s=typeof u==='string'?u:(u&&u.url)||'';
    if(/^\/api\//.test(s)||/^https?:\/\/[^/]*ringcoms\.com\/api\//.test(s)||/googleapis\.com\/youtube\//.test(s))return Promise.reject(new Error(DEMO_BLOCK_MSG));
    return of(u,o)}}


/* ---- 체험판 제한 기능: 실제 데이터 수집 · AI · 발송 · 연동 설정 버튼은 눌러도 실행하지 않고 안내만 ---- */
const DEMO_LOCK={
  data:['chFetch','ytFetch','skFetchAll','skFetchOne','spFetch','sdFetch','sdRec','rqSync','rqSheetCheck'],
  ai:['guideAi','ppAi','ppDisc','rqAi','revRun','revRetry','canvaGo','ppCanva'],
  send:['rqThPost','rqThConnect','rqForm','msSend','msRemind','msSyncBtn','inviteClient','addAdmin'],
  set:['msSave','metaSave','saveYtKey','intCheck','metaRecheck','msRecheck','aiRecheck','updGo','opsRefresh']};
const DEMO_LOCK_MSG={data:'성과 데이터 업데이트(조회수·방송 불러오기 등)는 체험판에서 실행되지 않습니다. 화면의 수치는 미리 넣어 둔 가상 데이터입니다.',
  ai:'AI 생성·검수 기능은 체험판에서 실행되지 않습니다. 미리 만들어 둔 결과를 둘러보세요.',
  send:'발송·게시·초대 기능은 체험판에서 실행되지 않습니다.',set:'연동 설정은 체험판에서 바꿀 수 없습니다.'};
const DEMO_LOCK_OF={};for(const k in DEMO_LOCK)DEMO_LOCK[k].forEach(a=>DEMO_LOCK_OF[a]=k);
if(window.DEMO_KIND){
  window.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-act]');if(!a)return;const k=DEMO_LOCK_OF[a.dataset.act];if(!k)return;
    e.preventDefault();e.stopImmediatePropagation();toast(DEMO_LOCK_MSG[k])},true);
  const st=document.createElement('style');st.textContent=Object.keys(DEMO_LOCK_OF).map(a=>`[data-act="${a}"]`).join(',')+`{opacity:.55;cursor:not-allowed!important}`+
    Object.keys(DEMO_LOCK_OF).map(a=>`button[data-act="${a}"]::after`).join(',')+`{content:" 🔒";font-size:.85em}`;document.head.appendChild(st)}

/* ---- 메뉴: 체험판 유형에 맞는 메뉴만 ---- */
function demoNav(groups){const k=window.DEMO_KIND;
  const keep=k==='str'?new Set(['stream','spool','sdata','guides','proposals','team:accts']):new Set(['list','trial','gb','live','pool','recruit','guides','review','aivideo','proposals','team:accts']);
  return groups.map(g=>({...g,items:g.items.filter(it=>keep.has(it.tt?it.v+':'+it.tt:it.v)).map(it=>it.tt==='accts'?{...it,l:'광고주 계정'}:it)})).filter(g=>g.items.length).map(g=>g.t==='구성요소 관리'?{...g,t:'계정 관리'}:g)}
if(window.DEMO_KIND&&typeof M_SEC!=='undefined'){const k=window.DEMO_KIND;
  M_SEC.camp.items=M_SEC.camp.items.filter(([v])=>k==='str'?v==='stream':v!=='stream');
  M_SEC.infl.items=M_SEC.infl.items.filter(([v])=>k==='str'?['spool','sdata'].includes(v):['pool','recruit'].includes(v));
  M_SEC.tool.items=M_SEC.tool.items.filter(([v])=>k==='str'?['guides','proposals'].includes(v):true);
  A.mLast={camp:DEMO_META[k].home,infl:DEMO_META[k].infl,tool:'guides'};
  window.mMore=function(){return `<div class="ms-who"><b>${esc(DEMO_META[k].l)} 체험판</b><span class="small muted">가상 데이터 · 이 브라우저에만 저장</span></div>
    <div class="ms-sec">계정 관리</div><button data-act="nav" data-v="team" data-tt="accts"><span>광고주 계정</span></button>
    <div class="ms-sec">체험판</div><button data-act="demoAs" data-k="${A.role==='client'?'team':'client'}"><span>${A.role==='client'?'운영사 화면으로':'광고주 화면으로 보기'}</span></button><button data-act="demoReset"><span>처음 상태로</span></button><button data-act="signOut"><span>체험 종료</span></button>`}}
if(window.DEMO_KIND==='str'&&A.sk&&!A.sk.sdSel)A.sk.sdSel='sp_demo001';
/* 체험판에서 열 수 있는 화면 */
function demoAllowed(v){const k=window.DEMO_KIND;if(!k)return true;const ok=k==='str'?['stream','spool','sdata','guides','proposals','team','campaign','create','mhome','cv','cvc','acct','demoadm']:['list','trial','gb','live','pool','recruit','guides','review','aivideo','proposals','team','campaign','create','mhome','cv','cvc','acct'];return ok.includes(v)}

/* ---- 상단 바 · 안내 띠 ---- */
function demoWho(){const k=window.DEMO_KIND;const cl=A.role==='client';
  return `<span class="pill warn" title="가상 데이터로 둘러보는 체험판입니다">${esc(DEMO_META[k].l)} 체험판</span>${DEMO_EDIT?'<span class="pill crit">마스터 편집</span>':''}
   <button class="btn sm ghost" data-act="demoAs" data-k="${cl?'team':'client'}" title="${cl?'링컴즈(운영사) 화면으로 돌아갑니다':'광고주 계정으로 로그인했을 때의 화면입니다'}">${cl?'운영사 화면':'광고주 화면으로 보기'}</button>
   <button class="btn sm ghost" data-act="demoReset">${A.confirm==='reset'?'한 번 더 누르면 처음 상태로':'처음 상태로'}</button>`}
function demoBanner(){const k=window.DEMO_KIND;if(!k)return '';const M=DEMO_META[k];let hide=false;try{hide=sessionStorage.getItem('ring_demo_tip_'+k)==='0'}catch(e){}
  const tour=A.role==='client'?'':`<div class="dm-tour">${M.tour.map(([l,t,to],i)=>`<button class="dm-step" data-act="demoGo" data-t="${t}" data-to="${esc(to)}"><i>${i+1}</i>${esc(l)}</button>`).join('')}</div>`;
  const edit=DEMO_EDIT?demoEditBar():'';
  if(hide)return edit+`<div class="dm-mini noprint"><span>${esc(M.l)} 체험판 · 가상 데이터</span><button class="btn sm ghost" data-act="demoTip" data-k="1">둘러보기 순서 보기</button></div>`;
  return edit+`<div class="dm-banner noprint"><div class="dm-h"><div><b>${A.role==='client'?'광고주 계정으로 보는 화면입니다':'링컴즈 캠페인 관리 플랫폼 체험판'}</b>
   <p>${A.role==='client'?'광고주(클라이언트) 계정은 링컴즈가 공개한 캠페인의 진행 현황을 보고, 인플루언서 진행 여부를 바로 컨펌할 수 있습니다. 비용·연락처·주소는 보이지 않습니다.':`미리 만들어 둔 <b>가상 캠페인</b>으로 실제 화면을 그대로 둘러보세요. 버튼을 눌러 보셔도 실제로 캠페인이 생성되거나 메시지가 발송되지 않고, 바꾼 내용은 이 브라우저에만 남습니다.`}</p></div>
   <button class="dm-x" data-act="demoTip" data-k="0" aria-label="안내 접기" title="안내 접기">×</button></div>${tour}
   <div class="dm-f"><span>도입 · 문의</span><a href="mailto:ac@ringcoms.com?subject=${encodeURIComponent('[캠페인 관리 플랫폼] 도입 문의')}">ac@ringcoms.com</a><span class="dm-sep">·</span><span>링컴즈 MCN 사업부 광고콘텐츠팀</span></div></div>`}

/* ---- 마스터 편집 · 게시 ---- */
A.dmPub=A.dmPub||{user:null,master:false,busy:false};
function demoEditBar(){const P=A.dmPub;const S=A.demoSnap||{};
  const src=S.src==='published'?`게시본 · ${S.at?new Date(S.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}${S.by?' · '+esc(S.by):''}`:'기본 체험판 (아직 게시한 적 없음)';
  return `<div class="dm-edit noprint"><div><b>마스터 편집 모드</b><p>지금 화면에서 캠페인·가이드·풀 등을 고친 뒤 <b>체험판에 게시</b>를 누르면 모든 방문자에게 이 상태가 보입니다. 게시 전까지는 이 브라우저에만 저장됩니다. <span class="muted">현재 방문자에게 보이는 것: ${src}</span></p></div>
   <div class="row">${P.master?`<span class="pill ok">${esc(P.user)}</span><button class="btn sm primary" data-act="demoPublish" ${P.busy?'disabled':''}>${P.busy?'게시 중…':A.confirm==='dmPub'?'한 번 더 누르면 게시':'체험판에 게시'}</button>${S.src==='published'?`<button class="btn sm" data-act="demoUnpublish" ${P.busy?'disabled':''}>${A.confirm==='dmUnpub'?'한 번 더 누르면 기본값으로':'게시 취소(기본값)'}</button>`:''}`
     :`<button class="btn sm primary" data-act="demoLogin" ${P.busy?'disabled':''}>${P.busy?'확인 중…':'마스터 Google 로그인'}</button>`}</div></div>`}
let DM_FB=null;
async function demoFb(){if(DM_FB)return DM_FB;const V='10.12.2',B=`https://www.gstatic.com/firebasejs/${V}/`;
  const ld=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)});
  if(!window.firebase)await ld(B+'firebase-app-compat.js');if(!firebase.auth)await ld(B+'firebase-auth-compat.js');if(!firebase.firestore)await ld(B+'firebase-firestore-compat.js');
  const app=firebase.apps.find(a=>a.name==='[DEFAULT]')||firebase.initializeApp(window.FIREBASE_CONFIG);DM_FB={fs:app.firestore(),au:app.auth()};return DM_FB}
async function demoPublishTo(fs,k,dump,by){
  const skip=/^(threads|opsdemo|sessions)\//;const data={};for(const p in dump)if(!skip.test(p))data[p]=dump[p];
  const v=String(Date.now());const base=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
  const s=JSON.stringify({base,data});const parts=[];for(let i=0;i<s.length;i+=DEMO_CHUNK)parts.push(s.slice(i,i+DEMO_CHUNK));
  if(parts.length>60)throw new Error('체험판 데이터가 너무 큽니다 (이미지를 줄여 주세요).');
  for(let i=0;i<parts.length;i++)await fs.doc(`public/${DEMO_PUB}${k}_${i}`).set({d:parts[i]});
  const at=new Date().toISOString();await fs.doc(`public/${DEMO_PUB}${k}`).set({parts:parts.length,v,at,by,size:s.length});return {v,at,parts:parts.length,size:s.length}}

Object.assign(ACT,{
  demoGo(a){const t=a.dataset.t,to=a.dataset.to;if(t==='nav'){A.drawer=null;if(A.unsubRows){A.unsubRows();A.unsubRows=null;A.rowsDoc=null}A.view=to;if(to==='guides')A.gid='';if(to==='proposals')A.pid='';if(to==='recruit')A.rcid='';if(to==='stream')A.sid='';render();window.scrollTo(0,0);return}
    if(t==='g'||t==='p'){A.drawer=null;if(A.unsubRows){A.unsubRows();A.unsubRows=null;A.rowsDoc=null}A.view=t==='g'?'guides':'proposals';if(t==='g'){A.gid=to;A.gsub='all'}else{A.pid=to;A.ptab='preview'}render();window.scrollTo(0,0);return}
    const [cid,tab]=to.split(':');if(!A.campaigns[cid]){toast('이 캠페인은 체험판에서 삭제되었습니다. 「처음 상태로」를 누르면 다시 생깁니다.','crit');return}openCampaign(cid,tab||'overview')},
  demoTip(a){try{sessionStorage.setItem('ring_demo_tip_'+window.DEMO_KIND,a.dataset.k)}catch(e){}render()},
  demoAs(a){const k=a.dataset.k;try{sessionStorage.setItem('ring_demo_as',k==='client'?'client':'team')}catch(e){}location.href=location.pathname+'?'+demoQs()+'&as='+(k==='client'?'client':'team')},
  async demoLogin(){const P=A.dmPub;P.busy=true;render();
    try{const {fs,au}=await demoFb();let u=au.currentUser;if(!u){const r=await au.signInWithPopup(new firebase.auth.GoogleAuthProvider());u=r.user}
      const em=String(u.email||'').toLowerCase();const d=await fs.doc('admins/'+em).get();const a=d.exists?d.data():null;
      if(!a||(a.acct&&a.acct!=='ringcoms')||a.role!=='master'){P.master=false;toast('마스터 계정만 체험판을 게시할 수 있습니다.','crit')}else{P.master=true;P.user=em;toast('마스터 확인 완료 — 고친 뒤 「체험판에 게시」를 누르세요.')}}
    catch(e){console.error(e);toast('로그인하지 못했습니다: '+(e.message||e),'crit')}finally{P.busy=false;render()}},
  async demoPublish(){const P=A.dmPub;if(!P.master)return;if(A.confirm!=='dmPub'){A.confirm='dmPub';render();return}A.confirm=null;P.busy=true;render();
    try{const {fs}=await demoFb();const r=await demoPublishTo(fs,window.DEMO_KIND,DB.dump(),P.user);A.demoSnap={...(A.demoSnap||{}),src:'published',at:r.at,by:P.user,v:r.v};toast(`체험판에 게시했습니다 (${Math.round(r.size/1024)}KB). 방문자가 새로 열면 바로 보입니다.`)}
    catch(e){console.error(e);toast('게시하지 못했습니다: '+(e.code==='permission-denied'?'권한이 없습니다.':(e.message||e)),'crit')}finally{P.busy=false;render()}},
  async demoUnpublish(){const P=A.dmPub;if(!P.master)return;if(A.confirm!=='dmUnpub'){A.confirm='dmUnpub';render();return}A.confirm=null;P.busy=true;render();
    try{const {fs}=await demoFb();await fs.doc(`public/${DEMO_PUB}${window.DEMO_KIND}`).delete();A.demoSnap={...(A.demoSnap||{}),src:'default',at:'',by:''};toast('게시를 취소했습니다. 방문자에게는 기본 체험판이 보입니다.')}
    catch(e){toast('취소하지 못했습니다: '+(e.message||e),'crit')}finally{P.busy=false;render()}}});
if(window.CONFIRM_ACTS)window.CONFIRM_ACTS.push('demoPublish','demoUnpublish');else window.CONFIRM_ACTS=['demoPublish','demoUnpublish'];

/* ---- 운영 사이트: 마스터 전용 「체험판 관리」 화면 ---- */
function viewDemoAdm(){if(!isMaster())return `<div class="panel empty">마스터만 볼 수 있습니다.</div>`;const o=location.origin;
  if(!A.dmInfo&&!A.dmInfoBusy){A.dmInfoBusy=true;Promise.all(['inf','str'].map(k=>DB.get('public/'+DEMO_PUB+k).catch(()=>null))).then(([i,s])=>{A.dmInfo={inf:i,str:s};A.dmInfoBusy=false;scheduleRender()})}
  const I=A.dmInfo||{};
  const card=(k,desc)=>{const h=I[k];const link=o+'/demo/'+k;return `<section class="panel"><div class="panel-h"><div><h2>${DEMO_META[k].who}</h2><div class="sub">${desc}</div></div>${h?`<span class="pill ok">게시본 사용 중</span>`:'<span class="pill">기본 체험판</span>'}</div>
    <dl class="kv" style="grid-template-columns:auto 1fr"><dt>방문자 링크</dt><dd style="text-align:left;font-weight:400"><code>${esc(link)}</code> <button class="btn sm" data-act="dmCopy" data-u="${esc(link)}">복사</button></dd>
    <dt>마지막 게시</dt><dd style="text-align:left;font-weight:400">${h?`${esc(new Date(h.at).toLocaleString('ko-KR'))} · ${esc(h.by||'')} · ${Math.round(n(h.size)/1024)}KB`:'아직 없음 — 기본 체험판이 보입니다'}</dd></dl>
    <div class="row" style="margin-top:10px"><a class="btn primary" href="/?demo=${k}&edit=1" target="_blank" rel="noopener">체험판 내용 수정</a><a class="btn" href="/?demo=${k}" target="_blank" rel="noopener">방문자 화면 보기</a></div></section>`};
  return `<div class="page-h"><div><h1>체험판 관리</h1><div class="sub">광고주·대행사에게 보내는 체험판(데모) 링크입니다. 가상 데이터라 실제 캠페인·인플루언서 정보는 노출되지 않습니다.</div></div><div class="row"><a class="btn" href="/demo/" target="_blank" rel="noopener">체험판 첫 화면</a><button class="btn" data-act="dmCopy" data-u="${esc(o+'/demo/')}">첫 화면 링크 복사</button></div></div>
   <div class="stack">${card('inf','시딩·체험단·공동구매·라이브커머스 캠페인, 콘텐츠 가이드, 성과 리포트, 인플루언서 풀·모집, 광고 제안서')}${card('str','스트리머 PPL·프로모션 캠페인, 방송 매칭 리포트, 스트리머 풀·방송 데이터, PPL 가이드, 광고 제안서')}
   <section class="panel"><h2>수정하는 방법</h2><ol class="steps" style="margin-top:8px"><li>「체험판 내용 수정」을 누르면 편집용 체험판이 새 창으로 열립니다.</li><li>평소처럼 캠페인·그룹·가이드·풀 내용을 고칩니다 (이 브라우저에만 저장).</li><li>상단 「마스터 Google 로그인」 → 「체험판에 게시」를 누르면 모든 방문자에게 반영됩니다.</li><li>잘못 게시했다면 「게시 취소(기본값)」로 기본 체험판으로 되돌릴 수 있습니다.</li></ol></section></div>`}
ACT.dmCopy=a=>{copyText(a.dataset.u);toast('링크를 복사했습니다.')};

/* ---- 화면 스타일 ---- */
(function(){const s=document.createElement('style');s.textContent=`
.dm-banner{border:1px solid color-mix(in srgb,var(--accent,#2347D4) 30%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--accent,#2347D4) 9%,var(--panel,#fff)),var(--panel,#fff) 60%);border-radius:14px;padding:16px 18px 12px;margin:0 0 16px}
.dm-h{display:flex;gap:12px;align-items:flex-start}.dm-h>div{flex:1}.dm-h b{font-size:15px}.dm-h p{margin:4px 0 0;font-size:13px;line-height:1.6;color:var(--muted,#5b6475)}
.dm-x{border:0;background:transparent;font-size:20px;line-height:1;cursor:pointer;color:var(--muted,#5b6475);padding:2px 6px;border-radius:6px}.dm-x:hover{background:rgba(0,0,0,.06)}
.dm-tour{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.dm-step{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e3e6ec);background:var(--panel,#fff);border-radius:999px;padding:5px 11px 5px 5px;font:inherit;font-size:12.5px;cursor:pointer;color:inherit}
.dm-step:hover{border-color:var(--accent,#2347D4);color:var(--accent,#2347D4)}
.dm-step i{font-style:normal;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--accent,#2347D4);color:#fff;font-size:11px;font-weight:700}
.dm-f{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;font-size:12px;color:var(--muted,#5b6475)}.dm-f a{font-weight:600;color:var(--accent,#2347D4)}.dm-sep{opacity:.5}
.dm-mini{display:flex;align-items:center;gap:8px;justify-content:space-between;font-size:12.5px;color:var(--muted,#5b6475);margin:0 0 12px}
.dm-edit{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;border:1px dashed #C2410C;background:color-mix(in srgb,#C2410C 7%,var(--panel,#fff));border-radius:12px;padding:12px 16px;margin:0 0 12px}
.dm-edit>div:first-child{flex:1;min-width:260px}.dm-edit p{margin:3px 0 0;font-size:12.5px;line-height:1.55}
@media (max-width:720px){.dm-banner{padding:14px 14px 10px}.dm-tour{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;margin-inline:-2px}.dm-step{flex:none}.top .who .btn[data-act=demoAs],.top .who .btn[data-act=demoReset]{display:none}}
`;document.head.appendChild(s)})();
