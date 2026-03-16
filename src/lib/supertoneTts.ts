/**
 * supertoneTts.ts
 * Supertone Cloud TTS 음성 합성 서비스
 *
 * Supertone API를 사용하여 고품질 한국어 TTS를 생성합니다.
 * API Key 필요: https://supertoneapi.com
 *
 * 사용법:
 *   const buf = await generateSupertoneTTS('안녕하세요', 'Adam', 'neutral', 1.0, apiKey);
 *   const voiceId = getSupertoneVoiceForCountry('KR');
 */

import type { EmotionType } from './types';

// ============================================================
// 상수
// ============================================================

export const SUPERTONE_BASE_URL = 'https://supertoneapi.com/v1';

/** 허용 최대 텍스트 길이 */
export const SUPERTONE_MAX_TEXT_LENGTH = 500;

// ============================================================
// 음성 정의
// ============================================================

export interface SupertoneVoice {
  voiceId: string;
  label: string;
  gender: 'male' | 'female';
}

/** 알려진 Supertone 음성 프리셋 */
export const SUPERTONE_VOICES: Record<string, SupertoneVoice> = {
  Adam:   { voiceId: 'Adam',   label: '부드러운 남성',  gender: 'male' },
  James:  { voiceId: 'James',  label: '중후한 남성',    gender: 'male' },
  Haneul: { voiceId: 'Haneul', label: '차분한 남성',    gender: 'male' },
  Bella:  { voiceId: 'Bella',  label: '젊은 여성',      gender: 'female' },
  Sumin:  { voiceId: 'Sumin',  label: '성인 여성',      gender: 'female' },
  Ara:    { voiceId: 'Ara',    label: '클래식 여성',    gender: 'female' },
  Bora:   { voiceId: 'Bora',   label: '밝은 여성',      gender: 'female' },
  Dami:   { voiceId: 'Dami',   label: '부드러운 여성',  gender: 'female' },
};

// ============================================================
// 국가 코드 → 음성 매핑
// ============================================================

/** 국가 코드 → Supertone 음성 매핑 */
export const COUNTRY_SUPERTONE_MAP: Record<string, string> = {
  KR: 'Adam',
  US: 'James',
  JP: 'Haneul',
  CN: 'James',
  RU: 'James',
  GB: 'James',
  FR: 'Haneul',
  DE: 'James',
  IT: 'Adam',
  ES: 'Adam',
  CA: 'Adam',
  AU: 'James',
  BR: 'Adam',
  IN: 'Haneul',
  MX: 'Adam',
  SE: 'Haneul',
  NO: 'Haneul',
  SA: 'James',
  TR: 'Adam',
  KP: 'Haneul',
  DEFAULT: 'Adam',
};

// ============================================================
// 감정 → Supertone 스타일 매핑
// ============================================================

const EMOTION_STYLE_MAP: Record<EmotionType, string> = {
  HAPPY:     'happy',
  ANGRY:     'angry',
  SAD:       'sad',
  SURPRISED: 'surprised',
  NEUTRAL:   'neutral',
};

// ============================================================
// 공개 API
// ============================================================

/**
 * 국가 코드에 해당하는 Supertone 음성 ID를 반환합니다.
 *
 * @param countryCode - ISO 3166-1 alpha-2 국가 코드 (예: 'KR', 'US')
 */
export function getSupertoneVoiceForCountry(countryCode: string): string {
  const code = countryCode.toUpperCase();
  return COUNTRY_SUPERTONE_MAP[code] ?? COUNTRY_SUPERTONE_MAP.DEFAULT;
}

/**
 * 국가 코드에 해당하는 Supertone 음성 레이블을 반환합니다.
 *
 * @param countryCode - ISO 3166-1 alpha-2 국가 코드
 */
export function getSupertoneVoiceLabelForCountry(countryCode: string): string {
  const voiceId = getSupertoneVoiceForCountry(countryCode);
  return SUPERTONE_VOICES[voiceId]?.label ?? '기본 남성';
}

/**
 * Supertone API 음성 목록을 조회합니다.
 *
 * @param apiKey - Supertone API 키
 */
export async function listSupertoneVoices(
  apiKey: string
): Promise<{ name: string; voice_id: string; styles: string[]; models: string[] }[]> {
  const response = await fetch(`${SUPERTONE_BASE_URL}/voices`, {
    headers: {
      'x-sup-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`[SupertoneTTS] 음성 목록 조회 실패: HTTP ${response.status}`);
  }

  const data = await response.json() as { items: { name: string; voice_id: string; styles: string[]; models: string[] }[] };
  return data.items ?? [];
}

/**
 * Supertone TTS로 텍스트를 음성 변환하여 WAV Buffer를 반환합니다.
 *
 * @param text - 변환할 텍스트
 * @param voiceId - Supertone 음성 ID (예: 'Adam', 'Bella')
 * @param emotion - 감정 타입 (스타일로 변환)
 * @param speed - 재생 속도 (기본값: 1.0)
 * @param apiKey - Supertone API 키
 * @returns audio/wav Buffer
 */
export async function generateSupertoneTTS(
  text: string,
  voiceId: string,
  emotion: EmotionType = 'NEUTRAL',
  speed: number = 1.0,
  apiKey: string
): Promise<Buffer> {
  if (!apiKey) {
    throw new Error('[SupertoneTTS] API 키가 없습니다.');
  }

  const style = EMOTION_STYLE_MAP[emotion] ?? 'neutral';
  const clampedSpeed = Math.min(2.0, Math.max(0.5, speed));

  const response = await fetch(`${SUPERTONE_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sup-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      language: 'ko',
      style,
      speed: clampedSpeed,
      model: 'sona_speech_1',
      format: 'wav',
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error('[SupertoneTTS] API 키가 유효하지 않습니다.');
    }
    throw new Error(`[SupertoneTTS] 음성 합성 실패: HTTP ${status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
