/* RINGCOMS 캠페인 관리 · 스트리머 (v0.25)
   ① 광고 관리 > 스트리머 광고 — 캠페인 유형 stream (시딩처럼 캠페인 › 광고 그룹 › 스트리머 › 완료)
      스트리머 관리 · 진행 현황 · 성과 리포트 · 광고주 공유 · 앱 다운로드 트래킹(예정)
      방송 불러오기: SOOP · 치지직(/api/stream) · 유튜브(YouTube API 키) → 방송 제목 키워드·소프트콘으로 광고 방송 매칭
      방송 상세는 streams/air_{캠페인}_{행} 문서에 저장, 행에는 합계(광고 방송 수·누적 시청·최고·평균 시청자·소프트콘·방송 시간)
   ② 인플루언서 관리 > 스트리머 풀 — streams/sp_{id} (링컴즈 소속 · 파트너 · 외부, SOOP·치지직·유튜브 채널, 캠페인 이력)
   ③ 인플루언서 관리 > 스트리머 데이터 — streams/sd_{id} (채널 요약 · 방송 기록 · 방송별 그래프·요약표, 불러오기는 수동)
   데이터는 모두 streams 컬렉션(팀원 읽기 · 마스터·매니저 수정)에 type 으로 구분해 저장합니다. */
window.TOOL_IC=window.TOOL_IC||{};
window.TOOL_IC.stream='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/><path d="M10.2 8.6v4.8l4-2.4z" fill="currentColor" stroke="none"/></svg>';
window.TOOL_IC.spool='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="12" height="9" rx="2"/><path d="M15 9.5l4-2.5v8l-4-2.5"/><circle cx="8" cy="19" r="1.4"/><path d="M5 21c.6-1.3 1.7-2 3-2s2.4.7 3 2"/></svg>';
window.TOOL_IC.sdata='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V5M4 19h16"/><path d="M7 15l3.5-4 3 2.5L19 7"/></svg>';
window.CONFIRM_ACTS=[...(window.CONFIRM_ACTS||[]),'spDel','metaClear','sdBcDel'];
const SK_PLAT={SOOP:'soop',치지직:'chzzk',유튜브:'yt'};const SK_PLAT_L={soop:'SOOP',chzzk:'치지직',yt:'유튜브'};
const SK_ROSTER=[{name:'호미호',partner:'링컴즈 소속',tags:'서브컬쳐 게임'},{name:'지호아재',partner:'링컴즈 소속',tags:'종합 · MMORPG'}];
A.sk=A.sk||{busy:{},air:{},fetching:false,spQ:'',spF:'',sdSel:'',sdBc:'',rec:false};
const skP=p=>`<i class="sk-pl ${SK_PLAT[p]||p||''}">${esc(SK_PLAT_L[p]||p||'')}</i>`;
const skNorm=s=>String(s||'').toLowerCase().replace(/[\s\-_.·,!?'"()[\]{}#]/g,'');
const fmtH=m=>m==null||!isFinite(m)?'–':(m>=60?`${Math.floor(m/60)}시간 ${Math.round(m%60)}분`:`${Math.round(m)}분`);
const kstT=iso=>{const d=new Date(iso);if(isNaN(d))return '';const k=new Date(d.getTime()+9*3600e3).toISOString();return k.slice(5,10).replace('-','.')+' '+k.slice(11,16)};

/* ============ 키워드 · 매칭 ============ */
function skKeywords(c){const o=c.st||{};const L=[...(o.keywords||[]),c.brand,o.product].map(x=>String(x||'').trim()).filter(x=>skNorm(x).length>=2);return [...new Set(L)]}
function skMatch(c,a){const ks=skKeywords(c);const t=skNorm(a.title)+' '+(a.tags||[]).map(skNorm).join(' ');const hit=ks.find(k=>t.includes(skNorm(k)));return {title:!!hit,kw:hit||'',soft:n(a.softcon)>0}}
const skInc=(c,a)=>a.inc===true||(a.inc!==false&&(skMatch(c,a).title||skMatch(c,a).soft));
function skPeriod(c,r){const g=r.group&&c.groups&&c.groups[r.group];return {from:(g&&g.start)||c.start||'',to:(g&&g.end)||c.end||''}}
/* 행 합계 (광고 방송 기준) */
function skAgg(c,airs){const L=Object.values(airs||{}).filter(a=>skInc(c,a));const S=f=>L.reduce((t,a)=>t+n(f(a)),0);const pk=Math.max(0,...L.map(a=>n(a.peak)));const av=L.filter(a=>has(a.avg));
  const last=L.map(a=>String(a.at||'').slice(0,10)).sort().pop()||'';
  return {airN:L.length,views:S(a=>a.views),peak:pk||null,avgV:av.length?Math.round(av.reduce((t,a)=>t+n(a.avg),0)/av.length):null,soft:S(a=>a.softcon)||null,stMins:S(a=>a.durMin)||null,chats:S(a=>a.chats)||null,up:last}}

/* ============ 방송 불러오기 ============ */
async function skYtKey(){let key=((A.settings||{}).ytKey||'').trim();if(!key&&typeof loadSettings==='function')key=(((await loadSettings())||{}).ytKey||'').trim();if(!key)throw new Error('YouTube API 키가 연결되지 않았습니다. 권한 관리 → 연동 관리에서 마스터가 키를 넣어 주세요.');return key}
async function skYt(path,q){const key=await skYtKey();const r=await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({...q,key})}`);const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error){const e=j.error||{};const why=((e.errors||[])[0]||{}).reason||'';throw new Error(/quota/i.test(why)?'오늘 YouTube API 한도를 다 썼습니다. 내일 다시 시도하세요.':/referer|blocked|forbidden/i.test(why+' '+(e.message||''))?`YouTube API 키의 웹사이트 제한에 ${location.host}/* 가 없습니다.`:/keyInvalid|badRequest/i.test(why)?'YouTube API 키가 올바르지 않습니다.':'YouTube 오류: '+(why||e.message||r.status))}return j}
/* 유튜브 채널 주소(핸들 @한글 포함 · /channel · /user · /c · 영상 주소) → 채널 */
async function skYtChannel(url){const p=typeof parseChLink==='function'?parseChLink(url):null;let q=null;const yt=p&&p.yt;
  if(yt&&yt.id)q={id:yt.id};else if(yt&&yt.handle)q={forHandle:'@'+yt.handle};else if(yt&&yt.user)q={forUsername:yt.user};
  else{const s=String(url||'').trim();const v=(s.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/)||[])[1];
    if(v){const vj=await skYt('videos',{part:'snippet',id:v});const ch=((vj.items||[])[0]||{}).snippet;if(!ch)throw new Error('유튜브 영상을 찾지 못했습니다.');q={id:ch.channelId}}
    else if(/^@/.test(s))q={forHandle:s};else if(/^UC[\w-]{20,}$/.test(s))q={id:s};
    else if(yt&&yt.custom){const sj=await skYt('search',{part:'snippet',type:'channel',q:yt.custom,maxResults:'1'});const id=(((sj.items||[])[0]||{}).snippet||{}).channelId;if(!id)throw new Error('유튜브 채널을 찾지 못했습니다.');q={id}}}
  if(!q)throw new Error('유튜브 채널 주소를 확인해 주세요 (예: youtube.com/@핸들).');
  const cj=await skYt('channels',{part:'snippet,statistics,contentDetails',...q});const it=(cj.items||[])[0];if(!it)throw new Error('유튜브 채널을 찾지 못했습니다.');
  const st=it.statistics||{};return {id:it.id,name:it.snippet.title,img:((it.snippet.thumbnails||{}).default||{}).url||'',fol:st.hiddenSubscriberCount?null:+st.subscriberCount||0,views:+st.viewCount||0,videos:+st.videoCount||0,uploads:it.contentDetails.relatedPlaylists.uploads,url:'https://www.youtube.com/channel/'+it.id}}
async function skYtVods(ch,from,to,onlyLive){const ids=[];let pt='',older=false;
  for(let i=0;i<4&&!older;i++){const pj=await skYt('playlistItems',{part:'contentDetails',playlistId:ch.uploads,maxResults:'50',...(pt?{pageToken:pt}:{})});(pj.items||[]).forEach(x=>{const d=String(x.contentDetails.videoPublishedAt||'').slice(0,10);if(from&&d&&d<from){older=true;return}if(!to||!d||d<=to)ids.push(x.contentDetails.videoId)});pt=pj.nextPageToken||'';if(!pt)break}
  const out=[];const dur=s=>{const m=String(s||'').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);return m?Math.round(((+m[1]||0)*1440)+((+m[2]||0)*60)+(+m[3]||0)+((+m[4]||0)/60)):null};
  for(let i=0;i<ids.length;i+=50){const vj=await skYt('videos',{part:'snippet,statistics,contentDetails,liveStreamingDetails',id:ids.slice(i,i+50).join(',')});
    (vj.items||[]).forEach(v=>{const L=v.liveStreamingDetails||{};if(onlyLive&&!L.actualStartTime)return;const at=L.actualStartTime||v.snippet.publishedAt;const s=v.statistics||{};
      out.push({id:'yt:'+v.id,title:v.snippet.title||'',at,end:L.actualEndTime||'',views:has(s.viewCount)?+s.viewCount:null,vodViews:has(s.viewCount)?+s.viewCount:null,likes:has(s.likeCount)?+s.likeCount:null,chats:null,durMin:L.actualStartTime&&L.actualEndTime?Math.round((new Date(L.actualEndTime)-new Date(L.actualStartTime))/60000):dur(v.contentDetails.duration),url:'https://www.youtube.com/watch?v='+v.id,thumb:((v.snippet.thumbnails||{}).medium||{}).url||'',live:!!L.actualStartTime,nowLive:!!L.actualStartTime&&!L.actualEndTime,concurrent:has(L.concurrentViewers)?+L.concurrentViewers:null,tags:(v.snippet.tags||[]).slice(0,10)})})}
  return out}
/* 플랫폼 공통: 방송 목록 + 채널 요약 */
async function skVods(plat,url,from,to){const p=typeof parseChLink==='function'?parseChLink(url):null;
  if(plat==='유튜브'||(p&&p.ch==='유튜브')){const ch=await skYtChannel(url);return {ch:{plat:'유튜브',...ch},items:await skYtVods(ch,from,to,false)}}
  const k=plat==='치지직'||(p&&p.ch==='치지직')?'chzzk':'soop';if(DB.mode==='demo')return skDemo(k,url,from);
  const [v,c]=await Promise.all([aiFetch('/api/stream',{action:'vods',plat:k,ch:url,from,to}),aiFetch('/api/stream',{action:'channel',plat:k,ch:url}).catch(()=>({}))]);
  return {ch:{plat:SK_PLAT_L[k],...(c.channel||{}),live:c.live||null},items:v.items||[]}}
function skDemo(k,url,from){const d0=new Date((from||today())+'T19:00:00+09:00');const T=['저챗 + 게임','오늘은 신작 리뷰 방송!','[광고] 신작 게임 같이 해요','[PPL] 이벤트 진행중 🎁','합방 데이','새벽 수다방','[광고] 레이드 공략'];
  return {ch:{plat:SK_PLAT_L[k],name:'데모 채널',fol:52000+(url||'').length*31,subs:410,img:''},items:T.map((t,i)=>({id:k+':demo'+i,title:t,at:new Date(d0.getTime()+i*2*864e5).toISOString(),views:Math.round(3000+((i*7919)%9000)),vodViews:Math.round(200+((i*317)%900)),durMin:120+i*15,url:'',thumb:''}))}}

/* 스트리머(행) 방송 불러오기 → streams/air_{cid}_{rid} + 행 합계 */
const skAirDoc=(cid,rid)=>`streams/air_${cid}_${rid}`;
async function skFetchRow(cid,c,r,quiet){if(!r.chlink){if(!quiet)toast(`${r.name||'스트리머'}: 채널 URL을 먼저 넣어 주세요.`,'crit');return null}
  const key=cid+':'+r.id;if(A.sk.busy[key])return null;A.sk.busy[key]=true;scheduleRender();
  try{const {from,to}=skPeriod(c,r);const res=await skVods(r.ch,r.chlink,from,to);const prev=(A.sk.air[r.id]&&A.sk.air[r.id].airs)||((await DB.get(skAirDoc(cid,r.id)).catch(()=>null))||{}).airs||{};
    const airs={};res.items.slice(0,200).forEach(it=>{const k=String(it.id).replace(/[^A-Za-z0-9_]/g,'_');const p=prev[k]||{};
      airs[k]={id:it.id,title:it.title||'',at:it.at||'',end:it.end||'',views:it.views??null,vodViews:it.vodViews??null,durMin:it.durMin??null,url:it.url||'',tags:(it.tags||[]).slice(0,8),src:'auto',
        ...(has(p.softcon)?{softcon:p.softcon}:{}),...(has(p.peak)?{peak:p.peak}:has(it.concurrent)?{peak:it.concurrent}:{}),...(has(p.avg)?{avg:p.avg}:{}),...(has(p.chats)?{chats:p.chats}:{}),...(p.inc!=null?{inc:p.inc}:{})}});
    for(const k in prev)if(prev[k].src==='manual'||(!airs[k]&&(prev[k].inc===true||has(prev[k].softcon))))airs[k]=prev[k];
    const doc={type:'air',cid,rid:r.id,airs,fetchedAt:T_NOW(),ch:res.ch||{}};await DB.set(skAirDoc(cid,r.id),doc);A.sk.air[r.id]=doc;
    const ag=skAgg(c,airs);const up={};const b=`rows.${r.id}.`;['airN','views','peak','avgV','soft','stMins','chats'].forEach(f=>up[b+f]=ag[f]==null?DB.DEL:ag[f]);if(ag.up)up[b+'up']=ag.up;up[b+'upd']=today();
    if(res.ch&&has(res.ch.fol)&&res.ch.fol)up[b+'fol']=res.ch.fol;if(res.ch&&res.ch.id&&!r.acct)up[b+'acct']=res.ch.id;const p=parseChLink(r.chlink);if(!r.ch&&p&&STR_PLATS.includes(p.ch))up[b+'ch']=p.ch;
    if(ag.airN&&['컨택','일정협의','확정','방송대기'].includes(r.stage)&&ag.up&&ag.up<=today())up[b+'stage']='방송완료';
    await DB.update('rows/'+cid,up);if(!quiet)toast(`${r.name||'스트리머'} · 기간 내 방송 ${Object.keys(airs).length}개 중 광고 방송 ${ag.airN}개`);return ag}
  catch(e){toast(`${r.name||'스트리머'} 방송을 불러오지 못했습니다: ${e.message}`,'crit');return null}
  finally{delete A.sk.busy[key];scheduleRender()}}
function stFetchBtn(rows,cls){if(!canEdit())return '';const k=rows.filter(r=>r.name&&r.chlink&&!isOut(r.stage)).length;if(!k)return '';
  return `<button class="btn ${cls||''}" data-act="skFetchAll" title="채널 URL이 있는 스트리머 ${k}명의 캠페인(그룹) 기간 방송을 불러와 광고 방송을 매칭합니다">${A.sk.fetching?esc(A.sk.fetching):'방송 불러오기'}</button>`}

/* ============ 스트리머 관리: 행 상세의 방송 목록 ============ */
function stRowAirs(c,r,rid){const d=A.sk.air[rid];if(d===undefined){A.sk.air[rid]=null;DB.get(skAirDoc(A.cid,rid)).then(x=>{A.sk.air[rid]=x||{airs:{}};scheduleRender()}).catch(()=>{A.sk.air[rid]={airs:{}};scheduleRender()})}
  const ed=canEdit();const busy=A.sk.busy[A.cid+':'+rid];const airs=Object.entries((d&&d.airs)||{}).map(([k,a])=>({k,...a})).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));const only=A.sk.onlyHit!==false;const L=only?airs.filter(a=>skInc(c,a)):airs;
  const {from,to}=skPeriod(c,r);
  return `<section class="stack sk-airs" style="gap:8px"><div class="row" style="justify-content:space-between;gap:6px;flex-wrap:wrap"><b>방송 데이터</b><span class="small muted">${from?md(from)+' ~ '+md(to||from):'기간 미설정'} · 광고 방송 ${airs.filter(a=>skInc(c,a)).length} / 기간 내 ${airs.length}</span></div>
   <div class="row" style="gap:6px;flex-wrap:wrap">${ed?`<button class="btn sm primary" data-act="skFetchOne" data-r="${rid}" ${busy?'disabled':''}>${busy?'불러오는 중…':'방송 불러오기'}</button><button class="btn sm" data-act="skAirAdd" data-r="${rid}">+ 방송 직접 추가</button>`:''}<label class="row small" style="gap:4px"><input type="checkbox" data-act="skOnlyHit" ${only?'checked':''}> 광고 방송만</label>${skKeywords(c).length?`<span class="small muted">키워드: ${skKeywords(c).map(esc).join(', ')}</span>`:'<span class="small" style="color:var(--crit)">캠페인 설정에서 방송 제목 키워드를 넣어 주세요</span>'}</div>
   ${d===null?'<div class="small muted">불러오는 중…</div>':L.length?`<div class="tblwrap" style="max-height:420px"><table class="tbl sk-tbl"><thead><tr><th>포함</th><th>방송</th><th class="n">누적 시청</th><th class="n">최고</th><th class="n">평균</th><th class="n">채팅</th><th class="n">소프트콘</th><th></th></tr></thead><tbody>${L.map(a=>{const m=skMatch(c,a);const inc=skInc(c,a);const at=`data-ska="${rid}.${a.k}"`;const inp=(f,w)=>ed?`<input type="text" inputmode="decimal" ${at} data-f="${f}" value="${has(a[f])?a[f]:''}" placeholder="–" style="width:${w||52}px">`:has(a[f])?fmt(a[f]):'–';
      return `<tr class="${inc?'':'sk-off'}"><td><input type="checkbox" ${at} data-f="inc" ${inc?'checked':''} ${ed?'':'disabled'}></td><td><div class="sk-ttl">${a.src==='manual'&&ed?`<input type="text" ${at} data-f="title" value="${esc(a.title||'')}" placeholder="방송 제목">`:esc(a.title||'')}</div><div class="small muted">${a.at?kstT(a.at):''}${has(a.durMin)?' · '+fmtH(a.durMin):''}${m.title?` · <b style="color:var(--ok)">#${esc(m.kw)}</b>`:''}${a.inc===true&&!m.title&&!m.soft?' · 직접 포함':''}${a.url?` · <a href="${esc(a.url)}" target="_blank" rel="noopener">보기 ↗</a>`:''}</div></td>
       <td class="n">${a.src==='manual'?inp("views",70):has(a.views)?fmt(a.views):'–'}</td><td class="n">${inp('peak')}</td><td class="n">${inp('avg')}</td><td class="n">${inp('chats')}</td><td class="n">${inp('softcon')}</td><td>${a.src==='manual'&&ed?`<button class="btn sm ghost" data-act="skAirDel" data-r="${rid}" data-a="${a.k}">✕</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`:`<div class="small muted">${airs.length?'키워드·소프트콘으로 매칭된 방송이 없습니다. 「광고 방송만」을 끄고 직접 포함해 주세요.':'「방송 불러오기」로 캠페인 기간의 방송을 가져오세요.'}</div>`}
   <p class="small muted" style="margin:0">최고·평균 시청자·채팅·소프트콘은 플랫폼 다시보기에 남지 않아 방송별로 입력합니다 (스트리머 데이터에서 실시간 기록한 값이 있으면 그 값을 넣어 주세요).</p></section>`}
async function skSaveAir(rid,mut){const c=curC();if(!c||!canEdit())return;const d=A.sk.air[rid]||{airs:{}};d.airs=d.airs||{};mut(d.airs);d.type='air';d.cid=A.cid;d.rid=rid;
  try{await DB.set(skAirDoc(A.cid,rid),d);const ag=skAgg(c,d.airs);const up={};const b=`rows.${rid}.`;['airN','views','peak','avgV','soft','stMins','chats'].forEach(f=>up[b+f]=ag[f]==null?DB.DEL:ag[f]);if(ag.up)up[b+'up']=ag.up;await DB.update('rows/'+A.cid,up);scheduleSync(A.cid);render()}catch(e){saveErr(e)}}

/* ============ 캠페인 설정 · 개요 · 앱 다운로드 트래킹 ============ */
function stSettingsPanel(c,fld,tg){const o=c.st||{};const ed=canEdit();
  return `<section class="panel"><div class="panel-h"><div><h2>스트리머 광고 설정</h2><div class="sub">광고 유형과 방송 제목 키워드를 정합니다. 방송을 불러오면 제목·태그에 키워드가 있거나 소프트콘 기록이 있는 방송을 광고 방송으로 집계합니다.</div></div></div>
   <div class="fgrid"><div class="f"><span>광고 유형</span><div class="chips">${STR_TYPES.map(x=>`<span class="chip ${(o.type||'PPL')===x?'on':''}" ${ed?`data-act="skType" data-v="${x}"`:''}>${x}</span>`).join('')}</div><span class="hint">${(o.type||'PPL')==='PPL'?'방송 중 제품을 자연스럽게 노출·사용 (협찬 표기 필수)':'방송 제목·화면·멘트로 이벤트·할인·앱 설치를 알리는 홍보'}</span></div>
    ${fld('st.product','제품 · 게임 · 프로모션명',o.product)}
    <label class="f wide">방송 제목 키워드<input type="text" id="s_st_kw" data-skkw="1" value="${esc((o.keywords||[]).join(', '))}" placeholder="쉼표로 구분 · 예: 여리셀라, #광고, 신작명" ${ed?'':'disabled'}><span class="hint">비우면 브랜드명·제품명으로 찾습니다. 지금 기준: ${skKeywords(c).map(esc).join(', ')||'없음'}</span></label></div>
   <div style="margin-top:10px">${tg('metrics.clicks','프로모션 링크 클릭 입력',(c.metrics||{}).clicks,'방송 하단·채팅에 건 링크 클릭 수를 받는 경우')}${tg('metrics.conv','앱 설치 · 전환 입력',(c.metrics||{}).conv,'앱 다운로드 트래킹 연동 전에는 광고주 데이터로 직접 입력')}</div></section>`}
function stSumBlock(c,s,compact_){const b=n(c.targets&&c.targets.budget);const started=n(s.airN)>0;
  const items=[['광고비 (VAT 별도)',fmt(s.cost)+'원',`출연료 ${fmt(s.fee)}${n(s.fixedAd)?` · 고정 광고비 ${fmt(s.fixedAd)}`:''}${!compact_&&b?` · 예산 대비 ${pct(s.cost/b,0)}`:''}`],['방송 진행',`${s.uploaded||0}/${s.n||0}명`,`광고 방송 ${fmt(s.airN||0)}회 · 계약 ${s.contract}명`],
    ['누적 시청 · 조회',started?compact(s.views):'–',s.peak?`최고 시청자 ${fmt(s.peak)}`:'방송 불러오기 후 집계'],['CPV',started&&s.cpv!=null?fmt1(s.cpv)+'원':'–',`소프트콘 ${fmt(s.soft||0)}`]];
  return items}
function tabAppTrack(c){return `<section class="panel sk-soon"><div class="sk-soon-ic">📲</div><h2>앱 다운로드 트래킹</h2><p>스트리머별 전용 링크(원링크)로 앱 설치·실행을 나눠 집계하는 기능입니다.<br><b>추후 업데이트 예정</b>입니다. 그 전까지는 캠페인 설정의 「앱 설치 · 전환 입력」을 켜고 광고주 데이터로 직접 입력해 주세요.</p>
   <ul class="small muted" style="text-align:left;margin:6px auto 0;max-width:460px;line-height:1.7"><li>스트리머별 원링크(앱스토어 · 플레이스토어 자동 분기) 발급</li><li>MMP(Adjust · AppsFlyer 등) 연동 시 설치·첫 실행·구매까지 반영</li><li>광고주 리포트에 스트리머별 설치 수 · CPI 표시</li></ul></section>`}

/* ============ 성과 리포트 ============ */
function streamReport(c,live,calc,costLevel,showNames,showLinks,S){let i=0;const plats={};
  const rows=live.map(r=>{const k=calc.get(r);const o={rid:r.id,group:groupName(c,r.group),name:showNames?r.name:`스트리머 ${++i}`,chlink:showNames?(r.chlink||''):'',ch:r.ch||'',partner:r.partner||'',fol:has(r.fol)?n(r.fol):null,airN:n(r.airN),views:has(r.views)?n(r.views):null,peak:has(r.peak)?n(r.peak):null,avg:has(r.avgV)?n(r.avgV):null,soft:has(r.soft)?n(r.soft):null,mins:has(r.stMins)?n(r.stMins):null,chats:has(r.chats)?n(r.chats):null,up:r.up||'',clink:showLinks?(r.clink||''):'',stage:r.stage||''};
    if(costLevel==='row'){o.cost=k.cost;o.cpv=k.cpv}const p=plats[o.ch||'기타']||(plats[o.ch||'기타']={name:o.ch||'기타',n:0,airN:0,views:0,soft:0});p.n++;p.airN+=o.airN;p.views+=n(o.views);p.soft+=n(o.soft);return o}).sort((a,b)=>n(b.views)-n(a.views));
  const T={n:rows.length,on:rows.filter(r=>r.airN).length,airN:S(rows,r=>r.airN),views:S(rows,r=>r.views),soft:S(rows,r=>r.soft),mins:S(rows,r=>r.mins),chats:S(rows,r=>r.chats),peak:Math.max(0,...rows.map(r=>n(r.peak)))||null};
  const av=rows.filter(r=>r.avg!=null);T.avg=av.length?Math.round(av.reduce((t,r)=>t+r.avg,0)/av.length):null;
  if(costLevel!=='none'){const cost=S(live,r=>calc.get(r).cost)+n(c.fixedAd);T.cost=cost||null;T.cpv=T.views&&cost?cost/T.views:null;T.cps=T.soft&&cost?cost/T.soft:null}
  return {T,rows,byPlat:Object.values(plats).sort((a,b)=>b.views-a.views),type:(c.st||{}).type||'PPL',product:(c.st||{}).product||''}}
function streamKpis(STR,t,cp,won1,hasCost){const T=STR.T;return [[t('광고 방송','Sponsored Streams'),fmt(T.airN)+`<em style="font-style:normal;font-size:12px;opacity:.6;font-weight:500"> · ${t(`스트리머 ${T.on}명`,`${T.on} streamers`)}</em>`],[t('누적 시청·조회','Total Viewers/Views'),cp(T.views)],[t('최고 시청자','Peak Viewers'),T.peak?fmt(T.peak):'–'],hasCost?['CPV',won1(T.cpv)]:[t('소프트콘','Softcon'),fmt(T.soft)]]}
function streamSection(STR,o){const {t,cp,won,won1,lk,V,hasCost}=o;const T=STR.T;const mx=Math.max(1,...STR.rows.map(r=>n(r.views)));
  const tl=(l,v,s)=>`<div class="tile"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s||''}</span></div>`;
  return `<section><h3 class="rp-h2">${t('방송 성과','Streaming Performance')}</h3><p class="rp-desc">${t(`${esc(STR.type)}${STR.product?' · '+esc(STR.product):''} 광고가 들어간 방송 기준입니다.`,`Streams that carried the ${esc(STR.type)} placement.`)}</p>
   <div class="tiles">${tl(t('광고 방송','Sponsored Streams'),fmt(T.airN),t(`스트리머 ${T.on}/${T.n}명`,`${T.on}/${T.n} streamers`))}${tl(t('누적 시청·조회','Total Viewers/Views'),cp(T.views),T.airN?t(`방송당 ${cp(T.views/T.airN)}`,`${cp(T.views/T.airN)} per stream`):'')}${tl(t('최고 시청자','Peak Viewers'),T.peak?fmt(T.peak):'–',T.avg?t(`평균 시청자 ${fmt(T.avg)}`,`Avg. ${fmt(T.avg)}`):'')}${tl(t('방송 시간','Air Time'),T.mins?fmtH(T.mins):'–',T.chats?t(`채팅 ${cp(T.chats)}`,`${cp(T.chats)} chats`):'')}${tl(t('소프트콘','Softcon'),fmt(T.soft),T.cps?t(`소프트콘당 ${won(T.cps)}`,`${won(T.cps)} each`):'')}${hasCost?tl(t('광고비','Ad Spend'),won(T.cost),'CPV '+won1(T.cpv)):''}</div></section>
  <section class="rp-long"><h3 class="rp-h2">${t('스트리머별 결과','Results by Streamer')}</h3><p class="rp-desc">${t('누적 시청 많은 순입니다.','Sorted by total viewers.')}</p>
   <div class="mcards show-m">${STR.rows.map((r,i)=>`<div class="mcard"><div class="mh"><div class="grow"><div class="mt">${i+1}. ${lk(r.chlink,esc(V(r.name)))}</div><div class="ms">${esc([V(r.ch),V(r.group),r.partner].filter(Boolean).join(' · '))}</div></div></div><div class="mkv"><div><span>${t('방송','Streams')}</span><b>${fmt(r.airN)}</b></div><div><span>${t('누적 시청','Viewers')}</span><b>${r.views!=null?cp(r.views):'–'}</b></div><div><span>${t('최고','Peak')}</span><b>${r.peak!=null?fmt(r.peak):'–'}</b></div></div></div>`).join('')}</div>
   <div class="tblwrap hide-m"><table class="tbl"><thead><tr><th class="n">${t('순위','Rank')}</th><th>${t('스트리머','Streamer')}</th><th>${t('플랫폼','Platform')}</th><th class="n">${t('광고 방송','Streams')}</th><th class="n">${t('누적 시청·조회','Viewers/Views')}</th><th style="width:16%"></th><th class="n">${t('최고 시청자','Peak')}</th><th class="n">${t('평균 시청자','Avg.')}</th><th class="n">${t('방송 시간','Air time')}</th><th class="n">${t('소프트콘','Softcon')}</th>${hasCost?`<th class="n">${t('광고비','Spend')}</th><th class="n">CPV</th>`:''}</tr></thead><tbody>
    ${STR.rows.map((r,i)=>`<tr><td class="n">${i+1}</td><td class="nm"><b>${lk(r.chlink,esc(V(r.name)))}</b>${r.group?`<span>${esc(V(r.group))}</span>`:''}</td><td>${esc(V(r.ch))}</td><td class="n">${fmt(r.airN)}</td><td class="n">${r.views!=null?fmt(r.views):'–'}</td><td><div class="sk-bar"><i style="width:${Math.round(n(r.views)/mx*100)}%"></i></div></td><td class="n">${r.peak!=null?fmt(r.peak):'–'}</td><td class="n">${r.avg!=null?fmt(r.avg):'–'}</td><td class="n">${r.mins!=null?fmtH(r.mins):'–'}</td><td class="n">${r.soft!=null?fmt(r.soft):'–'}</td>${hasCost?`<td class="n">${r.cost!=null?fmt(r.cost):'–'}</td><td class="n">${r.cpv!=null?fmt1(r.cpv):'–'}</td>`:''}</tr>`).join('')||`<tr><td colspan="12" class="empty">${t('아직 방송 데이터가 없습니다.','No streams yet.')}</td></tr>`}</tbody>
    ${STR.rows.length?`<tfoot><tr><td></td><td colspan="2">${t(`합계 ${STR.rows.length}명`,`Total ${STR.rows.length}`)}</td><td class="n">${fmt(T.airN)}</td><td class="n">${fmt(T.views)}</td><td></td><td class="n">${T.peak?fmt(T.peak):'–'}</td><td class="n">${T.avg?fmt(T.avg):'–'}</td><td class="n">${T.mins?fmtH(T.mins):'–'}</td><td class="n">${fmt(T.soft)}</td>${hasCost?`<td class="n">${fmt(T.cost)}</td><td class="n">${T.cpv!=null?fmt1(T.cpv):'–'}</td>`:''}</tr></tfoot>`:''}</table></div>
   ${STR.byPlat.length>1?`<div class="sk-plats">${STR.byPlat.map(p=>`<div><b>${esc(V(p.name))}</b><span>${t(`스트리머 ${p.n}명 · 방송 ${p.airN}회`,`${p.n} streamers · ${p.airN} streams`)}</span><em>${cp(p.views)}</em></div>`).join('')}</div>`:''}</section>`}

/* ============ 캠페인 목록 (스트리머 광고) ============ */
function viewStreamCampList(all,list,cnt,q,allOn){skCss();skLegacy();
  const tot=list.reduce((t,[,c])=>{const s=c.summary||{};t.cost+=n(s.cost);t.views+=n(s.views);t.air+=n(s.airN);return t},{cost:0,views:0,air:0});
  return `<div class="row" style="margin-bottom:14px"><div class="chips">${[['','전체',all.length],...STATUS_LIST.map(s=>[s,s,cnt[s]])].map(([k,l,c])=>`<span class="chip ${A.statusF===k?'on':''}" data-act="statusF" data-k="${k}">${l} <em>${c}</em></span>`).join('')}</div><span class="grow"></span><span class="sub">광고 방송 ${fmt(tot.air)}회 · 누적 시청 ${compact(tot.views)} · 광고비 ${fmt(tot.cost)}원 (VAT 별도)</span><input type="search" data-ui="q" value="${esc(A.q)}" placeholder="캠페인·광고주 검색" style="max-width:220px"></div>
  ${A.csel.size?`<div class="panel row" style="padding:10px 14px;margin-bottom:12px"><b>${A.csel.size}개 캠페인 선택</b><span class="small muted">광고 그룹 · 스트리머 탭에서 선택한 캠페인만 볼 수 있습니다</span><span class="grow"></span><button class="btn sm primary" data-act="ltab" data-k="groups">광고 그룹 보기 →</button><button class="btn sm" data-act="ltab" data-k="ads">스트리머 보기 →</button><button class="btn sm ghost" data-act="cselClear">선택 해제</button></div>`:''}
  ${list.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th style="width:34px"><input type="checkbox" data-act="cselAll" aria-label="전체 선택" ${allOn?'checked':''}></th><th>캠페인</th><th>유형</th><th>상태</th><th>기간</th><th class="n">그룹</th><th style="min-width:150px">진행 단계</th><th class="n">스트리머</th><th class="n">광고 방송</th><th class="n">누적 시청</th><th class="n">최고 시청자</th><th class="n">소프트콘</th><th class="n">광고비</th><th class="n">CPV</th><th class="n">확인</th></tr></thead><tbody>
   ${list.map(([id,c])=>{const s=c.summary||{};const st=campStatus(c);const gs=groupsOf(c);return `<tr class="click ${A.csel.has(id)?'sel':''}" data-act="open" data-id="${id}"><td><input type="checkbox" data-act="csel" data-id="${id}" aria-label="선택" ${A.csel.has(id)?'checked':''}></td><td class="nm">${isEditing('c',id)?nameEdit('c',id,'',c.name||''):`<b>${nameEdit('c',id,'',c.name||'',esc(c.name||'이름 없음'))}</b>`}<span>${esc(c.advertiser||'')}${(c.st||{}).product?' · '+esc(c.st.product):''}</span></td>
    <td><span class="pill ${(c.st||{}).type==='프로모션'?'ok':'accent'}">${esc((c.st||{}).type||'PPL')}</span></td><td><span class="pill ${STATUS_CLS[st]||''}">${esc(st)}</span></td><td class="small" style="white-space:nowrap">${c.start?md(c.start)+' ~ '+md(c.end):'–'}</td><td class="n">${gs.length?`<a class="glink" href="#" data-act="showGroups" data-id="${id}">${gs.length}</a>`:'–'}</td>
    <td>${stageBar(s.stages||{},s.n||0,false)}</td><td class="n">${fmt(s.n||0)}</td><td class="n">${fmt(s.airN||0)}</td><td class="n">${compact(s.views||0)}</td><td class="n">${s.peak?fmt(s.peak):'–'}</td><td class="n">${fmt(s.soft||0)}</td><td class="n">${fmt(s.cost||0)}</td><td class="n">${fmt1(s.cpv)}</td><td class="n">${s.alerts?`<span class="pill crit">${s.alerts}</span>`:'<span class="muted">0</span>'}</td></tr>`}).join('')}</tbody></table></div>`
  :`<div class="panel empty">${all.length?'조건에 맞는 캠페인이 없습니다.':'아직 스트리머 광고가 없습니다. 「+ 새 스트리머 광고」로 캠페인 › 광고 그룹 › 스트리머 등록 순서로 만드세요.'}</div>`}`}

/* 이전 버전(v0.23)에서 만든 스트리머 광고를 캠페인으로 옮기기 (한 번) */
async function skLegacy(){if(skLegacy.done||!canEdit()||DB.mode==='demo')return;skLegacy.done=true;
  try{const unsub=DB.watchCol('streams',async m=>{unsub&&unsub();const olds=Object.entries(m).filter(([,d])=>d&&!d.type&&d.streamers&&!d.migrated);if(!olds.length)return;
      for(const [oid,o] of olds){const cid=uid();const c=newCampaignData('stream');Object.assign(c,{name:o.name||'스트리머 광고',advertiser:o.advertiser||'',brand:o.brand||'',start:o.start||'',end:o.end||'',st:{type:o.type||'PPL',keywords:o.keywords||[],product:o.product||''},fixedAd:o.fixedAd??null,targets:{budget:o.budget??null},createdAt:o.createdAt||today(),acct:TEAM,managed:''});
        const rows={};let ord=0;Object.entries(o.streamers||{}).forEach(([sk,s])=>{rows[sk]={order:++ord,createdAt:today(),name:s.name||'',ch:s.plat||'',chlink:s.url||'',acct:s.ch||'',fee:has(s.fee)?s.fee:null,stage:'확정',contract:'미완료',disc:'미완료'}});
        await DB.set('campaigns/'+cid,c);await DB.set('rows/'+cid,{rows});
        for(const [sk,s] of Object.entries(o.streamers||{})){const airs={};Object.entries(s.airs||{}).forEach(([k,a])=>{airs[k]={...a,softcon:a.softcon,peak:a.peak}});if(Object.keys(airs).length){await DB.set(`streams/air_${cid}_${sk}`,{type:'air',cid,rid:sk,airs,fetchedAt:T_NOW()});const ag=skAgg(c,airs);const up={};['airN','views','peak','avgV','soft','stMins','chats'].forEach(f=>{if(ag[f]!=null)up[`rows.${sk}.${f}`]=ag[f]});if(Object.keys(up).length)await DB.update('rows/'+cid,up)}}
        await DB.update('streams/'+oid,{migrated:cid});if(typeof syncNow==='function')syncNow(cid)}
      toast(`이전 스트리머 광고 ${olds.length}개를 새 캠페인 구조로 옮겼습니다.`)},()=>{})}catch(e){console.warn('legacy',e)}}

/* ============ 스트리머 풀 ============ */
function spWatch(){if(spWatch.on||!isTeam())return;spWatch.on=true;const load=()=>DB.query('streams','type','streamer').then(m=>{A.spool=m;A.spLoaded=true;spSeed();scheduleRender()}).catch(()=>{A.spLoaded=true;A.spErr=true;scheduleRender()});load();spWatch.reload=load}
async function spSeed(){if(spSeed.done||!canEdit())return;spSeed.done=true;const have=new Set(Object.values(A.spool||{}).map(s=>skNorm(s.name)));
  for(const r of SK_ROSTER){if(have.has(skNorm(r.name)))continue;const id='sp_'+uid().slice(0,10);const d={type:'streamer',name:r.name,partner:r.partner,tags:r.tags,memo:'',channels:{},camps:{},createdAt:T_NOW(),by:A.user.email};try{await DB.set('streams/'+id,d);A.spool[id]=d}catch(e){}}scheduleRender()}
const spArr=()=>Object.entries(A.spool||{}).map(([id,s])=>({id,...s}));
function spFol(s){return ['soop','chzzk','yt'].reduce((t,k)=>t+n(((s.channels||{})[k]||{}).fol),0)}
function viewSpool(){spWatch();skCss();const ed=canEdit();const q=skNorm(A.sk.spQ);const F=A.sk.spF;const all=spArr();const L=all.filter(s=>(!F||s.partner===F)&&(!q||skNorm([s.name,s.tags,...Object.values(s.channels||{}).map(c=>c.name||c.id)].join(' ')).includes(q))).sort((a,b)=>['링컴즈 소속','파트너','외부'].indexOf(a.partner)-['링컴즈 소속','파트너','외부'].indexOf(b.partner)||spFol(b)-spFol(a));
  const cnt=k=>all.filter(s=>s.partner===k).length;const ch=(s,k)=>{const c=(s.channels||{})[k];return c&&(c.url||c.id)?`<a class="sk-chip ${k}" href="${esc(c.url||'#')}" target="_blank" rel="noopener" title="${esc(c.name||'')}">${esc(SK_PLAT_L[k])}${c.fol?` <b>${compact(c.fol)}</b>`:''}</a>`:''};
  return `<div class="page-h"><div><div class="eyebrow">Streamer Pool</div><h1>스트리머 풀</h1><div class="sub">링컴즈 소속 · 파트너 · 외부 스트리머의 SOOP · 치지직 · 유튜브 채널과 팔로워, 캠페인 이력을 관리합니다. 스트리머 광고에 추가한 스트리머는 여기에 자동으로 쌓입니다.</div></div>${ed?'<button class="btn primary" data-act="spNew">+ 스트리머 등록</button>':''}</div>
  ${A.spErr?'<div class="banner">스트리머 풀을 불러오지 못했습니다. 권한을 확인해 주세요.</div>':''}
  ${A.sk.spEdit?spForm():''}
  <div class="tiles" style="margin-bottom:14px"><div class="tile"><span class="l">전체 스트리머</span><span class="v">${fmt(all.length)}</span><span class="s">소속 ${cnt('링컴즈 소속')} · 파트너 ${cnt('파트너')} · 외부 ${cnt('외부')}</span></div><div class="tile"><span class="l">합산 팔로워</span><span class="v">${compact(all.reduce((t,s)=>t+spFol(s),0))}</span><span class="s">SOOP · 치지직 · 유튜브</span></div><div class="tile"><span class="l">캠페인 참여</span><span class="v">${fmt(all.reduce((t,s)=>t+Object.keys(s.camps||{}).length,0))}</span><span class="s">스트리머 광고 기준</span></div></div>
  <div class="row" style="margin-bottom:12px;gap:8px"><div class="chips">${[['','전체',all.length],...STR_PARTNERS.map(k=>[k,k,cnt(k)])].map(([k,l,c])=>`<span class="chip ${F===k?'on':''}" data-act="spF" data-k="${esc(k)}">${l} <em>${c}</em></span>`).join('')}</div><input type="search" data-spq="1" value="${esc(A.sk.spQ)}" placeholder="이름 · 채널 · 태그 검색" style="max-width:240px"></div>
  ${!A.spLoaded?'<div class="panel empty">불러오는 중…</div>':!L.length?'<div class="panel empty">스트리머가 없습니다.</div>':`<div class="sp-grid">${L.map(s=>{const img=Object.values(s.channels||{}).map(c=>c.img).find(Boolean);const camps=Object.values(s.camps||{});
    return `<div class="sp-card"><div class="sp-h">${img?`<img src="${esc(img)}" alt="" referrerpolicy="no-referrer">`:`<span class="sp-av">${esc((s.name||'?').charAt(0))}</span>`}<div class="grow"><b>${esc(s.name||'')}</b><span class="small muted">${esc(s.tags||'')}</span></div><span class="pill ${s.partner==='링컴즈 소속'?'ok':s.partner==='파트너'?'accent':''}">${esc(s.partner||'미지정')}</span></div>
     <div class="sp-chs">${['soop','chzzk','yt'].map(k=>ch(s,k)).join('')||'<span class="small" style="color:var(--crit)">채널 URL을 넣어 주세요</span>'}</div>
     <div class="sp-st"><div><span>합산 팔로워</span><b>${spFol(s)?compact(spFol(s)):'–'}</b></div><div><span>캠페인</span><b>${camps.length}</b></div><div><span>광고 방송</span><b>${fmt(camps.reduce((t,x)=>t+n(x.airN),0))}</b></div></div>
     ${camps.length?`<div class="small muted sp-camps">${camps.slice(-3).reverse().map(x=>esc(x.campaign||'')).join(' · ')}</div>`:''}
     <div class="row" style="gap:6px;margin-top:auto">${ed?`<button class="btn sm" data-act="spEdit" data-id="${s.id}">수정</button><button class="btn sm" data-act="spFetch" data-id="${s.id}" ${A.sk.busy['sp'+s.id]?'disabled':''}>${A.sk.busy['sp'+s.id]?'불러오는 중…':'채널 정보 불러오기'}</button>`:''}<button class="btn sm primary" data-act="sdOpen" data-id="${s.id}">데이터 보기 →</button></div>
     ${s.fetchedAt?`<div class="small muted">채널 정보 ${fmtDT(s.fetchedAt)}</div>`:''}</div>`}).join('')}</div>`}`}
function spForm(){const e=A.sk.spEdit;const s=e.id?(A.spool||{})[e.id]||{}:e;const C=s.channels||{};
  return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><h2>${e.id?'스트리머 수정':'스트리머 등록'}</h2><button class="btn sm ghost" data-act="spX">닫기</button></div>
   <div class="fgrid"><label class="f">스트리머명<input type="text" id="sp-name" value="${esc(s.name||'')}"></label><label class="f">소속 구분<select id="sp-partner">${STR_PARTNERS.map(x=>`<option ${x===(s.partner||'외부')?'selected':''}>${x}</option>`).join('')}</select></label><label class="f">장르 · 태그<input type="text" id="sp-tags" value="${esc(s.tags||'')}" placeholder="예: 서브컬쳐 게임 · MMORPG"></label>
    <label class="f wide">SOOP 방송국 URL<input type="url" id="sp-soop" value="${esc((C.soop||{}).url||'')}" placeholder="https://www.sooplive.co.kr/station/아이디"></label>
    <label class="f wide">치지직 채널 URL<input type="url" id="sp-chzzk" value="${esc((C.chzzk||{}).url||'')}" placeholder="https://chzzk.naver.com/32자리 채널 ID"></label>
    <label class="f wide">유튜브 채널 URL<input type="url" id="sp-yt" value="${esc((C.yt||{}).url||'')}" placeholder="https://www.youtube.com/@핸들"></label>
    <label class="f wide">메모<input type="text" id="sp-memo" value="${esc(s.memo||'')}" placeholder="연락처 · 단가 · 특이사항"></label></div>
   <div class="row" style="justify-content:flex-end;gap:8px;margin-top:12px">${e.id?`<button class="btn danger" data-act="spDel" data-id="${e.id}">${A.confirm==='spDel'?'한 번 더 누르면 삭제':'삭제'}</button><span class="grow"></span>`:''}<button class="btn" data-act="spX">취소</button><button class="btn primary" data-act="spSave">저장하고 채널 정보 불러오기</button></div></section>`}
/* 채널 URL → 채널 정보 (팔로워 · 구독 · 프로필) */
async function skChannel(k,url){if(k==='yt'){const c=await skYtChannel(url);return {id:c.id,name:c.name,img:c.img,fol:c.fol,views:c.views,videos:c.videos,url:c.url,at:T_NOW()}}
  if(DB.mode==='demo')return {id:'demo',name:'데모 채널',fol:50000+url.length*13,subs:300,img:'',url,at:T_NOW()};const j=await aiFetch('/api/stream',{action:'channel',plat:k,ch:url});return {...(j.channel||{}),url,at:T_NOW(),...(j.live?{live:j.live}:{})}}
async function spFetch(id){const s=(A.spool||{})[id];if(!s)return;A.sk.busy['sp'+id]=true;scheduleRender();const C={...(s.channels||{})};const errs=[];
  for(const k of ['soop','chzzk','yt']){const u=(C[k]||{}).url;if(!u)continue;try{C[k]={...C[k],...(await skChannel(k,u)),url:u}}catch(e){errs.push(SK_PLAT_L[k]+': '+e.message)}}
  try{await DB.update('streams/'+id,{channels:C,fetchedAt:T_NOW()});s.channels=C;s.fetchedAt=T_NOW();toast(errs.length?'일부 채널을 불러오지 못했습니다 · '+errs[0]:`${s.name} 채널 정보를 불러왔습니다.`,errs.length?'crit':undefined)}catch(e){saveErr(e)}
  delete A.sk.busy['sp'+id];scheduleRender()}
/* 스트리머 광고 행 → 스트리머 풀 자동 누적 */
async function spSyncCampaign(cid,c,rows){if(!canEdit())return;if(!A.spLoaded){try{A.spool=await DB.query('streams','type','streamer');A.spLoaded=true}catch(e){return}}
  const key=s=>skNorm(s);const byCh=new Map(),byName=new Map();spArr().forEach(s=>{Object.entries(s.channels||{}).forEach(([k,ch])=>{if(ch.id)byCh.set(k+':'+String(ch.id).toLowerCase(),s.id);if(ch.url)byCh.set('u:'+String(ch.url).toLowerCase().replace(/\/$/,''),s.id)});byName.set(key(s.name),s.id)});
  for(const r of rows.filter(r=>r.name&&!isOut(r.stage))){const k=SK_PLAT[r.ch]||((parseChLink(r.chlink)||{}).kind)||'';const acct=String(r.acct||((parseChLink(r.chlink)||{}).acct)||'').toLowerCase();
    let id=(k&&acct&&byCh.get(k+':'+acct))||(r.chlink&&byCh.get('u:'+String(r.chlink).toLowerCase().replace(/\/$/,'')))||byName.get(key(r.name));
    const ent={campaign:(c.name||'')+(r.group&&c.groups&&c.groups[r.group]?' · '+c.groups[r.group].name:''),advertiser:c.advertiser||'',stage:r.stage||'',airN:n(r.airN),views:n(r.views),fee:has(r.fee)?n(r.fee):null,at:today()};
    const ek=`${cid}__${r.id}`;
    try{if(!id){id='sp_'+uid().slice(0,10);const d={type:'streamer',name:r.name,partner:STR_PARTNERS.includes(r.partner)?r.partner:((SK_ROSTER.find(x=>skNorm(x.name)===key(r.name))||{}).partner||'외부'),tags:(SK_ROSTER.find(x=>skNorm(x.name)===key(r.name))||{}).tags||'',memo:'',channels:k&&r.chlink?{[k]:{url:r.chlink,id:acct||'',fol:has(r.fol)?n(r.fol):null}}:{},camps:{[ek]:ent},createdAt:T_NOW(),by:A.user.email,auto:true};await DB.set('streams/'+id,d);A.spool[id]=d;byName.set(key(r.name),id)}
      else{const s=A.spool[id];const prev=(s.camps||{})[ek];if(JSON.stringify(prev)!==JSON.stringify(ent)){const up={[`camps.${ek}`]:ent};if(k&&r.chlink&&!((s.channels||{})[k]||{}).url)up[`channels.${k}`]={url:r.chlink,id:acct||'',fol:has(r.fol)?n(r.fol):null};await DB.update('streams/'+id,up);s.camps={...(s.camps||{}),[ek]:ent}}}}catch(e){console.warn('spSync',e)}}}

/* 캠페인 만들기 3단계: 스트리머 풀에서 불러오기 */
function stWizardPick(rows){spWatch();const have=new Set(rows.map(([,r])=>skNorm(r.name)));const q=skNorm(A.wpq||'');const L=spArr().filter(s=>!q||skNorm([s.name,s.tags].join(' ')).includes(q));
  return `<section class="panel"><div class="panel-h"><div><h2>스트리머 풀에서 불러오기</h2><div class="sub">고른 스트리머의 채널마다 한 줄씩 추가됩니다 · 풀 ${L.length}명</div></div><div class="row"><button class="btn sm" data-act="wpickToggle">닫기</button></div></div>
   <div class="row" style="margin-bottom:10px"><input type="text" data-ui="wpq" value="${esc(A.wpq||'')}" placeholder="이름 · 태그 검색" style="max-width:260px"><span class="grow"></span><button class="btn sm primary" data-act="spPickAdd">${A.wsel&&A.wsel.size?`선택한 ${A.wsel.size}명 추가`:'선택 추가'}</button></div>
   <div class="tblwrap" style="max-height:360px"><table class="tbl"><thead><tr><th></th><th>스트리머</th><th>소속</th><th>채널</th><th class="n">합산 팔로워</th></tr></thead><tbody>${L.map(s=>{const on=have.has(skNorm(s.name));return `<tr><td><input type="checkbox" data-act="wsel" data-p="${esc(s.id)}" ${on?'checked disabled':A.wsel&&A.wsel.has(s.id)?'checked':''}></td><td class="nm"><b>${esc(s.name)}</b><span>${esc(s.tags||'')}</span></td><td>${esc(s.partner||'')}</td><td>${['soop','chzzk','yt'].filter(k=>((s.channels||{})[k]||{}).url).map(k=>skP(SK_PLAT_L[k])).join(' ')||'<span class="small muted">채널 없음</span>'}</td><td class="n">${spFol(s)?compact(spFol(s)):'–'}</td></tr>`}).join('')||'<tr><td colspan="5" class="empty">스트리머 풀이 비어 있습니다.</td></tr>'}</tbody></table></div></section>`}

/* ============ 스트리머 데이터 (대시보드) ============ */
function viewSdata(){spWatch();skCss();const ed=canEdit();const all=spArr().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));const sel=A.sk.sdSel&&A.spool&&A.spool[A.sk.sdSel]?A.sk.sdSel:(all[0]||{}).id;const s=sel?A.spool[sel]:null;
  if(sel&&A.sk.sdFor!==sel){A.sk.sdFor=sel;A.sk.sd=undefined;DB.get('streams/sd_'+sel.slice(3)).then(d=>{A.sk.sd=d||null;scheduleRender()}).catch(()=>{A.sk.sd=null;scheduleRender()})}
  const D=A.sk.sd;const plat=A.sk.sdPlat||'all';
  const head=`<div class="page-h"><div><div class="eyebrow">Streamer Data</div><h1>스트리머 데이터</h1><div class="sub">스트리머 풀에 등록한 채널의 방송 기록을 불러와 방송별 시청·시간·팔로워 변화를 봅니다. 불러오기는 「데이터 불러오기」를 누를 때만 진행합니다.</div></div></div>
   <div class="row sd-pick" style="gap:8px;margin-bottom:12px"><select data-sdsel="1" style="max-width:260px">${all.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.name)} · ${esc(x.partner||'')}</option>`).join('')}</select>${s?['soop','chzzk','yt'].filter(k=>((s.channels||{})[k]||{}).url).map(k=>`<a class="sk-chip ${k}" href="${esc(s.channels[k].url)}" target="_blank" rel="noopener">${SK_PLAT_L[k]} ↗</a>`).join(''):''}<span class="grow"></span>
    <label class="small muted">기간<select data-sddays="1" style="width:auto;margin-left:6px">${[[30,'최근 30일'],[60,'최근 60일'],[90,'최근 90일']].map(([v,l])=>`<option value="${v}" ${(A.sk.sdDays||30)===v?'selected':''}>${l}</option>`).join('')}</select></label>
    ${ed&&s?`<button class="btn primary" data-act="sdFetch" ${A.sk.busy.sd?'disabled':''}>${A.sk.busy.sd?esc(A.sk.busy.sd):'데이터 불러오기'}</button>`:''}${s?`<button class="btn sm ${A.sk.rec?'danger':''}" data-act="sdRec" title="이 화면을 열어 둔 동안 6분마다 라이브 시청자를 기록합니다 (방송 중일 때만)">${A.sk.rec?'● 실시간 기록 중 · 끄기':'실시간 기록'}</button>`:''}</div>`;
  if(!all.length)return head+'<div class="panel empty">스트리머 풀에 먼저 스트리머를 등록해 주세요.</div>';
  if(!s)return head;const chs=['soop','chzzk','yt'].filter(k=>((s.channels||{})[k]||{}).url);
  if(!chs.length)return head+`<div class="panel empty">${esc(s.name)}의 채널 URL이 없습니다. 스트리머 풀에서 「수정」으로 SOOP · 치지직 · 유튜브 주소를 넣어 주세요.</div>`;
  if(D===undefined)return head+'<div class="panel empty">불러오는 중…</div>';
  if(!D||!(D.bcs||[]).length)return head+`<div class="panel empty">아직 불러온 데이터가 없습니다. 「데이터 불러오기」를 눌러 주세요.</div>`;
  const bcs=(D.bcs||[]).filter(b=>plat==='all'||b.plat===plat).sort((a,b)=>String(b.start).localeCompare(String(a.start)));
  const P=D.profile||{};const tot=bcs.reduce((t,b)=>{t.mins+=n(b.durMin);t.views+=n(b.views);t.peak=Math.max(t.peak,n(b.peak));if(has(b.avg)){t.avgS+=n(b.avg);t.avgN++}t.chats+=n(b.chats);return t},{mins:0,views:0,peak:0,avgS:0,avgN:0,chats:0});
  const fh=D.folHist||[];const folNow=['soop','chzzk','yt'].reduce((t,k)=>t+n((P[k]||{}).fol),0);const fol0=fh.length>1?['soop','chzzk','yt'].reduce((t,k)=>t+n((fh[0]||{})[k]),0):null;
  const live=Object.entries(P).map(([k,p])=>p&&p.live?{k,...p.live}:null).filter(Boolean)[0];
  const bc=A.sk.sdBc&&bcs.find(b=>b.id===A.sk.sdBc);
  return head+`<div class="sd-prof">${['soop','chzzk','yt'].filter(k=>P[k]).map(k=>{const p=P[k];return `<div class="sd-pc"><div class="row" style="gap:8px">${p.img?`<img src="${esc(p.img)}" alt="" referrerpolicy="no-referrer">`:''}<div><div class="small muted">${SK_PLAT_L[k]}</div><b>${esc(p.name||'')}</b></div></div><div class="sd-pk"><div><span>${k==='yt'?'구독자':'팔로워'}</span><b>${p.fol!=null?compact(p.fol):'–'}</b></div>${p.subs!=null?`<div><span>구독(유료)</span><b>${fmt(p.subs)}</b></div>`:''}${p.views!=null?`<div><span>누적 조회</span><b>${compact(p.views)}</b></div>`:''}${p.live?`<div><span>지금</span><b class="sd-live">LIVE ${p.live.viewers!=null?fmt(p.live.viewers):''}</b></div>`:''}</div></div>`}).join('')}</div>
   ${live?`<div class="banner info" style="margin:0 0 12px"><b>● 방송 중</b> ${esc(live.title||'')} · 시청자 ${live.viewers!=null?fmt(live.viewers):'–'}${A.sk.rec?' · 6분마다 기록 중':' · 「실시간 기록」을 켜면 이 방송의 시청자 그래프가 쌓입니다'}</div>`:''}
   <div class="tiles" style="margin-bottom:12px">${tile('방송 수',fmt(bcs.length),`최근 ${A.sk.sdDays||30}일 · ${plat==='all'?'전체 플랫폼':SK_PLAT_L[plat]}`)}${tile('총 방송 시간',fmtH(tot.mins),bcs.length?'방송당 '+fmtH(tot.mins/bcs.length):'')}${tile('누적 시청 · 조회',compact(tot.views),bcs.length?'방송당 '+compact(tot.views/bcs.length):'')}${tile('최고 시청자',tot.peak?fmt(tot.peak):'–',tot.avgN?'평균 시청자 '+fmt(tot.avgS/tot.avgN):'실시간 기록·입력 값 기준')}${tile('팔로워',folNow?compact(folNow):'–',fol0!=null?`${folNow-fol0>=0?'+':''}${fmt(folNow-fol0)} (기록 시작 이후)`:'불러올 때마다 기록')}</div>
   <div class="chips" style="margin-bottom:10px">${[['all','전체'],...chs.map(k=>[k,SK_PLAT_L[k]])].map(([k,l])=>`<span class="chip ${plat===k?'on':''}" data-act="sdPlat" data-k="${k}">${l}</span>`).join('')}<span class="small muted" style="margin-left:6px">${fmtDT(D.fetchedAt)} 불러옴</span></div>
   <div class="sd-charts"><section class="panel"><div class="panel-h"><div><h2>방송별 누적 시청</h2><div class="sub">막대를 누르면 그 방송을 자세히 봅니다</div></div></div>${sdBar(bcs.slice(0,40).reverse())}</section>
    <section class="panel"><div class="panel-h"><div><h2>팔로워 추이</h2><div class="sub">데이터를 불러올 때마다 기록한 값</div></div></div>${sdFolLine(fh)}</section></div>
   ${bc?sdDetail(bc,D):''}
   <section class="panel"><div class="panel-h"><div><h2>방송 기록</h2><div class="sub">${bcs.length}개 · 방송 제목 · 기간 · 방송 시간 · 최고/평균 시청자 · 채팅 · 팔로워 증감</div></div></div>
    <div class="tblwrap"><table class="tbl sd-tbl"><thead><tr><th>플랫폼</th><th>방송 제목</th><th>기간</th><th class="n">방송 시간</th><th class="n">최고 시청자</th><th class="n">평균 시청자</th><th class="n">누적 시청</th><th class="n">채팅</th><th class="n">팔로워 증감</th></tr></thead><tbody>
    ${bcs.map(b=>`<tr class="click ${A.sk.sdBc===b.id?'sel':''}" data-act="sdBc" data-id="${esc(b.id)}"><td>${skP(SK_PLAT_L[b.plat])}</td><td><b class="sd-ttl">${esc(b.title||'')}</b></td><td class="small" style="white-space:nowrap">${kstT(b.start)}${b.end?' ~ '+kstT(b.end).slice(6):''}</td><td class="n">${fmtH(b.durMin)}</td><td class="n">${b.peak!=null?fmt(b.peak):'–'}</td><td class="n">${b.avg!=null?fmt(b.avg):'–'}</td><td class="n">${b.views!=null?fmt(b.views):'–'}</td><td class="n">${b.chats!=null?fmt(b.chats):'–'}</td><td class="n">${b.folDelta!=null?`<span style="color:${b.folDelta>=0?'var(--ok)':'var(--crit)'}">${b.folDelta>=0?'+':''}${fmt(b.folDelta)}</span>`:'–'}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">누적 시청·방송 시간은 플랫폼 다시보기 기준입니다. 최고·평균 시청자와 시청자 그래프는 「실시간 기록」으로 쌓은 값이나 방송 상세에서 직접 넣은 값으로 계산합니다. 채팅 수는 방송 상세에서 입력합니다.</p></section>`}
/* 막대 그래프 (방송별 누적 시청) */
function sdBar(L){if(!L.length)return '<div class="empty small">방송이 없습니다.</div>';const W=720,H=200,pad=44,bw=Math.max(4,(W-pad*2)/L.length-3);const mx=Math.max(1,...L.map(b=>n(b.views)));
  return `<svg class="sd-svg" viewBox="0 0 ${W} ${H+24}" role="img" aria-label="방송별 누적 시청">${[0,.5,1].map(f=>`<line x1="${pad}" x2="${W-pad}" y1="${H-f*(H-20)}" y2="${H-f*(H-20)}" class="gl"/><text x="${pad-4}" y="${H-f*(H-20)+3}" text-anchor="end" class="ax">${compact(mx*f)}</text>`).join('')}
   ${L.map((b,i)=>{const x=pad+i*((W-pad*2)/L.length)+1.5;const h=Math.max(1,n(b.views)/mx*(H-20));return `<g data-act="sdBc" data-id="${esc(b.id)}" class="bar ${A.sk.sdBc===b.id?'on':''}"><rect x="${x}" y="${H-h}" width="${bw}" height="${h}" rx="2"><title>${esc(b.title||'')} · ${kstT(b.start)} · ${fmt(b.views)}</title></rect></g>`}).join('')}
   <text x="${pad}" y="${H+16}" class="ax">${kstT(L[0].start).slice(0,5)}</text><text x="${W-pad}" y="${H+16}" text-anchor="end" class="ax">${kstT(L[L.length-1].start).slice(0,5)}</text></svg>`}
function sdFolLine(fh){if(fh.length<2)return '<div class="empty small">두 번 이상 불러오면 팔로워 변화가 그려집니다.</div>';const W=720,H=200,pad=34;const v=fh.map(x=>['soop','chzzk','yt'].reduce((t,k)=>t+n(x[k]),0));const mn=Math.min(...v),mx=Math.max(...v),rg=Math.max(1,mx-mn);
  const pts=v.map((y,i)=>[pad+i*(W-pad*2)/(v.length-1),H-10-(y-mn)/rg*(H-30)]);
  return `<svg class="sd-svg" viewBox="0 0 ${W} ${H+24}" role="img" aria-label="팔로워 추이"><polyline class="ln" points="${pts.map(p=>p.join(',')).join(' ')}"/>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" class="pt"><title>${kstT(fh[i].at)} · ${fmt(v[i])}</title></circle>`).join('')}<text x="${pad-4}" y="${H-10}" text-anchor="end" class="ax">${compact(mn)}</text><text x="${pad-4}" y="${20}" text-anchor="end" class="ax">${compact(mx)}</text><text x="${pad}" y="${H+16}" class="ax">${kstT(fh[0].at).slice(0,5)}</text><text x="${W-pad}" y="${H+16}" text-anchor="end" class="ax">${kstT(fh[fh.length-1].at).slice(0,5)}</text></svg>`}
/* 방송 상세: 시청자 그래프 + 요약 표 */
function sdDetail(b,D){const S=b.samples||[];const ed=canEdit();const W=720,H=220,pad=40;
  let g='';if(S.length>=2){const t0=S[0][0],t1=S[S.length-1][0];const mx=Math.max(1,...S.map(x=>x[1]));const X=t=>pad+(t-t0)/Math.max(1,t1-t0)*(W-pad*2),Y=v=>H-10-v/mx*(H-30);const avg=S.reduce((t,x)=>t+x[1],0)/S.length;
    g=`<svg class="sd-svg" viewBox="0 0 ${W} ${H+24}" role="img" aria-label="방송 시청자 그래프"><polygon class="ar" points="${X(t0)},${H-10} ${S.map(x=>X(x[0])+','+Y(x[1])).join(' ')} ${X(t1)},${H-10}"/><polyline class="ln" points="${S.map(x=>X(x[0])+','+Y(x[1])).join(' ')}"/><line class="avg" x1="${pad}" x2="${W-pad}" y1="${Y(avg)}" y2="${Y(avg)}"/><text x="${pad+4}" y="${Y(avg)-4}" class="ax">평균 ${fmt(avg)}명</text><text x="${pad-4}" y="${Y(mx)+3}" text-anchor="end" class="ax">${compact(mx)}</text><text x="${pad}" y="${H+16}" class="ax">${kstT(new Date(t0).toISOString()).slice(6)}</text><text x="${W-pad}" y="${H+16}" text-anchor="end" class="ax">${kstT(new Date(t1).toISOString()).slice(6)}</text></svg>`}
  else g=`<div class="empty small">이 방송은 실시간 기록이 없어 시청자 그래프를 그릴 수 없습니다. 방송 중에 「실시간 기록」을 켜 두면 6분마다 시청자가 쌓여 그래프가 그려집니다.</div>`;
  const at=f=>ed?`<input type="text" inputmode="decimal" data-sdbc="${esc(b.id)}" data-f="${f}" value="${has(b[f])?b[f]:''}" placeholder="입력" style="width:110px;text-align:right">`:has(b[f])?fmt(b[f]):'–';
  const vs=b.avg&&b.durMin?Math.round(b.avg*b.durMin/60):null;
  return `<section class="panel sd-det"><div class="panel-h"><div><h2>${esc(b.title||'방송')}</h2><div class="sub">${SK_PLAT_L[b.plat]} · ${kstT(b.start)}${b.url?` · <a href="${esc(b.url)}" target="_blank" rel="noopener">다시보기 ↗</a>`:''}</div></div><button class="btn sm ghost" data-act="sdBc" data-id="">닫기</button></div>
   <div class="sd-dg"><div><div class="small bold" style="margin-bottom:6px">방송 데이터 그래프</div>${g}</div>
    <table class="tbl sd-sum"><tbody><tr><th>총 방송 시간</th><td>${fmtH(b.durMin)}</td></tr><tr><th>시작</th><td>${kstT(b.start)}</td></tr><tr><th>마지막</th><td>${b.end?kstT(b.end):'–'}</td></tr><tr><th>최고 시청자</th><td>${at('peak')}</td></tr><tr><th>평균 시청자</th><td>${at('avg')}</td></tr><tr><th>뷰어십 (평균 × 방송 시간)</th><td>${vs!=null?fmt(vs)+'명':'–'}</td></tr><tr><th>누적 시청 · 조회</th><td>${b.views!=null?fmt(b.views):'–'}</td></tr><tr><th>VOD 조회</th><td>${b.vodViews!=null?fmt(b.vodViews):'–'}</td></tr><tr><th>채팅 수</th><td>${at('chats')}</td></tr><tr><th>팔로워 증감</th><td>${b.folDelta!=null?(b.folDelta>=0?'+':'')+fmt(b.folDelta):'–'}</td></tr><tr><th>기록 표본</th><td>${S.length?S.length+'개 (6분 간격)':'없음'}</td></tr></tbody></table></div></section>`}
async function sdFetch(){const id=A.sk.sdSel||(spArr()[0]||{}).id;const s=(A.spool||{})[id];if(!s)return;const days=A.sk.sdDays||30;const from=new Date(Date.now()-days*864e5+9*3600e3).toISOString().slice(0,10);
  const prev=A.sk.sd||{};const old=new Map((prev.bcs||[]).map(b=>[b.id,b]));const profile={...(prev.profile||{})};const bcs=[];const errs=[];
  for(const k of ['soop','chzzk','yt']){const u=((s.channels||{})[k]||{}).url;if(!u)continue;A.sk.busy.sd=`${SK_PLAT_L[k]} 불러오는 중…`;scheduleRender();
    try{let ch,items;if(k==='yt'){const c=await skYtChannel(u);ch={id:c.id,name:c.name,img:c.img,fol:c.fol,views:c.views};items=await skYtVods(c,from,'',true);const lv=items.find(x=>x.nowLive);if(lv)ch.live={title:lv.title,viewers:lv.concurrent,id:lv.id}}
      else{const r=await skVods(SK_PLAT_L[k],u,from,'');ch=r.ch||{};items=r.items}
      profile[k]={...(profile[k]||{}),...ch,at:T_NOW()};
      items.forEach(it=>{const o=old.get(it.id)||{};bcs.push({id:it.id,plat:k,title:it.title,start:it.at,end:it.end||(it.durMin?new Date(new Date(it.at).getTime()+it.durMin*60000).toISOString():''),durMin:it.durMin??null,views:it.views??null,vodViews:it.vodViews??null,url:it.url||'',peak:o.peak??(has(it.concurrent)?it.concurrent:null),avg:o.avg??null,chats:o.chats??null,samples:o.samples||[],folDelta:o.folDelta??null});old.delete(it.id)})}
    catch(e){errs.push(SK_PLAT_L[k]+': '+e.message)}}
  old.forEach(b=>{if(b.samples&&b.samples.length)bcs.push(b)});
  const now={at:T_NOW(),...Object.fromEntries(['soop','chzzk','yt'].map(k=>[k,profile[k]&&has(profile[k].fol)?profile[k].fol:null]))};const fh=[...(prev.folHist||[]),now].slice(-120);
  bcs.forEach(b=>{if(b.folDelta!=null||!b.start)return;const before=[...fh].reverse().find(x=>x.at<=b.start),after=fh.find(x=>b.end&&x.at>=b.end);if(before&&after&&before[b.plat]!=null&&after[b.plat]!=null)b.folDelta=after[b.plat]-before[b.plat]});
  const doc={type:'sdata',spId:id,fetchedAt:T_NOW(),profile,folHist:fh,bcs:bcs.sort((a,b)=>String(b.start).localeCompare(String(a.start))).slice(0,300)};
  try{await DB.set('streams/sd_'+id.slice(3),doc);A.sk.sd=doc;const up={channels:{...(s.channels||{})},fetchedAt:T_NOW()};['soop','chzzk','yt'].forEach(k=>{if(profile[k]&&up.channels[k])up.channels[k]={...up.channels[k],fol:profile[k].fol??up.channels[k].fol,name:profile[k].name||up.channels[k].name,img:profile[k].img||up.channels[k].img,id:profile[k].id||up.channels[k].id}});await DB.update('streams/'+id,up);Object.assign(s,up)}
  catch(e){saveErr(e)}
  delete A.sk.busy.sd;toast(errs.length?'일부 채널을 불러오지 못했습니다 · '+errs[0]:`${s.name} 방송 ${bcs.length}개를 불러왔습니다.`,errs.length?'crit':undefined);scheduleRender()}
/* 실시간 기록: 화면을 열어 둔 동안 6분마다 라이브 시청자 표본 추가 */
async function sdTick(){if(!A.sk.rec||A.view!=='sdata')return;const id=A.sk.sdSel||(spArr()[0]||{}).id;const s=(A.spool||{})[id];const D=A.sk.sd;if(!s||!D)return;let changed=false;
  for(const k of ['soop','chzzk']){const u=((s.channels||{})[k]||{}).url;if(!u||DB.mode==='demo')continue;try{const j=await aiFetch('/api/stream',{action:'channel',plat:k,ch:u});const lv=j.live;D.profile=D.profile||{};D.profile[k]={...(D.profile[k]||{}),...(j.channel||{}),live:lv||null};
    if(lv&&lv.viewers!=null){const bid=k+':live_'+(lv.id||String(lv.start||'').slice(0,13));let b=(D.bcs||[]).find(x=>x.id===bid);if(!b){b={id:bid,plat:k,title:lv.title||'',start:lv.start||T_NOW(),end:'',durMin:null,views:null,vodViews:null,url:u,peak:null,avg:null,chats:null,samples:[],folDelta:null,live:true};D.bcs=[b,...(D.bcs||[])]}
      b.samples=[...(b.samples||[]),[Date.now(),lv.viewers]].slice(-400);b.peak=Math.max(n(b.peak),lv.viewers);b.avg=Math.round(b.samples.reduce((t,x)=>t+x[1],0)/b.samples.length);b.title=lv.title||b.title;b.durMin=Math.round((Date.now()-new Date(b.start).getTime())/60000);changed=true}}catch(e){}}
  if(changed){try{await DB.set('streams/sd_'+id.slice(3),D)}catch(e){}scheduleRender()}}
setInterval(()=>{sdTick()},6*60*1000);


/* 연동 관리 표시 */
function stIntRows(row){if(!canEdit())return '';if(!A.stInt&&!A.stIntBusy)setTimeout(()=>stIntCheck(),0);const s=A.stInt||{};
  const pill=x=>A.stIntBusy&&!A.stInt?'<span class="pill">확인 중…</span>':DB.mode==='demo'?'<span class="pill ok">데모</span>':x&&x.ok?'<span class="pill ok">연결됨 · 키 불필요</span>':x?'<span class="pill warn">응답 없음</span>':'<span class="pill">–</span>';
  return row('SOOP 방송 데이터',pill(s.soop),'스트리머 광고·스트리머 풀·스트리머 데이터: 방송국 정보(애청자·구독·누적 시청), 다시보기 목록(제목·방송일·누적 시청·방송 시간), 방송 중 시청자 (실시간 기록)','공개 데이터 (설정 없음) · 공식 Open API 키를 받으면 Netlify 환경변수 <code>SOOP_CLIENT_ID</code>')
    +row('치지직 방송 데이터',pill(s.chzzk),'스트리머 광고·스트리머 풀·스트리머 데이터: 채널 팔로워, 다시보기 목록(제목·방송일·조회·방송 시간), 방송 중 동시 시청자 (실시간 기록)','공개 데이터 (설정 없음) · 공식 Open API 키를 받으면 Netlify 환경변수 <code>CHZZK_CLIENT_ID</code>')
    +row('유튜브 라이브 데이터','<span class="pill accent">YouTube API 사용</span>','스트리머 광고·스트리머 데이터: 채널 구독자, 라이브 다시보기(제목·시작·종료·조회) · 방송 중 동시 시청자','위 YouTube Data API 키를 같이 사용 (영상 50개당 약 2~3 단위)')}
async function stIntCheck(){if(A.stIntBusy)return;A.stIntBusy=true;try{A.stInt=DB.mode==='demo'?{soop:{ok:true},chzzk:{ok:true}}:await aiFetch('/api/stream',{action:'status'})}catch(e){A.stInt={soop:{ok:false,error:e.message},chzzk:{ok:false,error:e.message}}}finally{A.stIntBusy=false;scheduleRender()}}

/* ============ 동작 ============ */
Object.assign(ACT,{
  skFetchAll(){const c=curC();if(!c)return;const rows=curRows().filter(r=>r.name&&r.chlink&&!isOut(r.stage)).filter(r=>!A.gf||(A.gf==='__none'?!(r.group&&c.groups&&c.groups[r.group]):r.group===A.gf));if(!rows.length)return toast('채널 URL이 있는 스트리머가 없습니다.','crit');
    (async()=>{let k=0,hit=0;const q=[...rows];const work=async()=>{while(q.length){const r=q.shift();A.sk.fetching=`불러오는 중… ${++k}/${rows.length}`;scheduleRender();const ag=await skFetchRow(A.cid,c,r,true);if(ag)hit+=ag.airN}};await Promise.all([work(),work(),work()]);A.sk.fetching=false;scheduleSync(A.cid);render();toast(`스트리머 ${rows.length}명 방송을 불러왔습니다 · 광고 방송 ${hit}회 매칭`)})()},
  async skFetchOne(a){const c=curC();const r=curRows().find(x=>x.id===a.dataset.r);if(c&&r){await skFetchRow(A.cid,c,r,false);scheduleSync(A.cid)}},
  skOnlyHit(){A.sk.onlyHit=A.sk.onlyHit===false;render()},
  async skAirAdd(a){const rid=a.dataset.r;const ak='m'+uid().slice(0,8);A.sk.onlyHit=false;await skSaveAir(rid,airs=>{airs[ak]={id:ak,title:'',at:new Date().toISOString(),src:'manual',inc:true}})},
  async skAirDel(a){await skSaveAir(a.dataset.r,airs=>{delete airs[a.dataset.a]})},
  skType(a){const c=curC();if(!c)return;patchC('st.type',a.dataset.v);if(A.view==='create')render()},
  spNew(){A.sk.spEdit={name:'',partner:'링컴즈 소속',channels:{}};render();window.scrollTo(0,0)},
  spEdit(a){A.sk.spEdit={id:a.dataset.id};render();window.scrollTo(0,0)},
  spX(){A.sk.spEdit=null;render()},
  spF(a){A.sk.spF=a.dataset.k;render()},
  async spSave(){const e=A.sk.spEdit;if(!e)return;const v=id=>String(($('#'+id)||{}).value||'').trim();const name=v('sp-name');if(!name)return toast('스트리머명을 넣어 주세요.','crit');
    const id=e.id||'sp_'+uid().slice(0,10);const s=e.id?A.spool[e.id]:{};const C={...((s&&s.channels)||{})};[['soop','sp-soop'],['chzzk','sp-chzzk'],['yt','sp-yt']].forEach(([k,f])=>{const u=v(f);if(u)C[k]={...(C[k]||{}),url:u};else delete C[k]});
    const d={type:'streamer',name,partner:v('sp-partner')||'외부',tags:v('sp-tags'),memo:v('sp-memo'),channels:C,updatedAt:T_NOW(),...(e.id?{}:{camps:{},createdAt:T_NOW(),by:A.user.email})};
    try{if(e.id)await DB.update('streams/'+id,d);else await DB.set('streams/'+id,d);A.spool[id]={...(A.spool[id]||{}),...d};A.sk.spEdit=null;render();toast('저장했습니다. 채널 정보를 불러옵니다.');spFetch(id)}catch(err){saveErr(err)}},
  async spDel(a){if(A.confirm!=='spDel'){A.confirm='spDel';render();return}A.confirm=null;const id=a.dataset.id;try{await DB.del('streams/'+id);delete A.spool[id];A.sk.spEdit=null;render();toast('삭제했습니다.')}catch(e){saveErr(e)}},
  spFetch(a){spFetch(a.dataset.id)},
  sdOpen(a){A.sk.sdSel=a.dataset.id;A.sk.sdBc='';ACT.nav({dataset:{v:'sdata'}})},
  sdFetch(){sdFetch()},
  sdPlat(a){A.sk.sdPlat=a.dataset.k;render()},
  sdBc(a){A.sk.sdBc=A.sk.sdBc===a.dataset.id?'':a.dataset.id;render();if(A.sk.sdBc)setTimeout(()=>{const el=document.querySelector('.sd-det');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},60)},
  sdRec(){A.sk.rec=!A.sk.rec;toast(A.sk.rec?'실시간 기록을 켰습니다. 이 화면을 열어 둔 동안 6분마다 라이브 시청자를 기록합니다.':'실시간 기록을 껐습니다.');if(A.sk.rec)sdTick();render()},
  spPickAdd(){const R=draftRows();let o=Object.values(R).reduce((t,r)=>Math.max(t,r.order||0),0);let k=0;[...(A.wsel||[])].forEach(id=>{const s=(A.spool||{})[id];if(!s)return;const chs=['soop','chzzk','yt'].filter(x=>((s.channels||{})[x]||{}).url);(chs.length?chs:['']).forEach(x=>{const ch=x?s.channels[x]:{};R[uid()]={order:++o,name:s.name,ch:x?SK_PLAT_L[x]:'',chlink:ch.url||'',acct:ch.id||'',fol:ch.fol??null,partner:s.partner||'',...(A.gf&&A.gf!=='__none'?{group:A.gf}:{})};k++})});A.wsel=new Set();A.wpick=false;render();toast(`${k}줄을 추가했습니다.`)}
});
/* 입력 */
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset)return;
  if(t.dataset.skkw){const c=curC();if(!c)return;patchC('st.keywords',String(t.value).split(/[,\n]/).map(x=>x.trim()).filter(Boolean));return}
  if(t.dataset.ska){const [rid,ak]=t.dataset.ska.split('.');const f=t.dataset.f;const c=curC();skSaveAir(rid,airs=>{const a=airs[ak];if(!a)return;if(f==='inc'){const m=skMatch(c,a);if(t.checked===(m.title||m.soft))delete a.inc;else a.inc=t.checked}else if(f==='title')a.title=t.value;else{const v=parseNum(t.value);if(v==null)delete a[f];else a[f]=v}});return}
  if(t.dataset.sdsel){A.sk.sdSel=t.value;A.sk.sdBc='';render();return}
  if(t.dataset.sddays){A.sk.sdDays=+t.value||30;return}
  if(t.dataset.sdbc){const D=A.sk.sd;if(!D||!canEdit())return;const b=(D.bcs||[]).find(x=>x.id===t.dataset.sdbc);if(!b)return;const v=parseNum(t.value);b[t.dataset.f]=v;const id=A.sk.sdSel||(spArr()[0]||{}).id;DB.set('streams/sd_'+id.slice(3),D).then(()=>render()).catch(saveErr);return}
  /* 캠페인 만들기: 채널 URL을 넣으면 플랫폼·채널 ID 자동 */
  if(t.dataset.drow&&t.dataset.df==='chlink'&&A.view==='create'&&isStream(A.draft)){const R=draftRows();const r=R[t.dataset.drow];const p=parseChLink(t.value);if(r&&p&&STR_PLATS.includes(p.ch)){r.ch=p.ch;if(!r.acct&&p.acct)r.acct=p.acct;setTimeout(render,0)}}});
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||!t.dataset.spq)return;A.sk.spQ=t.value;clearTimeout(document.spq);document.spq=setTimeout(()=>{render();const el=document.querySelector('[data-spq]');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},250)});
/* 시트 붙여넣기: 스트리머 광고는 채널 URL만 한 줄씩 붙여넣어도 됨 */
(function(){const prev=ACT.wpasteGo;ACT.wpasteGo=function(){if(!(A.view==='create'&&isStream(A.draft)))return prev.apply(this,arguments);const t=($('#wpaste')||{}).value||'';const R=draftRows();let o=Object.values(R).reduce((t,r)=>Math.max(t,r.order||0),0);let k=0;
  t.split(/\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const c=line.split('\t').map(x=>x.trim());const url=c.find(x=>/^https?:\/\//i.test(x)||/sooplive|chzzk|youtube/i.test(x))||'';const p=parseChLink(url);const name=(c[0]&&c[0]!==url?c[0]:'')||(p&&p.acct)||'';if(!name&&!url)return;
    R[uid()]={order:++o,name,chlink:url,ch:p&&STR_PLATS.includes(p.ch)?p.ch:(STR_PLATS.find(x=>c.includes(x))||''),acct:p&&p.acct||'',fol:parseNum(c.find(x=>/^[\d.,]+[만천kK]?$/.test(x)&&x!==name)||'')??null,fee:null,...(A.gf&&A.gf!=='__none'?{group:A.gf}:{})};k++});
  A.wpaste=false;render();toast(`${k}명을 추가했습니다.`)}})();

function skCss(){if(skCss.done)return;skCss.done=1;document.head.insertAdjacentHTML('beforeend',`<style id="sk-css">
.sk-pl{font-style:normal;font-size:11px;font-weight:600;padding:2px 7px;border-radius:999px;background:var(--line);color:var(--ink2);white-space:nowrap}.sk-pl.soop{background:#E8F0FF;color:#1D4ED8}.sk-pl.chzzk{background:#DFFBEA;color:#047857}.sk-pl.yt{background:#FDE8E8;color:#B91C1C}
.sk-chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:3px 9px;border-radius:999px;text-decoration:none;border:1px solid var(--line);color:var(--ink2);background:var(--surface)}.sk-chip.soop{border-color:#BFD3FF;color:#1D4ED8}.sk-chip.chzzk{border-color:#A7F0C9;color:#047857}.sk-chip.yt{border-color:#F8C4C4;color:#B91C1C}
.sk-tbl input[type=text]{padding:3px 6px}.sk-tbl tr.sk-off td{opacity:.5}.sk-ttl{max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sk-bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden}.sk-bar i{display:block;height:100%;background:var(--accent);border-radius:4px}
.sk-plats{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:12px}.sk-plats div{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}.sk-plats span{font-size:12px;opacity:.7}.sk-plats em{font-style:normal;font-size:18px;font-weight:700}
.sk-soon{text-align:center;padding:36px 18px}.sk-soon-ic{font-size:40px}.sk-soon h2{margin:6px 0}.sk-soon p{color:var(--ink2);line-height:1.6}
.sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}
.sp-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
.sp-h{display:flex;align-items:center;gap:10px}.sp-h img,.sp-av{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none}.sp-av{display:flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-weight:700;font-size:18px}.sp-h .grow{display:flex;flex-direction:column;min-width:0}.sp-h b{font-size:15px}
.sp-chs{display:flex;gap:6px;flex-wrap:wrap}.sp-st{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sp-st div{background:var(--surface2);border-radius:8px;padding:6px 8px;display:flex;flex-direction:column}.sp-st span{font-size:11px;color:var(--muted)}.sp-st b{font-size:15px}.sp-camps{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sd-prof{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-bottom:12px}.sd-pc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}.sd-pc img{width:36px;height:36px;border-radius:50%}
.sd-pk{display:flex;gap:14px;flex-wrap:wrap}.sd-pk div{display:flex;flex-direction:column}.sd-pk span{font-size:11px;color:var(--muted)}.sd-pk b{font-size:17px}.sd-live{color:#DC2626}
.sd-charts{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px;margin-bottom:12px}@media(max-width:1000px){.sd-charts{grid-template-columns:1fr}}
.sd-svg{width:100%;height:auto;display:block}.sd-svg .gl{stroke:var(--line);stroke-width:1}.sd-svg .ax{font-size:10px;fill:var(--muted)}.sd-svg .bar rect{fill:color-mix(in srgb,var(--accent) 70%,transparent);cursor:pointer}.sd-svg .bar.on rect,.sd-svg .bar:hover rect{fill:var(--accent)}
.sd-svg .ln{fill:none;stroke:var(--accent);stroke-width:2}.sd-svg .pt{fill:var(--accent)}.sd-svg .ar{fill:color-mix(in srgb,var(--accent) 16%,transparent)}.sd-svg .avg{stroke:var(--muted);stroke-dasharray:4 4}
.sd-tbl tr.sel td{background:var(--accent-soft)}.sd-ttl{display:block;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.sd-dg{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr);gap:14px;align-items:start}@media(max-width:1000px){.sd-dg{grid-template-columns:1fr}}.sd-sum th{text-align:left;font-weight:500;color:var(--muted);white-space:nowrap}.sd-sum td{text-align:right;font-weight:600}
</style>`)}
