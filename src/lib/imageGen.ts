import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { CompositionType, EmotionType } from './types';

// 2026-03 기준 사용 가능한 이미지 생성 모델 (우선순위 순)
const IMAGE_GEN_MODELS = [
  'gemini-2.5-flash-image',            // Stable — 검증된 이미지 생성 모델
  'gemini-3.1-flash-image-preview',    // Nano Banana 2 — 최신, 4K, 빠름
];

function getAI(apiKey?: string): GoogleGenAI {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  return new GoogleGenAI({ apiKey: key });
}

function extractBase64FromResponse(response: GenerateContentResponse): string | null {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

// ===== 감정별 눈 모양 (클래식 폴란드볼 — 흰 눈 + 검은 점만) =====

const EMOTION_EYES: Record<EmotionType, string> = {
  HAPPY: 'Eyes are small white ovals, squinting happily into curved lines (^^). The whole ball tilts slightly upward.',
  ANGRY: 'Eyes are white ovals with tiny black dots, angled inward like a V-shape (angry brow effect using the eye shape itself). The ball is slightly red-tinted or trembling.',
  SAD: 'Eyes are white ovals with tiny black dots looking downward. A single blue teardrop under one eye. The ball sags slightly downward.',
  SURPRISED: 'Eyes are HUGE white circles (taking up 30% of the face) with tiny pinpoint black dots in the center. The ball is slightly lifted off the ground with shock lines around it.',
  NEUTRAL: 'Eyes are simple white ovals with centered black dots. Calm, default expression.',
};

const EMOTION_BODY: Record<EmotionType, string> = {
  HAPPY: 'Ball is bouncing slightly upward with tiny motion lines below.',
  ANGRY: 'Ball is puffed up bigger than normal, vibrating with small shake lines.',
  SAD: 'Ball is deflated slightly, sitting lower in the frame.',
  SURPRISED: 'Ball has jumped upward with a gap below it, shock lines radiating outward.',
  NEUTRAL: 'Ball resting calmly on the ground.',
};

const COMPOSITION_LAYOUT: Record<CompositionType, string> = {
  SOLO: 'Single ball centered, taking up 50-60% of the frame.',
  TWO_SHOT: 'Two balls facing each other. The speaking ball is slightly bigger.',
  ONE_VS_MANY: 'One ball on one side vs 3+ smaller balls on the other side.',
  TEAM: 'Two groups of balls on opposite sides.',
};

// ===== 1. generateCharacterBaseImage =====

export async function generateCharacterBaseImage(
  masterPrompt: string,
  apiKey?: string
): Promise<string> {
  const ai = getAI(apiKey);

  const prompt = `Draw a classic Polandball / Countryball character. This is a meme-style illustration.

STRICT RULES — follow these EXACTLY:
1. The character is a SPHERE (circle/ball shape) painted with the national flag
2. Eyes are ONLY simple white ovals with small black dots inside. NO pupils, NO iris, NO colored eyes, NO anime eyes
3. ABSOLUTELY NO arms, NO legs, NO hands, NO feet, NO limbs of any kind
4. ABSOLUTELY NO mouth. Expression is ONLY through eye shape and body position
5. Thick black outline around the ball
6. Flat colors, clean and simple like an internet meme comic
7. NO accessories, NO hats, NO clothes, NO items on the character

BACKGROUND: Plain white or very simple single color. Nothing else.

COMPOSITION: Ball centered, taking up 60% of the frame.

NO TEXT, NO WORDS, NO NUMBERS, NO WATERMARKS.

Character: ${masterPrompt}`;

  for (const model of IMAGE_GEN_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      const dataUrl = extractBase64FromResponse(response);
      if (dataUrl) {
        return dataUrl;
      }

      console.warn(`[imageGen] ${model}: 이미지 데이터 없음, 다음 모델 시도`);
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || 'unknown';
      console.error(`[imageGen] ${model} 실패: ${errMsg}`);
    }
  }

  console.error('[imageGen] generateCharacterBaseImage: 모든 모델 실패. 시도한 모델:', IMAGE_GEN_MODELS.join(', '));
  return '';
}

// ===== 2. generateSceneImage =====

export async function generateSceneImage(
  visualCue: string,
  composition: CompositionType,
  speaker: string,
  emotion: EmotionType,
  characterDescription?: string,
  apiKey?: string
): Promise<string> {
  const ai = getAI(apiKey);

  const eyePrompt = EMOTION_EYES[emotion] ?? EMOTION_EYES.NEUTRAL;
  const bodyPrompt = EMOTION_BODY[emotion] ?? EMOTION_BODY.NEUTRAL;
  const layoutPrompt = COMPOSITION_LAYOUT[composition] ?? COMPOSITION_LAYOUT.SOLO;
  const charDesc = characterDescription ?? 'A countryball with their national flag pattern.';

  const prompt = `Draw a Polandball / Countryball meme scene. Vertical 9:16 aspect ratio.

STRICT CHARACTER RULES — follow these EXACTLY for EVERY ball in the scene:
1. Characters are SPHERES (circles) painted with national flag patterns
2. Eyes are ONLY simple white ovals with small black dots. NO pupils, NO iris, NO anime eyes, NO detailed eyes
3. ABSOLUTELY NO arms, NO legs, NO hands, NO feet, NO limbs of any kind
4. ABSOLUTELY NO mouth on any character. Expression ONLY through eye shape
5. Thick black outline around each ball
6. Flat meme-style colors, clean and simple

COMPOSITION: ${composition}
${layoutPrompt}

MAIN CHARACTER: ${speaker} countryball
${eyePrompt}
${bodyPrompt}
Character: ${charDesc}

SCENE: ${visualCue}

BACKGROUND: Simple and minimal. A flat color or basic shapes to suggest the setting.
Props (if needed) should be drawn in the same flat meme style.

STYLE: Classic internet Polandball comic. Intentionally simple, charming, humorous.

NO TEXT, NO SPEECH BUBBLES, NO LABELS, NO WORDS, NO NUMBERS anywhere.`;

  for (const model of IMAGE_GEN_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      const dataUrl = extractBase64FromResponse(response);
      if (dataUrl) {
        return dataUrl;
      }

      console.warn(`[imageGen] ${model}: 씬 이미지 데이터 없음, 다음 모델 시도`);
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || 'unknown';
      console.error(`[imageGen] ${model} 씬 이미지 실패: ${errMsg}`);
    }
  }

  console.error('[imageGen] generateSceneImage: 모든 모델 실패. 시도한 모델:', IMAGE_GEN_MODELS.join(', '));
  return '';
}

// ===== 3. generateInsertImage =====

export async function generateInsertImage(
  imagePrompt: string,
  apiKey?: string
): Promise<string> {
  const ai = getAI(apiKey);

  const prompt = `Vivid realism style, vertical 9:16 aspect ratio.
No text, no watermarks, no logos.
${imagePrompt}`;

  for (const model of IMAGE_GEN_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      const dataUrl = extractBase64FromResponse(response);
      if (dataUrl) {
        return dataUrl;
      }

      console.warn(`[imageGen] ${model}: 삽입 이미지 데이터 없음, 다음 모델 시도`);
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || 'unknown';
      console.error(`[imageGen] ${model} 삽입 이미지 실패: ${errMsg}`);
    }
  }

  console.error('[imageGen] generateInsertImage: 모든 모델 실패');
  return '';
}
