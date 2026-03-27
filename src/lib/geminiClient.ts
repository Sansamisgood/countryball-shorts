'use client';

/**
 * 브라우저에서 직접 Gemini API를 호출하는 클라이언트 모듈.
 * Vercel 서버리스 타임아웃(10~30초)을 우회하기 위해 사용.
 * API 키는 localStorage에서 가져옴.
 */

import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { EpisodePlan, ScriptScene, TopicCandidate, YouTubeSEO } from './types';

function getApiKey(): string {
  const key = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  if (!key) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
  return key;
}

/** Dynamic import with retry for chunk load resilience */
async function importGenAIWeb(): Promise<typeof import('@google/genai/web')> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await import('@google/genai/web');
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('모듈 로드 실패: @google/genai/web');
}

function getAI(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(getApiKey());
}

/** 마크다운 코드 블록 제거 후 JSON 파싱 */
function parseJsonSafe<T>(text: string, fallback: T): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  const candidate = jsonMatch ? jsonMatch[0] : cleaned;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // 잘린 JSON 복구 시도
    let repaired = candidate
      .replace(/,\s*"[^"]*"?\s*:?\s*$/, '')
      .replace(/,\s*$/, '');

    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    repaired = repaired.replace(/,\s*$/, '');
    while (stack.length > 0) repaired += stack.pop();

    try {
      return JSON.parse(repaired) as T;
    } catch {
      console.error('[geminiClient] JSON 파싱 실패:', text.slice(0, 300));
      return fallback;
    }
  }
}

// ===== generateDraftScript (브라우저) =====

export async function clientGenerateDraft(plan: EpisodePlan): Promise<string> {
  const ai = getAI();

  const castDescription = plan.cast
    .map((c) => `- ${c.countryCode}볼 (${c.role}): ${c.personality}`)
    .join('\n');

  const prompt = `당신은 컨트리볼 숏츠 대본 작가입니다.

## 에피소드 기획서
제목: ${plan.title}
줄거리: ${plan.synopsis}

## 출연진
${castDescription}

## 막 구성
${plan.actStructure.join('\n')}

## 개그 포인트
${plan.comedyBeats.join('\n')}

## 한국의 하이라이트
${plan.koreaWinMoment}

---

## 대본 작성 지침

### 🚨 최우선 규칙: 모든 대사는 100% 자연스러운 한국어!
- 외국 캐릭터도 전부 한국어로 말합니다 (영어/일어/불어 절대 금지!)
- "한국아!", "일본아!", "미국아!" 처럼 나라 이름으로 부릅니다

### 말투 스타일
- 전체적으로 반말, 캐주얼한 인터넷 톤
- 자연스러운 한국어 구어체 사용 (문맥에 맞는 표현만!)
- (혼잣말) 을 활용해 코미디 효과 극대화

### 국가별 성격 가이드
- **한국볼**: 당당하고 자신감 넘침, 인터넷 슬랭 자연스럽게 활용
- **일본볼**: 속으로 인정하면서도 겉으로는 아닌 척, 소심하지만 은근 승부욕
- **중국볼**: 자신감 넘치고 단정적, 큰소리치다가 밀리면 변명
- **미국볼**: 자신만만하게 나서다가 당황하면 말을 잇지 못함
- **유럽볼**: 자존심 강하고 거만하다가 밀리면 할 말 잃음
- ⚠️ 억지 말투 패턴 절대 금지: "~문이다", "스미마생", "~하겠사옵니다" 등 부자연스러운 조어 금지!
- ⚠️ 문맥에 안 맞는 슬랭도 금지

### 🔥 4막 구조 — "무시→성장→인정" 국뽕 공식 (반드시 지켜!)
1. **훅 (무시/도발)**: 외국이 한국을 깔보거나 무시하거나 비웃는 장면으로 시작!
   - "한국? 그게 어디야?", "너네가 그걸 할 수 있다고? ㅋㅋ", "우리한테 덤비지 마"
   - 시청자가 분노+호기심으로 스크롤을 멈추게 하는 도발적 첫 대사
2. **전개 (성장/반격의 조짐)**: 한국이 조용히 실력을 보여주기 시작
   - 구체적 수치, 데이터, 사건으로 한국의 저력이 드러남
   - 외국이 "어...?" 하며 슬슬 당황하기 시작
3. **클라이맥스 (역전/압도)**: 한국이 완전히 뒤집는 통쾌한 반전!
   - 처음에 무시하던 나라가 할 말을 잃거나 인정할 수밖에 없는 상황
   - 코리아 플렉스 — 한국의 압도적 성과/실력이 빛나는 순간
4. **아웃트로 (인정/감탄)**: 외국이 진심으로 한국을 인정하며 마무리
   - "(혼잣말) 이 나라는 진짜 대단해...", "인정할 건 인정해야지"
   - 처음의 무시와 대비되는 180도 태도 변화가 핵심 카타르시스

### 출력 형식
[1막: 훅]
(장면 설명)
KR볼: "대사" {감정:HAPPY}
US볼: "대사" {감정:SURPRISED}

[2막: 전개]
...

### 필수 규칙
- 각 대사 뒤에 {감정:HAPPY/ANGRY/SAD/SURPRISED/NEUTRAL} 태그
- 대사는 짧고 임팩트 있게 (한 대사 20자 이내 권장)
- (혼잣말), (몇년 후) 같은 지문 활용`;

  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 2048 } } as GenerationConfig,
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ===== reviewAndFinalizeScript (브라우저) =====

export async function clientFinalizeScript(
  rawScript: string,
  plan: EpisodePlan
): Promise<ScriptScene[]> {
  const ai = getAI();

  const prompt = `당신은 컨트리볼 숏츠 스토리보드 변환 전문가입니다.

다음 원고 대본을 JSON 스토리보드로 변환하세요.

## 원본 대본
${rawScript}

## 에피소드 정보
제목: ${plan.title}
출연진: ${plan.cast.map((c) => c.countryCode + '볼').join(', ')}

## 변환 규칙

### 씬 타입
- DIALOGUE: 캐릭터 간 대화
- NARRATION: 내레이션/자막
- REACTION: 캐릭터의 감정 반응
- MONTAGE: 빠른 장면 전환
- TITLE: 제목 화면
- ENDING: 엔딩 화면

### 구도 타입 (composition)
- SOLO: 한 캐릭터가 화면 중앙
- TWO_SHOT: 두 캐릭터가 좌/우 대칭
- ONE_VS_MANY: 한 캐릭터 vs 다수
- TEAM: 같은 편 캐릭터들이 한쪽에

### 🚨 대사 규칙
- 모든 대사 100% 자연스러운 한국어
- 억지 말투 패턴 금지: "~문이다", "스미마생" 등
- 문맥에 맞는 자연스러운 표현만 사용

### 카메라 규칙
- 발언자가 바뀌면 씬 전환
- 같은 발언자 연속 대사는 같은 씬에 묶기

### imagePrompt 작성법 (클래식 폴란드볼 스타일)
"White background, classic Polandball meme style, [composition], [캐릭터명]볼 is a sphere with [국기] flag pattern, simple white oval eyes with black dot pupils, [emotion through eye shape only], thick black outlines, flat colors, 9:16 vertical, NO text, NO arms/legs, NO mouth"

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

  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let raw = parseJsonSafe<ScriptScene[] | Record<string, unknown>>(text, []);
  // Gemini가 {scenes: [...]} 형태로 반환하는 경우 처리
  if (raw && !Array.isArray(raw) && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const arr = obj.scenes ?? obj.data ?? obj.result ?? obj.storyboard;
    raw = Array.isArray(arr) ? arr : [];
  }
  if (!Array.isArray(raw)) raw = [];
  return (raw as Partial<ScriptScene>[]).map(sanitizeScene).filter((s) => s.dialogue.length > 0);
}

/** Gemini가 불완전한 JSON을 반환할 수 있으므로 필수 필드에 기본값 보장 */
function sanitizeScene(scene: Partial<ScriptScene>, idx: number): ScriptScene {
  const rawDialogue = Array.isArray(scene.dialogue) ? scene.dialogue : [];
  return {
    sceneNumber: scene.sceneNumber ?? idx + 1,
    sceneType: scene.sceneType ?? 'DIALOGUE',
    composition: scene.composition ?? 'TWO_SHOT',
    setting: scene.setting ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dialogue: rawDialogue
      .filter((d: any) => d != null && typeof d === 'object')
      .map((d: any) => ({
        speaker: String(d.speaker ?? 'KR'),
        text: String(d.text ?? ''),
        emotion: (d.emotion as ScriptScene['dialogue'][0]['emotion']) ?? 'NEUTRAL',
        animation: (d.animation as ScriptScene['dialogue'][0]['animation']) ?? 'BOUNCE',
      })),
    directorNote: scene.directorNote ?? '',
    durationSec: scene.durationSec ?? 3,
  };
}

// ===== generateEpisodePlan (브라우저) =====

export async function clientGeneratePlan(
  title: string,
  facts: string[]
): Promise<EpisodePlan> {
  const ai = getAI();

  const prompt = `당신은 컨트리볼 숏츠 시나리오 기획 전문가입니다.

## 소재 정보
제목: ${title}
핵심 팩트:
${facts.map((f, i) => (i + 1) + '. ' + f).join('\n')}

## 기획 규칙
- 한국볼이 주인공, 외국 캐릭터 2-3개
- 모든 캐릭터는 100% 자연스러운 한국어로 대화
- 억지 말투 금지 ("~문이다", "스미마생" 등)
- (혼잣말) 활용으로 마무리 개그

## 🔥 "무시→성장→인정" 국뽕 4막 공식 (필수!)
- 1막 훅: 외국이 한국을 무시/비웃음/깔봄 → 시청자 분노 유발
- 2막 전개: 한국이 조용히 실력을 보여주기 시작 → 외국 당황
- 3막 클라이맥스: 한국이 완전히 역전/압도 → 통쾌한 반전
- 4막 아웃트로: 외국이 진심으로 인정 → "(혼잣말) 이 나라 대단해..."
→ 처음 무시와 마지막 인정의 극적 대비가 핵심 카타르시스!

응답은 반드시 다음 JSON 형식으로만 출력하세요:
{
  "title": "에피소드 제목 (20~35자)",
  "synopsis": "2-3문장 줄거리",
  "cast": [
    { "countryCode": "KR", "role": "주인공", "personality": "성격 설명" }
  ],
  "actStructure": ["1막: ...", "2막: ...", "3막: ...", "4막: ..."],
  "comedyBeats": ["개그 포인트 1", "개그 포인트 2", "개그 포인트 3"],
  "koreaWinMoment": "한국이 빛나는 순간"
}`;

  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseJsonSafe<EpisodePlan>(text, {
    title,
    synopsis: '',
    cast: [],
    actStructure: [],
    comedyBeats: [],
    koreaWinMoment: '',
  });
}

// ===== findTopicCandidates (브라우저 — Google Search grounding) =====

export async function clientFindTopics(
  page: number,
  keyword?: string,
  usedTopics: string[] = []
): Promise<TopicCandidate[]> {
  const apiKey = getApiKey();

  const isFirstPage = page === 1;
  const itemCount = isFirstPage ? 30 : 25;
  const blacklist =
    usedTopics.length > 0
      ? '\n\n🚫 이미 사용한 소재 (절대 중복 금지):\n' + usedTopics.map((t) => '- ' + t).join('\n')
      : '';

  let phasePrompt: string;

  if (keyword) {
    phasePrompt = '"' + keyword + '" 키워드로 깊게 파고들어서 컨트리볼 숏츠 소재 ' + itemCount + '개를 찾아주세요.';
  } else {
    const phaseNumber = ((page - 1) % 4) + 1;
    const phases: Record<number, string> = {
      1: '실시간 핫 트렌드에서 컨트리볼 숏츠 소재 ' + itemCount + '개를 찾아주세요. 훈훈/호기심/공감/국뽕 균형.',
      2: '국내 커뮤니티 해외반응에서 컨트리볼 숏츠 소재 ' + itemCount + '개를 찾아주세요.',
      3: 'Reddit, 해외 포럼에서 한국에 대한 외국인 반응 소재 ' + itemCount + '개를 찾아주세요.',
      4: '밀리터리/테크/미스터리 틈새 분야에서 한국 관련 소재 ' + itemCount + '개를 찾아주세요.',
    };
    phasePrompt = phases[phaseNumber] ?? phases[1];
  }

  const prompt = '당신은 한국 컨트리볼 숏츠 유튜브 채널의 소재 발굴 전문가입니다.\n구글 검색으로 최신 정보를 바탕으로 소재를 찾아주세요.\n\n' +
    phasePrompt + blacklist +
    '\n\n응답은 반드시 JSON 배열로만 출력 (마크다운 없이):\n' +
    '[{"title":"소재 제목","oneLiner":"한 줄 설명","keyFacts":["팩트1","팩트2"],"countriesInvolved":["KR","US"],"koreaAngle":"한국 각도","humorPotential":"유머 포인트","sourceHint":"출처"}]';

  // Google Search grounding은 새 SDK(@google/genai) 필요
  const { GoogleGenAI } = await importGenAIWeb();
  const genAI = new GoogleGenAI({ apiKey });

  const resp = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = resp.text ?? '';
  return parseJsonSafe<TopicCandidate[]>(text, []);
}

// ===== findSimilarTopics (브라우저) =====

export async function clientFindSimilarTopics(
  sourceTopic: string,
  usedTopics: string[] = []
): Promise<TopicCandidate[]> {
  const ai = getAI();

  const blacklist =
    usedTopics.length > 0
      ? '\n\n🚫 이미 사용한 소재:\n' + usedTopics.map((t) => '- ' + t).join('\n')
      : '';

  const prompt = '원본 소재: "' + sourceTopic + '"\n\n' +
    '이 소재와 동일한 바이럴 패턴의 유사 소재 6개를 발굴해주세요.' + blacklist +
    '\n\n응답은 JSON 배열로만 (마크다운 없이):\n' +
    '[{"title":"소재 제목","oneLiner":"한 줄 설명","keyFacts":["팩트1","팩트2"],"countriesInvolved":["KR","US"],"koreaAngle":"한국 각도","humorPotential":"유머 포인트","sourceHint":"출처"}]';

  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseJsonSafe<TopicCandidate[]>(text, []);
}

// ===== generateSceneImage (브라우저) =====

export async function clientGenerateSceneImage(
  scene: ScriptScene,
  characterDescription: string
): Promise<string> {
  const apiKey = getApiKey();
  const { GoogleGenAI } = await importGenAIWeb();
  const genAI = new GoogleGenAI({ apiKey });

  const primaryLine = scene.dialogue[0];
  const speaker = primaryLine?.speaker ?? 'KR';
  const emotion = primaryLine?.emotion ?? 'NEUTRAL';

  const EMOTION_EYES: Record<string, string> = {
    HAPPY: 'eyes squinting happily (^^)',
    ANGRY: 'eyes angled inward V-shape, angry',
    SAD: 'eyes drooping downward, teardrop',
    SURPRISED: 'HUGE wide circle eyes, tiny pupils',
    NEUTRAL: 'simple calm white oval eyes',
  };

  const eyeDesc = EMOTION_EYES[emotion] ?? EMOTION_EYES.NEUTRAL;

  const prompt = 'Draw a classic Polandball meme scene. 9:16 vertical.\n\n' +
    'RULES: Characters are SPHERES with flag patterns. Eyes are ONLY white ovals with black dots. ' +
    'NO arms, NO legs, NO hands, NO mouth. Thick black outlines. Flat meme colors. Simple background.\n\n' +
    'Main character: ' + speaker + ' countryball, ' + eyeDesc + '\n' +
    'Scene: ' + (scene.setting ?? '') + '\n' +
    'Characters: ' + characterDescription + '\n\n' +
    'NO TEXT, NO WORDS, NO NUMBERS.';

  const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];

  for (const model of IMAGE_MODELS) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          return 'data:' + mime + ';base64,' + part.inlineData.data;
        }
      }
    } catch (err) {
      console.warn('[clientGenerateSceneImage] ' + model + ' failed:', err);
    }
  }

  throw new Error('이미지 생성 실패: 모든 모델에서 이미지를 받지 못했습니다.');
}

// ===== generateCharacterBaseImage (브라우저) =====

export async function clientGenerateCharacterImage(
  masterPrompt: string
): Promise<string> {
  const apiKey = getApiKey();
  const { GoogleGenAI } = await importGenAIWeb();
  const genAI = new GoogleGenAI({ apiKey });

  const prompt = 'Draw a classic Polandball character. Simple meme style.\n\n' +
    'STRICT RULES:\n' +
    '1. SPHERE with national flag pattern\n' +
    '2. Eyes: ONLY white ovals with black dots. NO iris, NO anime eyes\n' +
    '3. NO arms, NO legs, NO hands, NO mouth\n' +
    '4. Thick black outline, flat colors\n' +
    '5. Plain white background\n\n' +
    'Character: ' + masterPrompt + '\n\n' +
    'NO TEXT, NO WORDS.';

  const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];

  for (const model of IMAGE_MODELS) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          return 'data:' + mime + ';base64,' + part.inlineData.data;
        }
      }
    } catch (err) {
      console.warn('[clientGenerateCharacterImage] ' + model + ' failed:', err);
    }
  }

  throw new Error('캐릭터 이미지 생성 실패');
}

// ===== generateYouTubeSEO (브라우저) =====

export async function clientGenerateSEO(
  plan: EpisodePlan,
  scenes: ScriptScene[]
): Promise<YouTubeSEO> {
  const ai = getAI();

  const castSummary = plan.cast.map((c) => c.countryCode + ' (' + c.role + ')').join(', ');
  const dialogueSummary = scenes
    .flatMap((s) => s.dialogue.map((d) => d.speaker + ': ' + d.text))
    .slice(0, 30)
    .join('\n');

  const prompt = '당신은 한국 컨트리볼 유튜브 쇼츠 SEO 전문가입니다.\n\n' +
    '## 에피소드 정보\n제목: ' + plan.title + '\n줄거리: ' + plan.synopsis +
    '\n출연진: ' + castSummary + '\n한국 하이라이트: ' + plan.koreaWinMoment +
    '\n\n## 대본 요약\n' + dialogueSummary +
    '\n\n## 생성 항목\n' +
    '1. titles: 바이럴 제목 5개 (20~35자, 호기심 유발)\n' +
    '2. description: 쇼츠 설명문 (500자 이내)\n' +
    '3. tags: 태그 30개 (한국어 20 + 영어 10)\n' +
    '4. thumbnailTexts: 썸네일 텍스트 3개 (15자 이내)\n' +
    '5. hashtags: 해시태그 5개\n' +
    '6. hookLine: 첫 1초 훅 멘트 (20자 이내)\n' +
    '7. category: YouTube 카테고리\n\n' +
    'JSON으로만 응답 (마크다운 없이):\n' +
    '{"titles":[],"description":"","tags":[],"thumbnailTexts":[],"hashtags":[],"hookLine":"","category":""}';

  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseJsonSafe<YouTubeSEO>(text, {
    titles: [], description: '', tags: [], thumbnailTexts: [],
    hashtags: [], hookLine: '', category: '',
  });
}
