/* RINGCOMS 캠페인 관리 · 스레드 모집 (v0.22 · v0.23 이름 변경)
   인플루언서 관리 > 스레드 모집
   - 광고주 홈페이지·앱 정보·상품소개서 → AI(Gemini, /api/recruit)가 스레드 모집 글 + 구글폼 문항 초안
   - 화면에서 고치고 복사·붙여넣기, 또는 로그인한 팀원 본인의 스레드 계정으로 바로 게시 (/api/threads)
   - 구글폼·신청자 시트·축약 링크(ad.ringcoms.com/l/코드) 자동 생성 — 로그인한 Google 계정 권한(drive.file)으로 브라우저에서 직접 만듦
   - 신청자 불러오기 → 시트에 정리 → 선택한 신청자를 캠페인 인플루언서 관리에 추가(→ 인플루언서 풀 자동 누적)
   - 캠페인·콘텐츠 가이드 연결, 캠페인별 1차·2차… 차수 관리
   데이터: recruits/{id} · threads/{이메일}(본인만) · links/{코드}(kind: recruit) · linkstat/{코드}_v
   index.html·tools.js·proposal.js 의 전역 함수·상태(A, DB, ACT, render, esc, newGuide, readSrc …)를 그대로 씁니다. */

/* ============ 아이콘 · 권한 ============ */
window.TOOL_IC=window.TOOL_IC||{};
window.TOOL_IC.recruit='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.5V9a1 1 0 0 1 1-1h3l7-4v16l-7-4H5a1 1 0 0 1-1-1v-2.5"/><path d="M8 16l1.2 4.2a1 1 0 0 0 1 .8h1.3"/><path d="M18.5 9.5a3.5 3.5 0 0 1 0 5"/></svg>';
['rqNew','rqCreate','rqDel','rqAi','rqQAdd','rqQDel','rqQUp','rqQReset','rqOptAdd','rqOptDel','rqReplyAdd','rqReplyDel','rqForm','rqFormManual','rqFormReset','rqSync','rqAddCamp','rqAddPool','rqThConnect','rqThOff','rqThPost','rqGuideNew','rqNext','rqSrcDel','rqDup'].forEach(k=>WRITE_ACTS.add(k));
window.CONFIRM_ACTS=[...(window.CONFIRM_ACTS||[]),'rqDel','rqThPost','rqFormReset','rqThOff'];

/* ============ 상수 ============ */
const RQ_ST=['작성 중','모집 중','마감'];
const RQ_KINDS=['체험단','시딩(유료 협찬)','공동구매','라이브커머스','기타'];
const RQ_CH=['인스타그램','틱톡','유튜브','네이버 블로그'];
const RQ_QT={short:'단답형',paragraph:'장문형',radio:'객관식',checkbox:'체크박스',dropdown:'드롭다운'};
const RQ_KEYS=[['','기타 (메모에 붙임)'],['name','활동명'],['realname','실명'],['ch','채널'],['chlink','채널 링크'],['fol','팔로워 수'],['cat','카테고리'],['contact','연락처'],['email','이메일'],['addr','주소'],['offer','희망 원고료'],['memo','신청 이유·메모'],['agree','개인정보 동의']];
const RQ_KEYL=Object.fromEntries(RQ_KEYS);
const RQ_MAX=500; // 스레드 글 1개 글자 수 한도
const RQ_LINK='{링크}';
const RQ_GSCOPE='https://www.googleapis.com/auth/drive.file';
const RQ_CAT=['뷰티','패션','푸드','라이프스타일','육아','반려동물','여행','운동·건강','테크·IT','게임','교육','기타'];
const rqKindOf=c=>{const k=c?kindOf(c):'';return k==='trial'?'체험단':k==='gb'?'공동구매':k==='live'?'라이브커머스':k==='seed'?'시딩(유료 협찬)':'체험단'};
const rqTrial=k=>/체험|무상|협찬/.test(k||'')&&!/유료/.test(k||'');
const rqLen=s=>[...String(s||'')].length;
const rqQ=(key,type,title,o={})=>({id:'q'+Math.random().toString(36).slice(2,8),key,type,title,desc:o.desc||'',opts:o.opts||[],req:!!o.req,...(o.ai?{ai:true}:{})});
function rqDefaultQs(kind){const T=rqTrial(kind);return [
  rqQ('name','short','활동명 (채널 닉네임)',{req:true}),
  rqQ('realname','short','성함 (실명)',{req:true}),
  rqQ('ch','radio','주로 활동하는 채널',{req:true,opts:[...RQ_CH]}),
  rqQ('chlink','short','채널 링크 (프로필 주소)',{req:true,desc:'예: https://www.instagram.com/계정이름'}),
  rqQ('fol','short','팔로워(구독자) 수',{req:true,desc:'숫자로 적어 주세요. 예: 12000'}),
  rqQ('cat','dropdown','주요 콘텐츠 카테고리',{opts:[...RQ_CAT]}),
  rqQ('contact','short','연락처 (휴대폰 번호)',{req:true}),
  rqQ('email','short','이메일',{}),
  ...(T||kind==='공동구매'?[rqQ('addr','paragraph','제품 받을 주소 (우편번호 포함)',{req:T})]:[]),
  ...(/유료/.test(kind||'')?[rqQ('offer','short','희망 원고료 (원, 협의 가능)',{desc:'예: 300000'})]:[]),
  rqQ('memo','paragraph','신청 이유 · 콘텐츠 아이디어',{}),
  rqQ('agree','radio','개인정보 수집·이용 동의',{req:true,opts:['동의합니다'],desc:'수집 항목: 이름·연락처·이메일·주소·채널 정보\n이용 목적: 캠페인 선정·제품 발송·진행 연락\n보유 기간: 캠페인 종료 후 6개월 뒤 파기\n동의하지 않으면 신청할 수 없습니다.'})]}
/* 구글폼에서 문항을 직접 바꿨을 때: 제목으로 어떤 정보인지 짐작 */
function rqGuessKey(t){const s=String(t||'').toLowerCase().replace(/\s+/g,'');
  if(/동의/.test(s))return 'agree';if(/실명|성함|본명/.test(s))return 'realname';if(/(채널|프로필|sns|인스타|계정).*(링크|주소|url)|url/.test(s))return 'chlink';if(/팔로워|구독자/.test(s))return 'fol';
  if(/활동명|닉네임|채널명/.test(s))return 'name';if(/이메일|메일|email/.test(s))return 'email';if(/연락처|휴대폰|전화|핸드폰/.test(s))return 'contact';if(/주소|배송/.test(s))return 'addr';
  if(/카테고리|분야/.test(s))return 'cat';if(/채널|플랫폼|매체/.test(s))return 'ch';if(/원고료|단가|희망금액/.test(s))return 'offer';if(/이름/.test(s))return 'name';if(/신청이유|아이디어|하고싶은말/.test(s))return 'memo';return ''}

/* ============ 상태 · 불러오기 ============ */
A.rq=A.rq||{F:{st:'',cid:'',q:''},sel:new Set(),tab:'src',visits:{}};
function rqWatch(){if(rqWatch.on||!isTeam())return;rqWatch.on=true;
  DB.watchCol('recruits',m=>{A.recruits=m;A.recLoaded=true;rqAiCheck();scheduleRender()},()=>{A.recLoaded=true;A.recErr=true;scheduleRender()});
  if(typeof ensureToolWatch==='function')ensureToolWatch();rqThStatus()}
const rqCur=()=>A.rcid&&A.recruits?A.recruits[A.rcid]:null;
async function rqSave(id,up){if(!canEdit())return;try{await DB.update('recruits/'+id,{...up,updatedAt:T_NOW(),by:A.user.email})}catch(e){saveErr(e)}}
const rqShort=r=>r&&r.form&&r.form.code?trkBase()+r.form.code:'';
const rqFill=(t,r)=>String(t||'').split(RQ_LINK).join(rqShort(r)||RQ_LINK);
const rqLinkLen=r=>rqShort(r)?rqLen(rqShort(r)):31; // 축약 링크 예상 길이 (https://ad.ringcoms.com/l/xxxxxx)
const rqCount=(t,r)=>rqLen(String(t||'').split(RQ_LINK).join('x'.repeat(rqLinkLen(r))));
const rqApps=r=>Object.entries((r&&r.apps)||{}).map(([k,a])=>({k,...a})).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
const rqCampName=cid=>cid&&A.campaigns[cid]?A.campaigns[cid].name:'';

/* ============ 스레드 계정 (로그인한 팀원별) ============ */
A.th=A.th||{loaded:false};
async function rqThStatus(force){if(A.th.busy||(A.th.loaded&&!force))return;A.th.busy=true;
  try{if(DB.mode==='demo'){const d=await DB.get('threads/'+A.user.email);A.th={loaded:true,connected:!!(d&&d.token),username:d&&d.username||'',exp:d&&d.exp||'',ready:true}}
    else{const [s,c]=await Promise.all([aiFetch('/api/threads',{action:'status'}).catch(e=>({error:e.message})),aiFetch('/api/threads',{action:'config'}).catch(()=>({}))]);
      A.th={loaded:true,connected:!!s.connected,username:s.username||'',pic:s.pic||'',exp:s.exp||'',ready:!!c.ready,appId:c.appId||'',err:s.error||''}}}
  catch(e){A.th={loaded:true,connected:false,err:e.message}}A.th.busy=false;scheduleRender()}
function rqThChip(){const t=A.th||{};if(!t.loaded)return '<span class="pill">스레드 확인 중…</span>';
  const soon=t.exp&&new Date(t.exp).getTime()-Date.now()<7*864e5;
  if(t.connected)return `<span class="rq-th on" title="이 계정(${esc(A.user.email)})에 연결된 스레드 계정${t.exp?` · ${md(t.exp.slice(0,10))}까지 (게시할 때 자동 연장)`:''}">${RQ_TH_IC}<b>@${esc(t.username||'연결됨')}</b>${soon?'<em>만료 임박</em>':''}</span>${canEdit()?`<button class="btn sm ghost" data-act="rqThConnect">다시 연결</button><button class="btn sm ghost" data-act="rqThOff">${A.confirm==='rqThOff'?'한 번 더 누르면 해제':'연결 해제'}</button>`:''}`;
  return canEdit()?`<button class="btn sm" data-act="rqThConnect" title="로그인한 계정(${esc(A.user.email)})에 내 스레드 계정을 연결합니다">${RQ_TH_IC} 스레드 계정 연결</button>`:'<span class="pill">스레드 미연결</span>'}
const RQ_TH_IC='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M16.5 11.2c-.3-2.6-1.9-4-4.4-4-2.6 0-4.3 1.8-4.3 4.8s1.7 4.8 4.3 4.8c2 0 3.4-1 3.8-2.8.5-2.3-1.2-3.5-3.6-3.5-1.7 0-2.8.8-2.8 2 0 1.1 1 1.8 2.2 1.8 2.3 0 3.4-1.8 3.4-4.4"/><path d="M19 7.5C17.6 4.9 15.2 3.5 12 3.5c-5 0-8 3.3-8 8.5s3 8.5 8 8.5c3.4 0 5.9-1.6 7.1-4.5"/></svg>';
/* 연동 관리 화면: 스레드 (앱 준비 상태 + 로그인한 팀원 본인의 연결) */
function rqThPill(){const t=A.th||{};if(!t.loaded)return '<span class="pill">확인 중…</span>';if(t.connected)return '<span class="pill ok">연결됨</span>';if(!t.ready&&DB.mode!=='demo')return '<span class="pill warn">앱 미연결</span>';return '<span class="pill warn">내 계정 미연결</span>'}
function rqThRow(row){if(!canEdit())return '';if(!(A.th||{}).loaded)setTimeout(()=>rqThStatus(),0);const t=A.th||{};
  return row('Threads API',rqThPill(),'스레드 모집 글을 로그인한 팀원의 스레드 계정으로 바로 게시 (본문 + 이어 쓰기)'+(t.connected?`<div class="small" style="margin-top:6px">내 연결 <b>@${esc(t.username||'')}</b>${t.exp?` · ${md(String(t.exp).slice(0,10))}까지 (게시할 때 자동 연장)`:''}</div>`:''),'아래 스레드 연결 · Netlify 환경변수 <code>THREADS_APP_ID</code> · <code>THREADS_APP_SECRET</code>')}
function rqThIntPanel(){if(!canEdit())return '';if(!(A.th||{}).loaded)setTimeout(()=>rqThStatus(),0);const t=A.th||{};const soon=t.exp&&new Date(t.exp).getTime()-Date.now()<7*864e5;
  return `<section class="panel"><div class="panel-h"><div><h2>스레드(Threads) 연결</h2><div class="sub">스레드 모집 글을 바로 게시할 때 씁니다. 연결은 로그인한 팀원 계정마다 따로 저장되고 본인만 쓸 수 있습니다.</div></div><div class="row">${rqThPill()}<button class="btn sm ghost" data-act="rqThRecheck">다시 확인</button></div></div>
   <dl class="kv" style="grid-template-columns:auto 1fr;margin-bottom:12px"><dt>Threads 앱</dt><dd style="text-align:left;font-weight:400">${t.ready||DB.mode==='demo'?`<span class="pill ok">준비됨</span>${t.appId?` <span class="muted small">앱 ID ${esc(t.appId)}</span>`:''}`:'<span class="pill warn">미연결</span> <span class="small muted">Netlify 환경변수 THREADS_APP_ID · THREADS_APP_SECRET 필요</span>'}</dd>
    <dt>내 스레드 계정</dt><dd style="text-align:left;font-weight:400">${t.connected?`<b>@${esc(t.username||'')}</b> <span class="muted small">${esc(A.user.email)}에 연결</span>${t.exp?` · ${md(String(t.exp).slice(0,10))}까지${soon?' <span class="pill warn">만료 임박</span>':''}`:''}`:'<span class="muted">연결 안 됨</span>'}${t.err?`<br><span class="small" style="color:var(--crit,#d33)">${esc(t.err)}</span>`:''}</dd></dl>
   <div class="row">${t.connected?`<button class="btn" data-act="rqThConnect">다시 연결</button><button class="btn danger" data-act="rqThOff">${A.confirm==='rqThOff'?'한 번 더 누르면 해제':'연결 해제'}</button>`:`<button class="btn primary" data-act="rqThConnect" ${t.ready||DB.mode==='demo'?'':'disabled'}>${RQ_TH_IC} 내 스레드 계정 연결</button>`}<button class="btn sm ghost" data-act="rqThHelp">${A.rq.thHelp?'준비 방법 닫기':'준비 방법 보기'}</button></div>
   ${A.rq.thHelp?`<div style="margin-top:12px">${rqThHelp()}</div>`:''}</section>`}
/* 연결: 팝업 → threads.net 로그인·허용 → /threads-callback.html 이 code를 돌려줌 → 서버가 60일 토큰으로 바꿔 저장 */
function rqThOpen(){
  if(DB.mode==='demo'){DB.set('threads/'+A.user.email,{token:'demo',username:'ringcoms_mcn',exp:new Date(Date.now()+60*864e5).toISOString(),email:A.user.email}).then(()=>{toast('데모: 스레드 계정 @ringcoms_mcn 을 연결했습니다.');rqThStatus(true)});return}
  const t=A.th||{};if(!t.ready||!t.appId){toast('스레드 앱 연결 정보(THREADS_APP_ID·THREADS_APP_SECRET)가 아직 Netlify에 없습니다. 연결 방법은 아래 안내를 봐 주세요.','crit');A.rq.thHelp=true;render();return}
  const st=token().slice(0,16);try{sessionStorage.setItem('rc_th_state',st);localStorage.removeItem('rc_threads_cb')}catch(e){}
  const red=location.origin+'/threads-callback.html';
  const u='https://threads.net/oauth/authorize?'+new URLSearchParams({client_id:t.appId,redirect_uri:red,scope:'threads_basic,threads_content_publish',response_type:'code',state:st});
  const w=window.open(u,'rc_threads','width=520,height=760');if(!w){toast('팝업이 막혔습니다. 브라우저 주소창의 팝업 허용 후 다시 눌러 주세요.','crit');return}
  A.th.wait=true;render();clearInterval(rqThOpen.t);rqThOpen.t=setInterval(()=>{let m=null;try{m=JSON.parse(localStorage.getItem('rc_threads_cb')||'null')}catch(e){}if(m)rqThGot(m);else if(w.closed){clearInterval(rqThOpen.t);setTimeout(()=>{if(A.th.wait){A.th.wait=false;render()}},1500)}},700)}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.type==='rc-threads')rqThGot(e.data)});
async function rqThGot(m){clearInterval(rqThOpen.t);try{localStorage.removeItem('rc_threads_cb')}catch(e){}if(!A.th.wait)return;A.th.wait=false;
  let st='';try{st=sessionStorage.getItem('rc_th_state')||''}catch(e){}
  if(m.error){toast('스레드 연결을 취소했거나 실패했습니다: '+m.error,'crit');render();return}
  if(!m.code||(st&&m.state!==st)){toast('스레드 연결 정보가 맞지 않습니다. 다시 시도해 주세요.','crit');render();return}
  toast('스레드 계정을 연결하는 중입니다…');
  try{const j=await aiFetch('/api/threads',{action:'exchange',code:m.code,redirect:location.origin+'/threads-callback.html'});toast(`스레드 @${j.username} 계정을 연결했습니다. 이 로그인 계정에서만 쓰입니다.`);await rqThStatus(true)}
  catch(e){toast('스레드 연결 실패: '+e.message,'crit');render()}}

/* ============ Google (구글폼·시트) — 로그인한 Google 계정의 drive.file 권한 ============ */
async function rqGTok(){
  if(DB.mode==='demo')return 'demo';
  if(rqGTok.v&&rqGTok.exp>Date.now()+60000&&rqGTok.who===A.user.email)return rqGTok.v;
  const p=new firebase.auth.GoogleAuthProvider();p.addScope(RQ_GSCOPE);p.setCustomParameters({login_hint:A.user.email});
  let r;try{r=await firebase.auth().currentUser.reauthenticateWithPopup(p)}
  catch(e){if(/popup-blocked/.test(e.code||''))throw new Error('팝업이 막혔습니다. 팝업을 허용한 뒤 다시 눌러 주세요.');if(/popup-closed|cancelled/.test(e.code||''))throw new Error('Google 권한 창을 닫았습니다.');if(/user-mismatch/.test(e.code||''))throw new Error('로그인한 계정('+A.user.email+')과 같은 Google 계정을 골라 주세요.');throw e}
  const t=r&&r.credential&&r.credential.accessToken;if(!t)throw new Error('Google 권한을 받지 못했습니다.');
  rqGTok.v=t;rqGTok.exp=Date.now()+55*60000;rqGTok.who=A.user.email;return t}
async function rqG(method,url,body){const tok=await rqGTok();
  const r=await fetch(url,{method,headers:{authorization:'Bearer '+tok,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const msg=(j.error&&j.error.message)||('Google 오류 '+r.status);if(r.status===401)rqGTok.v=null;
    const api=/forms\.googleapis/.test(url)?'forms':/sheets\.googleapis/.test(url)?'sheets':'drive';
    if(/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg+JSON.stringify(j.error||''))){const e=new Error(`Google ${api==='forms'?'Forms':api==='sheets'?'Sheets':'Drive'} API가 꺼져 있습니다. 안내의 「API 사용 설정」 링크에서 켠 뒤 다시 눌러 주세요.`);e.api=api;throw e}
    if(r.status===403||r.status===404)throw new Error(msg.slice(0,200)+' — 이 폼·시트를 만든 Google 계정으로 로그인해야 불러올 수 있습니다.');
    throw new Error(msg.slice(0,240))}
  return j}
const RQ_API=api=>`https://console.cloud.google.com/apis/library/${api}.googleapis.com?project=${encodeURIComponent((window.FIREBASE_CONFIG||{}).projectId||'ringcoms-campaign')}`;

/* ============ 화면: 목록 (캠페인별 차수) ============ */
function viewRecruit(){if(!A.rq||typeof A.rq!=='object'||!A.rq.F)A.rq={F:{st:'',cid:'',q:''},sel:new Set(),tab:'src',visits:{},...(A.rq&&typeof A.rq==='object'?A.rq:{}),F:(A.rq&&A.rq.F)||{st:'',cid:'',q:''}};rqWatch();if(A.rcid)return rqEditor();
  const all=Object.entries(A.recruits||{}).map(([id,r])=>({id,...r}));const F=A.rq.F;const q=(F.q||'').trim().toLowerCase();
  const L=all.filter(r=>(!F.st||(r.status||'작성 중')===F.st)&&(!F.cid||(F.cid==='none'?!r.cid:r.cid===F.cid))&&(!q||[r.title,rqCampName(r.cid),(r.conf||{}).benefit,(r.post||{}).main].join(' ').toLowerCase().includes(q)));
  const apps=all.reduce((t,r)=>t+Object.keys(r.apps||{}).length,0),added=all.reduce((t,r)=>t+Object.values(r.apps||{}).filter(a=>a.added).length,0);
  const groups={};L.forEach(r=>{const k=r.cid&&A.campaigns[r.cid]?r.cid:'';(groups[k]=groups[k]||[]).push(r)});
  const gk=Object.keys(groups).sort((a,b)=>{if(!a)return 1;if(!b)return -1;const la=groups[a].reduce((m,r)=>String(r.updatedAt||'')>m?String(r.updatedAt||''):m,''),lb=groups[b].reduce((m,r)=>String(r.updatedAt||'')>m?String(r.updatedAt||''):m,'');return lb.localeCompare(la)});
  const camps=Object.entries(A.campaigns).filter(([,c])=>inAcctScope(c)).sort((a,b)=>String(b[1].createdAt).localeCompare(String(a[1].createdAt)));
  const usedC=[...new Set(all.map(r=>r.cid).filter(c=>c&&A.campaigns[c]))];
  const stN=s=>all.filter(r=>(r.status||'작성 중')===s).length;
  return `${rqCss()}<div class="page-h"><div><div class="eyebrow">Threads Recruit</div><h1>인플루언서 모집</h1><div class="sub">광고주 홈페이지·앱 정보·상품소개서를 올리면 AI가 스레드 모집 글과 신청 구글폼을 만들고, 신청자를 캠페인 인플루언서 관리와 인플루언서 풀로 바로 옮깁니다.</div></div>
   <div class="row">${rqThChip()}${canEdit()?'<button class="btn primary" data-act="rqNew">+ 새 모집</button>':''}</div></div>
  ${A.recErr?`<div class="banner" style="margin-bottom:12px"><b>보안 규칙 게시가 필요합니다.</b> 모집 데이터(recruits·threads)를 쓰려면 Firebase 콘솔에서 새 보안 규칙을 게시해야 합니다.</div>`:''}
  ${A.th.wait?'<div class="banner info" style="margin-bottom:12px">스레드 연결 창에서 로그인하고 「허용」을 눌러 주세요. 끝나면 이 화면이 자동으로 바뀝니다.</div>':''}
  ${A.rq.thHelp||(A.th.loaded&&!A.th.ready&&DB.mode!=='demo'&&canEdit())?rqThHelp():''}
  ${A.rq.nw?rqNewPanel():''}
  <div class="tiles" style="margin-bottom:16px"><div class="tile"><span class="l">모집 글</span><span class="v">${fmt(all.length)}</span><span class="s">캠페인 ${usedC.length}개</span></div><div class="tile"><span class="l">모집 중</span><span class="v">${fmt(stN('모집 중'))}</span><span class="s">작성 중 ${stN('작성 중')} · 마감 ${stN('마감')}</span></div><div class="tile"><span class="l">누적 신청자</span><span class="v">${fmt(apps)}</span><span class="s">구글폼에서 불러온 인원</span></div><div class="tile"><span class="l">인플루언서 관리 추가</span><span class="v">${fmt(added)}</span><span class="s">풀에도 자동으로 쌓임</span></div></div>
  <div class="row" style="margin-bottom:12px;gap:8px"><div class="chips">${[['','전체',all.length],...RQ_ST.map(s=>[s,s,stN(s)])].map(([v,l,k])=>`<span class="chip ${(F.st||'')===v?'on':''}" data-act="rqF" data-k="st" data-v="${esc(v)}">${l} <em>${k}</em></span>`).join('')}</div>
   <select id="rq-fc" data-rqf="cid" style="width:auto;max-width:240px"><option value="">모든 캠페인</option>${usedC.map(id=>`<option value="${id}" ${F.cid===id?'selected':''}>${esc(rqCampName(id))}</option>`).join('')}<option value="none" ${F.cid==='none'?'selected':''}>캠페인 미연결</option></select>
   <input type="text" id="rq-fq" data-rqf="q" value="${esc(F.q||'')}" placeholder="모집명·캠페인·제공 내역 검색" style="max-width:240px"></div>
  ${!A.recLoaded?'<div class="panel empty">불러오는 중…</div>':!all.length?`<div class="panel empty rq-empty"><b>아직 만든 모집이 없습니다.</b><span>「+ 새 모집」에서 캠페인을 고르고 광고주 정보를 넣으면, AI가 스레드 글과 신청 폼을 만들어 줍니다.</span><ol class="rq-flow"><li><i>1</i>정보 넣기<small>홈페이지 · 앱 · 소개서</small></li><li><i>2</i>스레드 글 · 구글폼<small>본문 → 폼 → 링크 → 게시</small></li><li><i>3</i>신청자<small>인플루언서 관리 · 풀</small></li></ol></div>`
  :!L.length?'<div class="panel empty">조건에 맞는 모집이 없습니다.</div>'
  :gk.map(k=>rqGroup(k,groups[k],all)).join('')}`}
function rqGroup(cid,list,all){const c=cid?A.campaigns[cid]:null;list.sort((a,b)=>(+b.round||0)-(+a.round||0)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  const nApps=list.reduce((t,r)=>t+Object.keys(r.apps||{}).length,0);const nextR=all.filter(r=>r.cid===cid).reduce((m,r)=>Math.max(m,+r.round||0),0)+1;
  const row=r=>{const ap=rqApps(r);const nw=ap.filter(a=>!a.added).length;const st=r.status||'작성 중';const late=st==='모집 중'&&(r.conf||{}).deadline&&(r.conf||{}).deadline<today();const v=A.rq.visits[r.id];
    return `<tr class="click" data-act="rqOpen" data-r="${esc(r.id)}"><td><span class="rq-rd">${r.round||1}차</span></td><td><b>${esc(r.title||'제목 없음')}</b><span class="rq-sub">${esc([(r.conf||{}).kind,(r.conf||{}).slots?(r.conf||{}).slots+'명':''].filter(Boolean).join(' · '))}</span></td>
      <td><span class="pill ${st==='모집 중'?'ok':st==='마감'?'':'accent'}">${esc(st)}</span>${late?' <span class="pill warn" title="신청 마감일이 지났습니다">마감일 지남</span>':''}</td>
      <td class="small">${r.threads&&r.threads.id?`<span class="pill ok">스레드 게시</span>`:(r.post||{}).main?'<span class="pill">글 준비</span>':'<span class="muted">–</span>'}</td>
      <td class="small">${r.form&&r.form.code?`<span class="rq-mono">/l/${esc(r.form.code)}</span>${v!=null?` <span class="muted">방문 ${fmt(v)}</span>`:''}`:'<span class="muted">폼 없음</span>'}</td>
      <td class="n"><b>${ap.length}</b>${nw&&ap.length?` <span class="pill accent" title="아직 인플루언서 관리에 추가하지 않은 신청자">새 ${nw}</span>`:''}</td>
      <td class="small">${(r.conf||{}).deadline?md((r.conf||{}).deadline):'–'}</td><td class="small">${md(String(r.updatedAt||r.createdAt||'').slice(0,10))}</td><td class="n"><button class="btn sm" data-act="rqAppsGo" data-r="${esc(r.id)}" title="신청자 목록으로 바로 이동">신청 현황 보기</button></td></tr>`};
  const card=r=>{const ap=rqApps(r);const st=r.status||'작성 중';return `<div class="mcard" data-act="rqOpen" data-r="${esc(r.id)}"><div class="mh"><span class="rq-rd">${r.round||1}차</span><div class="grow"><div class="mt">${esc(r.title||'제목 없음')}</div><div class="ms">${esc([(r.conf||{}).kind,(r.conf||{}).deadline?'마감 '+md((r.conf||{}).deadline):''].filter(Boolean).join(' · '))}</div></div><span class="pill ${st==='모집 중'?'ok':st==='마감'?'':'accent'}">${esc(st)}</span></div>
    <div class="mkv"><div><span>스레드</span><b>${r.threads&&r.threads.id?'게시됨':(r.post||{}).main?'준비':'–'}</b></div><div><span>폼</span><b>${r.form&&r.form.code?'만듦':'–'}</b></div><div><span>신청자</span><b>${ap.length}</b></div></div><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sm" data-act="rqAppsGo" data-r="${esc(r.id)}">신청 현황 보기</button></div></div>`};
  return `<section class="panel rq-grp"><div class="panel-h"><div class="row" style="gap:8px">${c?`<b class="rq-gt">${esc(c.name)}</b><span class="pill">${esc(rqKindOf(c))}</span>`:'<b class="rq-gt">캠페인 미연결</b>'}<span class="small muted">모집 ${list.length}건 · 신청 ${nApps}명</span></div>
    <div class="row">${c?`<button class="btn sm ghost" data-act="rqGoCamp" data-c="${esc(cid)}">캠페인 열기</button>`:''}${canEdit()&&c?`<button class="btn sm" data-act="rqNext" data-c="${esc(cid)}" title="가장 최근 차수의 정보·글·문항을 복사해 새 차수를 준비합니다">+ ${nextR}차 모집 추가</button>`:''}</div></div>
    <div class="tblwrap hide-m"><table class="tbl rq-tbl"><thead><tr><th style="width:56px">차수</th><th>모집</th><th>상태</th><th>스레드</th><th>신청 링크</th><th class="n">신청자</th><th>마감</th><th>수정</th><th class="n" style="width:120px"></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>
    <div class="mcards show-m">${list.map(card).join('')}</div></section>`}
function rqThHelp(){const red=(DB.mode==='demo'?'https://ad.ringcoms.com':location.origin)+'/threads-callback.html';
  return `<section class="panel rq-help" style="margin-bottom:14px"><div class="panel-h"><div><h2>스레드 계정 연결 준비 (처음 한 번)</h2><div class="sub">스레드에 바로 게시하려면 Meta 개발자 앱이 필요합니다. 준비 전에도 글 복사·붙여넣기는 그대로 쓸 수 있습니다.</div></div>${A.rq.thHelp?'<button class="btn sm ghost" data-act="rqThHelp">닫기</button>':''}</div>
   <ol class="steps"><li><a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">Meta 개발자</a>에서 앱 만들기 → 사용 사례 「Threads API 액세스」 선택</li><li>권한: <code>threads_basic</code> · <code>threads_content_publish</code> 추가</li><li>설정 → 리디렉션 콜백 URL에 <code>${esc(red)}</code> 입력</li><li>앱 역할 → 「Threads 테스터」에 팀원 스레드 계정 추가 → 각자 스레드 앱 설정 → 계정 → 웹사이트 권한 → 초대에서 수락</li><li>Netlify 환경변수 <code>THREADS_APP_ID</code> · <code>THREADS_APP_SECRET</code>(Threads 앱 ID·시크릿) 입력 후 다시 배포</li></ol>
   <p class="small muted" style="margin:8px 0 0">연결은 로그인한 팀원 계정마다 따로 저장되고, 본인만 쓸 수 있습니다. 토큰은 60일 동안 유효하며 게시할 때 자동으로 연장됩니다.</p></section>`}

/* ---- 새 모집 (입력 후 「모집 만들기」를 눌러야 저장) ---- */
function rqBlank(cid){const c=cid?A.campaigns[cid]:null;const all=Object.values(A.recruits||{});const round=(cid?all.filter(r=>r.cid===cid).reduce((m,r)=>Math.max(m,+r.round||0),0):0)+1;const kind=rqKindOf(c);
  return {cid:cid||'',gid:'',round,title:c?`${c.brand||c.advertiser||c.name} ${round}차 인플루언서 모집`:'',titleAuto:true,status:'작성 중',
    src:{links:['','',''],memo:'',srcText:'',srcName:''},conf:{kind,benefit:'',slots:isTrial(c||{})&&c&&c.trial&&c.trial.recruit?String(c.trial.recruit):'',deadline:'',channels:['인스타그램'],target:'',upload:'',tone:''},
    post:{main:'',replies:[]},form:{title:'',desc:'',qs:rqDefaultQs(kind),share:true},apps:{}}}
function rqNewPanel(){const d=A.rq.nw;const camps=Object.entries(A.campaigns).filter(([,c])=>inAcctScope(c)).sort((a,b)=>String(b[1].createdAt).localeCompare(String(a[1].createdAt)));
  return `<section class="panel rq-new" style="margin-bottom:16px"><div class="panel-h"><div><h2>새 모집 만들기${d.from?` <span class="pill accent">${esc(String(d.round))}차 · 이전 차수 복사</span>`:''}</h2><div class="sub">캠페인·콘텐츠 가이드를 연결하면 그 내용까지 AI가 참고합니다. 입력한 뒤 아래 「모집 만들기」를 눌러야 저장됩니다.</div></div><button class="btn sm ghost" data-act="rqNewX">닫기</button></div>
   <div class="fgrid"><label class="f">연결할 캠페인<select id="rqn-cid" data-rqn="cid"><option value="">연결 안 함</option>${camps.map(([id,c])=>`<option value="${id}" ${d.cid===id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><span class="hint">연결하면 차수가 자동으로 매겨지고, 신청자를 그 캠페인에 바로 추가할 수 있습니다.</span></label>
    <label class="f">콘텐츠 가이드 연결${rqGuideSel('rqn-gid','data-rqn="gid"',d.gid,d.cid)}<span class="hint">가이드가 없으면 만든 뒤 「정보·연결」에서 새로 만들 수 있습니다.</span></label>
    <label class="f">차수<input type="number" id="rqn-round" data-rqn="round" min="1" value="${esc(String(d.round||1))}"></label>
    <label class="f">모집명<input type="text" id="rqn-title" data-rqn="title" value="${esc(d.title||'')}" placeholder="예: 포즈닉 쿠션 체험단 1차 모집"></label></div>
   ${rqSrcFields(d,'rqn')}
   <div class="row" style="justify-content:flex-end;margin-top:14px;gap:8px"><button class="btn" data-act="rqNewX">취소</button><button class="btn" data-act="rqCreate">모집 만들기</button><button class="btn primary" data-act="rqCreate" data-ai="1" title="저장한 뒤 바로 AI가 스레드 글과 폼 문항을 만듭니다 (Gemini 무료 등급 1회 사용)">모집 만들기 + AI로 글·폼 작성</button></div></section>`}
function rqGuideSel(id,attr,gid,cid){const gs=Object.entries(A.guides||{}).sort((a,b)=>((b[1].cid===cid)-(a[1].cid===cid))||String(b[1].updatedAt||'').localeCompare(String(a[1].updatedAt||'')));
  return `<select id="${id}" ${attr}><option value="">연결 안 함</option>${gs.map(([k,g])=>`<option value="${esc(k)}" ${gid===k?'selected':''}>${esc(g.title||'제목 없음')}${cid&&g.cid===cid?' · 이 캠페인':''}</option>`).join('')}</select>`}
/* 정보 입력 칸 (새 모집 · 편집 공용) — p: 'rqn'(새 모집) | 'rqe'(편집) */
function rqSrcFields(r,p){const s=r.src||{},c=r.conf||{};const ed=canEdit();const at=(path)=>`data-${p}="${path}" ${ed?'':'disabled'}`;const L=s.links||[];
  return `<div class="rq-sec"><h3>광고주 정보 <span class="small muted">AI가 읽는 자료</span></h3><div class="fgrid">
    <label class="f">홈페이지<input type="url" id="${p}-l0" ${at('src.links.0')} value="${esc(L[0]||'')}" placeholder="https://brand.com"></label>
    <label class="f">앱 정보 (앱스토어 · 플레이스토어)<input type="url" id="${p}-l1" ${at('src.links.1')} value="${esc(L[1]||'')}" placeholder="https://apps.apple.com/… 또는 play.google.com/…"></label>
    <label class="f">상품 · 이벤트 페이지<input type="url" id="${p}-l2" ${at('src.links.2')} value="${esc(L[2]||'')}" placeholder="https://smartstore.naver.com/…"></label>
    <div class="f rq-file"><span>상품소개서 (PDF · PPT)</span>${A.rq.srcBusy===p?`<span class="btn rq-upbtn busy"><span class="rq-spin"></span> 소개서 읽는 중…</span>`:s.srcName?`<div class="rq-filebox done"><span class="rq-upok" aria-hidden="true">✓</span><div class="grow"><b>업로드 완료</b><span class="small">📄 ${esc(s.srcName)} · ${fmt(rqLen(s.srcText))}자 읽음</span></div>${ed?`<label class="btn sm ghost" style="cursor:pointer">바꾸기<input type="file" accept="application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.txt,.md" data-rqsrc="${p}" hidden></label><button class="btn sm ghost" data-act="rqSrcDel" data-p="${p}">빼기</button>`:''}</div>`:ed?`<label class="btn rq-upbtn" style="cursor:pointer;justify-content:center">⬆ 소개서 올리기 (PDF · PPT)<input type="file" accept="application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.txt,.md" data-rqsrc="${p}" hidden></label>`:'<span class="muted small">없음</span>'}<span class="hint">50MB 이하 · 브라우저에서 글자만 읽어 AI에 넘깁니다.</span></div>
    <label class="f wide">상품 정보 · 요청사항 메모<textarea id="${p}-memo" ${at('src.memo')} rows="3" placeholder="페이지에서 읽기 어려운 상품 정보, 꼭 넣을 문구, 광고주 요청 등">${esc(s.memo||'')}</textarea></label></div></div>
   <div class="rq-sec"><h3>모집 조건</h3><div class="fgrid">
    <label class="f">유형<select id="${p}-kind" ${at('conf.kind')}>${RQ_KINDS.map(k=>`<option ${c.kind===k?'selected':''}>${k}</option>`).join('')}</select></label>
    <label class="f">모집 인원<input type="text" id="${p}-slots" ${at('conf.slots')} value="${esc(c.slots||'')}" placeholder="예: 20"></label>
    <label class="f">신청 마감일<input type="date" id="${p}-dl" ${at('conf.deadline')} value="${esc(c.deadline||'')}"></label>
    <div class="f"><span>채널</span><div class="chips">${RQ_CH.map(ch=>`<span class="chip ${(c.channels||[]).includes(ch)?'on':''}" ${ed?`data-act="rqCh" data-p="${p}" data-v="${esc(ch)}"`:''}>${ch}</span>`).join('')}</div></div>
    <label class="f wide">제공 내역<input type="text" id="${p}-bn" ${at('conf.benefit')} value="${esc(c.benefit||'')}" placeholder="예: 정품 쿠션 1개(3.8만 원 상당) 무상 제공 · 우수 콘텐츠 2차 활용 시 추가 원고료"></label>
    <label class="f">대상 조건<input type="text" id="${p}-tg" ${at('conf.target')} value="${esc(c.target||'')}" placeholder="예: 팔로워 3천 이상 뷰티 크리에이터"></label>
    <label class="f">콘텐츠 · 업로드 조건<input type="text" id="${p}-up" ${at('conf.upload')} value="${esc(c.upload||'')}" placeholder="예: 릴스 1개, 제품 수령 후 2주 내 업로드"></label>
    <label class="f wide">말투 · AI 요청<input type="text" id="${p}-tone" ${at('conf.tone')} value="${esc(c.tone||'')}" placeholder="예: 20대 여성 타깃, 밝고 짧게 / 링컴즈 MCN 이름을 꼭 넣어 줘"></label></div></div>`}

/* ============ 화면: 모집 편집 ============ */
function rqEditor(){const r=rqCur();if(!r)return `${rqCss()}<div class="panel empty">${A.recLoaded?'모집을 찾을 수 없습니다.':'불러오는 중…'} <button class="btn sm" data-act="rqBack">목록으로</button></div>`;
  const ed=canEdit();const c=r.cid?A.campaigns[r.cid]:null;const g=r.gid&&A.guides?A.guides[r.gid]:null;const st=r.status||'작성 중';const ap=rqApps(r);
  const done={src:!!((r.src||{}).links||[]).some(Boolean)||!!(r.src||{}).srcText||!!(r.src||{}).memo,post:!!(r.post||{}).main&&!!(r.form||{}).code,apps:ap.length>0};
  const tabs=[['src','정보·연결'],['post','스레드 글 · 구글폼'],['apps','신청자']];const tab=A.rq.tab==='form'?'post':(A.rq.tab||'src');
  if(r.form&&r.form.code&&A.rq.visits[A.rcid]===undefined)rqVisits(A.rcid,r);
  const aiRun=rqAiRunning(r);
  return `${rqCss()}<div class="page-h"><div><button class="btn sm ghost" data-act="rqBack" style="margin:0 0 6px -8px">‹ 모집 목록</button><div class="eyebrow">${esc(c?c.name:'캠페인 미연결')} · ${r.round||1}차</div>
    <h1 class="rq-h1">${ed?`<input type="text" id="rqe-title" data-rqe="title" value="${esc(r.title||'')}" placeholder="모집명" aria-label="모집명">`:esc(r.title||'제목 없음')}</h1>
    <div class="row" style="gap:6px;margin-top:6px">${ed?`<select id="rqe-st" data-rqe="status" style="width:auto">${RQ_ST.map(s=>`<option ${st===s?'selected':''}>${s}</option>`).join('')}</select>`:`<span class="pill">${esc(st)}</span>`}
     ${c?`<button class="btn sm" data-act="rqGoCamp" data-c="${esc(r.cid)}">캠페인 열기</button>`:''}${g?`<button class="btn sm" data-act="rqGoGuide" data-g="${esc(r.gid)}">가이드: ${esc(g.title||'')}</button>`:''}${(r.conf||{}).deadline?`<span class="pill ${(r.conf||{}).deadline<today()?'warn':''}">마감 ${md((r.conf||{}).deadline)}</span>`:''}</div></div>
   <div class="row">${rqThChip()}${ed?`<button class="btn sm ghost" data-act="rqDup" title="이 모집을 다음 차수로 복사">다음 차수로 복사</button><button class="btn sm danger" data-act="rqDel">${A.confirm==='rqDel'?'한 번 더 누르면 삭제':'삭제'}</button>`:''}</div></div>
  ${A.th.wait?'<div class="banner info" style="margin-bottom:12px">스레드 연결 창에서 로그인하고 「허용」을 눌러 주세요. 끝나면 이 화면이 자동으로 바뀝니다.</div>':''}
  ${A.rq.thHelp?rqThHelp():''}
  ${aiRun?'<div class="banner info" style="margin-bottom:12px"><span class="rq-spin"></span> AI가 스레드 글과 폼 문항을 만드는 중입니다 (30초~2분). 끝나면 자동으로 채워집니다.</div>':r.aiStatus==='실패'?`<div class="banner" style="margin-bottom:12px">AI 작성 실패: ${esc(r.aiError||'')}</div>`:''}
  <div class="tabs rq-steps">${tabs.map(([k,l],i)=>`<button class="${tab===k?'on':''}" data-act="rqTab" data-t="${k}"><i class="${done[k]?'ok':''}">${done[k]?'✓':i+1}</i>${l}${k==='apps'&&ap.filter(a=>!a.added).length?`<em>${ap.filter(a=>!a.added).length}</em>`:''}</button>`).join('')}</div>
  ${tab==='post'?rqTabPost(r)+`<div class="rq-sep"><span>구글폼</span></div>`+rqTabForm(r):tab==='apps'?rqTabApps(r):rqTabSrc(r)}`}
function rqAiRunning(r){return r&&r.aiStatus==='진행 중'&&r.aiAt&&(Date.now()-new Date(r.aiAt).getTime()<6*60*1000)}

/* ---- 탭 1: 정보·연결 ---- */
function rqTabSrc(r){const ed=canEdit();const camps=Object.entries(A.campaigns).filter(([,c])=>inAcctScope(c)).sort((a,b)=>String(b[1].createdAt).localeCompare(String(a[1].createdAt)));const c=r.cid?A.campaigns[r.cid]:null;
  return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>캠페인 · 콘텐츠 가이드 연결</h2><div class="sub">연결한 캠페인으로 신청자를 바로 옮기고, 연결한 가이드의 핵심 메시지·제품 정보를 AI가 참고합니다.</div></div></div>
   <div class="fgrid"><label class="f">캠페인<select id="rqe-cid" data-rqe="cid" ${ed?'':'disabled'}><option value="">연결 안 함</option>${camps.map(([id,x])=>`<option value="${id}" ${r.cid===id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="f">콘텐츠 가이드${rqGuideSel('rqe-gid',`data-rqe="gid" ${ed?'':'disabled'}`,r.gid,r.cid)}</label>
    <div class="f"><span>가이드가 없다면</span>${ed?`<button class="btn" data-act="rqGuideNew" title="이 모집의 광고주 정보·조건으로 새 콘텐츠 가이드를 만들고 연결합니다">${r.gid?'가이드 하나 더 만들기':'이 정보로 콘텐츠 가이드 만들기'}</button>`:''}<span class="hint">링크·메모·조건을 넣은 새 가이드가 열리고, 가이드 화면에서 「AI로 채우기」를 누르면 됩니다.</span></div>
    <label class="f">차수<input type="number" min="1" id="rqe-round" data-rqe="round" value="${esc(String(r.round||1))}" ${ed?'':'disabled'}></label></div>
   ${c?`<p class="small muted" style="margin:10px 0 0">캠페인: ${esc(c.advertiser||'')}${c.brand?' · '+esc(c.brand):''} · ${esc(rqKindOf(c))}${c.start?` · ${md(c.start)} ~ ${md(c.end)}`:''}</p>`:''}</section>
  <section class="panel"><div class="panel-h"><div><h2>광고주 정보 · 모집 조건</h2><div class="sub">채운 만큼 AI 초안이 정확해집니다. 고친 내용은 칸을 벗어나면 저장됩니다.</div></div>
    ${ed?`<button class="btn primary" data-act="rqAi" ${rqAiRunning(r)?'disabled':''} title="Gemini 무료 등급 1회 사용">${(r.post||{}).main?'AI로 글·문항 다시 만들기':'AI로 스레드 글·폼 문항 만들기'}</button>`:''}</div>
   ${rqSrcFields(r,'rqe')}${r.summary?`<p class="small muted" style="margin:12px 0 0">AI 요약: ${esc(r.summary)}</p>`:''}${r.form&&r.form.formId&&ed?'<p class="small muted" style="margin:6px 0 0">구글폼을 이미 만들어서, AI를 다시 돌려도 폼 문항은 바뀌지 않고 스레드 글만 바뀝니다.</p>':''}</section>`}

/* ---- 탭 2: 스레드 글 ---- */
function rqTabPost(r){const ed=canEdit();const p=r.post||{};const reps=p.replies||[];const th=A.th||{};const sh=rqShort(r);
  const box=(path,val,i)=>{const n=rqCount(val,r);return `<div class="rq-pbox"><div class="rq-ph"><b>${i<0?'본문':`이어 쓰기 ${i+1}`}</b><span class="rq-cnt ${n>RQ_MAX?'over':''}" data-cnt="${path}">${n} / ${RQ_MAX}</span>${i>=0&&ed?`<button class="btn sm ghost" data-act="rqReplyDel" data-i="${i}">빼기</button>`:''}<button class="btn sm" data-act="rqCopy" data-path="${path}">복사</button></div>
    <textarea id="rqe-${path.replace(/\./g,'-')}" data-rqe="${path}" data-rqcnt="1" rows="${i<0?10:6}" ${ed?'':'disabled'} placeholder="${i<0?'AI로 만들거나 직접 써 주세요. 신청 링크가 들어갈 자리에 {링크} 를 넣으면 복사·게시할 때 축약 링크로 바뀝니다.':'상세 조건·일정·유의사항'}">${esc(val||'')}</textarea></div>`};
  return `<div class="rq-post"><div class="rq-col">
    ${!sh?`<div class="banner info" style="margin:0 0 12px">아직 신청 링크가 없습니다. 아래 「구글폼」에서 폼을 만들면 글 속 <b>{링크}</b> 가 축약 링크로 바뀝니다.</div>`:`<div class="linkbox" style="margin-bottom:12px"><span class="grow">신청 링크 ${esc(sh)}</span><button class="btn sm" data-act="rqCopyTxt" data-v="${esc(sh)}">복사</button></div>`}
    ${box('post.main',p.main,-1)}${reps.map((t,i)=>box('post.replies.'+i,t,i)).join('')}
    <div class="row" style="gap:8px;margin-top:10px">${ed&&reps.length<3?'<button class="btn sm" data-act="rqReplyAdd">+ 이어 쓰기 추가</button>':''}<span class="grow"></span><button class="btn" data-act="rqCopy" data-path="all" title="본문과 이어 쓰기를 한 번에 복사 (빈 줄로 구분)">전체 복사</button></div>
    <p class="small muted" style="margin:8px 0 0">스레드 글은 1개에 500자까지입니다. 긴 내용은 이어 쓰기(내 글에 다는 답글)로 나눠 올라갑니다. 붙여넣기로 올릴 때는 본문을 먼저 올리고, 이어 쓰기를 내 글의 답글로 달아 주세요.</p>
    ${r.threads&&r.threads.id?`<div class="rq-posted"><b>✓ 스레드에 게시했습니다</b><span>@${esc(r.threads.username||'')} · ${esc(String(r.threads.at||'').slice(0,16).replace('T',' '))} · ${esc(r.threads.byEmail||'')}${(r.threads.replies||[]).length?` · 이어 쓰기 ${(r.threads.replies||[]).length}개`:''}</span>${r.threads.permalink?`<a class="btn sm" href="${esc(r.threads.permalink)}" target="_blank" rel="noopener">스레드에서 보기 ↗</a>`:''}</div>`:''}
   </div><div class="rq-col rq-pvcol"><div class="rq-pvh">미리보기</div><div class="rq-pv" id="rq-pv">${rqPreview(r)}</div>
    ${ed?`<div class="rq-pvact">${th.connected?`<button class="btn primary" data-act="rqThPost" ${p.main&&A.rq.busy!=='post'?'':'disabled'}>${A.rq.busy==='post'?'<span class="rq-spin"></span> 게시하는 중…':A.confirm==='rqThPost'?`@${esc(th.username)} 계정에 지금 게시할까요? 한 번 더 누르기`:`스레드에 바로 게시${reps.filter(x=>String(x).trim()).length?` (+이어 쓰기 ${reps.filter(x=>String(x).trim()).length})`:''}`}</button>`:'<button class="btn primary" data-act="rqThConnect">스레드 계정 연결하고 게시</button>'}${!sh?'<span class="small muted">구글폼을 먼저 만들면 {링크} 가 신청 링크로 바뀐 채 게시됩니다.</span>':''}</div>`:''}</div></div>`}
function rqPreview(r){const p=r.post||{};const th=A.th||{};const nm=th.connected?th.username:'내_스레드_계정';const sh=rqShort(r);
  const fmtT=t=>esc(String(t||'')).split(esc(RQ_LINK)).join(`<span class="rq-lk">${esc(sh||'ad.ringcoms.com/l/······')}</span>`).replace(/(#[^\s#]+)/g,'<span class="rq-tag">$1</span>').replace(/\n/g,'<br>');
  const item=(t,last)=>`<div class="rq-pi"><div class="rq-av"><span>${esc((nm||'R').charAt(0).toUpperCase())}</span>${last?'':'<i></i>'}</div><div class="rq-pb"><div class="rq-pn"><b>${esc(nm)}</b><span>방금</span></div><div class="rq-pt">${fmtT(t)||'<span class="muted">본문을 입력하면 여기에 보입니다.</span>'}</div><div class="rq-pa">♡ &nbsp;💬 &nbsp;↻ &nbsp;➚</div></div></div>`;
  const reps=(p.replies||[]).filter(x=>String(x).trim());return item(p.main,!reps.length)+reps.map((t,i)=>item(t,i===reps.length-1)).join('')}

/* ---- 탭 3: 구글폼 · 링크 ---- */
function rqTabForm(r){const ed=canEdit();const f=r.form||{};const made=!!f.code;
  if(made){const v=A.rq.visits[A.rcid];const sh=rqShort(r);const card=(t,s,u,btn,extra)=>`<div class="rq-lc"><div class="rq-lt">${t}</div><div class="rq-ls">${s}</div>${u?`<div class="rq-lu">${esc(u)}</div>${extra||''}<div class="row" style="gap:6px"><button class="btn sm" data-act="rqCopyTxt" data-v="${esc(u)}">복사</button><a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">${btn||'열기'} ↗</a></div>`:'<div class="rq-lu muted">없음</div>'}</div>`;
    const lsUrl=rqSheetUrl(f);const resp=f.editUrl?f.editUrl.replace(/\/edit.*$/,'/edit#responses'):'';
    const sheetCard=lsUrl?card('③ 신청 인플루언서 리스트','구글폼 「응답」 탭에서 연결한 구글 시트 · 응답이 들어올 때마다 자동으로 쌓입니다',lsUrl,'시트 열기')
      :`<div class="rq-lc"><div class="rq-lt">③ 신청 인플루언서 리스트</div><div class="rq-ls">구글폼 「응답」 탭 → <b>Sheets에 연결</b>을 누르면 생기는 시트를 가져옵니다</div><div class="rq-lu muted">아직 연결된 시트가 없습니다</div><div class="row" style="gap:6px">${resp?`<a class="btn sm" href="${esc(resp)}" target="_blank" rel="noopener">응답 탭 열기 ↗</a>`:''}${ed&&f.formId?`<button class="btn sm primary" data-act="rqSheetCheck" ${A.rq.busy?'disabled':''}>${A.rq.busy==='sheet'?'<span class="rq-spin"></span> 확인 중…':'연결 확인'}</button>`:''}</div>${f.manual&&ed?`<div class="row" style="gap:6px;margin-top:6px"><input type="url" id="rqm-sheet2" placeholder="https://docs.google.com/spreadsheets/d/…" style="flex:1;min-width:0"><button class="btn sm" data-act="rqSheetManual">넣기</button></div>`:''}</div>`;
    return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>구글폼 · 신청 링크</h2><div class="sub">${f.manual?'직접 만든 폼을 연결했습니다.':`${esc(f.owner||'')} 계정으로 ${esc(String(f.createdAt||'').slice(0,10))}에 만들었습니다.`}${v!=null?` · 신청 링크 방문 ${fmt(v)}회`:''}</div></div>${ed?`<button class="btn sm danger" data-act="rqFormReset" title="이 모집에서 폼 연결만 끊습니다 (구글폼·시트·링크 자체는 지워지지 않음)">${A.confirm==='rqFormReset'?'한 번 더 누르면 연결 해제':'폼 연결 해제'}</button>`:''}</div>
     <div class="rq-lcs">${card('① 스레드 본문에 넣을 링크','축약 링크 · 방문 수가 집계됩니다',sh,'열어 보기',f.responderUri?`<div class="rq-lfull">구글폼 전체 주소 <a href="${esc(f.responderUri)}" target="_blank" rel="noopener">${esc(f.responderUri)}</a></div>`:'')}${card('② 구글폼 문항 수정','구글폼 편집 화면 (만든 계정·공유받은 팀원)',f.editUrl,'수정하기')}${sheetCard}</div>
     ${f.manual?'<p class="small muted" style="margin:10px 0 0">직접 연결한 폼은 플랫폼이 응답을 읽을 수 없습니다. 시트를 엑셀로 받아 캠페인 「엑셀 업로드」로 넣어 주세요.</p>':f.shared?`<p class="small muted" style="margin:10px 0 0">팀원 ${f.shared}명(마스터·매니저)에게 폼 편집 권한을 공유했습니다. 신청자 불러오기는 만든 계정(${esc(f.owner||'')})으로 로그인했을 때 가능합니다.</p>`:`<p class="small muted" style="margin:10px 0 0">신청자 불러오기는 폼을 만든 계정(${esc(f.owner||'')})으로 로그인했을 때 가능합니다.</p>`}</section>
     <section class="panel"><p class="rq-sumd">생성된 구글폼 문항을 요약해 안내드립니다. 문항 제목·형식과, 각 답변이 인플루언서 관리의 어느 칸(이름·채널·연락처 등)으로 들어가는지 보여 줍니다.</p><div class="panel-h"><div><h2>문항 요약 (${(f.qs||[]).length}개)</h2><div class="sub">바꾼 문항은 「신청자 불러오기」 때 다시 읽어 알맞은 칸에 넣습니다.</div></div>${f.editUrl?`<a class="btn sm primary" href="${esc(f.editUrl)}" target="_blank" rel="noopener">문항 수정하기 ↗</a>`:''}</div>
     <ol class="rq-qro">${(f.qs||[]).map(q=>`<li><b>${esc(q.title)}</b>${q.req?' <span class="rq-req">*</span>':''} <span class="pill">${RQ_QT[q.type]||q.type}</span>${q.key?` <span class="muted small">→ ${esc(RQ_KEYL[q.key]||'')}</span>`:''}</li>`).join('')}</ol></section>`}
  const qs=f.qs||[];
  return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>구글폼 내용</h2><div class="sub">AI가 채운 제목·설명·문항을 고친 뒤 「구글폼 만들기」를 누르면 폼과 축약 링크가 한 번에 만들어집니다. 신청자 시트는 구글폼 「응답」 탭의 「Sheets에 연결」로 만듭니다.</div></div></div>
   <div class="fgrid"><label class="f wide">폼 제목<input type="text" id="rqe-ftitle" data-rqe="form.title" value="${esc(f.title||r.title||'')}" ${ed?'':'disabled'}></label>
    <label class="f wide">폼 설명 (첫 화면)<textarea id="rqe-fdesc" data-rqe="form.desc" rows="5" ${ed?'':'disabled'} placeholder="캠페인 소개 · 제공 내역 · 일정 · 선정 안내">${esc(f.desc||'')}</textarea></label></div></section>
  <section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>문항 (${qs.length}개)</h2><div class="sub">「연결 정보」는 신청자를 인플루언서 관리 칸(이름·채널·연락처 등)에 맞춰 넣는 기준입니다.</div></div>${ed?'<div class="row"><button class="btn sm ghost" data-act="rqQReset">기본 문항으로</button><button class="btn sm" data-act="rqQAdd">+ 문항 추가</button></div>':''}</div>
   <div class="rq-qs">${qs.map((q,i)=>`<div class="rq-q"><div class="rq-qn">${i+1}</div><div class="rq-qb"><div class="rq-qr"><input type="text" id="rqq-${q.id}-t" data-rqq="${i}.title" value="${esc(q.title)}" ${ed?'':'disabled'} aria-label="문항 제목">
      <select id="rqq-${q.id}-y" data-rqq="${i}.type" ${ed?'':'disabled'} style="width:auto">${Object.entries(RQ_QT).map(([k,l])=>`<option value="${k}" ${q.type===k?'selected':''}>${l}</option>`).join('')}</select>
      <select id="rqq-${q.id}-k" data-rqq="${i}.key" ${ed?'':'disabled'} style="width:auto" title="연결 정보">${RQ_KEYS.map(([k,l])=>`<option value="${k}" ${(q.key||'')===k?'selected':''}>${l}</option>`).join('')}</select>
      <label class="row small" style="gap:4px"><input type="checkbox" data-rqq="${i}.req" ${q.req?'checked':''} ${ed?'':'disabled'}>필수</label>${ed?`<button class="btn sm ghost" data-act="rqQUp" data-i="${i}" title="위로" ${i?'':'disabled'}>↑</button><button class="btn sm ghost" data-act="rqQDel" data-i="${i}" title="문항 빼기">✕</button>`:''}</div>
      <input type="text" class="rq-qd" id="rqq-${q.id}-d" data-rqq="${i}.desc" value="${esc(q.desc||'')}" placeholder="설명 (선택)" ${ed?'':'disabled'}>
      ${['radio','checkbox','dropdown'].includes(q.type)?`<div class="rq-opts">${(q.opts||[]).map((o,j)=>`<span class="rq-opt"><input type="text" id="rqq-${q.id}-o${j}" data-rqq="${i}.opts.${j}" value="${esc(o)}" ${ed?'':'disabled'} aria-label="보기">${ed?`<button class="btn sm ghost" data-act="rqOptDel" data-i="${i}" data-j="${j}" aria-label="보기 빼기">✕</button>`:''}</span>`).join('')}${ed?`<button class="btn sm ghost" data-act="rqOptAdd" data-i="${i}">+ 보기</button>`:''}</div>`:''}
      ${q.ai?'<span class="pill accent" style="align-self:flex-start">AI 추천 문항</span>':''}</div></div>`).join('')}</div></section>
  ${ed?`<section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>구글폼 만들기</h2><div class="sub">처음 한 번 Google 권한 창이 뜹니다 — 이 사이트가 <b>만든 파일에만</b> 접근하는 권한(drive.file)이라 다른 드라이브 파일은 보지 못합니다.</div></div></div>
   <label class="row small" style="margin-bottom:12px"><input type="checkbox" data-rqe="form.share" ${f.share!==false?'checked':''}> 팀원(마스터·매니저)에게 폼 편집 권한 공유</label>
   <div class="row" style="gap:8px"><button class="btn primary" data-act="rqForm" ${A.rq.busy?'disabled':''}>${A.rq.busy==='form'?'<span class="rq-spin"></span> 만드는 중…':'구글폼 · 축약 링크 만들기'}</button><span class="grow"></span><button class="btn sm ghost" data-act="rqManualT">직접 만든 폼 연결</button></div>
   ${A.rq.manual?`<div class="fgrid" style="margin-top:12px"><label class="f">신청 링크 (응답 주소)<input type="url" id="rqm-resp" placeholder="https://docs.google.com/forms/d/e/…/viewform"></label><label class="f">문항 수정 링크<input type="url" id="rqm-edit" placeholder="https://docs.google.com/forms/d/…/edit"></label><label class="f">신청자 시트 링크 (응답 탭 → Sheets에 연결, 선택)<input type="url" id="rqm-sheet" placeholder="https://docs.google.com/spreadsheets/d/…"></label><div class="f"><span>&nbsp;</span><button class="btn" data-act="rqFormManual">연결하고 축약 링크 만들기</button></div></div>`:''}
   ${A.rq.gErr?`<div class="banner" style="margin-top:12px">${esc(A.rq.gErr.msg)}${A.rq.gErr.api?` <a href="${RQ_API(A.rq.gErr.api)}" target="_blank" rel="noopener">API 사용 설정 ↗</a>`:''}</div>`:''}
   <details class="small muted" style="margin-top:12px"><summary>처음 쓰기 전 확인 (관리자 1회)</summary><ol class="steps"><li>Google Cloud 프로젝트(${esc((window.FIREBASE_CONFIG||{}).projectId||'')})에서 <a href="${RQ_API('forms')}" target="_blank" rel="noopener">Google Forms API</a> · <a href="${RQ_API('drive')}" target="_blank" rel="noopener">Google Drive API</a>(팀원 공유용) 「사용」</li><li>OAuth 동의 화면에 범위 <code>…/auth/drive.file</code> 추가 (민감하지 않은 범위라 심사 없음)</li></ol></details></section>`:''}`}

/* ---- 탭 4: 신청자 ---- */
function rqTabApps(r){const ed=canEdit();const f=r.form||{};const ap=rqApps(r);const sel=A.rq.sel;const camps=Object.entries(A.campaigns).filter(([,c])=>inAcctScope(c)&&!['완료','종료'].includes(campStatus(c))).sort((a,b)=>String(b[1].createdAt).localeCompare(String(a[1].createdAt)));
  const tgt=A.rq.tgt!=null?A.rq.tgt:(r.cid||'');const nNew=ap.filter(a=>!a.added).length;
  const st=a=>a.added?(a.added.cid?`<span class="pill ok" title="${esc((rqCampName(a.added.cid)||'캠페인')+' 인플루언서 관리 · '+String(a.added.at||'').slice(0,16).replace('T',' '))}">✓ ${a.added.dup?'이미 있음':'추가됨'}</span>`:'<span class="pill ok" title="인플루언서 풀에만 등록">✓ 풀 등록</span>'):'<span class="pill accent">새 신청</span>';
  const chl=a=>a.chlink?`<a href="${esc(a.chlink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(a.acct||a.chlink.replace(/^https?:\/\/(www\.)?/,'').slice(0,28))}</a>`:esc(a.acct||'');
  return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>신청자 ${ap.length}명${nNew?` <span class="pill accent">새 신청 ${nNew}</span>`:''}</h2><div class="sub">${f.lastSync?`${esc(String(f.lastSync).slice(0,16).replace('T',' '))}에 불러옴${f.syncBy?` · ${esc(f.syncBy)}`:''}`:'구글폼 응답을 불러와 시트에 정리하고, 아래에서 골라 캠페인에 추가합니다.'}</div></div>
    <div class="row">${rqSheetUrl(f)?`<a class="btn sm" href="${esc(rqSheetUrl(f))}" target="_blank" rel="noopener">신청 인플루언서 리스트 (시트) ↗</a>`:''}${ed&&f.formId?`<button class="btn primary" data-act="rqSync" ${A.rq.busy?'disabled':''}>${A.rq.busy==='sync'?'<span class="rq-spin"></span> 불러오는 중…':'신청자 불러오기'}</button>`:''}</div></div>
   ${!f.code?'<div class="empty">먼저 「스레드 글 · 구글폼」에서 폼을 만들어 주세요.</div>':f.manual&&!ap.length?'<div class="empty">직접 연결한 폼은 응답을 불러올 수 없습니다. 시트를 엑셀로 받아 캠페인 인플루언서 관리 「엑셀 업로드」로 넣어 주세요.</div>':!ap.length?'<div class="empty">아직 불러온 신청자가 없습니다. 「신청자 불러오기」를 눌러 주세요.</div>':`
   ${ed?`<div class="rq-bar"><label class="row small" style="gap:6px"><input type="checkbox" data-act="rqSelAll" ${sel.size&&sel.size===ap.filter(a=>!a.added).length?'checked':''}> 새 신청 전체 선택</label><b class="small">${sel.size}명 선택</b><span class="grow"></span>
     <select id="rq-tgt" data-rqtgt="1" style="width:auto;max-width:260px"><option value="">캠페인 선택</option>${camps.map(([id,c])=>`<option value="${id}" ${tgt===id?'selected':''}>${esc(c.name)}${id===r.cid?' (연결)':''}</option>`).join('')}</select>
     <button class="btn sm primary" data-act="rqAddCamp" ${sel.size?'':'disabled'}>인플루언서 관리에 추가</button><button class="btn sm" data-act="rqAddPool" ${sel.size?'':'disabled'} title="캠페인 없이 인플루언서 풀에만 등록">풀에만 등록</button></div>`:''}
   <div class="tblwrap hide-m"><table class="tbl rq-atbl"><thead><tr>${ed?'<th style="width:32px"></th>':''}<th>신청일</th><th>활동명</th><th>채널</th><th class="n">팔로워</th><th>카테고리</th><th>실명 · 연락처</th><th>이메일</th><th>신청 이유 · 기타</th><th>상태</th></tr></thead><tbody>
    ${ap.map(a=>`<tr class="${sel.has(a.k)?'sel':''}">${ed?`<td><input type="checkbox" data-act="rqSel" data-k="${esc(a.k)}" ${sel.has(a.k)?'checked':''} ${a.added?'disabled':''} aria-label="선택"></td>`:''}<td class="small">${md(String(a.at||'').slice(0,10))}<br><span class="muted">${esc(String(a.at||'').slice(11,16))}</span></td><td><b>${esc(a.name||'')}</b></td><td class="small">${esc(a.ch||'')}<br>${chl(a)}</td><td class="n">${a.fol!=null?compact(a.fol):'–'}</td><td class="small">${esc(a.cat||'')}</td><td class="small">${esc(a.realname||'')}<br>${esc(a.contact||'')}</td><td class="small">${esc(a.email||'')}</td><td class="small rq-memo" title="${esc([a.memo,a.addr?'주소: '+a.addr:'',a.offer?'희망 원고료: '+a.offer:''].filter(Boolean).join('\n'))}">${esc(a.memo||'')}${a.addr?`<br><span class="muted">📦 ${esc(a.addr)}</span>`:''}</td><td>${st(a)}</td></tr>`).join('')}</tbody></table></div>
   <div class="mcards show-m">${ap.map(a=>`<div class="mcard ${sel.has(a.k)?'sel':''}"><div class="mh">${ed&&!a.added?`<input type="checkbox" data-act="rqSel" data-k="${esc(a.k)}" ${sel.has(a.k)?'checked':''} aria-label="선택" style="margin-top:3px">`:''}<div class="grow"><div class="mt">${esc(a.name||'')}</div><div class="ms">${esc([a.ch,a.acct,a.cat].filter(Boolean).join(' · '))}</div></div>${st(a)}</div><div class="mkv"><div><span>팔로워</span><b>${a.fol!=null?compact(a.fol):'–'}</b></div><div><span>실명</span><b>${esc(a.realname||'–')}</b></div><div><span>신청일</span><b>${md(String(a.at||'').slice(0,10))}</b></div></div>${a.contact?`<p class="small muted" style="margin:6px 0 0">📞 ${esc(a.contact)}${a.email?' · '+esc(a.email):''}</p>`:''}${a.memo?`<p class="small muted" style="margin:6px 0 0">${esc(a.memo)}</p>`:''}</div>`).join('')}</div>
   <p class="small muted" style="margin:10px 0 0">인플루언서 관리에 추가하면 컨택 단계로 들어가고(체험단은 「신청」 체크), 인플루언서 풀에도 자동으로 쌓입니다. 팔로워·카테고리는 캠페인에서 「채널 정보 불러오기」로 다시 확인할 수 있습니다.</p>`}</section>`}

/* ============ 동작 ============ */
Object.assign(ACT,{
  rqAppsGo(a,e){if(e&&e.stopPropagation)e.stopPropagation();A.rcid=a.dataset.r;A.rq.tab='apps';A.rq.sel=new Set();A.rq.tgt=null;A.rq.manual=false;A.rq.gErr=null;A.confirm=null;render();window.scrollTo(0,0)},
  async rqSheetCheck(){rqSheetLink()},
  async rqSheetManual(){const u=String(($('#rqm-sheet2')||{}).value||'').trim();if(!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(u))return toast('구글 시트 주소(https://docs.google.com/spreadsheets/…)를 넣어 주세요.','crit');await rqSave(A.rcid,{'form.sheetUrl':u,'form.linkedSheetUrl':u});toast('신청 인플루언서 리스트 시트를 연결했습니다.');render()},
  rqOpen(a){A.rcid=a.dataset.r;A.rq.tab='src';A.rq.sel=new Set();A.rq.tgt=null;A.rq.manual=false;A.rq.gErr=null;A.confirm=null;const r=rqCur();if(r&&A.rq.tab==='src'&&((r.post||{}).main||(r.form||{}).code))A.rq.tab='post';render();window.scrollTo(0,0)},
  rqBack(){A.rcid='';A.rq.sel=new Set();render();window.scrollTo(0,0)},
  rqTab(a){A.rq.tab=a.dataset.t;A.rq.gErr=null;render()},
  rqF(a){A.rq.F[a.dataset.k]=a.dataset.v;render()},
  rqThHelp(){A.rq.thHelp=!A.rq.thHelp;render()},
  rqThConnect(){rqThOpen()},
  rqThRecheck(){rqThStatus(true)},
  async rqThOff(){if(A.confirm!=='rqThOff'){A.confirm='rqThOff';render();return}A.confirm=null;try{await DB.del('threads/'+A.user.email);toast('스레드 연결을 해제했습니다.');await rqThStatus(true)}catch(e){saveErr(e)}},
  rqGoCamp(a){if(typeof openCampaign==='function'){A.rcid='';openCampaign(a.dataset.c,'grid')}},
  rqGoGuide(a){A.view='guides';A.gid=a.dataset.g;render();window.scrollTo(0,0)},
  rqNew(){A.rq.nw=rqBlank(A.rq.F.cid&&A.rq.F.cid!=='none'?A.rq.F.cid:'');render();window.scrollTo(0,0)},
  rqNewX(){A.rq.nw=null;render()},
  rqNext(a){const cid=a.dataset.c;const prev=Object.entries(A.recruits||{}).filter(([,r])=>r.cid===cid).sort((x,y)=>(+y[1].round||0)-(+x[1].round||0))[0];A.rq.nw=prev?rqCopyOf(prev[1],prev[0]):rqBlank(cid);render();window.scrollTo(0,0)},
  rqDup(){const r=rqCur();if(!r)return;A.rq.nw=rqCopyOf(r,A.rcid);A.rcid='';render();window.scrollTo(0,0)},
  async rqCreate(a){const ae=document.activeElement;if(ae&&ae.blur)ae.blur();await new Promise(x=>setTimeout(x,30));const d=A.rq.nw;if(!d)return;
    if(!String(d.title||'').trim())return toast('모집명을 입력해 주세요.','crit');
    const id=uid();const doc={...clone(d),title:String(d.title).trim(),round:+d.round||1,createdAt:today(),updatedAt:T_NOW(),by:A.user.email};delete doc.from;delete doc.titleAuto;
    try{await DB.set('recruits/'+id,doc);A.recruits=A.recruits||{};A.recruits[id]=doc;A.rq.nw=null;A.rcid=id;A.rq.tab='src';A.rq.sel=new Set();toast('모집을 만들었습니다.');render();window.scrollTo(0,0);if(a.dataset.ai)setTimeout(()=>rqAiRun(id),50)}catch(e){saveErr(e)}},
  async rqDel(){if(A.confirm!=='rqDel'){A.confirm='rqDel';render();return}A.confirm=null;const id=A.rcid;try{await DB.del('recruits/'+id);A.rcid='';toast('모집을 삭제했습니다. 만든 구글폼·시트는 드라이브에 그대로 남아 있습니다.');render()}catch(e){saveErr(e)}},
  rqCh(a){const p=a.dataset.p,v=a.dataset.v;const o=p==='rqn'?A.rq.nw:rqCur();if(!o)return;const L=new Set((o.conf||{}).channels||[]);L.has(v)?L.delete(v):L.add(v);const arr=RQ_CH.filter(x=>L.has(x));
    if(p==='rqn'){o.conf.channels=arr;render()}else{o.conf=o.conf||{};o.conf.channels=arr;rqSave(A.rcid,{'conf.channels':arr});render()}},
  rqSrcDel(a){const p=a.dataset.p;if(p==='rqn'){Object.assign(A.rq.nw.src,{srcText:'',srcName:''});render()}else rqSave(A.rcid,{'src.srcText':'','src.srcName':''})},
  rqAi(){rqAiRun(A.rcid)},
  rqReplyAdd(){const r=rqCur();if(!r)return;const L=[...((r.post||{}).replies||[]),''];r.post=r.post||{};r.post.replies=L;rqSave(A.rcid,{'post.replies':L});render()},
  rqReplyDel(a){const r=rqCur();if(!r)return;const L=[...((r.post||{}).replies||[])];L.splice(+a.dataset.i,1);r.post.replies=L;rqSave(A.rcid,{'post.replies':L});render()},
  async rqCopy(a){const r=rqCur();if(!r)return;const p=r.post||{};const path=a.dataset.path;let t;
    if(path==='all')t=[p.main,...(p.replies||[])].filter(x=>String(x||'').trim()).map(x=>rqFill(x,r)).join('\n\n');else t=rqFill(getIn(r,path),r);
    if(!String(t||'').trim())return toast('복사할 글이 없습니다.','crit');await rqClip(t);toast(String(t).includes(RQ_LINK)?'복사했습니다. 아직 신청 링크가 없어 {링크} 가 그대로 들어 있어요.':'복사했습니다. 스레드에 붙여넣기 하세요.')},
  async rqCopyTxt(a){await rqClip(a.dataset.v);toast('복사했습니다.')},
  async rqThPost(){const r=rqCur();if(!r)return;const p=r.post||{};const th=A.th||{};if(!th.connected)return rqThOpen();
    const parts=[p.main,...(p.replies||[])].map(x=>String(x||'').trim()).filter(Boolean).map(x=>rqFill(x,r));
    if(!parts.length)return toast('게시할 본문이 없습니다.','crit');const over=parts.findIndex(x=>rqLen(x)>RQ_MAX);if(over>=0)return toast(`${over?`이어 쓰기 ${over}`:'본문'}이 ${RQ_MAX}자를 넘습니다 (${rqLen(parts[over])}자). 줄이거나 나눠 주세요.`,'crit');
    if(A.confirm!=='rqThPost'){A.confirm='rqThPost';render();if(parts.some(x=>x.includes(RQ_LINK)))toast('아직 신청 링크가 없어 글에 {링크} 가 그대로 올라갑니다. 구글폼을 먼저 만드는 것을 권장합니다.','crit');return}A.confirm=null;A.rq.busy='post';render();
    try{let root=null,prev=null;const reps=[];
      for(let i=0;i<parts.length;i++){let j;if(DB.mode==='demo'){await new Promise(x=>setTimeout(x,300));j={id:'demo'+Date.now()+i,permalink:'https://www.threads.net/@'+th.username}}else j=await aiFetch('/api/threads',{action:'post',text:parts[i],replyTo:prev||''});
        if(!i)root=j;else reps.push(j.id);prev=j.id}
      const up={threads:{id:root.id,permalink:root.permalink||'',username:th.username||'',at:T_NOW(),byEmail:A.user.email,replies:reps}};if((r.status||'작성 중')==='작성 중')up.status='모집 중';
      await rqSave(A.rcid,up);toast(`스레드 @${th.username}에 게시했습니다${reps.length?` (이어 쓰기 ${reps.length}개)`:''}.`)}
    catch(e){toast('스레드 게시 실패: '+e.message,'crit');if(/만료|다시 연결/.test(e.message))rqThStatus(true)}finally{A.rq.busy='';render()}},
  rqQAdd(){rqQs(L=>{const i=L.findIndex(q=>q.key==='agree');L.splice(i<0?L.length:i,0,rqQ('','short','새 문항',{}))})},
  rqQDel(a){rqQs(L=>L.splice(+a.dataset.i,1))},
  rqQUp(a){const i=+a.dataset.i;if(!i)return;rqQs(L=>{const x=L[i];L[i]=L[i-1];L[i-1]=x})},
  rqQReset(){const r=rqCur();if(!r)return;rqQs(L=>{const ai=L.filter(q=>q.ai);L.splice(0,L.length,...rqDefaultQs((r.conf||{}).kind));rqInsertExtra(L,ai)})},
  rqOptAdd(a){rqQs(L=>{const q=L[+a.dataset.i];q.opts=[...(q.opts||[]),'보기 '+((q.opts||[]).length+1)]})},
  rqOptDel(a){rqQs(L=>{const q=L[+a.dataset.i];q.opts=(q.opts||[]).filter((_,j)=>j!==+a.dataset.j)})},
  rqManualT(){A.rq.manual=!A.rq.manual;render()},
  async rqForm(){rqFormCreate()},
  async rqFormManual(){const r=rqCur();if(!r)return;const resp=($('#rqm-resp')||{}).value||'',edit=($('#rqm-edit')||{}).value||'',sheet=($('#rqm-sheet')||{}).value||'';
    if(!/^https:\/\/\S+$/.test(resp.trim()))return toast('신청 링크(응답 주소)를 https:// 로 시작하게 넣어 주세요.','crit');
    try{const code=await rqMakeLink(r,resp.trim());await rqSave(A.rcid,{form:{...(r.form||{}),manual:true,responderUri:resp.trim(),editUrl:edit.trim(),sheetUrl:sheet.trim(),linkedSheetUrl:sheet.trim(),code,owner:A.user.email,createdAt:T_NOW()}});A.rq.manual=false;toast('폼을 연결하고 축약 링크를 만들었습니다.');render()}catch(e){toast('연결하지 못했습니다: '+(e.message||e),'crit')}},
  async rqFormReset(){if(A.confirm!=='rqFormReset'){A.confirm='rqFormReset';render();return}A.confirm=null;const r=rqCur();if(!r)return;const f=r.form||{};
    await rqSave(A.rcid,{form:{title:f.title||'',desc:f.desc||'',qs:f.qs||[],share:f.share!==false}});toast('폼 연결을 해제했습니다. 이전 축약 링크는 그대로 이전 폼으로 연결됩니다.');render()},
  async rqSync(){rqSyncApps()},
  rqSel(a){const k=a.dataset.k;A.rq.sel.has(k)?A.rq.sel.delete(k):A.rq.sel.add(k);render()},
  rqSelAll(){const r=rqCur();const L=rqApps(r).filter(a=>!a.added).map(a=>a.k);if(A.rq.sel.size===L.length)A.rq.sel=new Set();else A.rq.sel=new Set(L);render()},
  async rqAddCamp(){const cid=($('#rq-tgt')||{}).value||'';if(!cid)return toast('추가할 캠페인을 골라 주세요.','crit');await rqToCampaign(cid)},
  async rqAddPool(){await rqToPool()},
  async rqGuideNew(){const r=rqCur();if(!r)return;const c=r.cid?A.campaigns[r.cid]:null;const g=newGuide(c);g.cid=r.cid||'';g.recruit=A.rcid;
    g.links=((r.src||{}).links||[]).filter(u=>/^https?:\/\//.test(String(u||'').trim())).slice(0,3);
    const cf=r.conf||{};g.memo=[(r.src||{}).memo,cf.benefit?'제공 내역: '+cf.benefit:'',cf.upload?'콘텐츠·업로드 조건: '+cf.upload:'',cf.target?'대상: '+cf.target:'',(r.src||{}).srcText?'[상품소개서 '+((r.src||{}).srcName||'')+']\n'+String((r.src||{}).srcText).slice(0,6000):''].filter(Boolean).join('\n\n');
    const ch=cf.channels||[];if(ch.length===1)g.platform=ch[0]==='틱톡'?'틱톡':ch[0]==='유튜브'?'유튜브 쇼츠':ch[0]==='네이버 블로그'?'네이버 블로그':'인스타그램 릴스';
    const id=uid();try{await DB.set('guides/'+id,g);A.guides=A.guides||{};A.guides[id]=g;await rqSave(A.rcid,{gid:id});A.view='guides';A.gid=id;A.rcid='';render();window.scrollTo(0,0);toast('모집 정보를 넣은 새 가이드를 만들었습니다. 「AI로 채우기」로 내용을 채워 주세요.')}catch(e){saveErr(e)}}
});
function rqCopyOf(r,fromId){const round=Object.values(A.recruits||{}).filter(x=>x.cid===r.cid).reduce((m,x)=>Math.max(m,+x.round||0),+r.round||1)+1;const f=r.form||{};
  return {cid:r.cid||'',gid:r.gid||'',round,title:String(r.title||'').replace(/\d+\s*차/,round+'차')||'',status:'작성 중',from:fromId,
    src:clone(r.src||{links:[]}),conf:{...clone(r.conf||{}),deadline:''},post:clone(r.post||{main:'',replies:[]}),form:{title:String(f.title||'').replace(/\d+\s*차/,round+'차'),desc:f.desc||'',qs:clone(f.qs||rqDefaultQs((r.conf||{}).kind)).map(q=>({...q,id:'q'+Math.random().toString(36).slice(2,8)})),share:f.share!==false},apps:{}}}
function rqQs(fn){const r=rqCur();if(!r||!canEdit())return;if(r.form&&r.form.code)return toast('폼을 이미 만들었습니다. 문항은 구글폼 편집 화면에서 고쳐 주세요.','crit');const L=clone((r.form||{}).qs||[]);fn(L);r.form=r.form||{};r.form.qs=L;rqSave(A.rcid,{'form.qs':L});render()}
function rqInsertExtra(L,extra){const i=L.findIndex(q=>q.key==='memo');L.splice(i<0?Math.max(0,L.length-1):i,0,...extra)}
async function rqClip(t){try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(x){}ta.remove()}}

/* ---- 입력 저장: 칸을 벗어나면(change) 저장 ---- */
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset)return;
  if(t.dataset.rqf){A.rq.F[t.dataset.rqf]=t.value;render();return}
  if(t.dataset.rqtgt){A.rq.tgt=t.value;return}
  if(t.dataset.rqn){const d=A.rq.nw;if(!d)return;const path=t.dataset.rqn;let v=t.type==='checkbox'?t.checked:t.value;if(path==='round')v=+v||1;setIn(d,path,v);
    if(path==='title')d.titleAuto=false;
    if(path==='cid'){const nb=rqBlank(v);d.round=nb.round;if(d.titleAuto!==false||!String(d.title||'').trim())d.title=nb.title;if(!d.from){d.conf.kind=nb.conf.kind;d.form.qs=rqDefaultQs(nb.conf.kind);if(nb.conf.slots)d.conf.slots=nb.conf.slots}const gs=Object.entries(A.guides||{}).filter(([,g])=>g.cid===v);if(!d.gid&&gs.length===1)d.gid=gs[0][0]}
    if(path==='conf.kind'&&!d.from)d.form.qs=rqDefaultQs(v);
    if(['cid','conf.kind','round'].includes(path))render();return}
  if(t.dataset.rqe){const r=rqCur();if(!r||!canEdit())return;const path=t.dataset.rqe;let v=t.type==='checkbox'?t.checked:t.value;if(path==='round')v=+v||1;
    if(path==='title'&&!String(v).trim()){toast('모집명은 비울 수 없습니다.','crit');return}
    if(/^post\.replies\.\d+$/.test(path)){const L=[...((r.post||{}).replies||[])];L[+path.split('.')[2]]=v;setIn(r,'post.replies',L);rqSave(A.rcid,{'post.replies':L});return}
    if(/^src\.links\.\d+$/.test(path)){const L=[...((r.src||{}).links||['','',''])];while(L.length<3)L.push('');L[+path.split('.')[2]]=String(v).trim();setIn(r,'src.links',L);rqSave(A.rcid,{'src.links':L});return}
    setIn(r,path,v);rqSave(A.rcid,{[path]:v});if(['cid','gid','status','round'].includes(path))render();return}
  if(t.dataset.rqq){const r=rqCur();if(!r)return;const [i,...rest]=t.dataset.rqq.split('.');const v=t.type==='checkbox'?t.checked:t.value;rqQs(L=>{if(L[+i])setIn(L[+i],rest.join('.'),v)});return}});
/* 글자 수·미리보기는 입력하는 동안 바로 갱신 */
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||!t.dataset.rqcnt)return;const r=rqCur();if(!r)return;const path=t.dataset.rqe;
  const cnt=document.querySelector(`[data-cnt="${path}"]`);if(cnt){const n=rqCount(t.value,r);cnt.textContent=n+' / '+RQ_MAX;cnt.classList.toggle('over',n>RQ_MAX)}
  const tmp=clone(r);if(/^post\.replies\.\d+$/.test(path)){tmp.post.replies[+path.split('.')[2]]=t.value}else setIn(tmp,path,t.value);const pv=$('#rq-pv');if(pv)pv.innerHTML=rqPreview(tmp)});
/* 상품소개서: 브라우저에서 글자만 읽음 (proposal.js readSrc 재사용) */
document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset||!t.dataset.rqsrc||!t.files||!t.files[0])return;const p=t.dataset.rqsrc;const info={};const file=t.files[0];
  A.rq.srcBusy=p;render();let ok=false;try{ok=await readSrc(file,info,'new')}finally{A.rq.srcBusy='';A.ppPages=null}
  if(!ok){render();return}
  if(p==='rqn'){if(A.rq.nw)Object.assign(A.rq.nw.src,{srcText:info.srcText||'',srcName:info.srcName||''});render()}
  else{const r=rqCur();if(r){r.src=r.src||{};r.src.srcText=info.srcText||'';r.src.srcName=info.srcName||''}render();await rqSave(A.rcid,{'src.srcText':info.srcText||'','src.srcName':info.srcName||''})}
  toast(`업로드 완료 · ${info.srcName||'소개서'}를 읽었습니다.`)});

/* ============ AI: 스레드 글 + 폼 문항 ============ */
function rqCtx(r){const c=r.cid?A.campaigns[r.cid]:null;const g=r.gid&&A.guides?A.guides[r.gid]:null;
  const campaign=c?[`캠페인명: ${c.name}`,c.advertiser?`광고주: ${c.advertiser}`:'',c.brand?`브랜드: ${c.brand}`:'',`유형: ${rqKindOf(c)}`,c.start?`기간: ${c.start} ~ ${c.end||''}`:'',c.product?`제품: ${c.product}`:'',isTrial(c)&&c.trial&&c.trial.price?`제품 판매단가: ${c.trial.price}원`:''].filter(Boolean).join('\n'):'';
  const pr=(g&&g.product)||{},sm=(g&&g.summary)||{},tx=(g&&g.text)||{};
  const guide=g?[`가이드: ${g.title||''}`,pr.name?`제품명: ${pr.name}`:'',pr.intro?`소개: ${pr.intro}`:'',(pr.points||[]).filter(x=>x&&x.t).length?'특징: '+(pr.points||[]).filter(x=>x&&x.t).map(x=>x.t+(x.d?`(${x.d})`:'')).join(' / '):'',sm.one?`핵심 메시지: ${sm.one}`:'',(sm.must||[]).length?'꼭 할 것: '+sm.must.join(' / '):'',(g.concepts||[]).filter(x=>x&&x.name).length?'컨셉: '+g.concepts.filter(x=>x&&x.name).map(x=>x.name).join(', '):'',g.platform?`채널·형식: ${g.platform} ${g.length||''}`:'',(tx.tagsMust||[]).length?'필수 해시태그: '+tx.tagsMust.join(' '):'',(g.submit||{}).uploadDue?`업로드 기한: ${g.submit.uploadDue}`:''].filter(Boolean).join('\n'):'';
  return {campaign,guide}}
async function rqAiRun(id){const r=A.recruits&&A.recruits[id];if(!r||!canEdit()||rqAiRunning(r))return;const s=r.src||{};const links=(s.links||[]).map(x=>String(x||'').trim()).filter(u=>/^https?:\/\//i.test(u));
  const ctx=rqCtx(r);if(!links.length&&!String(s.memo||'').trim()&&!String(s.srcText||'').trim()&&!ctx.guide&&!ctx.campaign)return toast('홈페이지·앱 링크, 상품소개서, 메모 중 하나는 넣어 주세요.','crit');
  const conf={...(r.conf||{}),round:r.round||1};
  if(DB.mode==='demo'){await DB.update('recruits/'+id,{aiStatus:'진행 중',aiAt:T_NOW()});await new Promise(x=>setTimeout(x,900));await rqAiApply(id,{ai:rqMock(r)});return}
  const job=uid();try{await DB.update('recruits/'+id,{aiStatus:'진행 중',aiJob:job,aiAt:T_NOW(),aiError:DB.DEL,aiResult:DB.DEL});
    await aiFetch('/api/recruit',{rid:id,job,links,src:{memo:s.memo||'',srcText:String(s.srcText||'').slice(0,40000)},conf,ctx});toast('AI가 스레드 글과 폼 문항을 만드는 중입니다. 30초~2분 뒤 자동으로 채워집니다.')}
  catch(e){DB.update('recruits/'+id,{aiStatus:'실패',aiError:String(e.message||e)}).catch(()=>{});toast('AI를 시작하지 못했습니다: '+(e.message||e),'crit')}}
function rqAiCheck(){if(!canEdit())return;for(const [id,r] of Object.entries(A.recruits||{})){if(r.aiStatus!=='완료'||!r.aiResult||rqAiCheck.doing[id])continue;rqAiCheck.doing[id]=1;
  let j=null;try{j=JSON.parse(r.aiResult)}catch(e){}rqAiApply(id,j||{}).finally(()=>{delete rqAiCheck.doing[id]})}}
rqAiCheck.doing={};
async function rqAiApply(id,j){const r=A.recruits&&A.recruits[id];if(!r)return;const ai=j.ai||{};const p=ai.post||{},f=ai.form||{};const up={aiStatus:'적용됨',aiResult:DB.DEL,aiDoneAt:T_NOW()};
  const fix=t=>{let s=String(t||'').trim();if(s&&!s.includes(RQ_LINK))s=s.replace(/(신청\s*👉?\s*)(https?:\/\/\S+)?\s*$/m,'$1'+RQ_LINK);return s};
  if(p.main){up['post.main']=fix(p.main);up['post.replies']=(Array.isArray(p.replies)?p.replies:[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,3)}
  if(ai.summary)up.summary=String(ai.summary).slice(0,200);
  if(ai.title&&(!r.title||/^\S+\s\d+차 인플루언서 모집$/.test(r.title)))up.title=String(ai.title).slice(0,80);
  if(!(r.form&&r.form.code)){if(f.title)up['form.title']=String(f.title).slice(0,120);if(f.desc)up['form.desc']=String(f.desc).slice(0,2000);
    const extra=(Array.isArray(f.extra)?f.extra:[]).slice(0,3).filter(x=>x&&x.title).map(x=>rqQ('',RQ_QT[x.type]?x.type:'short',String(x.title).slice(0,120),{opts:(Array.isArray(x.opts)?x.opts:[]).map(String).filter(Boolean).slice(0,12),req:!!x.req,ai:true})).map(q=>(['radio','checkbox','dropdown'].includes(q.type)&&!q.opts.length)?{...q,type:'short'}:q);
    const L=clone(((r.form||{}).qs)||rqDefaultQs((r.conf||{}).kind)).filter(q=>!q.ai);rqInsertExtra(L,extra);up['form.qs']=L}
  try{await DB.update('recruits/'+id,{...up,updatedAt:T_NOW()});if(A.rcid===id){A.rq.tab='post';toast('AI가 스레드 글과 폼 문항을 채웠습니다. 다듬은 뒤 「구글폼·링크」에서 폼을 만들어 주세요.')}render()}catch(e){saveErr(e)}}
function rqMock(r){const c=r.conf||{};const b=(r.cid&&A.campaigns[r.cid]&&(A.campaigns[r.cid].brand||A.campaigns[r.cid].advertiser))||'브랜드';
  return {title:`${b} ${c.kind||'체험단'} ${r.round||1}차 모집`,summary:`${b} 제품 ${c.kind||'체험단'} ${c.slots||'00'}명 모집 (데모 초안)`,
    post:{main:`🎁 ${b} ${c.kind||'체험단'} ${c.slots||''}명 모집해요!\n\n${c.benefit||'제품을 무료로 보내 드려요.'}\n\n✔ 대상: ${c.target||'인스타그램·틱톡 크리에이터'}\n✔ 마감: ${c.deadline?md(c.deadline):'선착순'}\n\n신청 👉 ${RQ_LINK}\n\n#체험단모집`,replies:[`📌 진행 방법\n1. 신청서 작성\n2. 선정 연락 (마감 후 3일 내)\n3. 제품 받고 ${c.upload||'릴스 1개 업로드'}\n\n📌 유의사항\n선정되지 않으면 따로 연락드리지 않아요.`]},
    form:{title:`[${b}] ${c.kind||'체험단'} ${r.round||1}차 신청`,desc:`${b} ${c.kind||'체험단'}에 신청해 주셔서 감사합니다.\n\n제공: ${c.benefit||'제품'}\n모집: ${c.slots||'00'}명\n마감: ${c.deadline||'-'}\n\n선정되신 분께만 개별 연락드립니다.`,extra:[{title:'피부 타입을 알려 주세요',type:'radio',opts:['건성','지성','복합성','민감성'],req:true}]}}}

/* ============ 구글폼 · 시트 · 축약 링크 만들기 ============ */
/* 축약 링크: 캠페인 링크 트래킹 집계(linkday)에 섞이지 않도록 cid는 비우고, 연결 캠페인은 camp에 기록 */
async function rqMakeLink(r,dest){const code=await trkNewCode();const camp=r.cid&&A.campaigns[r.cid]?r.cid:'';const ac=camp?acctOf(A.campaigns[camp]):TEAM;const cid='';
  await DB.set('links/'+code,{cid,camp,rid:'rq_'+A.rcid,code,name:r.title||'',acct:ac,kind:'recruit',mode:'direct',dest,params:'',page:{title:'',sub:'',img:'',logo:'',color:'#2347D4',brand:r.title||'',btns:[]},updatedAt:new Date().toISOString()});
  try{await DB.set('linkstat/'+code+'_v',{cid,code,rid:'rq_'+A.rcid,slot:'v',acct:ac,n:0,u:0})}catch(e){console.warn('linkstat',e)}
  return code}
async function rqVisits(id,r){A.rq.visits[id]=null;try{const d=await DB.get('linkstat/'+r.form.code+'_v');A.rq.visits[id]=d?(d.n||0):0}catch(e){A.rq.visits[id]=0}scheduleRender()}
function rqItem(q){const item={title:String(q.title||'').slice(0,300)||'문항',...(q.desc?{description:String(q.desc)}:{})};
  const base={required:!!q.req};
  if(['radio','checkbox','dropdown'].includes(q.type)){const opts=[...new Set((q.opts||[]).map(o=>String(o).trim()).filter(Boolean))];base.choiceQuestion={type:q.type==='radio'?'RADIO':q.type==='checkbox'?'CHECKBOX':'DROP_DOWN',options:(opts.length?opts:['예']).map(value=>({value}))}}
  else base.textQuestion={paragraph:q.type==='paragraph'};
  item.questionItem={question:base};return item}
async function rqFormCreate(){const r=rqCur();if(!r||A.rq.busy)return;A.rq.gErr=null;
  const f=r.form||{};const qs=(f.qs||[]).filter(q=>String(q.title||'').trim());if(!qs.length)return toast('문항을 하나 이상 넣어 주세요.','crit');
  const title=String(f.title||r.title||'인플루언서 모집').trim();
  let tokP=null;if(DB.mode!=='demo')tokP=rqGTok(); // 클릭 직후 권한 창을 띄워야 팝업이 막히지 않음
  A.rq.busy='form';render();const id=A.rcid;
  try{if(tokP)await tokP;
    let form,editUrl,qmap={},shared=0;
    if(DB.mode==='demo'){await new Promise(x=>setTimeout(x,700));const fid='demo'+uid();form={formId:fid,responderUri:'https://docs.google.com/forms/d/e/'+fid+'/viewform'};editUrl='https://docs.google.com/forms/d/'+fid+'/edit';qs.forEach((q,i)=>qmap['dq'+i]=q.key||'')}
    else{
      form=await rqG('POST','https://forms.googleapis.com/v1/forms',{info:{title,documentTitle:title}});
      const reqs=[{updateFormInfo:{info:{description:String(f.desc||'')},updateMask:'description'}},...qs.map((q,i)=>({createItem:{item:rqItem(q),location:{index:i}}}))];
      const bu=await rqG('POST',`https://forms.googleapis.com/v1/forms/${form.formId}:batchUpdate`,{includeFormInResponse:false,requests:reqs});
      (bu.replies||[]).slice(1).forEach((rep,i)=>{const qid=((rep.createItem||{}).questionId||[])[0];if(qid)qmap[qid]=qs[i].key||''});
      try{await rqG('POST',`https://forms.googleapis.com/v1/forms/${form.formId}:setPublishSettings`,{publishSettings:{publishState:{isPublished:true,isAcceptingResponses:true}}})}catch(e){console.warn('publish',e.message)}
      editUrl=`https://docs.google.com/forms/d/${form.formId}/edit`;
      if(f.share!==false){const ems=Object.entries(A.admins||{}).filter(([em,a])=>em!==A.user.email&&(a.acct||TEAM)===TEAM&&['master','manager'].includes(a.role)).map(([em])=>em).slice(0,20);
        for(const em of ems){let ok=0;for(const fid of [form.formId]){try{await rqG('POST',`https://www.googleapis.com/drive/v3/files/${fid}/permissions?sendNotificationEmail=false`,{role:'writer',type:'user',emailAddress:em});ok++}catch(e){console.warn('share',em,e.message);if(e.api)break}}if(ok)shared++}}}
    const code=await rqMakeLink(r,form.responderUri);
    await DB.update('recruits/'+id,{form:{...f,title,qs,formId:form.formId,responderUri:form.responderUri,editUrl,code,qmap,owner:A.user.email,createdAt:T_NOW(),shared},updatedAt:T_NOW(),by:A.user.email});
    A.rq.visits[id]=0;toast('구글폼 · 축약 링크를 만들었습니다. 스레드 글의 {링크} 가 축약 링크로 바뀝니다. 신청자 시트는 구글폼 「응답」 탭에서 「Sheets에 연결」을 눌러 주세요.')}
  catch(e){console.error(e);A.rq.gErr={msg:'구글폼을 만들지 못했습니다: '+(e.message||e),api:e.api||''};toast(A.rq.gErr.msg,'crit')}
  finally{A.rq.busy='';render()}}

/* 신청 인플루언서 리스트: 구글폼 「응답」 탭 → 「Sheets에 연결」로 생긴 시트 (Forms API linkedSheetId) */
function rqSheetUrl(f){f=f||{};if(f.linkedSheetId)return 'https://docs.google.com/spreadsheets/d/'+f.linkedSheetId+'/edit';return f.linkedSheetUrl||''}
async function rqSheetLink(){const r=rqCur();if(!r||A.rq.busy)return;const f=r.form||{};if(!f.formId)return toast('플랫폼에서 만든 폼만 확인할 수 있습니다.','crit');
  let tokP=null;if(DB.mode!=='demo')tokP=rqGTok();A.rq.busy='sheet';render();const id=A.rcid;
  try{if(tokP)await tokP;let ls='';
    if(DB.mode==='demo'){await new Promise(x=>setTimeout(x,400));ls='demo_linked_'+String(f.formId).slice(-6)}
    else{const fm=await rqG('GET',`https://forms.googleapis.com/v1/forms/${f.formId}`);ls=fm.linkedSheetId||''}
    if(!ls){toast('아직 연결된 시트가 없습니다. 「응답 탭 열기」 → 「Sheets에 연결」 → 「새 스프레드시트 만들기」를 누른 뒤 다시 확인해 주세요.','crit');return}
    await DB.update('recruits/'+id,{'form.linkedSheetId':ls,updatedAt:T_NOW()});toast('신청 인플루언서 리스트 시트를 가져왔습니다.')}
  catch(e){console.error(e);toast('시트 연결을 확인하지 못했습니다: '+(e.message||e),'crit')}
  finally{A.rq.busy='';render()}}

/* ============ 신청자 불러오기 · 정리 ============ */
const rqAnsText=a=>a&&a.textAnswers?(a.textAnswers.answers||[]).map(x=>x.value).filter(Boolean).join(', '):'';
function rqNormApp(vals,at,extra){const o={at,raw:{}};const memo=[];
  for(const {key,title,val} of vals){if(!val)continue;o.raw[title]=val;
    if(key==='agree'||key==='')continue;
    if(key==='memo'){memo.push(val);continue}if(key==='fol'){o.fol=parseNum(String(val).replace(/명|명정도|약|이상/g,''));continue}
    if(key==='chlink'){let u=String(val).trim().split(/\s+/)[0];if(!/^https?:\/\//i.test(u)&&/\./.test(u))u='https://'+u;try{const x=new URL(u);x.search='';x.hash='';u=x.toString().replace(/\/$/,'')}catch(e){}o.chlink=u;continue}
    if(key==='ch'){o.ch=normCh(val);continue}if(key==='offer'){o.offer=parseNum(val);continue}o[key]=String(val).trim()}
  vals.filter(v=>v.key===''&&v.val&&!/동의/.test(v.title)).forEach(v=>memo.push(`${v.title}: ${v.val}`));
  if(o.chlink){const pc=parseChLink(o.chlink);if(pc){if(!o.ch)o.ch=pc.ch;if(pc.acct)o.acct=pc.acct}}
  if(!o.name)o.name=o.acct||o.realname||'';if(o.ch&&!CHANNELS.includes(o.ch))o.ch=normCh(o.ch);
  o.memo=memo.join(' / ').slice(0,500);Object.assign(o,extra||{});return o}
async function rqSyncApps(){const r=rqCur();if(!r||A.rq.busy)return;const f=r.form||{};if(!f.formId)return toast('플랫폼에서 만든 폼만 불러올 수 있습니다.','crit');
  if(DB.mode!=='demo'&&f.owner&&f.owner!==A.user.email)toast(`이 폼은 ${f.owner} 계정으로 만들었습니다. 같은 계정이 아니면 불러오지 못할 수 있습니다.`);
  let tokP=null;if(DB.mode!=='demo')tokP=rqGTok();A.rq.busy='sync';render();const id=A.rcid;
  try{if(tokP)await tokP;let list=[];const qmap={...(f.qmap||{})};let heads=[];let lsId='';
    if(DB.mode==='demo'){await new Promise(x=>setTimeout(x,600));list=rqDemoResps(f)}
    else{const fm=await rqG('GET',`https://forms.googleapis.com/v1/forms/${f.formId}`);lsId=fm.linkedSheetId||'';
      const items=(fm.items||[]).filter(it=>it.questionItem&&it.questionItem.question);
      heads=items.map(it=>({qid:it.questionItem.question.questionId,title:it.title||''}));
      heads.forEach(h=>{if(!(h.qid in qmap))qmap[h.qid]=rqGuessKey(h.title)});
      let pt='';do{const j=await rqG('GET',`https://forms.googleapis.com/v1/forms/${f.formId}/responses?pageSize=5000${pt?'&pageToken='+encodeURIComponent(pt):''}`);(j.responses||[]).forEach(x=>list.push(x));pt=j.nextPageToken||''}while(pt&&list.length<20000);
      list=list.map(x=>({id:x.responseId,at:x.lastSubmittedTime||x.createTime,vals:heads.map(h=>({key:qmap[h.qid]||'',title:h.title,val:rqAnsText((x.answers||{})[h.qid])}))}))}
    const old=r.apps||{};const apps={};
    list.forEach(x=>{const k='r'+String(x.id).replace(/[^A-Za-z0-9_]/g,'_').slice(0,60);const prev=old[k]||{};apps[k]=rqNormApp(x.vals,x.at,prev.added?{added:prev.added}:{})});
    for(const k in old)if(!apps[k]&&old[k].added)apps[k]=old[k]; // 폼에서 지운 응답이라도 이미 옮긴 사람은 기록 유지
    const nNew=Object.keys(apps).filter(k=>!old[k]).length;
    await DB.update('recruits/'+id,{apps,'form.qmap':qmap,'form.lastSync':T_NOW(),'form.syncBy':A.user.email,'form.nResp':list.length,...(lsId?{'form.linkedSheetId':lsId}:{}),updatedAt:T_NOW()});
    toast(`신청자 ${list.length}명을 불러왔습니다${nNew?` (새로 ${nNew}명)`:''}.${!lsId&&!rqSheetUrl(f)&&DB.mode!=='demo'?' 신청 인플루언서 리스트 시트는 구글폼 「응답」 탭 → 「Sheets에 연결」로 만들 수 있습니다.':''}`)}
  catch(e){console.error(e);toast('신청자를 불러오지 못했습니다: '+(e.message||e),'crit')}
  finally{A.rq.busy='';render()}}
const rqKst=iso=>{const d=new Date(iso);if(isNaN(d))return String(iso||'');const k=new Date(d.getTime()+9*3600e3).toISOString();return k.slice(0,10)+' '+k.slice(11,16)};
function rqDemoResps(f){const qs=f.qs||[];const ppl=[['데일리뷰티 민지','김민지','인스타그램','https://www.instagram.com/daily_minji','24500','뷰티'],['틱톡하는 서아','박서아','틱톡','https://www.tiktok.com/@seoa.tok','58000','라이프스타일'],['하루살림','이하루','인스타그램','https://www.instagram.com/haru_salim?igsh=abc','8100','육아'],['뷰티로그 지우','최지우','유튜브','https://www.youtube.com/@jiwoo_log','12900','뷰티'],['오늘의 피부','정다은','인스타그램','https://www.instagram.com/today_skin','3600','뷰티'],['캠퍼 준','한준','틱톡','https://www.tiktok.com/@camper.jun','105000','여행']];
  return ppl.map((p,i)=>({id:'demo_'+i,at:new Date(Date.now()-(6-i)*3600e3*7).toISOString(),vals:qs.map(q=>({key:q.key||'',title:q.title,val:q.key==='name'?p[0]:q.key==='realname'?p[1]:q.key==='ch'?p[2]:q.key==='chlink'?p[3]:q.key==='fol'?p[4]:q.key==='cat'?p[5]:q.key==='contact'?'010-1234-56'+String(10+i):q.key==='email'?`user${i}@example.com`:q.key==='addr'?'서울시 강남구 테헤란로 '+(100+i):q.key==='memo'?'평소 쓰던 제품이라 솔직한 후기를 남기고 싶어요.':q.key==='agree'?'동의합니다':q.type==='radio'?(q.opts||[])[i%Math.max(1,(q.opts||[]).length)]||'':''}))}))}

/* ---- 신청자 → 캠페인 인플루언서 관리 (→ 풀 자동 누적) ---- */
async function rqToCampaign(cid){const r=rqCur();if(!r)return;const c=A.campaigns[cid];if(!c)return toast('캠페인을 찾을 수 없습니다.','crit');
  const picks=rqApps(r).filter(a=>A.rq.sel.has(a.k)&&!a.added);if(!picks.length)return toast('추가할 신청자를 골라 주세요.','crit');
  let rd;try{rd=await DB.get('rows/'+cid)}catch(e){return saveErr(e)}
  const cur=rowsArr(rd);const have=new Map(cur.map(x=>[poolKey(x),x.id]).filter(([k])=>k));let order=cur.reduce((t,x)=>Math.max(t,x.order||0),0);
  const up={},rup={};let add=0,dup=0;const when=today();
  picks.forEach(a=>{const row={order:order+1,createdAt:when,name:String(a.name||a.acct||a.realname||'').trim(),stage:'컨택',contract:'미완료',disc:'미완료',lastc:when,recruit:A.rcid,
      memo:`${r.round||1}차 모집 신청 (${md(String(a.at||'').slice(0,10))})${a.memo?' · '+a.memo:''}`.slice(0,300)};
    ['acct','ch','chlink','fol','cat','contact','email','realname','addr','offer'].forEach(k=>{if(has(a[k]))row[k]=a[k]});if(isTrial(c))row.apply='완료';row.tier=tierOf(row.fol)||'';if(!row.tier)delete row.tier;
    const pk=poolKey(row);if(pk&&have.has(pk)){dup++;rup[`apps.${a.k}.added`]={cid,rowId:have.get(pk),at:T_NOW(),dup:true};return}
    order++;add++;const rid=uid();up[`rows.${rid}`]=row;rup[`apps.${a.k}.added`]={cid,rowId:rid,at:T_NOW(),by:A.user.email};if(pk)have.set(pk,rid)});
  try{if(add){if(rd)await DB.update('rows/'+cid,up);else{const rows={};for(const k in up)rows[k.slice(5)]=up[k];await DB.set('rows/'+cid,{rows})}}
    await DB.update('recruits/'+A.rcid,{...rup,updatedAt:T_NOW()});A.rq.sel=new Set();
    if(add)scheduleSync(cid);toast(`「${c.name}」 인플루언서 관리에 ${add}명을 컨택 단계로 추가했습니다${dup?` (이미 있는 ${dup}명은 건너뜀)`:''}. 인플루언서 풀에도 쌓입니다.`);render()}
  catch(e){saveErr(e)}}
async function rqToPool(){const r=rqCur();if(!r)return;const picks=rqApps(r).filter(a=>A.rq.sel.has(a.k)&&!a.added);if(!picks.length)return toast('등록할 신청자를 골라 주세요.','crit');
  const ops=[],rup={};let add=0,ex=0;
  picks.forEach(a=>{const p={name:String(a.name||a.acct||a.realname||'').trim(),acct:a.acct||'',ch:a.ch||'기타'};const k=poolKey(p);if(!k)return;
    if(A.pool&&A.pool[k]){ex++;rup[`apps.${a.k}.added`]={pool:true,pid:k,at:T_NOW()};return}
    const d={...p,createdAt:today(),updatedAt:today(),rating:null,memo:`${r.title||''} 신청자${a.memo?' · '+a.memo:''}`.slice(0,300),exclude:false,campaigns:{},manual:true,tier:tierOf(a.fol)||''};
    ['chlink','fol','cat','contact','email'].forEach(f=>{if(has(a[f]))d[f]=a[f]});ops.push(DB.set('pool/'+k,d));add++;rup[`apps.${a.k}.added`]={pool:true,pid:k,at:T_NOW(),by:A.user.email}});
  try{await Promise.all(ops);await DB.update('recruits/'+A.rcid,{...rup,updatedAt:T_NOW()});A.rq.sel=new Set();toast(`인플루언서 풀에 ${add}명을 등록했습니다${ex?` (이미 풀에 있는 ${ex}명은 표시만)`:''}.`);render()}catch(e){saveErr(e)}}

/* ============ 스타일 ============ */
function rqCss(){return rqCss.done?'':(rqCss.done=1,document.head.insertAdjacentHTML('beforeend',`<style id="rq-css">
.rq-th{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;border:1px solid var(--line2);border-radius:99px;padding:4px 11px;background:var(--surface)}.rq-th.on{border-color:transparent;background:var(--ink);color:#fff}.rq-th em{font-style:normal;font-size:11px;background:var(--warn-soft);color:var(--warn);border-radius:9px;padding:0 6px}
.rq-grp{margin-bottom:14px}.rq-gt{font-size:15px}.rq-tbl td{vertical-align:middle}.rq-sub{display:block;font-size:12px;color:var(--muted);margin-top:2px}
.rq-rd{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:24px;padding:0 8px;border-radius:7px;background:var(--accent-soft);color:var(--accent);font-weight:700;font-size:12px}
.rq-mono{font-family:var(--mono);font-size:12px}
.rq-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px 18px}.rq-flow{list-style:none;display:flex;gap:10px;padding:0;margin:14px 0 0;flex-wrap:wrap;justify-content:center}
.rq-flow li{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:120px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);font-weight:600;color:var(--ink)}.rq-flow i{font-style:normal;width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px}.rq-flow small{font-weight:400;color:var(--muted);font-size:11.5px}
.rq-sec{margin-top:16px}.rq-sec h3{font-size:13.5px;font-weight:700;margin:0 0 10px}
.rq-file>span:first-child{font-size:12.5px;font-weight:500;color:var(--ink2)}.rq-file{display:flex;flex-direction:column;gap:5px}.rq-filebox{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px dashed var(--line2);border-radius:8px;padding:6px 10px}
.rq-filebox.done{border:1px solid #16a34a;background:rgba(22,163,74,.08)}.rq-filebox.done .grow{display:flex;flex-direction:column;min-width:0}.rq-filebox.done b{color:#15803d}.rq-filebox.done .small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rq-upok{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#16a34a;color:#fff;font-weight:700;flex:none}
.rq-upbtn{border-style:dashed}.rq-upbtn.busy{opacity:.8;cursor:wait}
.rq-pvact{display:flex;flex-direction:column;gap:6px;margin-top:12px}.rq-pvact .btn{width:100%;justify-content:center}
.rq-lfull{font-size:11px;color:var(--muted);margin:-2px 0 8px;word-break:break-all;line-height:1.4}.rq-lfull a{color:inherit}
.rq-sep{display:flex;align-items:center;gap:10px;margin:22px 0 12px;font-weight:600;font-size:14px}.rq-sep:before,.rq-sep:after{content:'';height:1px;background:var(--line);flex:1}
.rq-sumd{margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--bg2,rgba(35,71,212,.06));font-size:13px;line-height:1.5}
.rq-h1 input{font-size:22px;font-weight:700;border-color:transparent;padding:4px 8px;margin-left:-8px;max-width:640px;background:transparent}.rq-h1 input:hover{border-color:var(--line2)}
.rq-steps button i{font-style:normal;width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}.rq-steps button i.ok{background:var(--ok);border-color:var(--ok);color:#fff}
.rq-post{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:16px;align-items:start}.rq-col{min-width:0}
.rq-pbox{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px}.rq-ph{display:flex;align-items:center;gap:8px;margin-bottom:8px}.rq-ph b{flex:1;font-size:13px}
.rq-cnt{font-size:12px;font-variant-numeric:tabular-nums;color:var(--muted)}.rq-cnt.over{color:var(--crit);font-weight:700}
.rq-pvcol{position:sticky;top:76px}.rq-pvh{font-size:12px;font-weight:600;color:var(--muted);margin:0 0 6px}
.rq-pv{background:#fff;color:#000;border:1px solid var(--line);border-radius:16px;padding:16px 16px 6px;font-size:14px;line-height:1.5;max-height:70vh;overflow:auto}
.rq-pi{display:flex;gap:10px}.rq-av{display:flex;flex-direction:column;align-items:center;flex:none}.rq-av span{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#131822,#4b5568);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}.rq-av i{flex:1;width:2px;background:#e3e3e3;margin:6px 0;min-height:16px}
.rq-pb{flex:1;min-width:0;padding-bottom:14px}.rq-pn{display:flex;gap:6px;align-items:baseline}.rq-pn b{font-size:14px}.rq-pn span{color:#999;font-size:13px}.rq-pt{white-space:normal;overflow-wrap:anywhere;margin-top:2px}.rq-pa{color:#666;font-size:14px;margin-top:8px;letter-spacing:2px}
.rq-lk{color:#0095f6}.rq-tag{color:#0095f6}
.rq-posted{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-top:12px;padding:12px 14px;border-radius:12px;background:var(--ok-soft);color:var(--ok)}.rq-posted span{color:var(--ink2);font-size:12.5px;flex:1}
.rq-lcs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.rq-lc{border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px;background:var(--surface2);min-width:0}.rq-lc:first-child{background:var(--accent-soft);border-color:transparent}
.rq-lt{font-weight:700;font-size:13.5px}.rq-ls{font-size:12px;color:var(--muted)}.rq-lu{font-family:var(--mono);font-size:12px;overflow-wrap:anywhere;flex:1}
.rq-qs{display:flex;flex-direction:column;gap:10px}.rq-q{display:flex;gap:10px;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface)}.rq-qn{flex:none;width:24px;height:24px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}
.rq-qb{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}.rq-qr{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.rq-qr>input[type=text]{flex:1 1 220px;font-weight:600}.rq-qd{font-size:12.5px}
.rq-opts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.rq-opt{display:inline-flex;align-items:center;gap:2px}.rq-opt input{width:130px;padding:5px 8px;font-size:12.5px}
.rq-qro{margin:0;padding-left:20px;line-height:2;font-size:13px}.rq-req{color:var(--crit);font-weight:700}
.rq-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:10px;background:var(--surface2);margin-bottom:12px}
.rq-atbl tr.sel td{background:var(--accent-soft)}.rq-atbl td{white-space:nowrap}.rq-atbl td.rq-memo{white-space:normal;min-width:220px;max-width:320px}
.rq-spin{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:rqs 0.8s linear infinite;vertical-align:-2px}@keyframes rqs{to{transform:rotate(360deg)}}
@media (max-width:860px){.rq-post{grid-template-columns:minmax(0,1fr)}.rq-pvcol{position:static}.rq-h1 input{font-size:19px}.rq-bar select{max-width:100%!important;width:100%!important}}
</style>`),'')}
