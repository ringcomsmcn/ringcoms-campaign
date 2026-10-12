/* RINGCOMS 캠페인 관리 · 광고 제안서 장표 (v0.18)
   ringcoms-influencer-proposal 스킬의 build.js 레이아웃을 브라우저로 옮긴 것 — PptxGenJS(PPT)와 PvDeck(미리보기·PDF) 양쪽에 같은 코드로 그립니다.
   - 사용자 PPT 스타일: 가로형 RINGCOMS 로고, 모든 텍스트박스 세로 '중간', 섹션 라벨 자간 표준, 표지 = 브랜드명 → 인플루언서 마케팅 제안서 → 1줄 컨셉 → 예산 pill
   - 배경·그래픽은 무료로 그려서(canvas) 넣음: 도형·그라데이션·물결·점 패턴, 소개서 이미지 합성
   window.PPD 로 내보냄 (proposal.js가 사용) */
(function(){
'use strict';
const W=13.333,H=7.5,MX=0.6;
const F={xb:'Pretendard ExtraBold',b:'Pretendard SemiBold',r:'Pretendard',l:'Pretendard Light'};
const won=n=>Math.round(+n||0).toLocaleString('ko-KR');
const man=n=>{const v=Math.round((+n||0)/1000)/10;return v.toLocaleString('ko-KR')+'만'};
const compactK=n=>n>=10000?(Math.round(n/1000)/10).toLocaleString('ko-KR')+'만':won(n);
const pct=(v,d=1)=>((+v||0)*100).toFixed(d)+'%';

/* ============ 색 ============ */
const hx=v=>{const h=String(v||'').replace('#','').trim().toUpperCase();return /^[0-9A-F]{6}$/.test(h)?h:null};
const rgb=h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
const toHex=c=>c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();
const mix=(h,t,to='FFFFFF')=>{const a=rgb(h),b=rgb(to);return toHex(a.map((v,i)=>v+(b[i]-v)*t))};
const shade=(h,t)=>mix(h,t,'000000');
function lum(h){return rgb(h).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0)}
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
function hsl(h){const [r,g,b]=rgb(h).map(v=>v/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;let s=0,hu=0;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);hu=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);hu*=60}return {h:hu,s,l}}
/* 흰 글씨를 얹는 메인 배경으로 쓸 수 있는지: 대비 2.3 이상(대제목 기준), 형광색(노랑·연두·하늘 계열 고채도 밝은색) 아님 */
function bgOk(h){if(!h)return false;const c=contrast(h,'FFFFFF');const {h:hu,s,l}=hsl(h);const neon=s>0.85&&l>0.5&&hu>=45&&hu<=200;return c>=2.3&&!neon&&l>0.12}
/* 컬러 우선순위: ① 소개서 메인 컬러 → (가독성·화려함 문제면 포인트 컬러로만) ② 로고·CI 컬러를 메인 배경으로 → ③ ①을 어둡게 */
function decideTheme(deckMain,logo,manual){
  const m=hx(manual&&manual.primary);if(m)return themeOf(m,hx(manual.accent)||m,'manual');
  const a=hx(deckMain),b=hx(logo);
  if(a&&bgOk(a))return themeOf(a,a,'deck');
  if(b&&bgOk(b))return themeOf(b,a||b,a?'logo+accent':'logo');
  if(a){let d=a;for(let i=0;i<12&&!bgOk(d);i++)d=shade(d,0.08);return themeOf(d,a,'deck-dark')}
  return themeOf('2F5BEA','2F5BEA','default')}
function themeOf(p,acc,src){const dark='262626';return {primary:p,primaryDark:shade(p,0.12),accent:acc,tint:mix(p,0.9),soft:mix(p,0.75),dark,closing:'404040',muted:'767676',line:'E6E6E6',card:'F5F5F5',onAccentText:contrast(acc,'FFFFFF')>=2.3?'FFFFFF':dark,chart:[acc===p?p:acc,mix(p,0.45),'404040','C9C9C9'],src}}
/* 소개서 쪽 이미지에서 대표 색 뽑기 (채도 있는 색을 색상 구간별로 모아 가장 많이 쓰인 색) */
async function paletteOf(srcs){const bins={};for(const src of (srcs||[]).slice(0,10)){const im=await loadImg(src);if(!im)continue;const cv=document.createElement('canvas');const k=Math.min(1,120/Math.max(im.naturalWidth,im.naturalHeight));cv.width=Math.max(1,im.naturalWidth*k|0);cv.height=Math.max(1,im.naturalHeight*k|0);const x=cv.getContext('2d');x.drawImage(im,0,0,cv.width,cv.height);
    const d=x.getImageData(0,0,cv.width,cv.height).data;for(let i=0;i<d.length;i+=4){const h=toHex([d[i],d[i+1],d[i+2]]);const c=hsl(h);if(c.s<0.35||c.l<0.18||c.l>0.86)continue;const key=Math.round(c.h/15)%24;const o=bins[key]||(bins[key]={n:0,r:0,g:0,b:0});o.n++;o.r+=d[i];o.g+=d[i+1];o.b+=d[i+2]}}
  const best=Object.values(bins).sort((a,b)=>b.n-a.n)[0];return best?toHex([best.r/best.n,best.g/best.n,best.b/best.n]):null}

/* ============ 이미지 도우미 ============ */
const DIM=new Map();
function loadImg(src){return new Promise(r=>{if(!src)return r(null);const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src})}
async function dimsOf(src){if(!src)return null;if(DIM.has(src))return DIM.get(src);const im=await loadImg(src);const d=im?[im.naturalWidth||1,im.naturalHeight||1]:null;DIM.set(src,d);return d}
/* 자르기: box = [ymin,xmin,ymax,xmax] (0~1000) */
async function cropImg(src,box,opt={}){const im=await loadImg(src);if(!im)return null;const [y0,x0,y1,x1]=box.map(v=>Math.max(0,Math.min(1000,+v||0))/1000);const W_=im.naturalWidth,H_=im.naturalHeight;
  const sx=x0*W_,sy=y0*H_,sw=Math.max(4,(x1-x0)*W_),sh=Math.max(4,(y1-y0)*H_);const k=Math.min(1,(opt.max||900)/Math.max(sw,sh));const cv=document.createElement('canvas');cv.width=Math.round(sw*k);cv.height=Math.round(sh*k);const x=cv.getContext('2d');
  if(opt.round){const r=Math.min(cv.width,cv.height)*(opt.round===true?0.08:opt.round);x.beginPath();x.roundRect?x.roundRect(0,0,cv.width,cv.height,r):x.rect(0,0,cv.width,cv.height);x.clip()}
  x.drawImage(im,sx,sy,sw,sh,0,0,cv.width,cv.height);if(opt.cutout)cutout(x,cv.width,cv.height,opt.tol||38);return cv.toDataURL(opt.cutout||opt.round?'image/png':'image/jpeg',0.85)}
/* 누끼: 가장자리에서 이어진 배경색(모서리 색과 비슷한 색)을 투명하게 */
function cutout(x,w,h,tol){const id=x.getImageData(0,0,w,h),d=id.data;const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([a,b])=>{const i=(b*w+a)*4;return [d[i],d[i+1],d[i+2]]});
  const near=(i,c)=>Math.abs(d[i]-c[0])+Math.abs(d[i+1]-c[1])+Math.abs(d[i+2]-c[2])<tol*3;const seen=new Uint8Array(w*h);const st=[];
  for(let a=0;a<w;a++){st.push([a,0],[a,h-1])}for(let b=0;b<h;b++){st.push([0,b],[w-1,b])}
  while(st.length){const [a,b]=st.pop();if(a<0||b<0||a>=w||b>=h)continue;const p=b*w+a;if(seen[p])continue;seen[p]=1;const i=p*4;if(!corners.some(c=>near(i,c)))continue;d[i+3]=0;st.push([a+1,b],[a-1,b],[a,b+1],[a,b-1])}
  x.putImageData(id,0,0)}

/* ============ 무료 그래픽 · 배경 (canvas) ============ */
const GFX_CACHE=new Map();
function cv0(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]}
const css=h=>'#'+h;const rgba=(h,a)=>{const [r,g,b]=rgb(h);return `rgba(${r},${g},${b},${a})`};
/* 배경: kind = cover | divider | closing | body / style = skill | grad | wave | dots | ring | none */
function bgImage(T,kind,style){if(!style||style==='skill'||style==='none')return null;const key=[T.primary,T.accent,kind,style].join('|');if(GFX_CACHE.has(key))return GFX_CACHE.get(key);
  const [c,x]=cv0(1600,900);const color=kind==='body'?null:kind==='closing'?T.closing:T.primary;
  if(color){x.fillStyle=css(color);x.fillRect(0,0,1600,900)}else{x.fillStyle='#fff';x.fillRect(0,0,1600,900)}
  const light=kind==='body';const ink=light?T.primary:'FFFFFF';const A_=light?0.06:0.12;
  if(style==='grad'){const g=x.createLinearGradient(0,0,1600,900);if(light){g.addColorStop(0,rgba(T.primary,0.07));g.addColorStop(0.45,'rgba(255,255,255,0)');g.addColorStop(1,rgba(T.accent,0.08))}else{g.addColorStop(0,rgba(shade(color,0.18),1));g.addColorStop(0.55,rgba(color,1));g.addColorStop(1,rgba(mix(T.accent===T.primary?color:T.accent,0.15),1))}x.fillStyle=g;x.fillRect(0,0,1600,900);
    const r=x.createRadialGradient(1350,120,10,1350,120,700);r.addColorStop(0,rgba(ink,light?0.08:0.18));r.addColorStop(1,rgba(ink,0));x.fillStyle=r;x.fillRect(0,0,1600,900)}
  else if(style==='wave'){for(let k=0;k<4;k++){x.beginPath();const y0=light?760+k*28:520+k*70;x.moveTo(0,y0);for(let i=0;i<=1600;i+=20)x.lineTo(i,y0+Math.sin(i/230+k*0.9)*(light?18:40));x.lineTo(1600,900);x.lineTo(0,900);x.closePath();x.fillStyle=rgba(k%2?T.accent:ink,A_*(light?1:0.9));x.fill()}}
  else if(style==='dots'){x.fillStyle=rgba(ink,light?0.09:0.16);const sx=light?1180:900;for(let i=sx;i<1600;i+=34)for(let j=40;j<(light?360:900);j+=34){if(light&&(i-sx)*0.6+j>620)continue;x.beginPath();x.arc(i,j,light?3.2:4.5,0,7);x.fill()}
    if(!light){x.strokeStyle=rgba('FFFFFF',0.12);x.lineWidth=60;x.beginPath();x.arc(180,860,260,0,7);x.stroke()}}
  else if(style==='ring'){x.lineWidth=light?36:70;x.strokeStyle=rgba(ink,light?0.06:0.13);x.beginPath();x.arc(1360,light?110:420,light?260:360,0,7);x.stroke();x.strokeStyle=rgba(light?T.accent:'FFFFFF',light?0.05:0.09);x.beginPath();x.arc(1560,light?260:520,light?200:330,0,7);x.stroke()}
  const out=c.toDataURL('image/jpeg',0.86);GFX_CACHE.set(key,out);return out}
/* 표지·간지·마지막 장 그래픽(무료): phone(소개서 이미지를 폰 화면에) · badge(브랜드명 원형 엠블럼) · cards(겹친 카드) */
function gfxImage(T,style,brand,src){const key=['g',T.primary,T.accent,style,brand,src?String(src).length:0].join('|');if(GFX_CACHE.has(key))return Promise.resolve(GFX_CACHE.get(key));
  return (async()=>{let out=null;
    if(style==='phone'){const [c,x]=cv0(600,1200);const im=src?await loadImg(src):null;x.fillStyle='#111';rr(x,20,20,560,1160,80);x.fill();x.save();rr(x,48,48,504,1104,58);x.clip();
      if(im){const k=Math.max(504/im.naturalWidth,1104/im.naturalHeight);const w=im.naturalWidth*k,h=im.naturalHeight*k;x.fillStyle='#fff';x.fillRect(48,48,504,1104);x.drawImage(im,48+(504-w)/2,48+(1104-h)/2,w,h)}
      else{const g=x.createLinearGradient(0,48,0,1152);g.addColorStop(0,css(mix(T.primary,0.2)));g.addColorStop(1,css(T.primary));x.fillStyle=g;x.fillRect(48,48,504,1104);x.fillStyle='#fff';x.font='800 64px Pretendard, sans-serif';x.textAlign='center';x.fillText(brand||'',300,620)}
      x.restore();x.fillStyle='#111';rr(x,230,62,140,30,15);x.fill();out=c.toDataURL('image/png')}
    else if(style==='badge'){const [c,x]=cv0(900,900);x.fillStyle=rgba('FFFFFF',0.95);x.beginPath();x.arc(450,450,400,0,7);x.fill();x.lineWidth=26;x.strokeStyle=css(T.accent);x.beginPath();x.arc(450,450,350,0,7);x.stroke();
      x.fillStyle=css(T.primary);x.font=`800 ${Math.min(150,1100/Math.max(4,String(brand||'').length))}px Pretendard, sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(brand||'',450,440);x.fillStyle=css(T.muted||'767676');x.font='300 40px Pretendard, sans-serif';x.fillText('INFLUENCER CAMPAIGN',450,560);out=c.toDataURL('image/png')}
    else if(style==='cards'){const [c,x]=cv0(800,1000);const im=src?await loadImg(src):null;[[130,140,-8,mix(T.primary,0.5)],[160,120,4,mix(T.accent,0.25)]].forEach(([a,b,rot,col])=>{x.save();x.translate(400,500);x.rotate(rot*Math.PI/180);x.translate(-400,-500);x.fillStyle=css(col);rr(x,a,b,520,720,48);x.fill();x.restore()});
      x.save();x.shadowColor='rgba(0,0,0,.25)';x.shadowBlur=40;x.fillStyle='#fff';rr(x,150,170,500,700,44);x.fill();x.restore();x.save();rr(x,170,190,460,660,32);x.clip();
      if(im){const k=Math.max(460/im.naturalWidth,660/im.naturalHeight);x.drawImage(im,170+(460-im.naturalWidth*k)/2,190+(660-im.naturalHeight*k)/2,im.naturalWidth*k,im.naturalHeight*k)}else{x.fillStyle=css(T.tint);x.fillRect(170,190,460,660);x.fillStyle=css(T.primary);x.font='800 70px Pretendard, sans-serif';x.textAlign='center';x.fillText(brand||'',400,540)}
      x.restore();out=c.toDataURL('image/png')}
    GFX_CACHE.set(key,out);return out})()}
function rr(x,a,b,w,h,r){x.beginPath();if(x.roundRect)x.roundRect(a,b,w,h,r);else x.rect(a,b,w,h)}
/* 직접 넣은 배경 이미지를 투명도 처리 (가독성: 본문은 흰색으로, 색 배경 장은 메인 컬러로 덮음) */
async function veilImage(src,T,kind,opacity){const im=await loadImg(src);if(!im)return null;const [c,x]=cv0(1600,900);const k=Math.max(1600/im.naturalWidth,900/im.naturalHeight);x.drawImage(im,(1600-im.naturalWidth*k)/2,(900-im.naturalHeight*k)/2,im.naturalWidth*k,im.naturalHeight*k);
  x.fillStyle=kind==='body'?`rgba(255,255,255,${1-opacity})`:rgba(kind==='closing'?T.closing:T.primary,1-opacity);x.fillRect(0,0,1600,900);return c.toDataURL('image/jpeg',0.84)}

/* ============ 미리보기·PDF용 덱 (PptxGenJS와 같은 호출 방식) ============ */
class PvDeck{
  constructor(){this.slides=[];this.layout='';this.title='';this.shapes={RECTANGLE:'rect',ROUNDED_RECTANGLE:'roundRect',OVAL:'ellipse',LINE:'line'};this.charts={DOUGHNUT:'doughnut',BAR:'bar'};this.ShapeType={rect:'rect',roundRect:'roundRect',ellipse:'ellipse',line:'line'}}
  addSlide(){const s={background:null,els:[],notes:'',addText(t,o){this.els.push(['text',t,o||{}]);return this},addShape(k,o){this.els.push(['shape',k,o||{}]);return this},addImage(o){this.els.push(['img',o||{}]);return this},addChart(k,d,o){this.els.push(['chart',k,d,o||{}]);return this},addNotes(n){this.notes=n;return this}};this.slides.push(s);return s}
  html(){const IN=v=>(+v||0).toFixed(4)+'in';const col=(c,tr)=>{const h=hx(c)||'000000';const a=tr!=null?Math.max(0,1-tr/100):1;const [r,g,b]=rgb(h);return `rgba(${r},${g},${b},${a})`};
    const fw=f=>/ExtraBold/.test(f||'')?800:/SemiBold/.test(f||'')?600:/Light/.test(f||'')?300:400;const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const text=(t,o)=>{const runs=Array.isArray(t)?t:[{text:t,options:{}}];const paras=[{bul:false,parts:[]}];
      runs.forEach(r=>{const ro=r.options||{};if(ro.bullet&&!paras[paras.length-1].parts.length)paras[paras.length-1].bul=true;String(r.text??'').split('\n').forEach((part,i)=>{if(i)paras.push({bul:!!ro.bullet,parts:[]});let st='';if(ro.fontFace||ro.bold)st+=`font-weight:${ro.bold?700:fw(ro.fontFace)};`;if(ro.fontSize)st+=`font-size:${ro.fontSize}pt;`;if(ro.color)st+=`color:${col(ro.color)};`;paras[paras.length-1].parts.push(`<span style="${st}">${E(part)}</span>`)});if(ro.breakLine)paras.push({bul:false,parts:[]})});
      while(paras.length>1&&!paras[paras.length-1].parts.length)paras.pop();const va={middle:'center',bottom:'flex-end'}[o.valign]||'center';const psa=o.paraSpaceAfter?`margin-bottom:${o.paraSpaceAfter}pt;`:'';const lh=o.lineSpacingMultiple?`line-height:${1.2*o.lineSpacingMultiple};`:'';
      return `<div class="dk-t${o.fit==='shrink'?' dk-fit':''}" style="left:${IN(o.x)};top:${IN(o.y)};width:${IN(o.w)};height:${IN(o.h)};justify-content:${va};text-align:${o.align||'left'};font-size:${o.fontSize||18}pt;font-weight:${o.bold?700:fw(o.fontFace)};color:${col(o.color,o.transparency)};${o.charSpacing?`letter-spacing:${o.charSpacing}pt;`:''}${lh}"><div class="dk-in">${paras.map(p=>`<div style="${psa}${p.bul?'padding-left:1.1em;text-indent:-0.8em;':''}">${p.bul?'•&nbsp;':''}${p.parts.join('')||'&nbsp;'}</div>`).join('')}</div></div>`};
    const shape=(k,o)=>{const f=o.fill||{},l=o.line||{};if(k==='line')return `<div class="dk-s" style="left:${IN(o.x)};top:${IN(o.y)};width:${IN(Math.max(o.w,0.001))};height:${IN(Math.max(o.h,0.001))};border-top:${o.h?0:(l.width||1)+'pt '+(l.dashType==='dash'?'dashed':'solid')+' '+col(l.color)};border-left:${o.h&&!o.w?(l.width||1)+'pt '+(l.dashType==='dash'?'dashed':'solid')+' '+col(l.color):'0'}"></div>`;
      return `<div class="dk-s" style="left:${IN(o.x)};top:${IN(o.y)};width:${IN(o.w)};height:${IN(o.h)};background:${f.color?col(f.color,f.transparency):'transparent'};border:${l.width>0?`${l.width}pt solid ${col(l.color,l.transparency)}`:'0'};border-radius:${k==='ellipse'?'50%':k==='roundRect'?IN(o.rectRadius!=null?o.rectRadius:0.1):'0'}"></div>`};
    const img=o=>`<img class="dk-s" src="${E(o.data||o.path||'')}" alt="" style="left:${IN(o.x)};top:${IN(o.y)};width:${IN(o.w)};height:${IN(o.h)};${o.rounding?'border-radius:50%;object-fit:cover;':''}${o.shadow?'filter:drop-shadow(0 4px 10px rgba(0,0,0,.2));':''}${o.transparency?`opacity:${1-o.transparency/100};`:''}">`;
    const chart=(k,d,o)=>{const L=(d[0]||{}).labels||[],V=(d[0]||{}).values||[];const C=o.chartColors||['333333'];const w=o.w*96,h=o.h*96;let svg='';
      if(k==='doughnut'){const tot=V.reduce((a,b)=>a+b,0)||1;const cx=w/2,cy=(h-28)/2,R=Math.min(cx,cy)-4,r=R*(o.holeSize||50)/100;let a0=-Math.PI/2;V.forEach((v,i)=>{const a1=a0+v/tot*Math.PI*2;const lg=a1-a0>Math.PI?1:0;const p=(a,rad)=>[cx+rad*Math.cos(a),cy+rad*Math.sin(a)];const [x1,y1]=p(a0,R),[x2,y2]=p(a1,R),[x3,y3]=p(a1,r),[x4,y4]=p(a0,r);
          svg+=`<path d="M${x1},${y1}A${R},${R} 0 ${lg} 1 ${x2},${y2}L${x3},${y3}A${r},${r} 0 ${lg} 0 ${x4},${y4}Z" fill="#${C[i%C.length]}"/>`;const [tx,ty]=p((a0+a1)/2,(R+r)/2);if(v/tot>0.06)svg+=`<text x="${tx}" y="${ty}" font-size="11" font-weight="600" fill="#fff" text-anchor="middle" dominant-baseline="middle">${Math.round(v/tot*100)}%</text>`;a0=a1});
        svg+=`<g font-size="11" fill="#262626">${L.map((l,i)=>`<rect x="${w/2-L.length*38+i*76}" y="${h-18}" width="9" height="9" fill="#${C[i%C.length]}"/><text x="${w/2-L.length*38+i*76+13}" y="${h-10}">${E(l)}</text>`).join('')}</g>`}
      else{const mx=Math.max(...V,1);const bw=w/V.length;V.forEach((v,i)=>{const bh=(h-46)*v/mx;const x=i*bw+bw*0.2,y=h-24-bh;svg+=`<rect x="${x}" y="${y}" width="${bw*0.6}" height="${bh}" fill="#${C[i%C.length]}"/><text x="${x+bw*0.3}" y="${y-5}" font-size="10" font-weight="600" text-anchor="middle" fill="#262626">${won(v)}</text><text x="${x+bw*0.3}" y="${h-7}" font-size="11" font-weight="600" text-anchor="middle" fill="#262626">${E(L[i])}</text>`})}
      return `<svg class="dk-s" style="left:${IN(o.x)};top:${IN(o.y)};width:${IN(o.w)};height:${IN(o.h)}" viewBox="0 0 ${w} ${h}" font-family="Pretendard,sans-serif">${svg}</svg>`};
    return this.slides.map(sl=>`<section class="dk-page" style="background:${sl.background&&sl.background.color?col(sl.background.color):'#fff'}">${sl.els.map(e=>e[0]==='text'?text(e[1],e[2]):e[0]==='shape'?shape(e[1],e[2]):e[0]==='img'?img(e[1]):chart(e[1],e[2],e[3])).join('')}</section>`)}
  async print(name){const H_=this.html().join('');const D_=new HtmlDeck();D_.html=()=>H_;return D_.print(name)}
}

/* ============ 장표 그리기 (스킬 build.js 이식) ============ */
async function build(deck,D,seq,opts={}){
  const T=D.theme,BR=D.meta.brand;const PDF=deck instanceof PvDeck;
  const SH=deck.shapes||{RECTANGLE:'rect',ROUNDED_RECTANGLE:'roundRect',OVAL:'ellipse',LINE:'line'};const CH=deck.charts||{DOUGHNUT:'doughnut',BAR:'bar'};
  /* 쓰일 이미지 크기 미리 읽기 (그리는 함수는 동기로) */
  const allImgs=[D.assets.heroPhone,D.assets.mascot,D.assets.mascotClosing,D.assets.logoDark,D.assets.logoWhite,...Object.values(D.assets.screens||{}),...Object.values(D.bg||{}),...Object.values(D.guides||{}).flatMap(g=>(g.cuts||[]).map(c=>c.img)),...((D.showcase||{}).people||[]).map(p=>p.img)].filter(Boolean);
  await Promise.all(allImgs.map(dimsOf));
  let pageNo=0;
  const chW=c=>/[가-힣㄰-㆏一-鿿○●→←↑↓·※①-⑳]/.test(c)?0.95:c===' '?0.3:/[A-Z0-9%]/.test(c)?0.62:0.52;
  function estH(text,o){const paras=[];let cur='';
    if(Array.isArray(text)){text.forEach((r,i)=>{cur+=r.text||'';const op=r.options||{};if(op.breakLine||op.bullet||i===text.length-1){paras.push({t:cur,sz:op.fontSize||o.fontSize||12,bullet:!!op.bullet});cur=''}})}
    else String(text).split('\n').forEach(t=>paras.push({t,sz:o.fontSize||12}));
    const ls=o.lineSpacingMultiple||1;let h=0;paras.forEach((p,i)=>{p.t.split('\n').forEach(seg=>{const avail=Math.max(0.3,o.w-(p.bullet?0.3:0))*72;const wid=[...seg].reduce((a,c)=>a+chW(c)*p.sz*(1+(o.charSpacing||0)*0.05),0);const lines=Math.max(1,Math.ceil(wid/avail-0.02));h+=lines*p.sz*1.2*ls/72});if(i<paras.length-1)h+=(o.paraSpaceAfter||0)/72});return h}
  const txt=(slide,text,o)=>{if(text==null||text==='')return;const opt={isTextBox:true,margin:0,fontFace:F.r,color:T.dark,valign:'top',...o};
    if(opt.valign!=='middle'&&opt.h&&opt.w){const e=estH(text,opt);if(e<opt.h){if(opt.valign==='bottom')opt.y=opt.y+opt.h-e;opt.h=e}}opt.valign='middle';if(PDF&&/ExtraBold|SemiBold/.test(opt.fontFace))opt.bold=false;return slide.addText(text,opt)};
  function fitImg(slide,src,x,y,maxW,maxH,opt={}){if(!src)return null;const s=DIM.get(src);if(!s)return null;const r=Math.min(maxW/s[0],maxH/s[1]);const w=s[0]*r,h=s[1]*r;
    const ax=opt.align==='right'?x+maxW-w:opt.align==='center'?x+(maxW-w)/2:x;const ay=opt.valign==='bottom'?y+maxH-h:opt.valign==='middle'?y+(maxH-h)/2:y;
    slide.addImage({data:src,x:ax,y:ay,w,h,...(opt.rounding?{rounding:true}:{}),...(opt.shadow?{shadow:{type:'outer',color:'000000',opacity:0.18,blur:12,offset:4,angle:90}}:{})});return {x:ax,y:ay,w,h}}
  const logo=(slide,dark,at)=>{const src=dark?D.assets.logoWhite:D.assets.logoDark;const h=0.39,w=dark?1.38:1.22;const p=at||{x:dark?11.68:11.77,y:0.46};if(src)slide.addImage({data:src,x:p.x,y:p.y,w,h});else txt(slide,'RINGCOMS',{x:p.x-0.3,y:p.y,w:w+0.3,h,fontFace:F.xb,fontSize:14,color:dark?'FFFFFF':T.primary,align:'right',valign:'middle'})};
  const pnum=(slide,dark)=>txt(slide,String(pageNo).padStart(2,'0'),{x:W-MX-0.6,y:H-0.45,w:0.6,h:0.25,fontSize:9,color:dark?'FFFFFF':'AAAAAA',align:'right'});
  const bgPaint=(slide,kind,color)=>{slide.background={color};const b=D.bg&&D.bg[kind];if(b)slide.addImage({data:b,x:0,y:0,w:W,h:H});return !!b};
  function header(slide,eyebrow,title,sub,opt={}){pageNo++;bgPaint(slide,'body',opt.bg||'FFFFFF');logo(slide,false);
    txt(slide,eyebrow,{x:MX,y:0.5,w:8,h:0.3,fontFace:F.b,fontSize:11,color:T.primary});
    txt(slide,title,{x:MX,y:0.88,w:opt.titleW||9.6,h:1.25,valign:'bottom',fontFace:F.xb,fontSize:28,color:T.dark,lineSpacingMultiple:1.1});
    if(sub)txt(slide,sub,{x:MX,y:2.27,w:opt.subW||11,h:0.62,fontFace:F.l,fontSize:13.5,color:T.muted,lineSpacingMultiple:1.15});pnum(slide,false)}
  const source=(slide,s)=>{if(s)txt(slide,s,{x:MX,y:H-0.45,w:11,h:0.25,fontSize:9,color:'A0A0A0'})};
  const card=(slide,x,y,w,h,color,opt={})=>slide.addShape(SH.ROUNDED_RECTANGLE,{x,y,w,h,rectRadius:opt.r??0.18,fill:{color},line:{color:opt.line||color,width:opt.line?1:0}});
  const pill=(slide,text,x,y,w,color,tcolor,size=11,h=0.34)=>{slide.addShape(SH.ROUNDED_RECTANGLE,{x,y,w,h,rectRadius:h/2,fill:{color},line:{color,width:0}});txt(slide,text,{x,y,w,h,fontFace:F.b,fontSize:size,color:tcolor,align:'center',valign:'middle'})};
  const circles=(slide,color,transp)=>{[[3.6,-2.4,4.6],[-1.6,5.0,4.2],[10.6,5.3,4.4]].forEach(([x,y,d])=>slide.addShape(SH.OVAL,{x,y,w:d,h:d,fill:{color,transparency:transp},line:{color,width:0,transparency:100}}))};
  const colorBg=(slide,kind,color,transp)=>{if(!bgPaint(slide,kind,color))circles(slide,'FFFFFF',transp)};
  const line=(slide,x,y,w,h,color,width=1,dash)=>slide.addShape(SH.LINE,{x,y,w,h,line:{color,width,...(dash?{dashType:'dash'}:{})}});
  const SEC0={market:'01',direction:'02',capability:'03',concept:'04',strategy:'05',exec:'06',timeline:'07'};let secNo=0;
  const SEC=opts.perSlideNo?new Proxy({},{get:()=>String(secNo).padStart(2,'0')}):SEC0;
  const K=D.K,B=D.budget,G=Object.fromEntries(D.categories.groups.map(g=>[g.key,g]));
  const S={
    cover(s){pageNo++;colorBg(s,'cover',T.primary,86);logo(s,true);
      txt(s,D.cover.eyebrow,{x:0.8,y:1.0,w:7,h:0.3,fontSize:12,color:'FFFFFF',charSpacing:5});
      txt(s,BR,{x:0.8,y:1.55,w:7.6,h:0.7,fontFace:F.xb,fontSize:30,color:'FFFFFF'});
      txt(s,D.cover.headline,{x:0.8,y:2.14,w:7.6,h:1.4,fontFace:F.xb,fontSize:D.cover.headlineSize||44,color:'FFFFFF'});
      if(D.cover.tagline)txt(s,D.cover.tagline,{x:0.8,y:3.55,w:7.9,h:1.0,fontFace:F.xb,fontSize:28,color:'FFFFFF',valign:'top'});
      pill(s,D.cover.budgetLine,0.8,4.65,4.3,'FFFFFF',T.primaryDark,12);
      txt(s,`${D.meta.date}  ·  RINGCOMS MCN 광고콘텐츠팀`,{x:0.8,y:6.75,w:7,h:0.3,fontSize:11,color:'FFFFFF'});
      fitImg(s,D.assets.heroPhone,9.12,1.0,2.95,6.0,{align:'center',valign:'middle',shadow:true})},
    toc(s){pageNo++;bgPaint(s,'body','FFFFFF');logo(s,false);
      txt(s,'CONTENTS',{x:MX,y:0.5,w:4,h:0.3,fontFace:F.b,fontSize:11,color:T.primary});
      txt(s,'목차',{x:MX,y:0.88,w:4,h:0.8,fontFace:F.xb,fontSize:36,color:T.primary});
      fitImg(s,D.assets.mascot,0.9,3.3,3.2,3.6,{valign:'bottom'});
      D.toc.forEach((t,i)=>{const y=1.2+i*0.68;line(s,6.0,y,6.7,0,T.line);txt(s,String(i+1).padStart(2,'0'),{x:6.15,y:y+0.2,w:0.6,h:0.3,fontFace:F.b,fontSize:13,color:T.primary});txt(s,t,{x:6.95,y:y+0.15,w:5.7,h:0.4,fontFace:F.b,fontSize:17,color:T.dark})});
      line(s,6.0,1.2+D.toc.length*0.68,6.7,0,T.line)},
    market1(s){const m=D.market;header(s,`${SEC.market} · MARKET`,m.title,m.sub);const st=m.stats||[];const n=Math.max(1,st.length),gap=0.3,cw=(W-2*MX-gap*(n-1))/n;
      st.forEach((x,i)=>{const X=MX+i*(cw+gap),y=3.3,on=i===0;card(s,X,y,cw,3.2,on?T.primary:T.card);
        txt(s,x.label,{x:X+0.3,y:y+0.32,w:cw-0.6,h:0.35,fontFace:F.b,fontSize:14,color:on?'FFFFFF':T.dark});
        txt(s,[{text:String(x.value||''),options:{fontFace:F.xb,fontSize:34,color:on?'FFFFFF':T.primary}},{text:x.unit?' '+x.unit:'',options:{fontFace:F.b,fontSize:18,color:on?'FFFFFF':T.primary}}],{x:X+0.3,y:y+1.0,w:cw-0.6,h:0.95,valign:'middle'});
        txt(s,x.desc,{x:X+0.3,y:y+2.1,w:cw-0.6,h:0.85,fontFace:F.l,fontSize:13,color:on?'FFFFFF':T.muted,lineSpacingMultiple:1.15})});source(s,m.source)},
    market2(s){const m=D.market;header(s,`${SEC.market} · MARKET`,m.title2,m.sub2);
      (m.insights||[]).forEach((it,i)=>{const x=MX,y=3.1+i*1.08;card(s,x,y,8.35,0.95,T.card);txt(s,it.kicker,{x:x+0.3,y:y+0.16,w:1.6,h:0.28,fontFace:F.b,fontSize:11,color:T.muted});txt(s,it.value,{x:x+0.3,y:y+0.42,w:1.8,h:0.4,fontFace:F.xb,fontSize:20,color:T.primary});txt(s,it.text,{x:x+2.15,y:y+0.1,w:6.05,h:0.75,fontSize:11.5,color:T.dark,valign:'middle',lineSpacingMultiple:1.15})});
      card(s,9.25,3.1,W-MX-9.25,3.11,T.primary);txt(s,'INSIGHT',{x:9.55,y:3.35,w:3,h:0.3,fontFace:F.b,fontSize:11,color:'FFFFFF',charSpacing:3});txt(s,m.takeaway,{x:9.55,y:3.75,w:W-MX-9.85,h:2.3,fontFace:F.b,fontSize:14,color:'FFFFFF',lineSpacingMultiple:1.2});source(s,m.source2)},
    direction(s){const d=D.direction;header(s,`${SEC.direction} · ${String(BR).toUpperCase()} DIRECTION`,d.title,d.sub,{subW:9.3});
      fitImg(s,D.assets.screens[d.screen],10.25,1.05,2.45,4.55,{align:'center',shadow:true});
      (d.shifts||[]).forEach((sh,i)=>{const y=3.15+i*0.86;txt(s,sh.from,{x:MX,y:y+0.12,w:1.7,h:0.4,fontFace:F.l,fontSize:16,color:T.muted});txt(s,'→',{x:MX+1.75,y:y+0.1,w:0.4,h:0.4,fontFace:F.b,fontSize:18,color:T.primary});pill(s,sh.to,MX+2.25,y+0.12,1.85,T.tint,T.primaryDark,13);txt(s,sh.desc,{x:MX+4.35,y:y+0.12,w:5.1,h:0.4,fontSize:13,color:T.dark,valign:'middle'})});
      card(s,MX,5.95,W-2*MX,0.85,T.dark);txt(s,d.positioning,{x:MX+0.35,y:5.95,w:W-2*MX-0.7,h:0.85,fontFace:F.xb,fontSize:18,color:'FFFFFF',valign:'middle'})},
    capability(s){const c=D.capability;header(s,`${SEC.capability} · RINGCOMS CAPABILITY`,c.title,c.sub);const gap=0.25,cw=(W-2*MX-gap*3)/4;
      c.cards.forEach((cd,i)=>{const x=MX+i*(cw+gap),y=3.05;card(s,x,y,cw,2.45,T.card);txt(s,String(i+1).padStart(2,'0'),{x:x+0.28,y:y+0.22,w:1,h:0.35,fontFace:F.xb,fontSize:18,color:T.primary});txt(s,cd.title,{x:x+0.28,y:y+0.6,w:cw-0.5,h:0.4,fontFace:F.xb,fontSize:15,color:T.dark});txt(s,cd.text,{x:x+0.28,y:y+1.05,w:cw-0.45,h:1.3,fontSize:11,color:T.muted,lineSpacingMultiple:1.12})});
      card(s,MX,5.68,W-2*MX,1.2,T.tint);pill(s,c.refTitle,MX+0.3,5.82,2.45,T.primary,'FFFFFF',11,0.32);txt(s,c.refName,{x:MX+0.3,y:6.24,w:4.2,h:0.3,fontFace:F.b,fontSize:13,color:T.dark});txt(s,c.refNote,{x:MX+0.3,y:6.53,w:4.2,h:0.25,fontSize:10,color:T.muted});
      c.refStats.forEach((st,i)=>{const x=5.25+i*1.85;txt(s,st.label,{x,y:5.85,w:1.75,h:0.3,fontSize:11,color:T.muted});txt(s,st.value,{x,y:6.15,w:1.75,h:0.55,fontFace:F.xb,fontSize:22,color:i===0?T.dark:T.primaryDark})})},
    umbrella(s){const u=D.umbrella;pageNo++;colorBg(s,'divider',T.primary,88);logo(s,true);
      txt(s,`${SEC.concept} · ${u.eyebrow}`,{x:MX,y:0.5,w:6,h:0.3,fontFace:F.b,fontSize:11,color:'FFFFFF'});
      txt(s,u.name,{x:MX,y:0.95,w:9,h:1.6,fontFace:F.xb,fontSize:44,color:'FFFFFF',valign:'bottom',lineSpacingMultiple:1.05});
      txt(s,u.sub,{x:MX,y:2.7,w:11.5,h:0.65,fontFace:F.l,fontSize:14,color:'FFFFFF',lineSpacingMultiple:1.15});const gap=0.3,cw=(W-2*MX-gap*2)/3;
      u.items.forEach((it,i)=>{const x=MX+i*(cw+gap),y=3.65;const g=G[it.group]||{};card(s,x,y,cw,2.95,'FFFFFF');pill(s,it.group,x+0.3,y+0.3,0.42,T.primary,'FFFFFF',12);
        txt(s,`${g.name||''} · ${g.pillar||''}`,{x:x+0.82,y:y+0.3,w:cw-1.0,h:0.34,fontFace:F.b,fontSize:12,color:T.primaryDark,valign:'middle'});
        txt(s,it.name,{x:x+0.3,y:y+0.85,w:cw-0.5,h:0.8,fontFace:F.xb,fontSize:20,color:T.dark,valign:'middle'});
        txt(s,(it.hashtags||[]).join('  '),{x:x+0.3,y:y+1.7,w:cw-0.5,h:0.3,fontFace:F.b,fontSize:12,color:T.primary});
        txt(s,it.line,{x:x+0.3,y:y+2.05,w:cw-0.5,h:0.7,fontSize:12,color:T.muted,lineSpacingMultiple:1.15})});pnum(s,true)},
    groupConcept(s,k){const c=D.groupConcepts[k]||{};const g=G[k]||{};pageNo++;colorBg(s,'divider',T.primary,88);logo(s,true);const two=String(c.name||'').includes('\n');const hl=mix(T.primary,0.72);
      txt(s,`${SEC.strategy} · GROUP ${k} CONCEPT`,{x:MX,y:0.5,w:6,h:0.3,fontFace:F.b,fontSize:11,color:'FFFFFF'});
      pill(s,`${k} · ${g.name||''}`,MX,1.0,2.9,'FFFFFF',T.primaryDark,13);
      txt(s,c.name,{x:MX,y:1.5,w:8.4,h:1.35,fontFace:F.xb,fontSize:two?36:48,color:'FFFFFF',valign:'top',lineSpacingMultiple:1.05});
      txt(s,(c.hashtags||[]).join('   '),{x:MX,y:two?3.0:2.55,w:8,h:0.35,fontFace:F.b,fontSize:15,color:hl});
      txt(s,(c.story||[]).join('\n'),{x:MX,y:3.5,w:8.2,h:1.75,fontFace:F.l,fontSize:16,color:'FFFFFF',lineSpacingMultiple:1.3});
      txt(s,'KEY MESSAGE',{x:MX,y:5.4,w:3,h:0.3,fontFace:F.b,fontSize:10,color:hl,charSpacing:3});
      txt(s,c.keyMessage,{x:MX,y:5.7,w:8.4,h:0.55,fontFace:F.xb,fontSize:21,color:'FFFFFF'});
      txt(s,'보여줄 기능 · '+(c.features||''),{x:MX,y:6.4,w:8.4,h:0.3,fontFace:F.b,fontSize:12,color:'FFFFFF'});
      fitImg(s,D.dividerImg||D.assets.screens[c.screen],9.3,1.1,3.3,5.7,{align:'center',valign:'middle',shadow:true});pnum(s,true)},
    guide(s,k){const gd=D.guides[k]||{cuts:[],must:[],dont:[]};header(s,`${SEC.strategy} · GROUP ${k} CONTENT GUIDE`,gd.title,gd.sub);const n=Math.max(1,gd.cuts.length),gap=0.2,cw=(W-2*MX-gap*(n-1))/n,y=2.98,ch=2.45;
      gd.cuts.forEach((c,i)=>{const x=MX+i*(cw+gap);const on=i===2;card(s,x,y,cw,ch,on?T.tint:T.card);
        txt(s,[{text:`CUT ${i+1}  `,options:{fontFace:F.xb,color:T.primary}},{text:`${c.step||''} · ${c.time||''}`,options:{fontFace:F.b,color:T.dark}}],{x:x+0.18,y:y+0.16,w:cw-0.3,h:0.3,fontSize:11});
        const im=c.img||D.assets.screens[c.screen];let tx=x+0.18,tw=cw-0.3;
        if(im){const ph=1.72,pw=ph*9/16;if(c.img){const d_=DIM.get(c.img);const k_=d_?Math.max(pw/d_[0],ph/d_[1]):1;s.addImage({data:c.img,x:x+0.18+(0.92-pw)/2,y:y+0.55,w:pw,h:ph,...(PDF?{}:{sizing:{type:'cover',w:pw,h:ph}})})}else fitImg(s,im,x+0.18,y+0.55,0.92,1.72,{align:'center',valign:'middle'});tx=x+1.2;tw=cw-1.3}
        txt(s,'화면',{x:tx,y:y+0.55,w:tw,h:0.22,fontFace:F.b,fontSize:9,color:T.muted});txt(s,c.scene,{x:tx,y:y+0.77,w:tw,h:0.6,fontSize:10,color:T.dark,lineSpacingMultiple:1.05});
        txt(s,'멘션 · 자막',{x:tx,y:y+1.45,w:tw,h:0.22,fontFace:F.b,fontSize:9,color:T.muted});txt(s,c.line,{x:tx,y:y+1.67,w:tw,h:0.62,fontFace:F.b,fontSize:10,color:T.primaryDark,lineSpacingMultiple:1.05})});
      const by=y+ch+0.2,bh=7.05-by;card(s,MX,by,5.9,bh,'FFFFFF',{line:T.line});txt(s,'캡션 예시',{x:MX+0.25,y:by+0.15,w:3,h:0.25,fontFace:F.b,fontSize:11,color:T.primary});txt(s,gd.caption,{x:MX+0.25,y:by+0.45,w:5.45,h:bh-0.55,fontSize:10.5,color:T.dark,lineSpacingMultiple:1.12});
      const bw=(W-2*MX-5.9-0.4)/2;[['MUST',gd.must,T.primary],["DON'T",gd.dont,'404040']].forEach(([h,items,col],j)=>{const x=MX+5.9+0.2+j*(bw+0.2);card(s,x,by,bw,bh,T.card);txt(s,h,{x:x+0.25,y:by+0.15,w:2,h:0.25,fontFace:F.xb,fontSize:11,color:col});
        const L_=(items||[]).filter(Boolean);if(L_.length)txt(s,L_.map((it,i)=>({text:it,options:{bullet:true,breakLine:i<L_.length-1}})),{x:x+0.25,y:by+0.45,w:bw-0.4,h:bh-0.55,fontSize:10.5,color:T.dark,paraSpaceAfter:4})})},
    features(s){const f=D.features;header(s,`${SEC.strategy} · CORE STRATEGY`,f.title,f.sub);const gap=0.3,cw=(W-2*MX-gap*2)/3;
      f.cols.forEach((c,i)=>{const x=MX+i*(cw+gap),y=3.0;const g=G[c.group]||{};card(s,x,y,cw,3.95,T.card);pill(s,c.group,x+0.25,y+0.25,0.42,T.primary,'FFFFFF',12);
        txt(s,g.name,{x:x+0.77,y:y+0.2,w:cw-0.9,h:0.25,fontFace:F.b,fontSize:10.5,color:T.muted});txt(s,(g.pillar||'')+' 기능',{x:x+0.77,y:y+0.42,w:cw-0.9,h:0.32,fontFace:F.xb,fontSize:16,color:T.dark});
        const r_=fitImg(s,D.assets.screens[c.screen],x+cw-1.45,y+0.9,1.2,2.15,{align:'center',valign:'middle'});const tw=r_?cw-1.75:cw-0.5;
        (c.items||[]).forEach(([nm,ds],j)=>{const yy=y+0.95+j*0.7;txt(s,nm,{x:x+0.25,y:yy,w:tw,h:0.3,fontFace:F.xb,fontSize:13,color:T.primaryDark});txt(s,ds,{x:x+0.25,y:yy+0.3,w:tw,h:0.3,fontSize:10.5,color:T.dark})});
        card(s,x+0.2,y+3.12,cw-0.4,0.68,'FFFFFF',{r:0.12});txt(s,c.effect,{x:x+0.35,y:y+3.12,w:cw-0.7,h:0.68,fontFace:F.b,fontSize:11,color:T.dark,valign:'middle',lineSpacingMultiple:1.1})})},
    categories(s){const c=D.categories;header(s,`${SEC.exec} · INFLUENCER CATEGORY`,c.title,c.sub);const cols=[['그룹',2.3],['어떤 인플루언서',3.2],['역할',2.9],['콘텐츠',2.1],['기대 효과',1.63]];let x=MX;const y0=3.0;
      cols.forEach(([h,w])=>{txt(s,h,{x:x+0.1,y:y0,w:w-0.2,h:0.3,fontFace:F.b,fontSize:11,color:T.muted});x+=w});
      c.groups.forEach((g,i)=>{const y=y0+0.38+i*1.2;card(s,MX,y,W-2*MX,1.08,i%2?'FFFFFF':T.card,{line:i%2?T.line:null,r:0.12});pill(s,g.key,MX+0.15,y+0.17,0.42,T.primary,'FFFFFF',12);
        txt(s,g.name,{x:MX+0.7,y:y+0.15,w:1.6,h:0.4,fontFace:F.xb,fontSize:15,color:T.dark});txt(s,g.pillar,{x:MX+0.7,y:y+0.58,w:1.5,h:0.3,fontFace:F.b,fontSize:10,color:T.primaryDark});let cx=MX+cols[0][1];
        [g.who,g.role,g.content,g.effect].forEach((v,k)=>{const w=cols[k+1][1];txt(s,v,{x:cx+0.1,y:y+0.08,w:w-0.2,h:0.92,fontSize:11,color:k===1?T.dark:T.muted,fontFace:k===1?F.b:F.r,valign:'middle',lineSpacingMultiple:1.12});cx+=w})})},
    tiers(s){const t=D.tiers;header(s,`${SEC.exec} · TIER MIX & BUDGET`,t.title,t.sub);const cols=[['티어',1.0],['팔로워',1.25],['인원',0.7],['1인 단가',1.05],['소계',1.0],['역할',0.8],['이유',2.4]];const tx=MX,y0=3.0;let x=tx;
      cols.forEach(([h,w],k)=>{txt(s,h,{x:x+0.08,y:y0,w:w-0.16,h:0.3,fontFace:F.b,fontSize:11,color:T.muted,align:k>=2&&k<=4?'right':'left'});x+=w});const tw=cols.reduce((a,c)=>a+c[1],0);
      t.rows.forEach((r,i)=>{const y=y0+0.38+i*0.66;const off=r.count===0;line(s,tx,y,tw,0,T.line);const vals=[r.tier,r.range,off?'-':r.count+'명',off?'-':man(r.unit),off?'-':man(r.count*r.unit),r.role,r.why];let cx=tx;
        vals.forEach((v,k)=>{const w=cols[k][1];txt(s,v,{x:cx+0.08,y:y+0.05,w:w-0.16,h:0.56,fontFace:k===0||k===5||k===4?F.b:F.r,fontSize:k===6?10.5:13,color:off?'AAAAAA':(k===6?T.muted:k===5?T.primaryDark:T.dark),align:k>=2&&k<=4?'right':'left',valign:'middle',lineSpacingMultiple:1.1});cx+=w})});
      const yT=y0+0.38+t.rows.length*0.66;line(s,tx,yT,tw,0,T.dark,1.25);
      txt(s,`인플루언서 ${K.people}명 · 광고비 ${man(K.ad)}원 + 대행수수료 ${B.feeRatePct}% ${man(K.fee)}원 = 총 ${man(K.total)}원 (VAT 별도)`,{x:tx+0.08,y:yT+0.1,w:8.4,h:0.3,fontFace:F.b,fontSize:11,color:T.dark});
      if(t.refLine){card(s,tx,yT+0.5,tw,0.42,T.tint,{r:0.1});txt(s,t.refLine,{x:tx+0.2,y:yT+0.5,w:tw-0.4,h:0.42,fontFace:F.b,fontSize:11,color:T.primaryDark,valign:'middle'})}
      const used=t.rows.filter(r=>r.count>0);card(s,9.25,3.0,W-MX-9.25,3.85,T.card);txt(s,'광고비 티어별 비중',{x:9.5,y:3.18,w:3,h:0.3,fontFace:F.b,fontSize:12,color:T.dark});
      if(used.length)s.addChart(CH.DOUGHNUT,[{name:'광고비',labels:used.map(r=>r.tier),values:used.map(r=>r.count*r.unit)}],{x:9.4,y:3.5,w:W-MX-9.55,h:2.6,holeSize:58,chartColors:T.chart.slice(0,used.length),showLegend:true,legendPos:'b',legendFontSize:10,legendFontFace:F.r,legendColor:T.dark,showPercent:true,showValue:false,dataLabelColor:'FFFFFF',dataLabelFontSize:10,dataLabelFontFace:F.b});
      txt(s,used.map(r=>`${r.tier} ${Math.round(r.count*r.unit/(K.ad||1)*100)}%`).join(' · '),{x:9.4,y:6.25,w:W-MX-9.55,h:0.4,fontSize:10,color:T.muted,align:'center'})},
    matrix(s){const m=D.matrix;header(s,`${SEC.exec} · CATEGORY × TIER`,m.title,m.sub);const unit=Object.fromEntries(D.tiers.rows.map(r=>[r.tier,r.unit]));const x0=MX,y0=3.0,gw=2.7,cw=Math.min(1.75,(7.25-0.12*m.cols.length)/Math.max(1,m.cols.length)),rh=0.98;
      m.cols.forEach((c,j)=>{card(s,x0+gw+j*(cw+0.12),y0,cw,0.5,T.dark,{r:0.1});txt(s,c,{x:x0+gw+j*(cw+0.12),y:y0,w:cw,h:0.5,fontFace:F.b,fontSize:13,color:'FFFFFF',align:'center',valign:'middle'})});
      const sumX=x0+gw+m.cols.length*(cw+0.12);card(s,sumX,y0,1.55,0.5,T.primary,{r:0.1});txt(s,'합계',{x:sumX,y:y0,w:1.55,h:0.5,fontFace:F.b,fontSize:13,color:'FFFFFF',align:'center',valign:'middle'});let grand=0,grandB=0;
      m.rows.forEach((r,i)=>{const y=y0+0.62+i*(rh+0.1);const g=G[r.group]||{};card(s,x0,y,gw-0.12,rh,T.tint,{r:0.1});txt(s,`${g.key}  ${g.name||''}`,{x:x0+0.2,y:y+0.14,w:gw-0.4,h:0.4,fontFace:F.xb,fontSize:15,color:T.dark});txt(s,g.pillar,{x:x0+0.2,y:y+0.55,w:gw-0.4,h:0.3,fontFace:F.b,fontSize:10,color:T.primaryDark});let rowN=0,rowB=0;
        r.counts.forEach((n,j)=>{const x=x0+gw+j*(cw+0.12);const b=n*(unit[m.cols[j]]||0);rowN+=n;rowB+=b;card(s,x,y,cw,rh,n?T.card:'FFFFFF',{r:0.1,line:n?null:T.line});txt(s,n?`${n}명`:'-',{x,y:y+0.12,w:cw,h:0.45,fontFace:F.xb,fontSize:20,color:n?T.dark:'BBBBBB',align:'center'});if(n)txt(s,`${man(b)}원`,{x,y:y+0.58,w:cw,h:0.3,fontSize:11,color:T.muted,align:'center'})});
        grand+=rowN;grandB+=rowB;card(s,sumX,y,1.55,rh,T.card,{r:0.1});txt(s,`${rowN}명`,{x:sumX,y:y+0.12,w:1.55,h:0.45,fontFace:F.xb,fontSize:20,color:T.primary,align:'center'});txt(s,`${man(rowB)}원`,{x:sumX,y:y+0.58,w:1.55,h:0.3,fontSize:11,color:T.muted,align:'center'})});
      const yS=y0+0.62+m.rows.length*(rh+0.1)+0.05;txt(s,`총 ${grand}명 · 광고비 ${man(grandB)}원 + 대행수수료 ${man(K.fee)}원 = 총 ${man(K.total)}원 (VAT 별도)`,{x:x0+gw,y:yS,w:7.4,h:0.4,fontFace:F.b,fontSize:12,color:T.dark});
      const sx=Math.max(10.55,sumX+1.7);card(s,sx,y0,W-MX-sx,3.95,T.dark);txt(s,'구성 포인트',{x:sx+0.25,y:y0+0.25,w:1.8,h:0.3,fontFace:F.b,fontSize:12,color:mix(T.primary,0.35)});txt(s,(m.points||[]).join('\n\n'),{x:sx+0.25,y:y0+0.65,w:W-MX-sx-0.4,h:3.1,fontSize:11,color:'FFFFFF',lineSpacingMultiple:1.15})},
    showcase(s){const sc=D.showcase;header(s,`${SEC.exec} · INFLUENCER SHORTLIST`,sc.title,sc.sub);const groups=['A','B','C'].filter(k=>sc.people.some(p=>p.group===k));const gap=0.25,cw=(W-2*MX-gap*(Math.max(1,groups.length)-1))/Math.max(1,groups.length);
      groups.forEach((gk,gi)=>{const x=MX+gi*(cw+gap);const g=G[gk]||{};pill(s,gk,x,2.98,0.42,T.primary,'FFFFFF',12);txt(s,`${g.name||''} · ${g.pillar||''}`,{x:x+0.52,y:2.98,w:cw-0.6,h:0.34,fontFace:F.xb,fontSize:13,color:T.dark,valign:'middle'});
        const ps=sc.people.filter(p=>p.group===gk).slice(0,4);const big=ps.length<=2;const ch=big?1.66:0.8,st=big?1.78:0.86,av=big?0.78:0.56;
        ps.forEach((p,pi)=>{const y=3.45+pi*st;card(s,x,y,cw,ch,p.persona?'FFFFFF':T.card,p.persona?{line:T.tint}:{});const ax=x+(big?0.2:0.12),ay=y+(big?0.18:0.12);
          if(p.img)s.addImage({data:p.img,x:ax,y:ay,w:av,h:av,rounding:true});else{slideCircle(s,ax,ay,av,p.persona?T.tint:[T.primary,T.primaryDark,mix(T.primary,0.35)][pi%3]);txt(s,p.persona?'?':String(p.name||'?').trim().slice(0,1),{x:ax,y:ay,w:av,h:av,fontFace:F.xb,fontSize:big?22:16,color:p.persona?T.primaryDark:'FFFFFF',align:'center',valign:'middle'})}
          const tx=ax+av+0.12,tw=x+cw-tx-0.1;
          if(big){txt(s,p.name,{x:tx,y:y+0.16,w:tw,h:0.3,fontFace:F.xb,fontSize:12.5,color:T.dark,fit:'shrink'});txt(s,p.sub,{x:tx,y:y+0.46,w:tw,h:0.25,fontSize:10.5,color:T.muted});if(p.tier)pill(s,p.tier,tx,y+0.73,0.78,T.tint,T.primaryDark,9.5,0.26);txt(s,p.stat,{x:tx+(p.tier?0.85:0),y:y+0.73,w:tw-(p.tier?0.85:0),h:0.26,fontFace:F.b,fontSize:10.5,color:T.dark,valign:'middle'});txt(s,p.why,{x:x+0.2,y:y+1.07,w:cw-0.35,h:0.55,fontSize:10,color:T.muted,lineSpacingMultiple:1.05})}
          else{txt(s,p.name,{x:tx,y:y+0.06,w:tw,h:0.26,fontFace:F.xb,fontSize:11,color:T.dark});txt(s,p.sub,{x:tx,y:y+0.31,w:tw,h:0.2,fontSize:8.5,color:T.muted});txt(s,[p.tier,p.stat].filter(Boolean).join(' · '),{x:tx,y:y+0.53,w:tw,h:0.2,fontFace:F.b,fontSize:8.5,color:T.primaryDark})}})});source(s,sc.note)},
    kpi(s){const k=D.kpi;header(s,`${SEC.exec} · EXPECTED RESULTS`,k.title,k.sub);if(k.note)txt(s,k.note,{x:MX,y:H-0.67,w:8,h:0.22,fontSize:9,color:'A0A0A0'});
      const tiles=[['총 조회수',compactK(K.views),`콘텐츠 ${K.people}개 기준`],['평균 ER',pct(K.er),'보수적 적용 · 참여 ÷ 조회'],['총 좋아요',compactK(Math.round(K.likes/100)*100),`총 참여 약 ${compactK(Math.round(K.eng/100)*100)}`],['CPV',`${K.cpv.toFixed(1)}원`,`광고비 기준 ${K.cpvExec.toFixed(1)}원`]];const gap=0.25,cw=(7.9-gap)/2;
      tiles.forEach((t,i)=>{const x=MX+(i%2)*(cw+gap),y=3.0+Math.floor(i/2)*1.75;const on=i===0;card(s,x,y,cw,1.55,on?T.primary:T.card);txt(s,t[0],{x:x+0.3,y:y+0.22,w:cw-0.6,h:0.3,fontFace:F.b,fontSize:12,color:on?'FFFFFF':T.muted});txt(s,t[1],{x:x+0.3,y:y+0.55,w:cw-0.6,h:0.6,fontFace:F.xb,fontSize:32,color:on?'FFFFFF':T.dark});txt(s,t[2],{x:x+0.3,y:y+1.15,w:cw-0.6,h:0.25,fontSize:10,color:on?'FFFFFF':T.muted})});
      const sc=[['보수',0.7],['기준',1.0],['확장',1.4]];card(s,8.85,3.0,W-MX-8.85,3.6,T.card);txt(s,'시나리오별 총 조회수',{x:9.1,y:3.15,w:3,h:0.3,fontFace:F.b,fontSize:12,color:T.dark});
      s.addChart(CH.BAR,[{name:'조회수',labels:sc.map(([n])=>n),values:sc.map(([,f])=>Math.round(K.views*f))}],{x:9.0,y:3.5,w:W-MX-9.15,h:2.9,barDir:'col',chartColors:[mix(T.primary,0.45),T.primary,T.primaryDark],barGapWidthPct:60,showValue:true,dataLabelPosition:'outEnd',dataLabelFormatCode:'#,##0',dataLabelFontSize:10,dataLabelFontFace:F.b,dataLabelColor:T.dark,catAxisLabelFontSize:11,catAxisLabelFontFace:F.b,catAxisLabelColor:T.dark,valAxisHidden:true,valGridLine:{style:'none'},catGridLine:{style:'none'},showLegend:false});
      source(s,'※ CPV = 총 예산(대행수수료 포함, VAT 별도) ÷ 조회수 · 측정 기준 업로드 후 D+7 · 실제 성과는 콘텐츠 반응에 따라 달라질 수 있습니다.')},
    timeline(s){const t=D.timeline;header(s,`${SEC.timeline} · TIMELINE`,t.title,t.sub);const lx=MX,lw=3.7,gx=lx+lw,gw=W-MX-gx,colW=gw/t.weeks.length,y0=3.0,rh=0.44;const soft=mix(T.primary,0.65);
      t.weeks.forEach((wk,j)=>{const [a,b]=wk.split('\n');txt(s,[{text:a,options:{fontFace:F.xb,fontSize:12,color:T.dark,breakLine:true}},{text:b||'',options:{fontSize:9,color:T.muted}}],{x:gx+j*colW,y:y0,w:colW,h:0.5,align:'center'});if(j>0)line(s,gx+j*colW,y0+0.6,0,t.tasks.length*rh+0.1,T.line,0.75,true)});
      t.tasks.forEach((tk,i)=>{const y=y0+0.65+i*rh;txt(s,tk.name,{x:lx,y,w:lw-0.2,h:rh-0.06,fontFace:tk.hot?F.b:F.r,fontSize:11.5,color:T.dark,valign:'middle'});const bx=gx+tk.start*colW+0.08,bw=(tk.end-tk.start+1)*colW-0.16,by=y+0.08,bh=rh-0.22;
        if(tk.tail){const tx2=gx+(tk.tail.end+1)*colW-0.08;s.addShape(SH.ROUNDED_RECTANGLE,{x:bx,y:by,w:tx2-bx,h:bh,rectRadius:0.1,fill:{color:soft},line:{color:soft,width:0}})}
        s.addShape(SH.ROUNDED_RECTANGLE,{x:bx,y:by,w:bw,h:bh,rectRadius:0.1,fill:{color:tk.hot?T.primary:soft},line:{color:tk.hot?T.primary:soft,width:0}});
        if(tk.label)txt(s,tk.label,{x:bx,y:by,w:bw,h:bh,fontFace:F.xb,fontSize:9,color:tk.hot?'FFFFFF':'595959',align:'center',valign:'middle'});
        if(tk.tail&&tk.tail.label){const tx2=gx+(tk.tail.end+1)*colW-0.08;txt(s,tk.tail.label,{x:bx+bw,y:by,w:tx2-bx-bw,h:bh,fontFace:F.xb,fontSize:9,color:'595959',align:'center',valign:'middle'})}})},
    appendix(s,idx){const a=D.appendix[+idx];header(s,a.eyebrow||'APPENDIX',a.title,a.sub,{bg:'FAFAFA'});
      if(a.kind==='assumptions'){const tbl=(x0,y0,title,cols,ws,rows,total)=>{txt(s,title,{x:x0,y:y0,w:6,h:0.3,fontFace:F.xb,fontSize:13,color:T.dark});let x=x0;const yh=y0+0.42;cols.forEach((c,k)=>{txt(s,c,{x:x+0.06,y:yh,w:ws[k]-0.12,h:0.28,fontFace:F.b,fontSize:10.5,color:T.muted,align:k?'right':'left'});x+=ws[k]});const tw=ws.reduce((p,q)=>p+q,0);
          rows.forEach((r,i)=>{const y=yh+0.36+i*0.5;line(s,x0,y,tw,0,T.line);let cx=x0;r.forEach((v,k)=>{txt(s,v,{x:cx+0.06,y:y+0.09,w:ws[k]-0.12,h:0.32,fontFace:k===0?F.b:F.r,fontSize:12,color:T.dark,align:k?'right':'left'});cx+=ws[k]})});const yt=yh+0.36+rows.length*0.5;line(s,x0,yt,tw,0,T.dark,1.25);let cx=x0;total.forEach((v,k)=>{txt(s,v,{x:cx+0.06,y:yt+0.09,w:ws[k]-0.12,h:0.32,fontFace:F.xb,fontSize:12,color:T.primary,align:k?'right':'left'});cx+=ws[k]})};
        const bm=K.bm;tbl(MX,3.0,`${BR} 추정`,['티어','인원','평균 조회','ER','예상 조회수'],[1.2,0.85,1.35,0.9,1.5],D.tiers.rows.filter(r=>r.count>0).map(r=>[r.tier,r.count+'명',won(bm.views[r.tier]),pct(K.er),won(r.count*bm.views[r.tier])]),['합계',K.people+'명','',pct(K.er),won(K.views)]);
        card(s,MX,5.95,W-2*MX,0.75,'FFFFFF',{line:T.line});txt(s,a.notes,{x:MX+0.25,y:5.95,w:W-2*MX-0.5,h:0.75,fontSize:10,color:T.muted,valign:'middle'})}
      else if(a.kind==='list'){a.cols.forEach((c,k)=>{const x=MX+k*6.17,w=5.9;card(s,x,3.0,w,3.0,'FFFFFF',{line:T.line});txt(s,c.head,{x:x+0.35,y:3.25,w:w-0.7,h:0.4,fontFace:F.xb,fontSize:16,color:T.dark});txt(s,c.items.map((it,i)=>({text:it,options:{bullet:true,breakLine:i<c.items.length-1}})),{x:x+0.35,y:3.8,w:w-0.7,h:2.05,fontSize:13,color:T.dark,paraSpaceAfter:10})})}},
    closing(s){pageNo++;colorBg(s,'closing',T.closing,93);
      fitImg(s,D.closingImg||D.assets.mascotClosing,(W-2.3)/2,1.2,2.3,2.7,{align:'center',valign:'bottom'});
      txt(s,'감사합니다',{x:0,y:4.15,w:W,h:0.9,fontFace:F.xb,fontSize:44,color:'FFFFFF',align:'center'});
      txt(s,`${D.umbrella.oneLine||''}  ${D.umbrella.hashtag||''}`.trim(),{x:0,y:5.1,w:W,h:0.4,fontFace:F.l,fontSize:16,color:'FFFFFF',align:'center'});
      logo(s,true,{x:(W-1.38)/2,y:6.14});txt(s,D.closing.line,{x:0,y:6.75,w:W,h:0.3,fontSize:11,color:'DDDDDD',align:'center'})}
  };
  function slideCircle(s,x,y,d,color){s.addShape(SH.OVAL,{x,y,w:d,h:d,fill:{color},line:{color,width:0}})}
  const out=[];
  for(const id of seq){const [name,arg]=id.split(':');if(!S[name])continue;if(name==='showcase'&&!D.showcase.people.length)continue;const s=deck.addSlide();if(!['cover','toc','closing','eod'].includes(name))secNo++;S[name](s,arg);const n=(opts.notes||{})[id];if(n&&s.addNotes)s.addNotes(D.fillT(n));out.push(id)}
  return out}

window.PPD={PvDeck,build,decideTheme,themeOf,bgOk,paletteOf,cropImg,bgImage,gfxImage,veilImage,mix,shade,contrast,hx,dimsOf,loadImg,man,won,compactK,pct};
})();
