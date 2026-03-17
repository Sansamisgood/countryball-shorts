import { GoogleGenerativeAI, GenerationConfig } from "@google/generative-ai";
import {
  ScriptScene,
  TopicCandidate,
  EpisodePlan,
  CastMember,
  CompositionType,
  SceneType,
  EmotionType,
  AnimationStyle,
  DialogueLine,
  YouTubeSEO,
} from "./types";
import {
  withRetry,
  rateLimitedDelay,
  parseJsonSafely,
  trackApiSuccess,
} from "./utils";

function getAI(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.");
  return new GoogleGenerativeAI(key);
}

// ===== 1. findTopicCandidates =====

export async function findTopicCandidates(
  page: number,
  keyword?: string,
  usedTopics: string[] = [],
  apiKey?: string
): Promise<TopicCandidate[]> {
  const ai = getAI(apiKey);

  const isFirstPage = page === 1;
  const itemCount = isFirstPage ? 30 : 25;
  const blacklist =
    usedTopics.length > 0
      ? `\n\n🚫 이미 사용한 소재 (절대 중복 금지):\n${usedTopics.map((t) => `- ${t}`).join("\n")}`
      : "";

  let phasePrompt: string;

  if (keyword) {
    // TARGET MODE
    phasePrompt = `
🎯 TARGET MODE: "${keyword}" 키워드로 깊게 파고들기

"${keyword}"와 관련된 해외반응, 국제비교, 역사적 사건, 최신 뉴스를 구글 검색으로 철저히 조사해서
컨트리볼 숏츠로 만들기 좋은 소재 ${itemCount}개를 발굴하세요.

각 소재는 반드시:
- 실제 존재하는 뉴스/데이터/반응에 기반
- 한국이 주인공이 되는 각도 존재
- 구체적 수치나 에피소드 포함
    `;
  } else {
    const phaseNumber = ((page - 1) % 4) + 1;

    switch (phaseNumber) {
      case 1:
        phasePrompt = `
📡 Phase 1: 실시간 핫 트렌드 & 4원소 믹스

지금 이 순간 구글 트렌드, 네이버 실시간 검색, SNS에서 뜨고 있는 한국 관련 소식을 검색해서
컨트리볼 숏츠로 만들기 좋은 소재 ${itemCount}개를 찾아주세요.

4원소 균형 (각 원소당 최소 7개):
💖 훈훈: 외국인이 한국에 감동받는 따뜻한 이야기
❓ 호기심: "한국은 왜...?" 라는 의문을 유발하는 특이한 현상
🤣 공감: 한국인이라면 다 아는 공감되는 상황의 국제 비교
🔥 국뽕: 한국의 뛰어남을 보여주는 데이터/랭킹/성과
        `;
        break;
      case 2:
        phasePrompt = `
🏠 Phase 2: 국내 커뮤니티 해외반응 털기

fmkorea, theqoo, dcinside, ruliweb, instiz 등 국내 커뮤니티에서 요즘 핫한
"해외반응" 스레드와 "외국인이 놀란 한국" 류의 게시물을 검색해서
컨트리볼 숏츠로 만들기 좋은 소재 ${itemCount}개를 찾아주세요.

포인트:
- 실제로 커뮤니티에서 조회수/댓글 많은 반응 위주
- "외국인들이 이걸 보고 놀랐다" 는 구체적 반응 포함
- 한국 vs 외국 비교 요소 있는 것 우선
        `;
        break;
      case 3:
        phasePrompt = `
🌍 Phase 3: 해외 현지 커뮤니티 딥 다이브

reddit (r/korea, r/MapPorn, r/dataisbeautiful 등), Yahoo Japan, Quora,
해외 포럼에서 한국에 대해 외국인들이 직접 쓴 글을 검색해서
컨트리볼 숏츠로 만들기 좋은 소재 ${itemCount}개를 찾아주세요.

포인트:
- 외국인 시점에서 한국이 신기한/대단한/이해 안 되는 것들
- 업보트/좋아요 많은 게시물 우선
- 한국인은 당연하게 여기지만 외국인은 충격받는 것들
        `;
        break;
      case 4:
      default:
        phasePrompt = `
🔬 Phase 4: 틈새 시장 - 밀리터리 & 테크 & 미스터리

군사/방산, IT/기술, 의학/과학, 스포츠, 음식 등 틈새 분야에서
한국이 세계적 수준임을 보여주는 소재 ${itemCount}개를 검색해서 찾아주세요.

포인트:
- 밀리터리: K2 전차, K9 자주포, 천무 등 방산 수출 관련
- 테크: 반도체, 배터리, 조선, 원전 등 산업 경쟁력
- 미스터리: 선진국인데 한국인만 모르는 한국의 위상
- 구체적 수치, 순위, 계약 규모 등 팩트 중심
        `;
        break;
    }
  }

  const antiCringeRules = `
⚠️ 안티-크링지 필터 (이런 소재는 절대 포함 금지):
- "한국 최고!"만 외치는 근거 없는 국뽕 (실제 데이터 없는 것)
- 10년 전 이미 다 알려진 케이팝/한류 성공 스토리 반복
- "한국인이 최초로..." 식의 검증되지 않은 주장
- 반드시 실제 뉴스/포스트/통계에 기반한 구체적 사건이어야 함
  `;

  const prompt = `당신은 한국 컨트리볼 숏츠 유튜브 채널의 소재 발굴 전문가입니다.
구글 검색을 활용해서 최신 정보를 바탕으로 소재를 찾아주세요.

${phasePrompt}
${antiCringeRules}
${blacklist}

응답은 반드시 다음 JSON 배열 형식으로만 출력하세요 (마크다운 없이):
[
  {
    "title": "소재 제목 (30자 이내)",
    "oneLiner": "한 줄 설명 (50자 이내)",
    "keyFacts": ["핵심 팩트1", "핵심 팩트2", "핵심 팩트3"],
    "countriesInvolved": ["KR", "US"],
    "koreaAngle": "한국이 주인공이 되는 각도 설명",
    "humorPotential": "웃음/감동 포인트 설명",
    "sourceHint": "출처 힌트 (검색한 사이트/기사 제목)"
  }
]

정확히 ${itemCount}개를 반환하세요.`;

  // Google Search grounding - 새 SDK(@google/genai)를 통해 사용
  // 구 SDK(@google/generative-ai)는 google_search를 지원하지 않으므로 새 SDK 사용
  const { GoogleGenAI } = await import('@google/genai');
  const genAI = new GoogleGenAI({ apiKey: apiKey ?? process.env.GEMINI_API_KEY ?? '' });

  await rateLimitedDelay();
  const genResult = await withRetry(async () => {
    const resp = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return resp;
  });
  trackApiSuccess();
  const text = genResult.text ?? '';

  return parseJsonSafely<TopicCandidate[]>(text, []);
}

// ===== 2. findSimilarTopics =====

export async function findSimilarTopics(
  originalTopic: TopicCandidate | string,
  page: number = 1,
  usedTopics: string[] = [],
  apiKey?: string
): Promise<TopicCandidate[]> {
  const ai = getAI(apiKey);

  // 문자열로 전달된 경우 TopicCandidate 형태로 변환
  const topic: TopicCandidate =
    typeof originalTopic === "string"
      ? {
          title: originalTopic,
          oneLiner: originalTopic,
          keyFacts: [],
          countriesInvolved: ["KR"],
          koreaAngle: "",
          humorPotential: "",
          sourceHint: "",
        }
      : originalTopic;

  const blacklist =
    usedTopics.length > 0
      ? `\n\n🚫 이미 사용한 소재 (절대 중복 금지):\n${usedTopics.map((t) => `- ${t}`).join("\n")}`
      : "";

  const prompt = `당신은 바이럴 콘텐츠 패턴 분석 전문가입니다.

원본 소재:
- 제목: ${topic.title}
- 설명: ${topic.oneLiner}
- 핵심 팩트: ${topic.keyFacts.join(", ")}
- 한국 각도: ${topic.koreaAngle}
- 유머 포인트: ${topic.humorPotential}

위 소재가 왜 바이럴될 수 있는지 패턴을 분석하고,
동일한 바이럴 패턴을 가진 유사 소재 6개를 발굴해주세요.

바이럴 패턴 분석:
1. 어떤 감정을 자극하는가? (훈훈/호기심/공감/국뽕)
2. 어떤 구조인가? (비교/반전/폭로/성장)
3. 타겟 시청자는 누구인가?

이 패턴을 유지하면서 다른 소재로 확장하세요.
(구글 검색 없이 AI 지식으로 빠르게 생성)
${blacklist}

응답은 반드시 다음 JSON 배열 형식으로만 출력하세요 (마크다운 없이):
[
  {
    "title": "소재 제목 (30자 이내)",
    "oneLiner": "한 줄 설명 (50자 이내)",
    "keyFacts": ["핵심 팩트1", "핵심 팩트2", "핵심 팩트3"],
    "countriesInvolved": ["KR", "US"],
    "koreaAngle": "한국이 주인공이 되는 각도 설명",
    "humorPotential": "웃음/감동 포인트 설명",
    "sourceHint": "출처 힌트"
  }
]

정확히 6개를 반환하세요.`;

  // 속도를 위해 Google Search 없이 일반 모델 사용
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  await rateLimitedDelay();
  const result = await withRetry(() => model.generateContent(prompt));
  trackApiSuccess();
  const text = result.response.text();

  return parseJsonSafely<TopicCandidate[]>(text, []);
}

// ===== 3. generateEpisodePlan =====

export async function generateEpisodePlan(
  title: string,
  facts: string[],
  apiKey?: string
): Promise<EpisodePlan> {
  const ai = getAI(apiKey);

  const prompt = `당신은 컨트리볼 숏츠 시나리오 기획 전문가입니다.

## 소재 정보
제목: ${title}
핵심 팩트:
${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

## 3단계 사고 과정

### Step 1: 모드 분류
다음 중 어떤 모드가 적합한지 판단하세요:
- Mode A (국제 비교): 한국 vs 외국 직접 비교 구도
- Mode B (국내 사건): 한국 내부 사건을 외국이 반응
- Mode C (해외반응): 외국인의 한국에 대한 반응/충격

### Step 2: 캐스팅 규칙
컨트리볼 순수 규칙:
- 절대 모자, 안경, 옷, 팔다리 없음
- 오직 눈 표정과 몸통 반응으로만 감정 표현
- 각 국가는 해당 국기 패턴의 구체 형태

캐스팅 시 고려사항:
- 주인공(한국볼)은 항상 포함
- 대립/비교 상대국 선정
- 서브 캐릭터로 반응하는 국가 1-2개 추가

🚨🚨 절대 규칙: 모든 캐릭터는 100% 자연스러운 한국어로 대화! 🚨🚨
- 미국, 일본, 프랑스 등 외국 캐릭터도 전부 한국어로 말합니다
- 영어/일어/불어 등 외국어 단 한 글자도 금지!
- 나라 이름으로 호칭: "한국아!", "미국아!", "일본아!"
- 반말 + 자연스러운 인터넷 톤: ㅋㅋ, ㅠㅠ, 헐, ㄹㅇ, 겁나
- (혼잣말) 활용으로 마무리 개그
- ⚠️ 억지 말투 패턴 금지: "~문이다", "스미마생", "~하겠사옵니다" 같은 부자연스러운 조어 사용 금지!
- 각 나라의 성격(자신감, 소심함, 거만함 등)은 말투가 아닌 대사 내용과 행동으로 표현

### Step 3: 제목 및 개그 포인트 기획

#### 제목 패턴 (SEO 최적화 — "요건 인정이지" 채널 스타일)
실제 바이럴된 제목 패턴을 따르세요:
- "한국한테 '불가능'이라고 말하면 생기는 일"
- "외국인들이 무조건 당한다는 한국인들의 거짓말"
- "한국에게 대놓고 어필하기 시작한 미국"
- "일본의 잔재를 없앤 레전드 폭파사건"
- "[주체]가 [행위]한 [한국 관련 사건/현상]" 구조
- 호기심 갭(curiosity gap) 유발, 20~35자, 클릭 유도

#### comedyBeats 예시 (이 수준으로 구체적으로 작성)
- "한국이 문제 해결하자마자 '(혼잣말) 어? 이게 됐네?' 하는 당황+뿌듯 반응"
- "일본이 '아니... 진짜 이게 가능해?' 하면서 인정할 수밖에 없는 장면"
- "미국이 '그게... 어...' 하며 할 말을 잃는 장면"
- "시간 스킵 후 상황이 완전히 역전되어 있는 반전 (몇년 후 지문 활용)"
- "한국이 쿨하게 '당연하지 ㅋㅋ' 하는 여유로운 코리아 플렉스"

### Step 4: JSON 출력

응답은 반드시 다음 JSON 형식으로만 출력하세요 (마크다운 없이):
{
  "title": "에피소드 제목 (SEO 패턴 적용, 20~35자)",
  "synopsis": "2-3문장 줄거리 요약",
  "cast": [
    {
      "countryCode": "KR",
      "role": "주인공/라이벌/조연 등",
      "personality": "캐릭터 성격 설명 (2-3문장)"
    }
  ],
  "actStructure": [
    "1막: 훅 - 시청자를 잡는 충격적 사실 제시",
    "2막: 전개 - 상황 설명과 대립 구도 형성",
    "3막: 클라이맥스 - 한국의 활약/반전",
    "4막: 아웃트로 - 외국 반응과 마무리"
  ],
  "comedyBeats": [
    "개그 포인트 1 (구체적 대사/장면 묘사 포함)",
    "개그 포인트 2 (구체적 대사/장면 묘사 포함)",
    "개그 포인트 3 (구체적 대사/장면 묘사 포함)"
  ],
  "koreaWinMoment": "한국이 빛나는 최고의 순간 설명"
}`;

  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  await rateLimitedDelay();
  const result = await withRetry(() => model.generateContent(prompt));
  trackApiSuccess();
  const text = result.response.text();

  return parseJsonSafely<EpisodePlan>(text, {
    title,
    synopsis: "",
    cast: [],
    actStructure: [],
    comedyBeats: [],
    koreaWinMoment: "",
  });
}

// ===== 4. generateDraftScript =====

export async function generateDraftScript(
  plan: EpisodePlan,
  apiKey?: string
): Promise<string> {
  const ai = getAI(apiKey);

  const castDescription = plan.cast
    .map((c) => `- ${c.countryCode}볼 (${c.role}): ${c.personality}`)
    .join("\n");

  const prompt = `당신은 컨트리볼 숏츠 대본 작가입니다.

## 에피소드 기획서
제목: ${plan.title}
줄거리: ${plan.synopsis}

## 출연진
${castDescription}

## 막 구성
${plan.actStructure.join("\n")}

## 개그 포인트
${plan.comedyBeats.join("\n")}

## 한국의 하이라이트
${plan.koreaWinMoment}

---

## 대본 작성 지침 (매우 중요!!)

### 🚨 최우선 규칙: 모든 대사는 100% 한국어!
- 외국 캐릭터도 전부 한국어로 말합니다 (영어/일어/불어 절대 금지!)
- "한국아!", "일본아!", "미국아!" 처럼 나라 이름으로 부릅니다
- 외국 캐릭터가 영어 등 외국어를 쓰면 실패입니다

### 말투 스타일
- 전체적으로 반말, 캐주얼한 인터넷 톤
- 자연스러운 한국어 구어체 사용 (문맥에 맞는 표현만!)
- (혼잣말) 을 활용해 코미디 효과 극대화 ("(혼잣말) 쟤네는 어디까지 세지는 거야?")

### 국가별 성격 가이드 (말투가 아니라 성격으로 캐릭터를 구분!)
- **한국볼**: 당당하고 자신감 넘침, 인터넷 슬랭 자연스럽게 활용
  - "ㅇㅇ", "ㅋㅋ", "겁나", "ㄹㅇ", "당연하지"
- **일본볼**: 속으로 인정하면서도 겉으로는 아닌 척, 소심하지만 은근 승부욕 있음
  - "아니... 그건 좀...", "인정하기 싫지만...", "어떻게 그게 가능해?"
- **중국볼**: 자신감 넘치고 단정적, 큰소리치다가 밀리면 변명
  - "당연하지!", "우리가 최고야", "그건... 사정이 좀 있어서"
- **미국볼**: 자신만만하게 나서다가 당황하면 말을 잇지 못함
  - "그건 우리가 원조거든?", "뭐?!", "그게... 어..."
- **유럽볼**: 자존심 강하고 거만하다가 밀리면 할 말 잃음
  - "말도 안 돼!", "이건 좀 다른 얘기인데...", "인정할 건 인정해야지"
- ⚠️ 억지 말투 패턴 절대 금지: "~문이다", "~하겠사옵니다", "스미마생" 등 부자연스러운 조어 사용 금지!
- ⚠️ 문맥에 안 맞는 슬랭도 금지: 무조건 "개쩐다", "쌉가능" 등을 넣지 말고 상황에 맞을 때만 사용

### 참고 대본 예시 ★★★ (이 말투와 전개를 정확히 따라하세요!) ★★★

--- 예시 1: 러시아-한국 불곰사업 ---
러시아 : 한국아! 나 돈 좀 빌려줘!
한국 : 뭐? 얼마나?
러시아 : 30억 달러!
러시아 : (몇년 후) 한국아! 미안한데 돈 못 갚겠다. 대신 우리가 가지고 있는 무기라도 가져가라!
한국 : 겁나 뻔뻔하네. 일단 내놔봐!
한국 : (혼잣말) 어? 근데 이거 상태가 너무 좋은데? 뜯어서 연구 좀 해볼까?
러시아 : (다시 몇년 후) 야! 니네 요새 무기 왜 이렇게 잘 만드냐?
한국 : 니네가 무기 준 거 뜯어서 재설계 하니까 좋은 거 나오던데?
덕분에 k2 흑표전차랑 천궁 미사일 만드는데 도움됐다. 고마워!
러시아 : 뭐? 어떻게 그게 가능한 건데?
한국 : 이러지말고 우리랑 군사협력하자! 이름은 불곰사업 어때?
러시아 : 그...그래! 앞으로 잘 부탁한다!
한국 : (2025년) 러시아야! 덕분에 우리 이번에 나로호 성공했다!
러시아 : 추...축하해! (혼잣말) 쟤네는 어디까지 세지는 거야?

--- 예시 2: 일본-한국 조선총독부 ---
일본 : 한국아! 니네 조선총독부 건물 부순다며?
한국 : ㅇㅇ, 국민 찬성 70% 나옴, 부셔야 됨!
일본 : 안 부수면 안 됨? 우리 관광객들도 그거 많이 보러 가는데...
한국 : 그거 니네가 우리 민족 정기 끊어버리겠다고 지은 거 잖아!
그래서 일부러 경복궁 바로 앞에 날일자 모양으로 지은 거 아냐?
일본 : 아무튼 부수지마! 앞으로 니네 우리랑 외교 안 할 거임?
한국 : 가해자 주제에 말하는 버르장머리 보소? 당장 부숴버린다!
마침 곧 광복절이니까 이거 기념해서 첨탑부터 들어내야겠네!
한국 : (1년 3개월 뒤) 일본아! 조선 총독부 다 부셨다!
남은 첨탑은 독립기념관에 보관해줄게!
일본 : ㅠㅠ 알았어..

--- 예시 3: 미국-한국 무역 협상 ---
미국 : 한국아! 우리한테 관세 더 내!
한국 : 뭔 소리야, 우리가 왜?
미국 : 니네 우리한테 너무 많이 팔잖아! 무역적자 개심각해!
한국 : (혼잣말) 개소리를 잘하네 크크크
한국 : 그럼 니네가 우리 반도체 안 사면 되는 거 아님?
미국 : ...그건 또 안 되고
한국 : ㄹㅇ 웃기고 있네
미국 : (혼잣말) 저거 없으면 우리 아이폰도 못 만드는데... 큰일이네

--- 예시 4: 일본-한국 반도체 기술 역전 ---
일본 : (1990년대) 한국아! 우리 반도체 기술 배우고 싶으면 손발이라도 빌어봐!
한국 : 알겠어! 열심히 배울게!
일본 : 크크, 잘 따라오는구나!
한국 : (혼잣말) 기다려라... 다 배웠다 ㅋㅋ
일본 : (2000년대) 어?! 한국아 니네 우리 추월했잖아?!
한국 : ㅇㅇ 이제 우리가 세계 1위임 ㅋㅋ
일본 : 아니... 어떻게 이게 가능한 거야?
한국 : 우리가 더 열심히 했거든!
일본 : (혼잣말) 가르쳐 준 게 실수였나...
---

### ⚠️ 위 예시에서 반드시 따라야 할 포인트:
1. 모든 캐릭터가 100% 자연스러운 한국어로 대화 (영어/외국어 절대 금지!)
2. "한국아!", "러시아야!", "일본아!" 처럼 나라 이름으로 호칭
3. (혼잣말), (몇년 후), (1년 3개월 뒤), (2025년) 같은 지문 활용
4. 슬랭은 문맥에 맞을 때만 자연스럽게 ("ㅇㅇ", "ㅋㅋ", "겁나" 등)
5. 짧고 펀치력 있는 대사 (한 문장 20자 이내)
6. 한국이 똑똑하고 당당하게 나오는 전개
7. 외국 캐릭터의 (혼잣말)로 마무리 개그 — "코리아 플렉스" 엔딩
8. ❌ "~문이다", "스미마생", "~하겠사옵니다" 같은 억지 조어 절대 사용 금지!
9. 상황이 점점 코미디로 에스컬레이션 → 클라이맥스에서 한국 압도 → 외국 충격
10. 대사의 흐름이 자연스러워야 함 — 문맥상 어색한 단어/끝말은 쓰지 않기

### 🔥 4막 구조 — "무시→성장→인정" 국뽕 공식 (반드시 지켜!)
1. **훅 (무시/도발)**: 외국이 한국을 깔보거나 무시하거나 비웃는 장면으로 시작!
   - "한국? 그게 어디야?", "너네가 그걸 할 수 있다고?", "우리한테 덤비지 마"
   - 시청자가 분노+호기심으로 스크롤을 멈추게 하는 도발적 첫 대사
2. **전개 (성장/반격의 조짐)**: 한국이 조용히 실력을 보여주기 시작
   - 구체적 수치/데이터/사건으로 한국의 저력이 드러남
   - 외국이 슬슬 당황
3. **클라이맥스 (역전/압도)**: 한국이 완전히 뒤집는 통쾌한 반전!
   - 처음에 무시하던 나라가 할 말을 잃음
   - 코리아 플렉스 — 한국의 압도적 성과
4. **아웃트로 (인정/감탄)**: 외국이 진심으로 한국을 인정하며 마무리
   - (혼잣말) "이 나라는 진짜 대단해...", "인정할 건 인정해야지"
   - 처음의 무시 → 마지막의 인정, 이 극적 대비가 핵심 카타르시스

### 출력 형식
다음 형식으로 대본을 작성하세요:

[1막: 훅]
(장면 설명: 배경과 상황)
KR볼: "대사" {감정:HAPPY}
US볼: "대사" {감정:SURPRISED}

[2막: 전개]
(장면 설명)
KR볼: "대사" {감정:NEUTRAL}
...

### 필수 규칙
- 각 대사 뒤에 {감정:HAPPY/ANGRY/SAD/SURPRISED/NEUTRAL} 태그를 반드시 붙이세요.
- 대사는 짧고 임팩트 있게 (한 대사 20자 이내 권장).
- (혼잣말), (몇년 후) 같은 지문을 활용하세요.
- 외국 캐릭터도 무조건 한국어로만 대사를 씁니다!`;

  const generationConfig: GenerationConfig = {
    thinkingConfig: { thinkingBudget: 2048 },
  } as GenerationConfig;

  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig,
  });

  await rateLimitedDelay();
  const result = await withRetry(() => model.generateContent(prompt));
  trackApiSuccess();
  return result.response.text();
}

// ===== 5. reviewAndFinalizeScript =====

export async function reviewAndFinalizeScript(
  rawScript: string,
  plan: EpisodePlan,
  apiKey?: string
): Promise<ScriptScene[]> {
  const ai = getAI(apiKey);

  const prompt = `당신은 컨트리볼 숏츠 스토리보드 변환 전문가입니다.

다음 원고 대본을 JSON 스토리보드로 변환하세요.

## 원본 대본
${rawScript}

## 에피소드 정보
제목: ${plan.title}
출연진: ${plan.cast.map((c) => `${c.countryCode}볼`).join(", ")}

## 변환 규칙

### 씬 타입
- DIALOGUE: 캐릭터 간 대화
- NARRATION: 내레이션/자막
- REACTION: 캐릭터의 감정 반응 (대사 없음)
- MONTAGE: 빠른 장면 전환
- TITLE: 제목 화면
- ENDING: 엔딩 화면

### 구도 타입 (composition)
- SOLO: 한 캐릭터가 화면 중앙
- TWO_SHOT: 두 캐릭터가 좌/우 대칭
- ONE_VS_MANY: 한 캐릭터 vs 다수 (3개 이상)
- TEAM: 같은 편 캐릭터들이 한쪽에

### 🚨🚨🚨 대사 규칙 (최우선! 절대 위반 금지!) 🚨🚨🚨
- 모든 캐릭터의 대사는 반드시 100% 한국어로 작성
- 미국볼이든 일본볼이든 프랑스볼이든 전부 한국어 반말로 말합니다!
- 영어/일어/불어/중국어 등 외국어가 단 한 글자라도 있으면 반드시 한국어로 변환하세요
- 원본 대본에 외국어가 있으면 아래 국가별 말투 가이드에 따라 자연스러운 한국어로 변환

#### 국가별 변환 예시 (원본에 외국어가 있을 경우 이렇게 바꾸세요)
- **일본볼 (JP)**:
  - ❌ "Sugoi! Naru hodo..." → ✅ "아니... 진짜? 어떻게 그게 가능한 거야?"
  - ❌ "Gomen nasai" → ✅ "미안... 인정할게"
  - 성격: 속으로 인정하면서도 겉으로 아닌 척, 소심하지만 승부욕 있음
- **중국볼 (CN)**:
  - ❌ "Hen hao! Zhongguo zuiqiang!" → ✅ "좋아! 우리가 최고야"
  - 성격: 자신감 넘치고 단정적, 큰소리치다가 밀리면 변명
- **미국볼 (US)**:
  - ❌ "No way! That's impossible!" → ✅ "뭐?! 그게... 어떻게 가능한 거야?"
  - ❌ "Oh my god, seriously?" → ✅ "헐, 진짜로?"
  - 성격: 자신만만하게 나서다가 당황하면 말을 잃음
- **프랑스볼 (FR)**:
  - ❌ "Sacré bleu! C'est impossible!" → ✅ "말도 안 돼! 이게 어떻게?"
- **독일볼 (DE)**:
  - ❌ "Wunderbar! Sehr gut!" → ✅ "대단하네. 데이터상으로는 불가능한 수치인데..."
- **기타 국가볼**: 해당 국가 성격에 맞는 자연스러운 한국어로 변환
- ⚠️ "~문이다", "스미마생", "~하겠사옵니다" 같은 억지 조어 절대 금지!

나라 이름으로 부르기: "한국아!", "미국아!", "일본아!", "프랑스야!", "중국아!"

### 카메라 규칙
- 발언자가 바뀌면 반드시 씬 전환 (숏-리버스 숏)
- 같은 발언자 연속 대사는 같은 씬에 묶기
- 감정 반응은 별도 REACTION 씬으로

### imagePrompt 작성법 (클래식 폴란드볼 스타일)
"White background, classic Polandball meme style, [composition], [캐릭터명]볼 is a sphere with [국기] flag pattern, simple white oval eyes with black dot pupils, [emotion through eye shape only - bigger eyes for surprise, squint for happy, droopy for sad, V-brow for angry], thick black outlines, flat colors, 9:16 vertical, NO text, NO arms/legs"

⚠️ imagePrompt는 영어로 작성 (AI 이미지 생성용)

응답은 반드시 다음 JSON 배열 형식으로만 출력하세요 (마크다운 없이):
[
  {
    "sceneNumber": 1,
    "sceneType": "DIALOGUE",
    "composition": "TWO_SHOT",
    "setting": "배경 설명",
    "dialogue": [
      {
        "speaker": "KR",
        "text": "대사",
        "emotion": "HAPPY",
        "animation": "BOUNCE"
      }
    ],
    "directorNote": "연출 지시사항",
    "durationSec": 3
  }
]`;

  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  await rateLimitedDelay();
  const result = await withRetry(() => model.generateContent(prompt));
  trackApiSuccess();
  const text = result.response.text();

  return parseJsonSafely<ScriptScene[]>(text, []);
}

// ===== 6. generateCharacterBaseImage =====

export async function generateCharacterBaseImage(
  masterPrompt: string,
  apiKey?: string
): Promise<string> {
  const { generateCharacterBaseImage: generate } = await import('./imageGen');
  return generate(masterPrompt, apiKey);
}

// ===== 7. generateImageForScene =====

export async function generateImageForScene(
  scene: ScriptScene,
  characterDescription?: string,
  apiKey?: string
): Promise<{ imageUrl: string }> {
  const { generateSceneImage } = await import('./imageGen');

  const primaryLine: DialogueLine | undefined = scene.dialogue[0];
  const speaker = primaryLine?.speaker ?? 'KR';
  const emotion = (primaryLine?.emotion ?? 'NEUTRAL') as EmotionType;
  const visualCue = scene.setting ?? '';

  try {
    const imageUrl = await generateSceneImage(
      visualCue,
      scene.composition,
      speaker,
      emotion,
      characterDescription,
      apiKey
    );
    return { imageUrl };
  } catch (err) {
    console.error('[gemini.ts] generateImageForScene 실패:', err);
    return { imageUrl: '' };
  }
}

// ===== 8. generateYouTubeSEO =====

export async function generateYouTubeSEO(
  plan: EpisodePlan,
  scenes: ScriptScene[],
  apiKey?: string
): Promise<YouTubeSEO> {
  const ai = getAI(apiKey);

  const castSummary = plan.cast
    .map((c) => `${c.countryCode} (${c.role})`)
    .join(", ");

  const dialogueSummary = scenes
    .flatMap((s) =>
      s.dialogue.map((d) => `${d.speaker}: ${d.text}`)
    )
    .slice(0, 30)
    .join("\n");

  const prompt = `당신은 한국 컨트리볼 유튜브 쇼츠 채널의 SEO 최적화 전문가입니다.

## 에피소드 정보
제목: ${plan.title}
줄거리: ${plan.synopsis}
출연진: ${castSummary}
코미디 포인트: ${plan.comedyBeats.join(", ")}
한국 하이라이트: ${plan.koreaWinMoment}

## 대본 요약 (주요 대사)
${dialogueSummary}

## 작업 지침

아래 모든 항목을 생성하세요:

### 1. 제목 후보 (titles) - 5개
한국 컨트리볼 쇼츠 유튜브에서 바이럴되는 제목 패턴을 따르세요:
- 패턴 예시:
  - "한국한테 '불가능'이라고 말하면 생기는 일"
  - "외국인들이 무조건 당한다는 한국인들의 거짓말"
  - "한국에게 대놓고 어필하기 시작한 미국"
  - "일본의 잔재를 없앤 레전드 폭파사건"
  - "외국인을 당황시킨 한국 공무원"
  - "해외에서 화제라는 인기폭발 한국 제품"
- 핵심 규칙:
  - 20~35자 이내
  - 호기심 유발 (curiosity gap)
  - 감정적 훅 포함
  - "[주체]가 [행동]한 [한국 관련 현상/사건]" 구조
  - 쇼츠 시청자가 즉시 클릭하고 싶은 제목

### 2. 설명 (description)
- YouTube 쇼츠에 최적화된 설명문 (500자 이내)
- 첫 2줄에 핵심 키워드 포함
- 관련 키워드를 자연스럽게 포함
- 채널 소개 문구: "컨트리볼로 보는 세계 이야기"
- CTA 포함 (구독, 좋아요, 댓글)

### 3. 태그 (tags) - 30개
- 한국어 태그 20개 + 영어 태그 10개
- 검색량 높은 키워드 우선
- 일반적 태그 (컨트리볼, 쇼츠, 해외반응 등) + 에피소드 특화 태그

### 4. 썸네일 텍스트 (thumbnailTexts) - 3개
- 한 줄에 최대 15자
- 짧고 강렬한 한국어
- 시청자의 호기심을 자극하는 텍스트
- 예: "일본 충격", "한국 ㄹㅇ 미쳤다", "외국인 반응 ㅋㅋ"

### 5. 해시태그 (hashtags) - 5개
- #쇼츠 #컨트리볼 포함
- 에피소드 관련 해시태그 3개 추가

### 6. 훅 멘트 (hookLine)
- 쇼츠 첫 1초에 나올 텍스트
- 시청자가 스크롤을 멈추게 하는 강렬한 한 문장
- 20자 이내

### 7. 카테고리 (category)
- YouTube 카테고리 추천 (예: "Entertainment", "Education", "Comedy")

응답은 반드시 다음 JSON 형식으로만 출력하세요 (마크다운 없이):
{
  "titles": ["제목1", "제목2", "제목3", "제목4", "제목5"],
  "description": "설명 텍스트",
  "tags": ["태그1", "태그2", ...],
  "thumbnailTexts": ["텍스트1", "텍스트2", "텍스트3"],
  "hashtags": ["#해시1", "#해시2", "#해시3", "#해시4", "#해시5"],
  "hookLine": "훅 멘트 텍스트",
  "category": "카테고리"
}`;

  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  await rateLimitedDelay();
  const result = await withRetry(() => model.generateContent(prompt));
  trackApiSuccess();
  const text = result.response.text();

  return parseJsonSafely<YouTubeSEO>(text, {
    titles: [],
    description: "",
    tags: [],
    thumbnailTexts: [],
    hashtags: [],
    hookLine: "",
    category: "",
  });
}
