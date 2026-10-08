/* RINGCOMS 캠페인 관리 · 도구 (v0.14)
   - 콘텐츠 가이드: 광고주 홈페이지·상품 링크 → AI(Gemini)로 표준 가이드 자동 구성 → 편집 → PPT·PDF
   - 장면 이미지: Canva 반자동 (프롬프트 복사 → Canva에서 만들기 → 이미지 넣기)
   - 영상 검수: 영상 링크 → 가이드 기준으로 자막·나레이션·구성 점검 → 수정 요청 요약 (/api/review, 백그라운드)
   - AI 영상 제작: 기능 틀만 구축 (연동은 비용 결정 후)
   - 캠페인 만들기 4단계 (캠페인 > 광고 그룹 > 인플루언서 등록 > 광고 만들기 완료)
   - 상단(GNB) 계정 선택, 인플루언서 풀 선택 삭제(캠페인 이력 보존)
   index.html의 전역 함수·상태(A, DB, ACT, render, esc …)를 그대로 씁니다. */

/* ============ 아이콘 ============ */
const SV=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
window.TOOL_IC={
  guide:SV('<path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M15 3.5V7h3M9 11h6M9 14.5h6M9 18h3.5"/>'),
  review:SV('<rect x="3" y="5" width="13" height="11" rx="2"/><path d="M16 9l5-2.5v8L16 12"/><path d="M6.5 19.5l2 2 4-4"/>'),
  aivideo:SV('<rect x="3" y="6" width="14" height="12" rx="2.5"/><path d="M17 10.5l4-2.5v8l-4-2.5"/><path d="M8.5 9.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>'),
  int:SV('<path d="M9 7H6.5a3.5 3.5 0 0 0 0 7H9M15 7h2.5a3.5 3.5 0 0 1 0 7H15M8 10.5h8"/>')
};
window.CONFIRM_ACTS=['poolBulkDel','guideDel','revDel','sceneDel','conceptDel'];
['guideNew','guideAi','cutAdd','cutDel','sceneAdd','sceneDel','conceptAdd','conceptDel','wordAdd','wordDel','pointAdd','gimgDel','guideDel','revRun','revDel','revRetry','poolBulkDel','poolRestore','drowAdd','drowDel','wpickAdd','wpasteGo'].forEach(k=>WRITE_ACTS.add(k));

/* ============ 공통 ============ */
const T_NOW=()=>new Date().toISOString();
function setIn(o,path,v){const ks=String(path).split('.');let t=o;for(let i=0;i<ks.length-1;i++){const k=ks[i],nk=ks[i+1];if(t[k]==null||typeof t[k]!=='object')t[k]=/^\d+$/.test(nk)?[]:{};t=t[k]}t[ks[ks.length-1]]=v}
function getIn(o,path){return String(path).split('.').reduce((t,k)=>t==null?undefined:t[k],o)}
const lines=v=>String(v||'').split('\n').map(x=>x.replace(/^\s*(?:[-•▪*]|\d+[.)])\s*/,'').trim()).filter(Boolean);
const tid=p=>(p||'x')+'_'+Math.random().toString(36).slice(2,8);
async function aiFetch(path,body){const tok=await DB.idToken();const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:JSON.stringify(body)});
  let j={};try{j=await r.json()}catch(e){}if(!r.ok&&r.status!==202)throw new Error(j.error||('서버 오류 '+r.status));return j}

/* ============ 상단(GNB) 계정 선택 ============ */
function gnbAcct(){
  if(isClientView()||(typeof isExt==='function'&&isExt()))return A.acctInfo&&A.acctInfo.name?`<span class="pill" title="로그인한 광고주 계정">${esc(A.acctInfo.name)}</span>`:'';
  if(!isTeam())return '';
  const ids=Object.keys(A.accounts||{}).sort((a,b)=>acctName(a).localeCompare(acctName(b),'ko'));
  const opts=[['','전체 계정'],[TEAM,'RINGCOMS MCN'],...ids.map(id=>[id,acctName(id)])];
  return `<label class="gacct" title="작업할 계정을 고르면 캠페인 목록이 그 계정 것만 보입니다"><span>계정</span><select id="gnb-acct" data-gacct="1" aria-label="계정 선택">${opts.map(([id,l])=>`<option value="${esc(id)}" ${(A.acctF||'')===id?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`}
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.gacct)return;A.acctF=t.value||'';A.csel&&A.csel.clear();
  if(A.view==='campaign'){const c=curC();if(c&&A.acctF&&acctOf(c)!==A.acctF){A.view=homeView();if(A.unsubRows){A.unsubRows();A.unsubRows=null;A.rowsDoc=null}}}
  render();toast(A.acctF?`「${A.acctF===TEAM?'RINGCOMS MCN':acctName(A.acctF)}」 계정으로 전환했습니다.`:'전체 계정을 봅니다.')});

/* ============ 인플루언서 풀: 선택 삭제(캠페인 이력 보존)·복원·크게 보기 ============ */
/* 캠페인 이력이 있는 인플루언서는 풀에서 '숨김'만 하고(진행관리·리포트·캠페인 이력은 그대로), 이력이 없는 직접 등록 항목만 실제로 지웁니다 */
async function poolRemove(pids){let hid=0,del=0;const ops=[];
  pids.forEach(pid=>{const p=A.pool[pid];if(!p)return;const hist=Object.keys(p.campaigns||{}).length;
    if(hist){hid++;ops.push(DB.update('pool/'+pid,{hidden:true,hiddenAt:today(),hiddenBy:A.user.email}))}else{del++;ops.push(DB.del('pool/'+pid))}});
  try{await Promise.all(ops);A.psel&&A.psel.clear();toast(`풀에서 ${hid+del}명을 삭제했습니다.${hid?` 캠페인 이력이 있는 ${hid}명은 진행관리·리포트에 그대로 남고, 「삭제한 인플루언서 보기」에서 복원할 수 있습니다.`:''}`)}catch(e){saveErr(e)}}
Object.assign(ACT,{
  pbig(){A.pbig=!A.pbig;render()},
  pshowHid(){A.pshowHid=!A.pshowHid;A.psel.clear();render()},
  async poolBulkDel(){if(!A.psel.size)return;if(A.confirm!=='pbd'){A.confirm='pbd';render();return}A.confirm=null;await poolRemove([...A.psel]);render()},
  async poolRestore(){const ids=[...A.psel];try{await Promise.all(ids.map(id=>DB.update('pool/'+id,{hidden:DB.DEL,hiddenAt:DB.DEL,hiddenBy:DB.DEL})));A.psel.clear();toast(`${ids.length}명을 풀에 복원했습니다.`)}catch(e){saveErr(e)}render()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&A.pbig){A.pbig=false;render()}});

/* ============ 캠페인 만들기 4단계 ============ */
const WSTEPS=['캠페인','광고 그룹','인플루언서 등록','광고 만들기 완료'];
function draftRows(){if(!A.rowsDoc)A.rowsDoc={rows:{}};if(!A.rowsDoc.rows)A.rowsDoc.rows={};return A.rowsDoc.rows}
function draftRowsOut(){if(A.view!=='create'&&!A.draft)return {};const out={};let o=0;
  Object.entries(draftRows()).sort((a,b)=>(a[1].order||0)-(b[1].order||0)).forEach(([id,r])=>{if(!String(r.name||'').trim()&&!String(r.acct||'').trim())return;o++;
    const x={order:o,createdAt:today(),name:String(r.name||r.acct||'').trim(),stage:'컨택',contract:'미완료',disc:'미완료',lastc:today()};
    ['acct','ch','chlink','cat','contact','email','partner','group'].forEach(k=>{if(has(r[k]))x[k]=String(r[k]).trim()});
    ['fol','fee'].forEach(k=>{const v=parseNum(r[k]);if(v!=null)x[k]=v});out[id]=x});return out}
function viewCreateWizard(){const c=A.draft;if(!c)return '<div class="panel empty">만들 캠페인이 없습니다.</div>';const KM=KINDS[kindOf(c)];const st=A.wstep||1;
  const rows=Object.entries(draftRows());const nr=Object.keys(draftRowsOut()).length;const gs=groupsOf(c);
  const stepper=`<ol class="wz">${WSTEPS.map((l,i)=>`<li class="${st===i+1?'on':st>i+1?'done':''}"><button data-act="wGo" data-s="${i+1}"><b>${st>i+1?'✓':i+1}</b><span>${l}</span></button></li>`).join('')}</ol>`;
  const nav=`<div class="row"><button class="btn" data-act="draftCancel">취소</button><span class="grow"></span>${st>1?'<button class="btn" data-act="wPrev">← 이전</button>':''}${st<4?`<button class="btn primary" data-act="wNext">다음 · ${WSTEPS[st]} →</button>`:'<button class="btn primary" data-act="draftCreate">광고 만들기 완료</button>'}</div>`;
  let body='';
  if(st===1)body=tabSettings(c);
  else if(st===2)body=`<div class="stack">${groupSettings(c)}<div class="banner info" style="margin:0">그룹 없이 캠페인 전체로 운영해도 됩니다. 이 단계는 건너뛰어도 되고, 만든 뒤에도 캠페인 설정에서 추가할 수 있습니다.</div></div>`;
  else if(st===3){const pl=Object.entries(A.pool||{}).filter(([,p])=>!p.hidden);const q=String(A.wpq||'').trim().toLowerCase();
    const have=new Set(rows.map(([,r])=>poolKey(r)).filter(Boolean));
    const pick=A.wpick?`<section class="panel"><div class="panel-h"><div><h2>인플루언서 풀에서 불러오기</h2><div class="sub">체크한 인플루언서를 아래 목록에 추가합니다 · 풀 ${pl.length}명</div></div><div class="row"><button class="btn sm" data-act="wpickToggle">닫기</button></div></div>
      <div class="row" style="margin-bottom:10px"><input type="text" id="wpq" data-ui="wpq" value="${esc(A.wpq||'')}" placeholder="이름·계정·카테고리 검색" style="max-width:280px"><span class="grow"></span><button class="btn sm primary" data-act="wpickAdd">${A.wsel&&A.wsel.size?`선택한 ${A.wsel.size}명 추가`:'선택 추가'}</button></div>
      <div class="tblwrap" style="max-height:360px"><table class="tbl"><thead><tr><th></th><th>인플루언서</th><th>채널</th><th class="n">팔로워</th><th>카테고리</th><th>최근 진행</th></tr></thead><tbody>${pl.filter(([,p])=>!q||[p.name,p.acct,p.cat].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(a[1].name||'').localeCompare(String(b[1].name||''),'ko')).slice(0,150).map(([id,p])=>{const on=have.has(id);const g=poolAgg(p);
        return `<tr><td><input type="checkbox" data-act="wsel" data-p="${esc(id)}" ${on?'checked disabled':A.wsel&&A.wsel.has(id)?'checked':''} aria-label="선택"></td><td class="nm"><b>${esc(p.name||'')}</b><span>${esc(p.acct||'')}</span></td><td>${esc(p.ch||'')}</td><td class="n">${compact(p.fol)}</td><td>${esc(p.cat||'')}</td><td class="small">${esc(g.lastCampaign||'')}${on?' <span class="pill ok">추가됨</span>':''}</td></tr>`}).join('')||'<tr><td colspan="6" class="empty">조건에 맞는 인플루언서가 없습니다.</td></tr>'}</tbody></table></div></section>`:'';
    const paste=A.wpaste?`<section class="panel"><div class="panel-h"><div><h2>시트에서 붙여넣기</h2><div class="sub">엑셀·구글 시트에서 <b>이름 · 계정 ID · 채널 · 채널 링크 · 팔로워</b> 순서로 복사해 붙여넣으세요 (제목 줄 없이)</div></div><button class="btn sm" data-act="wpasteToggle">닫기</button></div><textarea id="wpaste" rows="5" placeholder="홍길동	@gildong	인스타그램	https://instagram.com/gildong	12000"></textarea><div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="wpasteGo">목록에 추가</button></div></section>`:'';
    body=`<div class="stack"><section class="panel"><div class="panel-h"><div><h2>인플루언서 등록</h2><div class="sub">이 광고에 섭외할 인플루언서를 넣으면 「컨택」 단계로 진행관리에 들어갑니다. 지금 비워 두고 나중에 추가해도 됩니다.</div></div>
      <div class="row"><button class="btn" data-act="wpickToggle">풀에서 불러오기</button><button class="btn" data-act="wpasteToggle">시트 붙여넣기</button><button class="btn primary" data-act="drowAdd">+ 직접 추가</button></div></div>
      ${rows.length?`<div class="tblwrap"><table class="tbl wtbl"><thead><tr><th>인플루언서명 *</th><th>계정 ID</th><th>채널</th><th>채널 링크</th><th class="n">팔로워</th>${gs.length?'<th>광고 그룹</th>':''}${isTrial(c)||isCom(c)?'':'<th class="n">원고료</th>'}<th></th></tr></thead><tbody>${rows.sort((a,b)=>(a[1].order||0)-(b[1].order||0)).map(([id,r])=>{const f=(k,ph,w)=>`<input type="text" id="dr_${id}_${k}" data-drow="${id}" data-df="${k}" value="${esc(r[k]??'')}" placeholder="${ph||''}" style="${w?`min-width:${w}px`:''}">`;
        return `<tr><td>${f('name','이름',120)}</td><td>${f('acct','@account',110)}</td><td><select id="dr_${id}_ch" data-drow="${id}" data-df="ch"><option value=""></option>${CHANNELS.map(x=>`<option ${x===r.ch?'selected':''}>${x}</option>`).join('')}</select></td><td>${f('chlink','https://',180)}</td><td>${f('fol','예: 12만',80)}</td>${gs.length?`<td><select id="dr_${id}_group" data-drow="${id}" data-df="group"><option value="">미지정</option>${gs.map(g=>`<option value="${g.id}" ${g.id===r.group?'selected':''}>${esc(g.name)}</option>`).join('')}</select></td>`:''}${isTrial(c)||isCom(c)?'':`<td>${f('fee','원',90)}</td>`}<td class="n"><button class="btn sm ghost" data-act="drowDel" data-r="${id}" title="목록에서 빼기">✕</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty" style="padding:22px">아직 등록한 인플루언서가 없습니다. 풀에서 불러오거나 직접 추가하세요.</div>'}
      </section>${pick}${paste}</div>`}
  else{const byG={};Object.values(draftRowsOut()).forEach(r=>{const k=r.group&&c.groups&&c.groups[r.group]?c.groups[r.group].name:'그룹 미지정';byG[k]=(byG[k]||0)+1});
    body=`<section class="panel"><div class="panel-h"><div><h2>마지막 확인</h2><div class="sub">아래 내용으로 광고를 만듭니다. 「광고 만들기 완료」를 눌러야 저장됩니다.</div></div></div>
     <dl class="kv wsum"><dt>캠페인</dt><dd>${esc(c.name||'')} <span class="pill">${esc(KM.label)}</span></dd><dt>광고주</dt><dd>${esc(c.advertiser||'–')}${c.brand?' · '+esc(c.brand):''}</dd><dt>기간</dt><dd>${c.start?md(c.start)+' ~ '+md(c.end):'–'}</dd>${isCom(c)?'':`<dt>목적</dt><dd>${esc(c.objective||'–')}</dd>`}
     <dt>광고 그룹</dt><dd>${gs.length?gs.map(g=>esc(g.name)).join(' · '):'그룹 없음 (캠페인 전체)'}</dd><dt>인플루언서</dt><dd>${nr?`${nr}명 · ${Object.entries(byG).map(([k,v])=>`${esc(k)} ${v}명`).join(' · ')} → 「컨택」 단계로 등록`:'없음 (만든 뒤 진행관리에서 추가)'}</dd></dl></section>`}
  return `<div class="page-h"><div><div class="eyebrow">${KM.newEb}</div><h1>${KM.newH}</h1><div class="sub">캠페인 → 광고 그룹 → 인플루언서 등록 → 광고 만들기 완료 순서로 진행합니다. 마지막 단계에서 「광고 만들기 완료」를 눌러야 저장됩니다.</div></div></div>
  ${stepper}${body}<div class="panel" style="margin-top:16px">${nav}</div>`}
function wValid(to){const c=A.draft;if(!c)return false;if(to>1&&!String(c.name||'').trim()){toast('캠페인명을 입력하세요.','crit');A.wstep=1;return false}if(to>1&&c.start&&c.end&&c.end<c.start){toast('종료일이 시작일보다 빠릅니다.','crit');A.wstep=1;return false}return true}
Object.assign(ACT,{
  wGo(a){const s=+a.dataset.s;if(!wValid(s))return render();A.wstep=s;render();window.scrollTo(0,0)},
  wNext(){const ae=document.activeElement;if(ae&&ae.blur)ae.blur();setTimeout(()=>{const s=Math.min(4,(A.wstep||1)+1);if(!wValid(s))return render();A.wstep=s;render();window.scrollTo(0,0)},30)},
  wPrev(){A.wstep=Math.max(1,(A.wstep||1)-1);render();window.scrollTo(0,0)},
  drowAdd(){const R=draftRows();const id=uid();const o=Object.values(R).reduce((t,r)=>Math.max(t,r.order||0),0)+1;R[id]={order:o,name:'',ch:'인스타그램',...(A.gf&&A.gf!=='__none'?{group:A.gf}:{})};render();setTimeout(()=>{const el=document.getElementById(`dr_${id}_name`);if(el)el.focus()},40)},
  drowDel(a){delete draftRows()[a.dataset.r];render()},
  wpickToggle(){A.wpick=!A.wpick;A.wsel=new Set();render()},
  wpasteToggle(){A.wpaste=!A.wpaste;render()},
  wsel(a){A.wsel=A.wsel||new Set();const p=a.dataset.p;A.wsel.has(p)?A.wsel.delete(p):A.wsel.add(p);render()},
  wpickAdd(){const R=draftRows();let o=Object.values(R).reduce((t,r)=>Math.max(t,r.order||0),0);let n_=0;(A.wsel?[...A.wsel]:[]).forEach(pid=>{const p=A.pool[pid];if(!p)return;o++;n_++;
      const r={order:o,name:p.name||'',acct:p.acct||'',ch:p.ch||''};['chlink','fol','cat','contact','email','partner'].forEach(k=>{if(has(p[k]))r[k]=p[k]});const g=poolAgg(p);if(g.r_fee!=null&&!isTrial(A.draft))r.fee=Math.round(g.r_fee);R[uid()]=r});
    A.wsel=new Set();A.wpick=false;render();if(n_)toast(`${n_}명을 추가했습니다.`)},
  wpasteGo(){const t=($('#wpaste')||{}).value||'';const R=draftRows();let o=Object.values(R).reduce((t,r)=>Math.max(t,r.order||0),0);let n_=0;
    t.split(/\r?\n/).map(l=>l.split('\t').map(x=>x.trim())).filter(x=>x[0]||x[1]).forEach(x=>{o++;n_++;let ch=x[2]||'';if(!CHANNELS.includes(ch)){const l=(x[3]||x[1]||'').toLowerCase();ch=/youtu/.test(l)?'유튜브':/tiktok/.test(l)?'틱톡':/blog\.naver/.test(l)?'네이버 블로그':'인스타그램'}
      R[uid()]={order:o,name:x[0]||x[1],acct:x[1]||'',ch,chlink:x[3]||'',fol:x[4]||''}});A.wpaste=false;render();toast(n_?`${n_}명을 목록에 넣었습니다.`:'붙여넣은 내용이 없습니다.',n_?'':'crit')}
});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.drow)return;const R=draftRows();const r=R[t.dataset.drow];if(!r)return;r[t.dataset.df]=t.value;
  if(t.dataset.df==='chlink'&&t.value&&!r.ch){const l=t.value.toLowerCase();r.ch=/youtu/.test(l)?'유튜브':/tiktok/.test(l)?'틱톡':'인스타그램'}
  if(t.dataset.df==='chlink'&&t.value&&!r.acct){const m=t.value.match(/(?:instagram\.com|tiktok\.com\/@?|youtube\.com\/@)([A-Za-z0-9._-]+)/i);if(m)r.acct='@'+m[1].replace(/^@/,'')}
  if(['group','ch','chlink'].includes(t.dataset.df))render()});

/* ============ 콘텐츠 가이드: 표준 템플릿 ============ */
const G_PLATFORMS=['인스타그램 릴스','유튜브 쇼츠','틱톡','유튜브 롱폼','인스타그램 피드','네이버 블로그'];
const G_PARTS=['인트로','바디','아웃트로'];
const G_SHOOT=['9:16 세로로, 1080px(FHD) 이상 화질로 찍어 주세요.','밝은 곳에서 찍고, 흔들리지 않게 폰을 고정해 주세요.','보정 필터·뷰티 앱(스노우·B612 등)은 쓰지 말아 주세요.','제품 로고와 글자가 좌우 반전되지 않게 찍어 주세요.','깔끔하게 정리된 배경에서, 노출이 심한 옷은 피해 주세요.','다른 브랜드 제품·로고가 화면에 나오지 않게 해 주세요.','저작권이 있는 음원·셀럽 사진은 쓰지 말아 주세요.'];
const G_SUBMIT=['가이드를 보고 촬영·편집해 주세요.','업로드 전에 초안 영상을 먼저 보내 주세요. (구글 드라이브 「링크가 있는 모든 사용자」 공유 링크)','링컴즈가 검수하고, 수정할 점이 있으면 알려 드려요.','승인을 받은 뒤 업로드해 주세요. (본문 맨 앞에 #협찬)','업로드한 게시물 링크와 원본 영상을 보내 주세요.'];
const G_CUTS=[['썸네일','본인 채널 분위기에 맞게, 제품이 잘 보이는 컷 (셀럽 사진은 쓰지 마세요)','권장'],['인트로 (후킹)','첫 3초 안에 눈길을 끄는 장면이나 후킹 멘트로 시작해요','필수'],['사용 장면','제품을 실제로 쓰는 모습을 자연스럽게 보여 줘요','필수'],['사용 전후 비교','같은 각도·같은 조명·같은 거리에서 찍어요','권장'],['아웃트로','제품을 한 번 더 보여 주고 핵심 메시지로 마무리해요','필수']];
const G_UPLOAD=['제품명·브랜드명 오타가 없는지 한 번 더 확인해 주세요.','#협찬은 본문 맨 앞에 넣어 주세요. (공정위 지침)','댓글 창은 닫지 말아 주세요. 좋아요·댓글이 열려 있어야 해요.','검수 승인을 받은 뒤에 업로드해 주세요.','제공받은 제품은 다시 팔 수 없어요.','우수 콘텐츠는 협의 후 추가 비용을 드리고, 브랜드 채널·광고 소재로 활용할 수 있어요.'];
const gCuts=()=>G_CUTS.map(([name,desc,need])=>({id:tid('k'),name,desc,need}));
const gScene=(part,time)=>({id:tid('s'),part,time,shot:'',say:'',sub:'',point:'',ref:'',prompt:''});
function gConcept(name){return {id:tid('c'),name:name||'',hook:'',scenes:[gScene('인트로','0~3초'),gScene('바디','3~15초'),gScene('바디','15~25초'),gScene('아웃트로','25~30초')]}}
function newGuide(c){const d=today();return {title:c?(c.brand||c.advertiser||'')+' 콘텐츠 가이드':'새 콘텐츠 가이드',advertiser:c?c.advertiser||'':'',brand:c?c.brand||'':'',cid:c?A.cid||'':'',platform:'인스타그램 릴스',length:'30초 이내',ratio:'9:16 세로',color:'#7A1E2C',status:'작성 중',links:[],memo:'',
  summary:{one:'',must:['첫 3초 안에 눈길을 끄는 장면으로 시작해 주세요.','제품 이름이 화면과 말에 꼭 나오게 해 주세요.','자막이나 목소리(TTS 가능)를 꼭 넣어 주세요.','본문 맨 앞에 #협찬 을 넣어 주세요.','업로드 전에 초안 영상을 먼저 보내 주세요.'],dont:['효과를 단정하는 말(치료·완치·100%)은 쓰지 말아 주세요.','다른 브랜드 제품을 깎아내리지 말아 주세요.','검수 승인 전에 업로드하지 말아 주세요.']},
  product:{name:'',price:'',sale:'',option:'',intro:'',points:[{t:'',d:''},{t:'',d:''},{t:'',d:''}],howto:[],caution:''},
  concepts:[gConcept('')],text:{keywords:[],closing:'',tagsMust:['#협찬'],tagsRec:[],account:'',brandName:'',productName:'',ngNames:[]},
  words:[{no:'치료돼요 / 완치돼요',yes:'관리에 도움이 돼요'},{no:'무조건 / 100% 효과',yes:'제가 써 보니 ~했어요'},{no:'(다른 브랜드)보다 훨씬 나아요',yes:'제가 써 본 것 중에 ~가 좋았어요'}],
  cuts:gCuts(),shoot:[...G_SHOOT],upload:[...G_UPLOAD],submit:{draftDue:'',uploadDue:'',how:[...G_SUBMIT],form:'',extra:''},createdAt:d,updatedAt:T_NOW(),by:A.user?A.user.email:''}}
function ensureToolWatch(){if(ensureToolWatch.on||!isTeam())return;ensureToolWatch.on=true;
  DB.watchCol('guides',m=>{A.guides=m;A.guidesLoaded=true;gAiCheck();scheduleRender()},()=>{A.guidesLoaded=true;A.guidesErr=true;scheduleRender()});
  DB.watchCol('reviews',m=>{A.reviews=m;A.reviewsLoaded=true;scheduleRender()},()=>{A.reviewsLoaded=true;A.reviewsErr=true;scheduleRender()});aiStatus()}
function curG(){return A.gid&&A.guides?A.guides[A.gid]:null}
function watchGimg(){if(A.gimgFor===A.gid)return;if(A.unsubGimg){A.unsubGimg();A.unsubGimg=null}A.gimgFor=A.gid;A.gimgs={};if(!A.gid)return;A.unsubGimg=DB.watchDoc('guideimg/'+A.gid,d=>{A.gimgs=(d&&d.imgs)||{};scheduleRender()},()=>{})}
async function gSave(top,g){g=g||curG();if(!g||!canEdit())return;try{await DB.update('guides/'+A.gid,{[top]:clone(g[top]),updatedAt:T_NOW(),by:A.user.email})}catch(e){saveErr(e)}}
const rulesBanner=()=>`<div class="banner" style="margin:0"><b>보안 규칙 게시가 필요합니다.</b> 콘텐츠 가이드·영상 검수 데이터(guides·guideimg·reviews)를 쓰려면 Firebase 콘솔에서 새 보안 규칙을 게시해야 합니다.</div>`;

/* ---- AI 연결 상태 ---- */
async function aiStatus(force){if(A.aiSt&&!force)return;A.aiSt={loading:true};if(DB.mode==='demo'){A.aiSt={gemini:false,demo:true};return}
  try{A.aiSt=await aiFetch('/api/ai',{action:'status'})}catch(e){A.aiSt={err:e.message}}scheduleRender()}
function aiPill(){const s=A.aiSt||{};if(s.demo)return '<span class="pill warn">데모: AI 결과는 예시</span>';if(s.loading)return '<span class="pill">AI 확인 중…</span>';if(s.err)return `<span class="pill crit" title="${esc(s.err)}">AI 연결 확인 실패</span>`;return s.gemini?`<span class="pill ok" title="모델: ${esc(s.model||'')}">Gemini 연결됨</span>`:'<span class="pill crit" title="Netlify 환경변수 GEMINI_API_KEY 필요">Gemini 키 미설정</span>'}
function aiIntPanel(){const s=A.aiSt||{};if(!A.aiSt)setTimeout(()=>aiStatus(),0);
  return `<section class="panel"><div class="panel-h"><div><h2>AI · 디자인 연동</h2><div class="sub">콘텐츠 가이드·영상 검수·AI 영상 제작에 쓰는 외부 서비스</div></div><button class="btn sm" data-act="aiRecheck">상태 다시 확인</button></div>
   <div class="tblwrap"><table class="tbl"><thead><tr><th>서비스</th><th>쓰는 곳</th><th>상태</th><th>설정 위치</th></tr></thead><tbody>
   <tr><td class="bold">Google Gemini API</td><td>가이드 자동 구성 · 영상 검수</td><td>${aiPill()}</td><td class="small">Netlify 환경변수 <code>GEMINI_API_KEY</code> (선택: <code>GEMINI_MODEL</code>)</td></tr>
   <tr><td class="bold">Canva</td><td>가이드 장면 이미지</td><td><span class="pill accent">반자동 사용 중</span></td><td class="small">프롬프트 복사 → Canva에서 만들기 → 「이미지 넣기」. 완전 자동(Canva Connect API)은 README의 「Canva 완전 자동 연동」 참고</td></tr>
   <tr><td class="bold">AI 영상 생성</td><td>AI 영상 제작</td><td><span class="pill warn">연동 전 (비용 결정 후)</span></td><td class="small">기능 틀만 구축 · Veo·Runway·Kling 중 선택 후 <code>AI_VIDEO_PROVIDER</code>·키 연결</td></tr>
   </tbody></table></div></section>`}
ACT.aiRecheck=()=>{A.aiSt=null;aiStatus(true);render()};

/* ---- 화면: 가이드 목록 ---- */
function viewGuides(){ensureToolWatch();if(A.gid)return guideEditor();
  const L=Object.entries(A.guides||{}).sort((a,b)=>String(b[1].updatedAt||'').localeCompare(String(a[1].updatedAt||'')));const camps=Object.entries(A.campaigns).filter(([,c])=>inAcctScope(c)).sort((a,b)=>String(b[1].createdAt).localeCompare(String(a[1].createdAt)));
  return `<div class="page-h"><div><div class="eyebrow">Content Guide</div><h1>콘텐츠 가이드</h1><div class="sub">광고주 홈페이지·상품 링크를 넣으면 AI가 표준 가이드를 채우고, 다듬어서 PPT·PDF로 인플루언서에게 보냅니다.</div></div>
   <div class="row">${aiPill()}${canEdit()?`<select id="g-newc" style="width:auto"><option value="">캠페인 연결 안 함</option>${camps.map(([id,c])=>`<option value="${id}">${esc(c.name)}</option>`).join('')}</select><button class="btn primary" data-act="guideNew">+ 새 가이드</button>`:''}</div></div>
  ${A.guidesErr?rulesBanner():''}
  ${L.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>가이드</th><th>광고주 · 브랜드</th><th>연결 캠페인</th><th>채널</th><th class="n">컨셉</th><th>상태</th><th>수정</th></tr></thead><tbody>${L.map(([id,g])=>`<tr class="click" data-act="guideOpen" data-g="${esc(id)}"><td class="bold">${esc(g.title||'제목 없음')}</td><td>${esc([g.advertiser,g.brand].filter(Boolean).join(' · '))}</td><td class="small">${g.cid&&A.campaigns[g.cid]?esc(A.campaigns[g.cid].name):'–'}</td><td class="small">${esc(g.platform||'')}</td><td class="n">${(g.concepts||[]).length}</td><td><span class="pill ${g.status==='완료'?'ok':'accent'}">${esc(g.status||'작성 중')}</span></td><td class="small">${md(String(g.updatedAt||'').slice(0,10))}</td></tr>`).join('')}</tbody></table></div>`
  :`<div class="panel empty">${A.guidesLoaded?'아직 만든 가이드가 없습니다. 「+ 새 가이드」로 시작하세요.':'불러오는 중…'}</div>`}`}

/* ---- 화면: 가이드 편집 ---- */
function guideEditor(){const g=curG();if(!g)return A.guidesLoaded?`<div class="panel empty">가이드를 찾을 수 없습니다. <button class="btn sm" data-act="guideBack">목록으로</button></div>`:'<div class="panel empty">불러오는 중…</div>';watchGimg();
  const ed=canEdit();const id=p=>'gd_'+p.replace(/[.\s]/g,'_');
  const tx=(p,l,o={})=>{const v=getIn(g,p);return `<label class="f ${o.wide?'wide':''}">${l}<input type="${o.type||'text'}" id="${id(p)}" data-gv="${p}" value="${esc(v??'')}" placeholder="${esc(o.ph||'')}">${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`};
  const ta=(p,l,o={})=>{const v=getIn(g,p);return `<label class="f ${o.wide!==false?'wide':''}">${l}<textarea id="${id(p)}" data-gv="${p}" rows="${o.rows||2}" placeholder="${esc(o.ph||'')}">${esc(v??'')}</textarea>${o.hint?`<span class="hint">${o.hint}</span>`:''}</label>`};
  const tl=(p,l,o={})=>{const v=getIn(g,p)||[];return `<label class="f ${o.wide!==false?'wide':''}">${l}<textarea id="${id(p)}" data-gl="${p}" rows="${o.rows||Math.max(3,v.length+1)}" placeholder="${esc(o.ph||'한 줄에 하나씩')}">${esc(v.join('\n'))}</textarea><span class="hint">${o.hint||'한 줄에 하나씩 적어 주세요.'}</span></label>`};
  const sel=(p,l,opts)=>{const v=getIn(g,p);return `<label class="f">${l}<select id="${id(p)}" data-gv="${p}">${opts.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select></label>`};
  const camps=Object.entries(A.campaigns).sort((a,b)=>String(b[1].createdAt).localeCompare(String(a[1].createdAt)));
  const P=g.product||{};const busy=A.gaiBusy||gAiRunning(g);
  const sceneCard=(ci,si,s)=>{const b=`concepts.${ci}.scenes.${si}`;const im=A.gimgs[s.id];
    return `<div class="scene"><div class="scene-h"><b>#${si+1}</b><select id="${id(b+'.part')}" data-gv="${b}.part" style="width:auto">${G_PARTS.map(o=>`<option ${o===s.part?'selected':''}>${o}</option>`).join('')}</select><input type="text" id="${id(b+'.time')}" data-gv="${b}.time" value="${esc(s.time||'')}" placeholder="0~3초" style="width:90px"><span class="grow"></span>${ed?`<button class="btn sm ghost" data-act="sceneDel" data-c="${ci}" data-s="${si}" title="장면 삭제">${A.confirm==='sd'+s.id?'한 번 더 누르면 삭제':'✕'}</button>`:''}</div>
     <div class="scene-b"><div class="scene-img">${im?`<img src="${im}" alt="장면 ${si+1} 참고 이미지">`:'<span class="muted small">참고 이미지 없음</span>'}
       <div class="row" style="gap:4px;justify-content:center">${ed?`<label class="btn sm" style="cursor:pointer">${im?'바꾸기':'이미지 넣기'}<input type="file" accept="image/*" data-gimg="${s.id}" hidden></label>${im?`<button class="btn sm ghost" data-act="gimgDel" data-k="${s.id}">삭제</button>`:''}`:''}</div>
       <button class="btn sm" data-act="canvaGo" data-c="${ci}" data-s="${si}" title="이미지 프롬프트를 복사하고 Canva를 엽니다">Canva로 만들기 ↗</button></div>
      <div class="fgrid one">${ta(b+'.shot','📷 이렇게 찍어요',{rows:2,ph:'예: 얼굴 반쪽만 바르고 정면 클로즈업'})}${ta(b+'.say','🎙 이렇게 말해요 (예시 멘트)',{rows:3,ph:'예: 수부지라 매트 쿠션 고민 많았는데…'})}${ta(b+'.sub','💬 자막 (화면 글자)',{rows:1,ph:'예: 아직도 파데 국물 생겨?'})}${tx(b+'.point','⭐ 강조 포인트',{wide:true,ph:'예: 촉촉하게 발리고 보송하게 마무리'})}${tx(b+'.ref','🔗 참고 영상 링크',{wide:true,ph:'https://'})}${ta(b+'.prompt','🖼 이미지 프롬프트 (Canva·AI 영상용)',{rows:2,ph:'AI가 채워 줍니다 · 장면을 그림으로 설명'})}</div></div></div>`};
  const conceptCard=(ci,cp)=>`<section class="panel concept"><div class="panel-h"><div class="row grow" style="gap:8px"><span class="cnum">${ci+1}</span><input type="text" id="${id(`concepts.${ci}.name`)}" data-gv="concepts.${ci}.name" value="${esc(cp.name||'')}" placeholder="컨셉 이름 (예: 3초 화잘먹 루틴)" style="max-width:340px;font-weight:600"></div>${ed&&(g.concepts||[]).length>1?`<button class="btn sm danger" data-act="conceptDel" data-c="${ci}">${A.confirm==='cd'+cp.id?'한 번 더 누르면 삭제':'컨셉 삭제'}</button>`:''}</div>
    <div class="fgrid">${tx(`concepts.${ci}.hook`,'첫 마디 · 후킹 문구',{wide:true,ph:'예: 아직도 여름에 파데 국물 생긴다고?!'})}</div>
    <div class="scenes">${(cp.scenes||[]).map((s,si)=>sceneCard(ci,si,s)).join('')}</div>${ed?`<button class="btn sm" data-act="sceneAdd" data-c="${ci}" style="margin-top:10px">+ 장면 추가</button>`:''}</section>`;
  return `<div class="page-h"><div><button class="btn sm ghost" data-act="guideBack">← 가이드 목록</button><h1 style="margin-top:6px">${esc(g.title||'제목 없음')}</h1><div class="sub">${esc([g.advertiser,g.brand,g.platform].filter(Boolean).join(' · '))} · 마지막 수정 ${esc(String(g.updatedAt||'').slice(0,16).replace('T',' '))}</div></div>
   <div class="row"><button class="btn" data-act="guidePpt">PPT 다운로드</button><button class="btn" data-act="guidePdf">PDF 다운로드</button><button class="btn" data-act="gotoReview">이 가이드로 영상 검수 →</button></div></div>
  ${A.guidesErr?rulesBanner():''}
  <div class="stack gedit">
  <section class="panel ai-box"><div class="panel-h"><div><h2>① 광고주 정보 넣기 → AI로 가이드 채우기</h2><div class="sub">홈페이지·상품 상세 링크를 넣으면 AI가 제품 특징·핵심 메시지·컨셉·장면·멘트·해시태그·금지 표현을 표준 형식으로 채웁니다.</div></div>${aiPill()}</div>
   <div class="fgrid">${tl('links','광고주 홈페이지 · 상품 링크',{rows:3,ph:'https://brand.com\nhttps://smartstore.naver.com/…',hint:'한 줄에 하나씩, 최대 3개. 네이버 스마트스토어처럼 내용을 읽기 어려운 페이지는 아래 칸에 상품 정보를 붙여넣어 주세요.'})}
   ${ta('memo','상품 정보 · 광고주 요청사항 붙여넣기 (선택)',{rows:4,ph:'상품 상세 문구, 광고주 브리프, 꼭 넣을 표현, 피해야 할 표현 등을 그대로 붙여넣어도 됩니다'})}
   <label class="f">컨셉 개수<select id="g-ain">${[1,2,3,4].map(x=>`<option ${x===(A.gain||2)?'selected':''}>${x}</option>`).join('')}</select></label></div>
   <div class="row" style="margin-top:10px">${ed?`<button class="btn primary" data-act="guideAi" data-m="fill" ${busy?'disabled':''}>${busy||gAiRunning(g)?'AI가 가이드를 만드는 중… (30초~2분)':'AI로 빈 칸 채우기'}</button><button class="btn" data-act="guideAi" data-m="replace" ${busy?'disabled':''}>AI로 새로 만들기 (내용 덮어쓰기)</button>`:''}<span class="small muted">결과는 초안입니다. 광고주 확인이 필요한 수치·효능 표현은 꼭 검토하세요.</span></div></section>

  <section class="panel"><div class="panel-h"><h2>② 기본 정보</h2></div><div class="fgrid">
   ${tx('title','가이드 제목')}${tx('advertiser','광고주')}${tx('brand','브랜드')}
   <label class="f">연결 캠페인<select id="gd_cid" data-gv="cid"><option value="">연결 안 함</option>${camps.map(([cid,c])=>`<option value="${cid}" ${cid===g.cid?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
   ${sel('platform','채널 · 형식',G_PLATFORMS)}${tx('length','영상 길이',{ph:'30초 이내'})}${tx('ratio','화면 비율',{ph:'9:16 세로'})}
   <label class="f">가이드 색 (광고주 톤)<span class="row" style="flex-wrap:nowrap"><input type="color" id="gd_color" data-gv="color" value="${esc(g.color||'#7A1E2C')}" style="width:48px;padding:2px;height:34px"><span class="small muted">${esc(g.color||'#7A1E2C')}</span></span></label>
   ${sel('status','상태',['작성 중','광고주 확인 중','완료'])}</div></section>

  <section class="panel"><div class="panel-h"><div><h2>③ 이것만 꼭 지켜주세요 (한눈에 보기)</h2><div class="sub">인플루언서가 가장 먼저 보는 장입니다. 짧고 쉬운 문장으로, 한 줄에 한 가지만.</div></div></div><div class="fgrid">
   ${tx('summary.one','핵심 메시지 한 줄',{wide:true,ph:'예: 운동 없이 입기만 해도 직각 어깨 & 여리핏 상체'})}
   ${tl('summary.must','✅ 꼭 해 주세요',{wide:false})}${tl('summary.dont','❌ 하지 말아 주세요',{wide:false})}</div></section>

  <section class="panel"><div class="panel-h"><h2>④ 제품 정보</h2></div><div class="fgrid">
   ${tx('product.name','제품명')}${tx('product.price','정가',{ph:'275,000원'})}${tx('product.sale','판매가 · 할인',{ph:'149,000원'})}${tx('product.option','옵션 · 사이즈',{ph:'S~XL'})}
   ${ta('product.intro','한 줄 소개',{rows:2})}
   ${(P.points||[]).map((pt,i)=>tx(`product.points.${i}.t`,`핵심 특징 ${i+1} · 제목`,{ph:'예: 입기만 하면 팔뚝·승모까지'})+tx(`product.points.${i}.d`,`핵심 특징 ${i+1} · 쉬운 설명`,{ph:'예: EMS 패드가 승모근과 팔뚝 라인을 집중 케어'})).join('')}
   ${tl('product.howto','사용 방법 (순서대로)',{wide:false,ph:'착용 후 패드 위치 맞추기\n강도 조절\n누워서 휴식'})}${ta('product.caution','사용 · 촬영 주의',{wide:false,rows:4})}</div>
   ${ed&&(P.points||[]).length<5?'<button class="btn sm" data-act="pointAdd">+ 핵심 특징 추가</button>':''}</section>

  <div class="sect-h"><h2>⑤ 콘텐츠 컨셉 · 장면 구성</h2><span class="sub">컨셉이 여러 개면 인플루언서가 1개를 골라 촬영합니다. 장면마다 「찍는 법 · 말하는 법 · 자막 · 포인트」를 채우세요.</span><span class="grow"></span>${ed&&(g.concepts||[]).length<4?'<button class="btn sm" data-act="conceptAdd">+ 컨셉 추가</button>':''}</div>
  ${(g.concepts||[]).map((cp,ci)=>conceptCard(ci,cp)).join('')}

  <section class="panel"><div class="panel-h"><h2>⑥ 꼭 넣을 문구 · 해시태그 · 표기법</h2></div><div class="fgrid">
   ${tx('text.closing','마무리 핵심 메시지 (아웃트로에서 꼭 말해요)',{wide:true,ph:'예: 운동 없이 입는 것만으로 직각 어깨 & 여리핏 상체 완성!'})}${tl('text.keywords','필수 키워드 (본문·자막·멘트)',{wide:false})}${tl('text.tagsMust','필수 해시태그',{wide:false,hint:'#협찬은 본문 맨 앞에 넣도록 안내됩니다.'})}${tl('text.tagsRec','권장 해시태그',{wide:false})}
   <div class="stack" style="gap:10px">${tx('text.account','공식 계정 태그',{ph:'@brand_official'})}${tx('text.brandName','브랜드명 바른 표기',{ph:'포즈닉 (Pozenic)'})}${tx('text.productName','제품명 바른 표기',{ph:'여리셀라 (YeoriCella)'})}</div>
   ${tl('text.ngNames','틀린 표기 (쓰면 안 돼요)',{wide:false,ph:'POZENIC\n여리셀'})}</div></section>

  <section class="panel"><div class="panel-h"><div><h2>⑦ 이렇게 말하면 안 돼요</h2><div class="sub">❌ 쓰면 안 되는 말 → ⭕ 이렇게 바꿔 말해요 · 광고법·공정위 기준</div></div>${ed?'<button class="btn sm" data-act="wordAdd">+ 추가</button>':''}</div>
   <div class="tblwrap"><table class="tbl"><thead><tr><th>❌ 이렇게 말하지 마세요</th><th>⭕ 이렇게 바꿔 말해요</th><th></th></tr></thead><tbody>${(g.words||[]).map((w,i)=>`<tr><td><input type="text" id="gd_w${i}n" data-gv="words.${i}.no" value="${esc(w.no||'')}"></td><td><input type="text" id="gd_w${i}y" data-gv="words.${i}.yes" value="${esc(w.yes||'')}"></td><td class="n">${ed?`<button class="btn sm ghost" data-act="wordDel" data-i="${i}">✕</button>`:''}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">없음</td></tr>'}</tbody></table></div></section>

  <section class="panel"><div class="panel-h"><div><h2>⑧ 꼭 찍어야 할 컷</h2><div class="sub">썸네일·후킹·사용 장면·전후 비교·마무리처럼, 영상에 들어가야 할 컷을 표로 보여 줍니다.</div></div>${ed&&(g.cuts||[]).length<6?'<button class="btn sm" data-act="cutAdd">+ 컷 추가</button>':''}</div>
   <div class="tblwrap"><table class="tbl"><thead><tr><th style="width:150px">컷</th><th>이렇게 찍어요</th><th style="width:96px">구분</th><th></th></tr></thead><tbody>${(g.cuts||[]).map((k,i)=>`<tr><td><input type="text" id="gd_k${i}n" data-gv="cuts.${i}.name" value="${esc(k.name||'')}"></td><td><input type="text" id="gd_k${i}d" data-gv="cuts.${i}.desc" value="${esc(k.desc||'')}"></td><td><select id="gd_k${i}m" data-gv="cuts.${i}.need">${['필수','권장','선택'].map(o=>`<option ${o===k.need?'selected':''}>${o}</option>`).join('')}</select></td><td class="n">${ed?`<button class="btn sm ghost" data-act="cutDel" data-i="${i}">✕</button>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">없음 · 「+ 컷 추가」</td></tr>'}</tbody></table></div></section>

  <div class="grid2"><section class="panel"><div class="panel-h"><h2>⑨ 촬영 · 업로드 주의사항</h2></div><div class="fgrid one">${tl('shoot','📷 촬영할 때',{rows:7})}${tl('upload','📤 업로드할 때',{rows:6})}</div></section>
  <section class="panel"><div class="panel-h"><h2>⑩ 제출 방법 · 일정</h2></div><div class="fgrid">${tx('submit.draftDue','초안 제출',{type:'date'})}${tx('submit.uploadDue','업로드 일정',{ph:'10/20 ~ 10/24'})}${tl('submit.how','진행 순서',{rows:5})}${tx('submit.form','제출 링크 (구글 폼 등)',{wide:true,ph:'https://'})}${ta('submit.extra','추가 안내 (할인 소구·2차 활용 등)',{rows:2})}</div></section></div>

  <section class="panel"><div class="row"><span class="small muted grow">칸을 고치고 다른 칸으로 이동하면 바로 저장됩니다. PPT·PDF는 지금 내용 그대로 만들어집니다.</span>${ed?`<button class="btn sm" data-act="guideDup">복제</button><button class="btn sm danger" data-act="guideDel">${A.confirm==='gdel'?'한 번 더 누르면 삭제':'가이드 삭제'}</button>`:''}</div></section>
  </div>`}

/* ---- 가이드 입력 저장 ---- */
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||(!t.dataset.gv&&!t.dataset.gl))return;const g=curG();if(!g)return;if(!canEdit())return toast('보기 전용 권한이라 수정할 수 없습니다.','crit');
  const p=t.dataset.gv||t.dataset.gl;const v=t.dataset.gl?lines(t.value):t.value;setIn(g,p,v);gSave(p.split('.')[0],g);if(p==='color'||p==='title'||p==='status')render()});
document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset||!t.dataset.gimg||!t.files||!t.files[0])return;const f=t.files[0];t.value='';if(!canEdit())return;
  try{const data=await fileToDataUrl(f,960,960,'image/jpeg',0.72);const imgs={...(A.gimgs||{}),[t.dataset.gimg]:data};const size=Object.values(imgs).reduce((a,b)=>a+String(b).length,0);
    if(size>950000)return toast('이 가이드의 이미지가 너무 많습니다. 다른 장면 이미지를 지우거나 더 작은 이미지를 넣어 주세요.','crit');
    await DB.set('guideimg/'+A.gid,{imgs,updatedAt:T_NOW()});A.gimgs=imgs;render();toast('장면 이미지를 넣었습니다.')}catch(err){console.error(err);toast('이미지를 넣지 못했습니다.','crit')}});
Object.assign(ACT,{
  async guideNew(){const cid=($('#g-newc')||{}).value||'';const c=cid?A.campaigns[cid]:null;const g=newGuide(c);if(c)g.cid=cid;const id=uid();try{await DB.set('guides/'+id,g);A.guides=A.guides||{};A.guides[id]=g;A.gid=id;render();window.scrollTo(0,0)}catch(e){saveErr(e)}},
  guideOpen(a){A.gid=a.dataset.g;A.confirm=null;render();window.scrollTo(0,0)},
  guideBack(){A.gid='';render();window.scrollTo(0,0)},
  async guideDup(){const g=curG();if(!g)return;const id=uid();const d={...clone(g),title:(g.title||'')+' (복사본)',status:'작성 중',createdAt:today(),updatedAt:T_NOW(),by:A.user.email};try{await DB.set('guides/'+id,d);if(Object.keys(A.gimgs||{}).length)await DB.set('guideimg/'+id,{imgs:clone(A.gimgs),updatedAt:T_NOW()});A.gid=id;render();toast('가이드를 복제했습니다.')}catch(e){saveErr(e)}},
  async guideDel(){if(A.confirm!=='gdel'){A.confirm='gdel';render();return}A.confirm=null;const id=A.gid;try{await DB.del('guides/'+id);await DB.del('guideimg/'+id).catch(()=>{});A.gid='';render();toast('가이드를 삭제했습니다.')}catch(e){saveErr(e)}},
  async sceneAdd(a){const g=curG();const ci=+a.dataset.c;const sc=g.concepts[ci].scenes=g.concepts[ci].scenes||[];sc.splice(Math.max(0,sc.length-1),0,gScene('바디',''));await gSave('concepts',g);render()},
  async sceneDel(a){const g=curG();const ci=+a.dataset.c,si=+a.dataset.s;const s=g.concepts[ci].scenes[si];if(A.confirm!=='sd'+s.id){A.confirm='sd'+s.id;render();return}A.confirm=null;g.concepts[ci].scenes.splice(si,1);await gSave('concepts',g);
    if(A.gimgs&&A.gimgs[s.id]){const im={...A.gimgs};delete im[s.id];DB.set('guideimg/'+A.gid,{imgs:im,updatedAt:T_NOW()}).catch(()=>{})}render()},
  async conceptAdd(){const g=curG();g.concepts=g.concepts||[];g.concepts.push(gConcept(''));await gSave('concepts',g);render()},
  async conceptDel(a){const g=curG();const ci=+a.dataset.c;const cp=g.concepts[ci];if(A.confirm!=='cd'+cp.id){A.confirm='cd'+cp.id;render();return}A.confirm=null;g.concepts.splice(ci,1);await gSave('concepts',g);render()},
  async wordAdd(){const g=curG();g.words=g.words||[];g.words.push({no:'',yes:''});await gSave('words',g);render()},
  async wordDel(a){const g=curG();g.words.splice(+a.dataset.i,1);await gSave('words',g);render()},
  async cutAdd(){const g=curG();g.cuts=g.cuts||[];g.cuts.push({id:tid('k'),name:'',desc:'',need:'권장'});await gSave('cuts',g);render()},
  async cutDel(a){const g=curG();g.cuts.splice(+a.dataset.i,1);await gSave('cuts',g);render()},
  async pointAdd(){const g=curG();g.product=g.product||{};g.product.points=g.product.points||[];g.product.points.push({t:'',d:''});await gSave('product',g);render()},
  async gimgDel(a){const im={...(A.gimgs||{})};delete im[a.dataset.k];try{await DB.set('guideimg/'+A.gid,{imgs:im,updatedAt:T_NOW()});A.gimgs=im;render()}catch(e){saveErr(e)}},
  async canvaGo(a){const g=curG();const s=g.concepts[+a.dataset.c].scenes[+a.dataset.s];const pr=s.prompt||[s.shot,s.point].filter(Boolean).join(' / ')||'제품을 들고 있는 인플루언서, 밝은 실내, 9:16 세로 구도';
    const text=`${pr}\n(세로 9:16, 실사 사진 느낌, ${g.brand||''} ${(g.product||{}).name||''} 제품 촬영 참고용 장면)`;await copyText(text);window.open('https://www.canva.com/','_blank','noopener');toast('이미지 프롬프트를 복사했습니다. Canva에서 AI 이미지(Magic Media)로 만든 뒤 다운로드해 「이미지 넣기」로 올려 주세요.')},
  gotoReview(){A.rvGid=A.gid;A.view='review';A.rvOpen='';render();window.scrollTo(0,0)},
  async guideAi(a){const g=curG();if(!g||A.gaiBusy||gAiRunning(g))return;const mode=a.dataset.m;const links=(g.links||[]).slice(0,3);if(!links.length&&!String(g.memo||'').trim())return toast('광고주 링크나 상품 정보를 먼저 넣어 주세요.','crit');
    const cn=+(($('#g-ain')||{}).value||2);A.gain=cn;const base={advertiser:g.advertiser,brand:g.brand,platform:g.platform,length:g.length,conceptN:cn,productName:(g.product||{}).name||''};
    if(DB.mode==='demo'){A.gaiBusy=true;render();await new Promise(r=>setTimeout(r,900));await gAiApply(A.gid,g,{guide:mockGuide(base),pages:links.map(u=>({url:u,ok:true}))},mode);A.gaiBusy=false;render();return}
    const job=uid();A.gaiBusy=true;render();
    try{await DB.update('guides/'+A.gid,{aiStatus:'진행 중',aiJob:job,aiMode:mode,aiAt:T_NOW(),aiError:DB.DEL,aiResult:DB.DEL});await aiFetch('/api/guide',{gid:A.gid,job,links,memo:g.memo||'',base});toast('AI가 가이드를 만드는 중입니다. 30초~2분 걸리고, 끝나면 자동으로 채워집니다.')}
    catch(e){DB.update('guides/'+A.gid,{aiStatus:'실패',aiError:String(e.message||e)}).catch(()=>{});toast('AI 가이드를 시작하지 못했습니다: '+(e.message||e),'crit')}finally{A.gaiBusy=false;render()}}
});
function gAiRunning(g){return g&&g.aiStatus==='진행 중'&&g.aiAt&&(Date.now()-new Date(g.aiAt).getTime()<6*60*1000)}
async function gAiApply(gid,g,j,mode){const out=mergeGuide(g,j.guide||{},mode);const tops=['title','advertiser','brand','summary','product','concepts','text','words','shoot','cuts','upload'];
  await DB.update('guides/'+gid,{...Object.fromEntries(tops.map(k=>[k,clone(out[k])])),aiStatus:'적용됨',aiResult:DB.DEL,updatedAt:T_NOW(),by:A.user.email});if(A.guides)A.guides[gid]={...out,aiStatus:'적용됨'};
  const bad=(j.pages||[]).filter(p=>!p.ok);toast(`AI가 가이드를 ${mode==='replace'?'새로 만들었습니다':'채웠습니다'}.${bad.length?` 읽지 못한 링크 ${bad.length}개는 상품 정보를 붙여넣어 주세요.`:''} 내용을 꼭 검토하세요.`)}
/* 백그라운드 AI 결과가 들어오면, 편집 권한이 있는 사람이 열어 둔 화면에서 한 번만 적용 */
function gAiCheck(){if(!canEdit()||!A.guides)return;Object.entries(A.guides).forEach(([gid,g])=>{if(g.aiStatus==='완료'&&g.aiResult&&!(gAiCheck.done||(gAiCheck.done=new Set())).has(g.aiJob)){gAiCheck.done.add(g.aiJob);let j=null;try{j=JSON.parse(g.aiResult)}catch(e){}
    if(j)gAiApply(gid,g,j,g.aiMode||'fill').then(()=>scheduleRender()).catch(e=>saveErr(e))}else if(g.aiStatus==='실패'&&g.aiJob&&!(gAiCheck.done||(gAiCheck.done=new Set())).has('f'+g.aiJob)&&gid===A.gid&&Date.now()-new Date(g.aiAt||0).getTime()<10*60*1000){gAiCheck.done.add('f'+g.aiJob);toast('AI 가이드를 만들지 못했습니다: '+(g.aiError||''),'crit')}})}
const isEmptyV=v=>v==null||v===''||(Array.isArray(v)&&!v.filter(x=>isObj(x)?Object.values(x).some(Boolean):Boolean(x)).length);
function conceptsEmpty(cs){return !(cs||[]).some(c=>c.name||c.hook||(c.scenes||[]).some(s=>s.shot||s.say||s.sub||s.point))}
function normConcepts(cs){return (cs||[]).slice(0,4).map(c=>({id:tid('c'),name:String(c.name||''),hook:String(c.hook||''),scenes:(c.scenes||[]).slice(0,8).map(s=>({id:tid('s'),part:G_PARTS.includes(s.part)?s.part:'바디',time:String(s.time||''),shot:String(s.shot||''),say:String(s.say||''),sub:String(s.sub||''),point:String(s.point||''),ref:String(s.ref||''),prompt:String(s.prompt||'')}))}))}
function mergeGuide(g,ai,mode){const o=clone(g);const R=mode==='replace';const put=(path,v)=>{if(v==null||isEmptyV(v))return;if(R||isEmptyV(getIn(o,path)))setIn(o,path,clone(v))};
  if(!o.title||/^새 콘텐츠 가이드/.test(o.title)){const t=[ai.brand||o.brand,(ai.product||{}).name].filter(Boolean).join(' ');if(t)o.title=t+' 콘텐츠 가이드'}
  put('advertiser',ai.advertiser);put('brand',ai.brand);
  const S=ai.summary||{};put('summary.one',S.one);if(R){put('summary.must',S.must);put('summary.dont',S.dont)}else{['must','dont'].forEach(k=>{const add=(S[k]||[]).filter(x=>!(o.summary[k]||[]).includes(x));if(add.length)o.summary[k]=[...(o.summary[k]||[]),...add].slice(0,8)})}
  const Pp=ai.product||{};['name','price','sale','option','intro','caution'].forEach(k=>put('product.'+k,Pp[k]));
  if(Pp.points&&Pp.points.length&&(R||!(o.product.points||[]).some(x=>x.t||x.d)))o.product.points=Pp.points.slice(0,5).map(x=>({t:String(x.t||''),d:String(x.d||'')}));put('product.howto',Pp.howto);
  if(ai.concepts&&ai.concepts.length&&(R||conceptsEmpty(o.concepts)))o.concepts=normConcepts(ai.concepts);
  const Tx=ai.text||{};['keywords','tagsRec','ngNames'].forEach(k=>put('text.'+k,Tx[k]));['account','brandName','productName'].forEach(k=>put('text.'+k,Tx[k]));
  if(Tx.tagsMust&&Tx.tagsMust.length){const m=[...new Set(['#협찬',...(R?[]:o.text.tagsMust||[]),...Tx.tagsMust.map(x=>'#'+String(x).replace(/^#/,''))])];o.text.tagsMust=m}
  if(ai.words&&ai.words.length){const ex=R?[]:(o.words||[]);const nw=ai.words.filter(w=>w&&w.no&&!ex.some(x=>x.no===w.no)).map(w=>({no:String(w.no),yes:String(w.yes||'')}));o.words=[...ex,...nw].slice(0,12)}
  put('text.closing',Tx.closing);
  if(ai.cuts&&ai.cuts.length){const def=JSON.stringify(G_CUTS.map(x=>x[0]));const cur=JSON.stringify((o.cuts||[]).map(x=>x.name));if(R||!(o.cuts||[]).length||cur===def)o.cuts=ai.cuts.slice(0,6).map(k=>({id:tid('k'),name:String(k.name||''),desc:String(k.desc||''),need:['필수','권장','선택'].includes(k.need)?k.need:'권장'}))}
  if(ai.uploadExtra&&ai.uploadExtra.length){o.upload=o.upload||[...G_UPLOAD];const add=ai.uploadExtra.filter(x=>!o.upload.includes(x));o.upload=[...o.upload,...add].slice(0,10)}
  if(ai.shootExtra&&ai.shootExtra.length){const add=ai.shootExtra.filter(x=>!(o.shoot||[]).includes(x));o.shoot=[...(o.shoot||[]),...add].slice(0,12)}
  return o}
function mockGuide(b){const nm=b.productName||'예시 제품';return {advertiser:b.advertiser||'예시 광고주',brand:b.brand||'예시 브랜드',summary:{one:`${nm}, 바르는 순간 느껴지는 차이`,must:['제품을 바르기 전과 후를 같은 조명·같은 각도로 보여 주세요.'],dont:['피부가 "치료"된다고 말하지 말아 주세요.']},
  product:{name:nm,price:'32,000원',sale:'25,600원 (20% 할인)',option:'50ml',intro:'가볍게 발리고 오래 촉촉한 데일리 세럼',points:[{t:'3초 흡수',d:'바르자마자 쏙 스며들어 끈적임이 없어요.'},{t:'하루 종일 촉촉',d:'아침에 바르면 저녁까지 당김이 없어요.'},{t:'예민한 피부도 OK',d:'자극 테스트를 마친 순한 성분이에요.'}],howto:['세안 후 토너로 정리','2~3방울 덜어 얼굴에 펴 바르기','가볍게 두드려 흡수'],caution:'사용 전후 비교는 같은 조명·각도에서 찍어 주세요.'},
  concepts:Array.from({length:b.conceptN||2},(_,i)=>({name:['3초 루틴','하루 종일 촉촉 챌린지','파우치 필수템','올인원 꿀팁'][i],hook:['아직도 세럼 바르고 끈적여?','아침에 바르고 밤까지 버텨볼게요','제 파우치에서 절대 안 빠지는 거','바쁜 아침엔 이거 하나면 끝'][i],
    scenes:[{part:'인트로',time:'0~3초',shot:'세럼을 손등에 떨어뜨리는 장면을 클로즈업해 주세요.',say:'아직도 세럼 바르고 끈적여?',sub:'끈적임 0초 세럼',point:'첫 3초 후킹',prompt:'손등 위로 떨어지는 투명한 세럼 방울, 밝은 욕실, 클로즈업'},
     {part:'바디',time:'3~15초',shot:'얼굴 반쪽에만 바르고 정면으로 비교해 보여 주세요.',say:'이거 바르자마자 쏙 흡수돼요. 진짜 3초면 끝나요.',sub:'3초 흡수',point:'흡수력',prompt:'얼굴 반쪽만 촉촉하게 빛나는 여성, 정면 클로즈업'},
     {part:'바디',time:'15~25초',shot:'메이크업을 올리고 밀리지 않는 모습을 보여 주세요.',say:'위에 화장해도 하나도 안 밀려요.',sub:'화장 밀림 없음',point:'화잘먹',prompt:'쿠션을 두드리는 손, 매끈한 피부결'},
     {part:'아웃트로',time:'25~30초',shot:'제품을 들고 웃으며 마무리해 주세요.',say:'끈적임 싫은 분들은 꼭 써 보세요!',sub:'지금 할인 중',point:'구매 유도',prompt:'제품을 들고 미소 짓는 여성, 밝은 배경'}]})),
  text:{keywords:[nm,'3초 흡수','속보습'],closing:'끈적임 싫은 분들은 꼭 써 보세요!',tagsMust:['#협찬','#'+nm.replace(/\s/g,'')],tagsRec:['#세럼추천','#속보습','#데일리세럼'],account:'@example_official',brandName:b.brand||'예시 브랜드',productName:nm,ngNames:[]},
  words:[{no:'주름이 없어져요',yes:'피부가 매끈해 보여요'}],cuts:[{name:'썸네일',desc:'세럼을 든 밝은 얼굴 컷',need:'권장'},{name:'인트로 (후킹)',desc:'세럼 방울이 떨어지는 클로즈업',need:'필수'},{name:'흡수 장면',desc:'얼굴 반쪽 비교',need:'필수'},{name:'아웃트로',desc:'제품을 들고 마무리 멘트',need:'필수'}],shootExtra:['세럼 제형이 잘 보이게 손등 클로즈업을 꼭 넣어 주세요.']}}

/* ---- 가이드 PPT·PDF ---- */
function ringImg(color){const cv=document.createElement('canvas');cv.width=cv.height=600;const x=cv.getContext('2d');x.strokeStyle=color;x.globalAlpha=.18;x.lineWidth=46;x.beginPath();x.arc(230,300,190,0,7);x.stroke();x.globalAlpha=.12;x.beginPath();x.arc(390,300,190,0,7);x.stroke();return cv.toDataURL('image/png')}
const brk=s=>String(s||'').replace(/([.!?…])\s+(?=\S)/g,'$1\n').replace(/,\s+(?=[^,]{14,})/g,',\n').trim();
async function guideDeck(pptx,g,imgs,PDF){
  const W=13.333,H=7.5,X0=0.6,CW=W-1.2;const hx=v=>String(v||'#7A1E2C').replace('#','').toUpperCase();const TH=hx(g.color);
  const mix=(h,t)=>{const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return c.map(v=>Math.round(v+(255-v)*t).toString(16).padStart(2,'0')).join('').toUpperCase()};
  const SOFT=mix(TH,.9),DARK='1B1E27',MUT='6B7280',LINE='E3E5EA',GREEN='157A3C',RED='C22727';
  const FT='Pretendard ExtraBold',FL='Pretendard Light',FB='Pretendard';const B=PDF;// PDF는 굵기를 bold로 표시
  const P=g.product||{};const ym=new Date();const cr=`COPYRIGHT ⓒ RINGCOMS  |  ${ym.getFullYear()}.${String(ym.getMonth()+1).padStart(2,'0')}`;let pg=0;
  const ring=ringImg('#FFFFFF');const LG=await ringLogo('#'+TH);const LW_=1.75,LH_=LW_*182/900;
  const logo=(s,white)=>{const d=white?LG.white:LG.tint;if(d)s.addImage({data:d,x:W-0.6-LW_,y:0.42,w:LW_,h:LH_});else T(s,'RINGCOMS',{x:W-2.9,y:0.42,w:2.3,h:0.36,fontFace:FT,bold:B,fontSize:15,color:white?'FFFFFF':TH,align:'right',charSpacing:2})};
  const T=(s,text,o)=>s.addText(text,{fontFace:FB,valign:'middle',margin:0,charSpacing:0,...o});
  const head=(s,label,title,sub)=>{pg++;s.background={color:'FFFFFF'};
    T(s,label,{x:X0,y:0.38,w:7,h:0.3,fontFace:FL,fontSize:12,color:TH});
    T(s,title,{x:X0,y:0.66,w:9.6,h:0.62,fontFace:FT,bold:B,fontSize:26,color:DARK,fit:'shrink'});
    if(sub)T(s,sub,{x:X0,y:1.28,w:11.6,h:0.36,fontFace:FL,fontSize:13,color:MUT,fit:'shrink'});
    logo(s,false);
    s.addShape(pptx.ShapeType.rect,{x:0,y:H-0.06,w:W,h:0.06,fill:{color:TH},line:{color:TH,width:0}});
    T(s,cr,{x:X0,y:H-0.42,w:5,h:0.26,fontSize:8.5,color:'9AA0AA'});T(s,String(pg),{x:W-1.2,y:H-0.42,w:0.6,h:0.26,fontSize:9,color:'9AA0AA',align:'right'})};
  const card=(s,x,y,w,h,fill,line)=>s.addShape(pptx.ShapeType.roundRect,{x,y,w,h,fill:{color:fill||'FFFFFF'},line:{color:line||LINE,width:line===null?0:0.75},rectRadius:PDF?0.12:0.06});
  const put=async(s,data,x,y,w,h)=>{if(!data)return false;const d=await new Promise(r=>{const im=new Image();im.onload=()=>r([im.naturalWidth,im.naturalHeight]);im.onerror=()=>r(null);im.src=data});if(!d)return false;const k=Math.min(w/d[0],h/d[1]);s.addImage({data,x:x+(w-d[0]*k)/2,y:y+(h-d[1]*k)/2,w:d[0]*k,h:d[1]*k});return true};
  const listRuns=(arr,mark,color)=>(arr||[]).flatMap((t,i)=>[{text:mark+' ',options:{bold:true,color}},{text:String(t),options:{breakLine:i<arr.length-1}}]);

  // 1 표지
  {const s=pptx.addSlide();pg++;s.background={color:TH};s.addImage({data:ring,x:W-6.4,y:0.6,w:6.3,h:6.3});
    logo(s,true);
    T(s,'CONTENT GUIDE',{x:X0+0.1,y:2.0,w:8,h:0.4,fontFace:FL,fontSize:15,color:'FFFFFF'});
    T(s,[g.brand,P.name].filter(Boolean).join(' ')||g.title||'콘텐츠 가이드',{x:X0+0.1,y:2.45,w:9.2,h:1.3,fontFace:FT,bold:B,fontSize:40,color:'FFFFFF',fit:'shrink'});
    T(s,`${g.platform||''} 콘텐츠 가이드`,{x:X0+0.1,y:3.8,w:9,h:0.55,fontFace:FL,fontSize:22,color:'FFFFFF'});
    T(s,[`영상 길이 ${g.length||'-'}`,`화면 ${g.ratio||'9:16 세로'}`,g.submit&&g.submit.uploadDue?`업로드 ${g.submit.uploadDue}`:''].filter(Boolean).join('   ·   '),{x:X0+0.1,y:4.6,w:10,h:0.4,fontSize:13,color:'FFFFFF',transparency:15});
    T(s,`${today().replace(/-/g,'.')}  ·  링컴즈 MCN 사업부 광고콘텐츠팀`,{x:X0+0.1,y:H-1.0,w:9,h:0.35,fontFace:FL,fontSize:12,color:'FFFFFF'})}

  // 2 이것만 꼭 지켜주세요
  {const s=pptx.addSlide();const S=g.summary||{};head(s,'CHECK FIRST','이것만 꼭 지켜 주세요!','촬영 전에 이 장만 먼저 읽어 주세요.');
    card(s,X0,1.85,CW,0.85,TH,null);T(s,[{text:'핵심 메시지   ',options:{bold:true,fontSize:14}},{text:S.one||P.intro||'-',options:{bold:true,fontSize:20}}],{x:X0+0.3,y:1.85,w:CW-0.6,h:0.85,color:'FFFFFF',fontFace:FT,fit:'shrink'});
    const cw=(CW-0.3)/2;[[S.must,'✅  꼭 해 주세요',GREEN,'✔'],[S.dont,'❌  하지 말아 주세요',RED,'✕']].forEach(([arr,ttl,col,mk],i)=>{const x=X0+i*(cw+0.3);card(s,x,2.95,cw,3.25,i?'FFF6F6':'F3FAF5',null);
      T(s,ttl,{x:x+0.3,y:3.05,w:cw-0.6,h:0.5,fontFace:FT,bold:B,fontSize:17,color:col});
      T(s,(arr||[]).length?listRuns(arr,mk,col):'-',{x:x+0.3,y:3.6,w:cw-0.6,h:2.5,fontSize:14,color:DARK,paraSpaceAfter:6,fit:'shrink'})});
    const facts=[['영상 길이',g.length],['화면 비율',g.ratio],['초안 제출',g.submit&&g.submit.draftDue?md(g.submit.draftDue):''],['업로드',g.submit&&g.submit.uploadDue]].filter(x=>x[1]);
    const fw=CW/Math.max(1,facts.length);facts.forEach(([k,v],i)=>T(s,[{text:k+'  ',options:{color:MUT,fontSize:11}},{text:String(v),options:{bold:true,fontSize:14,color:DARK}}],{x:X0+i*fw,y:6.35,w:fw,h:0.45,align:'center'}))}

  // 3 제품 정보
  {const s=pptx.addSlide();head(s,'PRODUCT',`${P.name||'제품'} 알아보기`,brk(P.intro||'').replace(/\n/g,' '));
    T(s,P.name||'-',{x:X0,y:1.85,w:4.6,h:0.6,fontFace:FT,bold:B,fontSize:22,color:DARK,fit:'shrink'});
    const pr=[P.price?{text:`정가 ${P.price}`,options:{color:MUT,fontSize:12,breakLine:!!P.sale}}:null,P.sale?{text:`판매가 ${P.sale}`,options:{bold:true,color:TH,fontSize:16}}:null].filter(Boolean);
    if(pr.length)T(s,pr,{x:X0,y:2.45,w:4.6,h:0.75});if(P.option)T(s,`옵션 · ${P.option}`,{x:X0,y:3.2,w:4.6,h:0.35,fontSize:12,color:MUT});
    if((P.howto||[]).length){T(s,'사용 방법',{x:X0,y:3.7,w:4.6,h:0.35,fontFace:FT,bold:B,fontSize:14,color:TH});T(s,P.howto.flatMap((t,i)=>[{text:`STEP ${i+1}  `,options:{bold:true,color:TH}},{text:t,options:{breakLine:i<P.howto.length-1}}]),{x:X0,y:4.05,w:4.6,h:1.9,fontSize:12.5,color:DARK,paraSpaceAfter:5,fit:'shrink'})}
    if(P.caution)T(s,'⚠ '+P.caution,{x:X0,y:6.0,w:4.6,h:0.75,fontSize:11,color:RED,fit:'shrink'});
    const pts=(P.points||[]).filter(x=>x.t||x.d).slice(0,5);const px=X0+4.9,pw=CW-4.9;const ph=Math.min(1.45,(4.85-(pts.length-1)*0.15)/Math.max(1,pts.length));
    pts.forEach((pt,i)=>{const y=1.9+i*(ph+0.15);card(s,px,y,pw,ph,SOFT,null);T(s,String(i+1).padStart(2,'0'),{x:px+0.25,y,w:0.7,h:ph,fontFace:FT,bold:B,fontSize:22,color:TH});
      T(s,[{text:pt.t||'',options:{bold:true,fontSize:16,color:DARK,breakLine:true}},{text:brk(pt.d||''),options:{fontSize:12.5,color:'394253'}}],{x:px+1.0,y:y+0.05,w:pw-1.25,h:ph-0.1,fit:'shrink'})})}

  // 4 컨셉 고르기
  const CS=(g.concepts||[]).filter(c=>c.name||(c.scenes||[]).length);
  if(CS.length>1){const s=pptx.addSlide();head(s,'CONCEPT','컨셉을 1개 골라 주세요','아래 컨셉 중 본인 채널과 잘 맞는 것을 골라 촬영해 주세요. 다음 장부터 장면별 가이드가 있어요.');
    const cw=(CW-(CS.length-1)*0.25)/CS.length;CS.forEach((c,i)=>{const x=X0+i*(cw+0.25);card(s,x,1.95,cw,4.6,SOFT,null);
      T(s,String(i+1),{x:x+0.3,y:2.15,w:0.8,h:0.8,fontFace:FT,bold:B,fontSize:34,color:TH});T(s,c.name||'',{x:x+0.3,y:3.05,w:cw-0.6,h:0.9,fontFace:FT,bold:B,fontSize:19,color:DARK,fit:'shrink'});
      T(s,[{text:'이렇게 시작해요',options:{fontSize:11,color:MUT,breakLine:true}},{text:'“'+(c.hook||'-')+'”',options:{fontSize:15,bold:true,color:TH}}],{x:x+0.3,y:4.05,w:cw-0.6,h:1.3,fit:'shrink'});
      T(s,`장면 ${(c.scenes||[]).length}개`,{x:x+0.3,y:5.75,w:cw-0.6,h:0.4,fontSize:11,color:MUT})})}

  // 5 장면 가이드
  for(let ci=0;ci<CS.length;ci++){const c=CS[ci];const sc=c.scenes||[];for(let k=0;k<Math.max(1,sc.length);k+=4){const part=sc.slice(k,k+4);const s=pptx.addSlide();
    head(s,`CONCEPT ${ci+1}  ·  장면 가이드${sc.length>4?` (${k/4+1}/${Math.ceil(sc.length/4)})`:''}`,c.name||`컨셉 ${ci+1}`,c.hook?`첫 마디 · “${c.hook}”`:'');
    const n_=Math.max(part.length,1),gap=0.2,cw=(CW-(n_-1)*gap)/n_;
    for(let i=0;i<part.length;i++){const sx=part[i];const x=X0+i*(cw+gap),y=1.82;card(s,x,y,cw,4.85,'FFFFFF');
      s.addShape(pptx.ShapeType.rect,{x,y,w:cw,h:0.42,fill:{color:TH},line:{color:TH,width:0}});
      T(s,[{text:`#${k+i+1} ${sx.part||''}`,options:{bold:true}},{text:sx.time?`   ${sx.time}`:'',options:{fontSize:11}}],{x:x+0.15,y,w:cw-0.3,h:0.42,fontSize:13,color:'FFFFFF',fontFace:FT});
      const iy=y+0.52,ih=1.45;if(!(await put(s,imgs[sx.id],x+0.12,iy,cw-0.24,ih))){card(s,x+0.12,iy,cw-0.24,ih,'F4F5F7',null);T(s,'참고 이미지',{x:x+0.12,y:iy,w:cw-0.24,h:ih,fontSize:10,color:'A0A6B0',align:'center'})}
      const box=(yy,hh,lab,txt,col)=>T(s,[{text:lab,options:{bold:true,fontSize:10.5,color:col||TH,breakLine:true}},{text:txt||'-',options:{fontSize:11.5,color:DARK}}],{x:x+0.15,y:yy,w:cw-0.3,h:hh,fit:'shrink'});
      box(iy+ih+0.08,0.95,'📷 이렇게 찍어요',brk(sx.shot));box(iy+ih+1.05,1.25,'🎙 이렇게 말해요 (예시)',brk(sx.say)+(sx.sub?`\n[자막] ${sx.sub}`:''));
      box(iy+ih+2.32,0.5,'⭐ 포인트',sx.point,GREEN);
      if(sx.ref)T(s,'참고 영상 보기 ↗',{x:x+0.15,y:y+4.85-0.32,w:cw-0.3,h:0.28,fontSize:9.5,color:TH,hyperlink:{url:sx.ref}})}
    T(s,'※ 멘트는 예시예요. 꼭 들어갈 내용만 지키고, 본인 말투로 자연스럽게 말해 주세요.',{x:X0,y:6.72,w:CW,h:0.3,fontSize:10.5,color:MUT})}}

  // 5-2 꼭 찍어야 할 컷 · 마무리 메시지
  const KS=(g.cuts||[]).filter(k=>k.name||k.desc).slice(0,6);const CL=(g.text||{}).closing;
  if(KS.length||CL){const s=pptx.addSlide();head(s,'MUST-HAVE CUTS','꼭 찍어야 할 컷','컨셉과 상관없이 영상 안에 아래 컷이 들어가야 해요. 「필수」는 꼭 넣어 주세요!');
    const n_=Math.max(1,KS.length),gap=0.2,cw=(CW-(n_-1)*gap)/n_,ch=CL?3.55:4.6;
    KS.forEach((k,i)=>{const x=X0+i*(cw+gap),y=1.9;const M=k.need==='필수';card(s,x,y,cw,ch,M?SOFT:'FFFFFF',M?null:undefined);
      T(s,String(i+1).padStart(2,'0'),{x:x+0.2,y:y+0.18,w:0.8,h:0.5,fontFace:FT,bold:B,fontSize:20,color:TH});
      card(s,x+cw-1.0,y+0.24,0.8,0.36,M?TH:'FFFFFF',M?null:TH);T(s,k.need||'권장',{x:x+cw-1.0,y:y+0.24,w:0.8,h:0.36,fontSize:11,bold:true,color:M?'FFFFFF':TH,align:'center'});
      T(s,k.name||'',{x:x+0.2,y:y+0.85,w:cw-0.4,h:0.6,fontFace:FT,bold:B,fontSize:16,color:DARK,fit:'shrink'});
      T(s,brk(k.desc||''),{x:x+0.2,y:y+1.5,w:cw-0.4,h:ch-1.7,fontSize:12.5,color:'394253',valign:'top',fit:'shrink'})});
    if(CL){card(s,X0,5.7,CW,0.95,TH,null);T(s,[{text:'마무리 핵심 메시지   ',options:{fontSize:13,bold:true}},{text:'“'+CL+'”',options:{fontSize:18,bold:true}}],{x:X0+0.3,y:5.7,w:CW-0.6,h:0.95,color:'FFFFFF',fontFace:FT,fit:'shrink'})}}

  // 6 문구·해시태그
  {const s=pptx.addSlide();const Tx=g.text||{};head(s,'CAPTION · HASHTAG','꼭 넣을 문구와 해시태그','본문(캡션)·자막·멘트에 아래 내용을 넣어 주세요. 오타가 없는지 한 번 더 확인해 주세요!');
    const cw=(CW-0.3)/2,ch=2.3;const boxes=[['필수 키워드',(Tx.keywords||[]).join('   ·   ')||'-','본문·자막·멘트 중 한 곳 이상에 넣어 주세요.'],['필수 해시태그',(Tx.tagsMust||[]).join('  ')||'#협찬','#협찬은 본문 맨 앞에 넣어 주세요. (공정위 지침)'],['권장 해시태그',(Tx.tagsRec||[]).join('  ')||'-','본문 또는 댓글에 넣어 주세요.'],['계정 태그 · 바른 표기',[Tx.account?`공식 계정  ${Tx.account}`:'',Tx.brandName?`브랜드  ${Tx.brandName}`:'',Tx.productName?`제품  ${Tx.productName}`:''].filter(Boolean).join('\n')||'-',(Tx.ngNames||[]).length?`이렇게 쓰면 안 돼요 ✕  ${Tx.ngNames.join(' / ')}`:'오타·임의 줄임말 없이 정확히 써 주세요.']];
    boxes.forEach(([t,v,note],i)=>{const x=X0+(i%2)*(cw+0.3),y=1.85+Math.floor(i/2)*(ch+0.2);card(s,x,y,cw,ch,i===1?SOFT:'FFFFFF');
      T(s,t,{x:x+0.3,y:y+0.12,w:cw-0.6,h:0.42,fontFace:FT,bold:B,fontSize:15,color:TH});T(s,v,{x:x+0.3,y:y+0.58,w:cw-0.6,h:1.15,fontSize:15,bold:true,color:DARK,fit:'shrink'});T(s,note,{x:x+0.3,y:y+1.75,w:cw-0.6,h:0.42,fontSize:11,color:i===3&&(Tx.ngNames||[]).length?RED:MUT,fit:'shrink'})})}

  // 7 이렇게 말하면 안 돼요
  if((g.words||[]).length){const s=pptx.addSlide();head(s,'DO NOT SAY','이렇게 말하면 안 돼요','광고 심의·공정위 기준이에요. 왼쪽 표현은 쓰지 말고, 오른쪽처럼 바꿔 말해 주세요.');
    const ws=g.words.slice(0,9);const rh=Math.min(0.55,4.3/(ws.length+1));
    s.addTable([[{text:'❌  이렇게 말하지 마세요',options:{bold:true,color:'FFFFFF',fill:{color:RED},align:'center'}},{text:'⭕  이렇게 바꿔 말해요',options:{bold:true,color:'FFFFFF',fill:{color:GREEN},align:'center'}}],...ws.map(w=>[{text:w.no||'',options:{color:RED,bold:true}},{text:w.yes||'',options:{color:DARK}}])],
      {x:X0,y:1.9,w:CW,colW:[CW/2,CW/2],rowH:Array(ws.length+1).fill(rh),fontFace:FB,fontSize:14,valign:'middle',border:{type:'solid',pt:0.75,color:LINE},margin:[0.06,0.15,0.06,0.15]})}

  // 8 촬영 · 업로드 주의사항
  {const SH=(g.shoot||[]).slice(0,8),UP=(g.upload||[]).slice(0,8);if(SH.length||UP.length){const s=pptx.addSlide();head(s,'CHECK LIST','촬영 · 업로드 주의사항','지키지 않으면 수정을 요청드릴 수 있어요. 촬영 전·업로드 전에 한 번씩 확인해 주세요.');
    const cols=[['📷  촬영할 때',SH],['📤  업로드할 때',UP]].filter(x=>x[1].length);const cw=(CW-(cols.length-1)*0.3)/cols.length;
    cols.forEach(([t,L],j)=>{const x=X0+j*(cw+0.3);T(s,t,{x,y:1.85,w:cw,h:0.45,fontFace:FT,bold:B,fontSize:16,color:TH});const hh=Math.min(0.6,4.35/L.length-0.08);
      L.forEach((t2,i)=>{const y=2.4+i*(hh+0.08);card(s,x,y,cw,hh,SOFT,null);T(s,String(i+1),{x:x+0.1,y,w:0.45,h:hh,fontFace:FT,bold:B,fontSize:14,color:TH,align:'center'});T(s,t2,{x:x+0.6,y,w:cw-0.8,h:hh,fontSize:12.5,color:DARK,fit:'shrink'})})})}}

  // 9 제출 방법
  {const s=pptx.addSlide();const Sb=g.submit||{};head(s,'HOW TO SUBMIT','제출 방법과 일정','순서대로 진행해 주세요. 업로드는 검수 승인 후에 해 주세요!');const st=(Sb.how||[]).slice(0,5);const n_=Math.max(1,st.length),gap=0.35,cw=(CW-(n_-1)*gap)/n_;
    st.forEach((t,i)=>{const x=X0+i*(cw+gap);card(s,x,1.95,cw,2.4,i===st.length-1?TH:SOFT,null);T(s,`STEP ${i+1}`,{x:x+0.2,y:2.05,w:cw-0.4,h:0.42,fontFace:FT,bold:B,fontSize:14,color:i===st.length-1?'FFFFFF':TH});
      T(s,brk(t),{x:x+0.2,y:2.5,w:cw-0.4,h:1.75,fontSize:13,color:i===st.length-1?'FFFFFF':DARK,fit:'shrink'});if(i<st.length-1)T(s,'›',{x:x+cw,y:2.9,w:gap,h:0.5,fontSize:24,color:TH,align:'center'})});
    const info=[Sb.draftDue?['초안 제출',md(Sb.draftDue)]:null,Sb.uploadDue?['업로드 일정',Sb.uploadDue]:null,Sb.form?['제출 링크',Sb.form]:null].filter(Boolean);
    info.forEach(([k,v],i)=>T(s,[{text:k+'   ',options:{bold:true,color:TH}},{text:String(v),options:{color:DARK,...(k==='제출 링크'?{hyperlink:{url:v}}:{})}}],{x:X0,y:4.6+i*0.45,w:CW,h:0.4,fontSize:14}));
    if(Sb.extra)T(s,'📌 '+Sb.extra,{x:X0,y:4.6+info.length*0.45+0.1,w:CW,h:Math.max(0.5,1.9-info.length*0.45),fontSize:12.5,color:'394253',fit:'shrink'})}

  // 10 E.O.D
  {const s=pptx.addSlide();pg++;s.background={color:TH};s.addImage({data:ring,x:(W-5.2)/2,y:1.15,w:5.2,h:5.2});T(s,'E.O.D',{x:0,y:2.9,w:W,h:1.0,fontFace:FT,bold:B,fontSize:48,color:'FFFFFF',align:'center'});
    T(s,'궁금한 점은 담당자에게 편하게 물어봐 주세요.',{x:0,y:3.9,w:W,h:0.45,fontFace:FL,fontSize:15,color:'FFFFFF',align:'center'});
    T(s,'링컴즈 MCN 사업부 광고콘텐츠팀  ·  ac@ringcoms.com',{x:0,y:H-1.1,w:W,h:0.4,fontSize:12,color:'FFFFFF',align:'center'});logo(s,true)}
}
async function ringLogo(color){if(!ringLogo.white){try{const b=await (await fetch('/img/ringcoms-wide.png')).blob();ringLogo.white=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>r(null);fr.readAsDataURL(b)})}catch(e){ringLogo.white=null}}
  const white=ringLogo.white;if(!white)return {white:null,tint:null};
  const tint=await new Promise(r=>{const im=new Image();im.onload=()=>{const cv=document.createElement('canvas');cv.width=im.naturalWidth;cv.height=im.naturalHeight;const x=cv.getContext('2d');x.drawImage(im,0,0);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,cv.width,cv.height);r(cv.toDataURL('image/png'))};im.onerror=()=>r(null);im.src=white});
  return {white,tint}}
async function guideExport(out){const g=curG();if(!g||guideExport.busy)return;guideExport.busy=true;const PDF=out==='pdf';const name=`${(g.title||'콘텐츠 가이드').replace(/[\\/:*?"<>|]/g,'')}_${today().replace(/-/g,'')}`;
  try{toast(PDF?'PDF를 만드는 중입니다… 인쇄 창이 열리면 「PDF로 저장」을 고르세요.':'PPT를 만드는 중입니다…');
    if(!PDF&&!window.PptxGenJS)await loadScript('/vendor/pptxgen.bundle.js');
    if(PDF&&!document.getElementById('pretendard-css')){const l=document.createElement('link');l.id='pretendard-css';l.rel='stylesheet';l.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';document.head.appendChild(l);
      const st=document.createElement('style');st.textContent="#deck-print .dk-page{font-family:'Pretendard','Malgun Gothic',sans-serif!important}";document.head.appendChild(st);await new Promise(r=>{l.onload=r;l.onerror=r;setTimeout(r,2500)})}
    const deck=PDF?new HtmlDeck():new PptxGenJS();deck.layout='LAYOUT_WIDE';deck.title=g.title||'Content Guide';if(!PDF)deck.author='RINGCOMS MCN';
    await guideDeck(deck,g,A.gimgs||{},PDF);if(PDF)await deck.print(name);else await deck.writeFile({fileName:name+'.pptx'})}
  catch(e){console.error(e);toast((PDF?'PDF':'PPT')+'를 만들지 못했습니다: '+(e.message||e),'crit')}finally{guideExport.busy=false}}
ACT.guidePpt=()=>guideExport('pptx');ACT.guidePdf=()=>guideExport('pdf');

/* ============ 영상 검수 ============ */
const RV_ST={'대기':'','영상 받는 중':'accent','분석 중':'accent','완료':'ok','실패':'crit'};
function rvRes(r){if(!r||!r.resultJson)return null;try{return JSON.parse(r.resultJson)}catch(e){return null}}
function rvStale(r){return ['영상 받는 중','분석 중','대기'].includes(r.status)&&r.createdAt&&(Date.now()-new Date(r.createdAt).getTime()>16*60*1000)}
function linkKind(u){u=String(u||'');return /youtu\.?be/.test(u)?'유튜브':/drive\.google|docs\.google/.test(u)?'구글 드라이브':/instagram\.com/.test(u)?'인스타그램':/tiktok\.com/.test(u)?'틱톡':/\.(mp4|mov|m4v|webm)(\?|$)/i.test(u)?'영상 파일':'기타'}
function viewReview(){ensureToolWatch();const gs=Object.entries(A.guides||{}).sort((a,b)=>String(b[1].updatedAt||'').localeCompare(String(a[1].updatedAt||'')));
  const gid=A.rvGid&&A.guides&&A.guides[A.rvGid]?A.rvGid:(gs[0]||[])[0]||'';const g=gid?A.guides[gid]:null;const cs=(g&&g.concepts)||[];
  const L=Object.entries(A.reviews||{}).sort((a,b)=>String(b[1].createdAt||'').localeCompare(String(a[1].createdAt||'')));
  if(A.rvOpen&&A.reviews&&A.reviews[A.rvOpen])return reviewDetail(A.rvOpen,A.reviews[A.rvOpen]);
  return `<div class="page-h"><div><div class="eyebrow">Video Review</div><h1>영상 검수</h1><div class="sub">인플루언서가 보낸 영상 링크를 넣으면 콘텐츠 가이드 기준으로 자막·나레이션·장면 구성·필수 표현을 확인하고, 수정할 점을 요약합니다.</div></div><div class="row">${aiPill()}</div></div>
  ${A.reviewsErr?rulesBanner():''}
  <section class="panel"><div class="panel-h"><h2>새 검수</h2></div>
   ${gs.length?`<div class="fgrid"><label class="f">기준 가이드<select id="rv-g" data-rvg="1">${gs.map(([id,x])=>`<option value="${id}" ${id===gid?'selected':''}>${esc(x.title||'제목 없음')}</option>`).join('')}</select></label>
    <label class="f">컨셉<select id="rv-c"><option value="">AI가 가장 가까운 컨셉으로 판단</option>${cs.map((c,i)=>`<option value="${i}">${i+1}. ${esc(c.name||'')}</option>`).join('')}</select></label>
    <label class="f">인플루언서<input type="text" id="rv-n" placeholder="이름 또는 @계정"></label>
    <label class="f wide">영상 링크<input type="url" id="rv-u" placeholder="https://drive.google.com/… 또는 유튜브·인스타그램·틱톡 링크"><span class="hint">업로드 전 초안은 <b>구글 드라이브</b>(「링크가 있는 모든 사용자」 보기) 링크를 권장합니다. 유튜브는 <b>공개</b> 영상만, 인스타그램·틱톡은 게시된 영상만 분석할 수 있습니다.</span></label></div>
    <div class="row" style="margin-top:10px">${canEdit()?`<button class="btn primary" data-act="revRun" ${A.rvBusy?'disabled':''}>${A.rvBusy?'요청 중…':'검수 시작'}</button>`:''}<span class="small muted">영상 길이에 따라 1~5분 걸립니다. 이 화면을 떠나도 계속 진행되고, 끝나면 아래 목록에 결과가 나옵니다.</span></div>`
   :`<div class="empty">검수 기준이 될 콘텐츠 가이드가 없습니다. <button class="btn sm" data-act="nav" data-v="guides">콘텐츠 가이드 만들기</button></div>`}</section>
  <div class="sect-h" style="margin-top:18px"><h2>검수 기록</h2><span class="sub">${L.length}건</span></div>
  ${L.length?`<div class="tblwrap"><table class="tbl"><thead><tr><th>인플루언서</th><th>가이드</th><th>영상</th><th>결과</th><th>상태</th><th>요청</th></tr></thead><tbody>${L.map(([id,r])=>{const res=rvRes(r);const st=rvStale(r)?'시간 초과':r.status;
     return `<tr class="click" data-act="revOpen" data-r="${esc(id)}"><td class="bold">${esc(r.infl||'–')}</td><td class="small">${esc((A.guides&&A.guides[r.gid]&&A.guides[r.gid].title)||r.gtitle||'')}</td><td class="small">${esc(linkKind(r.url))}</td><td>${res?`<span class="pill ${res.verdict==='통과'?'ok':res.verdict==='재촬영 필요'?'crit':'warn'}">${esc(res.verdict||'')}${res.score!=null?' · '+res.score+'점':''}</span>`:'–'}</td><td><span class="pill ${st==='시간 초과'?'crit':RV_ST[st]||''}">${esc(st||'')}</span></td><td class="small">${esc(String(r.createdAt||'').slice(5,16).replace('T',' '))}</td></tr>`}).join('')}</tbody></table></div>`
  :`<div class="panel empty">${A.reviewsLoaded?'아직 검수한 영상이 없습니다.':'불러오는 중…'}</div>`}`}
function reviewDetail(id,r){const res=rvRes(r);const st=rvStale(r)?'시간 초과':r.status;const busy=['대기','영상 받는 중','분석 중'].includes(st);
  const sc={ok:['ok','지켜짐'],fix:['warn','수정 필요'],miss:['crit','빠짐'],na:['','확인 불가']};const pill=k=>{const x=sc[k]||sc.na;return `<span class="pill ${x[0]}">${x[1]}</span>`};
  return `<div class="page-h"><div><button class="btn sm ghost" data-act="revBack">← 검수 기록</button><h1 style="margin-top:6px">${esc(r.infl||'인플루언서')} 영상 검수</h1><div class="sub">${esc(r.gtitle||'')}${r.concept?' · '+esc(r.concept):''} · <a href="${esc(r.url)}" target="_blank" rel="noopener">영상 열기 ↗</a> · 요청 ${esc(String(r.createdAt||'').slice(0,16).replace('T',' '))} ${esc(r.by||'')}</div></div>
   <div class="row">${canEdit()?`<button class="btn" data-act="revRetry" data-r="${esc(id)}">다시 검수</button><button class="btn danger" data-act="revDel" data-r="${esc(id)}">${A.confirm==='rd'+id?'한 번 더 누르면 삭제':'삭제'}</button>`:''}</div></div>
  ${busy?`<div class="panel empty"><b>${esc(st)}…</b><br><span class="small muted">영상 길이에 따라 1~5분 걸립니다. 끝나면 이 화면이 자동으로 바뀝니다.</span></div>`:''}
  ${st==='실패'||st==='시간 초과'?`<div class="banner" style="margin:0"><b>검수하지 못했습니다.</b> ${esc(r.error||'시간이 너무 오래 걸렸습니다. 다시 시도해 주세요.')}</div>`:''}
  ${res?`<div class="stack">
   <section class="panel"><div class="row" style="gap:14px;align-items:flex-start"><div class="rv-score ${res.verdict==='통과'?'ok':res.verdict==='재촬영 필요'?'crit':'warn'}"><b>${res.score!=null?res.score:'–'}</b><span>${esc(res.verdict||'')}</span></div><div class="grow"><h2 style="font-size:16px;margin-bottom:6px">한 줄 요약</h2><p style="margin:0">${esc(res.summary||'')}</p>${res.duration?`<p class="small muted" style="margin:6px 0 0">영상 길이 ${esc(res.duration)}${res.ratio?' · '+esc(res.ratio):''}</p>`:''}</div></div></section>
   ${(res.fixes||[]).length?`<section class="panel"><div class="panel-h"><h2>수정 요청 사항</h2><span class="sub">중요한 순서</span></div><div class="tblwrap"><table class="tbl"><thead><tr><th>중요도</th><th>위치</th><th>무엇이 문제인가요</th><th>이렇게 고쳐 주세요</th></tr></thead><tbody>${res.fixes.map(f=>`<tr><td><span class="pill ${f.priority==='필수'?'crit':f.priority==='권장'?'warn':''}">${esc(f.priority||'')}</span></td><td class="small" style="white-space:nowrap">${esc(f.time||'')}</td><td>${esc(f.what||'')}</td><td>${esc(f.how||'')}</td></tr>`).join('')}</tbody></table></div></section>`:''}
   ${res.message?`<section class="panel"><div class="panel-h"><div><h2>인플루언서에게 보낼 메시지</h2><div class="sub">그대로 복사해 DM·카톡으로 보낼 수 있게 정리했습니다.</div></div><button class="btn sm primary" data-act="revCopy" data-r="${esc(id)}">복사</button></div><pre class="rv-msg">${esc(res.message)}</pre></section>`:''}
   ${(res.structure||[]).length?`<section class="panel"><div class="panel-h"><h2>장면 구성 비교</h2></div><div class="tblwrap"><table class="tbl"><thead><tr><th>장면</th><th>가이드</th><th>실제 영상</th><th>판정</th></tr></thead><tbody>${res.structure.map(x=>`<tr><td class="small bold" style="white-space:nowrap">${esc(x.part||'')}</td><td class="small">${esc(x.expected||'')}</td><td class="small">${esc(x.actual||'')}</td><td>${pill(x.status)}</td></tr>`).join('')}</tbody></table></div></section>`:''}
   ${(res.checks||[]).length?`<section class="panel"><div class="panel-h"><h2>체크리스트</h2><span class="sub">필수 표현·자막·나레이션·표기·금지 표현·촬영 규칙</span></div><div class="tblwrap"><table class="tbl"><thead><tr><th>항목</th><th>판정</th><th>근거 (시간)</th></tr></thead><tbody>${res.checks.map(x=>`<tr><td>${esc(x.item||'')}</td><td>${pill(x.status)}</td><td class="small">${esc(x.evidence||'')}</td></tr>`).join('')}</tbody></table></div></section>`:''}
   <div class="grid2">${res.narration?`<section class="panel"><div class="panel-h"><h2>나레이션 (말한 내용)</h2></div><p class="small" style="white-space:pre-wrap;margin:0">${esc(res.narration)}</p></section>`:''}${res.subtitles?`<section class="panel"><div class="panel-h"><h2>자막 (화면 글자)</h2></div><p class="small" style="white-space:pre-wrap;margin:0">${esc(res.subtitles)}</p></section>`:''}</div>
   <p class="small muted" style="margin:0">AI 검수 결과는 참고용입니다. 캡션·해시태그는 영상만으로 확인할 수 없어, 업로드 후 게시물에서 한 번 더 확인해 주세요.</p></div>`:''}`}
async function revStart(id,data){if(DB.mode==='demo'){setTimeout(()=>DB.update('reviews/'+id,{status:'완료',doneAt:T_NOW(),resultJson:JSON.stringify(mockReview(data))}),1500);return}
  await aiFetch('/api/review',{id,...data})}
function revPayload(g,ci){const G=clone(g);delete G.memo;delete G.links;return {guide:G,concept:ci===''?null:+ci}}
function mockReview(d){return {verdict:'수정 필요',score:78,duration:'0:31',ratio:'9:16',summary:'전체 흐름과 제품 소개는 가이드대로 잘 나왔지만, 첫 3초 후킹이 약하고 필수 키워드 1개가 빠졌어요.',
  fixes:[{priority:'필수',time:'0:00~0:03',what:'첫 장면이 인사로 시작해 후킹이 약해요.',how:'가이드의 후킹 문구로 바로 시작해 주세요.'},{priority:'필수',time:'전체',what:'필수 키워드 「3초 흡수」가 자막·멘트에 없어요.',how:'바디 장면 자막에 「3초 흡수」를 넣어 주세요.'},{priority:'권장',time:'0:24',what:'제품 로고가 좌우 반전되어 보여요.',how:'전면 카메라 좌우 반전을 끄고 다시 찍어 주세요.'}],
  structure:[{part:'인트로',expected:'제품 클로즈업 + 후킹 문구',actual:'인사 후 제품 소개',status:'fix'},{part:'바디',expected:'반쪽 비교',actual:'반쪽 비교 장면 있음',status:'ok'},{part:'아웃트로',expected:'구매 유도 멘트',actual:'구매 유도 멘트 있음',status:'ok'}],
  checks:[{item:'제품명 노출 (화면·말)',status:'ok',evidence:'0:05 "예시 제품"'},{item:'자막 또는 목소리',status:'ok',evidence:'전체 자막'},{item:'필수 키워드: 3초 흡수',status:'miss',evidence:'찾지 못함'},{item:'금지 표현 사용',status:'ok',evidence:'없음'}],
  narration:'안녕하세요! 오늘은 제가 요즘 매일 쓰는 세럼을 소개할게요…',subtitles:'요즘 매일 쓰는 세럼\n반쪽만 발라볼게요\n지금 할인 중',
  message:'안녕하세요! 영상 잘 받았어요 😊 전체 흐름이 정말 좋아요. 업로드 전에 아래 2가지만 수정 부탁드려요.\n\n1. 첫 3초를 후킹 문구로 바로 시작해 주세요.\n2. 바디 자막에 「3초 흡수」를 넣어 주세요.\n\n(선택) 24초 로고 좌우 반전도 바로잡아 주시면 좋아요. 수정본 받으면 바로 확인할게요!'}}
Object.assign(ACT,{
  async revRun(){const gid=($('#rv-g')||{}).value;const g=A.guides&&A.guides[gid];const u=String(($('#rv-u')||{}).value||'').trim();const ci=($('#rv-c')||{}).value||'';const nm=String(($('#rv-n')||{}).value||'').trim();
    if(!g)return toast('기준 가이드를 고르세요.','crit');if(!/^https?:\/\//i.test(u))return toast('영상 링크를 넣어 주세요.','crit');
    const id=uid();const doc={gid,gtitle:g.title||'',concept:ci===''?'':((g.concepts||[])[+ci]||{}).name||'',url:u,infl:nm,status:'대기',createdAt:T_NOW(),by:A.user.email};A.rvBusy=true;render();
    try{await DB.set('reviews/'+id,doc);await revStart(id,{url:u,infl:nm,...revPayload(g,ci)});A.rvOpen=id;toast('검수를 시작했습니다. 1~5분 뒤 결과가 나옵니다.')}catch(e){DB.update('reviews/'+id,{status:'실패',error:String(e.message||e)}).catch(()=>{});toast('검수를 시작하지 못했습니다: '+(e.message||e),'crit')}finally{A.rvBusy=false;render()}},
  revOpen(a){A.rvOpen=a.dataset.r;A.confirm=null;render();window.scrollTo(0,0)},revBack(){A.rvOpen='';render()},
  async revRetry(a){const id=a.dataset.r;const r=A.reviews[id];const g=A.guides&&A.guides[r.gid];if(!g)return toast('기준 가이드가 삭제되어 다시 검수할 수 없습니다.','crit');const ci=r.concept?String((g.concepts||[]).findIndex(c=>c.name===r.concept)):'';
    try{await DB.update('reviews/'+id,{status:'대기',error:DB.DEL,resultJson:DB.DEL,createdAt:T_NOW(),by:A.user.email});await revStart(id,{url:r.url,infl:r.infl,...revPayload(g,ci==='-1'?'':ci)});toast('다시 검수를 시작했습니다.')}catch(e){toast('다시 검수하지 못했습니다: '+(e.message||e),'crit')}},
  async revDel(a){const id=a.dataset.r;if(A.confirm!=='rd'+id){A.confirm='rd'+id;render();return}A.confirm=null;try{await DB.del('reviews/'+id);A.rvOpen='';render();toast('검수 기록을 삭제했습니다.')}catch(e){saveErr(e)}},
  revCopy(a){const r=rvRes(A.reviews[a.dataset.r]);if(r&&r.message){copyText(r.message);toast('메시지를 복사했습니다.')}}
});
document.addEventListener('change',e=>{if(e.target&&e.target.dataset&&e.target.dataset.rvg){A.rvGid=e.target.value;render()}});

/* ============ AI 영상 제작 (기능 틀 · 연동은 비용 결정 후) ============ */
function videoPrompt(g,c){if(!g||!c)return '';const P=g.product||{};
  return [`[영상] ${g.platform||'세로 숏폼'} · ${g.ratio||'9:16'} · ${g.length||'30초'}`,`[제품] ${[g.brand,P.name].filter(Boolean).join(' ')}${P.intro?' — '+P.intro:''}`,`[톤] 밝고 자연스러운 인플루언서 리뷰 · 실사 · 가상 인물(실존 인물 얼굴 사용 금지)`,`[컨셉] ${c.name||''}${c.hook?' / 첫 마디: '+c.hook:''}`,'',
    ...(c.scenes||[]).map((s,i)=>`#${i+1} ${s.part||''} ${s.time||''}\n- 화면: ${s.prompt||s.shot||''}\n- 나레이션: ${s.say||''}\n- 자막: ${s.sub||''}`),'',`[필수] ${((g.text||{}).keywords||[]).join(', ')}`,`[금지] ${(g.words||[]).map(w=>w.no).join(', ')}`].join('\n')}
function viewAiVideo(){ensureToolWatch();const gs=Object.entries(A.guides||{});const gid=A.avGid&&A.guides&&A.guides[A.avGid]?A.avGid:(gs[0]||[])[0]||'';const g=gid?A.guides[gid]:null;const ci=+(A.avC||0);const c=g&&(g.concepts||[])[ci];
  return `<div class="page-h"><div><div class="eyebrow">AI Video</div><h1>AI 영상 제작</h1><div class="sub">콘텐츠 가이드의 장면 구성대로 가상의 AI 영상을 만드는 기능입니다.</div></div><span class="pill warn">연동 준비 중</span></div>
  <div class="banner info" style="margin:0 0 14px"><b>지금은 기능 틀만 준비되어 있습니다.</b> 영상 생성 서비스(예: Google Veo, Runway, Kling)는 영상 1개당 비용이 들어, 비용 기준을 정한 뒤 연결합니다. 그 전까지는 아래 「영상 프롬프트」를 복사해 각 서비스에서 직접 만들어 볼 수 있습니다.</div>
  ${gs.length?`<section class="panel"><div class="fgrid"><label class="f">가이드<select id="av-g" data-avg="1">${gs.map(([id,x])=>`<option value="${id}" ${id===gid?'selected':''}>${esc(x.title||'')}</option>`).join('')}</select></label><label class="f">컨셉<select id="av-c" data-avc="1">${((g&&g.concepts)||[]).map((x,i)=>`<option value="${i}" ${i===ci?'selected':''}>${i+1}. ${esc(x.name||'')}</option>`).join('')}</select></label>
    <label class="f">영상 서비스<select disabled><option>연동 전 — 선택 불가</option><option>Google Veo</option><option>Runway</option><option>Kling</option></select></label></div>
    <label class="f wide" style="margin-top:12px">영상 프롬프트 (장면별)<textarea id="av-p" rows="14" readonly>${esc(videoPrompt(g,c))}</textarea></label>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="avCopy">프롬프트 복사</button><button class="btn primary" disabled title="영상 생성 서비스 연동 후 사용할 수 있습니다">AI 영상 만들기 (연동 후 사용)</button></div></section>`:`<div class="panel empty">먼저 콘텐츠 가이드를 만들어 주세요. <button class="btn sm" data-act="nav" data-v="guides">콘텐츠 가이드</button></div>`}
  <section class="panel" style="margin-top:14px"><div class="panel-h"><h2>연동할 때 필요한 것</h2></div><ol class="steps"><li>서비스 결정 (화질·길이·영상 1개당 비용 비교)</li><li>해당 서비스 API 키 발급·결제 등록</li><li>Netlify 환경변수 <code>AI_VIDEO_PROVIDER</code>, 서비스 키 추가 → 서버 함수 <code>/api/ai</code>의 <code>video</code> 동작 연결</li><li>생성된 영상 저장 위치 결정 (Firebase Storage 사용 시 Blaze 요금제)</li></ol></section>`}
ACT.avCopy=()=>{const t=($('#av-p')||{}).value||'';if(t){copyText(t);toast('영상 프롬프트를 복사했습니다.')}};
document.addEventListener('change',e=>{const d=e.target&&e.target.dataset;if(!d)return;if(d.avg){A.avGid=e.target.value;A.avC=0;render()}else if(d.avc){A.avC=+e.target.value;render()}});

/* ============ 스타일 ============ */
(()=>{const st=document.createElement('style');st.textContent=`
.wz{list-style:none;margin:0 0 16px;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;counter-reset:wz}
.wz li button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);font-weight:600;color:var(--muted)}
.wz li b{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--surface2);font-size:13px;flex:none}
.wz li.on button{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.wz li.on b{background:var(--accent);color:var(--accent-ink)}
.wz li.done button{color:var(--ink2)}.wz li.done b{background:var(--ok-soft);color:var(--ok)}
@media (max-width:720px){.wz{grid-template-columns:repeat(2,1fr)}.wz li button{padding:9px 10px;font-size:12.5px}}
.wtbl input,.wtbl select{padding:6px 8px;font-size:13px}.wsum{grid-template-columns:120px 1fr}.wsum dd{text-align:left;font-weight:500}
.gedit .fgrid.one{grid-template-columns:1fr}
.concept .cnum{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-weight:700;flex:none}
.scenes{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.scene{border:1px solid var(--line);border-radius:12px;background:var(--surface2);overflow:hidden}
.scene-h{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);background:var(--surface)}.scene-h select,.scene-h input{padding:4px 8px;font-size:12.5px}
.scene-b{padding:10px;display:flex;flex-direction:column;gap:10px}.scene-b textarea{font-size:13px}
.scene-img{display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;min-height:120px;border:1px dashed var(--line2,var(--line));border-radius:10px;padding:8px;background:var(--surface)}
.scene-img img{max-width:100%;max-height:220px;border-radius:8px;object-fit:contain}
.ai-box{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.rv-score{display:flex;flex-direction:column;align-items:center;justify-content:center;width:96px;height:96px;border-radius:50%;border:4px solid var(--line);flex:none}.rv-score b{font-size:28px;line-height:1}.rv-score span{font-size:12px;font-weight:600}
.rv-score.ok{border-color:var(--ok);color:var(--ok)}.rv-score.warn{border-color:var(--warn);color:var(--warn)}.rv-score.crit{border-color:var(--crit);color:var(--crit)}
.rv-msg{white-space:pre-wrap;font-family:var(--font);font-size:13.5px;background:var(--surface2);border-radius:10px;padding:12px 14px;margin:0}
`;document.head.appendChild(st)})();
