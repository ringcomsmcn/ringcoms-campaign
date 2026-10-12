/* RINGCOMS 캠페인 관리 · 제안 도구 — 광고 제안서 생성 (v0.16)
   - 기초 정보(상품소개서 PDF·링크, 예산, 대행수수료, 집행 기간) → AI(Gemini)가 시장·컨셉·그룹별 가이드 문구 작성 (/api/proposal, 백그라운드)
   - 숫자는 화면에서 계산: 예산 → 티어(메가·매크로·마이크로·나노) 인원·단가 자동 구성, 링컴즈 집행 실측(인플루언서 풀) 기반 예상 조회수·ER·CPV
   - 섭외 후보: 인플루언서 풀에서 그룹 카테고리에 맞는 인플루언서 추천 → 선택
   - 미리보기(브라우저) · PPT 본편(발표 노트 포함) · 7장 요약본 · PDF
   저장 위치: guides/{id} (kind: 'proposal'), 이미지는 guideimg/{id} — 기존 보안 규칙 그대로 사용
   index.html·tools.js의 전역(A, DB, ACT, render, esc, fmt, n, has, setIn, getIn, aiFetch, ringImg, ringLogo, HtmlDeck …)을 씁니다. */
(function(){
'use strict';
const PT=['메가','매크로','마이크로','나노'];
const TK={MEGA:'메가',MACRO:'매크로',MICRO:'마이크로',NANO:'나노'};
const RANGE={메가:'100만+',매크로:'10만~100만',마이크로:'1만~10만',나노:'1천~1만'};
const UNIT0={메가:9000000,매크로:2000000,마이크로:400000,나노:120000};
const UNIT_R={메가:[8000000,15000000],매크로:[1500000,2500000],마이크로:[300000,700000],나노:[50000,150000]};
/* 풀에 실측이 부족한 티어(콘텐츠 3개 미만)는 묵끄럽 마라곤약스낵 8월 시딩 실측(2026.10.7 기준)을 씀 */
const BENCH0={name:'묵끄럽 마라곤약스낵 8월 시딩',views:{메가:70783,매크로:77525,마이크로:30289,나노:9000},er:{메가:0.0185,매크로:0.0162,마이크로:0.028,나노:0.028},cpv:{메가:152.6,매크로:10.8,마이크로:3.3,나노:3.3}};
const OBJ=['브랜드 인지도 · 조회수','참여 · 확산','홈페이지 · 상세페이지 유입','앱 설치 · 회원가입','구매 전환'];
const GKEYS=['A','B','C'];const GW={A:0.4,B:0.35,C:0.25};
const SEQ=['cover','toc','market1','market2','direction','capability','umbrella','group:A','guide:A','group:B','guide:B','group:C','guide:C','features','categories','tiers','matrix','showcase','kpi','timeline','appx:0','appx:1','closing'];
const SEQ_SUM=['cover','market1','umbrella','features','tiers','kpi','timeline','eod'];
const won=v=>Math.round(+v||0).toLocaleString('ko-KR');
const man=v=>{const x=Math.round((+v||0)/1e3)/10;return x.toLocaleString('ko-KR')+'만'};
const cK=v=>v>=1e4?(Math.round(v/1e3)/10).toLocaleString('ko-KR')+'만':won(v);
const pc=(v,d=1)=>((+v||0)*100).toFixed(d)+'%';
const N=v=>{const x=parseFloat(String(v??'').replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0};
const curP=()=>A.pid&&A.props?A.props[A.pid]:null;
const lnz=s=>String(s||'').replace(/\r/g,'');

/* ============ 아이콘 · 메뉴 ============ */
window.TOOL_IC=window.TOOL_IC||{};
window.TOOL_IC.proposal='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M7 13l3-3 2.5 2.5L17 8M12 16.5V20M8.5 20h7"/></svg>';
['ppDisc','ppNew','ppDel','ppDup','ppAi','ppAuto','ppTierAdd','ppPick','ppImgDel','ppPageUse','ppSrcClear','ppImgClip'].forEach(k=>WRITE_ACTS.add(k));
window.CONFIRM_ACTS=(window.CONFIRM_ACTS||[]).concat(['ppDel']);

/* ============ 계산: 티어 구성 · 실측 기준 · 예상 성과 ============ */
function fee0(I){return {rate:has(I.feeRate)?N(I.feeRate):20,mode:I.feeMode==='excl'?'excl':'incl'}}
/* 집행 가능 광고비(대행수수료 제외) */
function execMax(I){const B=N(I.budget);const f=fee0(I);return f.mode==='excl'?B:B/(1+f.rate/100)}
/* 예산 규모별 기본 인원 (총예산 기준 표: ~500만 / 1,000만 / 3,000만 / 5,000만+) */
function baseCounts(B){const P=[[0,[0,0,4,6]],[5e6,[0,1,5,9]],[1e7,[0,2,8,15]],[3e7,[0,4,15,25]],[5e7,[1,6,20,30]]];
  if(B>=5e7){const k=B/5e7;return {메가:Math.max(1,Math.floor(k)),매크로:Math.round(6*k),마이크로:Math.round(20*k),나노:Math.round(30*k)}}
  let i=0;while(i<P.length-1&&B>P[i+1][0])i++;const [b0,c0]=P[i],[b1,c1]=P[Math.min(i+1,P.length-1)];const t=b1>b0?(B-b0)/(b1-b0):0;
  const c=c0.map((v,j)=>Math.round(v+(c1[j]-v)*t));return {메가:c[0],매크로:c[1],마이크로:c[2],나노:c[3]}}
/* 예산 → 티어별 인원·단가 (단가는 1만 원 단위, 합계 = 광고비 ≤ 집행 가능액) */
function autoMix(I){const X=execMax(I);if(!(X>0))return PT.map(t=>({tier:t,count:0,unit:UNIT0[t]}));
  const c=baseCounts(N(I.budget));let R=PT.map(t=>({tier:t,count:c[t],unit:UNIT0[t]}));const sum=()=>R.reduce((a,r)=>a+r.count*r.unit,0);const get=t=>R.find(r=>r.tier===t);
  for(let it=0;it<60;it++){const s=sum();if(!s)break;const k=X/s;R.forEach(r=>{r.unit=Math.min(UNIT_R[r.tier][1],Math.max(UNIT_R[r.tier][0],Math.floor(r.unit*k/1e4)*1e4))});const s2=sum();
    if(s2>X){const o=['나노','마이크로','매크로','메가'].map(get).find(r=>r.count>(r.tier==='나노'?2:r.tier==='마이크로'?2:0));if(!o)break;o.count--;continue}
    if(s2<X*0.93&&R.filter(r=>r.count).every(r=>r.unit>=UNIT_R[r.tier][1])){const o=get(it%3===2?'마이크로':'나노');o.count++;continue}break}
  let left=X-sum();const order=['매크로','마이크로','나노','메가'];let guard=0;
  while(left>=1e4&&guard++<5000){let done=false;for(const t of order){const r=get(t);if(r.count&&r.unit+1e4<=UNIT_R[t][1]&&r.count*1e4<=left){r.unit+=1e4;left-=r.count*1e4;done=true;break}}if(!done)break}
  return R}
function tierRows(P){const I=P.info||{};const L=(P.plan&&P.plan.tiers&&P.plan.tiers.length?P.plan.tiers:autoMix(I));return PT.map(t=>{const r=L.find(x=>x.tier===t)||{};return {tier:t,count:Math.max(0,Math.round(N(r.count))),unit:Math.max(0,N(r.unit))}})}
/* 링컴즈 집행 실측: 인플루언서 풀의 캠페인 기록(조회·참여·비용)을 티어별로 모음 */
function poolBench(cid){const acc={};PT.forEach(t=>acc[t]={n:0,views:0,eng:0,cost:0});const camps=new Set();
  Object.values(A.pool||{}).forEach(p=>{const t=TK[tierOf(p.fol)]||TK[p.tier];if(!t)return;Object.entries(p.campaigns||{}).forEach(([ek,e])=>{const c0=ek.split('__')[0];if(cid&&c0!==cid)return;const v=N(e.views);if(!(v>0))return;
    const k=Math.max(1,N(e.uploaded));const a=acc[t];a.n+=k;a.views+=v;a.eng+=N(e.eng);a.cost+=N(e.costV);camps.add(c0)})});
  const views={},er={},cpv={},src={};PT.forEach(t=>{const a=acc[t];const ok=a.n>=3&&a.views>0;views[t]=ok?a.views/a.n:BENCH0.views[t];er[t]=ok&&a.eng?a.eng/a.views:BENCH0.er[t];cpv[t]=ok&&a.cost?a.cost/a.views:BENCH0.cpv[t];src[t]=ok?`실측 ${a.n}개`:'기본값'});
  const tot=PT.reduce((o,t)=>{const a=acc[t];o.n+=a.n;o.views+=a.views;o.eng+=a.eng;o.cost+=a.cost;return o},{n:0,views:0,eng:0,cost:0});
  const real=PT.some(t=>src[t]!=='기본값');
  const name=!real?BENCH0.name+' 실측':cid?((A.campaigns[cid]||{}).name||'선택 캠페인')+' 실측':`링컴즈 집행 캠페인 실측 (${camps.size}개 캠페인)`;
  return {views,er,cpv,src,acc,tot,real,name,camps:camps.size}}
function benchCamps(){const s=new Map();Object.values(A.pool||{}).forEach(p=>Object.entries(p.campaigns||{}).forEach(([ek,e])=>{if(N(e.views)>0){const c=ek.split('__')[0];s.set(c,(s.get(c)||0)+1)}}));
  return [...s.entries()].filter(([c])=>A.campaigns[c]).sort((a,b)=>b[1]-a[1]).map(([c,k])=>[c,A.campaigns[c].name,k])}
function ppCalc(P){const I=P.info||{},pl=P.plan||{};const R=tierRows(P);const bm=poolBench(pl.bench||'');const f=fee0(I);
  const ad=R.reduce((a,r)=>a+r.count*r.unit,0);const fee=Math.round(ad*f.rate/100);const total=ad+fee;const people=R.reduce((a,r)=>a+r.count,0);
  const views=R.reduce((a,r)=>a+r.count*bm.views[r.tier],0);const er=has(pl.er)&&N(pl.er)>0?N(pl.er)/100:0.02;const eng=views*er;
  return {R,bm,f,ad,fee,total,people,views,er,eng,likes:eng*0.92,cpv:views?total/views:0,cpvExec:views?ad/views:0,budget:N(I.budget),execMax:execMax(I),over:f.mode==='incl'?total>N(I.budget)+1:ad>N(I.budget)+1}}
/* 그룹 × 티어 인원 나누기 (A 40% · B 35% · C 25%, 큰 나머지 순) */
function matrixOf(R){const M={A:{},B:{},C:{}};R.forEach(r=>{const raw=GKEYS.map(g=>r.count*GW[g]);const base=raw.map(Math.floor);let left=r.count-base.reduce((a,b)=>a+b,0);
  raw.map((v,i)=>[v-base[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(left>0){base[i]++;left--}});GKEYS.forEach((g,i)=>M[g][r.tier]=base[i])});return M}

/* ============ 섭외 후보: 인플루언서 풀에서 추천 ============ */
const PLAT={yt:'유튜브',tt:'틱톡',ig:'인스타그램'};const PLAT_K={'인스타그램':'ig','틱톡':'tt','유튜브':'yt'};
const PLATS=['인스타그램','틱톡','유튜브'];const PLAT_FMT={'인스타그램':'인스타그램 릴스','틱톡':'틱톡','유튜브':'유튜브 쇼츠'};
function platsOf(I){const L=Array.isArray(I.platforms)?I.platforms.filter(x=>PLATS.includes(x)):null;return L&&L.length?L:PLATS.slice()}
function poolCands(P,gk){const g=((P.ai||{}).groups||[]).find(x=>x.key===gk)||{};const kw=[...(g.keywords||[]),...(g.search||[]),...String(g.name||'').split(/\s+/)].map(x=>String(x).trim()).filter(x=>x.length>=2);
  const M=matrixOf(ppCalc(P).R)[gk]||{};const want=PT.filter(t=>M[t]>0);
  return Object.entries(A.pool||{}).filter(([,p])=>!p.hidden&&!p.exclude&&p.name).map(([id,p])=>{const g_=typeof poolAgg==='function'?poolAgg(p):{};const t=TK[tierOf(p.fol)]||'';const hay=[p.cat,p.name,p.memo,p.acct].join(' ');
    const hit=kw.filter(k=>hay.includes(k)).length;const score=hit*10+(want.includes(t)?4:0)+(g_.avgViews?Math.min(3,Math.log10(g_.avgViews)-2):0)+(g_.er?Math.min(2,g_.er*50):0);
    return {id,p,t,avg:g_.avgViews||null,er:g_.er||null,n:g_.n||0,score,hit}}).sort((a,b)=>b.score-a.score)}
const foundOf=(P,gk)=>((P.found||{})[gk])||[];
const MAXPICK=4;
/* 고른 섭외 후보: 탐색 결과(yt:/tt:/ig:) 또는 인플루언서 풀 → 카드 정보 */
function picksOf(P,gk){const ids=((P.picks||{})[gk])||[];return ids.map(id=>{const f=/^(yt|tt|ig):/.test(id)&&foundOf(P,gk).find(x=>x.id===id);
  if(f)return {id,f,name:f.name||f.acct,sub:`${PLAT[f.plat]}${f.followers?' · '+cK(f.followers):''}${f.acct?' · @'+f.acct:''}`,tier:f.tier||TK[tierOf(f.followers)]||'',stat:[f.avg?'평균 조회 '+cK(f.avg):'',f.er?'ER '+pc(f.er,1):''].filter(Boolean).join(' · ')||'신규 협업 후보',why:f.why||f.bio||'',av:(A.pavs||{})[id]||null};
  const p=(A.pool||{})[id];if(!p)return null;const ag=typeof poolAgg==='function'?poolAgg(p):{};
  return {id,p,name:p.name,sub:`${p.ch||''}${p.fol?' · '+cK(N(p.fol)):''}${p.acct?' · @'+String(p.acct).replace(/^@/,''):''}`,tier:TK[tierOf(p.fol)]||'',stat:ag.avgViews?`평균 조회 ${cK(ag.avgViews)}${ag.er?' · ER '+pc(ag.er):''}`:'신규 협업 후보',why:(P.pickWhy||{})[p.name]||['링컴즈 풀',p.cat,ag.lastCampaign?'최근 '+ag.lastCampaign:''].filter(Boolean).join(' · '),av:null}}).filter(Boolean)}

/* ============ 덱 (PPT · PDF · 미리보기 공통) ============ */
const DIM=new Map();
function dims(src){if(DIM.has(src))return Promise.resolve(DIM.get(src));return new Promise(r=>{const im=new Image();im.onload=()=>{const d=[im.naturalWidth||1,im.naturalHeight||1];DIM.set(src,d);r(d)};im.onerror=()=>r(null);im.src=src})}
const hx=v=>{const h=String(v||'').replace('#','').toUpperCase();return /^[0-9A-F]{6}$/.test(h)?h:'2F5BEA'};
const mix=(h,t)=>{const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return c.map(v=>Math.round(v+(255-v)*t).toString(16).padStart(2,'0')).join('').toUpperCase()};
const shade=(h,t)=>{const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return c.map(v=>Math.round(v*(1-t)).toString(16).padStart(2,'0')).join('').toUpperCase()};
const lum=h=>{const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
function weekDates(I){const d0=new Date();d0.setHours(0,0,0,0);const st=I.start?new Date(I.start+'T00:00:00'):null;let w0=st?new Date(st.getTime()-28*864e5):new Date(d0.getTime()+7*864e5);if(w0<d0)w0=d0;
  const up=st?Math.min(4,Math.max(2,Math.round((st-w0)/(7*864e5)))):4;let last=up+3;if(I.end){const e=new Date(I.end+'T00:00:00');const k=Math.ceil((e-w0)/(7*864e5));if(k>last)last=Math.min(10,k)}
  const wk=i=>{const d=new Date(w0.getTime()+i*7*864e5);return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`};return {up,last,wk}}

async function ppDeck(deck,P,seq,opt={}){
  const PDF=!!opt.pdf,B=PDF,W=13.333,H=7.5,MX=0.6;const I=P.info||{},AI=P.ai||{},K=ppCalc(P),M=matrixOf(K.R);const imgs=opt.imgs||{};
  const TH=hx(I.color||AI.color);const DARK='1B1E27',MUT='6B7280',LINE='E3E5EA',SOFT=mix(TH,.93),TINT=mix(TH,.82),DEEP=shade(TH,.32),ONC=lum(TH)>0.62?DARK:'FFFFFF';
  const FT='Pretendard ExtraBold',FL='Pretendard Light',FB='Pretendard',FS='Pretendard SemiBold';
  const BR=AI.brand||I.brand||I.advertiser||'Brand';const G={};((AI.groups)||[]).forEach(g=>{if(g&&g.key)G[g.key]=g});GKEYS.forEach(k=>{G[k]=G[k]||{key:k,name:`그룹 ${k}`,pillar:['공감·인지','참여·확산','확장·신규'][GKEYS.indexOf(k)]}});
  const ring=ringImg('#FFFFFF');const LG=await ringLogo('#'+TH);const LW_=1.6,LH_=LW_*182/900;let pg=0,secNo=0;
  const T=(s,text,o)=>s.addText(text,{fontFace:FB,valign:'middle',margin:0,charSpacing:0,color:DARK,...o});
  const box=(s,x,y,w,h,fill,o={})=>s.addShape(deck.ShapeType.roundRect,{x,y,w,h,fill:{color:fill},line:{color:o.line||fill,width:o.line?0.75:0},rectRadius:o.r!=null?o.r:0.12});
  const rect=(s,x,y,w,h,fill)=>s.addShape(deck.ShapeType.rect,{x,y,w,h,fill:{color:fill},line:{color:fill,width:0}});
  const pill=(s,text,x,y,w,fill,col,size=11,h=0.34)=>{box(s,x,y,w,h,fill,{r:h/2});T(s,text,{x,y,w,h,fontFace:FS,bold:B,fontSize:size,color:col,align:'center'})};
  const logo=(s,white)=>{const d=white?LG.white:LG.tint;if(d)s.addImage({data:d,x:W-MX-LW_,y:0.45,w:LW_,h:LH_});else T(s,'RINGCOMS',{x:W-3,y:0.42,w:2.4,h:0.36,fontFace:FT,bold:B,fontSize:14,color:white?'FFFFFF':TH,align:'right'})};
  const pnum=(s,white)=>T(s,String(pg).padStart(2,'0'),{x:W-MX-0.6,y:H-0.45,w:0.6,h:0.25,fontSize:9,color:white?'FFFFFF':'A0A6B0',align:'right'});
  const put=async(s,data,x,y,w,h,al='center')=>{if(!data)return null;const d=await dims(data);if(!d)return null;const k=Math.min(w/d[0],h/d[1]);const iw=d[0]*k,ih=d[1]*k;const ax=al==='left'?x:al==='right'?x+w-iw:x+(w-iw)/2;s.addImage({data,x:ax,y:y+(h-ih)/2,w:iw,h:ih});return {x:ax,w:iw}};
  const SEC0={market:'01',direction:'02',capability:'03',concept:'04',strategy:'05',exec:'06',timeline:'07'};const sec=k=>opt.perSlideNo?String(secNo).padStart(2,'0'):SEC0[k];
  const head=(s,label,title,sub,o={})=>{pg++;s.background={color:o.bg||'FFFFFF'};logo(s,false);
    T(s,label,{x:MX,y:0.42,w:8.5,h:0.32,fontFace:FS,bold:B,fontSize:11,color:TH});
    T(s,lnz(title),{x:MX,y:0.82,w:o.tw||10.2,h:1.2,fontFace:FT,bold:B,fontSize:27,color:DARK,lineSpacingMultiple:1.08,fit:'shrink'});
    if(sub)T(s,lnz(sub),{x:MX,y:2.08,w:o.sw||11.6,h:0.66,fontFace:FL,fontSize:13.5,color:MUT,lineSpacingMultiple:1.12,fit:'shrink'});pnum(s,false)};
  const source=(s,t)=>{if(t)T(s,lnz(t),{x:MX,y:H-0.5,w:10.8,h:0.3,fontSize:8.5,color:'A0A6B0',fit:'shrink'})};
  const colorBg=(s)=>{pg++;s.background={color:TH};s.addImage({data:ring,x:W-6.2,y:0.9,w:6.6,h:6.6});logo(s,true)};
  const L=a=>(a||[]).filter(Boolean);
  const notes=(s,id)=>{const N_=AI.notes||{};let t=N_[id.replace(':','')]||N_[id]||'';
    if(id==='tiers')t=(t?t+'\n':'')+`[숫자] 인플루언서 ${K.people}명 · 광고비 ${won(K.ad)}원 + 대행수수료 ${K.f.rate}% ${won(K.fee)}원 = 총 ${won(K.total)}원 (VAT 별도)`;
    if(id==='kpi')t=(t?t+'\n':'')+`[숫자] 예상 조회수 ${cK(K.views)} · ER ${pc(K.er)} · 좋아요 약 ${cK(K.likes)} · CPV ${K.cpv.toFixed(1)}원`;
    if(t&&s.addNotes)s.addNotes(String(t))};

  const S={
    async cover(s){colorBg(s);const C=AI.cover||{};
      T(s,'INFLUENCER CAMPAIGN PROPOSAL',{x:0.8,y:1.05,w:8,h:0.32,fontFace:FL,fontSize:13,color:'FFFFFF'});
      T(s,BR,{x:0.8,y:1.5,w:8,h:0.6,fontFace:FT,bold:B,fontSize:26,color:'FFFFFF'});
      T(s,lnz(C.headline||`${BR} 인플루언서\n캠페인 제안`),{x:0.8,y:2.2,w:8.2,h:1.75,fontFace:FT,bold:B,fontSize:46,color:'FFFFFF',lineSpacingMultiple:1.05,fit:'shrink'});
      T(s,lnz(C.sub||''),{x:0.8,y:4.05,w:8,h:0.55,fontFace:FL,fontSize:19,color:'FFFFFF',fit:'shrink'});
      pill(s,`총 ${man(K.total)}원 · 인플루언서 ${K.people}명 · VAT 별도`,0.8,4.85,4.3,'FFFFFF',DEEP,12);
      const per=[I.start,I.end].filter(Boolean).map(x=>x.replace(/-/g,'.')).join(' ~ ');
      T(s,`${today().replace(/-/g,'.')}  ·  링컴즈 MCN 사업부 광고콘텐츠팀${per?'  ·  집행 '+per:''}`,{x:0.8,y:6.65,w:9.5,h:0.32,fontSize:11,color:'FFFFFF'});
      const ci=imgs.cover||imgs.hero;if(ci)await put(s,ci,8.9,1.25,3.8,5.3)},
    toc(s){pg++;s.background={color:'FFFFFF'};logo(s,false);T(s,'CONTENTS',{x:MX,y:0.42,w:4,h:0.32,fontFace:FS,bold:B,fontSize:11,color:TH});T(s,'목차',{x:MX,y:0.85,w:4,h:0.8,fontFace:FT,bold:B,fontSize:36,color:TH});
      T(s,lnz(AI.umbrella&&AI.umbrella.name||''),{x:MX,y:4.6,w:4.8,h:1.2,fontFace:FT,bold:B,fontSize:22,color:DARK,fit:'shrink'});T(s,L(AI.umbrella&&AI.umbrella.hashtags).join('  '),{x:MX,y:5.85,w:4.8,h:0.35,fontFace:FS,bold:B,fontSize:12,color:TH});
      const items=['시장 현황','브랜드가 나아갈 방향','링컴즈 인플루언서 마케팅 역량','캠페인 컨셉 · 콘텐츠 가이드','핵심 전략 · 인플루언서 카테고리','인플루언서 구성 · 예상 성과','타임라인 · 어펜딕스'];
      items.forEach((t,i)=>{const y=1.15+i*0.74;rect(s,6.0,y,6.73,0.012,LINE);T(s,String(i+1).padStart(2,'0'),{x:6.15,y:y+0.12,w:0.6,h:0.5,fontFace:FS,bold:B,fontSize:13,color:TH});T(s,t,{x:6.95,y:y+0.12,w:5.7,h:0.5,fontFace:FS,bold:B,fontSize:17,color:DARK})});rect(s,6.0,1.15+items.length*0.74,6.73,0.012,LINE)},
    market1(s){const m=AI.market||{};head(s,`${sec('market')} · MARKET`,m.title||'시장 현황',m.sub);const st=(m.stats||[]).slice(0,3);const n_=Math.max(1,st.length),gap=0.3,cw=(W-2*MX-gap*(n_-1))/n_;
      st.forEach((x,i)=>{const X=MX+i*(cw+gap),Y=3.0,on=i===0;box(s,X,Y,cw,3.35,on?TH:SOFT);T(s,x.label||'',{x:X+0.3,y:Y+0.25,w:cw-0.6,h:0.45,fontFace:FS,bold:B,fontSize:14,color:on?ONC:DARK});
        T(s,[{text:String(x.value||''),options:{fontSize:36,bold:true,color:on?ONC:TH}},{text:x.unit?' '+x.unit:'',options:{fontSize:17,bold:true,color:on?ONC:TH}}],{x:X+0.3,y:Y+0.8,w:cw-0.6,h:1.05,fontFace:FT,fit:'shrink'});
        T(s,lnz(x.desc),{x:X+0.3,y:Y+1.95,w:cw-0.6,h:1.2,fontFace:FL,fontSize:13,color:on?ONC:MUT,lineSpacingMultiple:1.12,fit:'shrink'})});source(s,m.source)},
    market2(s){const m=AI.market||{};head(s,`${sec('market')} · MARKET INSIGHT`,m.title2||'시장 인사이트',m.sub2);
      (m.insights||[]).slice(0,3).forEach((x,i)=>{const Y=3.0+i*1.12;box(s,MX,Y,8.35,0.98,SOFT);T(s,x.kicker||'',{x:MX+0.3,y:Y+0.1,w:1.9,h:0.32,fontFace:FS,bold:B,fontSize:10.5,color:MUT});
        T(s,x.value||'',{x:MX+0.3,y:Y+0.42,w:1.9,h:0.45,fontFace:FT,bold:B,fontSize:19,color:TH,fit:'shrink'});T(s,lnz(x.text),{x:MX+2.35,y:Y+0.08,w:5.8,h:0.82,fontSize:12,color:DARK,lineSpacingMultiple:1.12,fit:'shrink'})});
      box(s,9.25,3.0,W-MX-9.25,3.22,TH);T(s,'INSIGHT',{x:9.55,y:3.18,w:3,h:0.32,fontFace:FS,bold:B,fontSize:11,color:ONC});T(s,lnz(m.takeaway),{x:9.55,y:3.6,w:W-MX-9.85,h:2.45,fontFace:FS,bold:B,fontSize:14,color:ONC,lineSpacingMultiple:1.18,fit:'shrink'});source(s,m.source2)},
    async direction(s){const d=AI.direction||{};head(s,`${sec('direction')} · ${String(BR).toUpperCase()} DIRECTION`,d.title||'브랜드가 나아갈 방향',d.sub,{tw:9.2,sw:9.2});const hasImg=false;
      (d.shifts||[]).slice(0,3).forEach((x,i)=>{const Y=3.05+i*0.88,w0=hasImg?9.2:W-2*MX;T(s,x.from||'',{x:MX,y:Y,w:1.9,h:0.5,fontFace:FL,fontSize:16,color:MUT,fit:'shrink'});T(s,'→',{x:MX+1.95,y:Y,w:0.4,h:0.5,fontFace:FS,bold:B,fontSize:18,color:TH,align:'center'});
        pill(s,x.to||'',MX+2.45,Y+0.07,2.1,TINT,DEEP,13,0.38);T(s,lnz(x.desc),{x:MX+4.8,y:Y,w:w0-4.8,h:0.5,fontSize:13,color:DARK,fit:'shrink'})});
      box(s,MX,5.95,W-2*MX,0.9,DARK);T(s,lnz(d.positioning),{x:MX+0.4,y:5.95,w:W-2*MX-0.8,h:0.9,fontFace:FT,bold:B,fontSize:18,color:'FFFFFF',fit:'shrink'})},
    capability(s){head(s,`${sec('capability')} · RINGCOMS CAPABILITY`,'왜 링컴즈 MCN인가?\n섭외부터 리포트까지, 한 팀에서','크리에이터 섭외·계약·검수·성과 리포트를 한 팀이 끝까지 책임집니다.\n브랜드와 크리에이터 모두에게 득이 되는 구조로 섭외합니다.');
      const pn=Object.values(A.pool||{}).filter(p=>!p.hidden).length;
      const cards=[['크리에이터 네트워크',`링컴즈 MCN 소속·협업\n크리에이터${pn?` 풀 ${won(pn)}명`:''}.\n카테고리·티어별로\n빠르게 섭외합니다.`],['캠페인 관리 플랫폼','ad.ringcoms.com에서\n진행 현황·성과를\n실시간 리포트로\n공유합니다.'],['전환 트래킹','인플루언서별 전용 링크로\n방문·버튼 클릭을\n나눠 측정합니다.'],['2차 활용 · 광고 소재화','성과 상위 콘텐츠를\nMeta·유튜브 광고\n소재로 다시 씁니다.']];
      const gap=0.25,cw=(W-2*MX-gap*3)/4;cards.forEach(([t,x],i)=>{const X=MX+i*(cw+gap),Y=3.0;box(s,X,Y,cw,2.45,SOFT);T(s,String(i+1).padStart(2,'0'),{x:X+0.28,y:Y+0.2,w:1,h:0.4,fontFace:FT,bold:B,fontSize:18,color:TH});
        T(s,t,{x:X+0.28,y:Y+0.62,w:cw-0.5,h:0.42,fontFace:FT,bold:B,fontSize:15,color:DARK,fit:'shrink'});T(s,x,{x:X+0.28,y:Y+1.08,w:cw-0.45,h:1.25,fontSize:11,color:MUT,lineSpacingMultiple:1.12,fit:'shrink'})});
      const bm=K.bm,t=bm.real?bm.tot:null;box(s,MX,5.65,W-2*MX,1.22,TINT);pill(s,'유사 볼륨 캠페인 레퍼런스',MX+0.3,5.8,2.6,TH,ONC,11,0.32);T(s,bm.name,{x:MX+0.3,y:6.2,w:4.4,h:0.32,fontFace:FS,bold:B,fontSize:12.5,color:DARK,fit:'shrink'});
      T(s,'인플루언서 풀에 쌓인 캠페인 성과 기준',{x:MX+0.3,y:6.5,w:4.4,h:0.28,fontSize:10,color:MUT});
      const stats=t?[['콘텐츠',won(t.n)+'개'],['총 조회',cK(t.views)],['ER',pc(t.views?t.eng/t.views:0,2)],['CPV',t.cost&&t.views?(t.cost/t.views).toFixed(1)+'원':'–']]:[['콘텐츠','16개'],['총 조회','95만'],['ER','1.86%'],['CPV','20.0원']];
      stats.forEach(([l,v],i)=>{const X=5.3+i*1.85;T(s,l,{x:X,y:5.85,w:1.75,h:0.3,fontSize:11,color:MUT});T(s,v,{x:X,y:6.15,w:1.75,h:0.55,fontFace:FT,bold:B,fontSize:21,color:i?DEEP:DARK,fit:'shrink'})})},
    umbrella(s){const u=AI.umbrella||{};colorBg(s);T(s,`${sec('concept')} · CAMPAIGN CONCEPT`,{x:MX,y:0.42,w:7,h:0.32,fontFace:FS,bold:B,fontSize:11,color:'FFFFFF'});
      T(s,lnz(u.name||'캠페인 컨셉'),{x:MX,y:0.85,w:9.6,h:1.65,fontFace:FT,bold:B,fontSize:40,color:'FFFFFF',lineSpacingMultiple:1.04,fit:'shrink'});
      T(s,[{text:L(u.hashtags).join('   '),options:{bold:true,fontSize:14}},{text:'',options:{breakLine:true}},{text:lnz(u.sub||''),options:{fontSize:13.5}}],{x:MX,y:2.55,w:11.6,h:0.95,fontFace:FL,color:'FFFFFF',fit:'shrink'});
      const gap=0.3,cw=(W-2*MX-gap*2)/3;GKEYS.forEach((k,i)=>{const g=G[k],c=g.concept||{};const X=MX+i*(cw+gap),Y=3.7;box(s,X,Y,cw,2.95,'FFFFFF');pill(s,k,X+0.3,Y+0.3,0.42,TH,ONC,12);
        T(s,`${g.name||''} · ${g.pillar||''}`,{x:X+0.82,y:Y+0.3,w:cw-1,h:0.34,fontFace:FS,bold:B,fontSize:12,color:DEEP,fit:'shrink'});T(s,lnz(c.name||''),{x:X+0.3,y:Y+0.8,w:cw-0.5,h:0.85,fontFace:FT,bold:B,fontSize:19,color:DARK,fit:'shrink'});
        T(s,L(c.hashtags).join('  '),{x:X+0.3,y:Y+1.7,w:cw-0.5,h:0.32,fontFace:FS,bold:B,fontSize:11.5,color:TH,fit:'shrink'});T(s,lnz(c.keyMessage||''),{x:X+0.3,y:Y+2.05,w:cw-0.5,h:0.75,fontSize:12,color:MUT,lineSpacingMultiple:1.12,fit:'shrink'})});pnum(s,true)},
    async group(s,k){const g=G[k],c=g.concept||{};colorBg(s);T(s,`${sec('concept')} · GROUP ${k} CONCEPT`,{x:MX,y:0.42,w:7,h:0.32,fontFace:FS,bold:B,fontSize:11,color:'FFFFFF'});
      pill(s,`${k} · ${g.name||''}`,MX,0.95,3.2,'FFFFFF',DEEP,13);const two=String(c.name||'').includes('\n');
      T(s,lnz(c.name||''),{x:MX,y:1.45,w:8.4,h:two?1.45:1.0,fontFace:FT,bold:B,fontSize:two?34:42,color:'FFFFFF',lineSpacingMultiple:1.04,fit:'shrink'});
      T(s,L(c.hashtags).join('   '),{x:MX,y:two?2.95:2.5,w:8.2,h:0.38,fontFace:FS,bold:B,fontSize:15,color:mix(TH,.7)});
      T(s,L(c.story).join('\n'),{x:MX,y:3.45,w:8.2,h:1.8,fontFace:FL,fontSize:15.5,color:'FFFFFF',lineSpacingMultiple:1.25,fit:'shrink'});
      T(s,'KEY MESSAGE',{x:MX,y:5.38,w:3,h:0.3,fontFace:FS,bold:B,fontSize:10,color:mix(TH,.7)});T(s,lnz(c.keyMessage||''),{x:MX,y:5.7,w:8.4,h:0.55,fontFace:FT,bold:B,fontSize:20,color:'FFFFFF',fit:'shrink'});
      T(s,'보여줄 기능 · '+(c.features||''),{x:MX,y:6.35,w:8.4,h:0.35,fontFace:FS,bold:B,fontSize:12,color:'FFFFFF',fit:'shrink'});
      const im=imgs.divider;if(im)await put(s,im,9.0,1.15,3.7,5.6);pnum(s,true)},
    async guide(s,k){const g=G[k],gd=g.guide||{};head(s,`${sec('concept')} · GROUP ${k} CONTENT GUIDE`,gd.title||`${g.name||''} 콘텐츠 가이드`,gd.sub);const cuts=(gd.cuts||[]).slice(0,4);const n_=Math.max(1,cuts.length),gap=0.2,cw=(W-2*MX-gap*(n_-1))/n_,Y=2.95,ch=2.55;const CI=opt.cimgs||{};
      for(let i=0;i<cuts.length;i++){const c=cuts[i];const X=MX+i*(cw+gap);box(s,X,Y,cw,ch,i===n_-1?TINT:SOFT);T(s,[{text:`CUT ${i+1}  `,options:{bold:true,color:TH}},{text:`${c.step||''} · ${c.time||''}`,options:{bold:true,color:DARK}}],{x:X+0.2,y:Y+0.13,w:cw-0.4,h:0.32,fontFace:FT,fontSize:11.5,fit:'shrink'});
        const im=CI[`${k}_${i}`];let tx=X+0.2,tw=cw-0.4;if(im){const ph=ch-0.65,pw=ph*9/16;const r=await put(s,im,X+0.15,Y+0.52,pw,ph);if(r){tx=X+0.15+pw+0.12;tw=X+cw-tx-0.12}}
        const fz=im?10:11;T(s,'화면',{x:tx,y:Y+0.52,w:tw,h:0.22,fontFace:FS,bold:B,fontSize:9,color:MUT});T(s,lnz(c.scene),{x:tx,y:Y+0.75,w:tw,h:0.8,fontSize:fz,color:DARK,lineSpacingMultiple:1.05,fit:'shrink'});
        T(s,'멘션 · 자막',{x:tx,y:Y+1.58,w:tw,h:0.22,fontFace:FS,bold:B,fontSize:9,color:MUT});T(s,lnz(c.line),{x:tx,y:Y+1.81,w:tw,h:0.64,fontFace:FS,bold:B,fontSize:fz,color:DEEP,lineSpacingMultiple:1.05,fit:'shrink'})}
      const by=Y+ch+0.2,bh=7.0-by;box(s,MX,by,5.9,bh,'FFFFFF',{line:LINE});T(s,'캡션 예시',{x:MX+0.25,y:by+0.12,w:3,h:0.3,fontFace:FS,bold:B,fontSize:11,color:TH});T(s,lnz(gd.caption),{x:MX+0.25,y:by+0.45,w:5.4,h:bh-0.55,fontSize:10.5,color:DARK,lineSpacingMultiple:1.1,fit:'shrink'});
      const bw=(W-2*MX-5.9-0.4)/2;[['MUST',gd.must,TH],["DON'T",gd.dont,'404040']].forEach(([h,it,col],j)=>{const X=MX+6.1+j*(bw+0.2);box(s,X,by,bw,bh,SOFT);T(s,h,{x:X+0.25,y:by+0.12,w:2,h:0.3,fontFace:FT,bold:B,fontSize:11.5,color:col});
        T(s,L(it).slice(0,3).map(x=>'• '+x).join('\n'),{x:X+0.25,y:by+0.45,w:bw-0.4,h:bh-0.55,fontSize:10.5,color:DARK,lineSpacingMultiple:1.15,fit:'shrink'})})},
    async features(s){head(s,`${sec('strategy')} · CORE STRATEGY`,AI.featuresTitle||'그룹마다 보여줄\n핵심 기능이 다릅니다','A·B·C 그룹이 각자 다른 기능을 보여 주며,\n공감 → 참여 → 확장으로 이어집니다.');const gap=0.3,cw=(W-2*MX-gap*2)/3;
      for(let i=0;i<3;i++){const k=GKEYS[i],g=G[k],f=g.feature||{};const X=MX+i*(cw+gap),Y=2.95;box(s,X,Y,cw,3.95,SOFT);pill(s,k,X+0.25,Y+0.25,0.42,TH,ONC,12);
        T(s,g.name||'',{x:X+0.77,y:Y+0.18,w:cw-0.9,h:0.28,fontFace:FS,bold:B,fontSize:10.5,color:MUT,fit:'shrink'});T(s,(g.pillar||'')+' 기능',{x:X+0.77,y:Y+0.44,w:cw-0.9,h:0.34,fontFace:FT,bold:B,fontSize:15.5,color:DARK,fit:'shrink'});
        const tw=cw-0.5;
        (f.items||[]).slice(0,3).forEach((it,j)=>{const yy=Y+0.98+j*0.7;T(s,it.name||'',{x:X+0.25,y:yy,w:tw,h:0.32,fontFace:FT,bold:B,fontSize:13,color:DEEP,fit:'shrink'});T(s,lnz(it.desc),{x:X+0.25,y:yy+0.32,w:tw,h:0.32,fontSize:10.5,color:DARK,fit:'shrink'})});
        box(s,X+0.2,Y+3.1,cw-0.4,0.7,'FFFFFF',{r:0.1});T(s,lnz(f.effect),{x:X+0.35,y:Y+3.1,w:cw-0.7,h:0.7,fontFace:FS,bold:B,fontSize:11,color:DARK,align:'center',fit:'shrink'})}},
    categories(s){head(s,`${sec('strategy')} · INFLUENCER CATEGORY`,'세 그룹의 인플루언서가\n각자의 역할을 맡습니다','어떤 인플루언서가, 어떤 역할로, 어떤 콘텐츠를 만드는지 정리했습니다.');const cols=[['그룹',2.3],['어떤 인플루언서',3.15],['역할',2.85],['콘텐츠',2.2],['기대 효과',1.63]];
      let x=MX;const y0=2.95;cols.forEach(([h,w])=>{T(s,h,{x:x+0.1,y:y0,w:w-0.2,h:0.32,fontFace:FS,bold:B,fontSize:11,color:MUT});x+=w});
      GKEYS.forEach((k,i)=>{const g=G[k],Y=y0+0.42+i*1.22;box(s,MX,Y,W-2*MX,1.1,i%2?'FFFFFF':SOFT,{line:i%2?LINE:null,r:0.1});pill(s,k,MX+0.15,Y+0.18,0.42,TH,ONC,12);
        T(s,g.name||'',{x:MX+0.7,y:Y+0.12,w:1.55,h:0.45,fontFace:FT,bold:B,fontSize:14.5,color:DARK,fit:'shrink'});T(s,g.pillar||'',{x:MX+0.7,y:Y+0.58,w:1.55,h:0.32,fontFace:FS,bold:B,fontSize:10,color:DEEP});
        let cx=MX+cols[0][1];[g.who,g.role,g.content,g.effect].forEach((v,j)=>{const w=cols[j+1][1];T(s,lnz(v),{x:cx+0.1,y:Y+0.08,w:w-0.2,h:0.94,fontSize:11,fontFace:j===1?FS:FB,bold:j===1&&B,color:j===1?DARK:MUT,lineSpacingMultiple:1.1,fit:'shrink'});cx+=w})})},
    tiers(s){head(s,`${sec('exec')} · TIER MIX & BUDGET`,AI.tiersTitle||`${K.people}명의 인플루언서로\n예산 안에서 최대 도달을`,`메가는 비용 대비 효율이 낮아 ${K.R.find(r=>r.tier==='메가').count?'최소로 두고':'제외하고'},\n매크로로 도달을 열고 마이크로·나노로 참여를 쌓습니다.`);
      const cols=[['티어',1.0],['팔로워',1.25],['인원',0.72],['1인 단가',1.08],['소계',1.05],['역할',0.9],['이유',2.35]];const y0=2.95;let x=MX;cols.forEach(([h,w],j)=>{T(s,h,{x:x+0.08,y:y0,w:w-0.16,h:0.3,fontFace:FS,bold:B,fontSize:11,color:MUT,align:j>=2&&j<=4?'right':'left'});x+=w});
      const tw=cols.reduce((a,c)=>a+c[1],0);const TW=AI.tierWhy||{};K.R.forEach((r,i)=>{const Y=y0+0.38+i*0.66,off=!r.count;rect(s,MX,Y,tw,0.012,LINE);const w_=TW[r.tier]||{};
        const vals=[r.tier,RANGE[r.tier],off?'-':r.count+'명',off?'-':man(r.unit),off?'-':man(r.count*r.unit),w_.role||'',lnz(w_.why||'')];let cx=MX;
        vals.forEach((v,j)=>{const w=cols[j][1];T(s,v,{x:cx+0.08,y:Y+0.05,w:w-0.16,h:0.56,fontFace:[0,4,5].includes(j)?FS:FB,bold:[0,4,5].includes(j)&&B,fontSize:j===6?10:13,color:off?'AAAAAA':j===6?MUT:j===5?DEEP:DARK,align:j>=2&&j<=4?'right':'left',fit:'shrink'});cx+=w})});
      const yT=y0+0.38+K.R.length*0.66;rect(s,MX,yT,tw,0.02,DARK);
      T(s,`인플루언서 ${K.people}명 · 광고비 ${man(K.ad)}원 + 대행수수료 ${K.f.rate}% ${man(K.fee)}원 = 총 ${man(K.total)}원 (VAT 별도)`,{x:MX+0.08,y:yT+0.08,w:tw,h:0.34,fontFace:FS,bold:B,fontSize:11,color:DARK,fit:'shrink'});
      const bm=K.bm;box(s,MX,yT+0.5,tw,0.44,TINT,{r:0.1});T(s,`티어별 CPV(${bm.real?'링컴즈 실측':BENCH0.name}) · 메가 ${bm.cpv.메가.toFixed(1)}원 / 매크로 ${bm.cpv.매크로.toFixed(1)}원 / 마이크로 ${bm.cpv.마이크로.toFixed(1)}원 / 나노 ${bm.cpv.나노.toFixed(1)}원`,{x:MX+0.2,y:yT+0.5,w:tw-0.4,h:0.44,fontFace:FS,bold:B,fontSize:10.5,color:DEEP,fit:'shrink'});
      const used=K.R.filter(r=>r.count);const bx=9.25,bw=W-MX-bx;box(s,bx,2.95,bw,3.95,SOFT);T(s,'광고비 티어별 비중',{x:bx+0.25,y:3.1,w:3,h:0.32,fontFace:FS,bold:B,fontSize:12,color:DARK});
      const cols_=[TH,mix(TH,.35),mix(TH,.6),mix(TH,.8)];let cx=bx+0.25;const barW=bw-0.5;used.forEach((r,i)=>{const w=barW*(r.count*r.unit)/(K.ad||1);if(w>0.01)rect(s,cx,3.7,w,0.5,cols_[PT.indexOf(r.tier)]);cx+=w});
      used.forEach((r,i)=>{const Y=4.5+i*0.52;box(s,bx+0.25,Y+0.1,0.24,0.24,cols_[PT.indexOf(r.tier)],{r:0.05});T(s,r.tier,{x:bx+0.6,y:Y,w:1.2,h:0.44,fontFace:FS,bold:B,fontSize:12,color:DARK});
        T(s,`${Math.round(r.count*r.unit/(K.ad||1)*100)}%  ·  ${man(r.count*r.unit)}원`,{x:bx+1.6,y:Y,w:bw-1.85,h:0.44,fontSize:12,color:MUT,align:'right'})})},
    matrix(s){head(s,`${sec('exec')} · CATEGORY × TIER`,'그룹마다 티어를 나눠\n도달과 참여를 함께 잡습니다','그룹별 인원과 광고비를 티어 단가 기준으로 나눴습니다.');const used=K.R.filter(r=>r.count);const x0=MX,y0=2.95,gw=2.6,cw=Math.min(1.75,(7.3-0.12*used.length)/Math.max(1,used.length)),rh=0.98;
      used.forEach((r,j)=>{const X=x0+gw+j*(cw+0.12);box(s,X,y0,cw,0.5,DARK,{r:0.1});T(s,r.tier,{x:X,y:y0,w:cw,h:0.5,fontFace:FS,bold:B,fontSize:13,color:'FFFFFF',align:'center'})});
      const sx=x0+gw+used.length*(cw+0.12);box(s,sx,y0,1.5,0.5,TH,{r:0.1});T(s,'합계',{x:sx,y:y0,w:1.5,h:0.5,fontFace:FS,bold:B,fontSize:13,color:ONC,align:'center'});
      GKEYS.forEach((k,i)=>{const g=G[k],Y=y0+0.62+i*(rh+0.1);box(s,x0,Y,gw-0.12,rh,TINT,{r:0.1});T(s,`${k}  ${g.name||''}`,{x:x0+0.2,y:Y+0.1,w:gw-0.4,h:0.45,fontFace:FT,bold:B,fontSize:14,color:DARK,fit:'shrink'});T(s,g.pillar||'',{x:x0+0.2,y:Y+0.55,w:gw-0.4,h:0.3,fontFace:FS,bold:B,fontSize:10,color:DEEP});
        let rn=0,rb=0;used.forEach((r,j)=>{const X=x0+gw+j*(cw+0.12);const c=M[k][r.tier]||0,b=c*r.unit;rn+=c;rb+=b;box(s,X,Y,cw,rh,c?SOFT:'FFFFFF',{r:0.1,line:c?null:LINE});
          T(s,c?c+'명':'-',{x:X,y:Y+0.1,w:cw,h:0.48,fontFace:FT,bold:B,fontSize:19,color:c?DARK:'BBBBBB',align:'center'});if(c)T(s,man(b)+'원',{x:X,y:Y+0.58,w:cw,h:0.3,fontSize:10.5,color:MUT,align:'center'})});
        box(s,sx,Y,1.5,rh,SOFT,{r:0.1});T(s,rn+'명',{x:sx,y:Y+0.1,w:1.5,h:0.48,fontFace:FT,bold:B,fontSize:19,color:TH,align:'center'});T(s,man(rb)+'원',{x:sx,y:Y+0.58,w:1.5,h:0.3,fontSize:10.5,color:MUT,align:'center'})});
      T(s,`총 ${K.people}명 · 광고비 ${man(K.ad)}원 + 대행수수료 ${man(K.fee)}원 = 총 ${man(K.total)}원`,{x:x0+gw,y:y0+0.62+3*(rh+0.1)+0.02,w:7.2,h:0.4,fontFace:FS,bold:B,fontSize:12,color:DARK,fit:'shrink'});
      const px=Math.max(sx+1.75,10.4);box(s,px,y0,W-MX-px,3.95,DARK);T(s,'구성 포인트',{x:px+0.25,y:y0+0.2,w:2,h:0.32,fontFace:FS,bold:B,fontSize:12,color:mix(TH,.5)});
      T(s,L(AI.matrixPoints).slice(0,3).map(lnz).join('\n\n'),{x:px+0.25,y:y0+0.62,w:W-MX-px-0.45,h:3.15,fontSize:11,color:'FFFFFF',lineSpacingMultiple:1.12,fit:'shrink'})},
    async showcase(s){const anyF=GKEYS.some(k=>picksOf(P,k).some(x=>x.f));head(s,`${sec('exec')} · INFLUENCER SHORTLIST`,'이런 인플루언서와\n함께하려 합니다',anyF?'유튜브·틱톡·인스타그램에서 그룹 컨셉에 맞춰 찾은 섭외 후보입니다.':'링컴즈 인플루언서 풀에서 그룹 컨셉에 맞춰 고른 섭외 후보입니다.');const gap=0.25,cw=(W-2*MX-gap*2)/3;
      for(let gi=0;gi<3;gi++){const k=GKEYS[gi],g=G[k],X=MX+gi*(cw+gap);pill(s,k,X,2.95,0.42,TH,ONC,12);T(s,`${g.name||''} · ${g.pillar||''}`,{x:X+0.52,y:2.95,w:cw-0.6,h:0.34,fontFace:FT,bold:B,fontSize:12.5,color:DARK,fit:'shrink'});
        const ps=picksOf(P,k).slice(0,MAXPICK);if(!ps.length){const pr=(g.persona||[]).slice(0,2);if(!pr.length){box(s,X,3.42,cw,3.4,'FFFFFF',{line:LINE});T(s,'제안 확정 후 1주 안에\n섭외 리스트를 확정합니다',{x:X,y:3.42,w:cw,h:3.4,fontSize:12,color:MUT,align:'center'});continue}
          pr.forEach((q,pi)=>{const Y=3.42+pi*1.75;box(s,X,Y,cw,1.62,'FFFFFF',{line:TINT});box(s,X+0.2,Y+0.2,0.8,0.8,TINT,{r:0.4});T(s,'?',{x:X+0.2,y:Y+0.2,w:0.8,h:0.8,fontFace:FT,bold:B,fontSize:24,color:DEEP,align:'center'});
            T(s,lnz(q.type||''),{x:X+1.12,y:Y+0.12,w:cw-1.3,h:0.58,fontFace:FT,bold:B,fontSize:12,color:DARK,fit:'shrink'});if(q.tier)pill(s,q.tier,X+1.12,Y+0.76,0.8,TINT,DEEP,9.5,0.26);T(s,'섭외 예정 프로필',{x:X+2.0,y:Y+0.76,w:cw-2.15,h:0.26,fontFace:FS,bold:B,fontSize:10,color:MUT});
            T(s,lnz(q.why||''),{x:X+0.2,y:Y+1.08,w:cw-0.35,h:0.48,fontSize:9.5,color:MUT,fit:'shrink'})});continue}
        const big=ps.length<=2;const ch=big?1.62:0.8,st=big?1.75:0.86,av=big?0.8:0.56;
        for(let pi=0;pi<ps.length;pi++){const c=ps[pi],Y=3.42+pi*st;box(s,X,Y,cw,ch,SOFT);const ax=X+(big?0.2:0.12),ay=Y+(big?0.2:0.12);
          if(c.av){s.addImage({data:c.av,x:ax,y:ay,w:av,h:av,rounding:true})}else{box(s,ax,ay,av,av,[TH,DEEP,mix(TH,.35)][pi%3],{r:av/2});T(s,String(c.name||'?').trim().slice(0,1),{x:ax,y:ay,w:av,h:av,fontFace:FT,bold:B,fontSize:big?22:16,color:'FFFFFF',align:'center'})}
          const tx=ax+av+0.12,tw=X+cw-tx-0.1;
          if(big){T(s,c.name,{x:tx,y:Y+0.15,w:tw,h:0.32,fontFace:FT,bold:B,fontSize:12.5,color:DARK,fit:'shrink'});T(s,c.sub,{x:tx,y:Y+0.46,w:tw,h:0.26,fontSize:10,color:MUT,fit:'shrink'});
            if(c.tier)pill(s,c.tier,tx,Y+0.76,0.8,TINT,DEEP,9.5,0.26);T(s,c.stat,{x:tx+(c.tier?0.88:0),y:Y+0.76,w:tw-(c.tier?0.88:0),h:0.26,fontFace:FS,bold:B,fontSize:10,color:DARK,fit:'shrink'});
            T(s,lnz(c.why),{x:X+0.2,y:Y+1.08,w:cw-0.35,h:0.48,fontSize:9.5,color:MUT,fit:'shrink'})}
          else{T(s,c.name,{x:tx,y:Y+0.06,w:tw,h:0.26,fontFace:FT,bold:B,fontSize:11,color:DARK,fit:'shrink'});T(s,c.sub,{x:tx,y:Y+0.31,w:tw,h:0.2,fontSize:8.5,color:MUT,fit:'shrink'});
            T(s,[c.tier,c.stat].filter(Boolean).join(' · '),{x:tx,y:Y+0.53,w:tw,h:0.2,fontFace:FS,bold:B,fontSize:8.5,color:DEEP,fit:'shrink'})}}}
      source(s,`※ ${today().replace(/-/g,'.')} 기준 · 평균 조회 = 탐색 시점 최근 콘텐츠 조회 중앙값(유튜브는 채널 평균) 또는 링컴즈 집행 캠페인 평균 · 섭외 가능 여부와 단가는 확정 전입니다.`)},
    kpi(s){head(s,`${sec('exec')} · EXPECTED RESULTS`,AI.kpiTitle||`예상 조회수 ${cK(K.views)},\nCPV ${K.cpv.toFixed(1)}원을 목표로 합니다`,'링컴즈가 집행한 캠페인의 티어별 평균 조회와 보수적인 ER로 계산했습니다.');pill(s,'집행 캠페인 평균 기반 예상치',W-MX-3.1,2.2,3.1,TINT,DEEP,10);
      const tiles=[['총 조회수',cK(K.views),`콘텐츠 ${K.people}개 기준`],['평균 ER',pc(K.er),'보수적 적용 · 참여 ÷ 조회'],['총 좋아요',cK(Math.round(K.likes/100)*100),`총 참여 약 ${cK(Math.round(K.eng/100)*100)}`],['CPV',K.cpv.toFixed(1)+'원',`광고비 기준 ${K.cpvExec.toFixed(1)}원`]];
      const gap=0.25,cw=(7.9-gap)/2;tiles.forEach((t,i)=>{const X=MX+(i%2)*(cw+gap),Y=2.95+Math.floor(i/2)*1.78,on=!i;box(s,X,Y,cw,1.6,on?TH:SOFT);T(s,t[0],{x:X+0.3,y:Y+0.18,w:cw-0.6,h:0.32,fontFace:FS,bold:B,fontSize:12,color:on?ONC:MUT});
        T(s,t[1],{x:X+0.3,y:Y+0.52,w:cw-0.6,h:0.65,fontFace:FT,bold:B,fontSize:31,color:on?ONC:DARK,fit:'shrink'});T(s,t[2],{x:X+0.3,y:Y+1.17,w:cw-0.6,h:0.28,fontSize:10,color:on?ONC:MUT})});
      const bx=8.8,bw=W-MX-bx;box(s,bx,2.95,bw,3.38,SOFT);T(s,'시나리오별 총 조회수',{x:bx+0.25,y:3.08,w:3.5,h:0.32,fontFace:FS,bold:B,fontSize:12,color:DARK});
      const sc=[['보수',0.7,mix(TH,.55)],['기준',1,TH],['확장',1.4,DEEP]];const top=3.85,base=5.85,maxV=K.views*1.4||1,colW=(bw-0.6)/3;sc.forEach(([l,f,c],i)=>{const v=K.views*f,h=(base-top-0.35)*v/maxV,X=bx+0.3+i*colW+colW*0.18,w=colW*0.64;
        if(h>0.01)rect(s,X,base-h,w,h,c);T(s,cK(v),{x:X-0.2,y:base-h-0.34,w:w+0.4,h:0.3,fontFace:FS,bold:B,fontSize:10.5,color:DARK,align:'center'});T(s,`${l} ×${f}`,{x:X-0.2,y:base+0.05,w:w+0.4,h:0.3,fontFace:FS,bold:B,fontSize:11,color:DARK,align:'center'})});
      source(s,'※ CPV = 총 예산(대행수수료 포함, VAT 별도) ÷ 조회수 · 측정 기준 업로드 후 D+7 · 실제 성과는 콘텐츠 반응에 따라 달라질 수 있습니다.')},
    timeline(s){const t=AI.timeline||{};const wd=weekDates(I);head(s,`${sec('timeline')} · TIMELINE`,t.title||`${wd.last+1}주 동안,\n${K.people}개 콘텐츠로 피드를 채웁니다`,t.sub||'제안 확정 후 1주 안에 섭외 리스트업을 마칩니다.\n모든 그룹은 같은 주에 동시에 업로드합니다.');
      const u=wd.up,last=wd.last;const tasks=[['제안 확정 · 섭외 리스트업',0,0,false],['섭외 · 계약 (모두싸인)',1,Math.max(1,u-2),false],['브리프 · 온보딩 · 가편 검수',Math.max(1,u-2),u-1,false],['A·B·C 그룹 동시 업로드',u,u,true],['1차 리포트 (D+7)',u+1,u+1,false],['상위 콘텐츠 2차 활용 · 광고 소재화',u+1,Math.min(last,u+2),false],['실시간 리포트 (ad.ringcoms.com)',u,last,false],['최종 리포트',last,last,true]];
      const lw=3.75,gx=MX+lw,gw=W-MX-gx,colW=gw/(last+1),y0=2.95,rh=0.47;for(let j=0;j<=last;j++){T(s,[{text:'W'+j,options:{bold:true,fontSize:12,color:DARK,breakLine:true}},{text:wd.wk(j),options:{fontSize:9,color:MUT}}],{x:gx+j*colW,y:y0,w:colW,h:0.52,fontFace:FT,align:'center'});if(j)rect(s,gx+j*colW,y0+0.6,0.01,tasks.length*rh+0.1,LINE)}
      tasks.forEach(([nm,a,b,hot],i)=>{const Y=y0+0.66+i*rh;T(s,nm,{x:MX,y:Y,w:lw-0.2,h:rh-0.06,fontFace:hot?FS:FB,bold:hot&&B,fontSize:11.5,color:DARK,fit:'shrink'});box(s,gx+a*colW+0.06,Y+0.08,(b-a+1)*colW-0.12,rh-0.22,hot?TH:TINT,{r:0.08})})},
    appx(s,i){const IX=+i;if(IX===0){head(s,'APPENDIX A · 성과 추정 기준','예상 성과는\n이렇게 계산했습니다','티어별 인원 × 링컴즈 집행 캠페인 평균 조회 = 예상 조회수 · ER은 보수적으로 적용했습니다.',{bg:'FAFAFB'});
        const tbl=(x0,y0,title,cols,ws,rows,tot)=>{T(s,title,{x:x0,y:y0,w:6,h:0.32,fontFace:FT,bold:B,fontSize:13,color:DARK,fit:'shrink'});let x=x0;const yh=y0+0.42;cols.forEach((c,k)=>{T(s,c,{x:x+0.06,y:yh,w:ws[k]-0.12,h:0.3,fontFace:FS,bold:B,fontSize:10.5,color:MUT,align:k?'right':'left'});x+=ws[k]});const tw=ws.reduce((a,b)=>a+b,0);
          rows.forEach((r,j)=>{const Y=yh+0.36+j*0.48;rect(s,x0,Y,tw,0.012,LINE);let cx=x0;r.forEach((v,k)=>{T(s,String(v),{x:cx+0.06,y:Y+0.06,w:ws[k]-0.12,h:0.36,fontFace:k?FB:FS,bold:!k&&B,fontSize:12,color:DARK,align:k?'right':'left'});cx+=ws[k]})});
          const yt=yh+0.36+rows.length*0.48;rect(s,x0,yt,tw,0.02,DARK);let cx=x0;tot.forEach((v,k)=>{T(s,String(v),{x:cx+0.06,y:yt+0.06,w:ws[k]-0.12,h:0.36,fontFace:FT,bold:B,fontSize:12,color:TH,align:k?'right':'left'});cx+=ws[k]})};
        const bm=K.bm;tbl(MX,2.95,`${BR} 추정`,['티어','인원','평균 조회','ER','예상 조회수'],[1.2,0.85,1.35,0.9,1.5],K.R.filter(r=>r.count).map(r=>[r.tier,r.count+'명',won(bm.views[r.tier]),pc(K.er),won(r.count*bm.views[r.tier])]),['합계',K.people+'명','',pc(K.er),won(K.views)]);
        tbl(7.15,2.95,`참고 · ${bm.name}`,['티어','콘텐츠','평균 조회','ER','CPV'],[1.3,0.95,1.2,0.9,1.15],PT.map(t=>[t,bm.src[t]==='기본값'?'기본값':won(bm.acc[t].n)+'개',won(bm.views[t]),pc(bm.er[t],2),bm.cpv[t].toFixed(1)+'원']),['합계',bm.real?won(bm.tot.n)+'개':'-',bm.real&&bm.tot.n?won(bm.tot.views/bm.tot.n):'-',bm.real&&bm.tot.views?pc(bm.tot.eng/bm.tot.views,2):'-',bm.real&&bm.tot.cost&&bm.tot.views?(bm.tot.cost/bm.tot.views).toFixed(1)+'원':'-']);
        box(s,MX,6.0,W-2*MX,0.8,'FFFFFF',{line:LINE});T(s,`산식 · 예상 조회수 = Σ(티어별 인원 × 평균 조회) · 참여 = 조회 × ER(${pc(K.er)}) · 좋아요 = 참여 × 0.92 · CPV = 총 예산(대행수수료 포함) ÷ 조회수 · 보수/기준/확장 = 0.7/1.0/1.4배\n실측이 콘텐츠 3개 미만인 티어는 ${BENCH0.name} 실측값을 썼습니다. 앱 설치·클릭 추정치는 넣지 않았습니다.`,{x:MX+0.25,y:6.0,w:W-2*MX-0.5,h:0.8,fontSize:9.5,color:MUT,fit:'shrink'})}
      else{head(s,'APPENDIX B · 섭외 기준 & 리스크 관리','섭외는 꼼꼼하게,\n리스크는 미리 막습니다','브랜드와 크리에이터 모두에게 득이 되는 구조로 섭외하고, 업로드 전 검수로 리스크를 줄입니다.',{bg:'FAFAFB'});
        [['섭외 기준',['최근 콘텐츠 조회 중앙값·ER로 실제 반응을 확인합니다.','채널 카테고리·톤이 그룹 컨셉과 맞는지 봅니다.','최근 광고 빈도와 경쟁사 협업 여부를 확인합니다.','팔로워 급증·비정상 반응 계정은 제외합니다.']],['리스크 관리',['가편 검수 후 업로드합니다 (수정 2회 포함).','#광고 표기 등 표시·광고 지침을 지킵니다.','효능·효과를 단정하는 표현은 쓰지 않습니다.','일정이 밀리면 대체 후보로 바로 교체합니다.','이슈는 실시간 리포트로 즉시 공유합니다.']]].forEach(([h,it],k)=>{const X=MX+k*6.17,w=5.9;box(s,X,2.95,w,3.25,'FFFFFF',{line:LINE});
          T(s,h,{x:X+0.35,y:3.15,w:w-0.7,h:0.42,fontFace:FT,bold:B,fontSize:16,color:DARK});T(s,it.map(x=>'• '+x).join('\n'),{x:X+0.35,y:3.7,w:w-0.7,h:2.35,fontSize:13,color:DARK,lineSpacingMultiple:1.35,fit:'shrink'})})}},
    async closing(s){pg++;s.background={color:DARK};s.addImage({data:ring,x:(W-5.2)/2,y:0.9,w:5.2,h:5.2});logo(s,true);if(imgs.closing)await put(s,imgs.closing,(W-4)/2,0.75,4,1.85);T(s,'감사합니다',{x:0,y:2.75,w:W,h:1.0,fontFace:FT,bold:B,fontSize:46,color:'FFFFFF',align:'center'});
      T(s,lnz(AI.closing||[String((AI.umbrella||{}).name||'').replace(/\n/g,' '),L((AI.umbrella||{}).hashtags)[0]].filter(Boolean).join('  ')),{x:0.8,y:3.85,w:W-1.6,h:0.5,fontFace:FL,fontSize:16,color:'FFFFFF',align:'center',fit:'shrink'});
      T(s,'링컴즈 MCN 사업부 광고콘텐츠팀  ·  ac@ringcoms.com',{x:0,y:6.7,w:W,h:0.32,fontSize:11,color:'DDDDDD',align:'center'})},
    async eod(s){pg++;s.background={color:DARK};s.addImage({data:ring,x:(W-5.2)/2,y:1.15,w:5.2,h:5.2});logo(s,true);if(imgs.closing)await put(s,imgs.closing,(W-4)/2,0.75,4,1.85);T(s,'E.O.D',{x:0,y:2.75,w:W,h:1.2,fontFace:FT,bold:B,fontSize:72,color:'FFFFFF',align:'center'});
      T(s,'END OF DOCUMENT',{x:0,y:3.95,w:W,h:0.4,fontFace:FL,fontSize:14,color:'DDDDDD',align:'center'});T(s,`링컴즈 MCN 사업부 광고콘텐츠팀  ·  ac@ringcoms.com  ·  ${today().replace(/-/g,'.')}`,{x:0,y:6.7,w:W,h:0.32,fontSize:11,color:'DDDDDD',align:'center'})}
  };
  for(const id of seq){const [nm,arg]=id.split(':');if(!S[nm])continue;if(nm==='showcase'&&!GKEYS.some(k=>picksOf(P,k).length||(G[k].persona||[]).length))continue;const s=deck.addSlide();if(!['cover','toc','closing','eod'].includes(nm))secNo++;await S[nm](s,arg);notes(s,nm==='group'?'group'+arg:nm==='guide'?'guide'+arg:nm)}
  return deck}

/* ============ 데모용 예시 결과 ============ */
function mockAi(I){const b=I.brand||'Petbbi';const g=(key,name,pillar,kw,cn,tags)=>({key,name,pillar,who:'실제로 쓰는\n타깃 인플루언서',role:'진짜 사용 경험으로\n신뢰를 만듭니다',content:'얼굴 정면 + 화면 녹화\n설명형 숏폼',effect:'공감 · 저장\n댓글 대화',keywords:kw,
  concept:{name:cn,hashtags:tags,story:['매일 하던 그 행동이,','처음으로 대답을 받는 순간.',`${b}가 그 순간을 만듭니다.`,'보는 사람도 해 보고 싶어집니다.'],keyMessage:`${b}로 처음 만나는 경험`,features:'핵심 기능 1 · 핵심 기능 2'},
  guide:{title:`${name} 콘텐츠 가이드,\n30초 설명형 숏폼`,sub:'인플루언서가 직접 촬영·편집합니다.\n연기 대신 설명으로 보여 주세요.',cuts:[{step:'HOOK',time:'0~3초',scene:'얼굴 정면 한 컷,\n궁금증 던지기',line:'"이거 진짜\n되는 거야?"'},{step:'FEATURE',time:'3~12초',scene:'앱 화면 녹화로\n핵심 기능 보여 주기',line:'"버튼 하나면\n바로 돼요"'},{step:'PROOF',time:'12~22초',scene:'실제 사용 결과\n화면으로 보여 주기',line:'"결과 보고\n깜짝 놀랐어요"'},{step:'CTA',time:'22~30초',scene:'얼굴 정면,\n링크 안내',line:'"프로필 링크에서\n해 보세요"'}],caption:`#광고 ${b}로 처음 해 본 경험 🐾\n생각보다 훨씬 쉬웠어요.\n프로필 링크에서 확인해 보세요!\n${tags.join(' ')}`,must:['첫 3초 안에 얼굴 정면','앱 화면 녹화 1컷 이상','#광고는 캡션 맨 앞'],dont:['연기·상황극','효과 단정 표현','타사 제품 노출']},
  persona:[{type:`${kw[0]} 채널을 운영하는\n20대 크리에이터`,tier:'마이크로',why:'타깃과 같은 일상을 보여 주며\n높은 ER로 대화를 만듭니다'}],
  feature:{items:[{name:'핵심 기능 1',desc:'한 줄 설명'},{name:'핵심 기능 2',desc:'한 줄 설명'},{name:'핵심 기능 3',desc:'한 줄 설명'}],effect:'이 그룹이 만드는 효과 한 줄'}});
  return {brand:b,advertiser:I.advertiser||'예시 광고주',product:I.product||'예시 앱',category:'반려동물 앱',color:'#FF6B35',cover:{headline:'우리 아이 마음,\n처음 듣는 순간',sub:`${b} 인플루언서 캠페인 제안`},
    market:{title:'반려인 1,500만 시대,\n대화는 여전히 한쪽뿐',sub:'반려동물을 가족으로 여기는 사람은 늘었습니다.\n하지만 마음을 알 방법은 여전히 부족합니다.',stats:[{label:'반려 인구',value:'1,546',unit:'만 명',desc:'국민 4명 중 1명이\n반려동물과 삽니다'},{label:'가족 인식',value:'87',unit:'%',desc:'반려동물을\n가족으로 생각합니다'},{label:'펫테크 시장',value:'↑',unit:'',desc:'관리·소통 앱\n관심이 커지고 있습니다'}],source:'출처: 데모 예시 수치 (실제 제안서에서는 조사 출처 표기)',
      title2:'마음을 알고 싶은 마음,\n이미 콘텐츠가 되고 있습니다',sub2:'반려동물 속마음 콘텐츠는 숏폼에서 높은 반응을 얻습니다.',insights:[{kicker:'콘텐츠',value:'속마음 더빙',text:'반려동물 시점 콘텐츠가\n꾸준히 인기입니다'},{kicker:'행동',value:'기록 · 공유',text:'일상을 기록하고\n나누는 반려인이 많습니다'},{kicker:'니즈',value:'소통',text:'더 잘 이해하고 싶다는\n니즈가 큽니다'}],takeaway:`상상만 하던 대화를\n실제 경험으로 바꿔 주는 것,\n그것이 ${b}의 기회입니다.`,source2:'출처: 데모 예시'},
    direction:{title:`${b}가 나아갈 방향,\n기능에서 경험으로`,sub:'기능 설명보다 경험의 순간을 보여 줘야 합니다.',shifts:[{from:'기능 소개',to:'경험 공유',desc:'써 본 사람의 반응으로 보여 줍니다'},{from:'일회성 노출',to:'반복 참여',desc:'해시태그로 참여를 이어 갑니다'},{from:'기존 고객',to:'잠재 고객',desc:'키우고 싶은 사람까지 넓힙니다'}],positioning:`${b} = 반려동물과 대화하는 첫 번째 앱`},
    umbrella:{name:'우리 아이 마음,\n처음 듣는 순간',sub:'실사용자의 공감, 주인공 채널의 참여, 잠재 타깃의 확장으로\n캠페인을 완성합니다.',hashtags:['#처음듣는그목소리','#펫이직접말함']},
    groups:[g('A','실사용 집사','공감·인지',['반려동물','강아지','고양이'],'우리 애가\n말을 했다',['#우리애가말을했다','#처음듣는그목소리']),g('B','펫 주인공 채널','참여·확산',['펫','동물','고양이'],'본인 등판',['#본인등판','#펫이직접말함']),g('C','예비 집사','확장·신규',['라이프','일상','자취'],'키우기 전에\n키워 봄',['#예비집사연습중','#키우기전에키워봄'])],
    tierWhy:{메가:{role:'도달',why:'비용 대비 효율이 낮아 제외'},매크로:{role:'도달',why:'초기 도달을 넓게 엽니다'},마이크로:{role:'참여',why:'높은 ER로 대화를 만듭니다'},나노:{role:'확산',why:'진정성 있는 후기를 쌓습니다'}},
    matrixPoints:['A그룹은 매크로로\n첫 도달을 엽니다','B그룹은 마이크로 중심으로\n참여를 끌어올립니다','C그룹은 나노로\n신규 타깃을 넓힙니다'],timeline:{title:'',sub:''},closing:'우리 아이 마음, 처음 듣는 순간 — #처음듣는그목소리',checks:['데모 결과입니다. 실제로는 Gemini가 소개서·시장 조사로 작성합니다.'],notes:{cover:'안녕하세요, 링컴즈 MCN 광고콘텐츠팀입니다.'}}}

/* ============ 저장 · 감시 ============ */
async function pSave(top,P){P=P||curP();if(!P||!canEdit())return;try{await DB.update('guides/'+A.pid,{[top]:clone(P[top]),updatedAt:new Date().toISOString(),by:A.user.email})}catch(e){saveErr(e)}}
const IMGDOC={p:'',cut:'__cut',av:'__av'};const IMGST={p:'pimgs',cut:'pcimgs',av:'pavs'};
function watchPimg(){if(A.pimgFor!==A.pid){['cut','av'].forEach(t=>{const u='unsubP'+t;if(A[u]){A[u]();A[u]=null}A[IMGST[t]]={};if(A.pid)A[u]=DB.watchDoc('guideimg/'+A.pid+IMGDOC[t],d=>{A[IMGST[t]]=(d&&d.imgs)||{};schedPv();scheduleRender()},()=>{})})}watchPimg0()}
function watchPimg0(){if(A.pimgFor===A.pid)return;if(A.unsubPimg){A.unsubPimg();A.unsubPimg=null}A.pimgFor=A.pid;A.pimgs={};if(!A.pid)return;A.unsubPimg=DB.watchDoc('guideimg/'+A.pid,d=>{A.pimgs=(d&&d.imgs)||{};schedPv();scheduleRender()},()=>{})}
function pAiRunning(P){return P&&P.aiStatus==='진행 중'&&P.aiAt&&(Date.now()-new Date(P.aiAt).getTime()<15*60*1000)}
window.ppAiCheck=function(){if(!canEdit()||!A.props)return;Object.entries(A.props).forEach(([pid,P])=>{const seen=ppAiCheck.done||(ppAiCheck.done=new Set());if(P.aiStatus==='완료'&&P.aiResult&&!seen.has(P.aiJob)){seen.add(P.aiJob);let j=null;try{j=JSON.parse(P.aiResult)}catch(e){}if(j)pApply(pid,P,j)}
  if(P.aiStatus==='실패'&&P.aiError&&!seen.has('e'+P.aiJob)&&A.pid===pid){seen.add('e'+P.aiJob);toast('AI 제안서 작성 실패: '+P.aiError,'crit')}})};
async function pApply(pid,P,j){const ai=j.ai||{};delete ai.timeline;/* 타임라인 제목은 실제 일정(주차·동시 업로드)에 맞춰 자동 */const info={...(P.info||{})};['advertiser','brand','product','category'].forEach(k=>{if(!String(info[k]||'').trim()&&ai[k])info[k]=ai[k]});if(!info.color&&/^#?[0-9a-f]{6}$/i.test(String(ai.color||'')))info.color=('#'+String(ai.color).replace('#','')).toUpperCase();
  const tmp={...P,info,ai};const picks={...(P.picks||{})};GKEYS.forEach(k=>{if(!(picks[k]||[]).length){picks[k]=poolCands(tmp,k).filter(x=>x.hit).slice(0,2).map(x=>x.id)}});
  const title=P.title&&!/^새 광고 제안서/.test(P.title)?P.title:`${info.brand||info.advertiser||'광고주'} 인플루언서 캠페인 제안서`;
  try{await DB.update('guides/'+pid,{ai,info,picks,title,aiMeta:{model:j.model||'',research:j.research||{},pages:j.pages||[],at:new Date().toISOString()},aiStatus:'적용됨',aiResult:DB.DEL,updatedAt:new Date().toISOString()});
    if(A.props&&A.props[pid])Object.assign(A.props[pid],{ai,info,picks,title,aiStatus:'적용됨'});if(A.pid===pid){A.ptab='preview';toast('AI가 제안서를 채웠습니다. 이어서 섭외 후보를 찾습니다. 미리보기에서 확인하고, 「제안서 내용」에서 다듬어 주세요.');setTimeout(()=>ppDiscover(true),300)}schedPv();render()}catch(e){saveErr(e)}}

/* ============ 상품소개서 읽기 (PDF·텍스트·이미지) ============ */
async function pdfLib(){if(!window.pdfjsLib){await loadScript('/vendor/pdf.min.js');window.pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.js'}return window.pdfjsLib}
const SRC_MAX=50*1024*1024;
/* PPTX: 슬라이드 글자(<a:t>) + 슬라이드별 가장 큰 이미지 → 쪽 이미지 */
async function readPptx(file){if(!window.JSZip)await loadScript('/vendor/pptxgen.bundle.js');const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>+a.match(/(\d+)\.xml/)[1]-+b.match(/(\d+)\.xml/)[1]);let text='';const pages=[];const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
  for(let i=0;i<Math.min(names.length,60);i++){const n=names[i],no=i+1;const xml=await zip.file(n).async('string');const paras=xml.split(/<\/a:p>/).map(pp=>(pp.match(/<a:t>([^<]*)<\/a:t>/g)||[]).map(t=>t.slice(5,-6)).join('')).filter(Boolean);
    text+=`\n[${no}쪽]\n`+paras.join('\n').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
    if(pages.length<24){const rel=zip.file(n.replace('slides/','slides/_rels/')+'.rels');if(rel){const rx=await rel.async('string');const ims=[...rx.matchAll(/Target="\.\.\/media\/([^"]+)"/g)].map(m=>'ppt/media/'+m[1]).filter(f=>MIME[(f.split('.').pop()||'').toLowerCase()]&&zip.file(f));
      let best=null,bs=0;for(const f of ims){const sz=(zip.file(f)._data||{}).uncompressedSize||0;if(sz>bs){bs=sz;best=f}}
      if(best&&bs>8000){const b64=await zip.file(best).async('base64');const raw=`data:${MIME[best.split('.').pop().toLowerCase()]};base64,${b64}`;pages.push({n:no,data:await shrink(raw,900)})}}}}
  return {text:text.trim(),pages,count:names.length}}
async function readSrc(file){const P=curP();if(!P)return;const nm=file.name||'소개서';const info={...(P.info||{})};
  if(file.size>SRC_MAX)return toast(`파일이 너무 큽니다 (${(file.size/1048576).toFixed(0)}MB). 50MB 이하로 올려 주세요. PPT는 이미지 압축(파일 → 그림 압축) 후 저장하거나 PDF로 저장해 올려 주세요.`,'crit');
  if(/\.ppt$/i.test(nm))return toast('예전 PPT(.ppt) 형식은 읽을 수 없습니다. PowerPoint에서 .pptx나 PDF로 저장해 올려 주세요.','crit');
  try{if(/\.pptx$/i.test(nm)||/presentationml/.test(file.type)){toast('PPT 소개서를 읽는 중입니다…');const r=await readPptx(file);A.ppPages={pid:A.pid,list:r.pages};info.srcText=r.text.slice(0,40000);info.srcName=nm;info.srcPages=r.count;
      if(info.srcText.replace(/\[\d+쪽\]/g,'').trim().length<200)toast('PPT에서 글자를 거의 읽지 못했습니다(이미지로 된 슬라이드). 핵심 문구를 아래 메모 칸에 붙여넣어 주세요.','crit');else toast(`PPT ${r.count}장을 읽었습니다.${r.pages.length?' 슬라이드 이미지를 표지 이미지로 쓸 수 있어요.':''}`)}
    else if(/pdf$/i.test(file.type)||/\.pdf$/i.test(nm)){toast('소개서를 읽는 중입니다…');const lib=await pdfLib();const doc=await lib.getDocument({data:await file.arrayBuffer()}).promise;let text='';const pages=[];const NP=Math.min(doc.numPages,40);
      for(let i=1;i<=NP;i++){const pg=await doc.getPage(i);const tc=await pg.getTextContent();text+=`\n[${i}쪽]\n`+tc.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').replace(/[ \t]+/g,' ');
        if(i<=24){const vp=pg.getViewport({scale:1});const k=Math.min(1.4,900/Math.max(vp.width,vp.height));const v2=pg.getViewport({scale:k});const cv=document.createElement('canvas');cv.width=v2.width;cv.height=v2.height;await pg.render({canvasContext:cv.getContext('2d'),viewport:v2}).promise;pages.push({n:i,data:cv.toDataURL('image/jpeg',0.82)})}}
      A.ppPages={pid:A.pid,list:pages};info.srcText=text.trim().slice(0,40000);info.srcName=nm;info.srcPages=doc.numPages;
      if(info.srcText.replace(/\[\d+쪽\]/g,'').trim().length<200)toast('PDF에서 글자를 거의 읽지 못했습니다(이미지로 된 PDF). 소개서의 핵심 문구를 아래 메모 칸에 붙여넣어 주세요.','crit');else toast(`소개서 ${doc.numPages}쪽을 읽었습니다. 아래 쪽 이미지를 눌러 표지 이미지로 쓸 수 있어요.`)}
    else if(/^text\//.test(file.type)||/\.(txt|md|csv)$/i.test(nm)){info.srcText=(await file.text()).slice(0,40000);info.srcName=nm;toast('소개서 글자를 읽었습니다.')}
    else if(/^image\//.test(file.type)){const d=await fileToDataUrl(file,1100,1100,'image/jpeg',0.82);A.ppPages={pid:A.pid,list:[...((A.ppPages&&A.ppPages.pid===A.pid&&A.ppPages.list)||[]),{n:'이미지',data:d}]};toast('이미지를 넣었습니다. 아래에서 표지 이미지로 지정하세요.');render();return}
    else return toast('PDF·PPT(.pptx)·텍스트·이미지 파일을 올려 주세요.','crit');
    P.info=info;await pSave('info',P);render()}catch(e){console.error(e);toast('소개서를 읽지 못했습니다: '+(e.message||e),'crit')}}
async function pimgPut(slot,data,t='p'){if(!canEdit())return;const imgs={...(A[IMGST[t]]||{}),[slot]:data};const size=Object.values(imgs).reduce((a,b)=>a+String(b).length,0);if(size>950000)return toast('이미지가 너무 큽니다. 다른 이미지를 지우거나 더 작은 이미지를 넣어 주세요.','crit');
  try{await DB.set('guideimg/'+A.pid+IMGDOC[t],{imgs,updatedAt:new Date().toISOString()});A[IMGST[t]]=imgs;A.ppaste='';schedPv();render();if(t!=='av')toast('이미지를 넣었습니다.')}catch(e){saveErr(e)}}
async function pimgDel(slot,t='p'){const im={...(A[IMGST[t]]||{})};delete im[slot];try{await DB.set('guideimg/'+A.pid+IMGDOC[t],{imgs:im,updatedAt:new Date().toISOString()});A[IMGST[t]]=im;schedPv();render()}catch(e){saveErr(e)}}
async function shrink(data,max){return new Promise(r=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));const cv=document.createElement('canvas');cv.width=Math.round(im.naturalWidth*k);cv.height=Math.round(im.naturalHeight*k);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);r(cv.toDataURL('image/jpeg',0.8))};im.onerror=()=>r(data);im.src=data})}

/* ============ 미리보기 ============ */
function schedPv(){clearTimeout(schedPv.t);schedPv.t=setTimeout(buildPv,120)}
async function buildPv(){const el=document.getElementById('pp-pv');const P=curP();if(!el||!P||!P.ai)return;const seq=A.pseq==='sum'?SEQ_SUM:SEQ;const key=JSON.stringify([P.info,P.plan,P.ai,P.picks,seq,[A.pimgs,A.pcimgs,A.pavs].map(o=>Object.keys(o||{}).map(k=>k+String(o[k]).length).join())]);if(el.dataset.k===key&&el.childElementCount)return;
  if(!document.getElementById('pretendard-css')){const l=document.createElement('link');l.id='pretendard-css';l.rel='stylesheet';l.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';document.head.appendChild(l)}
  try{const deck=new HtmlDeck();await ppDeck(deck,P,seq,{pdf:true,imgs:A.pimgs||{},cimgs:A.pcimgs||{},perSlideNo:A.pseq==='sum'});const html=deck.html();const box=document.getElementById('pp-pv');if(!box)return;box.dataset.k=key;
    box.innerHTML=html.split('</section>').filter(x=>x.trim()).map((x,i)=>`<div class="pv-slide"><span class="pv-no">${i+1}</span>${x}</section></div>`).join('');fitPv();HtmlDeck.fit(box)}catch(e){console.error(e);el.innerHTML=`<div class="empty">미리보기를 만들지 못했습니다: ${esc(e.message||e)}</div>`}}
function fitPv(){document.querySelectorAll('#pp-pv .pv-slide').forEach(w=>{const k=w.clientWidth/1280;const pg=w.querySelector('.dk-page');if(pg)pg.style.transform=`scale(${k})`})}
window.addEventListener('resize',()=>{clearTimeout(fitPv.t);fitPv.t=setTimeout(fitPv,100)});

/* ============ 내보내기 ============ */
async function ppExport(kind){const P=curP();if(!P||ppExport.busy)return;if(!P.ai)return toast('먼저 「AI로 제안서 만들기」로 내용을 채워 주세요.','crit');ppExport.busy=true;const PDF=kind==='pdf';const sum=kind==='sum';
  const br=String((P.ai||{}).brand||(P.info||{}).brand||'Brand').replace(/[^A-Za-z0-9가-힣]+/g,'_').replace(/^_|_$/g,'')||'Brand';const name=`${br}_Influencer_Campaign_${sum?'Summary_7p':'Proposal'}_${today().replace(/-/g,'')}`;
  try{toast(PDF?'PDF를 만드는 중입니다… 인쇄 창이 열리면 「PDF로 저장」을 고르세요.':'PPT를 만드는 중입니다…');if(!PDF&&!window.PptxGenJS)await loadScript('/vendor/pptxgen.bundle.js');
    if(PDF&&!document.getElementById('pretendard-print')){const st=document.createElement('style');st.id='pretendard-print';st.textContent="#deck-print .dk-page{font-family:'Pretendard','Malgun Gothic',sans-serif!important}";document.head.appendChild(st)}
    const deck=PDF?new HtmlDeck():new PptxGenJS();deck.layout='LAYOUT_WIDE';deck.title=P.title||'Proposal';if(!PDF){deck.author='RINGCOMS MCN 광고콘텐츠팀';deck.company='RINGCOMS'}
    await ppDeck(deck,P,sum?SEQ_SUM:(A.pseq==='sum'&&PDF?SEQ_SUM:SEQ),{pdf:PDF,imgs:A.pimgs||{},cimgs:A.pcimgs||{},perSlideNo:sum||(PDF&&A.pseq==='sum')});if(PDF)await deck.print(name);else await deck.writeFile({fileName:name+'.pptx'})}
  catch(e){console.error(e);toast('제안서를 만들지 못했습니다: '+(e.message||e),'crit')}finally{ppExport.busy=false}}

/* ============ 섭외 후보 탐색 (유튜브 · 틱톡 · 인스타그램) ============ */
/* 유튜브: 브라우저에서 YouTube Data API 키로 채널 검색 / 틱톡·인스타그램: /api/discover(백그라운드, Apify) */
const DISC_N=6,POOL_N=6;
function discTerms(g){const L=[...(g.search||[]),...(g.keywords||[])].map(x=>String(x).replace(/^#/,'').trim()).filter(x=>x.length>=2);return [...new Set(L)].slice(0,2)}
async function ytDiscover(groups){let key=((A.settings||{}).ytKey||'').trim();if(!key&&typeof loadSettings==='function')key=(((await loadSettings())||{}).ytKey||'').trim();if(!key)throw new Error('YouTube API 키가 연결되지 않았습니다 (연동 관리).');
  const K=encodeURIComponent(key),G='https://www.googleapis.com/youtube/v3/';const out={};
  for(const g of groups){out[g.key]=[];const r=await fetch(`${G}search?part=snippet&type=channel&maxResults=12&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(g.terms.join(' '))}&key=${K}`);const j=await r.json();if(!r.ok)throw new Error(((j.error||{}).message||'YouTube 검색 실패').slice(0,120));
    const ids=(j.items||[]).map(x=>x.snippet&&x.snippet.channelId||x.id&&x.id.channelId).filter(Boolean);if(!ids.length)continue;
    const c=await (await fetch(`${G}channels?part=snippet,statistics&id=${ids.join(',')}&key=${K}`)).json();
    (c.items||[]).forEach(ch=>{const st=ch.statistics||{},sn=ch.snippet||{};const subs=st.hiddenSubscriberCount?null:+st.subscriberCount||null;const vc=+st.videoCount||0;
      out[g.key].push({plat:'yt',id:'yt:'+ch.id,acct:(sn.customUrl||'').replace(/^@/,''),name:sn.title,url:sn.customUrl?'https://www.youtube.com/'+sn.customUrl:'https://www.youtube.com/channel/'+ch.id,followers:subs,avatar:((sn.thumbnails||{}).default||{}).url||'',bio:String(sn.description||'').slice(0,120),avg:vc?(+st.viewCount||0)/vc:null,er:null,basis:'채널 평균 조회',ko:/[가-힣]/.test(sn.title+' '+sn.description)||sn.country==='KR'})})}
  return out}
/* 그룹별 6명 고르기: 원하는 티어·한국어 채널·반응 좋은 순, 채널(플랫폼)을 섞어서, 다른 그룹과 겹치지 않게 */
function pickFound(P,raw){const M=matrixOf(ppCalc(P).R);const used=new Set();const res={};const plats=platsOf(P.info||{}).map(x=>PLAT_K[x]);
  GKEYS.forEach(k=>{const g=((P.ai||{}).groups||[]).find(x=>x.key===k)||{};const want=PT.filter(t=>M[k][t]>0);
    const kw=[...new Set([...(g.keywords||[]),...(g.search||[])].map(x=>String(x).replace(/^#/,'').replace(/(브이로그|일상툰|만화|툰|채널|챌린지|일상)$/,'').trim()).filter(x=>x.length>=2))];
    const L=(raw[k]||[]).filter(c=>plats.includes(c.plat)&&c.followers!=null&&c.followers>=1000&&c.ko!==false).map(c=>{const t=TK[tierOf(c.followers)]||'';const hay=[c.name,c.acct,c.bio,c.hay,c.cat].join(' ');const rel=kw.some(w=>hay.includes(w));
      const eff=c.avg?Math.min(c.avg,Math.max(c.followers*2,1000)):0;/* 영상 1개가 터진 소형 계정 과대평가 방지 */
      const sc=(rel?5:0)+(want.includes(t)?3:t==='메가'?-3:0)+(eff?Math.min(3,Math.log10(eff)-2):0)+(c.er?Math.min(1.5,c.er*30):0)+(c.n>=3?0.5:0);return {...c,tier:t,sc,rel}}).sort((a,b)=>b.sc-a.sc);
    const pool=L.filter(c=>c.rel).length>=DISC_N?L.filter(c=>c.rel):L;
    const by={};pool.forEach(c=>{if(!used.has(c.id))(by[c.plat]=by[c.plat]||[]).push(c)});const out=[];const order=plats.filter(x=>by[x]);let i=0;
    while(out.length<DISC_N&&order.some(x=>by[x].length)){const pl=order[i++%order.length];const c=by[pl].shift();if(c&&!used.has(c.id)){used.add(c.id);
      c.why=[c.basis&&c.avg?`${c.basis} ${cK(c.avg)}`:'',c.bio?c.bio.replace(/\s+/g,' ').slice(0,46):''].filter(Boolean).join(' · ');out.push(c)}}
    res[k]=out.sort((a,b)=>b.sc-a.sc).map(({sc,ko,rel,hay,...c})=>c)});return res}
async function avFetch(found){const all=GKEYS.flatMap(k=>found[k]||[]).filter(c=>c.avatar&&!(A.pavs||{})[c.id]);const got={};
  await Promise.all(all.map(async c=>{try{let d=null;if(c.plat==='yt'){const r=await fetch(c.avatar);if(r.ok){const b=await r.blob();d=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>res(null);fr.readAsDataURL(b)})}}
    if(!d){const j=await aiFetch('/api/social-stats',{action:'thumb',url:c.avatar});d=j.data||null}if(d)got[c.id]=await shrink(d,96)}catch(e){}}));
  if(Object.keys(got).length){const imgs={...(A.pavs||{}),...got};const keep=new Set(GKEYS.flatMap(k=>found[k]||[]).map(c=>c.id));Object.keys(imgs).forEach(k=>{if(!keep.has(k))delete imgs[k]});
    try{await DB.set('guideimg/'+A.pid+'__av',{imgs,updatedAt:new Date().toISOString()});A.pavs=imgs}catch(e){}}}
async function ppDiscover(auto){const P=curP();if(!P||!P.ai||A.ppDiscBusy)return;const plats=platsOf(P.info||{});if(!plats.length)return auto||toast('채널을 하나 이상 골라 주세요.','crit');
  const groups=GKEYS.map(k=>{const g=(P.ai.groups||[]).find(x=>x.key===k)||{};return {key:k,terms:discTerms(g)}}).filter(g=>g.terms.length);if(!groups.length)return;
  A.ppDiscBusy=true;render();const pid=A.pid;const errs=[];let yt={};
  if(DB.mode==='demo'){await new Promise(r=>setTimeout(r,600));const raw={};groups.forEach(g=>raw[g.key]=[...Array(9)].map((_,i)=>({plat:['yt','tt','ig'][i%3],id:`${['yt','tt','ig'][i%3]}:demo${g.key}${i}`,acct:`demo_${g.key}${i}`,name:`${g.terms[0]} 크리에이터 ${i+1}`,url:'',followers:[250000,48000,9000][i%3]+i*1000,avatar:'',bio:`${g.terms[0]} 일상을 올리는 채널`,avg:[60000,21000,7000][i%3],er:0.03,basis:'최근 영상 조회 중앙값',ko:true})));
    await discApply(pid,P,raw,[]);A.ppDiscBusy=false;render();return}
  try{if(plats.includes('유튜브')){try{yt=await ytDiscover(groups)}catch(e){errs.push('유튜브: '+e.message)}}
    const sv=plats.filter(x=>x!=='유튜브').map(x=>PLAT_K[x]);const job=uid();
    await DB.update('guides/'+pid,{discYt:JSON.stringify(yt).slice(0,300000),discErrYt:errs.join(' / '),discStatus:sv.length?'진행 중':'완료',discJob:job,discAt:new Date().toISOString(),discResult:sv.length?DB.DEL:JSON.stringify({groups:{},errors:[]}),discError:DB.DEL});
    if(sv.length){await aiFetch('/api/discover',{pid,job,groups,platforms:sv});toast('유튜브·틱톡·인스타그램에서 섭외 후보를 찾는 중입니다. 1~3분 걸리고, 끝나면 자동으로 채워집니다.')}}
  catch(e){toast('섭외 후보 탐색을 시작하지 못했습니다: '+(e.message||e),'crit');DB.update('guides/'+pid,{discStatus:'실패',discError:String(e.message||e)}).catch(()=>{})}finally{A.ppDiscBusy=false;render()}}
async function discApply(pid,P,raw,errors){const found=pickFound(P,raw);const picks={...(P.picks||{})};
  GKEYS.forEach(k=>{const cur=(picks[k]||[]).filter(id=>!/^(yt|tt|ig):/.test(id)||found[k].some(f=>f.id===id));const hasF=cur.some(id=>/^(yt|tt|ig):/.test(id));picks[k]=(hasF?cur:[...found[k].slice(0,2).map(f=>f.id),...cur]).slice(0,MAXPICK)});
  const n=GKEYS.reduce((a,k)=>a+found[k].length,0);
  try{await DB.update('guides/'+pid,{found,picks,discStatus:'적용됨',discErrors:errors.join(' / ').slice(0,600),discResult:DB.DEL,discYt:DB.DEL,updatedAt:new Date().toISOString()});if(A.props&&A.props[pid])Object.assign(A.props[pid],{found,picks,discStatus:'적용됨'});
    if(A.pid===pid){toast(`섭외 후보 ${n}명을 찾았습니다.${errors.length?' (일부 채널 실패: '+errors.join(' / ').slice(0,120)+')':''}`,errors.length&&!n?'crit':undefined);await avFetch(found)}schedPv();render()}catch(e){saveErr(e)}}
window.ppDiscCheck=function(){if(!canEdit()||!A.props)return;Object.entries(A.props).forEach(([pid,P])=>{const seen=ppDiscCheck.done||(ppDiscCheck.done=new Set());
  if(P.discStatus==='완료'&&P.discResult&&!seen.has(P.discJob)&&pid===A.pid){seen.add(P.discJob);let j={},yt={};try{j=JSON.parse(P.discResult)}catch(e){}try{yt=JSON.parse(P.discYt||'{}')}catch(e){}
    const raw={};GKEYS.forEach(k=>raw[k]=[...((yt||{})[k]||[]),...(((j.groups||{})[k])||[])]);discApply(pid,P,raw,[P.discErrYt,...(j.errors||[])].filter(Boolean))}
  if(P.discStatus==='실패'&&!seen.has('e'+P.discJob)&&pid===A.pid){seen.add('e'+P.discJob);let yt={};try{yt=JSON.parse(P.discYt||'{}')}catch(e){}if(GKEYS.some(k=>(yt[k]||[]).length))discApply(pid,P,yt,[P.discError||'틱톡·인스타그램 실패']);else toast('섭외 후보 탐색 실패: '+(P.discError||''),'crit')}})};
function discRunning(P){return P&&P.discStatus==='진행 중'&&P.discAt&&(Date.now()-new Date(P.discAt).getTime()<12*60*1000)}
function pickPanel(P,ed){if(!P.ai)return '<section class="panel"><div class="panel-h"><h2>섭외 후보</h2></div><div class="empty">AI로 그룹을 만든 뒤 탐색·추천됩니다.</div></section>';
  const busy=A.ppDiscBusy||discRunning(P);const pl=platsOf(P.info||{});
  const row=(k,id,on,av,title,sub,stat,url)=>`<label class="pp-cand ${on?'on':''}"><input type="checkbox" data-act="ppPick" data-g="${k}" data-id="${esc(id)}" ${on?'checked':''} ${ed?'':'disabled'}>${av?`<img class="pp-av" src="${av}" alt="">`:`<span class="pp-av pp-av0">${esc(String(title||'?').trim().slice(0,1))}</span>`}<span style="min-width:0"><b>${esc(title)}</b>${url?` <a href="${esc(url)}" target="_blank" rel="noopener" class="small" onclick="event.stopPropagation()">↗</a>`:''}<br><span class="small muted">${esc(sub)}</span><br><span class="small">${esc(stat)}</span></span></label>`;
  return `<section class="panel"><div class="panel-h"><div><h2>섭외 후보</h2><div class="sub">AI가 만든 그룹 검색어로 ${esc(pl.join('·'))}에서 그룹별 ${DISC_N}명을 찾고, 링컴즈 인플루언서 풀에서 ${POOL_N}명을 추천합니다. 그룹마다 최대 ${MAXPICK}명을 골라 「섭외 후보」 장에 넣습니다.</div></div>
    ${ed?`<button class="btn sm primary" data-act="ppDisc" ${busy?'disabled':''}>${busy?'찾는 중… (1~3분)':(P.found?'다시 탐색':'섭외 후보 탐색')}</button>`:''}</div>
   ${P.discErrors?`<div class="banner" style="margin:0 0 10px">일부 채널 탐색 실패: ${esc(P.discErrors)}</div>`:''}
   <div class="grid3 pp-picks">${GKEYS.map(k=>{const g=((P.ai||{}).groups||[]).find(x=>x.key===k)||{};const sel_=(P.picks||{})[k]||[];const F=foundOf(P,k);const C=poolCands(P,k).slice(0,POOL_N);
     return `<div class="pp-pick"><div class="bold">${k} · ${esc(g.name||'')} <span class="small muted">(${sel_.length}/${MAXPICK})</span></div><div class="small muted" style="margin:2px 0 8px">검색어: ${esc(discTerms(g).join(', ')||'–')}</div>
       <div class="small bold" style="margin:4px 0">🔎 탐색 결과 ${F.length?F.length+'명':''}</div>${F.length?F.map(f=>row(k,f.id,sel_.includes(f.id),(A.pavs||{})[f.id],f.name||f.acct,`${PLAT[f.plat]} · ${f.followers?cK(f.followers):'–'} · ${f.tier||''}${f.acct?' · @'+f.acct:''}`,[f.avg?(f.basis||'평균 조회')+' '+cK(f.avg):'',f.er?'ER '+pc(f.er,1):''].filter(Boolean).join(' · ')||'조회 정보 없음',f.url)).join(''):`<div class="small muted" style="padding:6px">${busy?'찾는 중…':'「섭외 후보 탐색」을 눌러 주세요.'}</div>`}
       <div class="small bold" style="margin:10px 0 4px">⭐ 링컴즈 인플루언서 풀</div>${C.length?C.map(c=>row(k,c.id,sel_.includes(c.id),null,c.p.name,[c.t,c.p.ch,c.p.cat].filter(Boolean).join(' · '),`${c.avg?'평균 조회 '+won(c.avg):'집행 기록 없음'}${c.er?' · ER '+pc(c.er,2):''}${c.hit?'':' · 키워드 불일치'}`,c.p.chlink||'')).join(''):'<div class="small muted">풀이 비어 있습니다.</div>'}</div>`}).join('')}</div></section>`}

/* ============ 화면 ============ */
function newProposal(){return {kind:'proposal',title:'새 광고 제안서',status:'작성 중',createdAt:today(),updatedAt:new Date().toISOString(),by:A.user.email,
  info:{advertiser:'',brand:'',product:'',category:'',target:'',objective:OBJ[0],platforms:PLATS.slice(),platform:'인스타그램 릴스 · 틱톡 · 유튜브 쇼츠',links:[],memo:'',srcText:'',srcName:'',budget:'',feeRate:20,feeMode:'incl',start:'',end:'',color:''},plan:{tiers:[],er:2,bench:''},picks:{},ai:null}}
window.viewProposals=function(){ensureToolWatch();if(A.pid)return ppEditor();
  const L=Object.entries(A.props||{}).sort((a,b)=>String(b[1].updatedAt||'').localeCompare(String(a[1].updatedAt||'')));
  return `<div class="page-h"><div><div class="eyebrow">Proposal</div><h1>광고 제안서 생성</h1><div class="sub">상품소개서와 예산·대행수수료·집행 기간만 넣으면, 시장 → 방향 → 컨셉 → 그룹별 가이드 → 인플루언서 구성 → 예상 성과 → 타임라인까지 제안서를 만들어 PPT·PDF로 받습니다.</div></div>
   <div class="row">${aiPill()}${canEdit()?'<button class="btn primary" data-act="ppNew">+ 새 제안서</button>':''}</div></div>
  ${A.guidesErr?rulesBanner():''}
  ${L.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>제안서</th><th>광고주 · 브랜드</th><th class="n">총 예산</th><th class="n">인플루언서</th><th>집행 기간</th><th>상태</th><th>수정</th></tr></thead><tbody>${L.map(([id,P])=>{const I=P.info||{};const K=ppCalc(P);
    return `<tr class="click" data-act="ppOpen" data-p="${esc(id)}"><td class="bold">${esc(P.title||'제목 없음')}</td><td>${esc([I.advertiser,I.brand].filter(Boolean).join(' · ')||'–')}</td><td class="n">${I.budget?won(I.budget)+'원':'–'}</td><td class="n">${K.people||'–'}</td><td class="small">${esc([I.start,I.end].filter(Boolean).join(' ~ ')||'–')}</td><td>${pAiRunning(P)?'<span class="pill accent">AI 작성 중</span>':`<span class="pill ${P.status==='완료'?'ok':P.ai?'accent':''}">${esc(P.ai?(P.status||'작성 중'):'정보 입력 중')}</span>`}</td><td class="small">${md(String(P.updatedAt||'').slice(0,10))}</td></tr>`}).join('')}</tbody></table></div>`
  :`<div class="panel empty">${A.guidesLoaded?'아직 만든 제안서가 없습니다. 「+ 새 제안서」로 시작하세요.':'불러오는 중…'}</div>`}`};

function ppEditor(){const P=curP();if(!P)return A.guidesLoaded?`<div class="panel empty">제안서를 찾을 수 없습니다. <button class="btn sm" data-act="ppBack">목록으로</button></div>`:'<div class="panel empty">불러오는 중…</div>';watchPimg();
  const ed=canEdit(),I=P.info||{},tab=A.ptab||(P.ai?'preview':'info');const id=p=>'pp_'+p.replace(/[.\s]/g,'_');
  const tx=(p,l,o={})=>{const v=getIn(P,p);return `<label class="f ${o.wide?'wide':''}">${l}<input type="${o.type||'text'}" id="${id(p)}" data-pv="${p}" ${o.t?`data-t="${o.t}"`:''} value="${esc(v??'')}" placeholder="${esc(o.ph||'')}" ${ed?'':'readonly'}>${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`};
  const ta=(p,l,o={})=>{const v=getIn(P,p);return `<label class="f ${o.wide!==false?'wide':''}">${l}<textarea id="${id(p)}" data-pv="${p}" rows="${o.rows||2}" placeholder="${esc(o.ph||'')}" ${ed?'':'readonly'}>${esc(v??'')}</textarea>${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`};
  const tl=(p,l,o={})=>{const v=getIn(P,p)||[];return `<label class="f ${o.wide!==false?'wide':''}">${l}<textarea id="${id(p)}" data-pl="${p}" rows="${o.rows||Math.max(2,v.length)}" placeholder="${esc(o.ph||'한 줄에 하나씩')}" ${ed?'':'readonly'}>${esc(v.join('\n'))}</textarea><span class="hint">${o.hint||'한 줄에 하나씩'}</span></label>`};
  const sel=(p,l,opts,o={})=>{const v=getIn(P,p);return `<label class="f">${l}<select id="${id(p)}" data-pv="${p}" ${ed?'':'disabled'}>${opts.map(x=>{const [val,lab]=Array.isArray(x)?x:[x,x];return `<option value="${esc(val)}" ${String(val)===String(v??'')?'selected':''}>${esc(lab)}</option>`}).join('')}</select>${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`};
  const busy=A.ppBusy||pAiRunning(P);const K=ppCalc(P);
  const tabs=[['info','① 기초 정보'],['plan','② 인플루언서 구성 · 예상 성과'],['content','③ 제안서 내용'],['preview','④ 미리보기 · 다운로드']];
  const head=`<div class="page-h"><div><button class="btn sm ghost" data-act="ppBack">← 제안서 목록</button><h1 style="margin-top:6px">${esc(P.title||'제목 없음')}</h1><div class="sub">${esc([I.advertiser,I.brand,I.budget?'총 '+won(I.budget)+'원':''].filter(Boolean).join(' · '))} · 마지막 수정 ${esc(String(P.updatedAt||'').slice(0,16).replace('T',' '))}</div></div>
   <div class="row"><button class="btn" data-act="ppExp" data-k="pptx" ${P.ai?'':'disabled'}>PPT 본편</button><button class="btn" data-act="ppExp" data-k="sum" ${P.ai?'':'disabled'} title="표지·시장·컨셉·핵심 전략·티어·예상 성과·타임라인 + E.O.D">요약본 7장</button><button class="btn" data-act="ppExp" data-k="pdf" ${P.ai?'':'disabled'}>PDF</button></div></div>
   <div class="tabs pp-tabs" role="tablist">${tabs.map(([k,l])=>`<button class="tab ${tab===k?'on':''}" data-act="ppTab" data-k="${k}" role="tab" aria-selected="${tab===k}">${l}</button>`).join('')}</div>`;
  const aiBox=`<section class="panel ai-box"><div class="panel-h"><div><h2>AI로 제안서 만들기</h2><div class="sub">소개서·링크를 읽고 구글 검색으로 시장 자료를 찾은 뒤, 시장 → 방향 → 컨셉 → 그룹별 가이드까지 씁니다. 인원·단가·예상 성과는 ② 탭 숫자 그대로 들어갑니다.</div></div>${aiPill()}</div>
   ${P.aiStatus==='실패'&&P.aiError?`<div class="banner" style="margin:0 0 10px">AI 작성 실패: ${esc(P.aiError)}</div>`:''}
   <div class="row">${ed?`<button class="btn primary" data-act="ppAi" ${busy?'disabled':''}>${busy?`AI가 제안서를 쓰는 중… ${esc(P.aiStep||'시장 조사 중')} (1~3분)`:P.ai?'AI로 다시 만들기 (내용 덮어쓰기)':'AI로 제안서 만들기'}</button>`:''}<span class="small muted">결과는 초안입니다. 시장 수치·효능 표현·제품 정보는 꼭 확인하세요.</span></div>
   ${P.aiMeta&&P.aiMeta.research&&(P.aiMeta.research.sources||[]).length?`<details style="margin:10px 0 0"><summary class="small bold">시장 조사 출처 ${P.aiMeta.research.sources.length}개</summary><div class="small">${P.aiMeta.research.sources.map(x=>`<a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title||x.uri)}</a>`).join(' · ')}</div></details>`:''}
   ${P.ai&&(P.ai.checks||[]).length?`<div class="banner info" style="margin:10px 0 0"><b>광고주에게 보내기 전 확인</b><br>${(P.ai.checks||[]).map(x=>'• '+esc(x)).join('<br>')}${P.aiMeta&&P.aiMeta.research&&!P.aiMeta.research.ok?'<br>• 이번에는 구글 검색 시장 조사를 하지 못했습니다(무료 검색 한도 등). 시장 수치는 AI가 아는 공개 통계로 채웠으니 출처를 꼭 확인하세요.':''}${P.aiMeta&&/lite/.test(P.aiMeta.model||'')?'<br>• AI 서버가 붐벼 가벼운 모델로 작성했습니다. 품질이 아쉬우면 잠시 뒤 「AI로 다시 만들기」를 눌러 주세요.':''}${GKEYS.every(k=>!((P.picks||{})[k]||[]).length)?'<br>• 인플루언서 풀에 그룹 카테고리와 맞는 인플루언서가 없어, 섭외 후보 장에는 AI가 제안한 「섭외 예정 프로필」이 들어갑니다. ② 탭에서 풀 인플루언서를 직접 고를 수도 있습니다.':''}</div>`:''}</section>`;
  let body='';
  if(tab==='info'){const pages=A.ppPages&&A.ppPages.pid===A.pid?A.ppPages.list:[];const IMG=[['cover','표지'],['divider','간지 (그룹 컨셉 장)'],['closing','마지막 장']];
    body=`<section class="panel"><div class="panel-h"><div><h2>상품소개서</h2><div class="sub">광고주 상품·서비스 소개서를 PDF나 PPT(.pptx)로 올리면 글자를 읽어 AI에 넘기고, 쪽 이미지를 표지 이미지로 쓸 수 있습니다. 파일은 50MB까지 (브라우저 안에서만 읽고 서버에 올리지 않습니다).</div></div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${ed?`<label class="btn primary" style="cursor:pointer">소개서 올리기 (PDF · PPT)<input type="file" accept="application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.txt,.md,image/*" data-ppsrc="1" hidden></label>`:''}
       ${I.srcName?`<span class="pill ok">${esc(I.srcName)} · ${I.srcPages?I.srcPages+'쪽 · ':''}${won(String(I.srcText||'').length)}자</span>${ed?'<button class="btn sm ghost" data-act="ppSrcClear">지우기</button>':''}`:'<span class="small muted">아직 올린 소개서가 없습니다.</span>'}</div>
      ${pages.length?`<p class="small muted" style="margin:12px 0 6px">쪽 이미지를 고른 뒤 넣을 자리를 누르세요. (페이지 새로 고침 뒤에는 소개서를 다시 올려야 이미지가 보입니다)</p><div class="pp-pages">${pages.map((p,i)=>`<figure class="pp-page ${A.ppSel===i?'on':''}" data-act="ppPageSel" data-i="${i}"><img src="${p.data}" alt="${esc(String(p.n))}쪽"><figcaption>${esc(String(p.n))}${typeof p.n==='number'?'쪽':''}</figcaption></figure>`).join('')}</div>
        ${ed&&A.ppSel!=null?`<div class="row" style="margin-top:8px;gap:6px"><span class="small bold">고른 이미지를 →</span>${IMG.map(([k,l])=>`<button class="btn sm" data-act="ppPageUse" data-k="${k}">${l}</button>`).join('')}</div>`:''}`:''}
      <div class="fgrid" style="margin-top:12px">${tl('info.links','광고주 홈페이지 · 상품 링크 (선택)',{rows:2,ph:'https://brand.com',hint:'한 줄에 하나씩, 최대 3개'})}${ta('info.memo','담당자 메모 · 광고주 요청 (선택)',{rows:3,ph:'광고주 브리프, 꼭 넣을 메시지, 피할 표현, 경쟁사 등'})}</div></section>
     <section class="panel"><div class="panel-h"><h2>기초 정보</h2><span class="sub">비워 두면 AI가 소개서에서 찾습니다</span></div><div class="fgrid">
      ${tx('info.advertiser','광고주 (회사)')}${tx('info.brand','브랜드 공식 표기',{ph:'예: Petbbi (영문 표기 그대로)'})}${tx('info.product','제품 · 서비스')}${tx('info.category','제품 분야',{ph:'예: 반려동물 앱'})}
      ${tx('info.target','주요 타깃',{ph:'예: 2030 반려인'})}${sel('info.objective','캠페인 목적',OBJ)}<div class="f">채널 · 형식 (여러 개 선택)<div class="chips" style="margin-top:4px">${PLATS.map(x=>`<label class="chip ${platsOf(I).includes(x)?'on':''}" style="cursor:pointer"><input type="checkbox" data-pplat="${x}" ${platsOf(I).includes(x)?'checked':''} ${ed?'':'disabled'} style="margin:0 4px 0 0">${x}</label>`).join('')}</div><span class="hint">${esc(platsOf(I).map(x=>PLAT_FMT[x]).join(' · ')||'하나 이상 골라 주세요')} · 섭외 후보도 고른 채널에서 찾습니다</span></div>
      <label class="f">브랜드 컬러 (제안서 톤)<span class="row" style="flex-wrap:nowrap"><input type="color" id="pp_color" data-pv="info.color" value="${esc(I.color||(P.ai&&P.ai.color)||'#2F5BEA')}" style="width:48px;padding:2px;height:34px" ${ed?'':'disabled'}><span class="small muted">${esc(I.color||'AI가 소개서 색으로 추천')}</span></span></label></div></section>
     <section class="panel"><div class="panel-h"><h2>예산 · 대행수수료 · 집행 기간</h2><span class="sub">금액은 VAT 별도</span></div><div class="fgrid">
      ${tx('info.budget','총 예산 (원)',{t:'num',ph:'10,000,000',hint:I.budget?won(I.budget)+'원':''})}${tx('info.feeRate','대행수수료율 (%)',{t:'num',ph:'20'})}
      ${sel('info.feeMode','대행수수료 방식',[['incl','총 예산에 포함 (광고비 = 예산 ÷ (1+수수료율))'],['excl','총 예산 = 광고비, 수수료 별도']])}
      ${tx('info.start','집행 시작 (업로드 시작)',{type:'date'})}${tx('info.end','집행 종료',{type:'date'})}</div>
      ${I.budget?`<p class="small muted" style="margin:8px 0 0">집행 가능 광고비 ${won(K.execMax)}원 → 자동 구성 광고비 ${won(K.ad)}원 + 대행수수료 ${won(K.fee)}원 = 총 ${won(K.total)}원 · 인플루언서 ${K.people}명</p>`:''}</section>
     <section class="panel"><div class="panel-h"><div><h2>표지 이미지 (선택)</h2><div class="sub">표지·간지(그룹 컨셉 장)·마지막 장에 넣을 이미지입니다. 위 소개서 쪽 이미지를 고르거나, 파일로 넣거나, 칸을 누르고 Ctrl+V로 붙여넣으세요. 컷별 예시 이미지는 ③ 제안서 내용 탭에서 넣습니다.</div></div></div>
      <div class="pp-imgs pp-imgs3">${IMG.map(([k,l])=>{const im=(A.pimgs||{})[k];return `<div class="pp-img ${A.ppaste===k?'paste-on':''}" tabindex="0" data-ppaste="${k}"><div class="small bold">${l}</div><div class="pp-img-b">${im?`<img src="${im}" alt="${l}">`:`<span class="small muted">${A.ppaste===k?'<b>Ctrl+V</b>로 붙여넣기':'클릭 → Ctrl+V'}</span>`}</div>
        ${ed?`<div class="row" style="gap:4px;justify-content:center"><label class="btn sm" style="cursor:pointer">${im?'바꾸기':'넣기'}<input type="file" accept="image/*" data-ppimg="${k}" hidden></label>${im?`<button class="btn sm ghost" data-act="ppImgDel" data-k="${k}">삭제</button>`:''}</div>`:''}</div>`}).join('')}</div></section>
     ${aiBox}`}
  else if(tab==='plan'){const R=K.R;const bm=K.bm;const M=matrixOf(R);const camps=benchCamps();
    body=`<section class="panel"><div class="panel-h"><div><h2>티어 구성 · 광고비</h2><div class="sub">예산을 넣으면 티어별 인원·단가가 자동으로 잡힙니다 (단가 합계 = 광고비, 1만 원 단위). 칸을 고치면 직접 구성으로 바뀝니다.</div></div>${ed?'<button class="btn sm" data-act="ppAuto">예산으로 자동 구성</button>':''}</div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>티어</th><th>팔로워</th><th class="n">인원</th><th class="n">1인 단가 (원)</th><th class="n">소계</th><th class="n">비중</th><th>실측 기준</th></tr></thead><tbody>${R.map((r,i)=>`<tr><td class="bold">${r.tier}</td><td class="small">${RANGE[r.tier]}</td><td class="n"><input type="text" inputmode="numeric" id="pp_tc${i}" data-ptier="${i}" data-f="count" value="${r.count}" style="width:70px;text-align:right" ${ed?'':'readonly'}></td><td class="n"><input type="text" inputmode="numeric" id="pp_tu${i}" data-ptier="${i}" data-f="unit" value="${won(r.unit)}" style="width:120px;text-align:right" ${ed?'':'readonly'}></td><td class="n">${won(r.count*r.unit)}</td><td class="n">${K.ad?Math.round(r.count*r.unit/K.ad*100)+'%':'–'}</td><td class="small muted">평균 조회 ${won(bm.views[r.tier])} · ${bm.src[r.tier]}</td></tr>`).join('')}
       <tr class="tot"><td class="bold">합계</td><td></td><td class="n bold">${K.people}명</td><td></td><td class="n bold">${won(K.ad)}</td><td></td><td class="small">${(P.plan&&P.plan.tiers&&P.plan.tiers.length)?'직접 구성':'자동 구성'}</td></tr></tbody></table></div>
      <div class="kpis pp-sum"><div><span>광고비</span><b>${won(K.ad)}원</b></div><div><span>대행수수료 ${K.f.rate}%</span><b>${won(K.fee)}원</b></div><div><span>총액 (VAT 별도)</span><b>${won(K.total)}원</b></div><div><span>예산 대비</span><b class="${K.over?'crit':''}">${K.budget?Math.round(K.total/K.budget*100)+'%':'–'}</b></div></div>
      ${K.over?'<div class="banner" style="margin:10px 0 0">티어 구성 금액이 예산을 넘습니다. 인원이나 단가를 줄이거나 「예산으로 자동 구성」을 눌러 주세요.</div>':''}</section>
     <section class="panel"><div class="panel-h"><div><h2>예상 성과</h2><div class="sub">조회수 = 티어별 인원 × 링컴즈 집행 캠페인 평균 조회 · 참여 = 조회 × ER · 좋아요 = 참여 × 0.92 · CPV = 총액 ÷ 조회수</div></div></div>
      <div class="fgrid"><label class="f">실측 기준 캠페인<select id="pp_bench" data-pv="plan.bench" ${ed?'':'disabled'}><option value="">전체 집행 캠페인 (인플루언서 풀)</option>${camps.map(([c,nm,k])=>`<option value="${esc(c)}" ${(P.plan||{}).bench===c?'selected':''}>${esc(nm)} · ${k}명</option>`).join('')}</select><span class="hint">${esc(bm.name)} · 실측이 콘텐츠 3개 미만인 티어는 ${BENCH0.name} 실측값</span></label>
       ${tx('plan.er','적용 ER (%)',{t:'num',ph:'2.0',hint:'보수적으로 2.0% 권장 (링컴즈 실측 1.6~2.8%)'})}</div>
      <div class="kpis pp-sum" style="margin-top:10px"><div><span>예상 조회수</span><b>${won(K.views)}</b></div><div><span>ER</span><b>${pc(K.er)}</b></div><div><span>좋아요</span><b>${won(Math.round(K.likes))}</b></div><div><span>CPV</span><b>${K.cpv.toFixed(1)}원</b></div></div></section>
     <section class="panel"><div class="panel-h"><div><h2>그룹 × 티어</h2><div class="sub">A ${GW.A*100}% · B ${GW.B*100}% · C ${GW.C*100}% 비율로 티어 인원을 나눕니다.</div></div></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>그룹</th>${PT.map(t=>`<th class="n">${t}</th>`).join('')}<th class="n">합계</th></tr></thead><tbody>${GKEYS.map(k=>{const g=((P.ai||{}).groups||[]).find(x=>x.key===k)||{};const tot=PT.reduce((a,t)=>a+(M[k][t]||0),0);return `<tr><td class="bold">${k} ${esc(g.name||'')}</td>${PT.map(t=>`<td class="n">${M[k][t]||'–'}</td>`).join('')}<td class="n bold">${tot}명</td></tr>`}).join('')}</tbody></table></div></section>
     ${pickPanel(P,ed)}`}
  else if(tab==='content'){const AIx=P.ai;if(!AIx)body=`<div class="panel empty">아직 내용이 없습니다. ① 기초 정보에서 「AI로 제안서 만들기」를 눌러 주세요.</div>${aiBox}`;else{const gs=AIx.groups||[];
    body=`<div class="banner info" style="margin:0">제목·소제목은 줄을 직접 바꿔 주세요 (Enter). 대제목은 두 줄, 쉼표·물음표 뒤에서 끊으면 자연스럽습니다. 칸을 고치고 다른 칸으로 이동하면 저장됩니다.</div>
     <section class="panel"><div class="panel-h"><h2>표지 · 캠페인 컨셉</h2></div><div class="fgrid">${tx('title','제안서 이름 (목록용)',{wide:true})}${tx('ai.brand','브랜드 표기')}${sel('status','상태',['작성 중','광고주 전달','완료'])}${ta('ai.cover.headline','표지 메인 카피',{rows:2,wide:false})}${ta('ai.cover.sub','표지 서브 카피',{rows:2,wide:false})}
      ${ta('ai.umbrella.name','캠페인 컨셉명',{rows:2,wide:false})}${tl('ai.umbrella.hashtags','캠페인 해시태그',{wide:false,rows:2})}${ta('ai.umbrella.sub','컨셉 설명',{rows:2})}</div></section>
     <section class="panel"><div class="panel-h"><h2>01 · 시장 현황</h2></div><div class="fgrid">${ta('ai.market.title','대제목',{rows:2,wide:false})}${ta('ai.market.sub','소제목',{rows:2,wide:false})}
      ${(AIx.market&&AIx.market.stats||[]).map((x,i)=>tx(`ai.market.stats.${i}.label`,`지표 ${i+1} · 이름`)+tx(`ai.market.stats.${i}.value`,`지표 ${i+1} · 숫자`)+tx(`ai.market.stats.${i}.unit`,`지표 ${i+1} · 단위`)+ta(`ai.market.stats.${i}.desc`,`지표 ${i+1} · 설명`,{rows:2,wide:false})).join('')}${tx('ai.market.source','출처',{wide:true})}
      ${ta('ai.market.title2','인사이트 장 대제목',{rows:2,wide:false})}${ta('ai.market.sub2','인사이트 장 소제목',{rows:2,wide:false})}
      ${(AIx.market&&AIx.market.insights||[]).map((x,i)=>tx(`ai.market.insights.${i}.kicker`,`인사이트 ${i+1} · 라벨`)+tx(`ai.market.insights.${i}.value`,`인사이트 ${i+1} · 핵심`)+ta(`ai.market.insights.${i}.text`,`인사이트 ${i+1} · 설명`,{rows:2,wide:false})).join('')}${ta('ai.market.takeaway','INSIGHT (결론)',{rows:3,wide:false})}${tx('ai.market.source2','출처',{wide:false})}</div></section>
     <section class="panel"><div class="panel-h"><h2>02 · 브랜드가 나아갈 방향</h2></div><div class="fgrid">${ta('ai.direction.title','대제목',{rows:2,wide:false})}${ta('ai.direction.sub','소제목',{rows:2,wide:false})}
      ${(AIx.direction&&AIx.direction.shifts||[]).map((x,i)=>tx(`ai.direction.shifts.${i}.from`,`변화 ${i+1} · 지금`)+tx(`ai.direction.shifts.${i}.to`,`변화 ${i+1} · 바뀔 모습`)+tx(`ai.direction.shifts.${i}.desc`,`변화 ${i+1} · 설명`,{wide:true})).join('')}${tx('ai.direction.positioning','포지셔닝 한 줄',{wide:true})}</div></section>
     <div class="banner info" style="margin:0"><b>컷별 예시 이미지 넣는 법</b> ① 컷의 「Canva AI」나 「Gemini」를 누르면 이미지 프롬프트가 복사되고 사이트가 열려요 → ② 붙여넣어 이미지를 만들고 <b>마우스 오른쪽 클릭 → 이미지 복사</b> → ③ 여기 돌아와 컷 이미지 칸을 <b>클릭</b>하고 <b>Ctrl+V</b>(맥 ⌘+V). 넣은 이미지는 콘텐츠 가이드 장의 컷 옆에 9:16으로 들어갑니다.</div>
     ${gs.map((g,gi)=>{const b=`ai.groups.${gi}`;return `<section class="panel"><div class="panel-h"><h2>그룹 ${esc(g.key||'')} · ${esc(g.name||'')}</h2></div><div class="fgrid">
      ${tx(b+'.name','그룹 이름')}${tx(b+'.pillar','역할 (공감·인지 등)')}${tl(b+'.keywords','풀 검색 키워드',{wide:false,rows:2})}${tl(b+'.search','섭외 후보 탐색 검색어 (유튜브·틱톡·인스타그램)',{wide:false,rows:2})}${ta(b+'.who','어떤 인플루언서',{wide:false})}${ta(b+'.role','역할',{wide:false})}${ta(b+'.content','콘텐츠',{wide:false})}${ta(b+'.effect','기대 효과',{wide:false})}
      ${ta(b+'.concept.name','그룹 컨셉명',{rows:2,wide:false})}${tl(b+'.concept.hashtags','해시태그 2개',{wide:false,rows:2})}${tl(b+'.concept.story','스토리 4줄',{wide:false,rows:4})}${tx(b+'.concept.keyMessage','KEY MESSAGE',{wide:true})}${tx(b+'.concept.features','보여줄 기능',{wide:true})}
      ${ta(b+'.guide.title','가이드 대제목',{rows:2,wide:false})}${ta(b+'.guide.sub','가이드 소제목',{rows:2,wide:false})}
      </div><div class="pp-cuts">${((g.guide||{}).cuts||[]).map((c,ci)=>{const key=`${g.key}_${ci}`,slot='cut:'+key,im=(A.pcimgs||{})[key];return `<div class="pp-cut"><div class="pp-cut-img ${A.ppaste===slot?'paste-on':''}" tabindex="0" data-ppaste="${slot}" title="클릭한 뒤 Ctrl+V로 이미지 붙여넣기">${im?`<img src="${im}" alt="CUT ${ci+1} 예시 이미지">`:`<span class="small muted">${A.ppaste===slot?'<b>Ctrl+V</b>로 붙여넣기':'CUT '+(ci+1)+' 예시 이미지<br>클릭 → Ctrl+V'}</span>`}</div>
        <div class="row" style="gap:4px;flex-wrap:wrap;justify-content:center">${ed?`<label class="btn sm" style="cursor:pointer">${im?'바꾸기':'넣기'}<input type="file" accept="image/*" data-ppimg="${slot}" hidden></label>${im?`<button class="btn sm ghost" data-act="ppImgDel" data-k="${slot}">삭제</button>`:''}`:''}<button class="btn sm" data-act="ppCanva" data-to="canva" data-g="${gi}" data-c="${ci}" title="이미지 프롬프트를 복사하고 Canva를 엽니다">Canva AI ↗</button><button class="btn sm" data-act="ppCanva" data-to="gemini" data-g="${gi}" data-c="${ci}" title="이미지 프롬프트를 복사하고 Gemini를 엽니다 (무료)">Gemini ↗</button></div>
        <div class="fgrid one">${tx(`${b}.guide.cuts.${ci}.step`,`CUT ${ci+1} · 단계`)}${tx(`${b}.guide.cuts.${ci}.time`,'시간')}${ta(`${b}.guide.cuts.${ci}.scene`,'화면')}${ta(`${b}.guide.cuts.${ci}.line`,'멘션·자막')}${ta(`${b}.guide.cuts.${ci}.prompt`,'🖼 이미지 프롬프트 (Canva·Gemini용)',{rows:2})}</div></div>`}).join('')}</div><div class="fgrid">
      ${ta(b+'.guide.caption','캡션 예시',{rows:4,wide:false})}<div class="stack" style="gap:10px">${tl(b+'.guide.must','MUST',{rows:3})}${tl(b+'.guide.dont',"DON'T",{rows:3})}</div>
      ${((g.feature||{}).items||[]).map((it,ii)=>tx(`${b}.feature.items.${ii}.name`,`핵심 기능 ${ii+1}`)+tx(`${b}.feature.items.${ii}.desc`,`기능 ${ii+1} 설명`)).join('')}${tx(b+'.feature.effect','기대 효과 한 줄',{wide:true})}${(g.persona||[]).map((q,qi)=>tx(`${b}.persona.${qi}.type`,`섭외 예정 프로필 ${qi+1}`,{wide:true})+tx(`${b}.persona.${qi}.tier`,'티어')+ta(`${b}.persona.${qi}.why`,'이유',{wide:false})).join('')}</div></section>`}).join('')}
     <section class="panel"><div class="panel-h"><h2>구성 · 타임라인 · 마무리</h2></div><div class="fgrid">${PT.map(t=>tx(`ai.tierWhy.${t}.role`,`${t} · 역할`)+tx(`ai.tierWhy.${t}.why`,`${t} · 이유`)).join('')}${tl('ai.matrixPoints','그룹×티어 구성 포인트',{rows:3,hint:'한 줄에 하나 (줄바꿈은 \\n 대신 짧게)'})}
      ${ta('ai.timeline.title','타임라인 대제목 (비우면 자동)',{rows:2,wide:false})}${ta('ai.timeline.sub','타임라인 소제목 (비우면 자동)',{rows:2,wide:false})}${tx('ai.closing','마지막 장 한 줄',{wide:true})}</div></section>
     ${aiBox}`}}
  else{body=P.ai?`<section class="panel"><div class="panel-h"><div><h2>미리보기</h2><div class="sub">PPT와 같은 구성입니다. 글꼴은 PC에 Pretendard가 있으면 PPT에서도 같게 보입니다.</div></div><div class="chips"><span class="chip ${A.pseq!=='sum'?'on':''}" data-act="ppSeq" data-k="main">본편 (${SEQ.length-(GKEYS.some(k=>picksOf(P,k).length)?0:1)}장)</span><span class="chip ${A.pseq==='sum'?'on':''}" data-act="ppSeq" data-k="sum">요약본 (8장)</span></div></div>
      <div id="pp-pv" class="pv-deck"><div class="empty">미리보기를 만드는 중…</div></div></section>`:`<div class="panel empty">아직 내용이 없습니다. ① 기초 정보에서 「AI로 제안서 만들기」를 눌러 주세요.</div>${aiBox}`;setTimeout(buildPv,0)}
  return `${head}${A.guidesErr?rulesBanner():''}<div class="stack ppedit">${body}
   <section class="panel"><div class="row"><span class="small muted grow">칸을 고치고 다른 칸으로 이동하면 바로 저장됩니다.</span>${ed?`<button class="btn sm" data-act="ppDup">복제</button><button class="btn sm danger" data-act="ppDel">${A.confirm==='pdel'?'한 번 더 누르면 삭제':'제안서 삭제'}</button>`:''}</div></section></div>`}

/* ============ 입력 저장 ============ */
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset)return;const P=curP();
  if((t.dataset.pv||t.dataset.pl)&&P&&A.view==='proposals'){if(!canEdit())return toast('보기 전용 권한이라 수정할 수 없습니다.','crit');const p=t.dataset.pv||t.dataset.pl;let v=t.dataset.pl?lines(t.value):t.value;if(t.dataset.t==='num'){const x=N(v);v=String(v).trim()===''?'':x}
setIn(P,p,v);const top=p.split('.')[0];pSave(top,P);schedPv();
    if(['title','status','info.color','info.budget','info.feeRate','info.feeMode','plan.bench','plan.er','info.start','info.end'].includes(p))render();return}
  if(t.dataset.ptier!=null&&P){if(!canEdit())return;const R=tierRows(P);const r=R[+t.dataset.ptier];r[t.dataset.f]=Math.max(0,Math.round(N(t.value)));P.plan=P.plan||{};P.plan.tiers=R;pSave('plan',P);schedPv();render();return}
  if(t.dataset.ppsrc&&t.files&&t.files[0]){const f=t.files[0];t.value='';readSrc(f);return}
  if(t.dataset.pplat&&P){if(!canEdit())return;const L=PLATS.filter(x=>x===t.dataset.pplat?t.checked:platsOf(P.info||{}).includes(x));if(!L.length){toast('채널을 하나 이상 골라 주세요.','crit');render();return}P.info={...(P.info||{}),platforms:L,platform:L.map(x=>PLAT_FMT[x]).join(' · ')};pSave('info',P);render();return}
  if(t.dataset.ppimg&&t.files&&t.files[0]){const f=t.files[0];const k=t.dataset.ppimg;t.value='';ppImgIn(k,f)}});
function ppImgIn(slot,f){const cut=/^cut:/.test(slot);fileToDataUrl(f,cut?540:1100,cut?960:1100,'image/jpeg',cut?0.72:0.8).then(d=>pimgPut(cut?slot.slice(4):slot,d,cut?'cut':'p')).catch(()=>toast('이미지를 넣지 못했습니다.','crit'))}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ppaste]');if(!b||e.target.closest('button,label,input'))return;A.ppaste=b.dataset.ppaste;render();setTimeout(()=>{const el=document.querySelector(`[data-ppaste="${A.ppaste}"]`);if(el)el.focus({preventScroll:true})},0)});
document.addEventListener('paste',e=>{if(A.view!=='proposals'||!A.pid||!A.ppaste)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;const it=[...((e.clipboardData&&e.clipboardData.items)||[])].find(x=>x.kind==='file'&&/^image\//.test(x.type));
  if(!it)return toast('복사한 이미지가 없습니다.','crit');e.preventDefault();ppImgIn(A.ppaste,it.getAsFile())});

Object.assign(ACT,{
  async ppNew(){const P=newProposal();const id=uid();try{await DB.set('guides/'+id,P);A.props=A.props||{};A.props[id]=P;A.pid=id;A.ptab='info';render();window.scrollTo(0,0)}catch(e){saveErr(e)}},
  ppOpen(a){A.pid=a.dataset.p;A.ptab='';A.confirm=null;A.ppSel=null;render();window.scrollTo(0,0)},
  ppBack(){A.pid='';render();window.scrollTo(0,0)},
  ppTab(a){A.ptab=a.dataset.k;render()},
  ppSeq(a){A.pseq=a.dataset.k==='sum'?'sum':'';render()},
  ppExp(a){ppExport(a.dataset.k)},
  ppPageSel(a){A.ppSel=+a.dataset.i;render()},
  async ppPageUse(a){const pg=(A.ppPages&&A.ppPages.list||[])[A.ppSel];if(!pg)return;pimgPut(a.dataset.k,await shrink(pg.data,1000))},
  ppImgDel(a){const k=a.dataset.k;if(/^cut:/.test(k))pimgDel(k.slice(4),'cut');else pimgDel(k)},
  ppDisc(){ppDiscover(false)},
  async ppCanva(a){const P=curP();const g=((P.ai||{}).groups||[])[+a.dataset.g]||{};const c=((g.guide||{}).cuts||[])[+a.dataset.c]||{};const I=P.info||{};
    const pr=c.prompt||[c.scene,c.line].filter(Boolean).join(' / ').replace(/\n/g,' ');const text=`${String(pr).replace(/\n/g,' ')}\n(세로 9:16, 실사 사진 느낌, ${I.brand||''} ${I.product||''} 인플루언서 숏폼 예시 장면, 실존 인물·다른 브랜드 로고 없이)`;
    await copyText(text);A.ppaste='cut:'+`${g.key}_${a.dataset.c}`;render();const to=a.dataset.to;window.open(to==='gemini'?'https://gemini.google.com/app':'https://www.canva.com/ai','_blank','noopener');
    toast('프롬프트를 복사했습니다. 이미지를 만든 뒤 「이미지 복사」 → 여기서 Ctrl+V 하면 이 컷에 들어갑니다.')},
  async ppSrcClear(){const P=curP();P.info={...P.info,srcText:'',srcName:'',srcPages:''};A.ppPages=null;await pSave('info',P);render()},
  async ppAuto(){const P=curP();P.plan={...(P.plan||{}),tiers:[]};await pSave('plan',P);schedPv();render();toast('예산 기준으로 티어를 다시 구성했습니다.')},
  async ppPick(a){const P=curP();const k=a.dataset.g,id_=a.dataset.id;P.picks=P.picks||{};const L=[...(P.picks[k]||[])];const i=L.indexOf(id_);if(i>=0)L.splice(i,1);else{if(L.length>=MAXPICK)return toast(`그룹마다 최대 ${MAXPICK}명까지 고를 수 있습니다.`,'crit');L.push(id_)}P.picks[k]=L;await pSave('picks',P);schedPv();render()},
  async ppDup(){const P=curP();if(!P)return;const id=uid();const d={...clone(P),title:(P.title||'')+' (복사본)',status:'작성 중',createdAt:today(),updatedAt:new Date().toISOString(),by:A.user.email,aiStatus:'',aiResult:null};try{await DB.set('guides/'+id,d);if(Object.keys(A.pimgs||{}).length)await DB.set('guideimg/'+id,{imgs:clone(A.pimgs),updatedAt:new Date().toISOString()});A.pid=id;render();toast('제안서를 복제했습니다.')}catch(e){saveErr(e)}},
  async ppDel(){if(A.confirm!=='pdel'){A.confirm='pdel';render();return}A.confirm=null;const id=A.pid;try{await DB.del('guides/'+id);await DB.del('guideimg/'+id).catch(()=>{});A.pid='';render();toast('제안서를 삭제했습니다.')}catch(e){saveErr(e)}},
  async ppAi(){const P=curP();if(!P||A.ppBusy||pAiRunning(P))return;const I=P.info||{};
    if(!String(I.srcText||'').trim()&&!(I.links||[]).length&&!String(I.memo||'').trim())return toast('상품소개서를 올리거나, 링크·메모를 넣어 주세요.','crit');if(!(N(I.budget)>0))return toast('총 예산을 넣어 주세요.','crit');
    if(P.ai&&A.confirm!=='ppai'){A.confirm='ppai';toast('이미 만든 내용이 있습니다. 한 번 더 누르면 AI가 새로 씁니다 (③ 탭의 수정 내용은 바뀝니다).');setTimeout(()=>{if(A.confirm==='ppai')A.confirm=null},6000);return}A.confirm=null;
    const K=ppCalc(P);const plan={tiers:K.R,people:K.people,ad:K.ad,fee:K.fee,total:K.total};const info={...I,platform:platsOf(I).map(x=>PLAT_FMT[x]).join(' · '),srcText:String(I.srcText||'').slice(0,24000)};
    if(DB.mode==='demo'){A.ppBusy=true;render();await new Promise(r=>setTimeout(r,700));await pApply(A.pid,P,{ai:mockAi(I),model:'demo',research:{ok:false,sources:[]}});A.ppBusy=false;render();return}
    const job=uid();A.ppBusy=true;render();
    try{await DB.update('guides/'+A.pid,{aiStatus:'진행 중',aiStep:'시장 조사 중',aiJob:job,aiAt:new Date().toISOString(),aiError:DB.DEL,aiResult:DB.DEL});await aiFetch('/api/proposal',{pid:A.pid,job,info,plan});toast('AI가 제안서를 쓰는 중입니다. 1~3분 걸리고, 끝나면 자동으로 채워집니다.')}
    catch(e){DB.update('guides/'+A.pid,{aiStatus:'실패',aiError:String(e.message||e)}).catch(()=>{});toast('AI 제안서 작성을 시작하지 못했습니다: '+(e.message||e),'crit')}finally{A.ppBusy=false;render()}}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&A.ppaste){A.ppaste='';render()}});

/* ============ 스타일 ============ */
(function(){if(document.getElementById('pp-css'))return;const st=document.createElement('style');st.id='pp-css';st.textContent=`
.pp-pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;max-height:320px;overflow:auto}
.pp-page{margin:0;border:1px solid var(--line);border-radius:8px;padding:4px;cursor:pointer;background:var(--surface);text-align:center}
.pp-page img{width:100%;height:80px;object-fit:contain;display:block}.pp-page figcaption{font-size:11px;color:var(--muted)}
.pp-page.on{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pp-imgs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.pp-img{display:flex;flex-direction:column;gap:6px;border:1px dashed var(--line);border-radius:10px;padding:8px;cursor:pointer;outline:none;min-width:0}
.pp-img.paste-on,.pp-img:focus{border-color:var(--accent);border-style:solid;box-shadow:0 0 0 3px var(--accent-soft)}
.pp-img-b{display:flex;align-items:center;justify-content:center;min-height:110px}.pp-img-b img{max-width:100%;max-height:160px;border-radius:6px;object-fit:contain}
.pp-imgs3{grid-template-columns:repeat(3,minmax(0,1fr))}
.pp-av{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none}.pp-av0{display:inline-flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-weight:700}
.pp-cuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0}.pp-cut{border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0}
.pp-cut-img{aspect-ratio:9/16;max-height:240px;margin:0 auto;width:100%;max-width:135px;display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed var(--line);border-radius:10px;cursor:pointer;outline:none;overflow:hidden;background:var(--surface)}
.pp-cut-img img{width:100%;height:100%;object-fit:cover}.pp-cut .fgrid{grid-template-columns:minmax(0,1fr)}.pp-cut .fgrid .f{min-width:0}
@media (max-width:600px){.pp-cuts{grid-template-columns:minmax(0,1fr)!important}}.pp-cut-img.paste-on,.pp-cut-img:focus{border-color:var(--accent);border-style:solid;box-shadow:0 0 0 3px var(--accent-soft)}
.pp-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
.pp-sum>div{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.pp-sum span{font-size:11.5px;color:var(--muted)}.pp-sum b{font-size:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.pp-sum b.crit{color:var(--crit)}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pp-pick{border:1px solid var(--line);border-radius:12px;padding:10px;min-width:0}
.pp-cand{display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:8px;cursor:pointer}.pp-cand.on{background:var(--accent-soft)}.pp-cand input{margin-top:3px}
.pv-deck{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.pv-slide{position:relative;aspect-ratio:16/9;overflow:hidden;border:1px solid var(--line);border-radius:8px;background:#fff}
.pv-slide .dk-page{position:absolute;left:0;top:0;transform-origin:0 0;width:13.333in;height:7.49in;overflow:hidden;line-height:1.22;color:#161B26;font-family:'Pretendard','Malgun Gothic',sans-serif}
.pv-slide .dk-t{position:absolute;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;word-break:keep-all;overflow-wrap:anywhere}
.pv-slide .dk-t:not(.dk-fit){overflow:visible}.pv-slide .dk-s{position:absolute;box-sizing:border-box}
.pv-no{position:absolute;right:6px;bottom:4px;z-index:2;font-size:11px;color:#9aa0aa;background:rgba(255,255,255,.85);border-radius:6px;padding:0 5px}
@media (max-width:900px){.pv-deck,.grid3,.pp-cuts{grid-template-columns:1fr}.pp-cuts{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-imgs,.pp-sum{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;document.head.appendChild(st)})();
window.ppDeck=ppDeck;window.ppCalc=ppCalc;window.autoMix=autoMix;
})();
