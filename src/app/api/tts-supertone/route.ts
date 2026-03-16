export const maxDuration = 60;

/**
 * /api/tts-supertone
 * Supertone Cloud TTS 음성 합성 API 라우트
 *
 * Supertone API를 사용하여 텍스트를 WAV 오디오로 변환합니다.
 * Supertone API Key 필요.
 *
 * POST /api/tts-supertone
 * Headers: x-supertone-key: <Supertone API Key>
 * Body: { text: string, countryCode?: string, emotion?: EmotionType, voiceId?: string, speed?: number }
 * Response: audio/wav blob
 *
 * GET /api/tts-supertone
 * Response: 헬스 체크 및 사용 가능 음성 목록
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateSupertoneTTS,
  getSupertoneVoiceForCountry,
  SUPERTONE_VOICES,
  SUPERTONE_MAX_TEXT_LENGTH,
} from '@/lib/supertoneTts';
import type { EmotionType } from '@/lib/types';

/** 유효한 EmotionType 값 집합 */
const VALID_EMOTIONS = new Set<EmotionType>(['HAPPY', 'ANGRY', 'SAD', 'SURPRISED', 'NEUTRAL']);

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ---- API 키 확인 ----
  const apiKey = request.headers.get('x-supertone-key') ?? '';
  if (!apiKey.trim()) {
    return NextResponse.json(
      { error: { code: 'MISSING_API_KEY', message: 'x-supertone-key 헤더에 Supertone API 키를 제공하세요.' } },
      { status: 401 }
    );
  }

  // ---- 요청 파싱 ----
  let body: { text?: unknown; countryCode?: unknown; emotion?: unknown; voiceId?: unknown; speed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: '요청 본문이 유효한 JSON이 아닙니다.' } },
      { status: 400 }
    );
  }

  const { text, countryCode, emotion, voiceId, speed } = body;

  // ---- 입력 검증 ----
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json(
      { error: { code: 'MISSING_TEXT', message: 'text 필드가 필요합니다.' } },
      { status: 400 }
    );
  }

  if (text.length > SUPERTONE_MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: {
          code: 'TEXT_TOO_LONG',
          message: `텍스트는 ${SUPERTONE_MAX_TEXT_LENGTH}자 이하여야 합니다. (현재: ${text.length}자)`,
        },
      },
      { status: 400 }
    );
  }

  // voiceId 우선, 없으면 countryCode로 조회, 둘 다 없으면 기본 음성
  const resolvedVoiceId =
    (typeof voiceId === 'string' && voiceId.trim()) ? voiceId.trim()
    : (typeof countryCode === 'string' && countryCode.trim())
      ? getSupertoneVoiceForCountry(countryCode.trim())
      : 'Adam';

  const resolvedEmotion: EmotionType =
    typeof emotion === 'string' && VALID_EMOTIONS.has(emotion as EmotionType)
      ? (emotion as EmotionType)
      : 'NEUTRAL';

  const resolvedSpeed =
    typeof speed === 'number' && isFinite(speed)
      ? Math.min(2.0, Math.max(0.5, speed))
      : 1.0;

  // ---- Supertone TTS 호출 ----
  try {
    const wavBuffer = await generateSupertoneTTS(
      text.trim(),
      resolvedVoiceId,
      resolvedEmotion,
      resolvedSpeed,
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
    console.error('[POST /api/tts-supertone] Supertone TTS 오류:', message);

    // API 키 관련 오류 구분
    if (message.includes('API 키가 유효하지 않습니다') || message.includes('401') || message.includes('403')) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_API_KEY',
            message: 'Supertone API 키가 유효하지 않습니다. 설정에서 Supertone API 키를 확인하세요.',
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

/** GET /api/tts-supertone - 헬스 체크 및 사용 가능 음성 목록 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    description: 'Supertone Cloud TTS API - 최고품질 음성 합성 (API Key 필요)',
    model: 'sona_speech_1',
    maxTextLength: SUPERTONE_MAX_TEXT_LENGTH,
    outputFormat: 'audio/wav',
    usage: {
      method: 'POST',
      headers: { 'x-supertone-key': 'Supertone API Key (필수)' },
      body: {
        text: 'string (필수)',
        countryCode: 'string (선택, 예: KR)',
        emotion: 'HAPPY | ANGRY | SAD | SURPRISED | NEUTRAL (선택)',
        voiceId: 'string (선택, voiceId 직접 지정 시 countryCode 무시)',
        speed: 'number (선택, 0.5~2.0, 기본값: 1.0)',
      },
      response: 'audio/wav',
    },
    voices: SUPERTONE_VOICES,
  });
}
