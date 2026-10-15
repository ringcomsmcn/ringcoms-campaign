/* RINGCOMS 캠페인 관리 · 캠페인 › 광고 그룹 › 광고 (v0.25)
   Meta 광고 관리자처럼 상단 탭 3개와 체크박스로 내려가며 봅니다.
   캠페인 탭에서 체크 → 광고 그룹 탭은 그 캠페인의 그룹만, 그룹 탭에서 체크 → 광고 탭은 그 그룹의 인플루언서·스트리머만.
   선택은 탭 머리의 「N개 선택됨 ×」로 바로 풀 수 있습니다. 지표는 캠페인 유형(시딩·체험단·공동구매·라이브·스트리머)에 맞춰 바뀝니다. */
A.gsel=A.gsel||new Set();
const HI_IC={camps:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M2 6h12"/></svg>',
  groups:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg>',
  ads:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="5.5" r="2.6"/><path d="M3 14c.8-2.6 2.7-4 5-4s4.2 1.4 5 4"/></svg>'};
const hiAdLabel=kind=>kind==='stream'?'스트리머':kind==='trial'?'체험단':'인플루언서';
/* 그룹 선택 중 지금 종류 · 존재하는 것만 */
function hiGsel(all){const ok=new Set(all.map(([id])=>id));[...A.gsel].forEach(k=>{if(!ok.has(k.split(':')[0]))A.gsel.delete(k)});return A.gsel}
function hierTabs(all,kind){hiCss();hiGsel(all);const t=A.ltab==='groups'?'groups':A.ltab==='ads'?'ads':'camps';
  const chip=(n,act)=>n?`<span class="hi-sel">${n}개 선택됨<i data-act="${act}" title="선택 해제" role="button" aria-label="선택 해제">×</i></span>`:'';
  const b=(k,l,sel,act)=>`<button role="tab" class="${t===k?'on':''}" data-act="ltab" data-k="${k}">${HI_IC[k]}<span>${l}</span>${chip(sel,act)}</button>`;
  const gsub=A.gsel.size?`선택한 그룹 ${A.gsel.size}개`:A.csel.size?`선택한 캠페인 ${A.csel.size}개`:'전체 캠페인';
  return `<div class="hi-tabs" role="tablist">${b('camps','캠페인',A.csel.size,'cselClear')}${b('groups',A.csel.size?`광고 그룹 · 캠페인 ${A.csel.size}개`:'광고 그룹',A.gsel.size,'gselClear')}${b('ads',`${hiAdLabel(kind)}${t==='ads'?'':''}`,0,'')}</div>
   <div class="hi-path small muted">${t==='camps'?'캠페인을 체크하면 광고 그룹 · '+hiAdLabel(kind)+' 탭이 선택한 캠페인으로 좁혀집니다':t==='groups'?`${A.csel.size?'선택한 캠페인 '+A.csel.size+'개':'모든 캠페인'}의 광고 그룹 · 그룹을 체크하면 ${hiAdLabel(kind)} 탭이 그 그룹으로 좁혀집니다`:`${gsub}의 ${hiAdLabel(kind)}`}</div>`}
function hiScope(all){return A.csel.size?all.filter(([id])=>A.csel.has(id)):all}
/* 유형별 지표 정의: [라벨, (s 또는 r 요약)=>값 html, 정렬값] */
function hiMetrics(kind){const T=kind==='trial',COM=kind==='gb'||kind==='live',ST=kind==='stream';
  if(ST)return [['광고 방송',s=>fmt(s.airN||0)],['누적 시청',s=>compact(s.views||0)],['최고 시청자',s=>s.peak?fmt(s.peak):'–'],['소프트콘',s=>fmt(s.soft||0)],['광고비',s=>fmt(s.cost||0)],['CPV',s=>fmt1(s.cpv)]];
  if(COM)return [['판매 수량',s=>fmt(s.qty||0)],['매출',s=>compact(s.rev||0)],['광고비',s=>fmt(s.cost||0)],['ROAS',s=>s.roas!=null?pct(s.roas,0):'–'],['조회수',s=>compact(s.views||0)]];
  if(T)return [['업로드',s=>`${s.uploaded||0}/${s.n||0}`],['조회수',s=>compact(s.views||0)],['ER',s=>pct(s.er)]];
  return [['업로드',s=>`${s.uploaded||0}/${s.n||0}`],['광고비',s=>fmt(s.cost||0)],['조회수',s=>compact(s.views||0)],['ER',s=>pct(s.er)],['CPV',s=>fmt1(s.cpv)]]}
function hiSumExtra(c,rows,s){if(!s)return s;const live=rows.filter(r=>r.name&&!isOut(r.stage));if(isCom(c)){s.qty=live.reduce((t,r)=>t+n(r.conv||r.qty),0);s.rev=live.reduce((t,r)=>t+n(r.rev),0);s.roas=s.cost&&s.rev?s.rev/s.cost:null}if(isStream(c)){s.peak=Math.max(0,...live.map(r=>n(r.peak)))||null}return s}

/* ===== 광고 그룹 탭 ===== */
function viewHierGroups(all,kind){const picked=hiScope(all);loadListRows(picked.map(([id])=>id));const loading=picked.some(([id])=>!A.listRows[id]);const M=hiMetrics(kind);
  const G=[];let noGroup=0;
  picked.forEach(([cid,c])=>{const rows=A.listRows[cid];const gs=groupsOf(c);const none=(rows||[]).filter(r=>r.name&&!(r.group&&c.groups&&c.groups[r.group]));if(!gs.length&&!none.length){noGroup++;return}
    gs.forEach(g=>{const rs=(rows||[]).filter(r=>r.group===g.id);G.push({cid,c,g,rs,s:rows?hiSumExtra(c,rs,summaryOf(c,rs)):null})});
    if(none.length)G.push({cid,c,g:{id:'__none',name:gs.length?'그룹 미지정':'기본 그룹'},rs:none,s:hiSumExtra(c,none,summaryOf(c,none))})});
  const cnt={};['시작 전','진행 중','완료'].forEach(k=>cnt[k]=G.filter(x=>x.s&&x.s.status===k).length);
  const gf=A.gstatF||'';const L=G.filter(x=>!gf||(x.s&&x.s.status===gf));const allOn=L.length&&L.every(x=>A.gsel.has(x.cid+':'+x.g.id));
  return `<div class="row" style="margin-bottom:12px"><div class="chips">${[['','전체',G.length],...['시작 전','진행 중','완료'].map(k=>[k,k,cnt[k]])].map(([k,l,c])=>`<span class="chip ${gf===k?'on':''}" data-act="gstatF" data-k="${k}">${l} <em>${c}</em></span>`).join('')}</div><span class="grow"></span>${A.gsel.size?`<button class="btn sm primary" data-act="ltab" data-k="ads">선택한 그룹의 ${hiAdLabel(kind)} 보기 →</button>`:''}<button class="btn sm" data-act="lrefresh">새로고침</button></div>
  ${loading&&!G.length?'<div class="panel empty">광고 그룹을 불러오는 중…</div>':L.length?`<div class="tblwrap"><table class="tbl hi-tbl"><thead><tr><th style="width:34px"><input type="checkbox" data-act="gselAll" aria-label="전체 선택" ${allOn?'checked':''}></th><th>광고 그룹</th><th>캠페인</th><th>상태</th><th>기간</th><th style="min-width:150px">진행 단계</th><th class="n">${hiAdLabel(kind)}</th>${M.map(m=>`<th class="n">${m[0]}</th>`).join('')}<th class="n">확인</th></tr></thead><tbody>
   ${L.map(({cid,c,g,s})=>{const real=g.id!=='__none';const key=cid+':'+g.id;return `<tr class="click ${A.gsel.has(key)?'sel':''}" data-act="gsel" data-k="${esc(key)}"><td><input type="checkbox" data-act="gsel" data-k="${esc(key)}" aria-label="선택" ${A.gsel.has(key)?'checked':''}></td>
    <td class="nm">${real&&isEditing('g',cid,g.id)?nameEdit('g',cid,g.id,g.name||''):`<b>${real?nameEdit('g',cid,g.id,g.name||'',esc(g.name)):esc(g.name)}</b>`}<span><a href="#" data-act="openGroup" data-id="${cid}" data-g="${g.id}">관리 화면 열기 ↗</a></span></td>
    <td class="small">${esc(c.name||'')}</td><td>${s?`<span class="pill ${STATUS_CLS[s.status]||''}">${s.status}</span>`:'<span class="muted small">…</span>'}</td><td class="small" style="white-space:nowrap">${g.start?md(g.start)+' ~ '+md(g.end):c.start?md(c.start)+' ~ '+md(c.end):'–'}</td>
    <td>${s?stageBar(s.stages,s.n,false):''}</td><td class="n"><a href="#" data-act="hiGoAds" data-k="${esc(key)}">${s?fmt(s.n):''}</a></td>${M.map(m=>`<td class="n">${s?m[1](s):''}</td>`).join('')}<td class="n">${s?(s.alerts?`<span class="pill crit">${s.alerts}</span>`:'<span class="muted">0</span>'):''}</td></tr>`}).join('')}</tbody></table></div>`
  :`<div class="panel empty">${G.length?'조건에 맞는 그룹이 없습니다.':'표시할 광고 그룹이 없습니다. 캠페인 개요에서 1차/2차, 8월/9월처럼 그룹을 추가할 수 있습니다.'}</div>`}
  ${noGroup?`<p class="small muted">인플루언서가 없는 캠페인 ${noGroup}개는 이 목록에 나오지 않습니다.</p>`:''}`}

/* ===== 광고 탭 (인플루언서 · 스트리머) ===== */
function hiAdCols(kind){const ST=kind==='stream',COM=kind==='gb'||kind==='live',T=kind==='trial';
  if(ST)return [['플랫폼',r=>esc(r.ch||'')],['팔로워',r=>has(r.fol)?compact(r.fol):'–',r=>n(r.fol)],['출연료',(r,k)=>k.cost!=null?fmt(k.cost):'–',(r,k)=>n(k.cost)],['광고 방송',r=>fmt(n(r.airN)),r=>n(r.airN)],['누적 시청',r=>has(r.views)?compact(r.views):'–',r=>n(r.views)],['최고 시청자',r=>has(r.peak)?fmt(r.peak):'–',r=>n(r.peak)],['평균 시청자',r=>has(r.avgV)?fmt(r.avgV):'–',r=>n(r.avgV)],['소프트콘',r=>has(r.soft)?fmt(r.soft):'–',r=>n(r.soft)],['CPV',(r,k)=>fmt1(k.cpv),(r,k)=>n(k.cpv)]];
  if(COM)return [['채널',r=>esc(r.ch||'')],['팔로워',r=>has(r.fol)?compact(r.fol):'–',r=>n(r.fol)],['광고비',(r,k)=>k.cost!=null?fmt(k.cost):'–',(r,k)=>n(k.cost)],['조회수',r=>has(r.views)?compact(r.views):'–',r=>n(r.views)],['판매 수량',r=>has(r.conv)?fmt(r.conv):has(r.qty)?fmt(r.qty):'–',r=>n(r.conv||r.qty)],['매출',r=>has(r.rev)?compact(r.rev):'–',r=>n(r.rev)],['ROAS',(r,k)=>k.roas!=null?pct(k.roas,0):'–',(r,k)=>n(k.roas)]];
  return [['채널',r=>esc(r.ch||'')],['팔로워',r=>has(r.fol)?compact(r.fol):'–',r=>n(r.fol)],...(T?[]:[['광고비',(r,k)=>k.cost!=null?fmt(k.cost):'–',(r,k)=>n(k.cost)]]),['조회수',r=>has(r.views)?compact(r.views):'–',r=>n(r.views)],['좋아요',r=>has(r.likes)?fmt(r.likes):'–',r=>n(r.likes)],['댓글',r=>has(r.cmts)?fmt(r.cmts):'–',r=>n(r.cmts)],['ER',(r,k)=>pct(k.er),(r,k)=>n(k.er)],...(T?[]:[['CPV',(r,k)=>fmt1(k.cpv),(r,k)=>n(k.cpv)]])]}
function viewHierAds(all,kind){const picked=hiScope(all).filter(([id])=>!A.gsel.size||[...A.gsel].some(k=>k.split(':')[0]===id));loadListRows(picked.map(([id])=>id));const loading=picked.some(([id])=>!A.listRows[id]);
  const q=(A.hq||'').trim().toLowerCase();const C=hiAdCols(kind);const L=[];
  picked.forEach(([cid,c])=>{(A.listRows[cid]||[]).forEach(r=>{if(!r.name)return;const gid=r.group&&c.groups&&c.groups[r.group]?r.group:'__none';if(A.gsel.size&&!A.gsel.has(cid+':'+gid))return;if(q&&![r.name,r.acct,r.ch].join(' ').toLowerCase().includes(q))return;L.push({cid,c,r,gid,k:rowCalc(r,c)})})});
  const so=A.hsort||{};if(so.i!=null&&C[so.i]&&C[so.i][2])L.sort((a,b)=>(C[so.i][2](b.r,b.k)-C[so.i][2](a.r,a.k))*(so.d?-1:1));
  const lim=A.hlim||200;const V=L.slice(0,lim);const out=L.filter(x=>isOut(x.r.stage)).length;
  return `<div class="row" style="margin-bottom:12px;gap:8px"><input type="search" data-ui="hq" value="${esc(A.hq||'')}" placeholder="${hiAdLabel(kind)}명 · 계정 검색" style="max-width:240px"><span class="small muted">${fmt(L.length)}명${out?` (제외·드롭 ${out}명 포함)`:''} · 열 제목을 누르면 정렬</span><span class="grow"></span><button class="btn sm" data-act="lrefresh">새로고침</button></div>
  ${loading&&!L.length?'<div class="panel empty">불러오는 중…</div>':L.length?`<div class="tblwrap"><table class="tbl hi-tbl"><thead><tr><th>${hiAdLabel(kind)}</th><th>캠페인 · 그룹</th><th>단계</th>${C.map((x,i)=>`<th class="n ${x[2]?'hi-sort':''}" ${x[2]?`data-act="hiSort" data-i="${i}"`:''}>${x[0]}${so.i===i?(so.d?' ▲':' ▼'):''}</th>`).join('')}<th class="n">확인</th></tr></thead><tbody>
   ${V.map(({cid,c,r,gid,k})=>{const al=alertOf(r,c);return `<tr class="click ${isOut(r.stage)?'hi-out':''}" data-act="hiOpenRow" data-id="${cid}" data-r="${r.id}"><td class="nm"><b>${esc(r.name)}</b><span>${esc(r.acct||'')}</span></td><td class="nm"><b class="small">${esc(c.name||'')}</b><span>${gid==='__none'?'그룹 미지정':esc((c.groups[gid]||{}).name||'')}</span></td><td><span class="pill">${esc(r.stage||'')}</span></td>${C.map(x=>`<td class="n">${x[1](r,k)}</td>`).join('')}<td class="n">${al?`<span class="pill crit" title="${esc(al)}">!</span>`:''}</td></tr>`}).join('')}</tbody></table></div>${L.length>lim?`<div style="text-align:center;margin-top:10px"><button class="btn sm" data-act="hiMore">${fmt(L.length-lim)}명 더 보기</button></div>`:''}`
  :`<div class="panel empty">${hiAdLabel(kind)}가 없습니다.</div>`}`}

Object.assign(ACT,{
  gsel(a){const k=a.dataset.k;A.gsel.has(k)?A.gsel.delete(k):A.gsel.add(k);render()},
  gselAll(){const kind=listKind();const all=Object.entries(A.campaigns).filter(([,c])=>kindOf(c)===kind&&inAcctScope(c));const picked=hiScope(all);const keys=[];picked.forEach(([cid,c])=>{groupsOf(c).forEach(g=>keys.push(cid+':'+g.id));if((A.listRows[cid]||[]).some(r=>r.name&&!(r.group&&c.groups&&c.groups[r.group])))keys.push(cid+':__none')});const on=keys.length&&keys.every(k=>A.gsel.has(k));keys.forEach(k=>on?A.gsel.delete(k):A.gsel.add(k));render()},
  gselClear(){A.gsel.clear();render()},
  hiGoAds(a){A.gsel=new Set([a.dataset.k]);A.ltab='ads';render();window.scrollTo(0,0)},
  hiSort(a){const i=+a.dataset.i;const s=A.hsort||{};A.hsort=s.i===i?{i,d:!s.d}:{i,d:false};render()},
  hiMore(){A.hlim=(A.hlim||200)+200;render()},
  hiOpenRow(a){const cid=a.dataset.id,rid=a.dataset.r;openCampaign(cid,'grid');const t=setInterval(()=>{if(A.rowsDoc&&A.cid===cid){clearInterval(t);A.drawer={type:'row',rid};render()}},120);setTimeout(()=>clearInterval(t),6000)}
});
/* 캠페인 탭의 「N개 캠페인 선택」 바 대신 탭 머리 칩을 씁니다 → 그룹 선택 해제도 같이 */
(function(){const prev=ACT.cselClear;ACT.cselClear=function(){A.gsel.clear();return prev.apply(this,arguments)}})();
function hiCss(){if(hiCss.done)return;hiCss.done=1;document.head.insertAdjacentHTML('beforeend',`<style id="hi-css">
.hi-tabs{display:flex;gap:2px;border:1px solid var(--line);border-radius:12px 12px 0 0;background:var(--surface);padding:0 6px;overflow-x:auto;scrollbar-width:none}
.hi-tabs button{display:flex;align-items:center;gap:8px;background:none;border:0;border-bottom:3px solid transparent;padding:12px 16px 10px;font:inherit;font-weight:600;color:var(--muted);cursor:pointer;white-space:nowrap;flex:none}
.hi-tabs button svg{width:16px;height:16px;flex:none}.hi-tabs button.on{color:var(--accent);border-bottom-color:var(--accent)}.hi-tabs button:hover{color:var(--ink)}
.hi-sel{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:#fff;font-size:12px;font-weight:600;padding:2px 4px 2px 10px;border-radius:999px}
.hi-sel i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.25);cursor:pointer;font-size:13px;line-height:1}.hi-sel i:hover{background:rgba(255,255,255,.45)}
.hi-path{border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px;padding:8px 14px;margin-bottom:14px;background:var(--surface2)}
.hi-tbl tr.sel td{background:var(--accent-soft)}.hi-tbl tr.hi-out td{opacity:.5}.hi-sort{cursor:pointer;user-select:none}.hi-sort:hover{color:var(--accent)}
@media(max-width:760px){.hi-tabs button{padding:10px 10px 8px;gap:6px}.hi-path{font-size:12px}}
</style>`)}
