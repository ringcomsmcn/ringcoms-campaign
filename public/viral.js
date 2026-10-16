/* RINGCOMS 캠페인 관리 · 스트리머 바이럴 캠페인 (v0.28)
   광고 관리(스트리머) > 바이럴 캠페인 — 캠페인 유형 viral
   - 스트리머가 하이라이트·숏폼 영상을 만들어 유튜브 · 틱톡 · 인스타그램에 올리면, 시딩 캠페인처럼 콘텐츠별 조회·반응·비용·CPV를 트래킹
   - 진행 단계 · 그룹 · 콘텐츠 가이드 · 영상 검수 · 링크 트래킹 · 광고주 공유 리포트는 시딩 캠페인과 같은 기능을 그대로 사용
   - 패키지: 스트리머 광고(라이브 PPL·프로모션)와 바이럴 캠페인을 하나로 묶어(campaigns/{viral}.pkg = 스트리머 광고 캠페인 id)
     두 캠페인 개요에 「패키지」 패널 — 라이브 누적 시청 + 바이럴 조회, 합산 광고비, 패키지 CPV
   - 참여 스트리머는 인플루언서 풀이 아니라 스트리머 풀(캠페인 이력)에 쌓임 */
window.TOOL_IC=window.TOOL_IC||{};
window.TOOL_IC.viral='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/><path d="M3.5 8.5c-1 2-1 5 0 7M20.5 8.5c1 2 1 5 0 7"/></svg>';
window.TOOL_IC.demo='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M10 8.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>';
KINDS.viral={view:'viral',label:'바이럴 캠페인',eb:'Streamer Viral Campaigns',nw:'새 바이럴 캠페인',newEb:'New Viral Campaign',newH:'새 바이럴 캠페인 만들기',rep:'STREAMER VIRAL CAMPAIGN REPORT',pill:'스트리머 바이럴',
  desc:'스트리머가 만든 하이라이트·숏폼 영상을 유튜브 · 틱톡 · 인스타그램에 올리고 콘텐츠별 조회·반응·CPV를 트래킹합니다. 스트리머 광고(라이브)와 묶으면 패키지 성과를 함께 봅니다.'};
VIEW_KIND.viral='viral';
const isViral=c=>!!c&&c.kind==='viral';
{const _k=kindOf;kindOf=function(c){return c&&c.kind==='viral'?'viral':_k(c)}}
{const _n=newCampaignData;newCampaignData=function(kind){if(kind!=='viral')return _n(kind);const d=_n('seed');return {...d,kind:'viral',name:'새 바이럴 캠페인',ctype:'유가 광고',objective:'조회수',pkg:''}}}
/* 참여 스트리머는 스트리머 풀로 */
{const _sp=syncPool;syncPool=async function(cid,c,rows){if(isViral(c)){if(typeof spSyncCampaign==='function')await spSyncCampaign(cid,c,rows);return}return _sp(cid,c,rows)}}

/* ---- 패키지 (스트리머 광고 + 바이럴) ---- */
function pkgPartners(cid,c){if(isViral(c)){const s=c.pkg&&A.campaigns[c.pkg];return s?[[c.pkg,s]]:[]}
  if(isStream(c))return Object.entries(A.campaigns).filter(([,x])=>isViral(x)&&x.pkg===cid);return []}
function pkgStat(c){const s=c.summary||{};const views=n(s.views);const cpv=has(s.cpv)&&s.cpv!=null?n(s.cpv):(views?n(s.cost)/views:null);return {views,cost:n(s.cost),cpv,costV:cpv!=null?cpv*views:0,n:n(s.n),up:isStream(c)?n(s.airN||s.uploaded):n(s.uploaded)}}
function pkgPanel(c){if(!(isViral(c)||isStream(c)))return '';const cid=A.cid;const ps=pkgPartners(cid,c);const ed=canEdit();
  if(!ps.length){
    if(isStream(c))return `<section class="panel pkg-cta noprint"><div class="row" style="gap:12px;align-items:center"><div class="grow"><b>패키지로 묶기</b><div class="sub">라이브 PPL·프로모션과 함께, 스트리머가 하이라이트·숏폼 영상을 유튜브·틱톡·인스타그램에 올리는 바이럴 캠페인을 묶어 패키지 성과를 함께 봅니다.</div></div>${ed?`<button class="btn primary" data-act="pkgNewViral">+ 바이럴 캠페인 만들기</button>`:''}</div></section>`;
    const opts=Object.entries(A.campaigns).filter(([,x])=>isStream(x)&&inAcctScope(x)).sort((a,b)=>String(b[1].createdAt).localeCompare(String(a[1].createdAt)));
    return `<section class="panel pkg-cta noprint"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div class="grow"><b>스트리머 광고와 패키지로 묶기</b><div class="sub">같은 스트리머의 라이브 광고(PPL·프로모션)와 묶으면 라이브 + 바이럴 합산 성과를 봅니다.</div></div>${ed&&opts.length?`<select id="pkg-sel" style="max-width:280px"><option value="">스트리머 광고 선택</option>${opts.map(([id,x])=>`<option value="${id}">${esc(x.name||'')}</option>`).join('')}</select><button class="btn" data-act="pkgLink">묶기</button>`:opts.length?'':'<span class="small muted">묶을 스트리머 광고가 아직 없습니다.</span>'}</div></section>`}
  const self=[cid,c];const all=isStream(c)?[self,...ps]:[...ps,self];
  const T=all.reduce((t,[,x])=>{const s=pkgStat(x);t.views+=s.views;t.cost+=s.cost;t.costV+=s.costV;return t},{views:0,cost:0,costV:0});
  const card=([id,x])=>{const s=pkgStat(x);const me=id===cid;return `<div class="pkg-c ${me?'me':''}"><div class="row" style="gap:6px"><span class="pill ${isStream(x)?'accent':'ok'}">${isStream(x)?'라이브 · '+esc((x.st&&x.st.type)||x.objective||'PPL'):'바이럴 영상'}</span>${me?'<span class="pill">지금 캠페인</span>':''}</div>
    <b class="pkg-n">${esc(x.name||'')}</b><dl><div><dt>${isStream(x)?'누적 시청':'조회수'}</dt><dd>${compact(s.views)}</dd></div><div><dt>${isStream(x)?'광고 방송':'업로드'}</dt><dd>${fmt(s.up)}${isStream(x)?'회':'개'}</dd></div><div><dt>광고비</dt><dd>${fmt(s.cost)}원</dd></div><div><dt>CPV</dt><dd>${s.cpv!=null?s.cpv.toFixed(1)+'원':'–'}</dd></div></dl>
    ${me?'':`<button class="btn sm" data-act="open" data-id="${id}">열기 →</button>`}</div>`};
  return `<section class="panel pkg"><div class="panel-h"><div><h2>패키지 · 라이브 + 바이럴</h2><div class="sub">스트리머 광고와 바이럴 캠페인을 묶은 합산 성과입니다 (광고비 VAT 별도 · 각 캠페인 기준)</div></div>${ed&&isViral(c)?`<button class="btn sm ghost" data-act="pkgUnlink">${A.confirm==='pkgUnlink'?'한 번 더 누르면 묶음 해제':'묶음 해제'}</button>`:''}</div>
   <div class="tiles" style="margin-bottom:12px">${tile('패키지 총 노출',compact(T.views),'라이브 누적 시청 + 바이럴 조회')}${tile('패키지 광고비',fmt(T.cost)+'원','두 캠페인 합계')}${tile('패키지 CPV',T.views?(T.costV/T.views).toFixed(1)+'원':'–','집행 완료 광고비 ÷ 총 노출')}${tile('묶인 캠페인',fmt(all.length)+'개',isStream(c)?'라이브 1 · 바이럴 '+ps.length:'라이브 1 · 바이럴 1')}</div>
   <div class="pkg-g">${all.map(card).join('')}</div></section>`}
{const _ov=tabOverview;tabOverview=function(c,rows){return pkgPanel(c)+_ov(c,rows)}}
Object.assign(ACT,{
  pkgNewViral(){const c=curC();if(!c)return;const d=newCampaignData('viral');Object.assign(d,{name:(c.brand||c.advertiser||'')+' 스트리머 바이럴',advertiser:c.advertiser||'',brand:c.brand||'',acct:c.acct||'',managed:c.managed||'',pkg:A.cid,start:c.start||'',end:c.end||''});startDraft(d)},
  async pkgLink(){const v=($('#pkg-sel')||{}).value;if(!v)return toast('묶을 스트리머 광고를 골라 주세요.','crit');try{await cUpdate({pkg:v});toast('패키지로 묶었습니다.')}catch(e){saveErr(e)}},
  async pkgUnlink(){if(A.confirm!=='pkgUnlink'){A.confirm='pkgUnlink';render();return}A.confirm=null;try{await cUpdate({pkg:''});toast('묶음을 해제했습니다.')}catch(e){saveErr(e)}}});
['pkgNewViral','pkgLink','pkgUnlink'].forEach(k=>WRITE_ACTS.add(k));window.CONFIRM_ACTS=[...(window.CONFIRM_ACTS||[]),'pkgUnlink'];
(function(){const st=document.createElement('style');st.textContent=`
.pkg-cta{border-style:dashed}.pkg-cta .sub{margin-top:2px}
.pkg-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.pkg-c{border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--surface)}
.pkg-c.me{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.pkg-n{font-size:15px;line-height:1.35}
.pkg-c dl{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:0}.pkg-c dl div{display:flex;justify-content:space-between;gap:8px;font-size:12.5px}.pkg-c dt{color:var(--muted)}.pkg-c dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.pkg-c .btn{align-self:flex-start}`;document.head.appendChild(st)})();
