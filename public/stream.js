/* RINGCOMS 캠페인 관리 · 스트리머 광고 (v0.23)
   광고 관리 > 스트리머 광고 — PPL · 프로모션
   - 스트리머(SOOP · 치지직 · 유튜브)를 등록하고, 캠페인 기간의 방송(다시보기)을 불러와
     방송 제목 키워드와 소프트콘 기록으로 이 광고가 들어간 방송을 골라 성과를 집계합니다.
   - SOOP · 치지직: /api/stream (서버가 공개 방송 목록을 읽음, 키 불필요)
   - 유튜브: 연동 관리의 YouTube API 키로 브라우저에서 읽음
   - 저장: Firestore streams/{id} (팀원 읽기 · 마스터·매니저 수정) */

window.TOOL_IC=window.TOOL_IC||{};
window.TOOL_IC.stream='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/><path d="M10.2 8.6v4.8l4-2.4z" fill="currentColor" stroke="none"/></svg>';

/* ============ 상수 ============ */
window.CONFIRM_ACTS=[...(window.CONFIRM_ACTS||[]),'stDel','stDelCamp','metaClear'];
const ST_TYPES=['PPL','프로모션'];
const ST_TYPE_D={PPL:'방송 중 제품을 자연스럽게 노출·사용 (협찬 표기 필수)',프로모션:'방송 제목·화면·멘트로 이벤트·할인·링크를 알리는 홍보'};
const ST_PLATS=['SOOP','치지직','유튜브'];
const ST_PK={SOOP:'soop',치지직:'chzzk',유튜브:'yt'};
const ST_MAX_AIRS=150; // 스트리머 1명당 저장하는 방송 수 한도
A.st=A.st||{F:{type:'',st:'',q:''},tab:'airs',busy:{},nw:null,open:{}};

/* ============ 상태 · 불러오기 ============ */
function stWatch(){if(stWatch.on||!isTeam())return;stWatch.on=true;
  DB.watchCol('streams',m=>{A.streams=m;A.stLoaded=true;scheduleRender()},()=>{A.stLoaded=true;A.stErr=true;scheduleRender()})}
const stCur=()=>A.sid&&A.streams?A.streams[A.sid]:null;
async function stSave(id,up){if(!canEdit())return;try{await DB.update('streams/'+id,{...up,updatedAt:T_NOW(),by:A.user.email})}catch(e){saveErr(e)}}
const stNorm=s=>String(s||'').toLowerCase().replace(/[\s\-_.·,!?'"()[\]{}]/g,'');
function stKeywords(c){const L=[...(c.keywords||[]),c.brand,c.product].map(x=>String(x||'').trim()).filter(x=>stNorm(x).length>=2);return [...new Set(L)]}
/* 매칭: 방송 제목(또는 해시태그)에 키워드가 있거나, 소프트콘 기록이 있으면 이 광고 방송으로 봄 */
function stMatch(c,a){const ks=stKeywords(c).map(stNorm);const t=stNorm(a.title)+' '+(a.tags||[]).map(stNorm).join(' ');const hit=ks.find(k=>t.includes(k));return {title:!!hit,kw:hit?stKeywords(c).find(k=>stNorm(k)===hit):'',soft:n(a.softcon)>0}}
const stInc=(c,a)=>a.inc===true||(a.inc!==false&&(stMatch(c,a).title||stMatch(c,a).soft));
function stStatus(c){if(c.status==='보류'||c.status==='종료')return c.status;const d=today();if(c.start&&d<c.start)return '진행 전';if(c.end&&d>c.end)return '종료';return c.start?'진행 중':'진행 전'}
function stArr(c){return Object.entries(c.streamers||{}).map(([k,s])=>({k,...s})).sort((a,b)=>(a.order||0)-(b.order||0)||String(a.name||'').localeCompare(String(b.name||''),'ko'))}
function stAirs(s){return Object.entries(s.airs||{}).map(([k,a])=>({k,...a})).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')))}
/* 집계: 스트리머별 · 플랫폼별 · 전체 */
function stCalc(c){const rows=stArr(c).map(s=>{const L=stAirs(s).filter(a=>stInc(c,a));const S=f=>L.reduce((t,a)=>t+n(f(a)),0);
    const views=S(a=>a.views),soft=S(a=>a.softcon),mins=S(a=>a.durMin),peak=Math.max(0,...L.map(a=>n(a.peak)))||null,fee=has(s.fee)?n(s.fee):0;
    return {k:s.k,name:s.name||'',plat:s.plat||'',ch:s.ch||'',url:s.url||'',fee,n:L.length,views,soft,mins,peak,avg:L.length?views/L.length:null,cpv:views&&fee?fee/views:null,cps:soft&&fee?fee/soft:null,first:L.length?L[L.length-1].at:'',last:L.length?L[0].at:''}});
  const S=f=>rows.reduce((t,r)=>t+n(f(r)),0);const fx=has(c.fixedAd)?n(c.fixedAd):0;const fee=S(r=>r.fee);const cost=fee+fx;const views=S(r=>r.views),soft=S(r=>r.soft);
  const byPlat=ST_PLATS.map(p=>{const L=rows.filter(r=>r.plat===p);return {p,n:L.length,airs:L.reduce((t,r)=>t+r.n,0),views:L.reduce((t,r)=>t+r.views,0),soft:L.reduce((t,r)=>t+r.soft,0),fee:L.reduce((t,r)=>t+r.fee,0)}}).filter(x=>x.n);
  return {rows,T:{streamers:rows.length,active:rows.filter(r=>r.n).length,airs:S(r=>r.n),views,soft,mins:S(r=>r.mins),peak:Math.max(0,...rows.map(r=>n(r.peak)))||null,fee,fixed:fx,cost,cpv:views&&cost?cost/views:null,cps:soft&&cost?cost/soft:null,avg:S(r=>r.n)?views/S(r=>r.n):null},byPlat}}
/* 채널 주소 → 플랫폼·아이디 */
function stParseCh(u){const s=String(u||'').trim();if(!s)return null;
  let m=s.match(/(?:sooplive\.co\.kr|afreecatv\.com)\/(?:station\/)?([A-Za-z0-9_]{3,30})/i);if(m&&!/^(station|player|live|vod)$/i.test(m[1]))return {plat:'SOOP',ch:m[1].toLowerCase(),url:'https://www.sooplive.co.kr/station/'+m[1].toLowerCase()};
  m=s.match(/chzzk\.naver\.com\/(?:live\/|video\/)?([0-9a-f]{32})/i);if(m)return {plat:'치지직',ch:m[1].toLowerCase(),url:'https://chzzk.naver.com/'+m[1].toLowerCase()};
  m=s.match(/youtube\.com\/(@[A-Za-z0-9._\-]{2,}|channel\/UC[A-Za-z0-9_\-]{20,})/i);if(m){const v=m[1].startsWith('@')?m[1]:m[1].slice(8);return {plat:'유튜브',ch:v,url:'https://www.youtube.com/'+m[1]}}
  if(/^@[A-Za-z0-9._\-]{2,}$/.test(s))return {plat:'유튜브',ch:s,url:'https://www.youtube.com/'+s};
  return null}

/* ============ 방송 불러오기 ============ */
async function stYtVods(ch,from,to){let key=((A.settings||{}).ytKey||'').trim();if(!key&&typeof loadSettings==='function')key=(((await loadSettings())||{}).ytKey||'').trim();
  if(!key)throw new Error('YouTube API 키가 연결되지 않았습니다. 권한 관리 → 연동 관리에서 마스터가 키를 넣어 주세요.');
  const G=async(path,q)=>{const r=await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({...q,key})}`);const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error('YouTube: '+(((j.error||{}).errors||[])[0]||{}).reason||r.status);return j};
  const cj=await G('channels',{part:'contentDetails,snippet',...(String(ch).startsWith('@')?{forHandle:ch}:{id:ch})});const it=(cj.items||[])[0];if(!it)throw new Error('유튜브 채널을 찾지 못했습니다.');
  const up=it.contentDetails.relatedPlaylists.uploads;const ids=[];let pt='',older=false;
  for(let i=0;i<4&&!older;i++){const pj=await G('playlistItems',{part:'contentDetails',playlistId:up,maxResults:'50',...(pt?{pageToken:pt}:{})});(pj.items||[]).forEach(x=>{const d=String(x.contentDetails.videoPublishedAt||'').slice(0,10);if(from&&d&&d<from){older=true;return}if(!to||!d||d<=to)ids.push(x.contentDetails.videoId)});pt=pj.nextPageToken||'';if(!pt)break}
  const out=[];const dur=s=>{const m=String(s||'').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);return m?Math.round(((+m[1]||0)*1440)+((+m[2]||0)*60)+(+m[3]||0)+((+m[4]||0)/60)):null};
  for(let i=0;i<ids.length;i+=50){const vj=await G('videos',{part:'snippet,statistics,contentDetails,liveStreamingDetails',id:ids.slice(i,i+50).join(',')});
    (vj.items||[]).forEach(v=>{const L=v.liveStreamingDetails||{};const at=L.actualStartTime||v.snippet.publishedAt;const s=v.statistics||{};
      out.push({id:'yt:'+v.id,title:v.snippet.title||'',at,views:has(s.viewCount)?+s.viewCount:null,vodViews:has(s.viewCount)?+s.viewCount:null,likes:has(s.likeCount)?+s.likeCount:null,durMin:dur(v.contentDetails.duration),url:'https://www.youtube.com/watch?v='+v.id,thumb:((v.snippet.thumbnails||{}).medium||{}).url||'',live:!!L.actualStartTime,tags:(v.snippet.tags||[]).slice(0,10)})})}
  return out}
function stDemoVods(s,c){const kw=stKeywords(c)[0]||'브랜드';const d0=new Date((c.start||today())+'T20:00:00+09:00');const T=['저챗 + 게임','오늘은 '+kw+' 리뷰 방송!','신작 게임 정주행','['+kw+'] 이벤트 진행중 🎁','합방 데이','새벽 수다방','['+kw+' PPL] 같이 먹어요'];
  return T.map((t,i)=>({id:(ST_PK[s.plat]||'x')+':demo'+i+String(s.k).slice(-3),title:t,at:new Date(d0.getTime()+i*2*864e5).toISOString(),views:Math.round(3000+((i*7919)%9000)),vodViews:Math.round(200+((i*317)%900)),durMin:120+i*15,url:s.url||'',thumb:''}))}
async function stFetch(id,sk,quiet){const c=A.streams&&A.streams[id];const s=c&&(c.streamers||{})[sk];if(!c||!s||!canEdit())return 0;const key=id+':'+sk;if(A.st.busy[key])return 0;A.st.busy[key]=true;scheduleRender();
  try{const from=c.start||'',to=c.end||'';let items;
    if(DB.mode==='demo'){await new Promise(r=>setTimeout(r,400));items=stDemoVods({...s,k:sk},c)}
    else if(s.plat==='유튜브')items=await stYtVods(s.ch,from,to);
    else{const j=await aiFetch('/api/stream',{action:'vods',plat:ST_PK[s.plat],ch:s.ch||s.url,from,to});items=j.items||[]}
    const old=s.airs||{};const airs={};
    items.slice(0,ST_MAX_AIRS).forEach(it=>{const k=String(it.id).replace(/[^A-Za-z0-9_:]/g,'_').replace(/:/g,'_');const p=old[k]||{};
      airs[k]={id:it.id,title:it.title,at:it.at,views:it.views,vodViews:it.vodViews??null,durMin:it.durMin??null,url:it.url||'',thumb:it.thumb||'',tags:it.tags||[],src:'auto',...(has(p.softcon)?{softcon:p.softcon}:{}),...(has(p.peak)?{peak:p.peak}:{}),...(p.inc!=null?{inc:p.inc}:{}),fetchedAt:T_NOW()}});
    for(const k in old)if(old[k].src==='manual'||(!airs[k]&&(old[k].inc===true||has(old[k].softcon))))airs[k]=old[k]; // 직접 넣은 방송 · 소프트콘 기록이 있는 방송은 유지
    await stSave(id,{[`streamers.${sk}.airs`]:airs,[`streamers.${sk}.fetchedAt`]:T_NOW()});
    const hit=Object.values(airs).filter(a=>stInc(c,a)).length;if(!quiet)toast(`${s.name||'스트리머'} · 기간 내 방송 ${Object.keys(airs).length}개 중 ${hit}개가 이 광고 방송으로 매칭됐습니다.`);return hit}
  catch(e){toast(`${s.name||'스트리머'} 방송을 불러오지 못했습니다: ${e.message}`,'crit');return 0}
  finally{delete A.st.busy[key];scheduleRender()}}

/* ============ 화면: 목록 ============ */
function viewStream(){stWatch();if(A.sid)return stEditor();stCss();
  const all=Object.entries(A.streams||{}).map(([id,c])=>({id,...c}));const F=A.st.F;const q=(F.q||'').trim().toLowerCase();
  const L=all.filter(c=>(!F.type||c.type===F.type)&&(!F.st||stStatus(c)===F.st)&&(!q||[c.name,c.advertiser,c.brand,c.product].join(' ').toLowerCase().includes(q))).sort((a,b)=>String(b.start||b.createdAt||'').localeCompare(String(a.start||a.createdAt||'')));
  const K=all.map(c=>stCalc(c).T);const S=f=>K.reduce((t,x)=>t+n(f(x)),0);const stN=s=>all.filter(c=>stStatus(c)===s).length;
  return `<div class="page-h"><div><div class="eyebrow">Streamer Ads</div><h1>스트리머 광고</h1><div class="sub">SOOP · 치지직 · 유튜브 스트리머의 PPL · 프로모션 광고를 관리합니다. 캠페인 기간의 방송을 불러와 방송 제목 키워드와 소프트콘 기록으로 광고 방송을 골라 성과를 집계합니다.</div></div>
   <div class="row">${canEdit()?'<button class="btn primary" data-act="stNew">+ 새 스트리머 광고</button>':''}</div></div>
  ${A.stErr?'<div class="banner" style="margin-bottom:12px"><b>보안 규칙 게시가 필요합니다.</b> 스트리머 광고 데이터(streams)를 쓰려면 Firebase 콘솔에서 새 보안 규칙을 게시해야 합니다.</div>':''}
  ${A.st.nw?stNewPanel():''}
  <div class="tiles" style="margin-bottom:16px"><div class="tile"><span class="l">광고 캠페인</span><span class="v">${fmt(all.length)}</span><span class="s">진행 중 ${stN('진행 중')} · 진행 전 ${stN('진행 전')}</span></div><div class="tile"><span class="l">광고 방송</span><span class="v">${fmt(S(x=>x.airs))}</span><span class="s">스트리머 ${fmt(S(x=>x.streamers))}명</span></div><div class="tile"><span class="l">총 시청 · 조회</span><span class="v">${compact(S(x=>x.views))}</span><span class="s">매칭된 방송 기준</span></div><div class="tile"><span class="l">소프트콘</span><span class="v">${fmt(S(x=>x.soft))}</span><span class="s">방송별 기록 합계</span></div></div>
  <div class="row" style="margin-bottom:12px;gap:8px"><div class="chips">${[['','전체',all.length],...ST_TYPES.map(t=>[t,t,all.filter(c=>c.type===t).length])].map(([v,l,k])=>`<span class="chip ${(F.type||'')===v?'on':''}" data-act="stF" data-k="type" data-v="${esc(v)}">${l} <em>${k}</em></span>`).join('')}</div>
   <select data-stf="st" style="width:auto"><option value="">모든 상태</option>${['진행 전','진행 중','보류','종료'].map(s=>`<option ${F.st===s?'selected':''}>${s}</option>`).join('')}</select>
   <input type="text" data-stf="q" value="${esc(F.q||'')}" placeholder="캠페인·광고주·제품 검색" style="max-width:240px"></div>
  ${!A.stLoaded?'<div class="panel empty">불러오는 중…</div>':!all.length?`<div class="panel empty st-empty"><b>아직 만든 스트리머 광고가 없습니다.</b><span>「+ 새 스트리머 광고」에서 유형(PPL · 프로모션)과 기간, 방송 제목 키워드를 넣고 스트리머를 추가하세요.</span><ol class="st-flow"><li><i>1</i>캠페인 만들기<small>유형 · 기간 · 키워드</small></li><li><i>2</i>스트리머 추가<small>SOOP · 치지직 · 유튜브</small></li><li><i>3</i>방송 불러오기<small>제목 · 소프트콘으로 매칭</small></li><li><i>4</i>성과 집계<small>시청 · 소프트콘 · CPV</small></li></ol></div>`
  :!L.length?'<div class="panel empty">조건에 맞는 캠페인이 없습니다.</div>'
  :`<div class="tblwrap hide-m"><table class="tbl"><thead><tr><th>캠페인</th><th>유형</th><th>광고주 · 제품</th><th>기간</th><th>상태</th><th class="n">스트리머</th><th class="n">광고 방송</th><th class="n">시청 · 조회</th><th class="n">소프트콘</th><th class="n">비용</th></tr></thead><tbody>
    ${L.map(c=>{const k=stCalc(c);const st=stStatus(c);return `<tr class="click" data-act="stOpen" data-id="${esc(c.id)}"><td><b>${esc(c.name||'제목 없음')}</b><span class="st-plats">${[...new Set(stArr(c).map(s=>s.plat))].map(p=>`<i class="st-pl ${ST_PK[p]||''}">${esc(p)}</i>`).join('')}</span></td><td><span class="pill ${c.type==='PPL'?'accent':'ok'}">${esc(c.type||'PPL')}</span></td><td class="small">${esc([c.advertiser,c.product].filter(Boolean).join(' · ')||'–')}</td><td class="small">${c.start?md(c.start)+' ~ '+md(c.end||c.start):'–'}</td><td><span class="pill ${st==='진행 중'?'ok':st==='종료'?'':'warn'}">${st}</span></td><td class="n">${fmt(k.T.streamers)}</td><td class="n">${fmt(k.T.airs)}</td><td class="n">${compact(k.T.views)}</td><td class="n">${fmt(k.T.soft)}</td><td class="n">${k.T.cost?compact(k.T.cost)+'원':'–'}</td></tr>`}).join('')}</tbody></table></div>
   <div class="mcards show-m">${L.map(c=>{const k=stCalc(c);return `<div class="mcard" data-act="stOpen" data-id="${esc(c.id)}"><div class="mh"><div class="grow"><div class="mt">${esc(c.name||'제목 없음')}</div><div class="ms">${esc([c.type,c.advertiser,c.start?md(c.start)+'~'+md(c.end||c.start):''].filter(Boolean).join(' · '))}</div></div><span class="pill">${stStatus(c)}</span></div><div class="mkv"><div><span>방송</span><b>${fmt(k.T.airs)}</b></div><div><span>시청</span><b>${compact(k.T.views)}</b></div><div><span>소프트콘</span><b>${fmt(k.T.soft)}</b></div></div></div>`}).join('')}</div>`}`}
function stBlank(){return {name:'',type:'PPL',advertiser:'',brand:'',product:'',start:today(),end:'',keywords:[],memo:'',fixedAd:null,budget:null,status:'',streamers:{}}}
function stNewPanel(){const d=A.st.nw;
  return `<section class="panel" style="margin-bottom:16px"><div class="panel-h"><div><h2>새 스트리머 광고</h2><div class="sub">방송 제목 키워드는 이 광고가 들어간 방송을 찾는 기준입니다. 비우면 브랜드명·제품명으로 찾습니다.</div></div><button class="btn sm ghost" data-act="stNewX">닫기</button></div>
   <div class="fgrid">${stFields(d,'stn')}</div>
   <div class="row" style="justify-content:flex-end;margin-top:14px;gap:8px"><button class="btn" data-act="stNewX">취소</button><button class="btn primary" data-act="stCreate">만들기</button></div></section>`}
function stFields(c,p){const ed=canEdit();const at=k=>`data-${p}="${k}" ${ed?'':'disabled'}`;
  return `<label class="f">캠페인명<input type="text" ${at('name')} value="${esc(c.name||'')}" placeholder="예: 포즈닉 여리셀라 SOOP PPL 10월"></label>
   <div class="f"><span>광고 유형</span><div class="chips">${ST_TYPES.map(t=>`<span class="chip ${(c.type||'PPL')===t?'on':''}" ${ed?`data-act="stType" data-p="${p}" data-v="${t}"`:''} title="${esc(ST_TYPE_D[t])}">${t}</span>`).join('')}</div><span class="hint">${esc(ST_TYPE_D[c.type||'PPL'])}</span></div>
   <label class="f">광고주<input type="text" ${at('advertiser')} value="${esc(c.advertiser||'')}"></label><label class="f">브랜드<input type="text" ${at('brand')} value="${esc(c.brand||'')}"></label>
   <label class="f">제품 · 프로모션명<input type="text" ${at('product')} value="${esc(c.product||'')}" placeholder="예: 여리셀라 / 10월 할인 이벤트"></label>
   <label class="f">시작일<input type="date" ${at('start')} value="${esc(c.start||'')}"></label><label class="f">종료일<input type="date" ${at('end')} value="${esc(c.end||'')}"></label>
   <label class="f wide">방송 제목 키워드<input type="text" ${at('keywords')} value="${esc((c.keywords||[]).join(', '))}" placeholder="쉼표로 구분 · 예: 여리셀라, 포즈닉, #광고"><span class="hint">방송 제목·해시태그에 이 단어가 있거나, 소프트콘 기록이 있는 방송을 이 광고 방송으로 집계합니다.</span></label>`}

/* ============ 화면: 편집 ============ */
function stEditor(){stCss();const c=stCur();if(!c)return `<div class="panel empty">${A.stLoaded?'캠페인을 찾을 수 없습니다.':'불러오는 중…'} <button class="btn sm" data-act="stBack">목록으로</button></div>`;
  const ed=canEdit();const K=stCalc(c);const st=stStatus(c);const tab=A.st.tab||'airs';const L=stArr(c);const busyAll=Object.keys(A.st.busy).some(k=>k.startsWith(A.sid+':'));
  const tabs=[['airs','스트리머 · 방송'],['report','성과 집계'],['settings','캠페인 설정']];
  return `<div class="page-h"><div><button class="btn sm ghost" data-act="stBack" style="margin:0 0 6px -8px">‹ 스트리머 광고</button><div class="eyebrow">${esc(c.type||'PPL')} · ${esc(c.advertiser||'광고주 미입력')}</div><h1>${esc(c.name||'제목 없음')}</h1>
    <div class="row" style="gap:6px;margin-top:6px"><span class="pill ${st==='진행 중'?'ok':''}">${st}</span>${c.start?`<span class="pill">${md(c.start)} ~ ${md(c.end||c.start)}</span>`:''}${stKeywords(c).map(k=>`<span class="pill accent" title="방송 제목 키워드">#${esc(k)}</span>`).join('')}</div></div>
   <div class="row">${ed&&L.length?`<button class="btn primary" data-act="stFetchAll" ${busyAll?'disabled':''}>${busyAll?'<span class="rq-spin"></span> 방송 불러오는 중…':'전체 방송 불러오기'}</button>`:''}<button class="btn" data-act="stXlsx">엑셀 다운로드</button></div></div>
  <div class="tiles" style="margin-bottom:14px"><div class="tile"><span class="l">광고 방송</span><span class="v">${fmt(K.T.airs)}</span><span class="s">스트리머 ${K.T.active}/${K.T.streamers}명 방송</span></div><div class="tile"><span class="l">총 시청 · 조회</span><span class="v">${compact(K.T.views)}</span><span class="s">방송당 평균 ${K.T.avg!=null?compact(K.T.avg):'–'}</span></div><div class="tile"><span class="l">소프트콘</span><span class="v">${fmt(K.T.soft)}</span><span class="s">${K.T.cps!=null?'소프트콘당 '+fmt(K.T.cps)+'원':'방송별로 입력'}</span></div><div class="tile"><span class="l">광고비</span><span class="v">${K.T.cost?compact(K.T.cost)+'원':'–'}</span><span class="s">${K.T.cpv!=null?'CPV '+K.T.cpv.toFixed(1)+'원':'출연료 입력 시 CPV 계산'}</span></div></div>
  <div class="tabs">${tabs.map(([k,l])=>`<button class="${tab===k?'on':''}" data-act="stTab" data-t="${k}">${l}</button>`).join('')}</div>
  ${tab==='report'?stReport(c,K):tab==='settings'?stSettings(c):stAirsTab(c,K)}`}
function stAirsTab(c,K){const ed=canEdit();const L=stArr(c);
  return `${ed?`<section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>스트리머 추가</h2><div class="sub">방송국·채널 주소를 붙여넣으면 플랫폼이 자동으로 정해집니다. SOOP: sooplive.co.kr/station/아이디 · 치지직: chzzk.naver.com/채널ID · 유튜브: youtube.com/@핸들</div></div></div>
    <div class="fgrid"><label class="f">스트리머 이름<input type="text" id="st-a-name" placeholder="예: 김민교"></label><label class="f wide">방송국 · 채널 주소<input type="url" id="st-a-url" placeholder="https://www.sooplive.co.kr/station/…"></label>
     <label class="f">플랫폼<select id="st-a-plat"><option value="">주소로 자동</option>${ST_PLATS.map(p=>`<option>${p}</option>`).join('')}</select></label><label class="f">출연료 · 광고비 (원)<input type="text" inputmode="decimal" id="st-a-fee" placeholder="VAT 별도"></label>
     <div class="f"><span>&nbsp;</span><button class="btn primary" data-act="stAdd">추가하고 방송 불러오기</button></div></div></section>`:''}
   ${!L.length?'<div class="panel empty">아직 스트리머가 없습니다.</div>':L.map(s=>stCard(c,s,K.rows.find(r=>r.k===s.k)||{})).join('')}`}
function stCard(c,s,R){const ed=canEdit();const airs=stAirs(s);const key=A.sid+':'+s.k;const busy=A.st.busy[key];const open=A.st.open[s.k]!==false;const onlyHit=A.st.onlyHit!==false;const show=onlyHit?airs.filter(a=>stInc(c,a)):airs;
  const at=f=>`data-sts="${s.k}.${f}" ${ed?'':'disabled'}`;
  return `<section class="panel st-card"><div class="panel-h"><div class="row grow" style="gap:8px;min-width:0"><i class="st-pl ${ST_PK[s.plat]||''}">${esc(s.plat||'')}</i><b class="st-nm">${esc(s.name||'이름 없음')}</b>${s.url?`<a class="small" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(String(s.ch||s.url).slice(0,40))} ↗</a>`:''}<span class="small muted">${s.fetchedAt?'불러옴 '+esc(String(s.fetchedAt).slice(5,16).replace('T',' ')):'아직 불러오지 않음'}</span></div>
    <div class="row">${ed?`<button class="btn sm" data-act="stFetch" data-k="${s.k}" ${busy?'disabled':''}>${busy?'<span class="rq-spin"></span> 불러오는 중…':'방송 불러오기'}</button><button class="btn sm ghost" data-act="stAirAdd" data-k="${s.k}">+ 방송 직접 추가</button><button class="btn sm danger" data-act="stDel" data-k="${s.k}">${A.confirm==='stDel'+s.k?'한 번 더 누르면 삭제':'삭제'}</button>`:''}<button class="btn sm ghost" data-act="stFold" data-k="${s.k}">${open?'접기':'펼치기'}</button></div></div>
   <div class="st-kpi"><div><span>광고 방송</span><b>${fmt(R.n||0)}</b></div><div><span>시청 · 조회</span><b>${compact(R.views||0)}</b></div><div><span>최고 시청자</span><b>${R.peak?fmt(R.peak):'–'}</b></div><div><span>방송 시간</span><b>${R.mins?fmt(Math.round(R.mins/60*10)/10)+'시간':'–'}</b></div><div><span>소프트콘</span><b>${fmt(R.soft||0)}</b></div>
    <div><span>출연료 (원)</span>${ed?`<input type="text" inputmode="decimal" ${at('fee')} value="${has(s.fee)?Number(s.fee).toLocaleString('ko-KR'):''}" placeholder="0">`:`<b>${has(s.fee)?fmt(s.fee):'–'}</b>`}</div><div><span>CPV</span><b>${R.cpv!=null?R.cpv.toFixed(1)+'원':'–'}</b></div></div>
   ${open?`<div class="row small" style="margin:10px 0 6px;gap:10px"><label class="row" style="gap:4px"><input type="checkbox" data-act="stOnlyHit" ${onlyHit?'checked':''}> 광고 방송만 보기</label><span class="muted">기간 내 방송 ${airs.length}개 · 광고 방송 ${airs.filter(a=>stInc(c,a)).length}개 · 「포함」을 끄거나 켜서 직접 고칠 수 있습니다</span></div>
    ${show.length?`<div class="tblwrap"><table class="tbl st-tbl"><thead><tr><th style="width:52px">포함</th><th style="width:96px">방송일</th><th>방송 제목</th><th>매칭</th><th class="n">시청 · 조회</th><th class="n" style="width:100px">최고 시청자</th><th class="n">시간</th><th class="n" style="width:96px">소프트콘</th><th></th></tr></thead><tbody>
     ${show.map(a=>{const m=stMatch(c,a);const inc=stInc(c,a);const ap=`data-sta="${s.k}.${a.k}"`;return `<tr class="${inc?'':'st-off'}"><td><input type="checkbox" ${ap} data-f="inc" ${inc?'checked':''} ${ed?'':'disabled'} aria-label="광고 방송에 포함"></td>
      <td class="small">${a.at?md(String(a.at).slice(0,10))+'<br><span class="muted">'+esc(fmtKst(a.at))+'</span>':'–'}</td>
      <td>${a.src==='manual'&&ed?`<input type="text" ${ap} data-f="title" value="${esc(a.title||'')}" placeholder="방송 제목">`:`<span class="st-ttl">${esc(a.title||'')}</span>`}</td>
      <td class="small">${m.title?`<span class="pill ok" title="제목·태그에 「${esc(m.kw)}」">제목</span>`:''}${m.soft?' <span class="pill accent">소프트콘</span>':''}${a.inc===true&&!m.title&&!m.soft?' <span class="pill">직접 포함</span>':''}${a.inc===false?' <span class="pill">제외</span>':''}</td>
      <td class="n">${a.src==='manual'&&ed?`<input type="text" inputmode="decimal" ${ap} data-f="views" value="${has(a.views)?a.views:''}" style="width:90px">`:has(a.views)?fmt(a.views):'–'}</td>
      <td class="n">${ed?`<input type="text" inputmode="decimal" ${ap} data-f="peak" value="${has(a.peak)?a.peak:''}" placeholder="–" style="width:80px">`:has(a.peak)?fmt(a.peak):'–'}</td>
      <td class="n small">${has(a.durMin)?fmt(a.durMin)+'분':'–'}</td>
      <td class="n">${ed?`<input type="text" inputmode="decimal" ${ap} data-f="softcon" value="${has(a.softcon)?a.softcon:''}" placeholder="0" style="width:72px">`:has(a.softcon)?fmt(a.softcon):'–'}</td>
      <td class="n">${a.url?`<a class="btn sm ghost" href="${esc(a.url)}" target="_blank" rel="noopener">보기 ↗</a>`:''}${a.src==='manual'&&ed?`<button class="btn sm ghost" data-act="stAirDel" data-k="${s.k}" data-a="${a.k}">✕</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`:`<div class="empty small">${airs.length?'키워드·소프트콘으로 매칭된 방송이 없습니다. 「광고 방송만 보기」를 끄고 직접 「포함」을 켜 주세요.':'「방송 불러오기」를 누르면 캠페인 기간의 방송이 들어옵니다.'}</div>`}`:''}</section>`}
const fmtKst=iso=>{const d=new Date(iso);if(isNaN(d))return '';const k=new Date(d.getTime()+9*3600e3).toISOString();return k.slice(11,16)};
function stReport(c,K){const T=K.T;const rows=K.rows.slice().sort((a,b)=>b.views-a.views);const mx=Math.max(1,...rows.map(r=>r.views));
  return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><div><h2>스트리머별 성과</h2><div class="sub">광고 방송(제목 키워드 · 소프트콘 · 직접 포함) 기준 · 광고비는 VAT 별도</div></div></div>
   ${rows.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>스트리머</th><th>플랫폼</th><th class="n">광고 방송</th><th class="n">시청 · 조회</th><th style="width:22%"></th><th class="n">방송당 평균</th><th class="n">최고 시청자</th><th class="n">소프트콘</th><th class="n">출연료</th><th class="n">CPV</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td><i class="st-pl ${ST_PK[r.plat]||''}">${esc(r.plat)}</i></td><td class="n">${fmt(r.n)}</td><td class="n">${fmt(r.views)}</td><td><div class="st-bar"><i style="width:${Math.round(r.views/mx*100)}%"></i></div></td><td class="n">${r.avg!=null?fmt(r.avg):'–'}</td><td class="n">${r.peak?fmt(r.peak):'–'}</td><td class="n">${fmt(r.soft)}</td><td class="n">${r.fee?fmt(r.fee):'–'}</td><td class="n">${r.cpv!=null?r.cpv.toFixed(1):'–'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2">합계 ${rows.length}명</td><td class="n">${fmt(T.airs)}</td><td class="n">${fmt(T.views)}</td><td></td><td class="n">${T.avg!=null?fmt(T.avg):'–'}</td><td class="n">${T.peak?fmt(T.peak):'–'}</td><td class="n">${fmt(T.soft)}</td><td class="n">${fmt(T.fee)}</td><td class="n">${T.cpv!=null?T.cpv.toFixed(1):'–'}</td></tr></tfoot></table></div>`:'<div class="empty">스트리머를 추가해 주세요.</div>'}</section>
  <div class="grid2"><section class="panel"><div class="panel-h"><h2>플랫폼별</h2></div>${K.byPlat.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>플랫폼</th><th class="n">스트리머</th><th class="n">광고 방송</th><th class="n">시청 · 조회</th><th class="n">소프트콘</th></tr></thead><tbody>${K.byPlat.map(x=>`<tr><td><i class="st-pl ${ST_PK[x.p]||''}">${x.p}</i></td><td class="n">${x.n}</td><td class="n">${fmt(x.airs)}</td><td class="n">${fmt(x.views)}</td><td class="n">${fmt(x.soft)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty small">–</div>'}</section>
   <section class="panel"><div class="panel-h"><h2>광고비</h2></div><dl class="kv" style="grid-template-columns:auto 1fr"><dt>출연료 합계</dt><dd>${fmt(T.fee)}원</dd><dt>고정 광고비</dt><dd>${fmt(T.fixed)}원</dd><dt>총 광고비</dt><dd><b>${fmt(T.cost)}원</b></dd><dt>CPV</dt><dd>${T.cpv!=null?T.cpv.toFixed(1)+'원':'–'}</dd><dt>소프트콘당 비용</dt><dd>${T.cps!=null?fmt(T.cps)+'원':'–'}</dd><dt>총 방송 시간</dt><dd>${fmt(Math.round(T.mins/60*10)/10)}시간</dd></dl></section></div>`}
function stSettings(c){const ed=canEdit();
  return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><h2>캠페인 정보</h2></div><div class="fgrid">${stFields(c,'ste')}
    <label class="f">상태<select data-ste="status" ${ed?'':'disabled'}><option value="">자동 (현재: ${stStatus({...c,status:''})})</option>${['보류','종료'].map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
    <label class="f">고정 광고비 (원)<input type="text" inputmode="decimal" data-ste="fixedAd" data-t="num" value="${has(c.fixedAd)?Number(c.fixedAd).toLocaleString('ko-KR'):''}" ${ed?'':'disabled'}><span class="hint">스트리머 출연료 외 캠페인 단위 비용 · VAT 별도</span></label>
    <label class="f">총 예산 (원)<input type="text" inputmode="decimal" data-ste="budget" data-t="num" value="${has(c.budget)?Number(c.budget).toLocaleString('ko-KR'):''}" ${ed?'':'disabled'}></label>
    <label class="f wide">메모<textarea data-ste="memo" rows="3" ${ed?'':'disabled'}>${esc(c.memo||'')}</textarea></label></div></section>
   <section class="panel"><div class="panel-h"><div><h2>데이터를 가져오는 방법</h2></div></div><ul class="small" style="margin:0;padding-left:18px;line-height:1.7"><li><b>SOOP · 치지직</b>: 방송국·채널의 다시보기 목록(제목·방송일·누적 시청·방송 시간)을 서버가 읽어 옵니다. 키가 필요 없고, 다시보기를 비공개로 둔 방송은 직접 추가해 주세요.</li><li><b>유튜브</b>: 연동 관리의 YouTube API 키로 업로드·라이브 다시보기의 조회수·길이를 읽습니다.</li><li><b>최고 시청자 · 소프트콘</b>: 플랫폼이 다시보기에 남기지 않는 값이라 방송별로 입력합니다. 소프트콘이 기록된 방송은 제목에 키워드가 없어도 광고 방송으로 집계됩니다.</li></ul>
    ${ed?`<div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn sm danger" data-act="stDelCamp">${A.confirm==='stDelCamp'?'한 번 더 누르면 영구 삭제':'캠페인 삭제'}</button></div>`:''}</section>`}

/* ============ 연동 관리 ============ */
function stIntRows(row){if(!canEdit())return '';if(!A.stInt&&!A.stIntBusy)setTimeout(()=>stIntCheck(),0);const s=A.stInt||{};
  const pill=x=>A.stIntBusy&&!A.stInt?'<span class="pill">확인 중…</span>':DB.mode==='demo'?'<span class="pill ok">데모</span>':x&&x.ok?'<span class="pill ok">연결됨 · 키 불필요</span>':x?'<span class="pill warn">응답 없음</span>':'<span class="pill">–</span>';
  return row('SOOP 방송 데이터',pill(s.soop),'스트리머 광고: 방송국 다시보기 목록(제목·방송일·누적 시청·방송 시간) 불러오기 · 제목 키워드로 광고 방송 매칭','공개 데이터 (설정 없음) · 공식 Open API 키를 받으면 Netlify 환경변수 <code>SOOP_CLIENT_ID</code>')
    +row('치지직 방송 데이터',pill(s.chzzk),'스트리머 광고: 채널 다시보기 목록(제목·방송일·조회·방송 시간) 불러오기','공개 데이터 (설정 없음) · 공식 Open API 키를 받으면 Netlify 환경변수 <code>CHZZK_CLIENT_ID</code>')}
async function stIntCheck(){if(A.stIntBusy)return;A.stIntBusy=true;try{A.stInt=DB.mode==='demo'?{soop:{ok:true},chzzk:{ok:true}}:await aiFetch('/api/stream',{action:'status'})}catch(e){A.stInt={soop:{ok:false,error:e.message},chzzk:{ok:false,error:e.message}}}finally{A.stIntBusy=false;scheduleRender()}}

/* ============ 동작 ============ */
Object.assign(ACT,{
  stNew(){A.st.nw=stBlank();render();window.scrollTo(0,0)},
  stNewX(){A.st.nw=null;render()},
  stF(a){A.st.F[a.dataset.k]=a.dataset.v;render()},
  stOpen(a){A.sid=a.dataset.id;A.st.tab='airs';A.confirm=null;render();window.scrollTo(0,0)},
  stBack(){A.sid='';render();window.scrollTo(0,0)},
  stTab(a){A.st.tab=a.dataset.t;render()},
  stFold(a){A.st.open[a.dataset.k]=A.st.open[a.dataset.k]===false;render()},
  stOnlyHit(){A.st.onlyHit=A.st.onlyHit===false;render()},
  stType(a){const p=a.dataset.p,v=a.dataset.v;if(p==='stn'){A.st.nw.type=v;render()}else{const c=stCur();if(c){c.type=v;stSave(A.sid,{type:v});render()}}},
  async stCreate(){const ae=document.activeElement;if(ae&&ae.blur)ae.blur();await new Promise(x=>setTimeout(x,30));const d=A.st.nw;if(!d)return;if(!String(d.name||'').trim())return toast('캠페인명을 입력해 주세요.','crit');
    const id=uid();const doc={...clone(d),name:String(d.name).trim(),createdAt:today(),updatedAt:T_NOW(),by:A.user.email};
    try{await DB.set('streams/'+id,doc);A.streams=A.streams||{};A.streams[id]=doc;A.st.nw=null;A.sid=id;A.st.tab='airs';toast('스트리머 광고를 만들었습니다. 스트리머를 추가해 주세요.');render();window.scrollTo(0,0)}catch(e){saveErr(e)}},
  async stAdd(){const c=stCur();if(!c)return;const name=String(($('#st-a-name')||{}).value||'').trim(),url=String(($('#st-a-url')||{}).value||'').trim();let plat=($('#st-a-plat')||{}).value||'';const fee=parseNum(($('#st-a-fee')||{}).value||'');
    const pc=stParseCh(url);if(!pc&&!plat)return toast('방송국·채널 주소를 확인하거나 플랫폼을 골라 주세요.','crit');if(!name&&!pc)return toast('스트리머 이름을 입력해 주세요.','crit');
    plat=plat||pc.plat;const sk='s'+uid().slice(0,8);const order=stArr(c).reduce((m,s)=>Math.max(m,s.order||0),0)+1;
    const s={name:name||(pc?pc.ch:''),plat,ch:pc?pc.ch:url,url:pc?pc.url:url,fee:fee==null?null:fee,order,airs:{},addedAt:T_NOW()};
    await stSave(A.sid,{[`streamers.${sk}`]:s});c.streamers=c.streamers||{};c.streamers[sk]=s;['#st-a-name','#st-a-url','#st-a-fee'].forEach(q=>{const el=$(q);if(el)el.value=''});render();
    if(pc||plat!=='유튜브')await stFetch(A.sid,sk)},
  async stFetch(a){await stFetch(A.sid,a.dataset.k)},
  async stFetchAll(){const c=stCur();if(!c)return;const L=stArr(c);let hit=0;for(const s of L)hit+=await stFetch(A.sid,s.k,true);toast(`스트리머 ${L.length}명의 방송을 불러왔습니다 · 광고 방송 ${hit}개 매칭.`)},
  async stDel(a){const k=a.dataset.k;if(A.confirm!=='stDel'+k){A.confirm='stDel'+k;render();return}A.confirm=null;await stSave(A.sid,{[`streamers.${k}`]:DB.DEL});toast('스트리머를 삭제했습니다.');render()},
  async stAirAdd(a){const k=a.dataset.k;const ak='m'+uid().slice(0,8);await stSave(A.sid,{[`streamers.${k}.airs.${ak}`]:{id:ak,title:'',at:new Date().toISOString(),views:null,src:'manual',inc:true}});A.st.onlyHit=false;render()},
  async stAirDel(a){await stSave(A.sid,{[`streamers.${a.dataset.k}.airs.${a.dataset.a}`]:DB.DEL});render()},
  async stDelCamp(){if(A.confirm!=='stDelCamp'){A.confirm='stDelCamp';render();return}A.confirm=null;try{await DB.del('streams/'+A.sid);A.sid='';toast('캠페인을 삭제했습니다.');render()}catch(e){saveErr(e)}},
  async stXlsx(){const c=stCur();if(!c)return;try{if(!window.XLSX)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')}catch(e){return toast('엑셀 모듈을 불러오지 못했습니다.','crit')}
    const K=stCalc(c);const wb=XLSX.utils.book_new();
    const s1=XLSX.utils.aoa_to_sheet([['스트리머','플랫폼','채널','광고 방송','시청·조회','방송당 평균','최고 시청자','방송 시간(분)','소프트콘','출연료(원)','CPV(원)'],...K.rows.map(r=>[r.name,r.plat,r.url||r.ch,r.n,r.views,r.avg!=null?Math.round(r.avg):'',r.peak||'',r.mins,r.soft,r.fee||'',r.cpv!=null?Math.round(r.cpv*10)/10:'']),['합계','','',K.T.airs,K.T.views,K.T.avg!=null?Math.round(K.T.avg):'',K.T.peak||'',K.T.mins,K.T.soft,K.T.fee,K.T.cpv!=null?Math.round(K.T.cpv*10)/10:'']]);
    XLSX.utils.book_append_sheet(wb,s1,'스트리머별 성과');
    const air=[];stArr(c).forEach(s=>stAirs(s).filter(a=>stInc(c,a)).forEach(a=>{const m=stMatch(c,a);air.push([s.name,s.plat,String(a.at||'').slice(0,10),fmtKst(a.at),a.title,[m.title?'제목('+m.kw+')':'',m.soft?'소프트콘':'',a.inc===true&&!m.title&&!m.soft?'직접 포함':''].filter(Boolean).join(' · '),has(a.views)?a.views:'',has(a.peak)?a.peak:'',has(a.durMin)?a.durMin:'',has(a.softcon)?a.softcon:'',a.url||''])}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['스트리머','플랫폼','방송일','시각','방송 제목','매칭','시청·조회','최고 시청자','방송 시간(분)','소프트콘','링크'],...air]),'광고 방송');
    XLSX.writeFile(wb,`${(c.name||'스트리머 광고').replace(/[\\/:*?"<>|]/g,'')}_${today().replace(/-/g,'')}.xlsx`)}
});
/* 입력 저장 */
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset)return;
  if(t.dataset.stf){A.st.F[t.dataset.stf]=t.value;render();return}
  if(t.dataset.stn){const d=A.st.nw;if(!d)return;const k=t.dataset.stn;d[k]=k==='keywords'?String(t.value).split(/[,\n]/).map(x=>x.trim()).filter(Boolean):t.value;if(k==='brand'&&!d.name&&t.value)d.name=t.value+' 스트리머 광고';return}
  if(t.dataset.ste){const c=stCur();if(!c||!canEdit())return;const k=t.dataset.ste;let v=t.value;if(k==='keywords')v=String(v).split(/[,\n]/).map(x=>x.trim()).filter(Boolean);else if(t.dataset.t==='num')v=parseNum(v);if(k==='name'&&!String(v).trim())return toast('캠페인명은 비울 수 없습니다.','crit');c[k]=v;stSave(A.sid,{[k]:v==null?DB.DEL:v});render();return}
  if(t.dataset.sts){const [sk,f]=t.dataset.sts.split('.');const v=parseNum(t.value);stSave(A.sid,{[`streamers.${sk}.${f}`]:v==null?DB.DEL:v});return}
  if(t.dataset.sta){const [sk,ak]=t.dataset.sta.split('.');const f=t.dataset.f;let v;if(f==='inc'){const c=stCur();const a=((c.streamers||{})[sk]||{}).airs[ak]||{};const m=stMatch(c,a);v=t.checked===(m.title||m.soft)?DB.DEL:t.checked}else if(f==='title')v=t.value;else{v=parseNum(t.value);if(v==null)v=DB.DEL}
    stSave(A.sid,{[`streamers.${sk}.airs.${ak}.${f}`]:v});return}});

/* ============ 스타일 ============ */
function stCss(){if(stCss.done)return '';stCss.done=1;document.head.insertAdjacentHTML('beforeend',`<style id="st-css">
.st-pl{font-style:normal;font-size:11px;font-weight:600;padding:2px 7px;border-radius:999px;background:var(--line);color:var(--ink2);white-space:nowrap}
.st-pl.soop{background:#E8F0FF;color:#1D4ED8}.st-pl.chzzk{background:#DFFBEA;color:#047857}.st-pl.yt{background:#FDE8E8;color:#B91C1C}
.st-plats{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}.st-nm{font-size:15px}
.st-kpi{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;margin-top:4px}.st-kpi>div{background:var(--bg2,rgba(0,0,0,.03));border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}.st-kpi span{font-size:11px;color:var(--muted)}.st-kpi b{font-size:16px}.st-kpi input{padding:4px 6px}
.st-tbl input[type=text]{padding:4px 6px}.st-tbl tr.st-off td{opacity:.55}.st-ttl{display:block;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden}.st-bar i{display:block;height:100%;background:var(--accent,#2347D4);border-radius:4px}
.st-empty{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center}.st-flow{display:flex;gap:10px;list-style:none;padding:0;margin:10px 0 0;flex-wrap:wrap;justify-content:center}.st-flow li{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:110px;font-size:13px}.st-flow i{font-style:normal;width:26px;height:26px;border-radius:50%;background:var(--accent,#2347D4);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}.st-flow small{color:var(--muted)}
</style>`);return ''}
/* 메뉴 배지: 진행 중 캠페인 수 (데이터를 연 뒤에만) */
function stCountBadge(){if(!A.streams)return '';const k=Object.values(A.streams).filter(c=>stStatus(c)==='진행 중').length;return k?String(k):''}
