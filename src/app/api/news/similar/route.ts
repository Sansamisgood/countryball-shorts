export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { findSimilarTopics } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key') ?? process.env.GEMINI_API_KEY ?? undefined;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === 'string' ? body.topic : undefined;
    const page = typeof body.page === 'number' ? body.page : 1;
    const usedTopics: string[] = Array.isArray(body.usedTopics) ? body.usedTopics : [];

    if (!topic) {
      return NextResponse.json(
        { error: 'topic 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const candidates = await findSimilarTopics(topic, page, usedTopics, apiKey);

    return NextResponse.json(candidates);
  } catch (error) {
    console.error('[POST /api/news/similar] 오류:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
