export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { generateYouTubeSEO } from '@/lib/gemini';
import { EpisodePlan, ScriptScene } from '@/lib/types';

interface SeoRequestBody {
  plan: EpisodePlan;
  scenes: ScriptScene[];
}

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      request.headers.get('x-api-key') ??
      process.env.GEMINI_API_KEY ??
      undefined;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.' },
        { status: 401 },
      );
    }

    const body: SeoRequestBody = await request.json();

    if (!body.plan || !Array.isArray(body.scenes)) {
      return NextResponse.json(
        { error: 'SEO 생성에는 plan 객체와 scenes 배열이 필요합니다.' },
        { status: 400 },
      );
    }

    const seo = await generateYouTubeSEO(body.plan, body.scenes, apiKey);
    return NextResponse.json(seo);
  } catch (error) {
    console.error('[POST /api/seo] 오류:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
