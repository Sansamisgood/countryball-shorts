/**
 * geminiTts.ts
 * Gemini 2.5 Flash TTS 음성 합성 서비스
 *
 * Google Gemini 2.5 Flash Preview TTS를 사용하여 고품질로
 * 텍스트를 음성으로 변환합니다. API Key 필요.
 *
 * 사용법:
 *   const buf = await generateGeminiTTS('안녕하세요', 'Charon', 'HAPPY', apiKey);
 *   const voice = getGeminiVoiceForCountry('KR');
 */

import { GoogleGenAI } from '@google/genai';
import type { EmotionType } from './types';

// ============================================================
// 상수
// ============================================================

const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/** WAV 파일 사양: Gemini TTS 출력 형식 */
const WAV_SAMPLE_RATE = 24000;
const WAV_BITS_PER_SAMPLE = 16;
const WAV_NUM_CHANNELS = 1;

// ============================================================
// 음성 정의
// ============================================================

export interface GeminiVoice {
  voiceId: string;
  displayName: string;
  gender: 'female' | 'male';
  description: string;
}

export const GEMINI_VOICES: GeminiVoice[] = [
  // ── 여성 (13) ──────────────────────────────────────────────
  { voiceId: 'Achernar',     gender: 'female', displayName: 'Achernar',     description: '차분하고 정돈된 톤' },
  { voiceId: 'Aoede',        gender: 'female', displayName: 'Aoede',        description: '밝고 상냥한 목소리' },
  { voiceId: 'Autonoe',      gender: 'female', displayName: 'Autonoe',      description: '부드러운 나레이션' },
  { voiceId: 'Callirrhoe',   gender: 'female', displayName: 'Callirrhoe',   description: '성숙하고 깊은 울림' },
  { voiceId: 'Despina',      gender: 'female', displayName: 'Despina',      description: '이지적이고 깔끔한 톤' },
  { voiceId: 'Erinome',      gender: 'female', displayName: 'Erinome',      description: '차분한 감성' },
  { voiceId: 'Kore',         gender: 'female', displayName: 'Kore',         description: '신뢰감 있는 표준 여성 (기본)' },
  { voiceId: 'Laomedeia',    gender: 'female', displayName: 'Laomedeia',    description: '우아하고 무게감' },
  { voiceId: 'Leda',         gender: 'female', displayName: 'Leda',         description: '단아하고 맑은 목소리' },
  { voiceId: 'Pulcherrima',  gender: 'female', displayName: 'Pulcherrima',  description: '경쾌하고 밝은' },
  { voiceId: 'Sulafat',      gender: 'female', displayName: 'Sulafat',      description: '따뜻하고 부드러운' },
  { voiceId: 'Vindemiatrix', gender: 'female', displayName: 'Vindemiatrix', description: '지적이고 날카로운' },
  { voiceId: 'Zephyr',       gender: 'female', displayName: 'Zephyr',       description: '맑고 지적인' },
  // ── 남성 (17) ──────────────────────────────────────────────
  { voiceId: 'Achird',         gender: 'male', displayName: 'Achird',         description: '부드러운 감성 남성' },
  { voiceId: 'Algenib',        gender: 'male', displayName: 'Algenib',        description: '깊고 중후한 울림' },
  { voiceId: 'Algieba',        gender: 'male', displayName: 'Algieba',        description: '차분하고 이지적' },
  { voiceId: 'Alnilam',        gender: 'male', displayName: 'Alnilam',        description: '단단하고 힘 있는' },
  { voiceId: 'Charon',         gender: 'male', displayName: 'Charon',         description: '중후하고 권위 있는 (기본 남성)' },
  { voiceId: 'Enceladus',      gender: 'male', displayName: 'Enceladus',      description: '단단하고 안정적' },
  { voiceId: 'Fenrir',         gender: 'male', displayName: 'Fenrir',         description: '강인하고 거친' },
  { voiceId: 'Gacrux',         gender: 'male', displayName: 'Gacrux',         description: '성숙하고 신뢰감' },
  { voiceId: 'Iapetus',        gender: 'male', displayName: 'Iapetus',        description: '부드럽고 따뜻한' },
  { voiceId: 'Orus',           gender: 'male', displayName: 'Orus',           description: '단단하고 낮은' },
  { voiceId: 'Puck',           gender: 'male', displayName: 'Puck',           description: '유쾌하고 활발한 청년' },
  { voiceId: 'Rasalgethi',     gender: 'male', displayName: 'Rasalgethi',     description: '정보 전달 최적화' },
  { voiceId: 'Sadachbia',      gender: 'male', displayName: 'Sadachbia',      description: '활기차고 낮은' },
  { voiceId: 'Sadaltager',     gender: 'male', displayName: 'Sadaltager',     description: '지식 있고 차분한' },
  { voiceId: 'Schedar',        gender: 'male', displayName: 'Schedar',        description: '안정적 무게감 저음' },
  { voiceId: 'Umbriel',        gender: 'male', displayName: 'Umbriel',        description: '편안하고 낮은' },
  { voiceId: 'Zubenelgenubi',  gender: 'male', displayName: 'Zubenelgenubi',  description: '나지막한 지적 저음' },
];

/** 국가 코드 → Gemini 음성 매핑 */
export const COUNTRY_GEMINI_VOICE_MAP: Record<string, { voiceId: string; label: string }> = {
  KR: { voiceId: 'Charon',        label: '한국 (중후한 남성)' },
  US: { voiceId: 'Fenrir',        label: '미국 (강인한)' },
  JP: { voiceId: 'Algieba',       label: '일본 (차분한)' },
  CN: { voiceId: 'Orus',          label: '중국 (낮은 톤)' },
  RU: { voiceId: 'Schedar',       label: '러시아 (무게감 저음)' },
  FR: { voiceId: 'Iapetus',       label: '프랑스 (부드러운)' },
  DE: { voiceId: 'Enceladus',     label: '독일 (안정적)' },
  GB: { voiceId: 'Gacrux',        label: '영국 (성숙한)' },
  IT: { voiceId: 'Sadaltager',    label: '이탈리아 (지적)' },
  ES: { voiceId: 'Algenib',       label: '스페인 (중후한)' },
  CA: { voiceId: 'Achird',        label: '캐나다 (부드러운)' },
  AU: { voiceId: 'Umbriel',       label: '호주 (편안한)' },
  BR: { voiceId: 'Sadachbia',     label: '브라질 (활기찬)' },
  IN: { voiceId: 'Rasalgethi',    label: '인도 (정보 전달형)' },
  MX: { voiceId: 'Puck',          label: '멕시코 (활발한)' },
  SE: { voiceId: 'Zephyr',        label: '스웨덴 (지적)' },
  NO: { voiceId: 'Leda',          label: '노르웨이 (맑은)' },
  SA: { voiceId: 'Zubenelgenubi', label: '사우디 (저음 지적)' },
  TR: { voiceId: 'Alnilam',       label: '터키 (힘 있는)' },
  KP: { voiceId: 'Orus',          label: '북한 (낮고 단단한)' },
  DEFAULT_MALE:   { voiceId: 'Charon', label: '기본 남성' },
  DEFAULT_FEMALE: { voiceId: 'Kore',   label: '기본 여성' },
};

// ============================================================
// 감정 → 톤 디렉티브 매핑
// ============================================================

const EMOTION_TONE_MAP: Record<EmotionType, string> = {
  HAPPY:     '밝고 신나는 톤으로',
  ANGRY:     '화가 나서 강하게',
  SAD:       '슬프고 축 처진 톤으로',
  SURPRISED: '깜짝 놀란 톤으로',
  NEUTRAL:   '평범하고 자연스럽게',
};

// ============================================================
// WAV 헤더 생성 유틸리티
// ============================================================

/**
 * 원시 PCM 버퍼에 WAV 헤더를 붙여 반환합니다.
 * Gemini TTS 출력: 24kHz, 16-bit, mono
 */
function buildWavBuffer(pcmBuffer: Buffer): Buffer {
  const dataSize = pcmBuffer.byteLength;
  const byteRate = WAV_SAMPLE_RATE * WAV_NUM_CHANNELS * (WAV_BITS_PER_SAMPLE / 8);
  const blockAlign = WAV_NUM_CHANNELS * (WAV_BITS_PER_SAMPLE / 8);
  const headerSize = 44;

  const header = Buffer.alloc(headerSize);
  let offset = 0;

  // RIFF chunk
  header.write('RIFF', offset);         offset += 4;
  header.writeUInt32LE(36 + dataSize, offset); offset += 4;
  header.write('WAVE', offset);         offset += 4;

  // fmt subchunk
  header.write('fmt ', offset);         offset += 4;
  header.writeUInt32LE(16, offset);     offset += 4; // subchunk size (PCM)
  header.writeUInt16LE(1, offset);      offset += 2; // AudioFormat: PCM
  header.writeUInt16LE(WAV_NUM_CHANNELS, offset);    offset += 2;
  header.writeUInt32LE(WAV_SAMPLE_RATE, offset);     offset += 4;
  header.writeUInt32LE(byteRate, offset);            offset += 4;
  header.writeUInt16LE(blockAlign, offset);          offset += 2;
  header.writeUInt16LE(WAV_BITS_PER_SAMPLE, offset); offset += 2;

  // data subchunk
  header.write('data', offset);         offset += 4;
  header.writeUInt32LE(dataSize, offset);

  return Buffer.concat([header, pcmBuffer]);
}

// ============================================================
// 공개 API
// ============================================================

/**
 * 국가 코드에 해당하는 Gemini 음성 ID를 반환합니다.
 *
 * @param countryCode - ISO 3166-1 alpha-2 국가 코드 (예: 'KR', 'US')
 */
export function getGeminiVoiceForCountry(countryCode: string): string {
  const code = countryCode.toUpperCase();
  return COUNTRY_GEMINI_VOICE_MAP[code]?.voiceId
    ?? COUNTRY_GEMINI_VOICE_MAP.DEFAULT_MALE.voiceId;
}

/**
 * 국가 코드에 해당하는 Gemini 음성 레이블을 반환합니다.
 *
 * @param countryCode - ISO 3166-1 alpha-2 국가 코드
 */
export function getGeminiVoiceLabelForCountry(countryCode: string): string {
  const code = countryCode.toUpperCase();
  return COUNTRY_GEMINI_VOICE_MAP[code]?.label
    ?? COUNTRY_GEMINI_VOICE_MAP.DEFAULT_MALE.label;
}

/**
 * Gemini 2.5 Flash TTS로 텍스트를 음성 변환하여 WAV Buffer를 반환합니다.
 *
 * @param text - 변환할 텍스트
 * @param voiceId - Gemini 음성 ID (예: 'Charon', 'Kore')
 * @param emotion - 감정 타입 (톤 디렉티브 자동 삽입)
 * @param apiKey - Gemini API 키 (미지정 시 환경변수 GEMINI_API_KEY 사용)
 * @returns audio/wav Buffer
 */
export async function generateGeminiTTS(
  text: string,
  voiceId: string,
  emotion?: EmotionType,
  apiKey?: string
): Promise<Buffer> {
  const key = apiKey ?? process.env.GEMINI_API_KEY ?? '';
  if (!key) {
    throw new Error('[GeminiTTS] API 키가 없습니다.');
  }

  // 감정 톤 디렉티브 조합
  const toneDirective = emotion ? EMOTION_TONE_MAP[emotion] : EMOTION_TONE_MAP.NEUTRAL;
  const promptText = `[${toneDirective}] ${text}`;

  const client = new GoogleGenAI({ apiKey: key });

  const response = await client.models.generateContent({
    model: GEMINI_TTS_MODEL,
    contents: promptText,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceId,
          },
        },
      },
    },
  });

  const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    throw new Error('[GeminiTTS] 응답에 오디오 데이터가 없습니다.');
  }

  const pcmBuffer = Buffer.from(inlineData.data, 'base64');
  return buildWavBuffer(pcmBuffer);
}
