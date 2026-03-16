'use client';

/**
 * 브라우저에서 직접 Gemini API를 호출하는 클라이언트 모듈.
 * Vercel 서버리스 타임아웃(10~30초)을 우회하기 위해 사용.
 * API 키는 localStorage에서 가져옴.
 */

import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { EpisodePlan, ScriptScene } from './types';

function getApiKey(): string {
  const key = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  if (!key) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
  return key;
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

### 4막 구조 (각 막 2-4개 대사)
1. 훅: 시청자가 1초 안에 멈추게 하는 충격적 첫 대사
2. 전개: 상황 설명, 대립 구도 형성
3. 클라이맥스: 한국 활약/반전, 코리아 플렉스
4. 아웃트로: 외국 반응 (혼잣말 활용!), 통쾌한 마무리

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

  return parseJsonSafe<ScriptScene[]>(text, []);
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
- 모든 캐릭터는 100% 한국어로 대화
- 억지 말투 금지 ("~문이다", "스미마생" 등)
- (혼잣말) 활용으로 마무리 개그
- 4막 구조: 훅 → 전개 → 클라이맥스 → 아웃트로

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
