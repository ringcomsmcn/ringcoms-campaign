// 광고 제안서 생성 AI 공용: 시장 조사(구글 검색 근거) · 제안서 문구 프롬프트
// 숫자(티어 인원·단가·예상 조회수·CPV)는 화면에서 계산하고, AI는 스토리·컨셉·가이드 문구만 쓴다.
import { GKEY, MODELS } from './gemini.mjs';
const API = 'https://generativelanguage.googleapis.com';

/* 구글 검색 근거(Grounding)로 시장 조사 메모 받기 — 실패하면 빈 값 (제안서는 조사 없이도 만듦) */
export async function research(info, timeoutMs = 70000) {
  if (!GKEY) return { text: '', sources: [] };
  const q = `한국 시장 기준으로 아래 제품·서비스의 인플루언서 마케팅 제안서에 쓸 시장 자료를 조사해 줘.
- 브랜드: ${info.brand || info.advertiser || ''}
- 제품·서비스: ${info.product || ''}
- 분야: ${info.category || ''}
- 타깃: ${info.target || ''}
필요한 것 (가능하면 2024~2026년 자료, 숫자와 출처 기관·매체명을 함께):
1) 시장 규모·성장률 2) 이용자·타깃 규모 3) 타깃의 정서·행동 지표(설문 등) 4) 경쟁·대체재 동향 5) 숏폼·인플루언서 콘텐츠 트렌드.
확인되지 않은 숫자는 쓰지 말고, 항목마다 「숫자 — 의미 (출처, 연도)」 형식으로 짧게 정리해 줘.`;
  let lastErr = '';
  for (const m of [...new Set([...MODELS.filter(x => !/lite/.test(x)), 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-lite-latest'])]) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`${API}/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': GKEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: q }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } })
      });
      clearTimeout(t);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { lastErr = ((j.error || {}).message || ('HTTP ' + r.status)).slice(0, 160); continue; }
      const cand = (j.candidates || [])[0] || {};
      const text = ((cand.content || {}).parts || []).map(p => p.text || '').join('').trim();
      const gm = cand.groundingMetadata || {};
      const sources = (gm.groundingChunks || []).map(c => c.web || {}).filter(w => w.uri).map(w => ({ title: String(w.title || '').slice(0, 120), uri: w.uri })).slice(0, 12);
      return { text: text.slice(0, 9000), sources, model: m };
    } catch (e) { clearTimeout(t); lastErr = e.name === 'AbortError' ? '시간 초과' : String(e.message || e); }
  }
  return { text: '', sources: [], error: lastErr };
}

const SCHEMA = `{
 "brand": "광고주 공식 브랜드 표기 (소개서에 영문 표기가 있으면 영문 그대로, 한글 음차 금지)",
 "advertiser": "회사명",
 "product": "제품·서비스명",
 "category": "제품 분야 (예: 반려동물 앱, 저당 간식, 기초 화장품)",
 "color": "#RRGGBB — 소개서·홈페이지에서 보이는 브랜드 메인 컬러 추정 (너무 밝은 색이면 더 진하게)",
 "cover": { "headline": "표지 메인 카피 (짧고 강하게, 2줄이면 \\n)", "sub": "표지 서브 카피 한 줄" },
 "market": {
   "title": "시장 장 대제목 (2줄, \\n)", "sub": "소제목 (문장 끝 . ! ? 뒤에서 \\n, 2줄 이내)",
   "stats": [{ "label": "지표 이름 (10자 안팎)", "value": "숫자만 (예: 1,546 / 63.2)", "unit": "단위 (만 명, %, 조 원 등)", "desc": "의미 1~2줄 (\\n으로 끊기)" }],
   "source": "출처: 기관·매체명, 연도 (· 로 구분)",
   "title2": "인사이트 장 대제목 (2줄, \\n)", "sub2": "소제목",
   "insights": [{ "kicker": "짧은 라벨", "value": "핵심 수치나 키워드", "text": "설명 1~2줄" }],
   "takeaway": "그래서 이 브랜드에 필요한 것 — 3~4줄 (\\n)", "source2": "출처"
 },
 "direction": { "title": "브랜드가 나아갈 방향 대제목 (2줄)", "sub": "소제목", "shifts": [{ "from": "지금", "to": "바뀔 모습 (6자 안팎)", "desc": "한 줄 설명" }], "positioning": "한 줄 포지셔닝 문장" },
 "umbrella": { "name": "캠페인 전체 우산 컨셉명 (2줄 가능, \\n)", "sub": "컨셉 설명 2줄 (\\n)", "hashtags": ["#캠페인해시태그", "#보조해시태그"] },
 "groups": [{
   "key": "A",
   "name": "그룹 이름 (예: 실사용 집사)", "pillar": "단계 역할 (공감·인지 / 참여·확산 / 확장·신규 중 하나)",
   "who": "어떤 인플루언서 (2줄, \\n)", "role": "이 그룹의 역할 (2줄)", "content": "콘텐츠 형식 (2줄)", "effect": "기대 효과 (2줄)",
   "keywords": ["인플루언서 풀 검색용 카테고리 키워드 3~5개 (예: 반려동물, 강아지, 고양이)"],
   "persona": [{ "type": "섭외하려는 인플루언서 유형 (예: 말티즈 키우는 20대 자취 집사)", "tier": "매크로|마이크로|나노", "why": "왜 이 유형인지 2줄 (\n)" }],
   "concept": { "name": "그룹 컨셉명 (짧게, 2줄이면 \\n)", "hashtags": ["#짧고임팩트있는해시태그", "#두번째"], "story": ["스토리 4줄 — 문장 하나씩"], "keyMessage": "KEY MESSAGE 한 문장", "features": "보여줄 기능·특징 (· 로 구분)" },
   "guide": { "title": "콘텐츠 가이드 대제목 (2줄)", "sub": "소제목", "cuts": [{ "step": "HOOK|FEATURE|PROOF|CTA 등 단계명", "time": "0~3초", "scene": "화면 — 인플루언서가 직접 찍는 장면 (2줄)", "line": "멘션·자막 예시 (2줄)" }], "caption": "캡션 예시 (#광고 포함, 3~5줄)", "must": ["MUST 3개"], "dont": ["DON'T 3개"] },
   "feature": { "items": [{ "name": "핵심 기능·특징명 (10자 안팎)", "desc": "한 줄 설명 (20자 안팎)" }], "effect": "기대 효과 한 줄" }
 }],
 "tierWhy": { "메가": { "role": "역할 2~4자", "why": "이유 한 줄" }, "매크로": { "role": "", "why": "" }, "마이크로": { "role": "", "why": "" }, "나노": { "role": "", "why": "" } },
 "matrixPoints": ["그룹×티어 구성 포인트 3개 (각 2줄 이내)"],
 "timeline": { "title": "타임라인 대제목 (2줄)", "sub": "소제목" },
 "closing": "마지막 장 한 줄 (캠페인 컨셉을 다시 짚는 문장)",
 "checks": ["담당자가 광고주에게 꼭 확인해야 할 사항 (수치 출처·효능 표현·제품 정보 등) 2~5개"],
 "notes": { "cover": "[0:00] 발표 대본 30초~1분", "market1": "", "market2": "", "direction": "", "capability": "", "umbrella": "", "groupA": "", "guideA": "", "groupB": "", "guideB": "", "groupC": "", "guideC": "", "features": "", "categories": "", "tiers": "", "matrix": "", "showcase": "", "kpi": "", "timeline": "" }
}`;

export function proposalPrompt(info, plan, pages, rs) {
  const won = v => Math.round(+v || 0).toLocaleString('ko-KR');
  const tiers = (plan.tiers || []).filter(t => +t.count > 0).map(t => `${t.tier} ${t.count}명 × ${won(t.unit)}원`).join(', ') || '(미정)';
  return `너는 한국 MCN 링컴즈(RINGCOMS)의 인플루언서 마케팅 캠페인 제안서 작가다.
광고주 상품소개서와 기초 정보로 광고주에게 보낼 「인플루언서 캠페인 제안서」의 문구를 쓴다.
숫자(인원·단가·예상 조회수·CPV)는 시스템이 계산해 넣으므로, 너는 스토리·컨셉·전략·가이드 문구만 쓴다.

[제안서 원칙]
- 간단하고 핵심을 짚되 스토리텔링: 시장(문제) → 인사이트 → 브랜드가 나아갈 방향 → 캠페인 컨셉 → 그룹별 실행 → 숫자.
- 브랜드명은 광고주 공식 표기로 통일한다 (보통 영문, 한글 음차 금지).
- 크리에이터 IP를 소모품처럼 쓰지 않는다 — 브랜드와 크리에이터 모두에게 득이 되는 구조.
- 3개 인플루언서 그룹 = 3단계 전략: A 실사용자형(실제 타깃이 직접 쓰는 리액션, 신뢰·공감·인지) / B 주인공 채널형(사람 대신 대상 — 반려동물·아이·제품·캐릭터 등 — 이 주인공인 채널, 높은 ER로 참여·확산) / C 잠재 타깃형(아직 고객은 아니지만 원하는 사람, 확장·신규). 이 제품에 B형이 맞지 않으면 B를 이 제품에 맞는 「참여·확산」 그룹(예: 전문가·리뷰어·라이프스타일)으로 바꾼다. 그룹 이름·역할명은 광고주에 맞게.
- 그룹마다 해시태그 2개: 챌린지용 참여형이 아니라 짧고 임팩트 있는 표현 (예: #우리애가말을했다 #처음듣는그목소리).
- 콘텐츠 가이드는 인플루언서가 직접 촬영·편집하므로 연기·상황극·대사 티키타카를 빼고 설명형(얼굴 정면 한 컷 + 제품·앱 화면 + 설명 멘션)으로. 컷은 4개(HOOK 0~3초 → FEATURE → FEATURE/PROOF → CTA, 합계 25~30초). 캡션 예시는 맨 앞에 #광고.
- 표지 메인 카피와 우산 컨셉은 캠페인 전체를 말하고, A그룹 컨셉과 섞지 않는다.
- 해시태그·캡션에도 브랜드 한글 음차(예: Petbbi → 펫비)를 쓰지 않는다. 브랜드 해시태그는 공식 표기 그대로(#Petbbi).
- B그룹은 제품이 반려동물·아이·캐릭터처럼 '대상'이 있으면 반드시 그 대상이 주인공인 채널(예: 반려동물 계정)로 한다. 대상이 없는 제품일 때만 다른 참여·확산 그룹으로 바꾼다.
- notes는 모든 키를 채운다 (각 30초~1분 분량, [분:초]로 시작, 전체 약 20분). 숫자는 시스템이 따로 덧붙이니 문장에 인원·금액을 쓰지 않는다.
- 앱 설치·클릭 수 같은 추정치는 쓰지 않는다. "세 번의 파도" 같은 표현은 쓰지 않는다.

[문구·줄바꿈 규칙 — 반드시 지킬 것]
- 자동 줄바꿈에 맡기지 않는다. 모든 문구는 \\n으로 직접 끊는다.
- 대제목은 두 줄, 각 줄이 완결된 구절이어야 한다. 쉼표·물음표 뒤에서 끊는다. 조사·목적어 중간에서 끊지 않는다.
  좋음: "왜 링컴즈 MCN인가?\\n섭외부터 리포트까지, 한 팀에서" / "공감에서 참여로,\\n참여에서 확장으로"
- 소제목은 문장 단위로 줄을 바꾼다 (. ! ? 뒤는 항상 새 줄, 긴 문장은 , 뒤에서). 2줄 이내.
- 카드 본문은 한 줄 12~16자 안팎으로 직접 끊는다. 단어·숫자·단위가 줄 사이에서 갈라지지 않게.
- 문장이 길면 줄이거나 풀어서 다시 쓴다.

[시장 숫자 규칙]
- market.stats(3개)와 insights(3개)의 숫자는 [시장 조사 메모]·[광고주 소개서]에 있는 숫자를 우선 쓴다.
- 조사 메모가 없거나 부족하면, 네가 확실히 알고 있는 공신력 있는 공개 통계(정부·공공기관·주요 연구소·주요 언론 발표, 기관명과 연도를 댈 수 있는 것)만 쓴다. 이때 source에 기관명·연도를 적고, checks에 "시장 수치(○○ 통계)는 최신 자료로 확인 필요"를 넣는다.
- 기관·연도를 댈 수 없는 숫자는 절대 만들지 않는다. 그런 경우 value에 정성 표현("↑", "확대")을 쓴다. stats 3개 중 최소 2개는 숫자로 채우도록 노력한다.
- source/source2에는 실제로 쓴 숫자의 출처만 적는다.

[기초 정보]
- 광고주(회사): ${info.advertiser || '(소개서에서 찾기)'}
- 브랜드: ${info.brand || '(소개서에서 찾기)'}
- 제품·서비스: ${info.product || '(소개서에서 찾기)'}
- 분야: ${info.category || '(소개서에서 판단)'}
- 캠페인 목적: ${info.objective || '브랜드 인지도·조회수'}
- 주요 타깃: ${info.target || '(소개서에서 판단)'}
- 채널·형식: ${info.platform || '인스타그램 릴스 · 유튜브 쇼츠'}
- 집행 기간: ${[info.start, info.end].filter(Boolean).join(' ~ ') || '미정'}
- 총 예산: ${won(info.budget)}원 (VAT 별도, 대행수수료 ${info.feeRate}% ${info.feeMode === 'excl' ? '별도' : '포함'})
- 인플루언서 구성(시스템 계산): ${tiers}
- 담당자 메모·광고주 요청: ${String(info.memo || '').slice(0, 3000) || '(없음)'}

[광고주 상품소개서]
${String(info.srcText || '').slice(0, 24000) || '(없음)'}

[광고주 페이지]
${(pages || []).filter(p => p.ok).map((p, i) => `--- 페이지 ${i + 1}: ${p.url}\n제목: ${p.title}\n설명: ${p.desc}\n${p.text}`).join('\n\n').slice(0, 14000) || '(없음)'}

[시장 조사 메모 (구글 검색 근거)]
${rs && rs.text ? rs.text : '(조사 결과 없음 — 소개서 숫자만 쓰거나 정성 표현)'}
${rs && rs.sources && rs.sources.length ? '참고 출처: ' + rs.sources.map(s => s.title).join(' / ') : ''}

[개수] market.stats 3개, insights 3개, direction.shifts 3개, groups 정확히 3개(A·B·C), 그룹별 concept.story 4줄, guide.cuts 4개, must 3개, dont 3개, feature.items 3개, matrixPoints 3개.

아래 JSON 형식 그대로, JSON만 출력한다:
${SCHEMA}`;
}
