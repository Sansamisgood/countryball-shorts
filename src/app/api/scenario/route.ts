import { NextRequest, NextResponse } from 'next/server';
import {
  generateEpisodePlan,
  generateDraftScript,
  reviewAndFinalizeScript,
  generateCharacterBaseImage,
  generateImageForScene,
} from '@/lib/gemini';
import { EpisodePlan, ScriptScene } from '@/lib/types';

type ScenarioRequestBody =
  | { step: 'plan'; title: string; facts: string[] }
  | { step: 'draft'; plan: EpisodePlan }
  | { step: 'finalize'; rawScript: string; plan: EpisodePlan }
  | { step: 'character-image'; masterPrompt: string }
  | { step: 'scene-image'; scene: ScriptScene; characterDescription: string };

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key') ?? process.env.GEMINI_API_KEY ?? undefined;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.' },
        { status: 401 }
      );
    }

    const body: ScenarioRequestBody = await request.json();

    switch (body.step) {
      case 'plan': {
        const { title, facts } = body;
        if (!title || !Array.isArray(facts)) {
          return NextResponse.json(
            { error: 'plan 단계에는 title과 facts 배열이 필요합니다.' },
            { status: 400 }
          );
        }
        const plan = await generateEpisodePlan(title, facts, apiKey);
        return NextResponse.json(plan);
      }

      case 'draft': {
        const { plan } = body;
        if (!plan) {
          return NextResponse.json(
            { error: 'draft 단계에는 plan 객체가 필요합니다.' },
            { status: 400 }
          );
        }
        const rawScript = await generateDraftScript(plan, apiKey);
        return NextResponse.json({ rawScript });
      }

      case 'finalize': {
        const { rawScript, plan } = body;
        if (!rawScript || !plan) {
          return NextResponse.json(
            { error: 'finalize 단계에는 rawScript와 plan 객체가 필요합니다.' },
            { status: 400 }
          );
        }
        const scenes = await reviewAndFinalizeScript(rawScript, plan, apiKey);
        return NextResponse.json(scenes);
      }

      case 'character-image': {
        const { masterPrompt } = body;
        if (!masterPrompt) {
          return NextResponse.json(
            { error: 'character-image 단계에는 masterPrompt가 필요합니다.' },
            { status: 400 }
          );
        }
        const imageUrl = await generateCharacterBaseImage(masterPrompt, apiKey);
        return NextResponse.json({ imageUrl });
      }

      case 'scene-image': {
        const { scene, characterDescription } = body;
        if (!scene || !characterDescription) {
          return NextResponse.json(
            { error: 'scene-image 단계에는 scene과 characterDescription이 필요합니다.' },
            { status: 400 }
          );
        }
        const result = await generateImageForScene(scene, characterDescription, apiKey);
        if (!result.imageUrl) {
          return NextResponse.json(
            { error: '이미지 생성 실패: 모든 모델에서 이미지를 받지 못했습니다. 서버 로그를 확인하세요.', imageUrl: '' },
            { status: 500 }
          );
        }
        return NextResponse.json(result);
      }

      default: {
        return NextResponse.json(
          { error: '알 수 없는 step 값입니다.' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('[POST /api/scenario] 오류:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
