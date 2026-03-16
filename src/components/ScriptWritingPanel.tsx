'use client';

import { useEffect, useRef, useState } from 'react';
import { EpisodePlan, TopicCandidate, ScriptScene, LOADING_MESSAGES } from '@/lib/types';

interface ScriptWritingPanelProps {
  selectedTopic: TopicCandidate | null;
  episodePlan: EpisodePlan | null;
  onScriptFinalized: (scenes: ScriptScene[]) => void;
  onBack: () => void;
  onError: (msg: string) => void;
}

type Phase = 'idle' | 'drafting' | 'draft-ready' | 'finalizing' | 'done';

const SPLIT_EDITOR_MIN_WIDTH = 640; // px — below this, collapse to single textarea

export default function ScriptWritingPanel({
  selectedTopic,
  episodePlan,
  onScriptFinalized,
  onBack,
  onError,
}: ScriptWritingPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [aiDraft, setAiDraft] = useState('');        // original AI output — read-only
  const [rawScript, setRawScript] = useState('');   // user-editable copy
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isWide, setIsWide] = useState(true);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cycle through loading messages while loading
  const startLoadingMessages = () => {
    let idx = Math.floor(Math.random() * LOADING_MESSAGES.length);
    setLoadingMsg(LOADING_MESSAGES[idx]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 2200);
  };

  const stopLoadingMessages = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopLoadingMessages();
  }, []);

  // Track container width for responsive split-screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setIsWide(entry.contentRect.width >= SPLIT_EDITOR_MIN_WIDTH);
    });
    observer.observe(el);
    setIsWide(el.offsetWidth >= SPLIT_EDITOR_MIN_WIDTH);
    return () => observer.disconnect();
  }, []);

  const setError = (msg: string | null) => {
    setLocalError(msg);
    if (msg) onError(msg);
  };

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    if (apiKey) headers['x-api-key'] = apiKey;
    return headers;
  }

  const handleDraft = async () => {
    if (!episodePlan) {
      setError('에피소드 기획서가 없습니다. 이전 단계를 먼저 완료해주세요.');
      return;
    }

    setPhase('drafting');
    setLocalError(null);
    startLoadingMessages();

    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ step: 'draft', plan: episodePlan }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      const draft = data.rawScript ?? '';
      setAiDraft(draft);
      setRawScript(draft);
      setPhase('draft-ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(msg);
      setPhase('idle');
    } finally {
      stopLoadingMessages();
    }
  };

  const handleFinalize = async () => {
    if (!rawScript.trim()) {
      setError('대본 내용을 입력해주세요.');
      return;
    }
    if (!episodePlan) {
      setError('에피소드 기획서가 없습니다.');
      return;
    }

    setPhase('finalizing');
    setLocalError(null);
    startLoadingMessages();

    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ step: 'finalize', rawScript, plan: episodePlan }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `서버 오류 (${res.status})`);
      }

      const scenes: ScriptScene[] = await res.json();
      setPhase('done');
      onScriptFinalized(scenes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(msg);
      setPhase('draft-ready');
    } finally {
      stopLoadingMessages();
    }
  };

  const isLoading = phase === 'drafting' || phase === 'finalizing';
  const plan = episodePlan;

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        disabled={isLoading}
        className="flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        이전 단계로
      </button>

      {/* Episode Plan Summary */}
      {plan ? (
        <div className="card">
          <h2
            className="text-xl font-bold mb-4"
            style={{ color: 'var(--accent)' }}
          >
            에피소드 기획 요약
          </h2>

          <div className="mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              제목
            </span>
            <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {plan.title}
            </p>
          </div>

          <div className="mb-4">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              줄거리
            </span>
            <p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {plan.synopsis}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cast */}
            <div>
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                출연진
              </span>
              <ul className="mt-1 space-y-1">
                {plan.cast.map((member) => (
                  <li key={member.countryCode} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{
                        background: 'rgba(233,69,96,0.15)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(233,69,96,0.3)',
                      }}
                    >
                      {member.countryCode}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium">{member.role}</span>
                      <span style={{ color: 'var(--text-secondary)' }}> — {member.personality}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Act Structure */}
            <div>
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                막 구성
              </span>
              <ol className="mt-1 space-y-1">
                {plan.actStructure.map((act, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(233,69,96,0.2)', color: 'var(--accent)' }}
                    >
                      {i + 1}
                    </span>
                    <span>{act}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Comedy Beats */}
          {plan.comedyBeats.length > 0 && (
            <div className="mt-4">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                개그 포인트
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {plan.comedyBeats.map((beat, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {beat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Korea Win Moment */}
          {plan.koreaWinMoment && (
            <div
              className="mt-4 p-3 rounded-lg text-sm"
              style={{
                background: 'rgba(233,69,96,0.08)',
                border: '1px solid rgba(233,69,96,0.25)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                한국의 하이라이트:
              </span>{' '}
              {plan.koreaWinMoment}
            </div>
          )}
        </div>
      ) : (
        <div
          className="card text-sm text-center py-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          에피소드 기획서가 없습니다. 이전 단계(기획 & 캐스팅)를 먼저 완료해주세요.
        </div>
      )}

      {/* Draft Button — only shown before a draft exists */}
      {(phase === 'idle' || phase === 'drafting') && plan && (
        <div className="flex flex-col items-center gap-3">
          {phase === 'idle' && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              기획서를 바탕으로 AI가 대본 초안을 작성합니다.
            </p>
          )}
          <button
            className="btn-primary text-base px-8 py-3"
            onClick={handleDraft}
            disabled={isLoading}
          >
            {phase === 'drafting' ? '초안 작성 중...' : '대본 초안 작성'}
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div
          className="flex items-center justify-center gap-3 p-4 rounded-xl"
          style={{
            background: 'rgba(233,69,96,0.07)',
            border: '1px solid rgba(233,69,96,0.2)',
          }}
        >
          <svg
            className="animate-spin shrink-0"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" stroke="rgba(233,69,96,0.3)" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
            {loadingMsg}
          </span>
        </div>
      )}

      {/* Local error (inline, separate from global onError banner) */}
      {localError && (
        <div
          className="p-4 rounded-xl text-sm"
          style={{
            background: 'rgba(220,38,38,0.1)',
            border: '1px solid rgba(220,38,38,0.4)',
            color: '#fca5a5',
          }}
        >
          <span className="font-semibold">오류:</span> {localError}
        </div>
      )}

      {/* Script Editor */}
      {(phase === 'draft-ready' || phase === 'finalizing' || phase === 'done') && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              대본 초안
            </h3>
            <button
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onClick={handleDraft}
              disabled={isLoading}
            >
              다시 생성
            </button>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            AI가 생성한 초안을 자유롭게 수정할 수 있습니다. 수정 후 아래 버튼으로 확정하세요.
          </p>

          {/* ── Split-screen editor ─────────────────────────────── */}
          {isWide ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 4px 1fr',
                gap: 0,
                minHeight: '28rem',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {/* Left: AI draft (read-only) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  className="text-xs font-semibold px-3 py-1.5"
                  style={{
                    background: 'rgba(0,0,0,0.45)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.04em',
                  }}
                >
                  AI 초안 (참고용)
                </div>
                <textarea
                  readOnly
                  aria-label="AI 초안 (읽기 전용)"
                  className="flex-1 w-full p-4 text-sm leading-relaxed font-mono resize-none focus:outline-none"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    color: 'rgba(255,255,255,0.45)',
                    cursor: 'default',
                    border: 'none',
                  }}
                  value={aiDraft}
                  placeholder="AI 초안이 여기에 표시됩니다..."
                />
              </div>

              {/* Divider */}
              <div
                aria-hidden="true"
                style={{ background: 'rgba(255,255,255,0.1)', width: '4px' }}
              />

              {/* Right: user edit */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  className="text-xs font-semibold px-3 py-1.5"
                  style={{
                    background: 'rgba(233,69,96,0.08)',
                    borderBottom: '1px solid rgba(233,69,96,0.2)',
                    color: 'var(--accent)',
                    letterSpacing: '0.04em',
                  }}
                >
                  편집본 (수정 가능)
                </div>
                <textarea
                  aria-label="편집본 (수정 가능)"
                  className="flex-1 w-full p-4 text-sm leading-relaxed font-mono resize-none focus:outline-none focus:ring-2"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary)',
                    caretColor: 'var(--accent)',
                    border: 'none',
                  }}
                  value={rawScript}
                  onChange={(e) => setRawScript(e.target.value)}
                  placeholder="대본 내용이 여기에 표시됩니다..."
                  disabled={isLoading}
                />
              </div>
            </div>
          ) : (
            /* Mobile: single editable textarea */
            <textarea
              aria-label="대본 편집"
              className="w-full rounded-xl p-4 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 font-mono"
              style={{
                minHeight: '28rem',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                caretColor: 'var(--accent)',
              }}
              value={rawScript}
              onChange={(e) => setRawScript(e.target.value)}
              placeholder="대본 내용이 여기에 표시됩니다..."
              disabled={isLoading}
            />
          )}

          <div className="flex justify-end">
            <button
              className="btn-primary text-base px-8 py-3"
              onClick={handleFinalize}
              disabled={isLoading || !rawScript.trim()}
            >
              {phase === 'finalizing'
                ? '스토리보드로 변환 중...'
                : '대본 확정 & 스토리보드 변환'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
