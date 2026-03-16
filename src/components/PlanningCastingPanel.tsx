'use client';

import { useState, useEffect, useRef } from 'react';
import { TopicCandidate, EpisodePlan, CastMember, CastPosition, LOADING_MESSAGES } from '@/lib/types';
import CountryBallIcon from '@/components/CountryBallIcon';

// ─── Loading spinner ───────────────────────────────────────────────────────

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div
        className="w-9 h-9 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm animate-pulse" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </div>
  );
}

// ─── Role badge ────────────────────────────────────────────────────────────

interface RoleBadgeProps {
  role: string;
}

const ROLE_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  주인공:  { bg: 'bg-red-900/60',    text: 'text-red-300'    },
  라이벌:  { bg: 'bg-orange-900/60', text: 'text-orange-300' },
  조연:    { bg: 'bg-blue-900/60',   text: 'text-blue-300'   },
  narrator:{ bg: 'bg-purple-900/60', text: 'text-purple-300' },
};

function RoleBadge({ role }: RoleBadgeProps) {
  const lower = role.toLowerCase();
  const entry =
    Object.entries(ROLE_COLOR_MAP).find(([key]) => lower.includes(key)) ??
    Object.entries(ROLE_COLOR_MAP)[2];
  const [, { bg, text }] = entry;
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}
    >
      {role}
    </span>
  );
}

// ─── Cast member card (editable) ──────────────────────────────────────────

const CAST_POSITION_OPTIONS: { value: CastPosition; label: string }[] = [
  { value: 'LEFT',       label: '왼쪽 (LEFT)'       },
  { value: 'RIGHT',      label: '오른쪽 (RIGHT)'     },
  { value: 'CENTER',     label: '가운데 (CENTER)'    },
  { value: 'BACKGROUND', label: '배경 (BACKGROUND)'  },
];

interface CastCardProps {
  member: CastMember;
  imageUrl?: string;
  isGeneratingImage: boolean;
  onGenerateImage: (member: CastMember) => void;
  onUpdate: (updated: CastMember) => void;
  onRemove: () => void;
}

function CastCard({
  member,
  imageUrl,
  isGeneratingImage,
  onGenerateImage,
  onUpdate,
  onRemove,
}: CastCardProps) {
  const countryName =
    typeof Intl !== 'undefined'
      ? new Intl.DisplayNames(['ko'], { type: 'region' }).of(member.countryCode) ??
        member.countryCode
      : member.countryCode;

  const fieldStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
  } as React.CSSProperties;

  function patch(partial: Partial<CastMember>) {
    onUpdate({ ...member, ...partial });
  }

  return (
    <div
      className="card relative flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      {/* Remove button */}
      <button
        type="button"
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold transition-opacity hover:opacity-80"
        style={{ background: 'rgba(233,69,96,0.25)', color: '#ff6b81' }}
        onClick={onRemove}
        aria-label={`${member.countryCode}볼 캐릭터 삭제`}
      >
        ✕
      </button>

      {/* Ball icon + country name */}
      <div className="flex items-center gap-4 pr-8">
        <div className="shrink-0">
          <CountryBallIcon
            countryCode={member.countryCode}
            size={72}
            emotion="NEUTRAL"
            style="STOP_MOTION"
            isTalking={false}
          />
        </div>
        <div className="flex flex-col gap-1">
          {/* Editable country code / name display */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
              htmlFor={`cast-name-${member.countryCode}`}
            >
              국가 코드
            </label>
            <input
              id={`cast-name-${member.countryCode}`}
              type="text"
              value={member.countryCode}
              onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })}
              maxLength={2}
              className="rounded px-2 py-1 text-sm font-bold w-16 outline-none"
              style={fieldStyle}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {countryName}
          </p>
          <RoleBadge role={member.role} />
        </div>
      </div>

      {/* Role field */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
          htmlFor={`cast-role-${member.countryCode}`}
        >
          역할
        </label>
        <input
          id={`cast-role-${member.countryCode}`}
          type="text"
          value={member.role}
          onChange={(e) => patch({ role: e.target.value })}
          className="rounded-lg px-3 py-1.5 text-sm outline-none transition-all"
          style={fieldStyle}
          placeholder="예: 주인공, 라이벌, 조연"
        />
      </div>

      {/* Personality field */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
          htmlFor={`cast-personality-${member.countryCode}`}
        >
          성격
        </label>
        <input
          id={`cast-personality-${member.countryCode}`}
          type="text"
          value={member.personality}
          onChange={(e) => patch({ personality: e.target.value })}
          className="rounded-lg px-3 py-1.5 text-sm outline-none transition-all"
          style={fieldStyle}
          placeholder="예: 자신감 넘치는 강대국"
        />
      </div>

      {/* Visual cue textarea */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
          htmlFor={`cast-visual-${member.countryCode}`}
        >
          외모 특징 (Visual Cue)
        </label>
        <textarea
          id={`cast-visual-${member.countryCode}`}
          rows={2}
          value={member.visualCue ?? ''}
          onChange={(e) => patch({ visualCue: e.target.value })}
          className="rounded-lg px-3 py-1.5 text-sm outline-none resize-y transition-all"
          style={{ ...fieldStyle, minHeight: '56px' }}
          placeholder="예: 태극기 패턴, 눈이 초롱초롱"
        />
      </div>

      {/* Position dropdown */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
          htmlFor={`cast-position-${member.countryCode}`}
        >
          화면 위치
        </label>
        <select
          id={`cast-position-${member.countryCode}`}
          value={member.position ?? 'CENTER'}
          onChange={(e) => patch({ position: e.target.value as CastPosition })}
          className="rounded-lg px-3 py-1.5 text-sm outline-none transition-all"
          style={fieldStyle}
        >
          {CAST_POSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Character image area */}
      {imageUrl ? (
        <div className="rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${member.countryCode}볼 캐릭터 이미지`}
            className="w-full object-contain"
            style={{ maxHeight: '180px' }}
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-lg h-16 text-sm"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.12)',
            color: 'var(--text-secondary)',
          }}
        >
          이미지 없음
        </div>
      )}

      {/* Generate image button */}
      <button
        type="button"
        className="w-full text-sm py-2 px-3 rounded-lg font-medium border transition-all duration-200 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{
          borderColor: 'rgba(233,69,96,0.4)',
          color: 'var(--accent)',
          background: 'rgba(233,69,96,0.08)',
        }}
        onClick={() => onGenerateImage(member)}
        disabled={isGeneratingImage}
      >
        {isGeneratingImage ? (
          <>
            <span
              className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
            생성 중...
          </>
        ) : (
          '🎨 캐릭터 이미지 생성'
        )}
      </button>
    </div>
  );
}

// ─── New empty cast member factory ────────────────────────────────────────

function createEmptyCastMember(): CastMember {
  return {
    countryCode: 'XX',
    role: '조연',
    personality: '',
    visualCue: '',
    position: 'CENTER',
  };
}

// ─── Main component ────────────────────────────────────────────────────────

interface PlanningCastingPanelProps {
  topic?: TopicCandidate | null;
  selectedTopic?: TopicCandidate | null;
  onPlanComplete: (plan: EpisodePlan) => void;
  onBack?: () => void;
  onError?: (message: string) => void;
}

export default function PlanningCastingPanel({
  topic: topicProp,
  selectedTopic,
  onPlanComplete,
  onBack,
  onError,
}: PlanningCastingPanelProps) {
  const topic = topicProp ?? selectedTopic ?? null;

  // ── State ──
  const [facts, setFacts] = useState<string>(() =>
    topic ? topic.keyFacts.join('\n') : ''
  );
  const [plan, setPlan] = useState<EpisodePlan | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [planLoadingMsg, setPlanLoadingMsg] = useState('');
  const [planError, setPlanError] = useState<string | null>(null);

  // Local editable cast list — initialized from plan when plan loads
  const [editableCast, setEditableCast] = useState<CastMember[]>([]);

  // Per-character image state: key = countryCode
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});

  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate loading messages while generating plan
  useEffect(() => {
    if (isPlanLoading) {
      setPlanLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
      msgIntervalRef.current = setInterval(() => {
        setPlanLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
      }, 1800);
    } else {
      if (msgIntervalRef.current) {
        clearInterval(msgIntervalRef.current);
        msgIntervalRef.current = null;
      }
    }
    return () => {
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
    };
  }, [isPlanLoading]);

  // Sync editableCast when plan changes
  useEffect(() => {
    if (plan) {
      setEditableCast(plan.cast.map((m) => ({ ...m })));
      setImageUrls({});
      setGeneratingImages({});
      setImageErrors({});
    }
  }, [plan]);

  // ── Handlers ──

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    if (apiKey) headers['x-api-key'] = apiKey;
    return headers;
  }

  async function handleGeneratePlan() {
    if (!topic) return;
    setPlanError(null);
    setIsPlanLoading(true);
    try {
      const parsedFacts = facts
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          step: 'plan',
          title: topic.title,
          facts: parsedFacts.length > 0 ? parsedFacts : topic.keyFacts,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `서버 오류 (${res.status})`);
      }

      const data: EpisodePlan = await res.json();
      setPlan(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setPlanError(msg);
      onError?.(msg);
    } finally {
      setIsPlanLoading(false);
    }
  }

  async function handleGenerateCharacterImage(member: CastMember) {
    const key = member.countryCode;
    setGeneratingImages((prev) => ({ ...prev, [key]: true }));
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const masterPrompt = `${member.countryCode}볼 (${member.role}): ${member.personality}. 해당 국기 패턴의 구체 형태, 눈과 표정만으로 캐릭터 표현, 컨트리볼 스타일.`;

      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ step: 'character-image', masterPrompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `서버 오류 (${res.status})`);
      }

      const data: { imageUrl: string } = await res.json();
      if (data.imageUrl) {
        setImageUrls((prev) => ({ ...prev, [key]: data.imageUrl }));
      } else {
        setImageErrors((prev) => ({
          ...prev,
          [key]: '이미지 생성 기능이 아직 구현 중입니다.',
        }));
      }
    } catch (e) {
      setImageErrors((prev) => ({
        ...prev,
        [key]: e instanceof Error ? e.message : '알 수 없는 오류',
      }));
    } finally {
      setGeneratingImages((prev) => ({ ...prev, [key]: false }));
    }
  }

  function handleUpdateCastMember(index: number, updated: CastMember) {
    setEditableCast((prev) => prev.map((m, i) => (i === index ? updated : m)));
  }

  function handleRemoveCastMember(index: number) {
    setEditableCast((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddCastMember() {
    setEditableCast((prev) => [...prev, createEmptyCastMember()]);
  }

  function handleNext() {
    if (plan) {
      onPlanComplete({ ...plan, cast: editableCast });
    }
  }

  // ── Render ──

  if (!topic) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <span className="text-4xl">⚠️</span>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          선택된 소재가 없습니다
        </p>
        {onBack && (
          <button type="button" className="btn-primary px-6 py-2.5 text-sm rounded-xl" onClick={onBack}>
            ← 소재 발굴로 돌아가기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Back button ── */}
      {onBack && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
            onClick={onBack}
          >
            ← 소재 발굴로 돌아가기
          </button>
        </div>
      )}

      {/* ── Selected topic info ── */}
      <div className="card" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">📰</span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {topic.title}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {topic.oneLiner}
            </p>
            {topic.koreaAngle && (
              <p className="text-xs mt-1 italic" style={{ color: 'var(--accent)' }}>
                🇰🇷 {topic.koreaAngle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Fact input ── */}
      <div className="card" style={{ background: 'var(--bg-card)' }}>
        <label
          className="block font-semibold mb-3"
          style={{ color: 'var(--text-primary)' }}
          htmlFor="facts-input"
        >
          📋 팩트 입력
        </label>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          한 줄에 하나씩 핵심 팩트를 입력하세요. 기획서 생성에 반영됩니다.
        </p>
        <textarea
          id="facts-input"
          rows={6}
          value={facts}
          onChange={(e) => setFacts(e.target.value)}
          placeholder={`예:\n한국 반도체 세계 점유율 60%\n삼성·SK하이닉스 연간 수출 1500억 달러\n미국·일본 반도체 지원금 경쟁`}
          className="w-full rounded-lg px-4 py-3 text-sm leading-relaxed outline-none resize-y transition-all"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-primary)',
            minHeight: '120px',
          }}
          disabled={isPlanLoading}
        />

        <button
          type="button"
          className="btn-primary mt-4 w-full py-3 rounded-xl text-sm font-semibold"
          onClick={handleGeneratePlan}
          disabled={isPlanLoading}
        >
          {isPlanLoading ? '생성 중...' : '🎬 기획서 생성'}
        </button>
      </div>

      {/* ── Plan loading ── */}
      {isPlanLoading && <LoadingSpinner message={planLoadingMsg} />}

      {/* ── Plan error ── */}
      {planError && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'rgba(233,69,96,0.15)',
            border: '1px solid rgba(233,69,96,0.4)',
            color: '#ff6b81',
          }}
        >
          ⚠️ {planError}
        </div>
      )}

      {/* ── Generated plan ── */}
      {plan && !isPlanLoading && (
        <div className="flex flex-col gap-5">

          {/* Episode title + logline */}
          <div className="card" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--accent)' }}>
              {plan.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {plan.synopsis}
            </p>
          </div>

          {/* Act structure */}
          {plan.actStructure.length > 0 && (
            <div className="card" style={{ background: 'var(--bg-card)' }}>
              <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                🎭 막 구성
              </h4>
              <ol className="space-y-2">
                {plan.actStructure.map((act, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{act}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Comedy beats */}
          {plan.comedyBeats.length > 0 && (
            <div className="card" style={{ background: 'var(--bg-card)' }}>
              <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                🤣 개그 포인트
              </h4>
              <ul className="space-y-1.5">
                {plan.comedyBeats.map((beat, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span style={{ color: 'var(--accent)' }}>•</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{beat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Korea win moment */}
          {plan.koreaWinMoment && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: 'rgba(233,69,96,0.1)',
                border: '1px solid rgba(233,69,96,0.3)',
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                🇰🇷 한국의 하이라이트:
              </span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>{plan.koreaWinMoment}</span>
            </div>
          )}

          {/* Cast section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4
                className="font-semibold text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                🌍 캐스팅 ({editableCast.length}명)
              </h4>
            </div>

            {/* Per-character image error banner */}
            {Object.entries(imageErrors).map(([code, msg]) => (
              <div
                key={code}
                className="mb-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: 'rgba(233,69,96,0.12)',
                  border: '1px solid rgba(233,69,96,0.3)',
                  color: '#ff6b81',
                }}
              >
                {code}볼 이미지 오류: {msg}
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editableCast.map((member, index) => (
                <CastCard
                  key={`${member.countryCode}-${index}`}
                  member={member}
                  imageUrl={imageUrls[member.countryCode]}
                  isGeneratingImage={!!generatingImages[member.countryCode]}
                  onGenerateImage={handleGenerateCharacterImage}
                  onUpdate={(updated) => handleUpdateCastMember(index, updated)}
                  onRemove={() => handleRemoveCastMember(index)}
                />
              ))}
            </div>

            {/* Add cast member button */}
            <button
              type="button"
              className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed transition-all duration-200 hover:opacity-80 flex items-center justify-center gap-2"
              style={{
                borderColor: 'rgba(255,255,255,0.18)',
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
              onClick={handleAddCastMember}
            >
              + 캐릭터 추가
            </button>
          </div>

          {/* Next step button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="btn-primary px-8 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
              onClick={handleNext}
            >
              다음 단계: 대본 작성 →
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state (no plan yet) ── */}
      {!plan && !isPlanLoading && !planError && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <span className="text-4xl">📄</span>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            팩트를 확인하고 <strong style={{ color: 'var(--text-primary)' }}>기획서 생성</strong>{' '}
            버튼을 누르세요
          </p>
        </div>
      )}
    </div>
  );
}
