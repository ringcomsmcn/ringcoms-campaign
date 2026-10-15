/* RINGCOMS 캠페인 관리 · 모두싸인 API 연동 (인플루언서 계약 관리 2단계, v0.24)
   - 연동 관리: 모두싸인 계정 이메일 + API Key 저장(마스터) → /api/modusign 이 실제 조회로 확인
   - 인플루언서 계약 관리: 템플릿을 골라 「API로 서명 요청」 → 문서 ID를 행에 기록 → 상태 자동 확인(서명 완료 시 계약 완료 반영)
   - 서명 요청 1건 = 모두싸인 API 서명 1건 사용 (테스트 제공량 30건). 상태 확인·알림 재전송은 사용량을 쓰지 않음 */
window.CONFIRM_ACTS=[...(window.CONFIRM_ACTS||[]),'msSend','msClear'];
const MS_DOC=id=>`https://app.modusign.co.kr/documents/${id}`;
const MS_ST={ON_GOING:'서명 진행 중',COMPLETED:'서명 완료',ABORTED:'취소·거절',DRAFT:'초안',SCHEDULED:'예약',APPROVAL_PENDING:'내부 결재 대기',REJECTED:'거절',CANCELED:'취소'};
A.ms=A.ms||{busy:false,syncAt:{},form:{}};

/* ---- 연결 상태 ---- */
async function msLoad(force){if(!canEdit()||(A.ms.loading&&!force))return;A.ms.loading=true;scheduleRender();
  try{if(DB.mode==='demo'){await new Promise(r=>setTimeout(r,200));A.msSt=A.msDemo?{configured:true,ok:true,email:A.msDemo.email,mask:'demo…key',by:A.user.email,at:A.msDemo.at,limit:30,until:'2026-10-28',templates:[{id:'tpl_demo1',title:'인플루언서 광고 계약서 (기본)',roles:[{role:'인플루언서',order:1},{role:'링컴즈',order:2}],inputs:['인플루언서명','원고료','업로드 예정일','캠페인']}]}:{configured:false}}
    else A.msSt=await aiFetch('/api/modusign',{action:'status'})}
  catch(e){A.msSt={error:/404/.test(e.message)?'연동 서버에 연결하지 못했습니다 (배포 후 다시 시도).':e.message}}
  finally{A.ms.loading=false;scheduleRender()}}
const msOn=()=>!!(A.msSt&&A.msSt.configured&&A.msSt.ok);
/* 사용량: 캠페인 요약의 API 서명 요청 건수 합 (테스트 기간) */
function msUsed(){return Object.values(A.campaigns||{}).reduce((t,c)=>t+n((c.summary||{}).ctApi),0)}
function msLeft(){const L=(A.msSt&&A.msSt.limit)||30;return Math.max(0,L-msUsed())}

/* ---- 연동 관리 화면 ---- */
function msRow(row){if(!canEdit())return row('모두싸인','<span class="pill accent">링크 연결</span>','인플루언서 계약 관리','모두싸인 팀 계정');if(!A.msSt&&!A.ms.loading)setTimeout(()=>msLoad(),0);const s=A.msSt||{};
  const pill=A.ms.loading&&!A.msSt?'<span class="pill">확인 중…</span>':s.error?'<span class="pill crit">확인 실패</span>':msOn()?'<span class="pill ok">API 연결됨</span>':s.configured?'<span class="pill warn">키 오류</span>':'<span class="pill warn">API 미연결 · 링크 사용</span>';
  return row('모두싸인 API',pill,'인플루언서 계약 관리: 템플릿으로 서명 요청 보내기, 서명 진행·완료 상태 자동 반영, 완료 계약서 열기'+(msOn()?`<div class="small" style="margin-top:6px">API 서명 사용 <b>${msUsed()}</b> / ${s.limit||30}건${s.until?` · ${md(s.until)}까지 테스트`:''} · 템플릿 ${(s.templates||[]).length}개</div>`:''),'아래 모두싸인 API 연결 (계정 이메일 + API Key)')}
function msIntPanel(){if(!canEdit())return '';if(!A.msSt&&!A.ms.loading)setTimeout(()=>msLoad(),0);const s=A.msSt||{};const ed=isMaster();const tp=s.templates||[];
  const pill=A.ms.loading&&!A.msSt?'<span class="pill">확인 중…</span>':s.error?'<span class="pill crit">확인 실패</span>':msOn()?'<span class="pill ok">연결됨</span>':s.configured?'<span class="pill warn">키 오류</span>':'<span class="pill warn">미연결</span>';
  const used=msUsed(),L=s.limit||30,p=Math.min(100,Math.round(used/L*100));
  return `<section class="panel"><div class="panel-h"><div><h2>모두싸인 API 연결</h2><div class="sub">인플루언서 계약 관리에서 템플릿으로 서명 요청을 보내고, 서명 완료를 자동으로 반영합니다. 키는 마스터만 저장하고, 마스터·매니저만 읽을 수 있는 곳에 보관됩니다.</div></div><div class="row">${pill}<button class="btn sm ghost" data-act="msRecheck" ${A.ms.loading?'disabled':''}>다시 확인</button></div></div>
   ${s.error?`<p class="small" style="color:var(--crit,#d33);margin:0 0 10px">${esc(s.error)}</p>`:''}
   ${s.configured?`<dl class="kv" style="grid-template-columns:auto 1fr;margin-bottom:12px"><dt>모두싸인 계정</dt><dd style="text-align:left;font-weight:400">${esc(s.email||'')} · 키 <code>${esc(s.mask||'')}</code>${s.at?` · ${fmtDT(s.at)} ${esc(s.by||'')} 저장`:''}</dd>
     ${msOn()?`<dt>API 서명 사용</dt><dd style="text-align:left;font-weight:400"><b>${used}</b> / ${L}건 (남은 ${Math.max(0,L-used)}건)${s.until?` · 테스트 기간 ${md(s.until)}까지`:''}<div style="height:6px;background:var(--line);border-radius:3px;margin-top:4px;max-width:320px"><div style="height:6px;width:${p}%;background:${p>=80?'var(--crit,#d33)':'var(--accent,#2a6)'};border-radius:3px"></div></div><span class="small muted">이 플랫폼에서 보낸 서명 요청 기준 · 상태 확인·알림 재전송은 사용량을 쓰지 않습니다</span></dd>
     <dt>템플릿</dt><dd style="text-align:left;font-weight:400">${tp.length?tp.map(t=>`<div class="small"><b>${esc(t.title)}</b> <span class="muted">서명자: ${esc((t.roles||[]).map(r=>r.role).join(', ')||'–')}${(t.inputs||[]).length?` · 요청자 입력: ${esc(t.inputs.join(', '))}`:''}</span></div>`).join(''):'<span class="small" style="color:var(--crit,#d33)">템플릿이 없습니다. 모두싸인에서 계약서 템플릿을 먼저 만들어 주세요 (서명자 역할 예: 인플루언서).</span>'}</dd>`:''}</dl>`:''}
   ${ed?`<div class="fgrid"><label class="f">모두싸인 계정 이메일<input type="email" id="ms-email" value="${esc(s.email||'')}" placeholder="모두싸인에 로그인하는 이메일" autocomplete="off"></label>
     <label class="f">API Key<input type="password" id="ms-key" placeholder="${s.configured?'새 키로 바꾸려면 붙여넣기':'모두싸인에서 만든 API Key 붙여넣기'}" autocomplete="off"></label>
     <label class="f">API 서명 제공량 (건)<input type="text" inputmode="numeric" id="ms-limit" value="${esc(String(s.limit||30))}"></label><label class="f">테스트 기간 끝<input type="date" id="ms-until" value="${esc(s.until||'2026-10-28')}"></label>
     <div class="f"><span>&nbsp;</span><div class="row"><button class="btn primary" data-act="msSave" ${A.ms.saving?'disabled':''}>${A.ms.saving?'확인하고 저장하는 중…':'확인하고 저장'}</button>${s.configured?`<button class="btn danger" data-act="msClear">${A.confirm==='msClear'?'한 번 더 누르면 삭제':'저장한 키 삭제'}</button>`:''}</div></div></div>`:'<p class="small muted" style="margin:0">API Key 연결·변경은 마스터만 할 수 있습니다.</p>'}
   <details style="margin-top:10px"${s.configured?'':' open'}><summary class="small bold" style="cursor:pointer">API Key 만드는 방법</summary><ol class="steps small" style="margin-top:8px">
    <li><a href="https://app.modusign.co.kr" target="_blank" rel="noopener">모두싸인</a>에 로그인 → 우측 상단 <b>설정(톱니바퀴)</b></li><li>상단 <b>워크스페이스 관리</b> → 좌측 <b>API Key</b> → <b>API Key 생성하기</b></li><li>이름(예: ad.ringcoms.com)과 만료 기한을 정하고 <b>생성하기</b> → 나온 키를 복사해 위 칸에 붙여넣고 「확인하고 저장」</li>
    <li>계약서는 모두싸인 <b>템플릿</b>으로 만들어 두세요. 서명자 역할(예: 인플루언서)과 요청자 입력란 라벨(예: 인플루언서명 · 원고료 · 업로드 예정일)을 넣어 두면 플랫폼 정보가 자동으로 채워집니다.</li></ol></details></section>`}

/* ---- 계약 관리: 목록 버튼 · 상단 바 ---- */
function msBtn(r){if(!msOn()||!canEdit())return '';if(r.ctApi&&r.ctApi.docId)return '';if(r.contract==='완료')return '';return `<button class="btn sm primary" data-act="ctOpen" data-r="${r.id}" title="모두싸인 템플릿으로 서명 요청 (API 1건 사용)">API 서명 요청</button>`}
function msDocPill(r){const a=r.ctApi;if(!a||!a.docId)return '';const st=a.status||'';const cls=st==='COMPLETED'?'ok':/ABORT|REJECT|CANCEL/.test(st)?'crit':'accent';const sg=a.signed!=null&&a.total?` ${a.signed}/${a.total}`:'';return `<span class="pill ${cls}" title="모두싸인 문서 상태${a.syncAt?' · '+fmtDT(a.syncAt)+' 확인':''}">${esc(MS_ST[st]||st||'요청됨')}${sg}</span>`}
function msCtBar(c,rows){if(!canEdit())return '';if(!A.msSt&&!A.ms.loading)setTimeout(()=>msLoad(),0);
  if(!msOn())return A.msSt&&A.msSt.configured===false&&isMaster()?'<div class="banner info" style="margin:0 0 10px">모두싸인 API를 연결하면 여기서 바로 서명 요청을 보내고 서명 완료가 자동으로 반영됩니다. <a href="#" data-act="nav" data-v="team" data-tt="int">연동 관리에서 연결하기 →</a></div>':'';
  const pend=rows.filter(r=>r.ctApi&&r.ctApi.docId&&!/COMPLETED|ABORT|REJECT|CANCEL/.test(r.ctApi.status||''));
  const last=A.ms.syncAt[A.cid];if(pend.length&&(!last||Date.now()-last>120000)&&!A.ms.syncing)setTimeout(()=>msSync(false),0);
  return `<div class="ms-bar"><span class="pill ok">모두싸인 API 연결됨</span><span class="small muted">서명 요청 ${rows.filter(r=>r.ctApi&&r.ctApi.docId).length}건 · 진행 중 ${pend.length}건 · API 서명 남은 ${msLeft()}건${A.msSt.until?` (${md(A.msSt.until)}까지)`:''}</span><span class="grow"></span>${pend.length?`<button class="btn sm" data-act="msSyncBtn" ${A.ms.syncing?'disabled':''}>${A.ms.syncing?'확인 중…':'서명 상태 새로고침'}</button>`:''}${last?`<span class="small muted">${fmtDT(new Date(last).toISOString())} 확인</span>`:''}</div>`}
/* 진행 중 문서 상태 확인 → 행에 반영 (서명 완료 → 계약 완료) */
async function msSync(manual){if(A.ms.syncing)return;const c=curC();if(!c||!A.cid)return;const rows=curRows().filter(r=>r.ctApi&&r.ctApi.docId&&!/COMPLETED|ABORT|REJECT|CANCEL/.test(r.ctApi.status||''));if(!rows.length){if(manual)toast('확인할 진행 중 문서가 없습니다.');return}
  A.ms.syncing=true;A.ms.syncAt[A.cid]=Date.now();scheduleRender();
  try{let docs={},errors={};if(DB.mode==='demo'){await new Promise(r=>setTimeout(r,500));rows.forEach((r,i)=>{docs[r.ctApi.docId]={id:r.ctApi.docId,status:i%2?'ON_GOING':'COMPLETED',participants:[{status:'SIGNED'},{status:i%2?'ON_GOING':'SIGNED'}],completedAt:new Date().toISOString(),file:''}})}
    else{const j=await aiFetch('/api/modusign',{action:'sync',ids:rows.map(r=>r.ctApi.docId)});docs=j.docs||{};errors=j.errors||{}}
    const up={};let done=0,changed=0;const now=new Date().toISOString();
    rows.forEach(r=>{const d=docs[r.ctApi.docId];if(!d)return;const b=`rows.${r.id}.`;const ps=d.participants||[];const signed=ps.filter(p=>/SIGNED|COMPLETED|DONE/i.test(p.status||'')).length;
      const prev=r.ctApi.status;up[b+'ctApi.status']=d.status||'';up[b+'ctApi.syncAt']=now;up[b+'ctApi.signed']=signed;up[b+'ctApi.total']=ps.length;if(d.file)up[b+'ctApi.file']=d.file;
      if(d.status==='COMPLETED'&&r.contract!=='완료'){done++;up[b+'contract']='완료';up[b+'ctStep']='완료';up[b+'ctDoneAt']=d.completedAt||now;up[b+'ctLog']=[...(Array.isArray(r.ctLog)?r.ctLog:[]),{at:now,step:'완료',by:'모두싸인 API'}].slice(-20)}
      else if(/ABORT|REJECT|CANCEL/.test(d.status||'')&&ctOf(r)!=='반려·취소'){up[b+'ctStep']='반려·취소';up[b+'ctLog']=[...(Array.isArray(r.ctLog)?r.ctLog:[]),{at:now,step:'반려·취소',by:'모두싸인 API'}].slice(-20)}
      if(prev!==d.status)changed++});
    if(Object.keys(up).length){await DB.update('rows/'+A.cid,up);scheduleSync(A.cid)}
    if(manual||done)toast(done?`서명 완료 ${done}건을 계약 완료로 반영했습니다.`:changed?'서명 상태를 새로 반영했습니다.':'바뀐 서명 상태가 없습니다.');
    if(Object.keys(errors).length&&manual)toast('일부 문서를 확인하지 못했습니다: '+Object.values(errors)[0],'crit')}
  catch(e){if(manual)toast('서명 상태를 확인하지 못했습니다: '+e.message,'crit')}
  finally{A.ms.syncing=false;scheduleRender()}}

/* ---- 계약 서랍: API로 서명 요청 ---- */
const msNorm=s=>String(s||'').toLowerCase().replace(/[\s·_()\-:]/g,'');
function msAutoVal(c,r,label){const L=msNorm(label);const pairs=[...ctInfo(c,r),['이름',r.realname||r.name],['성명',r.realname||r.name],['활동명',r.name],['금액',has(r.fee)?fmt(r.fee)+'원':''],['광고비',has(r.fee)?fmt(r.fee)+'원':''],['업로드일',r.due],['브랜드',c.brand],['제품',(c.trial&&c.trial.product)||(c.com&&c.com.product)||''],['계약기간',c.start?`${c.start} ~ ${c.end||''}`:''],['오늘',today()]];
  const hit=pairs.find(([k])=>msNorm(k)===L)||pairs.find(([k])=>L.includes(msNorm(k))||msNorm(k).includes(L));return hit?String(hit[1]||''):''}
function msDrawer(c,r,rid){if(!canEdit()||isTrial(c))return '';if(!A.msSt&&!A.ms.loading)setTimeout(()=>msLoad(),0);
  if(!msOn())return '';const a=r.ctApi||{};
  if(a.docId)return `<section class="stack ms-box" style="gap:8px"><div class="row" style="justify-content:space-between"><b>모두싸인 API 서명 요청</b>${msDocPill(r)}</div>
    <div class="small muted">${fmtDT(a.at)} · ${esc(a.by||'')} · ${esc(a.tplTitle||'')}${a.signed!=null&&a.total?` · 서명 ${a.signed}/${a.total}명`:''}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn sm" href="${esc(MS_DOC(a.docId))}" target="_blank" rel="noopener">모두싸인에서 문서 보기 ↗</a>${a.file?`<a class="btn sm" href="${esc(a.file)}" target="_blank" rel="noopener">완료 계약서 받기 ↗</a>`:''}
     ${!/COMPLETED|ABORT|REJECT|CANCEL/.test(a.status||'')?`<button class="btn sm" data-act="msSyncBtn">상태 새로고침</button><button class="btn sm ghost" data-act="msRemind" data-r="${rid}" title="서명자에게 알림을 다시 보냅니다 (사용량 없음)">서명 알림 다시 보내기</button>`:''}
     ${/ABORT|REJECT|CANCEL/.test(a.status||'')?`<button class="btn sm" data-act="msReset" data-r="${rid}">다시 요청하기</button>`:''}</div></section>`;
  const tp=(A.msSt.templates||[]);const F=A.ms.form[rid]||(A.ms.form[rid]={});const tid=F.tid&&tp.find(t=>t.id===F.tid)?F.tid:(tp[0]||{}).id||'';const t=tp.find(x=>x.id===tid)||{roles:[],inputs:[]};
  const roles=(t.roles&&t.roles.length?t.roles:[{role:'서명자',order:1}]);const left=msLeft();
  const defP=(i)=>i===0?{name:r.realname||r.name||'',type:r.email?'EMAIL':r.contact?'KAKAO':'EMAIL',value:r.email||r.contact||''}:{name:'',type:'EMAIL',value:''};
  return `<section class="stack ms-box" style="gap:10px"><div class="row" style="justify-content:space-between"><b>모두싸인 API로 서명 요청</b><span class="small muted">API 서명 남은 ${left}건</span></div>
   ${tp.length?`<label class="f">계약서 템플릿<select data-msf="${rid}.tid">${tp.map(x=>`<option value="${esc(x.id)}" ${x.id===tid?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label>
   <label class="f">문서 제목<input type="text" data-msf="${rid}.title" value="${esc(F.title||`${c.name||'캠페인'} · ${r.name||''} 광고 계약서`)}"></label>
   ${roles.map((ro,i)=>{const P=Object.assign(defP(i),(F.p||{})[i]||{});return `<div class="ms-p"><div class="small bold">서명자 ${i+1} · ${esc(ro.role)}</div><div class="fgrid"><label class="f">이름<input type="text" data-msf="${rid}.p.${i}.name" value="${esc(P.name)}"></label>
     <label class="f">받는 방법<select data-msf="${rid}.p.${i}.type">${[['EMAIL','이메일'],['KAKAO','카카오톡 (휴대폰)'],['SECURE_LINK','보안 링크 (직접 전달)']].map(([k,l])=>`<option value="${k}" ${P.type===k?'selected':''}>${l}</option>`).join('')}</select></label>
     ${P.type==='SECURE_LINK'?'':`<label class="f">${P.type==='KAKAO'?'휴대폰 번호':'이메일'}<input type="text" data-msf="${rid}.p.${i}.value" value="${esc(P.value)}" placeholder="${P.type==='KAKAO'?'010-0000-0000':'name@example.com'}"></label>`}</div></div>`}).join('')}
   ${(t.inputs||[]).length?`<div class="small bold">요청자 입력란 (계약서에 미리 채워 넣는 값)</div><div class="fgrid">${t.inputs.map(lb=>`<label class="f">${esc(lb)}<input type="text" data-msf="${rid}.in.${esc(lb)}" value="${esc(((F.in||{})[lb])??msAutoVal(c,r,lb))}"></label>`).join('')}</div>`:''}
   <div class="row" style="gap:8px"><button class="btn primary" data-act="msSend" data-r="${rid}" ${A.ms.busy||!left?'disabled':''}>${A.ms.busy?'보내는 중…':A.confirm==='msSend'+rid?`정말 보낼까요? API 서명 1건이 사용됩니다 (남은 ${left}건)`:'서명 요청 보내기'}</button><span class="small muted">${left?'보내면 모두싸인이 서명자에게 알림을 보내고, 이 행은 「서명 대기」가 됩니다.':'테스트 제공량을 모두 썼습니다. 모두싸인 담당자에게 추가 제공을 요청해 주세요.'}</span></div>`
   :'<div class="small" style="color:var(--crit,#d33)">모두싸인에 템플릿이 없습니다. 모두싸인에서 계약서 템플릿을 만든 뒤 연동 관리에서 「다시 확인」을 눌러 주세요.</div>'}</section>`}

Object.assign(ACT,{
  msRecheck(){msLoad(true)},
  async msSave(){if(!isMaster()||A.ms.saving)return;const email=String(($('#ms-email')||{}).value||'').trim(),key=String(($('#ms-key')||{}).value||'').trim(),limit=+(($('#ms-limit')||{}).value||30)||30,until=String(($('#ms-until')||{}).value||'');
    if(!email||!key)return toast('모두싸인 계정 이메일과 API Key를 넣어 주세요.','crit');A.ms.saving=true;render();
    try{if(DB.mode==='demo'){await new Promise(r=>setTimeout(r,400));A.msDemo={email,at:new Date().toISOString()}}else await aiFetch('/api/modusign',{action:'save',email,key,limit,until});
      const el=$('#ms-key');if(el)el.value='';toast('모두싸인 API를 연결했습니다.')}
    catch(e){toast('연결하지 못했습니다: '+e.message,'crit')}finally{A.ms.saving=false;await msLoad(true)}},
  async msClear(){if(!isMaster())return;if(A.confirm!=='msClear'){A.confirm='msClear';render();return}A.confirm=null;try{if(DB.mode==='demo')A.msDemo=null;else await aiFetch('/api/modusign',{action:'clear'});toast('저장한 모두싸인 키를 삭제했습니다.')}catch(e){toast('삭제하지 못했습니다: '+e.message,'crit')}await msLoad(true)},
  msSyncBtn(){msSync(true)},
  async msRemind(a){const r=((A.rowsDoc||{}).rows||{})[a.dataset.r];if(!r||!r.ctApi)return;try{if(DB.mode!=='demo')await aiFetch('/api/modusign',{action:'remind',id:r.ctApi.docId});toast('서명 알림을 다시 보냈습니다.')}catch(e){toast('알림을 보내지 못했습니다: '+e.message,'crit')}},
  async msReset(a){const rid=a.dataset.r;const r=((A.rowsDoc||{}).rows||{})[rid];if(!r)return;await DB.update('rows/'+A.cid,{[`rows.${rid}.ctApiPrev`]:r.ctApi||null,[`rows.${rid}.ctApi`]:DB.DEL});render()},
  async msSend(a){const rid=a.dataset.r;const c=curC();const r=((A.rowsDoc||{}).rows||{})[rid];if(!c||!r||A.ms.busy)return;if(!msLeft())return toast('API 서명 제공량을 모두 썼습니다.','crit');
    const ae=document.activeElement;if(ae&&ae.blur)ae.blur();
    const tp=A.msSt.templates||[];const F=A.ms.form[rid]||{};const tid=F.tid&&tp.find(t=>t.id===F.tid)?F.tid:(tp[0]||{}).id;const t=tp.find(x=>x.id===tid);if(!t)return toast('템플릿을 골라 주세요.','crit');
    const roles=t.roles&&t.roles.length?t.roles:[{role:'서명자'}];
    const ps=roles.map((ro,i)=>{const d=i===0?{name:r.realname||r.name||'',type:r.email?'EMAIL':r.contact?'KAKAO':'EMAIL',value:r.email||r.contact||''}:{name:'',type:'EMAIL',value:''};const P=Object.assign(d,(F.p||{})[i]||{});return {role:ro.role,name:String(P.name||'').trim(),type:P.type,value:String(P.value||'').trim()}});
    const bad=ps.find(p=>!p.name||(p.type!=='SECURE_LINK'&&!p.value));if(bad)return toast(`서명자 「${bad.role}」의 이름과 ${bad.type==='KAKAO'?'휴대폰 번호':'이메일'}를 채워 주세요.`,'crit');
    if(ps.some(p=>p.type==='EMAIL'&&!isEmail(p.value)))return toast('이메일 형식을 확인해 주세요.','crit');
    if(A.confirm!=='msSend'+rid){A.confirm='msSend'+rid;render();return}A.confirm=null;
    const inputs=(t.inputs||[]).map(lb=>({dataLabel:lb,value:((F.in||{})[lb])??msAutoVal(c,r,lb)}));const title=String(F.title||`${c.name||'캠페인'} · ${r.name||''} 광고 계약서`).trim();
    A.ms.busy=true;render();
    try{let doc;if(DB.mode==='demo'){await new Promise(x=>setTimeout(x,600));doc={id:'demo'+uid(),status:'ON_GOING'}}else doc=(await aiFetch('/api/modusign',{action:'send',templateId:t.id,title,participants:ps,inputs,meta:{cid:A.cid,rid}})).doc;
      const now=new Date().toISOString();const b=`rows.${rid}.`;
      await DB.update('rows/'+A.cid,{[b+'ctApi']:{docId:doc.id,status:doc.status||'ON_GOING',at:now,by:A.user.email,tpl:t.id,tplTitle:t.title,title,total:ps.length,signed:0},[b+'ctStep']:'서명 대기',[b+'ctLink']:MS_DOC(doc.id),[b+'ctLog']:[...(Array.isArray(r.ctLog)?r.ctLog:[]),{at:now,step:'서명 대기 (API 요청)',by:A.user.email}].slice(-20)});
      scheduleSync(A.cid);delete A.ms.form[rid];toast(`모두싸인으로 서명 요청을 보냈습니다 (${ps.map(p=>p.name).join(', ')}).`)}
    catch(e){toast('서명 요청을 보내지 못했습니다: '+e.message,'crit')}finally{A.ms.busy=false;render()}}
});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.msf)return;const [rid,...p]=t.dataset.msf.split('.');const F=A.ms.form[rid]||(A.ms.form[rid]={});
  if(p[0]==='in'){F.in=F.in||{};F.in[p.slice(1).join('.')]=t.value;return}if(p[0]==='p'){F.p=F.p||{};const i=+p[1];F.p[i]=F.p[i]||{};F.p[i][p[2]]=t.value;if(p[2]==='type')render();return}F[p[0]]=t.value;if(p[0]==='tid')render()});
