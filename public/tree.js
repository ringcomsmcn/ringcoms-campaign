/* RINGCOMS 캠페인 관리 · 계층 트리 (v0.24)
   광고주 계정 › 캠페인 › 광고 그룹 — Meta·Google·네이버·카카오 광고관리자처럼 한 화면에서 펼쳐 보고 이동
   - 캠페인 화면 왼쪽: 같은 유형 캠페인 트리 (PC 넓은 화면) · 그룹 클릭 = 그 그룹만 보기 · 끌어서 그룹 순서 변경 · 새 그룹 바로 추가
   - 캠페인 목록: 「계층 보기」 탭 — 계정·캠페인·그룹별 인원·업로드·광고비·조회를 펼쳐 보기 · 그룹 순서 끌어서 변경
   - 광고 그룹 설정 표: 손잡이(⋮⋮)를 끌거나 ↑↓로 순서 변경 */
A.tree=A.tree||{open:new Set(),q:'',off:(()=>{try{return localStorage.getItem('tree_off')==='1'}catch(e){return false}})(),closedA:new Set()};
const TR_ST={'진행 중':'ok','시작 전':'warn','완료':'','보류':'warn','종료':''};
function trAcctName(a){return a===TEAM?'RINGCOMS MCN':(typeof acctName==='function'?acctName(a):a)}
function trCamps(kind){const L=Object.entries(A.campaigns||{}).filter(([,c])=>kindOf(c)===kind&&inAcctScope(c));const rk={'진행 중':0,'시작 전':1,'보류':2,'완료':3,'종료':4};
  return L.sort((a,b)=>(rk[campStatus(a[1])]??5)-(rk[campStatus(b[1])]??5)||String(b[1].createdAt||'').localeCompare(String(a[1].createdAt||'')))}
function trByAcct(list){const m=new Map();list.forEach(([id,c])=>{const a=acctOf(c)||TEAM;if(!m.has(a))m.set(a,[]);m.get(a).push([id,c])});return [...m.entries()].sort((x,y)=>(x[0]===TEAM?-1:y[0]===TEAM?1:trAcctName(x[0]).localeCompare(trAcctName(y[0]),'ko')))}
/* 그룹 행 집계 (캠페인 행 데이터가 있을 때) */
function trGroupStat(c,rows,gid){const L=(rows||[]).filter(r=>r.name&&!isOut(r.stage)&&(gid==='__none'?!(r.group&&c.groups&&c.groups[r.group]):r.group===gid));
  return {n:L.length,up:L.filter(r=>isCom(c)?!!r.clink:normStage(r.stage)===DONE).length,views:L.reduce((t,r)=>t+n(r.views),0),cost:L.reduce((t,r)=>t+n(rowCalc(r,c).cost),0),rev:L.reduce((t,r)=>t+n(r.rev),0)}}
const trRowsOf=cid=>cid===A.cid&&A.rowsDoc?curRows():(A.listRows||{})[cid];

/* ---- 캠페인 화면 왼쪽 트리 ---- */
function withTree(html){const c=curC();if(!c||!isTeam())return html;trCss();
  if(A.tree.off)return `<div class="tr-wrap"><button class="btn sm ghost tr-opener" data-act="treeTog" title="캠페인 트리 열기">☰ 캠페인 트리</button>${html}</div>`;
  return `<div class="tr-split"><aside class="tr-side" aria-label="캠페인 트리">${campTree(c)}</aside><div class="tr-main">${html}</div></div>`}
function campTree(cur){const kind=kindOf(cur);const KM=KINDS[kind];const q=(A.tree.q||'').trim().toLowerCase();const ed=canEdit();
  if(!A.tree.open.has('c:'+A.cid)){A.tree.open.add('c:'+A.cid)}
  const list=trCamps(kind).filter(([id,c])=>!q||id===A.cid||[c.name,c.advertiser,c.brand,...groupsOf(c).map(g=>g.name)].join(' ').toLowerCase().includes(q));
  const accts=trByAcct(list);const open=k=>A.tree.open.has(k);
  const need=list.filter(([id])=>open('c:'+id)&&id!==A.cid).map(([id])=>id);if(need.length&&typeof loadListRows==='function')loadListRows(need);
  const camp=([id,c])=>{const on=id===A.cid;const gs=groupsOf(c);const st=campStatus(c);const rows=trRowsOf(id);const o=open('c:'+id);
    const none=rows?trGroupStat(c,rows,'__none').n:0;
    return `<div class="tr-c ${on?'on':''}"><button class="tr-tw" data-act="trTog" data-k="c:${id}" aria-label="${o?'접기':'펼치기'}" ${gs.length||on?'':'disabled'}>${gs.length||on?(o?'▾':'▸'):'·'}</button><button class="tr-n" data-act="trCamp" data-c="${id}" title="${esc(c.name||'')}"><i class="tr-dot ${TR_ST[st]||''}" title="${esc(st)}"></i><span>${esc(c.name||'이름 없음')}</span></button><em>${fmt((c.summary||{}).n||0)}</em></div>
     ${o&&(gs.length||on)?`<div class="tr-gs" data-gzone="${id}">${on?`<div class="tr-g all ${!A.gf?'on':''}"><button class="tr-n" data-act="trGroup" data-c="${id}" data-g="">전체</button><em>${rows?fmt(rows.filter(r=>r.name&&!isOut(r.stage)).length):''}</em></div>`:''}
       ${gs.map(g=>`<div class="tr-g ${on&&A.gf===g.id?'on':''}" data-gdrag="${g.id}" data-gc="${id}" ${ed?'draggable="true"':''}><span class="tr-hd" title="끌어서 순서 바꾸기">${ed?'⋮⋮':''}</span><button class="tr-n" data-act="trGroup" data-c="${id}" data-g="${g.id}" title="${esc(g.name||'')}${g.start?' · '+g.start+' ~ '+(g.end||''):''}"><span>${esc(g.name||'그룹')}</span></button><em>${rows?fmt(trGroupStat(c,rows,g.id).n):''}</em></div>`).join('')}
       ${on&&gs.length&&none?`<div class="tr-g ${A.gf==='__none'?'on':''}"><span class="tr-hd"></span><button class="tr-n muted" data-act="trGroup" data-c="${id}" data-g="__none">그룹 미지정</button><em>${fmt(none)}</em></div>`:''}
       ${on&&ed?`<div class="tr-add"><input type="text" id="tr-newg" placeholder="+ 새 광고 그룹" aria-label="새 광고 그룹 이름"><button class="btn sm" data-act="trAddGroup">추가</button></div>`:''}</div>`:''}`};
  return `<div class="tr-h"><b>${esc(KM.label)}</b><span class="grow"></span><button class="btn sm ghost" data-act="trAll" title="모두 펼치기/접기">${list.some(([id])=>open('c:'+id)&&id!==A.cid)?'접기':'펼치기'}</button><button class="btn sm ghost" data-act="treeTog" title="트리 닫기">«</button></div>
   <input type="search" class="tr-q" data-trq="1" value="${esc(A.tree.q||'')}" placeholder="캠페인 · 그룹 검색">
   <div class="tr-body">${accts.map(([a,L])=>{const ko='a:'+a;const closed=A.tree.closedA.has(a);return `<div class="tr-a"><button class="tr-ah" data-act="trAcct" data-a="${esc(a)}"><span>${closed?'▸':'▾'}</span><b>${esc(trAcctName(a))}</b><em>${L.length}</em></button>${closed?'':L.map(camp).join('')}</div>`}).join('')||'<div class="small muted" style="padding:8px">캠페인이 없습니다.</div>'}</div>
   ${canCreate()?`<button class="btn sm tr-new" data-act="trNew" data-k="${kind}">+ 새 캠페인</button>`:''}
   <p class="small muted tr-tip">${ed?'그룹을 끌어서 순서를 바꿀 수 있어요.':''}</p>`}

/* ---- 캠페인 목록: 계층 보기 ---- */
function viewTreeList(all,kind){trCss();const q=(A.q||'').trim().toLowerCase();const COM=kind==='gb'||kind==='live';const ed=canEdit();
  const list=trCamps(kind).filter(([id,c])=>!q||[c.name,c.advertiser,c.brand,...groupsOf(c).map(g=>g.name)].join(' ').toLowerCase().includes(q));
  const accts=trByAcct(list);const open=k=>A.tree.open.has(k);
  const need=list.filter(([id])=>open('c:'+id)).map(([id])=>id);if(need.length&&typeof loadListRows==='function')loadListRows(need);
  const S=L=>L.reduce((t,[,c])=>{const s=c.summary||{};t.n+=n(s.n);t.up+=n(s.uploaded);t.cost+=n(s.cost);t.views+=n(s.views);t.rev+=n(s.rev);return t},{n:0,up:0,cost:0,views:0,rev:0});
  const metric=(o)=>`<td class="n">${fmt(o.n)}</td><td class="n">${fmt(o.up)}</td><td class="n">${o.cost?compact(o.cost):'–'}</td><td class="n">${COM?(o.rev?compact(o.rev):'–'):(o.views?compact(o.views):'–')}</td><td class="n">${COM?(o.cost&&o.rev?pct(o.rev/o.cost,0):'–'):(o.views&&o.cost?fmt1(o.cost/o.views):'–')}</td>`;
  const rowsHtml=accts.map(([a,L])=>{const t=S(L);const closed=A.tree.closedA.has(a);
    return `<tr class="tl-a"><td colspan="3"><button class="tl-tw" data-act="trAcct" data-a="${esc(a)}">${closed?'▸':'▾'}</button><b>${esc(trAcctName(a))}</b> <span class="small muted">광고주 계정 · 캠페인 ${L.length}개</span></td>${metric(t)}<td></td></tr>`+
      (closed?'':L.map(([id,c])=>{const s=c.summary||{};const gs=groupsOf(c);const o=open('c:'+id);const rows=trRowsOf(id);const st=campStatus(c);
        return `<tr class="tl-c"><td><span class="tl-ind"></span><button class="tl-tw" data-act="trTog" data-k="c:${id}" ${gs.length?'':'disabled'}>${gs.length?(o?'▾':'▸'):'·'}</button><a href="#" data-act="open" data-id="${id}"><b>${esc(c.name||'이름 없음')}</b></a>${gs.length?` <span class="small muted">그룹 ${gs.length}</span>`:''}</td><td><span class="pill ${STATUS_CLS[st]||''}">${esc(st)}</span></td><td class="small" style="white-space:nowrap">${c.start?md(c.start)+' ~ '+md(c.end):'–'}</td>${metric({n:n(s.n),up:n(s.uploaded),cost:n(s.cost),views:n(s.views),rev:n(s.rev)})}<td class="n"><button class="btn sm ghost" data-act="open" data-id="${id}">열기</button></td></tr>`+
          (o?(!rows?`<tr class="tl-g"><td colspan="9" class="small muted"><span class="tl-ind2"></span>그룹 데이터를 불러오는 중…</td></tr>`:gs.map(g=>{const gst=trGroupStat(c,rows,g.id);return `<tr class="tl-g" data-gdrag="${g.id}" data-gc="${id}"><td><span class="tl-ind2"></span><span class="tr-hd" ${ed?'draggable="true" data-ghandle="1"':''} title="끌어서 순서 바꾸기">${ed?'⋮⋮':''}</span><a href="#" data-act="trGroup" data-c="${id}" data-g="${g.id}">${esc(g.name||'그룹')}</a>${g.memo?` <span class="small muted">${esc(g.memo)}</span>`:''}</td><td class="small muted">광고 그룹</td><td class="small" style="white-space:nowrap">${g.start?md(g.start)+' ~ '+md(g.end||g.start):'–'}</td>${metric({...gst,up:gst.up})}<td class="n"><button class="btn sm ghost" data-act="trGroup" data-c="${id}" data-g="${g.id}">보기</button></td></tr>`}).join('')+(()=>{const nn=trGroupStat(c,rows,'__none');return nn.n?`<tr class="tl-g"><td><span class="tl-ind2"></span><span class="tr-hd"></span><a href="#" data-act="trGroup" data-c="${id}" data-g="__none" class="muted">그룹 미지정</a></td><td></td><td></td>${metric(nn)}<td></td></tr>`:''})()):'')}).join(''))}).join('');
  return `<div class="row" style="margin-bottom:12px;gap:8px"><input type="search" data-ui="q" value="${esc(A.q||'')}" placeholder="캠페인 · 광고주 · 그룹 검색" style="max-width:280px"><span class="grow"></span><button class="btn sm" data-act="trAllList">${list.some(([id])=>open('c:'+id))?'모두 접기':'모두 펼치기'}</button></div>
   <div class="tblwrap"><table class="tbl tl-tbl"><thead><tr><th style="min-width:320px">계정 › 캠페인 › 광고 그룹</th><th>상태</th><th>기간</th><th class="n">인원</th><th class="n">${COM?'판매·홍보':'업로드'}</th><th class="n">광고비</th><th class="n">${COM?'매출':'조회'}</th><th class="n">${COM?'ROAS':'CPV'}</th><th></th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="9" class="empty">캠페인이 없습니다.</td></tr>'}</tbody></table></div>
   <p class="small muted" style="margin:8px 0 0">캠페인을 펼치면 광고 그룹별 인원·성과가 나옵니다.${ed?' 그룹의 ⋮⋮ 손잡이를 끌어서 순서를 바꿀 수 있습니다.':''} 광고비는 VAT 별도.</p>`}

/* ---- 그룹 순서 바꾸기 (끌어 놓기 · ↑↓) ---- */
async function trReorder(cid,ids){const draft=A.view==='create';const c=draft?A.draft:A.campaigns[cid];if(!c||!canEdit())return;const up={};ids.forEach((g,i)=>{up[`groups.${g}.order`]=i+1});
  try{if(draft||cid===A.cid)await cUpdate(up);else await DB.update('campaigns/'+cid,up);if(!draft){ids.forEach((g,i)=>{if(c.groups&&c.groups[g])c.groups[g].order=i+1})}render();toast('광고 그룹 순서를 바꿨습니다.')}catch(e){saveErr(e)}}
let TRD=null;
document.addEventListener('dragstart',e=>{const el=e.target.closest&&e.target.closest('[data-gdrag]');if(!el||!canEdit())return;if(el.tagName==='TR'&&!(e.target.dataset&&e.target.dataset.ghandle))return;
  TRD={g:el.dataset.gdrag,c:el.dataset.gc};el.classList.add('tr-dragging');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',TRD.g)}catch(x){}});
document.addEventListener('dragover',e=>{if(!TRD)return;const el=e.target.closest&&e.target.closest('[data-gdrag]');document.querySelectorAll('.tr-over-t,.tr-over-b').forEach(x=>x.classList.remove('tr-over-t','tr-over-b'));if(!el||el.dataset.gc!==TRD.c||el.dataset.gdrag===TRD.g)return;
  e.preventDefault();const r=el.getBoundingClientRect();el.classList.add(e.clientY<r.top+r.height/2?'tr-over-t':'tr-over-b')});
document.addEventListener('drop',e=>{if(!TRD)return;const el=e.target.closest&&e.target.closest('[data-gdrag]');const d=TRD;TRD=null;document.querySelectorAll('.tr-over-t,.tr-over-b,.tr-dragging').forEach(x=>x.classList.remove('tr-over-t','tr-over-b','tr-dragging'));
  if(!el||el.dataset.gc!==d.c||el.dataset.gdrag===d.g)return;e.preventDefault();const r=el.getBoundingClientRect();const before=e.clientY<r.top+r.height/2;
  const c=A.view==='create'?A.draft:A.campaigns[d.c];const ids=groupsOf(c).map(g=>g.id).filter(x=>x!==d.g);let i=ids.indexOf(el.dataset.gdrag);if(i<0)return;if(!before)i++;ids.splice(i,0,d.g);trReorder(d.c,ids)});
document.addEventListener('dragend',()=>{TRD=null;document.querySelectorAll('.tr-over-t,.tr-over-b,.tr-dragging').forEach(x=>x.classList.remove('tr-over-t','tr-over-b','tr-dragging'))});
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||!t.dataset.trq)return;A.tree.q=t.value;clearTimeout(document.trq);document.trq=setTimeout(()=>{const pos=t.selectionStart;render();const el=document.querySelector('[data-trq]');if(el){el.focus();try{el.setSelectionRange(pos,pos)}catch(x){}}},250)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='tr-newg'){e.preventDefault();ACT.trAddGroup()}});

Object.assign(ACT,{
  trNew(a){startDraft(newCampaignData(a.dataset.k||kindOf(curC())))},
  treeTog(){A.tree.off=!A.tree.off;try{localStorage.setItem('tree_off',A.tree.off?'1':'0')}catch(e){}render()},
  trTog(a){const k=a.dataset.k;A.tree.open.has(k)?A.tree.open.delete(k):A.tree.open.add(k);render()},
  trAcct(a){const k=a.dataset.a;A.tree.closedA.has(k)?A.tree.closedA.delete(k):A.tree.closedA.add(k);render()},
  trAll(){const c=curC();const L=trCamps(kindOf(c)).map(([id])=>'c:'+id).filter(k=>k!=='c:'+A.cid);const any=L.some(k=>A.tree.open.has(k));L.forEach(k=>any?A.tree.open.delete(k):A.tree.open.add(k));render()},
  trAllList(){const L=trCamps(listKind()).map(([id])=>'c:'+id);const any=L.some(k=>A.tree.open.has(k));L.forEach(k=>any?A.tree.open.delete(k):A.tree.open.add(k));render()},
  trCamp(a){const cid=a.dataset.c;if(cid===A.cid){A.gf='';render();return}openCampaign(cid,['grid','status','report','overview','settings','track','share'].includes(A.tab)?A.tab:'overview')},
  trGroup(a,e){if(e&&e.preventDefault)e.preventDefault();const cid=a.dataset.c,g=a.dataset.g;if(cid!==A.cid||A.view!=='campaign'){openCampaign(cid,'grid');A.gf=g;render();return}
    A.gf=g;if(['settings','track','share'].includes(A.tab))A.tab='grid';render()},
  async trAddGroup(){const el=$('#tr-newg');const nm=el?el.value.trim():'';if(!nm)return toast('그룹 이름을 입력하세요.','crit');const c=curC();if(groupsOf(c).some(g=>g.name===nm))return toast('같은 이름의 그룹이 있습니다.','crit');
    const id='g'+uid().slice(0,8);const order=groupsOf(c).reduce((m,g)=>Math.max(m,g.order||0),0)+1;
    try{await cUpdate({[`groups.${id}`]:{name:nm,order,start:c.start||'',end:c.end||'',memo:''}});A.gf=id;toast(`「${nm}」 그룹을 만들었습니다.`);scheduleSync(A.cid)}catch(e){saveErr(e)}},
  grpMove(a){const c=curC();if(!c)return;const ids=groupsOf(c).map(g=>g.id);const i=ids.indexOf(a.dataset.g),j=i+(+a.dataset.d);if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];trReorder(A.view==='create'?'__draft':A.cid,ids)}
});

function trCss(){if(trCss.done)return;trCss.done=1;document.head.insertAdjacentHTML('beforeend',`<style id="tr-css">
.tr-split{display:grid;grid-template-columns:252px minmax(0,1fr);gap:18px;align-items:start}
.tr-main{min-width:0}
.tr-side{position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:10px 8px;display:flex;flex-direction:column;gap:6px}
.tr-h{display:flex;align-items:center;gap:4px;padding:0 4px}.tr-h b{font-size:13px}
.tr-q{width:100%;padding:6px 10px;font-size:12.5px}
.tr-body{display:flex;flex-direction:column;gap:2px}
.tr-a{display:flex;flex-direction:column;gap:1px;margin-top:4px}
.tr-ah{all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:11.5px;color:var(--muted);border-radius:6px}.tr-ah b{color:var(--ink2);font-weight:700;letter-spacing:.01em}.tr-ah em{margin-left:auto;font-style:normal}.tr-ah:hover{background:var(--surface2)}
.tr-c,.tr-g{display:flex;align-items:center;gap:2px;border-radius:7px;min-height:30px}
.tr-c:hover,.tr-g:hover{background:var(--surface2)}
.tr-c.on{background:var(--accent-soft)}.tr-c.on .tr-n{color:var(--accent);font-weight:700}
.tr-tw{all:unset;cursor:pointer;width:18px;text-align:center;color:var(--muted);font-size:11px;flex:none}.tr-tw:disabled{cursor:default}
.tr-n{all:unset;cursor:pointer;flex:1;min-width:0;display:flex;align-items:center;gap:6px;font-size:13px;padding:5px 2px}.tr-n span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tr-c em,.tr-g em{font-style:normal;font-size:11px;color:var(--muted);padding-right:6px}
.tr-dot{width:7px;height:7px;border-radius:50%;background:var(--line2,#c8ccd4);flex:none}.tr-dot.ok{background:#16a34a}.tr-dot.warn{background:#d97706}
.tr-gs{display:flex;flex-direction:column;gap:1px;margin-left:16px;padding-left:6px;border-left:1px solid var(--line)}
.tr-g .tr-n{font-size:12.5px}.tr-g.on{background:var(--accent-soft)}.tr-g.on .tr-n{color:var(--accent);font-weight:600}.tr-g.all .tr-n{padding-left:18px}
.tr-hd{width:16px;flex:none;text-align:center;color:var(--muted);font-size:11px;letter-spacing:-2px;cursor:grab;user-select:none}
.tr-g[draggable=true]{cursor:grab}.tr-dragging{opacity:.45}
.tr-over-t{box-shadow:inset 0 2px 0 var(--accent)}.tr-over-b{box-shadow:inset 0 -2px 0 var(--accent)}
.tr-add{display:flex;gap:4px;padding:4px 2px 2px 18px}.tr-add input{flex:1;min-width:0;padding:4px 8px;font-size:12px}
.tr-new{margin:6px 4px 0}.tr-tip{margin:2px 6px 0;font-size:11px}
.tr-wrap{position:relative}.tr-opener{margin-bottom:8px}
@media (max-width:1180px){.tr-split{display:block}.tr-side,.tr-opener{display:none}}
.tl-tbl tr.tl-a td{background:var(--surface2);font-size:13px}
.tl-tbl tr.tl-c td:first-child{white-space:nowrap}.tl-tbl tr.tl-g td{font-size:12.5px}
.tl-tw{all:unset;cursor:pointer;width:20px;display:inline-block;text-align:center;color:var(--muted)}.tl-tw:disabled{cursor:default}
.tl-ind{display:inline-block;width:14px}.tl-ind2{display:inline-block;width:40px}
.gtbl .gh{cursor:grab;color:var(--muted);user-select:none;width:26px;text-align:center}
</style>`)}
trCss();
