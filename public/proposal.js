/* RINGCOMS 캠페인 관리 · 제안 도구 — 광고 제안서 생성 (v0.18)
   - 새 제안서: 기초 정보 입력 → 「생성」을 눌러야 저장 (캠페인 만들기와 같은 방식)
   - ① 기초 정보 (소개서 PDF·PPT, 예산·대행수수료·기간, 채널) → AI(Gemini): 시장 조사 + 소개서 이미지 분석(메인 컬러·로고 컬러·앱 화면·캐릭터 위치) + 제안서 문구
   - ② 제안서 구성 수정: 장 묶음별 하위 탭 + 오른쪽에 그 장의 미리보기가 실시간으로 바뀜 (인플루언서 구성·예상 성과·섭외 후보 포함)
   - ③ 미리보기 · 상단에서 PPT 본편(발표 노트) · 요약본 · PDF
   - 장표 레이아웃은 ringcoms-influencer-proposal 스킬(build.js) 그대로 — proposal-deck.js (window.PPD)
   - 대행수수료 = 예산 × 수수료율 (포함: 광고비 = 예산 − 수수료 / 별도: 광고비 = 예산), 티어 단가 × 인원 합계 = 광고비, 모든 금액 VAT 별도
   저장: guides/{id} (kind: 'proposal') · 이미지 guideimg/{id}(직접 넣은 이미지) · __src(소개서에서 자른 이미지) · __pg(소개서 쪽) · __cut(컷 이미지) · __av(섭외 후보 프로필) */
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
const SEQ=['cover','toc','market1','market2','direction','capability','umbrella','features','groupConcept:A','guide:A','groupConcept:B','guide:B','groupConcept:C','guide:C','categories','showcase','tiers','matrix','kpi','timeline','appendix:1','closing'];
const SEQ_SUM=['cover','market1','umbrella','features','tiers','kpi','timeline','closing'];
const won=v=>Math.round(+v||0).toLocaleString('ko-KR');
const man=v=>{const x=Math.round((+v||0)/1e3)/10;return x.toLocaleString('ko-KR')+'만'};
const cK=v=>v>=1e4?(Math.round(v/1e3)/10).toLocaleString('ko-KR')+'만':won(v);
const pc=(v,d=1)=>((+v||0)*100).toFixed(d)+'%';
const N=v=>{const x=parseFloat(String(v??'').replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0};
const curP=()=>A.pid&&A.props?A.props[A.pid]:null;
const lnz=s=>String(s||'').replace(/\r/g,'');
const L_=a=>(Array.isArray(a)?a:[]).filter(Boolean);

/* ============ 아이콘 · 메뉴 ============ */
window.TOOL_IC=window.TOOL_IC||{};
window.TOOL_IC.proposal='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M7 13l3-3 2.5 2.5L17 8M12 16.5V20M8.5 20h7"/></svg>';
['ppDisc','ppNew','ppCreate','ppDel','ppDup','ppAi','ppAuto','ppPick','ppImgDel','ppSrcClear','ppSlot','ppBg','ppCropSave','ppCropAdd','ppCropDel','ppCropEdit','ppThemeAuto','ppScreen','ppCanva'].forEach(k=>WRITE_ACTS.add(k));
window.CONFIRM_ACTS=(window.CONFIRM_ACTS||[]).concat(['ppDel']);

/* ============ 계산: 예산 · 대행수수료 · 티어 · 예상 성과 ============ */
function fee0(I){return {rate:has(I.feeRate)&&String(I.feeRate).trim()!==''?N(I.feeRate):20,mode:I.feeMode==='excl'?'excl':'incl'}}
/* 대행수수료 = 예산 × 수수료율. 포함: 광고비 = 예산 − 수수료 (총 = 예산) / 별도: 광고비 = 예산 (총 = 예산 + 수수료) */
function money(I){const B=N(I.budget),f=fee0(I);const fee=Math.round(B*f.rate/100);const ad=f.mode==='excl'?B:B-fee;return {B,fee,ad,total:ad+fee,rate:f.rate,mode:f.mode}}
/* 예산 규모별 기본 인원 (총예산 기준 표: ~500만 / 1,000만 / 3,000만 / 5,000만+) */
function baseCounts(B){const P=[[0,[0,0,4,6]],[5e6,[0,1,5,9]],[1e7,[0,2,8,15]],[3e7,[0,4,15,25]],[5e7,[1,6,20,30]]];
  if(B>=5e7){const k=B/5e7;return {메가:Math.max(1,Math.floor(k)),매크로:Math.round(6*k),마이크로:Math.round(20*k),나노:Math.round(30*k)}}
  let i=0;while(i<P.length-1&&B>P[i+1][0])i++;const [b0,c0]=P[i],[b1,c1]=P[Math.min(i+1,P.length-1)];const t=b1>b0?(B-b0)/(b1-b0):0;
  const c=c0.map((v,j)=>Math.round(v+(c1[j]-v)*t));return {메가:c[0],매크로:c[1],마이크로:c[2],나노:c[3]}}
/* 남은 금액을 단가에 나눠 얹어 합계 = 광고비 정확히 (인원을 동전처럼 쓰는 동전 문제) */
function exactFill(R,X){const sum=()=>R.reduce((a,r)=>a+r.count*r.unit,0);for(const step of [1e4,1e3,100]){let left=X-sum();if(left<=0)return;const n=Math.floor(left/step);if(!n)continue;if(n>40000)continue;
    const coins=R.filter(r=>r.count>0);const dp=new Int16Array(n+1).fill(-1);dp[0]=99;for(let v=1;v<=n;v++){for(let i=0;i<coins.length;i++){const c=coins[i].count;if(c<=v&&dp[v-c]!==-1){dp[v]=i;break}}}
    let v=n;while(v>0&&dp[v]===-1)v--;while(v>0){const i=dp[v];coins[i].unit+=step;v-=coins[i].count}}}
/* 예산 → 티어별 인원·단가 (합계 = 광고비) */
function autoMix(I){const X=money(I).ad;if(!(X>0))return PT.map(t=>({tier:t,count:0,unit:UNIT0[t]}));
  const c=baseCounts(money(I).total);let R=PT.map(t=>({tier:t,count:c[t],unit:UNIT0[t]}));const sum=()=>R.reduce((a,r)=>a+r.count*r.unit,0);const get=t=>R.find(r=>r.tier===t);
  for(let it=0;it<60;it++){const s=sum();if(!s)break;const k=X/s;R.forEach(r=>{r.unit=Math.min(UNIT_R[r.tier][1],Math.max(UNIT_R[r.tier][0],Math.floor(r.unit*k/1e4)*1e4))});const s2=sum();
    if(s2>X){const o=['나노','마이크로','매크로','메가'].map(get).find(r=>r.count>(r.tier==='나노'?2:r.tier==='마이크로'?2:0));if(!o)break;o.count--;continue}
    if(s2<X*0.93&&R.filter(r=>r.count).every(r=>r.unit>=UNIT_R[r.tier][1])){const o=get(it%3===2?'마이크로':'나노');o.count++;continue}break}
  let left=X-sum();const order=['매크로','마이크로','나노','메가'];let guard=0;
  while(left>=1e4&&guard++<5000){let done=false;for(const t of order){const r=get(t);if(r.count&&r.unit+1e4<=UNIT_R[t][1]&&r.count*1e4<=left){r.unit+=1e4;left-=r.count*1e4;done=true;break}}if(!done)break}
  exactFill(R,X);R.forEach(r=>{if(!r.count)r.unit=0});return R}
function tierRows(P){const I=P.info||{};const L=(P.plan&&P.plan.tiers&&P.plan.tiers.length?P.plan.tiers:autoMix(I));return PT.map(t=>{const r=L.find(x=>x.tier===t)||{};return {tier:t,count:Math.max(0,Math.round(N(r.count))),unit:Math.max(0,N(r.unit))}})}
/* 링컴즈 집행 실측: 인플루언서 풀의 캠페인 기록(조회·참여·비용)을 티어별로 모음 */
function poolBench(cid){const acc={};PT.forEach(t=>acc[t]={n:0,views:0,eng:0,cost:0});const camps=new Set();
  Object.values(A.pool||{}).forEach(p=>{const t=TK[tierOf(p.fol)]||TK[p.tier];if(!t)return;Object.entries(p.campaigns||{}).forEach(([ek,e])=>{const c0=ek.split('__')[0];if(cid&&c0!==cid)return;const v=N(e.views);if(!(v>0))return;
    const k=Math.max(1,N(e.uploaded));const a=acc[t];a.n+=k;a.views+=v;a.eng+=N(e.eng);a.cost+=N(e.costV);camps.add(c0)})});
  const views={},er={},cpv={},src={};PT.forEach(t=>{const a=acc[t];const ok=a.n>=3&&a.views>0;views[t]=ok?a.views/a.n:BENCH0.views[t];er[t]=ok&&a.eng?a.eng/a.views:BENCH0.er[t];cpv[t]=ok&&a.cost?a.cost/a.views:BENCH0.cpv[t];src[t]=ok?`실측 ${a.n}개`:'기본값'});
  const tot=PT.reduce((o,t)=>{const a=acc[t];o.n+=a.n;o.views+=a.views;o.eng+=a.eng;o.cost+=a.cost;return o},{n:0,views:0,eng:0,cost:0});
  const real=PT.some(t=>src[t]!=='기본값');
  const name=!real?BENCH0.name:cid?((A.campaigns[cid]||{}).name||'선택 캠페인'):`링컴즈 집행 캠페인 ${camps.size}개`;
  return {views,er,cpv,src,acc,tot,real,name,camps:camps.size}}
function benchCamps(){const s=new Map();Object.values(A.pool||{}).forEach(p=>Object.entries(p.campaigns||{}).forEach(([ek,e])=>{if(N(e.views)>0){const c=ek.split('__')[0];s.set(c,(s.get(c)||0)+1)}}));
  return [...s.entries()].filter(([c])=>A.campaigns[c]).sort((a,b)=>b[1]-a[1]).map(([c,k])=>[c,A.campaigns[c].name,k])}
function ppCalc(P){const I=P.info||{},pl=P.plan||{};const R=tierRows(P);const bm=poolBench(pl.bench||'');const mo=money(I);
  const ad=R.reduce((a,r)=>a+r.count*r.unit,0);const fee=mo.fee;const total=ad+fee;const people=R.reduce((a,r)=>a+r.count,0);
  const views=R.reduce((a,r)=>a+r.count*bm.views[r.tier],0);const er=has(pl.er)&&N(pl.er)>0?N(pl.er)/100:0.02;const eng=views*er;
  return {R,bm,mo,f:{rate:mo.rate,mode:mo.mode},ad,adTarget:mo.ad,diff:ad-mo.ad,fee,total,people,views,er,eng,likes:eng*0.92,cpv:views?total/views:0,cpvExec:views?ad/views:0,budget:mo.B}}
/* 그룹 × 티어 인원 나누기 (A 40% · B 35% · C 25%, 큰 나머지 순) */
function matrixOf(R){const M={A:{},B:{},C:{}};R.forEach(r=>{const raw=GKEYS.map(g=>r.count*GW[g]);const base=raw.map(Math.floor);let left=r.count-base.reduce((a,b)=>a+b,0);
  raw.map((v,i)=>[v-base[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(left>0){base[i]++;left--}});GKEYS.forEach((g,i)=>M[g][r.tier]=base[i])});return M}
/* 8주 일정 (W0~W7): 업로드 시작일이 있으면 그 주를 W4로 */
function weeksOf(I){const d0=new Date();d0.setHours(0,0,0,0);let w4=I.start?new Date(I.start+'T00:00:00'):null;if(!w4||isNaN(w4)){w4=new Date(d0.getTime()+28*864e5)}
  const dow=(w4.getDay()+6)%7;w4=new Date(w4.getTime()-dow*864e5);const w0=new Date(w4.getTime()-28*864e5);let last=7;
  if(I.end){const e=new Date(I.end+'T00:00:00');const k=Math.floor((e-w0)/(7*864e5));if(k>last)last=Math.min(10,k)}
  return {weeks:[...Array(last+1)].map((_,i)=>{const d=new Date(w0.getTime()+i*7*864e5);return `W${i}\n${d.getMonth()+1}/${d.getDate()}~`}),last}}

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



/* ============ 테마 · 이미지 ============ */
const PPD=()=>window.PPD;
function themeFor(P){const t=P.theme||{};return PPD().decideTheme(t.deckMain||t.palette,t.logo,t.manual)}
const IMGDOC={p:'',cut:'__cut',av:'__av',src:'__src',pg:'__pg'};const IMGST={p:'pimgs',cut:'pcimgs',av:'pavs',src:'psrc',pg:'ppgs'};
const logoSrc={dark:'/img/ringcoms-h-dark.png',white:'/img/ringcoms-h-white.png'};
async function logoData(){if(logoData.v)return logoData.v;const get=async u=>{try{const b=await (await fetch(u)).blob();return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>r(null);fr.readAsDataURL(b)})}catch(e){return null}};
  logoData.v={dark:await get(logoSrc.dark),white:await get(logoSrc.white)};return logoData.v}
const cropOf=(id)=>id&&(A.psrc||{})[id]||null;
const cropsOf=P=>(P.crops||[]).filter(c=>(A.psrc||{})[c.id]);
function firstCrop(P,kinds,skip=[]){const L=cropsOf(P).filter(c=>!skip.includes(c.id));for(const k of kinds){const c=L.find(x=>x.kind===k);if(c)return c.id}return L[0]?L[0].id:null}
/* 표지·간지·마지막 장 이미지 후보 3가지 (무료): 소개서에서 자른 이미지 · 폰 목업 합성 · 카드/엠블럼 그래픽 */
function slotCands(P,slot){const sc=(P.ai||{}).screens||{};
  if(slot==='cover'){const c1=cropOf(sc.hero)?sc.hero:firstCrop(P,['app_screen','product','mascot']);const c2=firstCrop(P,['app_screen','product'],[c1]);
    return [c1&&{key:'crop:'+c1,label:'소개서 이미지'},{key:'gfx:phone:'+(c1||''),label:'폰 목업'},{key:'gfx:cards:'+(c2||c1||''),label:'카드 그래픽'}].filter(Boolean)}
  if(slot==='divider'){const c1=firstCrop(P,['app_screen','product'],[sc.hero]);return [{key:'auto',label:'그룹별 앱 화면'},c1&&{key:'crop:'+c1,label:'같은 이미지로'},{key:'gfx:cards:'+(c1||''),label:'카드 그래픽'}].filter(Boolean)}
  if(slot==='closing'){const c1=cropOf(sc.mascotClosing)?sc.mascotClosing:firstCrop(P,['mascot','product']);return [c1&&{key:'crop:'+c1,label:'캐릭터·제품'},{key:'gfx:badge:',label:'브랜드 엠블럼'},{key:'gfx:phone:'+(firstCrop(P,['app_screen'])||''),label:'폰 목업'}].filter(Boolean)}
  return []}
async function slotImg(P,slot,T){const d=(P.design||{}).img||{};let key=d[slot]||'auto';const BR=(P.ai||{}).brand||(P.info||{}).brand||'Brand';
  if(key==='none')return null;if(key==='up')return (A.pimgs||{})[slot]||null;
  if(key==='auto'){if(slot==='divider')return null;if((A.pimgs||{})[slot]&&!d[slot])return A.pimgs[slot];const c=slotCands(P,slot)[0];key=c?c.key:'none';if(key==='none')return null}
  return keyImg(key,T,BR)}
async function keyImg(key,T,BR){if(!key)return null;if(key.startsWith('crop:'))return cropOf(key.slice(5));
  if(key.startsWith('gfx:')){const [,style,cid]=key.split(':');return PPD().gfxImage(T,style,BR,cropOf(cid))}return null}
const BG_OPTS={cover:[['skill','기본 (원형)'],['grad','그라데이션'],['wave','물결'],['dots','점 패턴']],divider:[['skill','기본 (원형)'],['grad','그라데이션'],['ring','링'],['wave','물결']],closing:[['skill','기본 (원형)'],['grad','그라데이션'],['dots','점 패턴'],['ring','링']],body:[['none','없음 (흰 배경)'],['grad','은은한 그라데이션'],['ring','모서리 링'],['dots','모서리 점']]};
const BG_KIND={cover:'표지',divider:'간지 (캠페인·그룹 컨셉)',closing:'마지막 장',body:'본문 장'};
async function bgOf(P,kind,T){const b=((P.design||{}).bg||{})[kind]||(kind==='body'?'none':'skill');if(b==='up'){const src=(A.pimgs||{})['bg_'+kind];if(!src)return null;const op=N((((P.design||{}).bgOp)||{})[kind]||(kind==='body'?15:35))/100;return PPD().veilImage(src,T,kind,op)}return PPD().bgImage(T,kind,b)}

/* ============ 장표 데이터 (스킬 data.json 형식) ============ */
const fontId=P=>((P&&P.design)||{}).font||'pretendard';
/* 고른 폰트를 불러오고(최대 3초 대기) 장표 그리기에 적용 */
async function useFontOf(P){const id=fontId(P);PPD().useFont(id);PPD().loadFontCss(id);const f=PPD().fontOf(id);const w=PPD().weightsOf(f);
  try{await Promise.race([Promise.all([w.xb,w.b,w.r,w.l].map(x=>document.fonts.load(`${x} 20px '${f.fam}'`,'가A'))),new Promise(r=>setTimeout(r,3000))])}catch(e){}return id}
async function toD(P){const font=await useFontOf(P);const I=P.info||{},AI=P.ai||{},K=ppCalc(P),M=matrixOf(K.R);const T=themeFor(P);const BR=AI.brand||I.brand||I.advertiser||'Brand';const sc=AI.screens||{};
  const G={};(AI.groups||[]).forEach(g=>{if(g&&g.key)G[g.key]=g});GKEYS.forEach((k,i)=>{G[k]=G[k]||{key:k,name:`그룹 ${k}`,pillar:['공감·인지','참여·확산','확장·신규'][i],concept:{},guide:{cuts:[]},feature:{items:[]}}});
  const tt=(k,f,d)=>((AI.titles||{})[k]||{})[f]||d;const L=logoData.v||await logoData();const weeks=weeksOf(I);const used=K.R.filter(r=>r.count>0);
  const screens={};cropsOf(P).forEach(c=>screens[c.id]=A.psrc[c.id]);
  const cutsOf=k=>(((G[k].guide||{}).cuts)||[]).slice(0,4);
  const peopleOf=()=>{const out=[];GKEYS.forEach(k=>{const ps=picksOf(P,k).slice(0,4);if(ps.length)ps.forEach(c=>out.push({group:k,name:c.name,img:c.av,sub:c.sub,tier:c.tier,stat:c.stat,why:lnz(c.why)}));else L_(G[k].persona).slice(0,2).forEach(q=>out.push({group:k,persona:true,name:lnz(q.type),sub:'섭외 예정 프로필',tier:q.tier||'',stat:'',why:lnz(q.why)}))});return out};
  const bm=K.bm;const refCpv=`티어별 CPV(${bm.real?'링컴즈 집행 실측':'묵끄럽 8월 실측'}) · 메가 ${bm.cpv.메가.toFixed(1)}원 / 매크로 ${bm.cpv.매크로.toFixed(1)}원 / 마이크로 ${bm.cpv.마이크로.toFixed(1)}원 / 나노 ${bm.cpv.나노.toFixed(1)}원`;
  const TW=AI.tierWhy||{};const upW=4;
  const D={font,meta:{brand:BR,date:`${new Date().getFullYear()}. ${String(new Date().getMonth()+1).padStart(2,'0')}`},theme:T,K,budget:{feeRatePct:K.f.rate},
    assets:{logoDark:L.dark,logoWhite:L.white,screens,heroPhone:await slotImg(P,'cover',T),mascot:cropOf(sc.mascot)||null,mascotClosing:await slotImg(P,'closing',T)},
    dividerImg:await slotImg(P,'divider',T),
    bg:{cover:await bgOf(P,'cover',T),divider:await bgOf(P,'divider',T),closing:await bgOf(P,'closing',T),body:await bgOf(P,'body',T)},
    cover:{eyebrow:'INFLUENCER MARKETING PROPOSAL',headline:'인플루언서 마케팅 제안서',tagline:lnz((AI.cover||{}).tagline||(AI.umbrella||{}).oneLine||String((AI.umbrella||{}).name||'').replace(/,?\s*\n\s*/g,', ')),budgetLine:`총 예산 ${man(K.total)}원 · ${weeks.last+1}주 운영 · VAT 별도`},
    toc:['현재 시장 상황',`${BR}가 나아가야 할 방향`,'링컴즈 인플루언서 마케팅 역량','캠페인 컨셉 · 핵심 전략','그룹별 전략 · 콘텐츠 가이드 예시','인플루언서 구성 · 예산 · 예상 성과','타임라인','Appendix'],
    market:{...(AI.market||{}),stats:L_((AI.market||{}).stats).slice(0,3),insights:L_((AI.market||{}).insights).slice(0,3)},
    direction:{...(AI.direction||{}),shifts:L_((AI.direction||{}).shifts).slice(0,3),screen:sc.direction},
    capability:{title:'왜 링컴즈 MCN인가?\n섭외부터 리포트까지, 한 팀에서',sub:'섭외, 콘텐츠 관리, 성과 리포트, 광고 소재 재활용까지.\n캠페인의 모든 단계를 링컴즈가 직접 운영합니다.',
      cards:[{title:'크리에이터 네트워크',text:'전속 크리에이터와\n카테고리별 인플루언서 풀을\n직접 운영합니다.\n브랜드와 크리에이터 모두에게\n득이 되는 구조로 섭외합니다.'},{title:'캠페인 관리 플랫폼',text:'자체 툴(ad.ringcoms.com)로\n진행 현황과 성과를\n실시간 링크로 공유합니다.\n엑셀·PDF 리포트도\n바로 드립니다.'},{title:'전환 트래킹',text:'인플루언서별 전용 링크로\n클릭과 앱 설치를\n따로 추적합니다.\n누가 실제 설치를 만들었는지\n숫자로 확인합니다.'},{title:'2차 활용 · 광고 소재화',text:'성과 좋은 콘텐츠는\n2차 라이선스로 확보해\nMeta·TikTok 광고 소재로\n재활용합니다.\n인하우스 PD가 편집합니다.'}],
      refTitle:'유사 볼륨 캠페인 레퍼런스',refName:bm.real?bm.name:'묵끄럽 마라곤약스낵 · 8월 시딩 캠페인',refNote:bm.real?`링컴즈 캠페인 관리 툴 실측 (${today().replace(/-/g,'.')} 기준)`:'링컴즈 캠페인 관리 툴 실측 (2026.10.7 기준)',
      refStats:bm.real?[{label:'콘텐츠',value:won(bm.tot.n)+'개'},{label:'총 조회수',value:cK(bm.tot.views)},{label:'평균 ER',value:pc(bm.tot.views?bm.tot.eng/bm.tot.views:0,2)},{label:'CPV',value:bm.tot.cost&&bm.tot.views?(bm.tot.cost/bm.tot.views).toFixed(1)+'원':'–'}]:[{label:'인플루언서',value:'16명'},{label:'총 조회수',value:'95만'},{label:'평균 ER',value:'1.86%'},{label:'CPV',value:'20.0원'}]},
    umbrella:{eyebrow:'CAMPAIGN CONCEPT',name:lnz((AI.umbrella||{}).name),sub:lnz((AI.umbrella||{}).sub),oneLine:lnz((AI.umbrella||{}).oneLine||(AI.cover||{}).tagline||String((AI.umbrella||{}).name||'').replace(/,?\n/g,' ')),hashtag:L_((AI.umbrella||{}).hashtags)[0]||'',
      items:GKEYS.map(k=>({group:k,name:lnz((G[k].concept||{}).name),hashtags:L_((G[k].concept||{}).hashtags),line:lnz((G[k].concept||{}).line||(G[k].concept||{}).keyMessage)}))},
    features:{title:lnz(tt('features','title','공감에서 참여로,\n참여에서 확장으로')),sub:lnz(tt('features','sub','세 그룹이 각자 다른 기능을 보여 주며\n하나의 캠페인으로 이어집니다.')),cols:GKEYS.map(k=>({group:k,screen:sc['features'+k]||sc['group'+k],items:L_((G[k].feature||{}).items).slice(0,3).map(i=>[lnz(i.name),lnz(i.desc)]),effect:lnz((G[k].feature||{}).effect)}))},
    groupConcepts:Object.fromEntries(GKEYS.map(k=>{const c=G[k].concept||{};return [k,{name:lnz(c.name),hashtags:L_(c.hashtags),story:L_(c.story).map(lnz),keyMessage:lnz(c.keyMessage),features:lnz(c.features),screen:sc['group'+k]||sc.direction||firstCrop(P,['app_screen','product'],[sc.hero])||sc.hero}]})),
    guides:Object.fromEntries(GKEYS.map(k=>{const g=G[k].guide||{};const cs=L_(sc['cuts'+k]);return [k,{title:lnz(g.title),sub:lnz(g.sub),cuts:cutsOf(k).map((c,i)=>({step:c.step,time:c.time,scene:lnz(c.scene),line:lnz(c.line),img:(A.pcimgs||{})[`${k}_${i}`]||null,screen:cs[i]||cs[0]})),caption:lnz(g.caption),must:L_(g.must).slice(0,3),dont:L_(g.dont).slice(0,3)}]})),
    categories:{title:lnz(tt('categories','title','세 그룹의 인플루언서가\n각자의 역할을 맡습니다')),sub:lnz(tt('categories','sub','어떤 인플루언서가, 어떤 역할로, 어떤 콘텐츠를 만드는지 정리했습니다.')),groups:GKEYS.map(k=>({key:k,name:G[k].name,pillar:G[k].pillar,who:lnz(G[k].who),role:lnz(G[k].role),content:lnz(G[k].content),effect:lnz(G[k].effect)}))},
    tiers:{title:lnz(tt('tiers','title',`메가 1명보다,\n${K.people}명이 여기저기서 보이게`)),sub:lnz(tt('tiers','sub','매크로로 화제를 만들고, 마이크로·나노로 \'어디서나 보이는\' 상태를 만듭니다.\n집행 실측에서도 메가의 CPV가 가장 높았습니다.')),
      rows:K.R.map(r=>{const w=TW[r.tier]||{};return {tier:r.tier,range:RANGE[r.tier],count:r.count,unit:r.unit,role:r.count?(w.role||''):'제외',why:lnz(r.count?(w.why||''):(w.why||'예산이 1명에 집중돼\n리스크가 큼'))}}),refLine:refCpv},
    matrix:{title:lnz(tt('matrix','title','그룹마다 티어를 나눠\n도달과 참여를 함께 잡습니다')),sub:lnz(tt('matrix','sub','그룹별 인원과 광고비를 티어 단가 기준으로 나눴습니다.')),cols:used.map(r=>r.tier),rows:GKEYS.map(k=>({group:k,counts:used.map(r=>M[k][r.tier]||0)})),points:L_(AI.matrixPoints).slice(0,3).map(lnz)},
    showcase:{title:lnz(tt('showcase','title','이런 크리에이터와\n함께하려 합니다')),sub:lnz(tt('showcase','sub','그룹별 섭외 후보 예시입니다.\n최종 리스트는 광고주 컨펌 후 확정합니다.')),note:`※ ${today().replace(/-/g,'.')} 공개 데이터 기준 · 평균 조회 = 탐색 시점 최근 콘텐츠 조회 중앙값(유튜브는 채널 평균) 또는 링컴즈 집행 평균 · 섭외 가능 여부와 단가는 미확정`,people:peopleOf()},
    kpi:{title:lnz(tt('kpi','title',`${man(K.total)}원으로 기대하는\n예상 성과`)),sub:lnz(tt('kpi','sub','링컴즈가 집행한 캠페인의 티어별 평균 조회수를 적용한 예상치입니다.\nER은 보수적으로 2.0%로 잡았습니다.')),note:'※ 집행 캠페인 평균 기반 예상치'},
    timeline:{title:lnz((AI.timeline||{}).title||`한 주에 ${K.people}개 콘텐츠,\n피드를 ${BR}로 채웁니다`),sub:lnz((AI.timeline||{}).sub||'제안 확정 후 1주 안에 섭외 리스트업을 마칩니다.\n섭외·계약 2주, 브리프·가편 검수를 거쳐 W4에 A·B·C 세 그룹이 동시에 업로드합니다.'),weeks:weeks.weeks,
      tasks:[{name:'제안 확정 · 섭외 리스트업',start:0,end:0},{name:'섭외 · 계약 (모두싸인)',start:1,end:2},{name:`브리프 · ${BR} 온보딩 · 가편 검수`,start:2,end:3},{name:`A·B·C 그룹 동시 업로드 (${K.people}명)`,start:upW,end:upW,hot:true,label:'업로드',tail:{end:weeks.last,label:'최소 6개월 게시글 유지 →'}},{name:'1차 성과 리포트 (D+7 측정)',start:upW+1,end:upW+1},{name:'성과 상위 콘텐츠 2차 활용 · 광고 소재화',start:upW+1,end:upW+2},{name:'실시간 리포트 공유 (ad.ringcoms.com)',start:upW,end:weeks.last},{name:'최종 결과 리포트',start:weeks.last,end:weeks.last}]},
    appendix:[{kind:'assumptions',eyebrow:'APPENDIX A · 성과 추정 기준',title:'예상 성과는\n이렇게 계산했습니다',sub:'티어별 인원 × 집행 캠페인 평균 조회 = 예상 조회수 · ER은 보수적으로 적용했습니다.',notes:`산식 · 예상 조회수 = Σ(티어별 인원 × 평균 조회) · 참여 = 조회 × ER(${pc(K.er)}) · 좋아요 = 참여 × 0.92 · CPV = 총 예산(대행수수료 포함) ÷ 조회수 · 보수/기준/확장 = 0.7/1.0/1.4배`},
      {kind:'list',eyebrow:'APPENDIX',title:'섭외는 꼼꼼하게,\n리스크는 미리 막습니다',sub:'브랜드와 크리에이터 모두에게 득이 되는 구조로 섭외하고,\n업로드 전 검수로 리스크를 줄입니다.',cols:[{head:'섭외 기준',items:['최근 콘텐츠 조회 중앙값·ER로 실제 반응 확인','채널 카테고리·톤이 그룹 컨셉과 맞는지 확인','최근 광고 빈도·경쟁사 협업 여부 확인','팔로워 급증·비정상 반응 계정 제외']},{head:'리스크 관리',items:['가편 검수 후 업로드 (수정 2회 포함)','#광고 표기 등 표시·광고 지침 준수','효능·효과를 단정하는 표현 금지','일정 지연 시 대체 후보로 바로 교체']}]}],
    closing:{line:'링컴즈 MCN 사업부 광고콘텐츠팀 · ac@ringcoms.com'}};
  const tok={views:cK(K.views),er:pc(K.er),eng:cK(Math.round(K.eng/100)*100),likes:cK(Math.round(K.likes/100)*100),cpv:K.cpv.toFixed(1),exec:man(K.ad),fee:man(K.fee),people:K.people};
  D.fillT=s=>String(s||'').replace(/\{(\w+)\}/g,(m,k)=>tok[k]!==undefined?tok[k]:m);
  const nt={...(AI.notes||{})};GKEYS.forEach(k=>{if(!nt['groupConcept:'+k]&&nt['group'+k])nt['groupConcept:'+k]=nt['group'+k];if(!nt['guide:'+k]&&nt['guide'+k])nt['guide:'+k]=nt['guide'+k]});D.notes=nt;
  return D}

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
function watchPimg(){if(A.pimgFor===A.pid)return;Object.keys(IMGDOC).forEach(t=>{const u='unsubP_'+t;if(A[u]){A[u]();A[u]=null}A[IMGST[t]]={};if(A.pid)A[u]=DB.watchDoc('guideimg/'+A.pid+IMGDOC[t],d=>{A[IMGST[t]]=(d&&d.imgs)||{};schedPv();scheduleRender()},()=>{})});A.pimgFor=A.pid}
function pAiRunning(P){return P&&P.aiStatus==='진행 중'&&P.aiAt&&(Date.now()-new Date(P.aiAt).getTime()<15*60*1000)}
window.ppAiCheck=function(){if(!canEdit()||!A.props)return;Object.entries(A.props).forEach(([pid,P])=>{const seen=ppAiCheck.done||(ppAiCheck.done=new Set());if(P.aiStatus==='완료'&&P.aiResult&&!seen.has(P.aiJob)&&pid===A.pid){seen.add(P.aiJob);let j=null;try{j=JSON.parse(P.aiResult)}catch(e){}if(j)pApply(pid,P,j)}
  if(P.aiStatus==='실패'&&P.aiError&&!seen.has('e'+P.aiJob)&&A.pid===pid){seen.add('e'+P.aiJob);toast('AI 제안서 작성 실패: '+P.aiError,'crit')}})};
/* 소개서 쪽 이미지: 화면 메모리(방금 올린 것) → 없으면 저장된 쪽 이미지(__pg) */
function pagesOf(){const mem=A.ppPages&&A.ppPages.pid===A.pid?A.ppPages.list:null;if(mem&&mem.length)return mem;const pg=A.ppgs||{};return Object.keys(pg).sort((a,b)=>N(a)-N(b)).map(k=>({n:N(k),data:pg[k]}))}
async function savePages(pid,pages){const out={};let size=0;for(const p of pages.slice(0,16)){const d=await shrinkTo(p.data,720,0.6);if(size+d.length>900000)break;size+=d.length;out[String(p.n)]=d}try{await DB.set('guideimg/'+pid+'__pg',{imgs:out,updatedAt:new Date().toISOString()});if(pid===A.pid)A.ppgs=out}catch(e){console.error(e)}}
/* AI 결과 적용: 문구 + 소개서 이미지 자르기 + 브랜드 컬러 */
async function pApply(pid,P,j){const ai=j.ai||{};delete ai.timeline;const info={...(P.info||{})};['advertiser','brand','product','category'].forEach(k=>{if(!String(info[k]||'').trim()&&ai[k])info[k]=ai[k]});
  const vis=j.vision||{};const pages=pagesOf();const crops=[];const imgs={};let size=0;
  for(const it of (vis.items||[])){const pg=pages.find(p=>p.n===it.page)||pages[it.page-1];if(!pg)continue;const mascot=it.kind==='mascot';const d=await PPD().cropImg(pg.data,it.box,{max:mascot?480:620,cutout:mascot});if(!d||size+d.length>900000)continue;size+=d.length;imgs[it.id]=d;crops.push({id:it.id,page:it.page,kind:it.kind,label:it.label,box:it.box,cut:mascot})}
  if(crops.length){try{await DB.set('guideimg/'+pid+'__src',{imgs,updatedAt:new Date().toISOString()});if(pid===A.pid)A.psrc=imgs}catch(e){console.error(e)}}
  const pal=await PPD().paletteOf(pages.map(p=>p.data));const col=vis.colors||{};const theme={...(P.theme||{}),deckMain:PPD().hx(col.deckMain)||pal||(P.theme||{}).deckMain||null,logo:PPD().hx(col.logo)||null,palette:pal,note:String(col.note||'').slice(0,200)};
  const tmp={...P,info,ai};const picks={...(P.picks||{})};GKEYS.forEach(k=>{if(!(picks[k]||[]).length){picks[k]=poolCands(tmp,k).filter(x=>x.hit).slice(0,2).map(x=>x.id)}});
  const title=P.title&&!/^새 (광고|인플루언서 캠페인) 제안서/.test(P.title)?P.title:`${info.brand||info.advertiser||'광고주'} 인플루언서 캠페인 제안서`;
  try{const up={ai,info,picks,title,theme,aiMeta:{model:j.model||'',research:j.research||{},vision:{n:(vis.items||[]).length,error:vis.error||''},pages:j.pages||[],at:new Date().toISOString()},aiStatus:'적용됨',aiResult:DB.DEL,updatedAt:new Date().toISOString()};if(crops.length)up.crops=crops;
    await DB.update('guides/'+pid,up);if(A.props&&A.props[pid]){Object.assign(A.props[pid],up);delete A.props[pid].aiResult}
    if(A.pid===pid){A.ptab='edit';A.psub='cover';toast(`AI가 제안서를 채웠습니다.${crops.length?` 소개서 이미지 ${crops.length}개를 잘라 넣었습니다.`:''} 이어서 섭외 후보를 찾습니다.`);setTimeout(()=>ppDiscover(true),300)}schedPv();render()}catch(e){saveErr(e)}}

/* ============ 상품소개서 읽기 (PDF · PPT · 텍스트) ============ */
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

async function readSrc(file,info,pid){const nm=file.name||'소개서';
  if(file.size>SRC_MAX){toast(`파일이 너무 큽니다 (${(file.size/1048576).toFixed(0)}MB). 50MB 이하로 올려 주세요. PPT는 이미지 압축(파일 → 그림 압축) 후 저장하거나 PDF로 저장해 올려 주세요.`,'crit');return false}
  if(/\.ppt$/i.test(nm)){toast('예전 PPT(.ppt) 형식은 읽을 수 없습니다. PowerPoint에서 .pptx나 PDF로 저장해 올려 주세요.','crit');return false}
  try{let pages=[];if(/\.pptx$/i.test(nm)||/presentationml/.test(file.type)){toast('PPT 소개서를 읽는 중입니다…');const r=await readPptx(file);pages=r.pages;info.srcText=r.text.slice(0,40000);info.srcName=nm;info.srcPages=r.count}
    else if(/pdf$/i.test(file.type)||/\.pdf$/i.test(nm)){toast('소개서를 읽는 중입니다…');const lib=await pdfLib();const doc=await lib.getDocument({data:await file.arrayBuffer()}).promise;let text='';const NP=Math.min(doc.numPages,40);
      for(let i=1;i<=NP;i++){const pg=await doc.getPage(i);const tc=await pg.getTextContent();text+=`\n[${i}쪽]\n`+tc.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').replace(/[ \t]+/g,' ');
        if(i<=16){const vp=pg.getViewport({scale:1});const k=Math.min(2,1100/Math.max(vp.width,vp.height));const v2=pg.getViewport({scale:k});const cv=document.createElement('canvas');cv.width=v2.width;cv.height=v2.height;await pg.render({canvasContext:cv.getContext('2d'),viewport:v2}).promise;pages.push({n:i,data:cv.toDataURL('image/jpeg',0.86)})}}
      info.srcText=text.trim().slice(0,40000);info.srcName=nm;info.srcPages=doc.numPages}
    else if(/^text\//.test(file.type)||/\.(txt|md|csv)$/i.test(nm)){info.srcText=(await file.text()).slice(0,40000);info.srcName=nm}
    else{toast('PDF·PPT(.pptx)·텍스트 파일을 올려 주세요.','crit');return false}
    A.ppPages={pid,list:pages};if(pages.length&&pid!=='new')savePages(pid,pages);
    if(String(info.srcText||'').replace(/\[\d+쪽\]/g,'').trim().length<200)toast('소개서에서 글자를 거의 읽지 못했습니다(이미지로 된 소개서). 핵심 문구를 메모 칸에 붙여넣어 주세요.','crit');else toast(`소개서 ${info.srcPages?info.srcPages+'쪽':''}을 읽었습니다.`);return true}
  catch(e){console.error(e);toast('소개서를 읽지 못했습니다: '+(e.message||e),'crit');return false}}
async function pimgPut(slot,data,t='p'){if(!canEdit())return;const imgs={...(A[IMGST[t]]||{}),[slot]:data};const size=Object.values(imgs).reduce((a,b)=>a+String(b).length,0);if(size>950000)return toast('이미지가 너무 큽니다. 다른 이미지를 지우거나 더 작은 이미지를 넣어 주세요.','crit');
  try{await DB.set('guideimg/'+A.pid+IMGDOC[t],{imgs,updatedAt:new Date().toISOString()});A[IMGST[t]]=imgs;A.ppaste='';schedPv();render();if(t==='p'||t==='cut')toast('이미지를 넣었습니다.')}catch(e){saveErr(e)}}
async function pimgDel(slot,t='p'){const im={...(A[IMGST[t]]||{})};delete im[slot];try{await DB.set('guideimg/'+A.pid+IMGDOC[t],{imgs:im,updatedAt:new Date().toISOString()});A[IMGST[t]]=im;schedPv();render()}catch(e){saveErr(e)}}
async function shrinkTo(data,max,q=0.8){return new Promise(r=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));const cv=document.createElement('canvas');cv.width=Math.round(im.naturalWidth*k);cv.height=Math.round(im.naturalHeight*k);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);r(cv.toDataURL('image/jpeg',q))};im.onerror=()=>r(data);im.src=data})}
const shrink=(d,m)=>shrinkTo(d,m,0.8);

/* ============ 미리보기 (전체 · 하위 탭 실시간) ============ */
function pretendard(){if(!document.getElementById('pretendard-css')){const l=document.createElement('link');l.id='pretendard-css';l.rel='stylesheet';l.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';document.head.appendChild(l)}}
function schedPv(fast){clearTimeout(schedPv.t);schedPv.t=setTimeout(buildPv,fast?60:220)}
async function buildPv(){const P=curP();if(!P||!P.ai)return;const boxes=[...document.querySelectorAll('[data-pvseq]')];if(!boxes.length)return;pretendard();
  const D=await toD(P);for(const box of boxes){const seq=box.dataset.pvseq.split(',');const perNo=box.dataset.pvsum==='1';
    try{const deck=new (PPD().PvDeck)();const ids=await PPD().build(deck,D,seq,{perSlideNo:perNo});const html=deck.html();
      box.innerHTML=html.map((x,i)=>`<div class="pv-slide"><span class="pv-no">${box.dataset.pvall?i+1:esc(ids[i]||'')}</span>${x}</div>`).join('')||'<div class="empty small">이 장은 아직 내용이 없습니다.</div>';fitPv(box);HtmlDeck.fit(box)}catch(e){console.error(e);box.innerHTML=`<div class="empty">미리보기를 만들지 못했습니다: ${esc(e.message||e)}</div>`}}}
function fitPv(root){(root||document).querySelectorAll('.pv-slide').forEach(w=>{const k=w.clientWidth/1280;const pg=w.querySelector('.dk-page');if(pg)pg.style.transform=`scale(${k})`})}
window.addEventListener('resize',()=>{clearTimeout(fitPv.t);fitPv.t=setTimeout(()=>fitPv(),100)});

/* ============ 내보내기 ============ */
async function ppExport(kind){const P=curP();if(!P||ppExport.busy)return;if(!P.ai)return toast('먼저 「AI로 제안서 만들기」로 내용을 채워 주세요.','crit');ppExport.busy=true;const PDF=kind==='pdf';const sum=kind==='sum';
  const br=String((P.ai||{}).brand||(P.info||{}).brand||'Brand').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')||'Brand';const name=`${br}_Influencer_Campaign_${sum?'Summary_7p':'Proposal'}`;
  try{toast(PDF?'PDF를 만드는 중입니다… 인쇄 창이 열리면 「PDF로 저장」을 고르세요.':'PPT를 만드는 중입니다…');if(!PDF&&!window.PptxGenJS)await loadScript('/vendor/pptxgen.bundle.js');pretendard();

    const D=await toD(P);const deck=PDF?new (PPD().PvDeck)():new PptxGenJS();deck.layout='LAYOUT_WIDE';deck.title=P.title||'Proposal';if(!PDF){deck.author='RINGCOMS MCN 광고콘텐츠팀';deck.company='RINGCOMS';{const f=PPD().fontOf(fontId(P));const w=PPD().weightsOf(f);deck.theme=f.id==='pretendard'?{headFontFace:'Pretendard ExtraBold',bodyFontFace:'Pretendard'}:{headFontFace:(PPD().dlOf(f.id,w.xb)||{name:f.fam}).name,bodyFontFace:(PPD().dlOf(f.id,w.r)||{name:f.fam}).name}}}
    await PPD().build(deck,D,sum?SEQ_SUM:SEQ,{perSlideNo:sum,notes:D.notes});if(PDF)await deck.print(name);else await deck.writeFile({fileName:name+'.pptx'})}
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



/* ============ 화면: 목록 · 새 제안서 ============ */
function newInfo(){return {advertiser:'',brand:'',product:'',category:'',target:'',objective:OBJ[0],platforms:PLATS.slice(),platform:'인스타그램 릴스 · 틱톡 · 유튜브 쇼츠',links:[],memo:'',srcText:'',srcName:'',budget:'',feeRate:20,feeMode:'incl',start:'',end:''}}
window.viewProposals=function(){ensureToolWatch();if(A.pnew)return ppCreateView();if(A.pid)return ppEditor();
  const L=Object.entries(A.props||{}).sort((a,b)=>String(b[1].updatedAt||'').localeCompare(String(a[1].updatedAt||'')));
  return `<div class="page-h"><div><div class="eyebrow">Proposal</div><h1>광고 제안서 생성</h1><div class="sub">상품소개서와 예산·대행수수료·집행 기간만 넣으면, 시장 → 방향 → 컨셉 → 그룹별 가이드 → 인플루언서 구성 → 예상 성과 → 타임라인까지 제안서를 만들어 PPT·PDF로 받습니다.</div></div>
   <div class="row">${aiPill()}${canEdit()?'<button class="btn primary" data-act="ppNew">+ 새 제안서</button>':''}</div></div>
  ${A.guidesErr?rulesBanner():''}
  ${L.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>제안서</th><th>광고주 · 브랜드</th><th class="n">총액 (VAT 별도)</th><th class="n">인플루언서</th><th>집행 기간</th><th>상태</th><th>수정</th></tr></thead><tbody>${L.map(([id,P])=>{const I=P.info||{};const K=ppCalc(P);
    return `<tr class="click" data-act="ppOpen" data-p="${esc(id)}"><td class="bold">${esc(P.title||'제목 없음')}</td><td>${esc([I.advertiser,I.brand].filter(Boolean).join(' · ')||'–')}</td><td class="n">${I.budget?won(K.total)+'원':'–'}</td><td class="n">${K.people||'–'}</td><td class="small">${esc([I.start,I.end].filter(Boolean).join(' ~ ')||'–')}</td><td>${pAiRunning(P)?'<span class="pill accent">AI 작성 중</span>':`<span class="pill ${P.status==='완료'?'ok':P.ai?'accent':''}">${esc(P.ai?(P.status||'작성 중'):'정보 입력 중')}</span>`}</td><td class="small">${md(String(P.updatedAt||'').slice(0,10))}</td></tr>`}).join('')}</tbody></table></div>`
  :`<div class="panel empty">${A.guidesLoaded?'아직 만든 제안서가 없습니다. 「+ 새 제안서」로 시작하세요.':'불러오는 중…'}</div>`}`};
/* 기초 정보 입력 칸 (새 제안서 · ① 기초 정보 공용) */
function infoFields(I,pre,ed,mo){const id=p=>pre+p.replace(/[.\s]/g,'_');const at=pre==='ppn_'?'data-pn':'data-pv';
  const tx=(p,l,o={})=>`<label class="f ${o.wide?'wide':''}">${l}<input type="${o.type||'text'}" id="${id(p)}" ${at}="${p}" ${o.t?`data-t="${o.t}"`:''} value="${esc(getIn({info:I},p)??'')}" placeholder="${esc(o.ph||'')}" ${ed?'':'readonly'}>${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`;
  const sel=(p,l,opts)=>{const v=getIn({info:I},p);return `<label class="f">${l}<select id="${id(p)}" ${at}="${p}" ${ed?'':'disabled'}>${opts.map(x=>{const [val,lab]=Array.isArray(x)?x:[x,x];return `<option value="${esc(val)}" ${String(val)===String(v??'')?'selected':''}>${esc(lab)}</option>`}).join('')}</select></label>`};
  const r=money(I);
  return `<section class="panel"><div class="panel-h"><h2>기초 정보</h2><span class="sub">비워 두면 AI가 소개서에서 찾습니다</span></div><div class="fgrid">
      ${tx('info.advertiser','광고주 (회사)')}${tx('info.brand','브랜드 공식 표기',{ph:'예: Petbbi (영문 표기 그대로)'})}${tx('info.product','제품 · 서비스')}${tx('info.category','제품 분야',{ph:'예: 반려동물 앱'})}
      ${tx('info.target','주요 타깃',{ph:'예: 2030 반려인'})}${sel('info.objective','캠페인 목적',OBJ)}
      <div class="f">채널 · 형식 (여러 개 선택)<div class="chips" style="margin-top:4px">${PLATS.map(x=>`<label class="chip ${platsOf(I).includes(x)?'on':''}" style="cursor:pointer"><input type="checkbox" data-pplat="${x}" data-pre="${pre}" ${platsOf(I).includes(x)?'checked':''} ${ed?'':'disabled'} style="margin:0 4px 0 0">${x}</label>`).join('')}</div><span class="hint">섭외 후보도 고른 채널에서 찾습니다</span></div></div></section>
     <section class="panel"><div class="panel-h"><h2>예산 · 대행수수료 · 집행 기간</h2><span class="sub">모든 금액은 VAT 별도</span></div><div class="fgrid">
      ${tx('info.budget','총 예산 (원, VAT 별도)',{t:'num',ph:'10,000,000',hint:I.budget?won(I.budget)+'원':''})}${tx('info.feeRate','대행수수료율 (%)',{t:'num',ph:'20'})}
      ${sel('info.feeMode','대행수수료 방식',[['incl','예산에 포함 (광고비 = 예산 − 수수료)'],['excl','예산 = 광고비 (수수료 별도 추가)']])}
      ${tx('info.start','업로드 시작일',{type:'date'})}${tx('info.end','집행 종료일',{type:'date'})}</div>
      ${I.budget?`<div class="pp-money"><div><span>광고비</span><b>${won(r.ad)}원</b></div><div><span>대행수수료 ${r.rate}%</span><b>${won(r.fee)}원</b></div><div><span>총액</span><b>${won(r.total)}원</b></div><div><span>VAT</span><b>별도</b></div></div>
       <p class="small muted" style="margin:6px 0 0">대행수수료 = 예산 ${won(r.B)}원 × ${r.rate}% · ${r.mode==='excl'?'광고비 = 예산, 수수료는 별도로 더해 총액':'광고비 = 예산 − 수수료, 총액 = 예산'}${mo?` → 인플루언서 ${mo.people}명 · 단가 합계 ${won(mo.ad)}원`:''}</p>`:''}</section>`}
function ppCreateView(){const D=A.pnew;const I=D.info;
  return `<div class="page-h"><div><button class="btn sm ghost" data-act="ppNewCancel">← 제안서 목록</button><div class="eyebrow" style="margin-top:6px">New Proposal</div><h1>새 광고 제안서</h1><div class="sub">정보를 넣고 아래 「생성」을 눌러야 제안서가 만들어집니다. 소개서는 지금 올리거나, 생성한 뒤에 올려도 됩니다.</div></div></div>
   <div class="stack">
    <section class="panel"><div class="panel-h"><h2>제안서 이름</h2></div><div class="fgrid"><label class="f wide">이름 (목록에 표시)<input type="text" id="ppn_title" data-pn="title" value="${esc(D.title||'')}" placeholder="예: Petbbi 인플루언서 캠페인 제안서 (비우면 브랜드명으로 자동)"></label></div></section>
    <section class="panel"><div class="panel-h"><div><h2>상품소개서</h2><div class="sub">PDF나 PPT(.pptx), 50MB 이하 · 브라우저 안에서만 읽고 서버에 올리지 않습니다.</div></div></div>
     <div class="row" style="gap:8px;flex-wrap:wrap"><label class="btn" style="cursor:pointer">소개서 올리기 (PDF · PPT)<input type="file" accept="application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.txt,.md" data-ppsrc="new" hidden></label>${I.srcName?`<span class="pill ok">${esc(I.srcName)}${I.srcPages?' · '+I.srcPages+'쪽':''}</span>`:'<span class="small muted">선택 사항</span>'}</div></section>
    ${infoFields(I,'ppn_',true,null)}
    <section class="panel"><div class="row" style="flex-wrap:wrap"><span class="small muted grow">「생성」을 누르면 제안서가 저장되고 편집 화면으로 이동합니다.</span><button class="btn" data-act="ppNewCancel">취소</button><button class="btn primary" data-act="ppCreate" data-ai="0">생성</button><button class="btn primary" data-act="ppCreate" data-ai="1" ${I.srcText&&N(I.budget)>0?'':'disabled title="소개서와 총 예산을 넣으면 쓸 수 있습니다"'}>생성하고 AI로 만들기</button></div></section>
   </div>`}

/* ============ 화면: 편집 ============ */
const SUBS=[['cover','표지 · 목차',['cover','toc']],['market','01 시장',['market1','market2']],['direction','02 방향',['direction']],['capability','03 역량',['capability']],['concept','04 컨셉 · 핵심 전략',['umbrella','features']],
  ['groupA','05 A그룹',['groupConcept:A','guide:A']],['groupB','05 B그룹',['groupConcept:B','guide:B']],['groupC','05 C그룹',['groupConcept:C','guide:C']],['plan','06 구성 · 예상 성과',['categories','showcase','tiers','matrix','kpi']],
  ['timeline','07 타임라인',['timeline']],['closing','Appendix · 마무리',['appendix:1','closing']],['design','디자인 · 이미지',['cover','umbrella','market1','closing']]];
function ppEditor(){const P=curP();if(!P)return A.guidesLoaded?`<div class="panel empty">제안서를 찾을 수 없습니다. <button class="btn sm" data-act="ppBack">목록으로</button></div>`:'<div class="panel empty">불러오는 중…</div>';watchPimg();
  const ed=canEdit(),I=P.info||{},tab=A.ptab||(P.ai?'edit':'info');const K=ppCalc(P);
  const tabs=[['info','① 기초 정보'],['edit','② 제안서 구성 수정'],['preview','③ 미리보기']];
  const head=`<div class="page-h"><div><button class="btn sm ghost" data-act="ppBack">← 제안서 목록</button><h1 style="margin-top:6px">${esc(P.title||'제목 없음')}</h1><div class="sub">${esc([I.advertiser,I.brand,I.budget?'총 '+won(K.total)+'원 (VAT 별도)':''].filter(Boolean).join(' · '))} · 마지막 수정 ${esc(String(P.updatedAt||'').slice(0,16).replace('T',' '))}</div></div>
   <div class="row"><button class="btn" data-act="ppExp" data-k="pptx" ${P.ai?'':'disabled'}>PPT 본편</button><button class="btn" data-act="ppExp" data-k="sum" ${P.ai?'':'disabled'} title="표지·시장·컨셉·핵심 전략·티어·예상 성과·타임라인 + 감사합니다">요약본 7장</button><button class="btn" data-act="ppExp" data-k="pdf" ${P.ai?'':'disabled'}>PDF</button><button class="btn" data-act="ppFontGo" title="PPT를 받는 PC에 설치할 폰트 파일 (전체·선택)">글꼴 받기</button></div></div>
   <div class="tabs pp-tabs" role="tablist">${tabs.map(([k,l])=>`<button class="tab ${tab===k?'on':''}" data-act="ppTab" data-k="${k}" role="tab" aria-selected="${tab===k}">${l}</button>`).join('')}</div>`;
  let body='';if(tab==='info')body=infoTab(P,ed,K);else if(tab==='edit')body=editTab(P,ed,K);else body=previewTab(P);
  return `${head}${A.guidesErr?rulesBanner():''}<div class="stack ppedit">${body}
   <section class="panel"><div class="row"><span class="small muted grow">칸을 고치면 미리보기에 바로 반영되고, 다른 칸으로 이동하면 저장됩니다.</span>${ed?`<button class="btn sm" data-act="ppDup">복제</button><button class="btn sm danger" data-act="ppDel">${A.confirm==='pdel'?'한 번 더 누르면 삭제':'제안서 삭제'}</button>`:''}</div></section></div>${A.pcrop?cropModal():''}`}
function aiBox(P,ed){const busy=A.ppBusy||pAiRunning(P);return `<section class="panel ai-box"><div class="panel-h"><div><h2>AI로 제안서 만들기</h2><div class="sub">소개서를 읽고 ① 구글 검색으로 시장 자료 ② 소개서 이미지 분석(메인 컬러·로고 컬러·앱 화면·캐릭터 위치) ③ 시장 → 방향 → 컨셉 → 그룹별 가이드까지 씁니다. 인원·단가·예상 성과는 계산된 숫자 그대로 들어갑니다.</div></div>${aiPill()}</div>
   ${P.aiStatus==='실패'&&P.aiError?`<div class="banner" style="margin:0 0 10px">AI 작성 실패: ${esc(P.aiError)}</div>`:''}
   <div class="row">${ed?`<button class="btn primary" data-act="ppAi" ${busy?'disabled':''}>${busy?`AI가 제안서를 쓰는 중… ${esc(P.aiStep||'시장 조사 · 이미지 분석 중')} (1~3분)`:P.ai?'AI로 다시 만들기 (내용 덮어쓰기)':'AI로 제안서 만들기'}</button>`:''}<span class="small muted">결과는 초안입니다. 시장 수치·효능 표현·제품 정보는 꼭 확인하세요.</span></div>
   ${P.ai&&(P.ai.checks||[]).length?`<div class="banner info" style="margin:10px 0 0"><b>광고주에게 보내기 전 확인</b><br>${(P.ai.checks||[]).map(x=>'• '+esc(x)).join('<br>')}${P.aiMeta&&P.aiMeta.research&&!P.aiMeta.research.ok?'<br>• 이번에는 구글 검색 시장 조사를 하지 못했습니다(무료 검색 한도). 시장 수치는 AI가 아는 공개 통계로 채웠으니 출처를 꼭 확인하세요.':''}${P.aiMeta&&/lite/.test(P.aiMeta.model||'')?'<br>• AI 서버가 붐벼 가벼운 모델로 작성했습니다. 품질이 아쉬우면 잠시 뒤 다시 만들어 주세요.':''}</div>`:''}</section>`}
function infoTab(P,ed,K){const I=P.info||{};
  return `<section class="panel"><div class="panel-h"><div><h2>상품소개서</h2><div class="sub">PDF나 PPT(.pptx)로 올리면 글자를 읽어 AI에 넘기고, 쪽 이미지에서 앱 화면·캐릭터를 잘라 장표에 넣습니다. 50MB 이하 · 브라우저 안에서만 읽습니다.</div></div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${ed?`<label class="btn primary" style="cursor:pointer">소개서 올리기 (PDF · PPT)<input type="file" accept="application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.txt,.md" data-ppsrc="cur" hidden></label>`:''}
       ${I.srcName?`<span class="pill ok">${esc(I.srcName)} · ${I.srcPages?I.srcPages+'쪽 · ':''}${won(String(I.srcText||'').length)}자</span>${ed?'<button class="btn sm ghost" data-act="ppSrcClear">지우기</button>':''}`:'<span class="small muted">아직 올린 소개서가 없습니다.</span>'}</div>
      <div class="fgrid" style="margin-top:12px"><label class="f">광고주 홈페이지 · 상품 링크 (선택)<textarea id="pp_info_links" data-pl="info.links" rows="2" placeholder="https://brand.com" ${ed?'':'readonly'}>${esc(L_(I.links).join('\n'))}</textarea><span class="hint">한 줄에 하나씩, 최대 3개</span></label>
       <label class="f">담당자 메모 · 광고주 요청 (선택)<textarea id="pp_info_memo" data-pv="info.memo" rows="3" placeholder="광고주 브리프, 꼭 넣을 메시지, 피할 표현, 경쟁사 등" ${ed?'':'readonly'}>${esc(I.memo||'')}</textarea></label></div></section>
     ${infoFields(I,'pp_',ed,K)}
     ${aiBox(P,ed)}`}
function previewTab(P){if(!P.ai)return `<div class="panel empty">아직 내용이 없습니다. ① 기초 정보에서 「AI로 제안서 만들기」를 눌러 주세요.</div>`;const sum=A.pseq==='sum';setTimeout(()=>schedPv(true),0);
  return `<section class="panel"><div class="panel-h"><div><h2>미리보기</h2><div class="sub">PPT와 같은 구성입니다. 다운로드는 오른쪽 위 버튼을 쓰세요.</div></div><div class="chips"><span class="chip ${!sum?'on':''}" data-act="ppSeq" data-k="main">본편</span><span class="chip ${sum?'on':''}" data-act="ppSeq" data-k="sum">요약본 7장</span></div></div>
    <div class="pv-deck" data-pvseq="${(sum?SEQ_SUM:SEQ).join(',')}" data-pvall="1" data-pvsum="${sum?1:0}"><div class="empty">미리보기를 만드는 중…</div></div></section>`}
/* ② 제안서 구성 수정: 하위 탭 + 오른쪽 실시간 미리보기 */
function editTab(P,ed,K){if(!P.ai)return `<div class="panel empty">아직 내용이 없습니다. ① 기초 정보에서 소개서·예산을 넣고 「AI로 제안서 만들기」를 눌러 주세요.</div>${aiBox(P,ed)}`;
  const sub=SUBS.find(s=>s[0]===A.psub)||SUBS[0];setTimeout(()=>schedPv(true),0);
  return `<div class="banner info pp-pc-note" style="margin:0">💻 이미지 자르기·장표 실시간 미리보기 같은 편집은 <b>PC</b>(넓은 화면)에서 작업하기 좋습니다. 모바일에서는 문구 수정·확인 위주로 써 주세요.</div>
   <div class="pp-subtabs" role="tablist">${SUBS.map(([k,l])=>`<button class="chip ${sub[0]===k?'on':''}" data-act="ppSub" data-k="${k}">${l}</button>`).join('')}</div>
   <div class="pp-split"><div class="pp-form stack">${subForm(sub[0],P,ed,K)}</div>
    <aside class="pp-live"><div class="pp-live-h"><b>미리보기</b><span class="small muted">${esc(sub[1])} · 고치는 대로 바뀝니다</span></div><div class="pv-deck one" data-pvseq="${sub[2].join(',')}"><div class="empty small">미리보기를 만드는 중…</div></div></aside></div>`}
/* 입력 칸 도우미 */
function F_(P,ed){const id=p=>'pp_'+p.replace(/[.\s:]/g,'_');
  return {tx:(p,l,o={})=>{const v=getIn(P,p);return `<label class="f ${o.wide?'wide':''}">${l}<input type="${o.type||'text'}" id="${id(p)}" data-pv="${p}" ${o.t?`data-t="${o.t}"`:''} value="${esc(v??'')}" placeholder="${esc(o.ph||'')}" ${ed?'':'readonly'}>${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`},
    ta:(p,l,o={})=>{const v=getIn(P,p);return `<label class="f ${o.wide!==false?'wide':''}">${l}<textarea id="${id(p)}" data-pv="${p}" rows="${o.rows||2}" placeholder="${esc(o.ph||'')}" ${ed?'':'readonly'}>${esc(v??'')}</textarea>${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`},
    tl:(p,l,o={})=>{const v=getIn(P,p)||[];return `<label class="f ${o.wide!==false?'wide':''}">${l}<textarea id="${id(p)}" data-pl="${p}" rows="${o.rows||Math.max(2,v.length)}" placeholder="${esc(o.ph||'한 줄에 하나씩')}" ${ed?'':'readonly'}>${esc(L_(v).join('\n'))}</textarea><span class="hint">${o.hint||'한 줄에 하나씩'}</span></label>`},
    sel:(p,l,opts)=>{const v=getIn(P,p);return `<label class="f">${l}<select id="${id(p)}" data-pv="${p}" ${ed?'':'disabled'}>${opts.map(x=>{const [val,lab]=Array.isArray(x)?x:[x,x];return `<option value="${esc(val)}" ${String(val)===String(v??'')?'selected':''}>${esc(lab)}</option>`}).join('')}</select></label>`},
    sec:(t,inner,sub)=>`<section class="panel"><div class="panel-h"><div><h2>${t}</h2>${sub?`<div class="sub">${sub}</div>`:''}</div></div><div class="fgrid">${inner}</div></section>`}}
const LB='대제목은 두 줄 — 쉼표·물음표 뒤에서 Enter로 줄을 바꿔 주세요';
function screenPick(P,path,label,ed){const v=getIn(P,path)||'';const L=cropsOf(P);
  return `<div class="f wide">${label}<div class="pp-thumbs">${[['','없음'],...L.map(c=>[c.id,c.label||c.id])].map(([id,l])=>`<button type="button" class="pp-th ${v===id?'on':''}" data-act="ppScreen" data-path="${esc(path)}" data-id="${esc(id)}" ${ed?'':'disabled'} title="${esc(l)}">${id?`<img src="${cropOf(id)}" alt="">`:'<span>없음</span>'}<i>${esc(l)}</i></button>`).join('')}</div>${L.length?'':'<span class="hint">소개서에서 자른 이미지가 없습니다. 「디자인 · 이미지」 탭에서 직접 자를 수 있습니다.</span>'}</div>`}
const GFXT=new Map();function gfxThumb(key,T,BR){const k=key+T.primary+T.accent;if(GFXT.has(k))return GFXT.get(k);GFXT.set(k,null);keyImg(key,T,BR).then(d=>{GFXT.set(k,d);scheduleRender()});return null}
function slotPicker(P,slot,ed){const d=((P.design||{}).img||{})[slot]||'auto';const C=slotCands(P,slot);const T=themeFor(P);const BR=(P.ai||{}).brand||(P.info||{}).brand||'Brand';
  const thumb=k=>{if(k==='auto'&&slot==='divider')return '<span>그룹별</span>';if(k.startsWith('crop:'))return `<img src="${cropOf(k.slice(5))}" alt="">`;if(k.startsWith('gfx:')){const c=gfxThumb(k,T,BR);return c?`<img src="${c}" alt="">`:'<span>…</span>'}return ''};
  const up=(A.pimgs||{})[slot];const isOn=c=>d===c.key||(d==='auto'&&C[0]&&C[0].key===c.key&&!(up&&!((P.design||{}).img||{})[slot]));
  return `<div class="f wide"><div class="pp-thumbs">${C.map(c=>`<button type="button" class="pp-th ${isOn(c)?'on':''}" data-act="ppSlot" data-slot="${slot}" data-k="${esc(c.key)}" ${ed?'':'disabled'}>${thumb(c.key)}<i>${esc(c.label)}</i></button>`).join('')}
    <button type="button" class="pp-th ${d==='up'||(d==='auto'&&up&&slot!=='divider')?'on':''}" data-act="ppSlot" data-slot="${slot}" data-k="up" ${ed&&up?'':'disabled'}>${up?`<img src="${up}" alt="">`:'<span>직접 넣기</span>'}<i>직접 넣은 이미지</i></button>
    <button type="button" class="pp-th ${d==='none'?'on':''}" data-act="ppSlot" data-slot="${slot}" data-k="none" ${ed?'':'disabled'}><span>없음</span><i>이미지 없이</i></button></div>
   ${ed?`<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><label class="btn sm" style="cursor:pointer">이미지 파일 넣기<input type="file" accept="image/*" data-ppimg="${slot}" hidden></label><span class="small muted pp-paste-hint ${A.ppaste===slot?'on':''}" tabindex="0" data-ppaste="${slot}">${A.ppaste===slot?'<b>Ctrl+V</b>로 붙여넣으세요':'여기를 클릭한 뒤 Ctrl+V로 붙여넣기'}</span></div>`:''}</div>`}
function bgPicker(P,kind,ed){const v=((P.design||{}).bg||{})[kind]||(kind==='body'?'none':'skill');const T=themeFor(P);const up=(A.pimgs||{})['bg_'+kind];const op=N((((P.design||{}).bgOp)||{})[kind]||(kind==='body'?15:35));
  const sw=s=>{if(s==='skill'||s==='none'){return `<span class="pp-sw" style="background:#${kind==='body'?'FFFFFF':kind==='closing'?T.closing:T.primary}">${s==='skill'?'<i class="pp-sw-c"></i>':''}</span>`}const d=PPD().bgImage(T,kind,s);return `<img src="${d}" alt="">`};
  return `<div class="f wide"><b class="small">${BG_KIND[kind]}</b><div class="pp-thumbs bg">${BG_OPTS[kind].map(([k,l])=>`<button type="button" class="pp-th wide ${v===k?'on':''}" data-act="ppBg" data-kind="${kind}" data-k="${k}" ${ed?'':'disabled'}>${sw(k)}<i>${l}</i></button>`).join('')}
    <button type="button" class="pp-th wide ${v==='up'?'on':''}" data-act="ppBg" data-kind="${kind}" data-k="up" ${ed&&up?'':'disabled'}>${up?`<img src="${up}" alt="" style="opacity:.6">`:'<span>직접 넣기</span>'}<i>내 이미지 (투명도 처리)</i></button></div>
   ${ed?`<div class="row" style="gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap"><label class="btn sm" style="cursor:pointer">배경 이미지 넣기<input type="file" accept="image/*" data-ppimg="bg_${kind}" hidden></label>${v==='up'?`<span class="small">진하기</span><input type="range" min="5" max="${kind==='body'?30:60}" value="${op}" data-ppop="${kind}" style="width:140px"><span class="small muted">${op}% · 글자가 잘 읽히도록 ${kind==='body'?'흰색':'메인 컬러'}로 덮습니다</span>`:''}</div>`:''}</div>`}
function subForm(k,P,ed,K){const f=F_(P,ed);const AI=P.ai||{};const gi=k.startsWith('group')?(AI.groups||[]).findIndex(g=>g.key===k.slice(5)):-1;
  if(k==='cover')return f.sec('표지',`${f.ta('ai.cover.tagline','1줄 캠페인 컨셉 (28pt)',{rows:1,hint:'표지 큰 제목 「인플루언서 마케팅 제안서」 아래 한 줄 — 비우면 캠페인 컨셉 1줄을 씁니다'})}${f.tx('ai.brand','브랜드 표기',{hint:'공식 표기 (한글 음차 금지)'})}${f.tx('title','제안서 이름 (목록용)')}${f.sel('status','상태',['작성 중','광고주 전달','완료'])}
      <div class="f wide"><span class="small muted">예산 표기: 「총 예산 ${man(K.total)}원 · ${weeksOf(P.info||{}).last+1}주 운영 · VAT 별도」 (자동)</span></div>`)+f.sec('표지 이미지 (선택)',slotPicker(P,'cover',ed),'표지 오른쪽에 들어갑니다. 소개서에서 자른 이미지 · 폰 목업 · 카드 그래픽 중에서 고르세요.')+f.sec('목차 이미지',screenPick(P,'ai.screens.mascot','목차 왼쪽 아래 (캐릭터·제품)',ed));
  if(k==='market'){const m=AI.market||{};return f.sec('01 시장 현황 — 첫 장',`${f.ta('ai.market.title','대제목',{rows:2,hint:LB})}${f.ta('ai.market.sub','소제목',{rows:2})}${L_(m.stats).map((x,i)=>f.tx(`ai.market.stats.${i}.label`,`지표 ${i+1} · 이름`)+f.tx(`ai.market.stats.${i}.value`,'숫자')+f.tx(`ai.market.stats.${i}.unit`,'단위')+f.ta(`ai.market.stats.${i}.desc`,'설명',{wide:false})).join('')}${f.tx('ai.market.source','출처',{wide:true})}`)
      +f.sec('01 시장 현황 — 인사이트 장',`${f.ta('ai.market.title2','대제목',{rows:2,hint:LB})}${f.ta('ai.market.sub2','소제목',{rows:2})}${L_(m.insights).map((x,i)=>f.tx(`ai.market.insights.${i}.kicker`,`인사이트 ${i+1} · 라벨`)+f.tx(`ai.market.insights.${i}.value`,'핵심')+f.ta(`ai.market.insights.${i}.text`,'설명',{wide:false})).join('')}${f.ta('ai.market.takeaway','INSIGHT (결론)',{rows:3})}${f.tx('ai.market.source2','출처',{wide:true})}`)}
  if(k==='direction')return f.sec('02 브랜드가 나아갈 방향',`${f.ta('ai.direction.title','대제목',{rows:2,hint:LB})}${f.ta('ai.direction.sub','소제목',{rows:2})}${L_((AI.direction||{}).shifts).map((x,i)=>f.tx(`ai.direction.shifts.${i}.from`,`변화 ${i+1} · 지금`)+f.tx(`ai.direction.shifts.${i}.to`,'바뀔 모습')+f.tx(`ai.direction.shifts.${i}.desc`,'설명',{wide:true})).join('')}${f.tx('ai.direction.positioning','포지셔닝 한 줄',{wide:true})}${screenPick(P,'ai.screens.direction','오른쪽 이미지',ed)}`);
  if(k==='capability'){const camps=benchCamps();return f.sec('03 링컴즈 역량',`<div class="f wide"><span class="small muted">역량 4가지(크리에이터 네트워크 · 캠페인 관리 플랫폼 · 전환 트래킹 · 2차 활용)는 스킬 고정 문구입니다. 아래 레퍼런스 캠페인만 고를 수 있습니다.</span></div>
      <label class="f wide">유사 볼륨 캠페인 레퍼런스 (실측)<select id="pp_bench" data-pv="plan.bench" ${ed?'':'disabled'}><option value="">전체 집행 캠페인 (인플루언서 풀)</option>${camps.map(([c,nm,n_])=>`<option value="${esc(c)}" ${(P.plan||{}).bench===c?'selected':''}>${esc(nm)} · ${n_}명</option>`).join('')}</select><span class="hint">${esc(K.bm.name)} · 실측 콘텐츠 3개 미만 티어는 묵끄럽 8월 실측값</span></label>`)}
  if(k==='concept')return f.sec('04 캠페인 컨셉 (우산)',`${f.ta('ai.umbrella.name','컨셉명 (2줄)',{rows:2,hint:LB})}${f.tx('ai.umbrella.oneLine','컨셉 1줄 (표지·마지막 장)',{wide:true})}${f.ta('ai.umbrella.sub','컨셉 설명',{rows:2})}${f.tl('ai.umbrella.hashtags','해시태그',{rows:2})}`,'아래 세 카드에는 그룹 탭의 컨셉명·해시태그·카드 설명이 들어갑니다.')
      +f.sec('05 핵심 전략 (그룹별 기능)',`${f.ta('ai.titles.features.title','대제목',{rows:2,hint:LB})}${f.ta('ai.titles.features.sub','소제목',{rows:2})}<div class="f wide"><span class="small muted">그룹별 기능 3개·기대 효과·이미지는 각 그룹 탭에서 고칩니다.</span></div>`);
  if(gi>=0){const g=AI.groups[gi],b=`ai.groups.${gi}`,kk=g.key;const cuts=((g.guide||{}).cuts||[]).slice(0,4);
    return f.sec(`그룹 ${kk} · 기본`,`${f.tx(b+'.name','그룹 이름')}${f.tx(b+'.pillar','단계 (공감·인지 등)')}${f.ta(b+'.who','어떤 인플루언서',{wide:false})}${f.ta(b+'.role','맡을 역할',{wide:false})}${f.ta(b+'.content','콘텐츠',{wide:false})}${f.ta(b+'.effect','기대 효과',{wide:false})}${f.tl(b+'.search','섭외 후보 탐색 검색어',{wide:false,rows:2})}${f.tl(b+'.keywords','풀 검색 키워드',{wide:false,rows:2})}`)
      +f.sec(`그룹 ${kk} · 컨셉 장 (간지)`,`${f.ta(b+'.concept.name','그룹 컨셉명',{rows:2})}${f.tl(b+'.concept.hashtags','해시태그 2개',{rows:2,wide:false})}${f.tl(b+'.concept.story','스토리 4줄',{rows:4,wide:false})}${f.tx(b+'.concept.keyMessage','KEY MESSAGE',{wide:true})}${f.tx(b+'.concept.features','보여줄 기능',{wide:true})}${f.ta(b+'.concept.line','우산 컨셉 장 카드 설명',{rows:2})}${screenPick(P,'ai.screens.group'+kk,'오른쪽 이미지 (디자인 탭에서 간지 이미지를 하나로 고르면 그 이미지가 우선)',ed)}`)
      +f.sec(`그룹 ${kk} · 핵심 전략 열`,`${L_((g.feature||{}).items).map((it,ii)=>f.tx(`${b}.feature.items.${ii}.name`,`기능 ${ii+1}`)+f.tx(`${b}.feature.items.${ii}.desc`,'한 줄 설명')).join('')}${f.tx(b+'.feature.effect','기대 효과 한 줄',{wide:true})}${screenPick(P,'ai.screens.features'+kk,'열 이미지',ed)}`)
      +`<section class="panel"><div class="panel-h"><div><h2>그룹 ${kk} · 콘텐츠 가이드</h2><div class="sub">컷마다 ① 예시 이미지(Canva·Gemini에서 만들어 Ctrl+V)나 ② 소개서 앱 화면을 붙입니다. 예시 이미지가 있으면 그게 우선입니다.</div></div></div><div class="fgrid">${f.ta(b+'.guide.title','대제목',{rows:2,hint:LB})}${f.ta(b+'.guide.sub','소제목',{rows:2})}</div>
        <div class="pp-cuts">${cuts.map((c,ci)=>{const key=`${kk}_${ci}`,slot='cut:'+key,im=(A.pcimgs||{})[key];const cs=L_(((AI.screens||{})['cuts'+kk]));const scr=cs[ci]||cs[0];
          return `<div class="pp-cut"><div class="pp-cut-img ${A.ppaste===slot?'paste-on':''}" tabindex="0" data-ppaste="${slot}" title="클릭한 뒤 Ctrl+V로 이미지 붙여넣기">${im?`<img src="${im}" alt="CUT ${ci+1} 예시 이미지">`:scr&&cropOf(scr)?`<img src="${cropOf(scr)}" alt="" style="object-fit:contain;opacity:.85">`:`<span class="small muted">${A.ppaste===slot?'<b>Ctrl+V</b>로 붙여넣기':'CUT '+(ci+1)+' 예시 이미지<br>클릭 → Ctrl+V'}</span>`}</div>
            <div class="row" style="gap:4px;flex-wrap:wrap;justify-content:center">${ed?`<label class="btn sm" style="cursor:pointer">${im?'바꾸기':'넣기'}<input type="file" accept="image/*" data-ppimg="${slot}" hidden></label>${im?`<button class="btn sm ghost" data-act="ppImgDel" data-k="${slot}">삭제</button>`:''}`:''}<button class="btn sm" data-act="ppCanva" data-to="canva" data-g="${gi}" data-c="${ci}">Canva AI ↗</button><button class="btn sm" data-act="ppCanva" data-to="gemini" data-g="${gi}" data-c="${ci}">Gemini ↗</button></div>
            <div class="fgrid one">${f.tx(`${b}.guide.cuts.${ci}.step`,`CUT ${ci+1} · 단계`)}${f.tx(`${b}.guide.cuts.${ci}.time`,'시간')}${f.ta(`${b}.guide.cuts.${ci}.scene`,'화면')}${f.ta(`${b}.guide.cuts.${ci}.line`,'멘션·자막')}${f.ta(`${b}.guide.cuts.${ci}.prompt`,'🖼 이미지 프롬프트',{rows:2})}</div></div>`}).join('')}</div>
        <div class="fgrid">${f.ta(b+'.guide.caption','캡션 예시',{rows:4,wide:false})}<div class="stack" style="gap:10px">${f.tl(b+'.guide.must','MUST',{rows:3})}${f.tl(b+'.guide.dont',"DON'T",{rows:3})}</div></div></section>`}
  if(k==='plan')return planForm(P,ed,K,f);
  if(k==='timeline')return f.sec('07 타임라인',`${f.ta('ai.timeline.title','대제목 (비우면 자동)',{rows:2,ph:`한 주에 ${K.people}개 콘텐츠,\n피드를 ${(AI.brand||'')}로 채웁니다`})}${f.ta('ai.timeline.sub','소제목 (비우면 자동)',{rows:2})}
      ${f.tx('info.start','업로드 시작일 (= W4)',{type:'date'})}${f.tx('info.end','집행 종료일',{type:'date'})}<div class="f wide"><span class="small muted">일정은 스킬 기준 8주(W0~W7): 제안 확정·리스트업 → 섭외·계약 2주 → 브리프·가편 검수 → <b>W4 A·B·C 동시 업로드</b>(최소 6개월 게시글 유지) → D+7 1차 리포트 → 2차 활용 → 최종 리포트</span></div>`);
  if(k==='closing')return f.sec('마지막 장 이미지',slotPicker(P,'closing',ed),'「감사합니다」 위 가운데에 들어갑니다.')+f.sec('Appendix · 섭외 기준 & 리스크 관리','<div class="f wide"><span class="small muted">섭외 기준·리스크 관리는 고정 문구입니다. 성과 추정 기준(Appendix A)은 스킬 기본값에 따라 넣지 않습니다.</span></div>');
  if(k==='design')return designForm(P,ed,f);
  return ''}
function planForm(P,ed,K,f){const R=K.R;const bm=K.bm;const M=matrixOf(R);
  return `<section class="panel"><div class="panel-h"><div><h2>06 티어 구성 · 광고비 (VAT 별도)</h2><div class="sub">예산을 넣으면 티어별 인원·단가가 자동으로 잡히고, 단가 × 인원 합계가 광고비와 정확히 맞춰집니다. 칸을 고치면 직접 구성으로 바뀝니다.</div></div>${ed?'<button class="btn sm" data-act="ppAuto">예산으로 자동 구성</button>':''}</div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>티어</th><th>팔로워</th><th class="n">인원</th><th class="n">1인 단가 (원)</th><th class="n">소계</th><th>역할</th><th>이유</th></tr></thead><tbody>${R.map((r,i)=>{const w=((P.ai||{}).tierWhy||{})[r.tier]||{};return `<tr><td class="bold">${r.tier}</td><td class="small" style="white-space:nowrap">${RANGE[r.tier]}</td><td class="n"><input type="text" inputmode="numeric" id="pp_tc${i}" data-ptier="${i}" data-f="count" value="${r.count}" style="width:56px;text-align:right" ${ed?'':'readonly'}></td><td class="n"><input type="text" inputmode="numeric" id="pp_tu${i}" data-ptier="${i}" data-f="unit" value="${won(r.unit)}" style="width:100px;text-align:right" ${ed?'':'readonly'}></td><td class="n">${won(r.count*r.unit)}</td>
        <td><input type="text" id="pp_tr${i}" data-pv="ai.tierWhy.${r.tier}.role" value="${esc(w.role||'')}" style="width:70px" ${ed?'':'readonly'}></td><td><input type="text" id="pp_tw${i}" data-pv="ai.tierWhy.${r.tier}.why" value="${esc(w.why||'')}" style="min-width:170px" ${ed?'':'readonly'}></td></tr>`}).join('')}
       <tr class="tot"><td class="bold">합계</td><td></td><td class="n bold">${K.people}명</td><td></td><td class="n bold">${won(K.ad)}</td><td colspan="2" class="small">${(P.plan&&P.plan.tiers&&P.plan.tiers.length)?'직접 구성':'자동 구성'}</td></tr></tbody></table></div>
      <div class="pp-money"><div><span>광고비</span><b>${won(K.ad)}원</b></div><div><span>대행수수료 ${K.f.rate}%</span><b>${won(K.fee)}원</b></div><div><span>총액</span><b>${won(K.total)}원</b></div><div><span>VAT</span><b>별도</b></div></div>
      ${Math.abs(K.diff)>=1?`<div class="banner" style="margin:10px 0 0">티어 단가 합계(${won(K.ad)}원)가 광고비 목표(${won(K.adTarget)}원)와 ${won(Math.abs(K.diff))}원 ${K.diff>0?'많습니다':'적습니다'}. 인원·단가를 고치거나 「예산으로 자동 구성」을 눌러 주세요.</div>`:''}</section>
    ${f.sec('06 장 제목',`${f.ta('ai.titles.tiers.title','티어 구성 장 대제목',{rows:2,hint:LB})}${f.ta('ai.titles.tiers.sub','소제목',{rows:2})}${f.ta('ai.titles.categories.title','카테고리 장 대제목',{rows:2})}${f.ta('ai.titles.categories.sub','소제목',{rows:2})}${f.ta('ai.titles.matrix.title','그룹×티어 장 대제목',{rows:2})}${f.tl('ai.matrixPoints','구성 포인트 3개',{rows:3})}${f.ta('ai.titles.showcase.title','섭외 후보 장 대제목',{rows:2})}${f.ta('ai.titles.showcase.sub','소제목',{rows:2})}${f.ta('ai.titles.kpi.title','예상 성과 장 대제목',{rows:2})}${f.ta('ai.titles.kpi.sub','소제목',{rows:2})}`)}
    <section class="panel"><div class="panel-h"><div><h2>예상 성과</h2><div class="sub">조회수 = 티어별 인원 × 링컴즈 집행 캠페인 평균 조회 · 참여 = 조회 × ER · 좋아요 = 참여 × 0.92 · CPV = 총액 ÷ 조회수</div></div></div>
      <div class="fgrid">${f.tx('plan.er','적용 ER (%)',{t:'num',ph:'2.0',hint:'보수적으로 2.0% 권장 (링컴즈 실측 1.6~2.8%)'})}<div class="f"><span class="small muted">실측 기준: ${esc(bm.name)} (03 역량 탭에서 변경)</span></div></div>
      <div class="pp-money"><div><span>예상 조회수</span><b>${won(K.views)}</b></div><div><span>ER</span><b>${pc(K.er)}</b></div><div><span>좋아요</span><b>${won(Math.round(K.likes))}</b></div><div><span>CPV</span><b>${K.cpv.toFixed(1)}원</b></div></div></section>
    <section class="panel"><div class="panel-h"><div><h2>그룹 × 티어</h2><div class="sub">A ${GW.A*100}% · B ${GW.B*100}% · C ${GW.C*100}% 비율로 나눕니다.</div></div></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>그룹</th>${PT.map(t=>`<th class="n">${t}</th>`).join('')}<th class="n">합계</th></tr></thead><tbody>${GKEYS.map(k=>{const g=((P.ai||{}).groups||[]).find(x=>x.key===k)||{};const tot=PT.reduce((a,t)=>a+(M[k][t]||0),0);return `<tr><td class="bold">${k} ${esc(g.name||'')}</td>${PT.map(t=>`<td class="n">${M[k][t]||'–'}</td>`).join('')}<td class="n bold">${tot}명</td></tr>`}).join('')}</tbody></table></div></section>
    ${pickPanel(P,ed)}`}
/* 폰트 고르기: 분류별 목록 + 고른 폰트의 굵기 구성 미리보기 */
function fontPicker(P,ed){const L=PPD().FONTS;const id=fontId(P);const cur=PPD().fontOf(id);const w=PPD().weightsOf(cur);L.forEach(f=>PPD().loadFontCss(f.id));
  const WN={100:'Thin',200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black'};const ff=f=>`'${f.fam}','Pretendard',sans-serif`;
  const cats=[...new Set(L.map(f=>f.cat))];
  return `<label class="f">제안서 폰트<select id="pp_font" data-ppfont="1" ${ed?'':'disabled'}>${cats.map(c=>`<optgroup label="${c}">${L.filter(f=>f.cat===c).map(f=>`<option value="${f.id}" ${f.id===cur.id?'selected':''}>${esc(f.name)}${f.w.length>1?` · 굵기 ${f.w.length}종`:''}</option>`).join('')}</optgroup>`).join('')}</select><span class="hint">${esc(cur.fam)} · ${cur.cat}</span></label>
   <div class="f wide"><div class="pp-font-pv" style="font-family:${ff(cur)};border:1px solid var(--line);border-radius:10px;padding:14px 16px;display:grid;gap:6px;background:var(--surface2)">
    <div style="font-weight:${w.xb};font-size:24px;line-height:1.2">대제목 · 인플루언서 마케팅 제안서 <span class="small muted" style="font-family:var(--font);font-weight:500">${WN[w.xb]||w.xb}</span></div>
    <div style="font-weight:${w.b};font-size:16px">소제목 · 그룹별 컨셉과 핵심 전략 <span class="small muted" style="font-family:var(--font);font-weight:500">${WN[w.b]||w.b}</span></div>
    <div style="font-weight:${w.r};font-size:14px">본문 · 브랜드 메시지를 인플루언서의 언어로 자연스럽게 전합니다. 123,456원 <span class="small muted" style="font-family:var(--font);font-weight:500">${WN[w.r]||w.r}</span></div>
    <div style="font-weight:${w.l};font-size:13px;color:var(--muted)">설명 · 출처와 기준을 함께 적어 신뢰도를 높입니다. <span class="small" style="font-family:var(--font);font-weight:500">${WN[w.l]||w.l}</span></div></div>
    ${cur.w.length<3?'<span class="hint">이 폰트는 굵기가 적어 일부 단계가 같은 굵기로 보입니다.</span>':''}</div>
   <div class="f wide"><div class="pp-fonts">${L.map(f=>`<button type="button" class="pp-fontchip ${f.id===cur.id?'on':''}" data-act="ppFont" data-id="${f.id}" ${ed?'':'disabled'} style="font-family:${ff(f)};font-weight:${PPD().weightsOf(f).xb}" title="${esc(f.name)}">가나다 Aa<span>${esc(f.name)}</span></button>`).join('')}</div></div>
   ${fontDlBox(cur)}`}
/* 폰트 파일 받기: 설치용 TTF·OTF — 전체 또는 골라서 */
function fontDlBox(cur){const L=PPD().filesOf(cur.id);const used=PPD().usedFiles(cur.id);const WN={100:'Thin',200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black'};
  if(!A.pfsel||A.pfsel.font!==cur.id)A.pfsel={font:cur.id,set:new Set(used)};const sel=A.pfsel.set;const busy=A.pfdl;
  return `<div class="f wide" id="pp-fontdl"><div class="pp-fontdl"><div class="row" style="justify-content:space-between;gap:8px"><b>폰트 파일 받기 · ${esc(cur.name)}</b><span class="row" style="gap:6px"><button class="btn sm" data-act="ppFontDl" data-k="sel" ${busy||!sel.size?'disabled':''}>선택 받기 (${sel.size}개)</button><button class="btn sm primary" data-act="ppFontDl" data-k="all" ${busy?'disabled':''}>${busy?esc(busy):`전체 받기 (${L.length}개)`}</button></span></div>
    <div class="pp-fdl-list">${L.map(x=>`<label class="pp-fdl"><input type="checkbox" data-ppfdl="${x.w}" ${sel.has(x.w)?'checked':''}><span><b>${WN[x.w]||x.w}</b> <span class="muted">${x.w}</span>${used.includes(x.w)?' <em>제안서에 사용</em>':''}<br><span class="small muted">${esc(x.file)}</span></span></label>`).join('')}</div>
    <span class="hint">PPT를 받는 PC에 설치하면(파일 더블클릭 → 설치) PowerPoint를 다시 열었을 때 제안서 글꼴이 그대로 보입니다. 「제안서에 사용」 표시가 PPT에 쓰인 굵기입니다. 여러 개를 고르면 ZIP으로 받습니다. 폰트 라이선스는 각 배포처 기준을 따릅니다.</span></div></div>`}
async function fontDownload(id,all){const f=PPD().fontOf(id);const L=PPD().filesOf(id).filter(x=>all||(A.pfsel&&A.pfsel.set.has(x.w)));if(!L.length)return toast('받을 굵기를 골라 주세요.','crit');
  const save=(blob,name)=>{const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)};
  try{A.pfdl='받는 중… 0/'+L.length;render();const out=[];let i=0;
    for(const x of L){const r=await fetch(x.url);if(!r.ok)throw new Error(`${x.file} (${r.status})`);out.push({...x,blob:await r.blob()});A.pfdl=`받는 중… ${++i}/${L.length}`;render()}
    if(out.length===1){save(out[0].blob,out[0].file)}
    else{if(!window.JSZip)await loadScript('/vendor/pptxgen.bundle.js');const z=new JSZip();const dir=z.folder(f.name.replace(/[\\/:*?"<>|]/g,''));out.forEach(x=>dir.file(x.file,x.blob));
      dir.file('설치 방법.txt',`${f.name} 글꼴 (${out.length}개)\r\n\r\n[Windows] 폰트 파일을 모두 선택 → 마우스 오른쪽 → 「설치」 (또는 「모든 사용자용으로 설치」)\r\n[Mac] 폰트 파일을 더블클릭 → 「서체 설치」\r\n\r\n설치 후 PowerPoint를 완전히 닫았다가 다시 열면 제안서 글꼴이 그대로 보입니다.\r\nPPT에서 쓰는 글꼴 이름: ${[...new Set(out.map(x=>x.name))].join(', ')}\r\n\r\n폰트 라이선스는 각 배포처의 기준을 따릅니다.\r\nRINGCOMS MCN 광고콘텐츠팀`);
      save(await z.generateAsync({type:'blob'}),`${f.name.replace(/[\\/:*?"<>|\s()]+/g,'_')}_글꼴_${out.length}개.zip`)}
    toast(`${f.name} 글꼴 ${out.length}개를 받았습니다.`)}
  catch(e){console.error(e);toast('글꼴을 받지 못했습니다: '+(e.message||e),'crit')}finally{A.pfdl=null;render()}}
function designForm(P,ed,f){const t=P.theme||{};const T=themeFor(P);const SRC={deck:'소개서 메인 컬러','logo':'로고·CI 컬러','logo+accent':'소개서 메인 컬러가 너무 밝거나 화려해 포인트로 쓰고, 로고·CI 컬러를 메인 배경으로','deck-dark':'소개서 메인 컬러를 어둡게 (포인트는 원래 색)',manual:'직접 고른 색',default:'기본 색'};
  const crops=P.crops||[];
  return f.sec('브랜드 컬러',`<div class="f wide"><div class="pp-colors"><div><span class="pp-sw lg" style="background:#${T.primary}"></span><b>메인 #${T.primary}</b><span class="small muted">배경·제목 강조</span></div><div><span class="pp-sw lg" style="background:#${T.accent}"></span><b>포인트 #${T.accent}</b><span class="small muted">차트·도형</span></div></div>
      <div class="small muted" style="margin-top:6px">선택 근거: ${esc(SRC[T.src]||'')}${t.deckMain?` · 소개서 메인 #${esc(t.deckMain)}`:''}${t.logo?` · 로고 #${esc(t.logo)}`:''}${t.note?` · ${esc(t.note)}`:''}</div>
      <span class="hint">우선순위: ① 소개서에서 메인으로 쓰인 컬러 → 너무 밝거나 화려하면 포인트로만 쓰고 ② 로고·CI 컬러를 메인 배경으로 → ③ 소개서 메인 컬러를 어둡게</span></div>
     ${ed?`<label class="f">메인 컬러 직접 고르기<span class="row" style="flex-wrap:nowrap"><input type="color" id="pp_th_p" data-ppth="primary" value="#${T.primary}" style="width:48px;height:34px;padding:2px"></span></label><label class="f">포인트 컬러<span class="row" style="flex-wrap:nowrap"><input type="color" id="pp_th_a" data-ppth="accent" value="#${T.accent}" style="width:48px;height:34px;padding:2px"></span></label>${t.manual?'<div class="f"><button class="btn sm" data-act="ppThemeAuto">자동 선택으로 되돌리기</button></div>':''}`:''}`)
   +f.sec('폰트',fontPicker(P,ed),'무료 폰트 30종 중에서 고르면 대제목·소제목·본문·설명에 맞는 굵기가 자동으로 정해져 미리보기·PDF·PPT에 모두 적용됩니다. PPT는 받는 PC에 같은 폰트가 설치되어 있어야 그대로 보이니, 아래 「폰트 파일 받기」로 함께 전달하세요.')
   +f.sec('표지 이미지 (선택)',`<div class="f wide"><b class="small">표지</b></div>${slotPicker(P,'cover',ed)}<div class="f wide"><b class="small">간지 (그룹 컨셉 장)</b></div>${slotPicker(P,'divider',ed)}<div class="f wide"><b class="small">마지막 장</b></div>${slotPicker(P,'closing',ed)}`,'표지·간지·마지막 장에 넣을 이미지를 3가지 후보 중에서 고르거나 직접 넣습니다. 후보는 소개서에서 자른 이미지와 무료로 그린 그래픽입니다.')
   +f.sec('배경',['cover','divider','closing','body'].map(kd=>bgPicker(P,kd,ed)).join(''),'장 성격에 맞게 도형·그라데이션을 고릅니다. 본문 장은 글이 잘 읽히도록 아주 옅게만 들어갑니다.')
   +`<section class="panel"><div class="panel-h"><div><h2>소개서에서 자른 이미지 ${crops.length?crops.length+'개':''}</h2><div class="sub">AI가 소개서에서 앱 화면·캐릭터·제품을 찾아 잘랐습니다. 잘못 잘렸으면 「다시 자르기」로 고치고, 필요한 이미지는 「새로 자르기」로 더할 수 있습니다.</div></div>${ed&&pagesOf().length?'<button class="btn sm" data-act="ppCropAdd">+ 새로 자르기</button>':''}</div>
     ${crops.length?`<div class="pp-crops">${crops.map(c=>`<div class="pp-crop"><div class="pp-crop-img">${cropOf(c.id)?`<img src="${cropOf(c.id)}" alt="">`:'<span class="small muted">이미지 없음</span>'}</div><div class="small"><b>${esc(c.label||c.id)}</b><br><span class="muted">${esc({app_screen:'앱 화면',mascot:'캐릭터 (배경 지움)',product:'제품'}[c.kind]||c.kind)} · ${c.page}쪽</span></div>${ed?`<div class="row" style="gap:4px"><button class="btn sm" data-act="ppCropEdit" data-id="${esc(c.id)}" ${pagesOf().length?'':'disabled title="소개서 쪽 이미지가 없습니다"'}>다시 자르기</button><button class="btn sm ghost" data-act="ppCropDel" data-id="${esc(c.id)}">삭제</button></div>`:''}</div>`).join('')}</div>`:`<div class="empty small">${pagesOf().length?'아직 자른 이미지가 없습니다. 「AI로 제안서 만들기」를 하면 자동으로 자르고, 「새로 자르기」로 직접 자를 수도 있습니다.':'소개서(PDF·PPT)를 올리면 쪽 이미지에서 자를 수 있습니다.'}</div>`}
     <p class="small muted pp-pc-note" style="margin:8px 0 0">이미지 자르기는 마우스로 끌어 영역을 고르는 방식이라 PC에서 작업해 주세요.</p></section>`}
/* 자르기 창: 쪽을 고르고 마우스로 끌어 영역 지정 */
function cropModal(){const C=A.pcrop;const pages=pagesOf();const pg=pages.find(p=>p.n===C.page)||pages[0];if(!pg)return '';const b=C.box||[100,100,900,900];
  return `<div class="pp-modal-bg" data-act="ppCropClose"></div><div class="pp-modal panel" role="dialog" aria-label="이미지 자르기"><div class="panel-h"><h2>${C.id?'다시 자르기':'새로 자르기'}</h2><button class="btn sm ghost" data-act="ppCropClose">닫기</button></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><span class="small bold">쪽</span>${pages.map(p=>`<button class="chip ${p.n===pg.n?'on':''}" data-act="ppCropPage" data-n="${p.n}">${p.n}</button>`).join('')}</div>
    <div class="pp-crop-stage" id="pp-crop-stage"><img src="${pg.data}" alt="" draggable="false"><div class="pp-crop-box" id="pp-crop-box" style="top:${b[0]/10}%;left:${b[1]/10}%;height:${(b[2]-b[0])/10}%;width:${(b[3]-b[1])/10}%"></div></div>
    <div class="fgrid" style="margin-top:10px"><label class="f">이름<input type="text" id="pp_crop_label" value="${esc(C.label||'')}" placeholder="예: 채팅 화면"></label><label class="f">종류<select id="pp_crop_kind">${[['app_screen','앱 화면'],['mascot','캐릭터 (배경 지우기)'],['product','제품']].map(([k,l])=>`<option value="${k}" ${C.kind===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
    <div class="row" style="margin-top:10px"><span class="small muted grow">이미지 위에서 마우스로 끌어 영역을 고르세요.</span><button class="btn primary" data-act="ppCropSave">저장</button></div></div>`}

function setFontP(P,id){if(!canEdit())return toast('보기 전용 권한이라 수정할 수 없습니다.','crit');P.design=P.design||{};P.design.font=id;A.pfsel=null;PPD().loadFontCss(id);pSave('design',P);GFXT.clear();render();schedPv(true);toast(`제안서 폰트를 「${PPD().fontOf(id).name}」(으)로 바꿨습니다.`)}
/* ============ 입력 저장 ============ */
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||A.view!=='proposals')return;const P=curP();if(!P)return;
  if(t.dataset.pv&&/^ai\.|^title$/.test(t.dataset.pv)){setIn(P,t.dataset.pv,t.value);schedPv()}
  else if(t.dataset.pl&&/^ai\./.test(t.dataset.pl)){setIn(P,t.dataset.pl,lines(t.value));schedPv()}
  else if(t.dataset.ppop){P.design=P.design||{};P.design.bgOp={...(P.design.bgOp||{}),[t.dataset.ppop]:N(t.value)};schedPv()}
  else if(t.dataset.ppth){const T=themeFor(P);P.theme={...(P.theme||{}),manual:{primary:T.primary,accent:T.accent,...((P.theme||{}).manual||{}),[t.dataset.ppth]:t.value.replace('#','').toUpperCase()}};schedPv()}});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset)return;const P=curP();
  if(t.dataset.pn!=null&&A.pnew){let v=t.value;if(t.dataset.t==='num'){const x=N(v);v=String(v).trim()===''?'':x}setIn(A.pnew,t.dataset.pn,v);if(/budget|feeRate|feeMode/.test(t.dataset.pn))render();return}
  if(t.dataset.pplat){const tgt=t.dataset.pre==='ppn_'?A.pnew&&A.pnew.info:P&&P.info;if(!tgt)return;const L=PLATS.filter(x=>x===t.dataset.pplat?t.checked:platsOf(tgt).includes(x));if(!L.length){toast('채널을 하나 이상 골라 주세요.','crit');render();return}tgt.platforms=L;tgt.platform=L.map(x=>PLAT_FMT[x]).join(' · ');if(t.dataset.pre!=='ppn_'&&canEdit())pSave('info',P);render();return}
  if((t.dataset.pv||t.dataset.pl)&&P&&A.view==='proposals'){if(!canEdit())return toast('보기 전용 권한이라 수정할 수 없습니다.','crit');const p=t.dataset.pv||t.dataset.pl;let v=t.dataset.pl?lines(t.value):t.value;if(t.dataset.t==='num'){const x=N(v);v=String(v).trim()===''?'':x}
    setIn(P,p,v);pSave(p.split('.')[0],P);schedPv();if(['title','status','info.budget','info.feeRate','info.feeMode','plan.bench','plan.er','info.start','info.end'].includes(p)||/^ai\.tierWhy|^ai\.groups\.\d+\.(name|search|keywords)$/.test(p))render();return}
  if(t.dataset.ptier!=null&&P){if(!canEdit())return;const R=tierRows(P);const r=R[+t.dataset.ptier];r[t.dataset.f]=Math.max(0,Math.round(N(t.value)));P.plan=P.plan||{};P.plan.tiers=R;pSave('plan',P);schedPv();render();return}
  if(t.dataset.ppop&&P){pSave('design',P);render();return}
  if(t.dataset.ppth&&P){pSave('theme',P);GFXT.clear();render();return}
  if(t.dataset.ppfont&&P){setFontP(P,t.value);return}
  if(t.dataset.ppfdl&&A.pfsel){const w=+t.dataset.ppfdl;t.checked?A.pfsel.set.add(w):A.pfsel.set.delete(w);render();return}
  if(t.dataset.ppsrc&&t.files&&t.files[0]){const f=t.files[0];t.value='';if(t.dataset.ppsrc==='new'){readSrc(f,A.pnew.info,'new').then(()=>render())}else if(P){const info={...(P.info||{})};readSrc(f,info,A.pid).then(ok=>{if(ok){P.info=info;pSave('info',P)}render()})}return}
  if(t.dataset.ppimg&&t.files&&t.files[0]){const f=t.files[0];const k=t.dataset.ppimg;t.value='';ppImgIn(k,f)}});
function ppImgIn(slot,f){const cut=/^cut:/.test(slot);const bg=/^bg_/.test(slot);fileToDataUrl(f,cut?540:bg?1600:1100,cut?960:bg?900:1100,'image/jpeg',cut?0.72:0.8).then(async d=>{await pimgPut(cut?slot.slice(4):slot,d,cut?'cut':'p');const P=curP();if(!P||cut)return;P.design=P.design||{};
  if(bg){P.design.bg={...(P.design.bg||{}),[slot.slice(3)]:'up'}}else{P.design.img={...(P.design.img||{}),[slot]:'up'}}pSave('design',P);GFXT.clear();schedPv();render()}).catch(()=>toast('이미지를 넣지 못했습니다.','crit'))}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ppaste]');if(!b||e.target.closest('button,label,input'))return;A.ppaste=b.dataset.ppaste;render();setTimeout(()=>{const el=document.querySelector(`[data-ppaste="${A.ppaste}"]`);if(el)el.focus({preventScroll:true})},0)});
document.addEventListener('paste',e=>{if(A.view!=='proposals'||!A.pid||!A.ppaste)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;const it=[...((e.clipboardData&&e.clipboardData.items)||[])].find(x=>x.kind==='file'&&/^image\//.test(x.type));
  if(!it)return toast('복사한 이미지가 없습니다.','crit');e.preventDefault();ppImgIn(A.ppaste,it.getAsFile())});
/* 자르기: 마우스로 끌기 */
document.addEventListener('pointerdown',e=>{const st=e.target.closest&&e.target.closest('#pp-crop-stage');if(!st||!A.pcrop)return;e.preventDefault();const r=st.getBoundingClientRect();const p0=[(e.clientY-r.top)/r.height,(e.clientX-r.left)/r.width];const box=document.getElementById('pp-crop-box');
  const mv=ev=>{const p1=[Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height)),Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width))];const b=[Math.min(p0[0],p1[0]),Math.min(p0[1],p1[1]),Math.max(p0[0],p1[0]),Math.max(p0[1],p1[1])].map(v=>Math.round(v*1000));A.pcrop.box=b;
    if(box){box.style.top=b[0]/10+'%';box.style.left=b[1]/10+'%';box.style.height=(b[2]-b[0])/10+'%';box.style.width=(b[3]-b[1])/10+'%'}};
  const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up)};document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(A.pcrop){A.pcrop=null;render()}else if(A.ppaste){A.ppaste='';render()}}});

Object.assign(ACT,{
  ppNew(){A.pnew={title:'',info:newInfo()};A.ppPages=null;render();window.scrollTo(0,0)},
  ppNewCancel(){A.pnew=null;render();window.scrollTo(0,0)},
  async ppCreate(a){const D=A.pnew;if(!D)return;document.querySelectorAll('[data-pn]').forEach(el=>{let v=el.value;if(el.dataset.t==='num'){const x=N(v);v=String(v).trim()===''?'':x}setIn(D,el.dataset.pn,v)});
    const I=D.info;const P={kind:'proposal',title:String(D.title||'').trim()||`${I.brand||I.advertiser||'새'} 인플루언서 캠페인 제안서`,status:'작성 중',createdAt:today(),updatedAt:new Date().toISOString(),by:A.user.email,info:I,plan:{tiers:[],er:2,bench:''},picks:{},ai:null,design:{},theme:{}};
    const id=uid();try{await DB.set('guides/'+id,P);A.props=A.props||{};A.props[id]=P;A.pnew=null;A.pid=id;A.ptab='info';A.psub='cover';
      const pages=A.ppPages&&A.ppPages.pid==='new'?A.ppPages.list:[];if(pages.length){A.ppPages={pid:id,list:pages};await savePages(id,pages)}
      render();window.scrollTo(0,0);toast('제안서를 만들었습니다.');if(a.dataset.ai==='1')setTimeout(()=>ACT.ppAi(),200)}catch(e){saveErr(e)}},
  ppOpen(a){A.pid=a.dataset.p;A.ptab='';A.psub=A.psub||'cover';A.confirm=null;A.pcrop=null;render();window.scrollTo(0,0)},
  ppBack(){A.pid='';A.pcrop=null;render();window.scrollTo(0,0)},
  ppTab(a){A.ptab=a.dataset.k;A.pcrop=null;render()},
  ppSub(a){A.psub=a.dataset.k;A.pcrop=null;render()},
  ppSeq(a){A.pseq=a.dataset.k==='sum'?'sum':'';render()},
  ppExp(a){ppExport(a.dataset.k)},
  async ppScreen(a){const P=curP();P.ai=P.ai||{};P.ai.screens=P.ai.screens||{};setIn(P,a.dataset.path,a.dataset.id);await pSave('ai',P);schedPv();render()},
  async ppSlot(a){const P=curP();P.design=P.design||{};P.design.img={...(P.design.img||{}),[a.dataset.slot]:a.dataset.k};await pSave('design',P);schedPv();render()},
  ppFontDl(a){const P=curP();if(!P||A.pfdl)return;fontDownload(fontId(P),a.dataset.k==='all')},
  ppFontGo(){A.ptab='edit';A.psub='design';A.pcrop=null;render();setTimeout(()=>{const el=document.getElementById('pp-fontdl');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},120)},
  ppFont(a){const P=curP();if(P&&canEdit())setFontP(P,a.dataset.id)},
  async ppBg(a){const P=curP();P.design=P.design||{};P.design.bg={...(P.design.bg||{}),[a.dataset.kind]:a.dataset.k};await pSave('design',P);schedPv();render()},
  async ppThemeAuto(){const P=curP();const t={...(P.theme||{})};delete t.manual;P.theme=t;await DB.update('guides/'+A.pid,{theme:t});GFXT.clear();schedPv();render()},
  ppImgDel(a){const k=a.dataset.k;if(/^cut:/.test(k))pimgDel(k.slice(4),'cut');else pimgDel(k)},
  ppDisc(){ppDiscover(false)},
  ppCropEdit(a){const P=curP();const c=(P.crops||[]).find(x=>x.id===a.dataset.id);if(!c)return;A.pcrop={...c};render()},
  ppCropAdd(){const pg=pagesOf()[0];if(!pg)return toast('소개서 쪽 이미지가 없습니다.','crit');A.pcrop={id:'',page:pg.n,kind:'app_screen',label:'',box:[150,300,850,700]};render()},
  ppCropPage(a){if(!A.pcrop)return;A.pcrop.page=N(a.dataset.n);render()},
  ppCropClose(){A.pcrop=null;render()},
  async ppCropSave(){const P=curP();const C=A.pcrop;if(!P||!C)return;C.label=(document.getElementById('pp_crop_label')||{}).value||C.label||'이미지';C.kind=(document.getElementById('pp_crop_kind')||{}).value||C.kind;
    const pg=pagesOf().find(p=>p.n===C.page);if(!pg)return;const mascot=C.kind==='mascot';const d=await PPD().cropImg(pg.data,C.box,{max:mascot?480:620,cutout:mascot});if(!d)return toast('자르지 못했습니다.','crit');
    const id=C.id||('img'+Date.now().toString(36));const crops=[...(P.crops||[])].filter(x=>x.id!==id);crops.push({id,page:C.page,kind:C.kind,label:C.label,box:C.box,cut:mascot});
    await pimgPut(id,d,'src');P.crops=crops;await pSave('crops',P);A.pcrop=null;GFXT.clear();schedPv();render();toast('이미지를 잘랐습니다.')},
  async ppCropDel(a){const P=curP();P.crops=(P.crops||[]).filter(x=>x.id!==a.dataset.id);await pSave('crops',P);pimgDel(a.dataset.id,'src')},
  async ppCanva(a){const P=curP();const g=((P.ai||{}).groups||[])[+a.dataset.g]||{};const c=((g.guide||{}).cuts||[])[+a.dataset.c]||{};const I=P.info||{};
    const pr=c.prompt||[c.scene,c.line].filter(Boolean).join(' / ');const text=`${String(pr).replace(/\n/g,' ')}\n(세로 9:16, 실사 사진 느낌, ${I.brand||''} ${I.product||''} 인플루언서 숏폼 예시 장면, 실존 인물·다른 브랜드 로고 없이)`;
    await copyText(text);A.ppaste='cut:'+`${g.key}_${a.dataset.c}`;render();window.open(a.dataset.to==='gemini'?'https://gemini.google.com/app':'https://www.canva.com/ai','_blank','noopener');
    toast('프롬프트를 복사했습니다. 이미지를 만든 뒤 「이미지 복사」 → 여기서 Ctrl+V 하면 이 컷에 들어갑니다.')},
  async ppSrcClear(){const P=curP();P.info={...P.info,srcText:'',srcName:'',srcPages:''};A.ppPages=null;await pSave('info',P);render()},
  async ppAuto(){const P=curP();P.plan={...(P.plan||{}),tiers:[]};await pSave('plan',P);schedPv();render();toast('예산 기준으로 티어를 다시 구성했습니다.')},
  async ppPick(a){const P=curP();const k=a.dataset.g,id_=a.dataset.id;P.picks=P.picks||{};const L=[...(P.picks[k]||[])];const i=L.indexOf(id_);if(i>=0)L.splice(i,1);else{if(L.length>=MAXPICK)return toast(`그룹마다 최대 ${MAXPICK}명까지 고를 수 있습니다.`,'crit');L.push(id_)}P.picks[k]=L;await pSave('picks',P);schedPv();render()},
  async ppDup(){const P=curP();if(!P)return;const id=uid();const d={...clone(P),title:(P.title||'')+' (복사본)',status:'작성 중',createdAt:today(),updatedAt:new Date().toISOString(),by:A.user.email,aiStatus:'',aiResult:null,discStatus:''};
    try{await DB.set('guides/'+id,d);for(const t of Object.keys(IMGDOC)){const im=A[IMGST[t]];if(im&&Object.keys(im).length)await DB.set('guideimg/'+id+IMGDOC[t],{imgs:clone(im),updatedAt:new Date().toISOString()})}A.pid=id;render();toast('제안서를 복제했습니다.')}catch(e){saveErr(e)}},
  async ppDel(){if(A.confirm!=='pdel'){A.confirm='pdel';render();return}A.confirm=null;const id=A.pid;try{await DB.del('guides/'+id);for(const t of Object.keys(IMGDOC))await DB.del('guideimg/'+id+IMGDOC[t]).catch(()=>{});A.pid='';render();toast('제안서를 삭제했습니다.')}catch(e){saveErr(e)}},
  async ppAi(){const P=curP();if(!P||A.ppBusy||pAiRunning(P))return;const I=P.info||{};
    if(!String(I.srcText||'').trim()&&!(I.links||[]).length&&!String(I.memo||'').trim())return toast('상품소개서를 올리거나, 링크·메모를 넣어 주세요.','crit');if(!(N(I.budget)>0))return toast('총 예산을 넣어 주세요.','crit');
    if(P.ai&&A.confirm!=='ppai'){A.confirm='ppai';toast('이미 만든 내용이 있습니다. 한 번 더 누르면 AI가 새로 씁니다 (② 탭에서 고친 문구는 바뀝니다).');setTimeout(()=>{if(A.confirm==='ppai')A.confirm=null},6000);return}A.confirm=null;
    const K=ppCalc(P);const plan={tiers:K.R,people:K.people,ad:K.ad,fee:K.fee,total:K.total};const info={...I,platform:platsOf(I).map(x=>PLAT_FMT[x]).join(' · '),srcText:String(I.srcText||'').slice(0,24000)};
    const pages=await Promise.all(pagesOf().slice(0,10).map(p=>shrinkTo(p.data,768,0.7)));
    if(DB.mode==='demo'){A.ppBusy=true;render();await new Promise(r=>setTimeout(r,700));await pApply(A.pid,P,{ai:mockAi(I),model:'demo',research:{ok:false,sources:[]},vision:mockVision(pages.length)});A.ppBusy=false;render();return}
    const job=uid();A.ppBusy=true;render();
    try{await DB.update('guides/'+A.pid,{aiStatus:'진행 중',aiStep:'시장 조사 · 이미지 분석 중',aiJob:job,aiAt:new Date().toISOString(),aiError:DB.DEL,aiResult:DB.DEL});await aiFetch('/api/proposal',{pid:A.pid,job,info,plan,pages});toast('AI가 제안서를 쓰는 중입니다. 1~3분 걸리고, 끝나면 자동으로 채워집니다.')}
    catch(e){DB.update('guides/'+A.pid,{aiStatus:'실패',aiError:String(e.message||e)}).catch(()=>{});toast('AI 제안서 작성을 시작하지 못했습니다: '+(e.message||e),'crit')}finally{A.ppBusy=false;render()}}
});
function mockVision(n){return n?{colors:{deckMain:'#FF7E47',logo:'#FF7E47',note:'데모'},items:[{id:'img1',page:Math.min(2,n),kind:'app_screen',label:'홈 화면',box:[200,560,900,760]},{id:'img2',page:1,kind:'mascot',label:'캐릭터',box:[300,300,700,700]}]}:{items:[]}}

/* ============ 스타일 ============ */
(function(){if(document.getElementById('pp-css'))return;const st=document.createElement('style');st.id='pp-css';st.textContent=`
.pp-money{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
.pp-money>div{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.pp-money span{font-size:11.5px;color:var(--muted)}.pp-money b{font-size:17px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.pp-subtabs{display:flex;gap:6px;flex-wrap:wrap}
.pp-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,46%);gap:16px;align-items:start}
.pp-live{position:sticky;top:64px;max-height:calc(100vh - 80px);overflow:auto;border:1px solid var(--line);border-radius:14px;padding:10px;background:var(--surface)}
.pp-live-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin:0 0 8px}
.pp-pc-note{display:none}
.pp-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.pp-fonts{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}.pp-fontchip{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:8px 10px;text-align:left;cursor:pointer;font-size:17px;line-height:1.25;color:var(--ink)}.pp-fontchip span{display:block;font:500 11px var(--font);color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pp-fontchip:hover{border-color:var(--line2)}.pp-fontchip.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset;background:var(--accent-soft)}.pp-fontchip:disabled{cursor:default;opacity:.7}.pp-fontdl{border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:grid;gap:10px;background:var(--surface)}.pp-fdl-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px}.pp-fdl{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-radius:8px;padding:7px 9px;cursor:pointer;font-size:12.5px;line-height:1.35}.pp-fdl input{margin-top:2px}.pp-fdl em{font-style:normal;font-size:10.5px;background:var(--accent-soft);color:var(--accent);border-radius:99px;padding:1px 6px;font-weight:600}.pp-fdl .small{word-break:break-all}
.pp-th{all:unset;cursor:pointer;width:96px;display:flex;flex-direction:column;gap:3px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:6px;box-sizing:border-box;background:var(--surface)}
.pp-th.wide{width:150px}.pp-th img,.pp-th>span{width:100%;height:70px;object-fit:contain;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted);background:var(--surface2,#f4f5f7)}
.pp-th.wide img,.pp-th.wide>span{height:84px;object-fit:cover}.pp-th i{font-style:normal;font-size:11px;color:var(--muted);text-align:center;line-height:1.25}
.pp-th.on{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.pp-th[disabled]{opacity:.45;cursor:default}
.pp-paste-hint{cursor:pointer;padding:2px 6px;border-radius:6px;border:1px dashed var(--line);outline:none}.pp-paste-hint.on,.pp-paste-hint:focus{border-color:var(--accent);color:var(--accent)}
.pp-sw{display:inline-flex;align-items:center;justify-content:center;width:100%;height:84px;border-radius:6px;position:relative;overflow:hidden;border:1px solid var(--line)}.pp-sw.lg{width:28px;height:28px;border-radius:50%;margin-right:4px}
.pp-sw-c{position:absolute;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.18);right:-14px;bottom:-18px}
.pp-colors{display:flex;gap:18px;flex-wrap:wrap;align-items:center}.pp-colors>div{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pp-crops{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.pp-crop{border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0}
.pp-crop-img{height:130px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:8px}.pp-crop-img img{max-width:100%;max-height:100%;object-fit:contain}
.pp-modal-bg{position:fixed;inset:0;background:rgba(10,14,22,.45);z-index:80}
.pp-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:81;width:min(900px,94vw);max-height:92vh;overflow:auto}
.pp-crop-stage{position:relative;user-select:none;touch-action:none;cursor:crosshair;border:1px solid var(--line);overflow:hidden}.pp-crop-stage img{width:100%;display:block;pointer-events:none}
.pp-crop-box{position:absolute;border:2px solid var(--accent);box-shadow:0 0 0 9999px rgba(0,0,0,.35)}
.pp-av{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none}.pp-av0{display:inline-flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-weight:700}
.pp-cuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.pp-cut{border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0}
.pp-cut-img{aspect-ratio:9/16;max-height:220px;margin:0 auto;width:100%;max-width:124px;display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed var(--line);border-radius:10px;cursor:pointer;outline:none;overflow:hidden;background:var(--surface)}
.pp-cut-img img{width:100%;height:100%;object-fit:cover}.pp-cut-img.paste-on,.pp-cut-img:focus{border-color:var(--accent);border-style:solid;box-shadow:0 0 0 3px var(--accent-soft)}
.pp-cut .fgrid{grid-template-columns:minmax(0,1fr)}.pp-cut .fgrid .f{min-width:0}
.ppedit .tbl input{min-width:0}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pp-pick{border:1px solid var(--line);border-radius:12px;padding:10px;min-width:0}
.pp-cand{display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:8px;cursor:pointer}.pp-cand.on{background:var(--accent-soft)}.pp-cand input{margin-top:3px}
.pv-deck{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pv-deck.one{grid-template-columns:minmax(0,1fr);gap:10px}
.pv-slide{position:relative;aspect-ratio:16/9;overflow:hidden;border:1px solid var(--line);border-radius:8px;background:#fff}
.pv-slide .dk-page{position:absolute;left:0;top:0;transform-origin:0 0;width:13.333in;height:7.49in;overflow:hidden;line-height:1.2;color:#262626;font-family:'Pretendard','Malgun Gothic',sans-serif}
.pv-slide .dk-t{position:absolute;display:flex;flex-direction:column;box-sizing:border-box;overflow:visible;word-break:keep-all;overflow-wrap:anywhere}
.pv-slide .dk-s{position:absolute;box-sizing:border-box}
.pv-no{position:absolute;right:6px;bottom:4px;z-index:2;font-size:10px;color:#9aa0aa;background:rgba(255,255,255,.85);border-radius:6px;padding:0 5px}
@media (max-width:1100px){.pp-split{grid-template-columns:minmax(0,1fr)}.pp-live{position:static;max-height:none}}
@media (max-width:900px){.pv-deck,.grid3{grid-template-columns:minmax(0,1fr)}.pp-money{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-pc-note{display:block}.pp-th{width:84px}.pp-th.wide{width:120px}.pp-cuts{grid-template-columns:minmax(0,1fr)}}
`;document.head.appendChild(st)})();
window.ppCalc=ppCalc;window.autoMix=autoMix;window.ppToD=toD;window.ppMoney=money;
})();
