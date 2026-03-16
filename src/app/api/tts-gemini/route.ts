export const maxDuration = 60;

/**
 * /api/tts-gemini
 * Gemini 2.5 Flash TTS 음성 합성 API 라우트
 *
 * Google Gemini 2.5 Flash Preview TTS를 사용하여
 * 텍스트를 WAV 오디오로 변환합니다. API Key 필요.
 *
 * POST /api/tts-gemini
 * Headers: x-api-key: <Gemini API Key>
 * Body: { text: string, countryCode?: string, emotion?: EmotionType, voiceId?: string }
 * Response: audio/wav blob
 *
 * GET /api/tts-gemini
 * Response: 헬스 체크 및 사용 가능 음성 목록
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateGeminiTTS, getGeminiVoiceForCountry, GEMINI_VOICES } from '@/lib/geminiTts';
import type { EmotionType } from '@/lib/types';

/** 허용 최대 텍스트 길이 */
const MAX_TEXT_LENGTH = 500;

/** 유효한 EmotionType 값 집합 */
const VALID_EMOTIONS = new Set<EmotionType>(['HAPPY', 'ANGRY', 'SAD', 'SURPRISED', 'NEUTRAL']);

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ---- API 키 확인 ----
  const apiKey = request.headers.get('x-api-key') ?? '';
  if (!apiKey.trim()) {
    return NextResponse.json(
      { error: { code: 'MISSING_API_KEY', message: 'x-api-key 헤더에 Gemini API 키를 제공하세요.' } },
      { status: 401 }
    );
  }

  // ---- 요청 파싱 ----
  let body: { text?: unknown; countryCode?: unknown; emotion?: unknown; voiceId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: '요청 본문이 유효한 JSON이 아닙니다.' } },
      { status: 400 }
    );
  }

  const { text, countryCode, emotion, voiceId } = body;

  // ---- 입력 검증 ----
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json(
      { error: { code: 'MISSING_TEXT', message: 'text 필드가 필요합니다.' } },
      { status: 400 }
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: {
          code: 'TEXT_TOO_LONG',
          message: `텍스트는 ${MAX_TEXT_LENGTH}자 이하여야 합니다. (현재: ${text.length}자)`,
        },
      },
      { status: 400 }
    );
  }

  // voiceId 우선, 없으면 countryCode로 조회, 둘 다 없으면 기본 남성 음성
  const resolvedVoiceId =
    (typeof voiceId === 'string' && voiceId.trim()) ? voiceId.trim()
    : (typeof countryCode === 'string' && countryCode.trim())
      ? getGeminiVoiceForCountry(countryCode.trim())
      : 'Charon';

  const resolvedEmotion: EmotionType | undefined =
    typeof emotion === 'string' && VALID_EMOTIONS.has(emotion as EmotionType)
      ? (emotion as EmotionType)
      : undefined;

  // ---- Gemini TTS 호출 ----
  try {
    const wavBuffer = await generateGeminiTTS(
      text.trim(),
      resolvedVoiceId,
      resolvedEmotion,
      apiKey
    );

    return new NextResponse(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wavBuffer.byteLength),
        // 동일 텍스트+음성 조합은 1시간 캐시
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/tts-gemini] Gemini TTS 오류:', message);

    // API 키 관련 오류 구분
    if (message.includes('API_KEY') || message.includes('401') || message.includes('403')) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_API_KEY',
            message: 'API 키가 유효하지 않습니다. 설정에서 Gemini API 키를 확인하세요.',
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'TTS_FAILED',
          message: '음성 합성에 실패했습니다. 잠시 후 다시 시도하세요.',
          details: [{ field: 'voice', issue: `요청 음성: ${resolvedVoiceId}` }],
        },
      },
      { status: 500 }
    );
  }
}

/** GET /api/tts-gemini - 헬스 체크 및 사용 가능 음성 목록 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    description: 'Gemini 2.5 Flash TTS API - 고품질 음성 합성 (API Key 필요)',
    model: 'gemini-2.5-flash-preview-tts',
    maxTextLength: MAX_TEXT_LENGTH,
    outputFormat: 'audio/wav (24kHz, 16-bit, mono)',
    usage: {
      method: 'POST',
      headers: { 'x-api-key': 'Gemini API Key (필수)' },
      body: {
        text: 'string (필수)',
        countryCode: 'string (선택, 예: KR)',
        emotion: 'HAPPY | ANGRY | SAD | SURPRISED | NEUTRAL (선택)',
        voiceId: 'string (선택, voiceId 직접 지정 시 countryCode 무시)',
      },
      response: 'audio/wav',
    },
    voices: GEMINI_VOICES,
  });
}
