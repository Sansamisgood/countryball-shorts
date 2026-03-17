'use client';

import { useRef, useState } from 'react';
import {
  ScriptScene,
  EpisodePlan,
  TopicCandidate,
  EmotionType,
  AnimationStyle,
  CompositionType,
  CharacterProfile,
} from '@/lib/types';
import CountryBallIcon from '@/components/CountryBallIcon';
import { downloadSceneAsWebM, exportAllScenesToZip } from '@/lib/videoExport';
import { exportToCapcut } from '@/lib/capcutExport';
import { clientGenerateSceneImage, clientGenerateCharacterImage } from '@/lib/geminiClient';
import { generateTTSUrl, getVoiceIdForCountry } from '@/lib/tts';
import { getGeminiVoiceLabelForCountry } from '@/lib/geminiTts';
import { getSupertoneVoiceLabelForCountry } from '@/lib/supertoneTts';
import type { TtsEngine } from '@/components/SettingsPanel';

// ── TTS 엔진 설정 읽기 유틸리티 ──────────────────────────────────────────────

function readTtsEngine(): TtsEngine {
  if (typeof window === 'undefined') return 'edge';
  return (localStorage.getItem('ttsEngine') ?? 'edge') as TtsEngine;
}

function readApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('gemini_api_key') ?? '';
}

function readSupertoneApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('supertoneApiKey') ?? '';
}

/**
 * Supertone TTS API 라우트를 호출하여 blob URL을 반환합니다.
 */
async function generateSupertoneTTSUrl(
  text: string,
  countryCode: string,
  emotion: EmotionType
): Promise<string> {
  const apiKey = readSupertoneApiKey();
  if (!apiKey) throw new Error('Supertone API 키가 설정되지 않았습니다.');

  const response = await fetch('/api/tts-supertone', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-supertone-key': apiKey,
    },
    body: JSON.stringify({ text: text.trim(), countryCode, emotion }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`[SupertoneTTS] ${msg}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Gemini TTS API 라우트를 호출하여 blob URL을 반환합니다.
 */
async function generateGeminiTTSUrl(
  text: string,
  countryCode: string,
  emotion: EmotionType
): Promise<string> {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.');

  const response = await fetch('/api/tts-gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ text: text.trim(), countryCode, emotion }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`[GeminiTTS] ${msg}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

interface StoryboardPanelProps {
  scenes?: ScriptScene[];
  plan?: EpisodePlan | null;
  topic?: TopicCandidate | null;
  finalizedScenes?: ScriptScene[];
  episodePlan?: EpisodePlan | null;
  selectedTopic?: TopicCandidate | null;
  onBack?: () => void;
  onError?: (message: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCENE_TYPE_LABELS: Record<string, string> = {
  DIALOGUE: '대화',
  NARRATION: '내레이션',
  REACTION: '반응',
  MONTAGE: '몽타주',
  TITLE: '타이틀',
  ENDING: '엔딩',
};

const SCENE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DIALOGUE:  { bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd', border: 'rgba(59,130,246,0.35)'  },
  NARRATION: { bg: 'rgba(168,85,247,0.15)',  text: '#d8b4fe', border: 'rgba(168,85,247,0.35)'  },
  REACTION:  { bg: 'rgba(249,115,22,0.15)',  text: '#fdba74', border: 'rgba(249,115,22,0.35)'  },
  MONTAGE:   { bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7', border: 'rgba(16,185,129,0.35)'  },
  TITLE:     { bg: 'rgba(233,69,96,0.15)',   text: '#fda4af', border: 'rgba(233,69,96,0.35)'   },
  ENDING:    { bg: 'rgba(234,179,8,0.15)',   text: '#fde047', border: 'rgba(234,179,8,0.35)'   },
};

const COMPOSITION_LABELS: Record<CompositionType, string> = {
  SOLO:        '단독',
  TWO_SHOT:    '투샷',
  ONE_VS_MANY: '1 vs 다수',
  TEAM:        '팀',
};

const COMPOSITION_OPTIONS: CompositionType[] = ['SOLO', 'TWO_SHOT', 'ONE_VS_MANY', 'TEAM'];

const EMOTION_LABELS: Record<EmotionType, string> = {
  HAPPY:     '😄 기쁨',
  ANGRY:     '😠 분노',
  SAD:       '😢 슬픔',
  SURPRISED: '😲 놀람',
  NEUTRAL:   '😐 평온',
};

const ANIMATION_STYLE_OPTIONS: { value: AnimationStyle; label: string }[] = [
  { value: 'STOP_MOTION', label: '스톱모션' },
  { value: 'GEN_SWAP',    label: '벡터' },
  { value: 'BOUNCE',      label: '바운스' },
];

const DEFAULT_BADGE = { bg: 'rgba(255,255,255,0.08)', text: '#aaa', border: 'rgba(255,255,255,0.15)' };

const BATCH_SIZE = 3;

// ── Small helpers ─────────────────────────────────────────────────────────────

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="animate-spin"
    >
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 4" />
    </svg>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

function VoiceBadge({ countryCode }: { countryCode: string }) {
  const engine =
    typeof window !== 'undefined'
      ? (localStorage.getItem('ttsEngine') ?? 'edge')
      : 'edge';

  let label: string;
  if (engine === 'supertone') {
    label = getSupertoneVoiceLabelForCountry(countryCode);
  } else {
    label = getGeminiVoiceLabelForCountry(countryCode);
  }

  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded"
      style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}
      aria-label={`음성: ${label}`}
    >
      {label.split(' ')[0]}
    </span>
  );
}

function SceneTypeBadge({ type }: { type: string }) {
  const color = SCENE_TYPE_COLORS[type] ?? DEFAULT_BADGE;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}
    >
      {SCENE_TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ── Scene Card ────────────────────────────────────────────────────────────────

interface SceneCardProps {
  scene: ScriptScene;
  sceneImage: string | null;
  composition: CompositionType;
  onCompositionChange: (sceneNumber: number, value: CompositionType) => void;
  onGenerateImage: (scene: ScriptScene) => Promise<void>;
  isGenerating: boolean;
  onExportSceneVideo: (scene: ScriptScene, imageUrl: string) => Promise<void>;
  isExportingSceneVideo: boolean;
  onDownloadPng: (sceneNumber: number, imageUrl: string) => void;
  animationStyle: AnimationStyle;
}

function SceneCard({
  scene,
  sceneImage,
  composition,
  onCompositionChange,
  onGenerateImage,
  isGenerating,
  onExportSceneVideo,
  isExportingSceneVideo,
  onDownloadPng,
  animationStyle,
}: SceneCardProps) {
  const [loadingTtsLineKey, setLoadingTtsLineKey] = useState<string | null>(null);
  const [playingLineKey, setPlayingLineKey] = useState<string | null>(null);

  const handlePlayTts = async (
    text: string,
    speaker: string,
    emotion: EmotionType,
    lineKey: string
  ) => {
    if (loadingTtsLineKey === lineKey) return;
    setLoadingTtsLineKey(lineKey);
    let audioUrl: string | null = null;
    try {
      const engine = readTtsEngine();
      if (engine === 'gemini') {
        audioUrl = await generateGeminiTTSUrl(text, speaker, emotion);
      } else if (engine === 'supertone') {
        audioUrl = await generateSupertoneTTSUrl(text, speaker, emotion);
      } else {
        const voiceId = getVoiceIdForCountry(speaker);
        audioUrl = await generateTTSUrl(text, voiceId);
      }
      const audio = new Audio(audioUrl);
      setPlayingLineKey(lineKey);
      audio.onended = () => {
        setPlayingLineKey(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlayingLineKey(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch {
      setPlayingLineKey(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    } finally {
      setLoadingTtsLineKey(null);
    }
  };

  const uniqueSpeakers = Array.from(
    new Map(scene.dialogue.map((line) => [line.speaker, line.emotion])).entries()
  );

  return (
    <div
      className="card flex flex-col gap-4 transition-all duration-200"
      style={{ borderColor: 'rgba(233,69,96,0.18)' }}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-black tabular-nums" style={{ color: 'var(--accent)' }}>
            #{scene.sceneNumber}
          </span>
          <SceneTypeBadge type={scene.sceneType} />
          {/* Composition dropdown */}
          <select
            aria-label="구도 선택"
            value={composition}
            onChange={(e) => onCompositionChange(scene.sceneNumber, e.target.value as CompositionType)}
            className="text-xs rounded-full px-2 py-0.5 font-medium appearance-none cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#aaa',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {COMPOSITION_OPTIONS.map((opt) => (
              <option key={opt} value={opt} style={{ background: '#1a1a2e' }}>
                {COMPOSITION_LABELS[opt]}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {scene.durationSec}초
        </span>
      </div>

      {/* Visual Cue */}
      {scene.setting && (
        <div
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text-secondary)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>배경:</span>{' '}
          {scene.setting}
        </div>
      )}

      {/* Director Note (visual cue display) */}
      {scene.directorNote && (
        <div
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            background: 'rgba(234,179,8,0.07)',
            color: '#fde047cc',
            border: '1px solid rgba(234,179,8,0.2)',
          }}
        >
          <span className="not-italic font-semibold" style={{ color: '#fde047' }}>연출:</span>{' '}
          <em>{scene.directorNote}</em>
        </div>
      )}

      {/* Countryball Avatars */}
      {uniqueSpeakers.length > 0 && (
        <div className="flex items-end gap-4 flex-wrap">
          {uniqueSpeakers.map(([code, emotion]) => (
            <div key={code} className="flex flex-col items-center gap-1">
              <CountryBallIcon
                countryCode={code}
                size={64}
                emotion={emotion as EmotionType}
                style={animationStyle}
                isTalking={playingLineKey?.startsWith(`${scene.sceneNumber}-${code}-`) ?? false}
              />
              <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {code}볼
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {EMOTION_LABELS[emotion as EmotionType] ?? emotion}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dialogue Lines */}
      {scene.dialogue.length > 0 && (
        <div className="space-y-2">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            대사
          </span>
          <div className="space-y-2">
            {scene.dialogue.map((line, i) => {
              const lineKey = `${scene.sceneNumber}-${line.speaker}-${i}`;
              const isThisLinePlaying = playingLineKey === lineKey;
              const isThisLineLoading = loadingTtsLineKey === lineKey;
              return (
                <div
                  key={i}
                  className="flex gap-3 items-start text-sm p-3 rounded-lg"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                    <CountryBallIcon
                      countryCode={line.speaker}
                      size={36}
                      emotion={line.emotion}
                      style={animationStyle}
                      isTalking={isThisLinePlaying}
                    />
                    <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                      {line.speaker}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                      &ldquo;{line.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
                      >
                        {EMOTION_LABELS[line.emotion] ?? line.emotion}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
                      >
                        {line.animation}
                      </span>
                      <button
                        type="button"
                        aria-label={`${line.speaker} 대사 음성 재생`}
                        onClick={() => handlePlayTts(line.text, line.speaker, line.emotion, lineKey)}
                        disabled={isThisLineLoading || !!loadingTtsLineKey}
                        className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                        style={{
                          background: isThisLinePlaying ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.06)',
                          color: isThisLinePlaying ? 'var(--accent)' : 'var(--text-secondary)',
                          border: isThisLinePlaying ? '1px solid rgba(233,69,96,0.35)' : '1px solid transparent',
                          cursor: isThisLineLoading ? 'wait' : 'pointer',
                          opacity: (loadingTtsLineKey && !isThisLineLoading) ? 0.5 : 1,
                        }}
                      >
                        {isThisLineLoading ? <SpinnerIcon size={12} /> : <span aria-hidden>🔊</span>}
                        {isThisLineLoading ? '생성 중...' : isThisLinePlaying ? '재생 중' : '음성'}
                      </button>
                      {/* 음성 이름 표시 (TTS 엔진별) */}
                      <VoiceBadge countryCode={line.speaker} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Image Section */}
      <div className="flex flex-col gap-2">
        {sceneImage ? (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sceneImage}
              alt={`씬 ${scene.sceneNumber} 이미지`}
              className="w-full object-cover"
              style={{ maxHeight: '320px' }}
            />
          </div>
        ) : (
          <div
            className="rounded-xl flex items-center justify-center text-sm"
            style={{
              height: '80px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)',
            }}
          >
            이미지 없음
          </div>
        )}

        <button
          type="button"
          className="btn-primary text-sm py-2 w-full"
          onClick={() => onGenerateImage(scene)}
          disabled={isGenerating}
          style={{ opacity: isGenerating ? 0.6 : 1 }}
        >
          {isGenerating ? '이미지 생성 중...' : sceneImage ? '이미지 재생성' : '이미지 생성'}
        </button>

        {/* PNG download button */}
        {sceneImage && (
          <button
            type="button"
            className="text-sm py-2 w-full rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            onClick={() => onDownloadPng(scene.sceneNumber, sceneImage)}
            style={{
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.3)',
              color: '#d8b4fe',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden>📷</span> PNG 저장
          </button>
        )}

        {sceneImage && (
          <button
            type="button"
            className="text-sm py-2 w-full rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            onClick={() => onExportSceneVideo(scene, sceneImage)}
            disabled={isExportingSceneVideo}
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#6ee7b7',
              opacity: isExportingSceneVideo ? 0.6 : 1,
              cursor: isExportingSceneVideo ? 'wait' : 'pointer',
            }}
          >
            {isExportingSceneVideo ? <SpinnerIcon /> : <span aria-hidden>🎬</span>}
            {isExportingSceneVideo ? '영상 생성 중...' : '씬 영상 생성 (WebM)'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Character Profile Section ─────────────────────────────────────────────────

interface CharacterProfileSectionProps {
  characters: CharacterProfile[];
  onUpdateProfile: (countryCode: string, masterPrompt: string) => void;
  onGenerateCharacterImage: (countryCode: string, masterPrompt: string) => Promise<void>;
  onUploadCharacterImage: (countryCode: string, file: File) => void;
  generatingCharacters: Set<string>;
  animationStyle: AnimationStyle;
}

function CharacterProfileSection({
  characters,
  onUpdateProfile,
  onGenerateCharacterImage,
  onUploadCharacterImage,
  generatingCharacters,
  animationStyle,
}: CharacterProfileSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (characters.length === 0) return null;

  return (
    <section
      className="card"
      style={{ borderColor: 'rgba(168,85,247,0.2)' }}
      aria-label="캐릭터 프로필"
    >
      <button
        type="button"
        className="w-full flex items-center justify-between text-left"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          캐릭터 프로필
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className="transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-secondary)' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((char) => {
            const isGenerating = generatingCharacters.has(char.countryCode);
            return (
              <div
                key={char.countryCode}
                className="flex flex-col gap-3 p-3 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <CountryBallIcon
                    countryCode={char.countryCode}
                    size={52}
                    emotion="NEUTRAL"
                    style={animationStyle}
                  />
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
                      {char.countryCode}볼
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {char.role}
                    </div>
                  </div>
                </div>

                {/* Character image preview */}
                {char.baseImageUrl && (
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={char.baseImageUrl}
                      alt={`${char.countryCode}볼 캐릭터 이미지`}
                      className="w-full object-cover"
                      style={{ maxHeight: '120px' }}
                    />
                  </div>
                )}

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    마스터 프롬프트
                  </span>
                  <textarea
                    rows={3}
                    value={char.masterPrompt}
                    onChange={(e) => onUpdateProfile(char.countryCode, e.target.value)}
                    className="text-xs rounded-lg px-3 py-2 resize-none w-full"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    placeholder="이 캐릭터의 시각적 특징을 설명하세요..."
                    aria-label={`${char.countryCode}볼 마스터 프롬프트`}
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 text-xs py-1.5 rounded-lg font-medium flex items-center justify-center gap-1"
                    onClick={() => onGenerateCharacterImage(char.countryCode, char.masterPrompt)}
                    disabled={isGenerating}
                    style={{
                      background: 'rgba(233,69,96,0.12)',
                      border: '1px solid rgba(233,69,96,0.3)',
                      color: '#fda4af',
                      opacity: isGenerating ? 0.6 : 1,
                      cursor: isGenerating ? 'wait' : 'pointer',
                    }}
                  >
                    {isGenerating ? <SpinnerIcon size={12} /> : <span aria-hidden>🎨</span>}
                    {isGenerating ? '생성 중...' : '이미지 생성'}
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-xs py-1.5 rounded-lg font-medium flex items-center justify-center gap-1"
                    onClick={() => fileInputRefs.current[char.countryCode]?.click()}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <span aria-hidden>📁</span> 업로드
                  </button>
                  <input
                    ref={(el) => { fileInputRefs.current[char.countryCode] = el; }}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={`${char.countryCode}볼 이미지 업로드`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadCharacterImage(char.countryCode, file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StoryboardPanel({
  scenes: scenesProp,
  finalizedScenes,
  plan: planProp,
  episodePlan,
  topic: topicProp,
  selectedTopic,
  onBack,
  onError,
}: StoryboardPanelProps) {
  const scenes = scenesProp ?? finalizedScenes ?? [];
  const plan = planProp ?? episodePlan ?? null;
  const topic = topicProp ?? selectedTopic ?? null;

  // Scene images keyed by sceneNumber
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [generatingScenes, setGeneratingScenes] = useState<Set<number>>(new Set());
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});
  const [exportingVideoScenes, setExportingVideoScenes] = useState<Set<number>>(new Set());

  // Per-scene composition overrides
  const [compositionOverrides, setCompositionOverrides] = useState<Record<number, CompositionType>>({});

  // Animation style
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('STOP_MOTION');

  // Export states
  const [isExportingCapcut, setIsExportingCapcut] = useState(false);
  const [isExportingAllVideo, setIsExportingAllVideo] = useState(false);
  const [isExportingImageZip, setIsExportingImageZip] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  // Character profiles derived from cast, extended with editable masterPrompt and baseImageUrl
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>(() => {
    if (!plan?.cast) return [];
    return plan.cast.map((member) => ({
      countryCode: member.countryCode,
      role: member.role,
      personality: member.personality,
      masterPrompt: member.visualCue ?? '',
      baseImageUrl: undefined,
    }));
  });
  const [generatingCharacters, setGeneratingCharacters] = useState<Set<string>>(new Set());

  // Project import ref
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // Computed stats
  const totalDialogueLines = scenes.reduce((sum, s) => sum + s.dialogue.length, 0);
  const estimatedDuration = scenes.reduce((sum, s) => sum + (s.durationSec ?? 3), 0);
  const generatedCount = Object.keys(sceneImages).length;

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    if (apiKey) headers['x-api-key'] = apiKey;
    return headers;
  }

  const handleGenerateImage = async (scene: ScriptScene) => {
    setGeneratingScenes((prev) => new Set(prev).add(scene.sceneNumber));
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[scene.sceneNumber];
      return next;
    });

    try {
      const characterDescription = plan?.cast
        .map((c) => c.countryCode + '볼: ' + c.personality)
        .join(', ') ?? '';

      // 브라우저에서 직접 Gemini API 호출
      const imageUrl = await clientGenerateSceneImage(scene, characterDescription);
      setSceneImages((prev) => ({ ...prev, [scene.sceneNumber]: imageUrl }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이미지 생성 실패';
      setImageErrors((prev) => ({ ...prev, [scene.sceneNumber]: msg }));
      onError?.(msg);
    } finally {
      setGeneratingScenes((prev) => {
        const next = new Set(prev);
        next.delete(scene.sceneNumber);
        return next;
      });
    }
  };

  // Batch image generation for all scenes without images
  const handleBatchGenerateImages = async () => {
    const pending = scenes.filter((s) => !sceneImages[s.sceneNumber]);
    if (pending.length === 0) {
      onError?.('모든 씬에 이미지가 이미 존재합니다.');
      return;
    }

    let done = 0;
    setBatchProgress(`0/${pending.length} 생성 중...`);

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((scene) => handleGenerateImage(scene)));
      done += batch.length;
      setBatchProgress(`${Math.min(done, pending.length)}/${pending.length} 생성 중...`);
    }

    setBatchProgress(null);
  };

  const buildImagesMap = (): Map<number, string> =>
    new Map(Object.entries(sceneImages).map(([k, v]) => [Number(k), v]));

  const handleExportSceneVideo = async (scene: ScriptScene, imageUrl: string) => {
    setExportingVideoScenes((prev) => new Set(prev).add(scene.sceneNumber));
    try {
      await downloadSceneAsWebM({ scene, imageUrl, episodeTitle: plan?.title });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '씬 영상 내보내기 실패';
      onError?.(msg);
    } finally {
      setExportingVideoScenes((prev) => {
        const next = new Set(prev);
        next.delete(scene.sceneNumber);
        return next;
      });
    }
  };

  const handleExportAllVideo = async () => {
    const imagesMap = buildImagesMap();
    if (imagesMap.size === 0) {
      onError?.('내보낼 이미지가 없습니다. 먼저 씬 이미지를 생성해 주세요.');
      return;
    }
    setIsExportingAllVideo(true);
    try {
      await exportAllScenesToZip({ scenes, imageMap: imagesMap, plan });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '전체 영상 ZIP 내보내기 실패';
      onError?.(msg);
    } finally {
      setIsExportingAllVideo(false);
    }
  };

  const handleExportCapcut = async () => {
    const imagesMap = buildImagesMap();
    if (imagesMap.size === 0) {
      onError?.('CapCut 내보내기를 위한 이미지가 없습니다. 먼저 씬 이미지를 생성해 주세요.');
      return;
    }
    setIsExportingCapcut(true);
    try {
      const projectTitle = plan?.title ?? '컨트리볼 쇼츠';
      await exportToCapcut(scenes, imagesMap, projectTitle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CapCut 내보내기 실패';
      onError?.(msg);
    } finally {
      setIsExportingCapcut(false);
    }
  };

  // Download a single scene image as PNG
  const handleDownloadPng = (sceneNumber: number, imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene-${sceneNumber}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = () => {
      // Fallback: direct link download for data URLs
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `scene-${sceneNumber}.png`;
      a.click();
    };
    img.src = imageUrl;
  };

  // Download all scene images as ZIP
  const handleDownloadImageZip = async () => {
    const entries = Object.entries(sceneImages);
    if (entries.length === 0) {
      onError?.('다운로드할 이미지가 없습니다.');
      return;
    }
    setIsExportingImageZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      await Promise.all(
        entries.map(async ([sceneNum, imageUrl]) => {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          zip.file(`scene-${sceneNum}.png`, blob);
        })
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'countryball-images.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이미지 ZIP 다운로드 실패';
      onError?.(msg);
    } finally {
      setIsExportingImageZip(false);
    }
  };

  // JSON export (includes images for restoration)
  const handleExportJson = () => {
    const exportData = {
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      topic,
      plan,
      scenes,
      sceneImages,
      characterProfiles,
      compositionOverrides,
      animationStyle,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (plan?.title ?? 'project').replace(/[^\w가-힣\s]/g, '').trim().replace(/\s+/g, '_');
    const filename = `countryball_${safeTitle || 'project'}_${Date.now()}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON import (restore project)
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);
        if (data.sceneImages) setSceneImages(data.sceneImages);
        if (data.characterProfiles) setCharacterProfiles(data.characterProfiles);
        if (data.compositionOverrides) setCompositionOverrides(data.compositionOverrides);
        if (data.animationStyle) setAnimationStyle(data.animationStyle);
      } catch {
        onError?.('JSON 파일 파싱에 실패했습니다. 올바른 프로젝트 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Character profile handlers
  const handleUpdateCharacterPrompt = (countryCode: string, masterPrompt: string) => {
    setCharacterProfiles((prev) =>
      prev.map((c) => (c.countryCode === countryCode ? { ...c, masterPrompt } : c))
    );
  };

  const handleGenerateCharacterImage = async (countryCode: string, masterPrompt: string) => {
    setGeneratingCharacters((prev) => new Set(prev).add(countryCode));
    try {
      // 브라우저에서 직접 Gemini API 호출
      const imageUrl = await clientGenerateCharacterImage(masterPrompt);
      setCharacterProfiles((prev) =>
        prev.map((c) => (c.countryCode === countryCode ? { ...c, baseImageUrl: imageUrl } : c))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '캐릭터 이미지 생성 실패';
      onError?.(msg);
    } finally {
      setGeneratingCharacters((prev) => {
        const next = new Set(prev);
        next.delete(countryCode);
        return next;
      });
    }
  };

  const handleUploadCharacterImage = (countryCode: string, file: File) => {
    const url = URL.createObjectURL(file);
    setCharacterProfiles((prev) =>
      prev.map((c) => (c.countryCode === countryCode ? { ...c, baseImageUrl: url } : c))
    );
  };

  const handleCompositionChange = (sceneNumber: number, value: CompositionType) => {
    setCompositionOverrides((prev) => ({ ...prev, [sceneNumber]: value }));
  };

  const formatDuration = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  const isBatchGenerating = batchProgress !== null;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M10 12L6 8l4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          이전 단계로
        </button>
      )}

      {/* Header card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
              {plan?.title ?? '스토리보드'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {topic?.oneLiner ?? ''}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {/* Batch image generation */}
            <button
              type="button"
              className="flex items-center gap-2 text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors"
              onClick={handleBatchGenerateImages}
              disabled={isBatchGenerating || scenes.length === 0}
              aria-busy={isBatchGenerating}
              style={{
                background: 'rgba(234,179,8,0.12)',
                border: '1px solid rgba(234,179,8,0.3)',
                color: '#fde047',
                opacity: isBatchGenerating ? 0.7 : 1,
                cursor: isBatchGenerating ? 'wait' : 'pointer',
              }}
            >
              {isBatchGenerating ? <SpinnerIcon /> : <span aria-hidden>🎨</span>}
              {batchProgress ?? '전체 이미지 일괄 생성'}
            </button>

            {/* JSON export */}
            <button
              type="button"
              className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4"
              onClick={handleExportJson}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M8 1v9m0 0L5 7m3 3 3-3M2 12v2a1 1 0 001 1h10a1 1 0 001-1v-2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              📋 JSON 내보내기
            </button>

            {/* JSON import */}
            <button
              type="button"
              className="flex items-center gap-2 text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors"
              onClick={() => importFileRef.current?.click()}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden>📂</span> 프로젝트 불러오기
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              className="sr-only"
              aria-label="프로젝트 JSON 파일 불러오기"
              onChange={handleImportJson}
            />

            {/* CapCut export */}
            <button
              type="button"
              className="flex items-center gap-2 text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors"
              onClick={handleExportCapcut}
              disabled={isExportingCapcut}
              aria-busy={isExportingCapcut}
              style={{
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#93c5fd',
                opacity: isExportingCapcut ? 0.6 : 1,
                cursor: isExportingCapcut ? 'wait' : 'pointer',
              }}
            >
              {isExportingCapcut ? <SpinnerIcon /> : <span aria-hidden>🎬</span>}
              {isExportingCapcut ? 'CapCut 생성 중...' : 'CapCut 내보내기'}
            </button>

            {/* All video ZIP */}
            <button
              type="button"
              className="flex items-center gap-2 text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors"
              onClick={handleExportAllVideo}
              disabled={isExportingAllVideo}
              aria-busy={isExportingAllVideo}
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#6ee7b7',
                opacity: isExportingAllVideo ? 0.6 : 1,
                cursor: isExportingAllVideo ? 'wait' : 'pointer',
              }}
            >
              {isExportingAllVideo ? <SpinnerIcon /> : <span aria-hidden>📦</span>}
              {isExportingAllVideo ? 'ZIP 생성 중...' : '전체 영상 ZIP'}
            </button>
          </div>
        </div>

        {/* Animation style selector */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            애니메이션 스타일:
          </span>
          <div className="flex gap-1" role="group" aria-label="애니메이션 스타일 선택">
            {ANIMATION_STYLE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setAnimationStyle(value)}
                className="text-xs px-3 py-1 rounded-full font-medium transition-colors"
                aria-pressed={animationStyle === value}
                style={{
                  background: animationStyle === value ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.06)',
                  border: animationStyle === value ? '1px solid rgba(233,69,96,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  color: animationStyle === value ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            { label: '총 씬', value: scenes.length },
            { label: '총 대사', value: totalDialogueLines },
            { label: '예상 길이', value: formatDuration(estimatedDuration) },
            { label: '이미지 생성', value: `${generatedCount}/${scenes.length}` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(233,69,96,0.08)', border: '1px solid rgba(233,69,96,0.2)' }}
            >
              <div className="text-2xl font-black" style={{ color: 'var(--accent)' }}>
                {value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Character Profile Section */}
      {characterProfiles.length > 0 && (
        <CharacterProfileSection
          characters={characterProfiles}
          onUpdateProfile={handleUpdateCharacterPrompt}
          onGenerateCharacterImage={handleGenerateCharacterImage}
          onUploadCharacterImage={handleUploadCharacterImage}
          generatingCharacters={generatingCharacters}
          animationStyle={animationStyle}
        />
      )}

      {/* Scene Cards Grid */}
      {scenes.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-xl py-20 text-sm"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
        >
          씬이 없습니다. 대본 확정 단계를 먼저 완료해주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scenes.map((scene) => {
            const errMsg = imageErrors[scene.sceneNumber];
            const composition = compositionOverrides[scene.sceneNumber] ?? scene.composition;
            return (
              <div key={scene.sceneNumber} className="flex flex-col gap-2">
                <SceneCard
                  scene={scene}
                  sceneImage={sceneImages[scene.sceneNumber] ?? null}
                  composition={composition}
                  onCompositionChange={handleCompositionChange}
                  onGenerateImage={handleGenerateImage}
                  isGenerating={generatingScenes.has(scene.sceneNumber)}
                  onExportSceneVideo={handleExportSceneVideo}
                  isExportingSceneVideo={exportingVideoScenes.has(scene.sceneNumber)}
                  onDownloadPng={handleDownloadPng}
                  animationStyle={animationStyle}
                />
                {errMsg && (
                  <p
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.3)',
                      color: '#fca5a5',
                    }}
                  >
                    씬 {scene.sceneNumber} 이미지 오류: {errMsg}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Export Area */}
      {scenes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 pb-6">
          <button
            type="button"
            className="btn-primary flex items-center gap-2 text-base px-8 py-3"
            onClick={handleExportJson}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M8 1v9m0 0L5 7m3 3 3-3M2 12v2a1 1 0 001 1h10a1 1 0 001-1v-2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            📋 JSON 내보내기
          </button>

          {/* Image ZIP download */}
          <button
            type="button"
            className="flex items-center gap-2 text-base px-8 py-3 rounded-xl font-bold transition-colors"
            onClick={handleDownloadImageZip}
            disabled={isExportingImageZip || generatedCount === 0}
            aria-busy={isExportingImageZip}
            style={{
              background: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.35)',
              color: '#d8b4fe',
              opacity: (isExportingImageZip || generatedCount === 0) ? 0.5 : 1,
              cursor: (isExportingImageZip || generatedCount === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {isExportingImageZip ? <SpinnerIcon size={16} /> : <span aria-hidden>📦</span>}
            {isExportingImageZip ? 'ZIP 생성 중...' : '이미지 ZIP 다운로드'}
          </button>

          <button
            type="button"
            className="flex items-center gap-2 text-base px-8 py-3 rounded-xl font-bold transition-colors"
            onClick={handleExportCapcut}
            disabled={isExportingCapcut}
            aria-busy={isExportingCapcut}
            style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.35)',
              color: '#93c5fd',
              opacity: isExportingCapcut ? 0.6 : 1,
              cursor: isExportingCapcut ? 'wait' : 'pointer',
            }}
          >
            {isExportingCapcut ? <SpinnerIcon size={16} /> : <span aria-hidden>🎬</span>}
            {isExportingCapcut ? 'CapCut 생성 중...' : 'CapCut 프로젝트 내보내기'}
          </button>

          <button
            type="button"
            className="flex items-center gap-2 text-base px-8 py-3 rounded-xl font-bold transition-colors"
            onClick={handleExportAllVideo}
            disabled={isExportingAllVideo}
            aria-busy={isExportingAllVideo}
            style={{
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.35)',
              color: '#6ee7b7',
              opacity: isExportingAllVideo ? 0.6 : 1,
              cursor: isExportingAllVideo ? 'wait' : 'pointer',
            }}
          >
            {isExportingAllVideo ? <SpinnerIcon size={16} /> : <span aria-hidden>📦</span>}
            {isExportingAllVideo ? 'ZIP 생성 중...' : '전체 영상 ZIP 다운로드'}
          </button>
        </div>
      )}
    </div>
  );
}
