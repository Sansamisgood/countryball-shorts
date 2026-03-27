/**
 * videoExport.ts
 * Canvas API + MediaRecorder 기반 WebM 영상 내보내기 모듈
 * 브라우저 내장 API만 사용 (client-side only)
 *
 * NOTE: exportAllScenesToZip 사용 시 jszip 패키지 필요
 *   npm install jszip
 *   npm install --save-dev @types/jszip
 */

'use client';

import type { ScriptScene, DialogueLine, EpisodePlan } from './types';

// ── 외부 타입 선언 (JSZip은 동적 import로 로드) ──
type JSZipType = import('jszip');

// ===== 공개 타입 =====

export interface ExportProgress {
  current: number;
  total: number;
  phase: 'loading' | 'rendering' | 'encoding' | 'done';
  message: string;
}

export interface ExportSceneOptions {
  scene: ScriptScene;
  /** 씬 배경 이미지 URL (data: URL 또는 https: URL) */
  imageUrl: string;
  /** 씬 제목 / 에피소드 제목 (파일명에 사용) */
  episodeTitle?: string;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportAllScenesOptions {
  scenes: ScriptScene[];
  /** 씬 번호(1-based) → 이미지 URL 맵 */
  imageMap: Map<number, string>;
  plan?: EpisodePlan | null;
  onProgress?: (progress: ExportProgress) => void;
}

// ===== 내부 타입 =====

interface DialogueTiming {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

// ===== 상수 =====

/** Shorts 포맷 (9:16, 1080×1920) */
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

/** 코덱 우선순위 (지원되는 첫 번째 사용) */
const CODEC_PRIORITY = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

const FPS = 30;
const BITRATE = 5_000_000; // 5 Mbps
const FADE_DURATION = 0.5; // 초
const KEN_BURNS_SCALE = 0.05; // 5% 줌 인
const SUBTITLE_AREA_RATIO = 0.8; // 씬 시간의 80% 구간에 자막 배분

// ===== 내부 유틸 =====

/**
 * URL → HTMLImageElement 로드
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`이미지 로드 실패: ${url.substring(0, 60)}...`));
    img.src = url;
  });
}

/**
 * 로드 실패 시 사용할 대체 이미지 (회색 배경 + 오류 메시지)
 */
function createFallbackImage(width: number, height: number): Promise<HTMLImageElement> {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d')!;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('이미지 로드 실패', width / 2, height / 2);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = offscreen.toDataURL();
  });
}

/**
 * 지원되는 WebM 코덱 반환. 없으면 예외 발생.
 */
function findSupportedCodec(): string {
  for (const codec of CODEC_PRIORITY) {
    if (MediaRecorder.isTypeSupported(codec)) {
      return codec;
    }
  }
  throw new Error('WebM 코덱을 지원하지 않는 브라우저입니다.');
}

// ===== 공개 렌더링 유틸 =====

/**
 * 이미지를 Canvas에 cover 방식으로 그리기
 * Ken Burns 효과: progress(0→1)에 따라 약간 줌 인
 */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  opacity: number = 1,
  progress: number = 0
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

  const scale = 1 + KEN_BURNS_SCALE * progress;
  const imgRatio = img.width / img.height;
  const canvasRatio = canvasW / canvasH;

  let drawW: number;
  let drawH: number;

  if (imgRatio > canvasRatio) {
    // 이미지가 더 넓음 → 높이 기준으로 맞추기
    drawH = canvasH * scale;
    drawW = drawH * imgRatio;
  } else {
    // 이미지가 더 높음 → 너비 기준으로 맞추기
    drawW = canvasW * scale;
    drawH = drawW / imgRatio;
  }

  const offsetX = (canvasW - drawW) / 2;
  const offsetY = (canvasH - drawH) / 2;

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

/**
 * 하단 반투명 자막 박스 렌더링 (한국어 텍스트 지원)
 * 화자명(국가 코드)과 대사를 함께 표시
 */
export function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasWidth: number,
  canvasHeight: number,
  speaker: string = ''
): void {
  if (!text) return;

  const padding = canvasWidth * 0.05;
  const boxHeight = canvasHeight * 0.15;
  const boxY = canvasHeight - boxHeight - padding;

  // 반투명 배경 (둥근 모서리)
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  const radius = 16;
  ctx.beginPath();
  ctx.moveTo(padding + radius, boxY);
  ctx.lineTo(canvasWidth - padding - radius, boxY);
  ctx.quadraticCurveTo(canvasWidth - padding, boxY, canvasWidth - padding, boxY + radius);
  ctx.lineTo(canvasWidth - padding, boxY + boxHeight - radius);
  ctx.quadraticCurveTo(
    canvasWidth - padding,
    boxY + boxHeight,
    canvasWidth - padding - radius,
    boxY + boxHeight
  );
  ctx.lineTo(padding + radius, boxY + boxHeight);
  ctx.quadraticCurveTo(padding, boxY + boxHeight, padding, boxY + boxHeight - radius);
  ctx.lineTo(padding, boxY + radius);
  ctx.quadraticCurveTo(padding, boxY, padding + radius, boxY);
  ctx.closePath();
  ctx.fill();

  const speakerFontSize = Math.max(canvasWidth * 0.025, 18);
  const textFontSize = Math.max(canvasWidth * 0.032, 22);
  const textPadding = padding * 1.5;
  let currentY = boxY + boxHeight * 0.3;

  // 화자명 (국가 코드)
  if (speaker) {
    ctx.fillStyle = '#a5b4fc'; // indigo-300
    ctx.font = `bold ${speakerFontSize}px "Noto Sans KR", sans-serif`;
    ctx.fillText(speaker, textPadding, currentY);
    currentY += speakerFontSize + 8;
  }

  // 대사 텍스트 (한국어 글자 단위 줄바꿈)
  ctx.fillStyle = '#ffffff';
  ctx.font = `${textFontSize}px "Noto Sans KR", sans-serif`;

  const maxWidth = canvasWidth - textPadding * 2;
  const chars = text.split('');
  let line = '';
  const lines: string[] = [];

  for (const char of chars) {
    const testLine = line + char;
    const { width } = ctx.measureText(testLine);
    if (width > maxWidth && line.length > 0) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  // 최대 3줄 표시
  const displayLines = lines.slice(0, 3);
  for (const l of displayLines) {
    ctx.fillText(l, textPadding, currentY);
    currentY += textFontSize + 6;
  }

  ctx.restore();
}

/**
 * 씬 번호 오버레이 (좌상단)
 */
function drawSceneLabel(
  ctx: CanvasRenderingContext2D,
  sceneNumber: number,
  canvasW: number
): void {
  const fontSize = Math.max(canvasW * 0.018, 14);
  const padding = canvasW * 0.03;
  const label = `SCENE ${sceneNumber}`;

  ctx.save();
  ctx.font = `bold ${fontSize}px "Noto Sans KR", monospace`;

  const metrics = ctx.measureText(label);
  const boxW = metrics.width + 20;
  const boxH = fontSize + 12;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  // roundRect는 최신 브라우저에서 지원
  (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
    .roundRect(padding, padding, boxW, boxH, 8);
  ctx.fill();

  ctx.fillStyle = '#94a3b8'; // slate-400
  ctx.fillText(label, padding + 10, padding + fontSize + 2);
  ctx.restore();
}

/**
 * 대사별 타이밍 자동 배분
 * 씬 전체 시간의 SUBTITLE_AREA_RATIO(80%) 구간을 대사 글자 수 비율로 나눔
 */
export function calculateDialogueTimings(
  lines: DialogueLine[],
  totalDuration: number
): DialogueTiming[] {
  if (!lines || lines.length === 0) return [];

  const totalChars = lines.reduce((acc, line) => acc + (line.text?.length || 1), 0);
  const startOffset = (totalDuration * (1 - SUBTITLE_AREA_RATIO)) / 2; // 10% 오프셋
  const usableDuration = totalDuration * SUBTITLE_AREA_RATIO;

  let currentTime = startOffset;
  return lines.map((line) => {
    const charRatio = (line.text?.length || 1) / totalChars;
    const duration = usableDuration * charRatio;
    const timing: DialogueTiming = {
      speaker: line.speaker || '',
      text: line.text || '',
      startTime: currentTime,
      endTime: currentTime + duration,
    };
    currentTime += duration;
    return timing;
  });
}

// ===== 메인 내보내기 함수 =====

/**
 * 단일 씬을 WebM Blob으로 렌더링
 * MediaRecorder + Canvas API 기반, 순수 브라우저 환경에서 실행
 */
export async function exportSceneToWebM(options: ExportSceneOptions): Promise<Blob> {
  const { scene, imageUrl, onProgress } = options;

  const total = 1;
  const duration = scene.durationSec || 5;

  // 1. 이미지 로드
  onProgress?.({ current: 0, total, phase: 'loading', message: '이미지 로딩 중...' });

  let img: HTMLImageElement;
  try {
    img = await loadImage(imageUrl);
  } catch {
    img = await createFallbackImage(CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  onProgress?.({ current: 1, total, phase: 'rendering', message: '영상 렌더링 중...' });

  // 2. Canvas + MediaRecorder 설정
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const mimeType = findSupportedCodec();
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: BITRATE,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // 3. 렌더링 루프
  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('MediaRecorder 오류 발생'));

    recorder.onstop = () => {
      onProgress?.({ current: 1, total, phase: 'encoding', message: '영상 인코딩 중...' });
      const blob = new Blob(chunks, { type: mimeType });
      onProgress?.({ current: 1, total, phase: 'done', message: '완료!' });
      resolve(blob);
    };

    recorder.start(100); // 100ms 간격으로 데이터 청크 수집

    const timings = calculateDialogueTimings(Array.isArray(scene.dialogue) ? scene.dialogue : [], duration);
    let elapsed = 0;
    let lastTimestamp = performance.now();

    const renderFrame = () => {
      const now = performance.now();
      const delta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      elapsed += delta;

      if (elapsed >= duration) {
        recorder.stop();
        return;
      }

      const progress = Math.min(elapsed / duration, 1);

      // 페이드 인/아웃 계산
      let opacity = 1;
      if (elapsed < FADE_DURATION) {
        opacity = elapsed / FADE_DURATION;
      } else if (elapsed > duration - FADE_DURATION) {
        opacity = Math.max(0, (duration - elapsed) / FADE_DURATION);
      }

      // 배경 클리어
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 이미지 (Ken Burns 효과 포함)
      drawImageCover(ctx, img, CANVAS_WIDTH, CANVAS_HEIGHT, opacity, progress);

      // 씬 번호 라벨
      drawSceneLabel(ctx, scene.sceneNumber, CANVAS_WIDTH);

      // 현재 시점의 자막 표시
      const currentDialogue = timings.find(
        (t) => elapsed >= t.startTime && elapsed < t.endTime
      );
      if (currentDialogue) {
        drawSubtitle(
          ctx,
          currentDialogue.text,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
          currentDialogue.speaker
        );
      }

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  });
}

/**
 * 단일 씬을 WebM 파일로 다운로드
 */
export async function downloadSceneAsWebM(
  options: ExportSceneOptions
): Promise<void> {
  const { scene, episodeTitle, onProgress } = options;
  const blob = await exportSceneToWebM(options);

  const safeTitle = (episodeTitle || '컨트리볼').replace(/[^\w가-힣]/g, '_');
  const filename = `${safeTitle}_scene${scene.sceneNumber}.webm`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  onProgress?.({
    current: 1,
    total: 1,
    phase: 'done',
    message: `${filename} 다운로드 완료`,
  });
}

/**
 * 모든 씬을 WebM으로 렌더링한 후 ZIP으로 묶어 다운로드
 *
 * 의존성: jszip
 *   npm install jszip
 *   npm install --save-dev @types/jszip
 */
export async function exportAllScenesToZip(
  options: ExportAllScenesOptions
): Promise<void> {
  const { scenes, imageMap, plan, onProgress } = options;

  const scenesWithImages = scenes.filter((s) => imageMap.has(s.sceneNumber));
  const total = scenesWithImages.length;

  if (total === 0) {
    throw new Error('이미지가 있는 씬이 없습니다.');
  }

  // JSZip 동적 로드
  let JSZip: new () => JSZipType;
  try {
    const module = await import('jszip');
    JSZip = module.default as unknown as new () => JSZipType;
  } catch {
    throw new Error(
      'JSZip 패키지가 설치되지 않았습니다. npm install jszip 을 실행하세요.'
    );
  }

  const zip = new JSZip();
  const safeTitle = ((plan?.title) || '컨트리볼_shorts').replace(/[^\w가-힣]/g, '_');

  for (let i = 0; i < scenesWithImages.length; i++) {
    const scene = scenesWithImages[i];
    const imageUrl = imageMap.get(scene.sceneNumber)!;

    onProgress?.({
      current: i,
      total,
      phase: 'rendering',
      message: `씬 ${scene.sceneNumber} 렌더링 중... (${i + 1}/${total})`,
    });

    const blob = await exportSceneToWebM({
      scene,
      imageUrl,
      episodeTitle: plan?.title,
      onProgress: (p) => {
        // 내부 진행상황을 전체 진행상황으로 매핑
        if (p.phase !== 'done') {
          onProgress?.({
            current: i,
            total,
            phase: p.phase,
            message: `씬 ${scene.sceneNumber}: ${p.message}`,
          });
        }
      },
    });

    const filename = `scene${String(scene.sceneNumber).padStart(3, '0')}.webm`;
    zip.file(filename, blob);
  }

  onProgress?.({ current: total, total, phase: 'encoding', message: 'ZIP 생성 중...' });

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  onProgress?.({ current: total, total, phase: 'done', message: 'ZIP 다운로드 완료!' });
}
