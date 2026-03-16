/**
 * tts.ts
 * Edge TTS 음성 합성 서비스
 *
 * Microsoft Edge TTS를 백엔드로 사용하여 API Key 없이 무료로
 * 텍스트를 음성으로 변환합니다.
 *
 * 사용법:
 *   const blob = await generateTTS('안녕하세요', 'ko-KR-SunHiNeural');
 *   const voice = getVoiceForCountry('KR');
 */

// ============================================================
// 국가 코드 → Edge TTS 음성 매핑
// ============================================================

export type EdgeTtsGender = 'female' | 'male';

export interface EdgeTtsVoice {
  /** Edge TTS ShortName (e.g., "ko-KR-SunHiNeural") */
  voiceId: string;
  /** 언어 코드 (e.g., "ko-KR") */
  locale: string;
  /** 성별 */
  gender: EdgeTtsGender;
  /** 표시 이름 */
  displayName: string;
}

/** 국가 코드 → 기본 음성 매핑 (female 우선) */
const COUNTRY_VOICE_MAP: Record<string, EdgeTtsVoice> = {
  KR: { voiceId: 'ko-KR-SunHiNeural',       locale: 'ko-KR', gender: 'female', displayName: '한국 (여성)' },
  US: { voiceId: 'en-US-JennyNeural',        locale: 'en-US', gender: 'female', displayName: '미국 (여성)' },
  GB: { voiceId: 'en-GB-SoniaNeural',        locale: 'en-GB', gender: 'female', displayName: '영국 (여성)' },
  JP: { voiceId: 'ja-JP-NanamiNeural',       locale: 'ja-JP', gender: 'female', displayName: '일본 (여성)' },
  CN: { voiceId: 'zh-CN-XiaoxiaoNeural',     locale: 'zh-CN', gender: 'female', displayName: '중국 (여성)' },
  RU: { voiceId: 'ru-RU-SvetlanaNeural',     locale: 'ru-RU', gender: 'female', displayName: '러시아 (여성)' },
  DE: { voiceId: 'de-DE-KatjaNeural',        locale: 'de-DE', gender: 'female', displayName: '독일 (여성)' },
  FR: { voiceId: 'fr-FR-DeniseNeural',       locale: 'fr-FR', gender: 'female', displayName: '프랑스 (여성)' },
  IT: { voiceId: 'it-IT-ElsaNeural',         locale: 'it-IT', gender: 'female', displayName: '이탈리아 (여성)' },
  ES: { voiceId: 'es-ES-ElviraNeural',       locale: 'es-ES', gender: 'female', displayName: '스페인 (여성)' },
  CA: { voiceId: 'en-CA-ClaraNeural',        locale: 'en-CA', gender: 'female', displayName: '캐나다 (여성)' },
  AU: { voiceId: 'en-AU-NatashaNeural',      locale: 'en-AU', gender: 'female', displayName: '호주 (여성)' },
  BR: { voiceId: 'pt-BR-FranciscaNeural',    locale: 'pt-BR', gender: 'female', displayName: '브라질 (여성)' },
  IN: { voiceId: 'hi-IN-SwaraNeural',        locale: 'hi-IN', gender: 'female', displayName: '인도 (여성)' },
  MX: { voiceId: 'es-MX-DaliaNeural',        locale: 'es-MX', gender: 'female', displayName: '멕시코 (여성)' },
  SE: { voiceId: 'sv-SE-SofieNeural',        locale: 'sv-SE', gender: 'female', displayName: '스웨덴 (여성)' },
  NO: { voiceId: 'nb-NO-PernilleNeural',     locale: 'nb-NO', gender: 'female', displayName: '노르웨이 (여성)' },
  SA: { voiceId: 'ar-SA-ZariyahNeural',      locale: 'ar-SA', gender: 'female', displayName: '사우디 (여성)' },
  TR: { voiceId: 'tr-TR-EmelNeural',         locale: 'tr-TR', gender: 'female', displayName: '터키 (여성)' },
  // 북한은 표준 한국어 음성으로 대체 (별도 음성 없음)
  KP: { voiceId: 'ko-KR-InJoonNeural',       locale: 'ko-KR', gender: 'male',   displayName: '북한 (남성 한국어)' },
};

/** 국가별 남성 음성 대안 */
const COUNTRY_MALE_VOICE_MAP: Partial<Record<string, EdgeTtsVoice>> = {
  KR: { voiceId: 'ko-KR-InJoonNeural',       locale: 'ko-KR', gender: 'male',   displayName: '한국 (남성)' },
  US: { voiceId: 'en-US-GuyNeural',          locale: 'en-US', gender: 'male',   displayName: '미국 (남성)' },
  GB: { voiceId: 'en-GB-RyanNeural',         locale: 'en-GB', gender: 'male',   displayName: '영국 (남성)' },
  JP: { voiceId: 'ja-JP-KeitaNeural',        locale: 'ja-JP', gender: 'male',   displayName: '일본 (남성)' },
  CN: { voiceId: 'zh-CN-YunxiNeural',        locale: 'zh-CN', gender: 'male',   displayName: '중국 (남성)' },
  RU: { voiceId: 'ru-RU-DmitryNeural',       locale: 'ru-RU', gender: 'male',   displayName: '러시아 (남성)' },
  DE: { voiceId: 'de-DE-ConradNeural',       locale: 'de-DE', gender: 'male',   displayName: '독일 (남성)' },
  FR: { voiceId: 'fr-FR-HenriNeural',        locale: 'fr-FR', gender: 'male',   displayName: '프랑스 (남성)' },
};

/** 기본 폴백 음성 (국가 매핑 없을 경우) */
const DEFAULT_VOICE = COUNTRY_VOICE_MAP['KR'];

// ============================================================
// 공개 API
// ============================================================

/**
 * 국가 코드로 Edge TTS 음성을 반환합니다.
 *
 * @param countryCode - ISO 3166-1 alpha-2 국가 코드 (예: 'KR', 'US')
 * @param gender - 'female'(기본) 또는 'male'
 */
export function getVoiceForCountry(
  countryCode: string,
  gender: EdgeTtsGender = 'female'
): EdgeTtsVoice {
  const code = countryCode.toUpperCase();
  if (gender === 'male') {
    return COUNTRY_MALE_VOICE_MAP[code] ?? COUNTRY_VOICE_MAP[code] ?? DEFAULT_VOICE;
  }
  return COUNTRY_VOICE_MAP[code] ?? DEFAULT_VOICE;
}

/**
 * 국가 코드에 해당하는 voiceId 문자열만 반환합니다.
 *
 * @param countryCode - ISO 3166-1 alpha-2 국가 코드
 * @param gender - 'female'(기본) 또는 'male'
 */
export function getVoiceIdForCountry(
  countryCode: string,
  gender: EdgeTtsGender = 'female'
): string {
  return getVoiceForCountry(countryCode, gender).voiceId;
}

/**
 * 텍스트를 Edge TTS로 변환하여 오디오 Blob을 반환합니다.
 *
 * Next.js API 라우트 /api/tts 를 경유합니다.
 *
 * @param text - 변환할 텍스트
 * @param voice - Edge TTS ShortName (e.g., 'ko-KR-SunHiNeural'), 미지정 시 한국어 여성
 * @returns audio/mp3 Blob
 */
export async function generateTTS(
  text: string,
  voice?: string
): Promise<Blob> {
  if (!text.trim()) {
    // 빈 텍스트는 빈 Blob 반환
    return new Blob([], { type: 'audio/mpeg' });
  }

  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.trim(),
      voice: voice ?? DEFAULT_VOICE.voiceId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => response.statusText);
    throw new Error(`[TTS] 음성 생성 실패 (${response.status}): ${errorBody}`);
  }

  return response.blob();
}

/**
 * 텍스트를 음성으로 변환하고 재생 가능한 blob: URL을 반환합니다.
 * 사용 후 반드시 URL.revokeObjectURL(url) 을 호출하세요.
 *
 * @param text - 변환할 텍스트
 * @param voice - Edge TTS ShortName
 */
export async function generateTTSUrl(
  text: string,
  voice?: string
): Promise<string> {
  const blob = await generateTTS(text, voice);
  return URL.createObjectURL(blob);
}

/**
 * 국가 코드로 TTS를 바로 생성합니다.
 *
 * @param text - 변환할 텍스트
 * @param countryCode - ISO 3166-1 alpha-2 국가 코드
 * @param gender - 'female'(기본) 또는 'male'
 */
export async function generateTTSForCountry(
  text: string,
  countryCode: string,
  gender: EdgeTtsGender = 'female'
): Promise<Blob> {
  const voice = getVoiceIdForCountry(countryCode, gender);
  return generateTTS(text, voice);
}

/**
 * 지원되는 모든 국가-음성 매핑 목록을 반환합니다.
 */
export function getAllVoiceMappings(): Array<{ countryCode: string } & EdgeTtsVoice> {
  return Object.entries(COUNTRY_VOICE_MAP).map(([countryCode, voice]) => ({
    countryCode,
    ...voice,
  }));
}
