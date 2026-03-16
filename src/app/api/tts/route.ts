export const maxDuration = 60;

/**
 * /api/tts
 * Edge TTS 음성 합성 API 라우트
 *
 * Microsoft Edge TTS (edge-tts npm 패키지)를 사용하여
 * 텍스트를 mp3 오디오로 변환합니다. API Key 불필요.
 *
 * POST /api/tts
 * Body: { text: string, voice?: string }
 * Response: audio/mpeg blob
 */

import { NextRequest, NextResponse } from 'next/server';
// edge-tts 패키지의 main 필드가 index.ts를 가리켜 Turbopack이 처리 불가하므로
// 컴파일된 out/index.js를 직접 임포트합니다.
import { tts } from 'edge-tts/out/index.js';

/** 기본 음성 (한국어 여성) */
const DEFAULT_VOICE = 'ko-KR-SunHiNeural';

/** 허용 최대 텍스트 길이 */
const MAX_TEXT_LENGTH = 1000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { text?: unknown; voice?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: '요청 본문이 유효한 JSON이 아닙니다.' } },
      { status: 400 }
    );
  }

  const text = body.text;
  const voice = body.voice;

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

  const voiceId = typeof voice === 'string' && voice.trim() ? voice.trim() : DEFAULT_VOICE;

  // ---- Edge TTS 호출 ----
  try {
    const audioNodeBuffer = await tts(text.trim(), { voice: voiceId });
    // Node.js Buffer → Uint8Array (NextResponse BodyInit 호환)
    const audioBuffer = new Uint8Array(audioNodeBuffer);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        // 캐시: 동일 텍스트+음성 조합은 1시간 캐시
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/tts] Edge TTS 오류:', message);

    return NextResponse.json(
      {
        error: {
          code: 'TTS_FAILED',
          message: '음성 합성에 실패했습니다. 잠시 후 다시 시도하세요.',
          details: [{ field: 'voice', issue: `요청 음성: ${voiceId}` }],
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tts
 * 헬스 체크 겸 지원 음성 안내
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    description: 'Edge TTS API - Microsoft Edge 온라인 TTS 사용 (API Key 불필요)',
    defaultVoice: DEFAULT_VOICE,
    maxTextLength: MAX_TEXT_LENGTH,
    usage: {
      method: 'POST',
      body: { text: 'string (필수)', voice: 'string (선택, 기본: ko-KR-SunHiNeural)' },
      response: 'audio/mpeg',
    },
    sampleVoices: {
      KR: 'ko-KR-SunHiNeural',
      US: 'en-US-JennyNeural',
      JP: 'ja-JP-NanamiNeural',
      CN: 'zh-CN-XiaoxiaoNeural',
      RU: 'ru-RU-SvetlanaNeural',
      DE: 'de-DE-KatjaNeural',
      FR: 'fr-FR-DeniseNeural',
    },
  });
}
