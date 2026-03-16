'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TopicCandidate, UsedTopic, LOADING_MESSAGES } from '@/lib/types';

// ─── Category helpers ──────────────────────────────────────────────────────

type CategoryKey = 'WARM' | 'CURIOUS' | 'RELATABLE' | 'PRIDE';

interface CategoryMeta {
  emoji: string;
  label: string;
  color: string;
  textColor: string;
}

const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  WARM:      { emoji: '💖', label: '훈훈',  color: 'bg-pink-900/60',   textColor: 'text-pink-300'   },
  CURIOUS:   { emoji: '❓', label: '호기심', color: 'bg-blue-900/60',   textColor: 'text-blue-300'   },
  RELATABLE: { emoji: '🤣', label: '공감',  color: 'bg-yellow-900/60', textColor: 'text-yellow-300' },
  PRIDE:     { emoji: '🔥', label: '국뽕',  color: 'bg-red-900/60',    textColor: 'text-red-300'    },
};

function inferCategory(topic: TopicCandidate): CategoryKey {
  const text = `${topic.title} ${topic.oneLiner} ${topic.humorPotential}`.toLowerCase();
  if (text.includes('훈훈') || text.includes('감동') || text.includes('따뜻'))  return 'WARM';
  if (text.includes('호기심') || text.includes('왜') || text.includes('신기'))  return 'CURIOUS';
  if (text.includes('공감') || text.includes('비교') || text.includes('우리')) return 'RELATABLE';
  return 'PRIDE';
}

// ─── Score (stars) helper ──────────────────────────────────────────────────

function ScoreStars({ topic }: { topic: TopicCandidate }) {
  const score = Math.min(
    5,
    Math.max(
      1,
      topic.keyFacts.length +
        (topic.koreaAngle.length > 20 ? 1 : 0) +
        (topic.humorPotential.length > 20 ? 1 : 0)
    )
  );
  return (
    <div className="flex gap-0.5" aria-label={`점수 ${score}점`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="text-sm"
          style={{ color: i < score ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ─── Single topic card ─────────────────────────────────────────────────────

interface TopicCardProps {
  topic: TopicCandidate;
  isUsed: boolean;
  onSelect: (topic: TopicCandidate) => void;
  onDeepDive: (topic: TopicCandidate) => void;
}

function TopicCard({ topic, isUsed, onSelect, onDeepDive }: TopicCardProps) {
  const category = inferCategory(topic);
  const meta = CATEGORY_META[category];
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="card relative flex flex-col gap-3 transition-all duration-200"
      style={{
        opacity: isUsed ? 0.55 : 1,
        borderColor: isUsed ? 'rgba(255,255,255,0.1)' : undefined,
      }}
    >
      {/* Used badge */}
      {isUsed && (
        <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
          사용됨
        </span>
      )}

      {/* Header row */}
      <div className="flex items-start gap-2">
        <span
          className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${meta.color} ${meta.textColor}`}
        >
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* Title */}
      <h3
        className="font-bold text-base leading-snug"
        style={{ color: 'var(--text-primary)' }}
      >
        {topic.title}
      </h3>

      {/* One-liner */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {topic.oneLiner}
      </p>

      {/* Score */}
      <ScoreStars topic={topic} />

      {/* Expandable detail */}
      {expanded && (
        <div
          className="mt-1 rounded-lg p-3 text-xs space-y-2"
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              핵심 팩트
            </span>
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {topic.keyFacts.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              한국 각도
            </span>
            <p className="mt-0.5">{topic.koreaAngle}</p>
          </div>
          <div>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              웃음 포인트
            </span>
            <p className="mt-0.5">{topic.humorPotential}</p>
          </div>
          {topic.sourceHint && (
            <div>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                출처 힌트
              </span>
              <p className="mt-0.5 italic">{topic.sourceHint}</p>
            </div>
          )}
        </div>
      )}

      {/* Toggle detail */}
      <button
        type="button"
        className="text-xs self-start underline underline-offset-2 transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? '접기' : '자세히 보기'}
      </button>

      {/* Action buttons */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          type="button"
          className="flex-1 text-sm py-2 px-3 rounded-lg font-medium border transition-all duration-200 hover:opacity-80"
          style={{
            borderColor: 'rgba(233,69,96,0.4)',
            color: 'var(--accent)',
            background: 'rgba(233,69,96,0.08)',
          }}
          onClick={() => onDeepDive(topic)}
        >
          🔍 Deep Dive
        </button>
        <button
          type="button"
          className="btn-primary flex-1 text-sm py-2 px-3 rounded-lg"
          onClick={() => onSelect(topic)}
        >
          이 소재로 시작
        </button>
      </div>
    </div>
  );
}

// ─── Briefing modal ────────────────────────────────────────────────────────

interface BriefingModalProps {
  topic: TopicCandidate;
  onConfirm: (modified: TopicCandidate) => void;
  onCancel: () => void;
}

function BriefingModal({ topic, onConfirm, onCancel }: BriefingModalProps) {
  const [title, setTitle] = useState(topic.title);
  const [facts, setFacts] = useState(topic.keyFacts.join('\n'));
  const [sourceUrl, setSourceUrl] = useState(topic.sourceHint ?? '');

  function handleConfirm() {
    const parsedFacts = facts
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    onConfirm({
      ...topic,
      title: title.trim() || topic.title,
      keyFacts: parsedFacts.length > 0 ? parsedFacts : topic.keyFacts,
      sourceHint: sourceUrl.trim(),
    });
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: 'var(--text-primary)',
  } as React.CSSProperties;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col gap-5 p-6 shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="briefing-modal-title"
            className="text-base font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            📋 작전 브리핑
          </h2>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)' }}
            onClick={onCancel}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Korea angle — read-only callout */}
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background: 'rgba(233,69,96,0.1)',
            border: '1px solid rgba(233,69,96,0.3)',
            color: 'var(--accent)',
          }}
        >
          <span className="font-semibold">🇰🇷 한국 각도: </span>
          <span style={{ color: 'var(--text-primary)' }}>{topic.koreaAngle}</span>
        </div>

        {/* Title field */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="briefing-title"
            className="text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            제목
          </label>
          <input
            id="briefing-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none transition-all"
            style={inputStyle}
          />
        </div>

        {/* Key facts textarea */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="briefing-facts"
            className="text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            핵심 팩트 (한 줄에 하나씩)
          </label>
          <textarea
            id="briefing-facts"
            rows={5}
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none resize-y transition-all"
            style={{ ...inputStyle, minHeight: '100px' }}
          />
        </div>

        {/* Source URL */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="briefing-source"
            className="text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            출처 URL
          </label>
          <input
            id="briefing-source"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-lg px-3 py-2 text-sm outline-none transition-all"
            style={inputStyle}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 hover:opacity-80"
            style={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.04)',
            }}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold"
            onClick={handleConfirm}
          >
            이 팩트로 작전 승인
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Similarity filter ────────────────────────────────────────────────────

function isSimilarTopic(title1: string, title2: string): boolean {
  const tokenize = (s: string) =>
    s.split(/[\s,.:;!?]+/).filter((w) => w.length > 1);
  const words1 = tokenize(title1);
  const words2 = tokenize(title2);
  const overlap = words1.filter((w) => words2.includes(w));
  return overlap.length >= 3;
}

/** Remove candidates too similar to already-displayed or used topics. */
function deduplicateTopics(
  incoming: TopicCandidate[],
  existing: TopicCandidate[],
  usedTitles: string[],
): TopicCandidate[] {
  const referenceSet = [
    ...existing.map((t) => t.title),
    ...usedTitles,
  ];
  return incoming.filter(
    (candidate) =>
      !referenceSet.some((ref) => isSimilarTopic(candidate.title, ref))
  );
}

// ─── Loading overlay ───────────────────────────────────────────────────────

function LoadingBar({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div
        className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm font-medium animate-pulse" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </div>
  );
}

// ─── localStorage helpers ─────────────────────────────────────────────────

const STORAGE_KEY = 'countryball_used_topics';

function loadUsedTopics(): UsedTopic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UsedTopic[]) : [];
  } catch {
    return [];
  }
}

function saveUsedTopics(topics: UsedTopic[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
  } catch {
    // ignore
  }
}

// ─── Main component ────────────────────────────────────────────────────────

interface TopicDiscoveryPanelProps {
  onTopicSelected: (topic: TopicCandidate) => void;
  onError?: (message: string) => void;
}

export default function TopicDiscoveryPanel({ onTopicSelected, onError }: TopicDiscoveryPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [topics, setTopics] = useState<TopicCandidate[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [deepDiveSource, setDeepDiveSource] = useState<TopicCandidate | null>(null);
  const [deepDivePage, setDeepDivePage] = useState(1);
  const [usedTopics, setUsedTopics] = useState<UsedTopic[]>([]);
  const [showUsedList, setShowUsedList] = useState(false);

  // Briefing modal state
  const [briefingTopic, setBriefingTopic] = useState<TopicCandidate | null>(null);

  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Sentinel div for IntersectionObserver infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Prevent double-trigger while already loading
  const isLoadingRef = useRef(false);

  // Load used topics from localStorage on mount
  useEffect(() => {
    setUsedTopics(loadUsedTopics());
  }, []);

  // Rotate loading messages
  useEffect(() => {
    if (isLoading) {
      setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
      msgIntervalRef.current = setInterval(() => {
        setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
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
  }, [isLoading]);

  const isUsedTitle = useCallback(
    (title: string) => usedTopics.some((u) => u.title === title),
    [usedTopics]
  );

  // ── Helper: build fetch headers with optional API key ──

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    if (apiKey) headers['x-api-key'] = apiKey;
    return headers;
  }

  // ── Fetch normal topics ──

  const fetchTopics = useCallback(
    async (nextPage: number, append: boolean) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const usedTitles = loadUsedTopics().map((u) => u.title);
        const res = await fetch('/api/news', {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({
            page: nextPage,
            keyword: keyword.trim() || undefined,
            usedTopics: usedTitles,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `서버 오류 (${res.status})`);
        }
        const raw: TopicCandidate[] = await res.json();

        setTopics((prev) => {
          const filtered = deduplicateTopics(
            raw,
            append ? prev : [],
            loadUsedTopics().map((u) => u.title),
          );
          return append ? [...prev, ...filtered] : filtered;
        });
        setPage(nextPage);
        setHasMore(raw.length >= 10);
        setDeepDiveSource(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 오류';
        setError(msg);
        onError?.(msg);
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    },
    [keyword, onError]
  );

  // ── Fetch deep dive topics ──

  const fetchDeepDive = useCallback(async (source: TopicCandidate, nextPage: number, append: boolean) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const usedTitles = loadUsedTopics().map((u) => u.title);
      const res = await fetch('/api/news/similar', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          topic: source.title,
          page: nextPage,
          usedTopics: usedTitles,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `서버 오류 (${res.status})`);
      }
      const raw: TopicCandidate[] = await res.json();

      setTopics((prev) => {
        const filtered = deduplicateTopics(
          raw,
          append ? prev : [],
          loadUsedTopics().map((u) => u.title),
        );
        return append ? [...prev, ...filtered] : filtered;
      });
      setDeepDivePage(nextPage);
      setHasMore(raw.length >= 6);
      setDeepDiveSource(source);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [onError]);

  // ── IntersectionObserver: auto-load next page when sentinel enters viewport ──

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingRef.current) {
          if (deepDiveSource) {
            fetchDeepDive(deepDiveSource, deepDivePage + 1, true);
          } else {
            fetchTopics(page + 1, true);
          }
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, page, deepDivePage, deepDiveSource, fetchTopics, fetchDeepDive]);

  // ── Handlers ──

  function handleSearch() {
    fetchTopics(1, false);
  }

  function handleRandom() {
    setKeyword('');
    fetchTopics(1, false);
  }

  function handleLoadMore() {
    if (deepDiveSource) {
      fetchDeepDive(deepDiveSource, deepDivePage + 1, true);
    } else {
      fetchTopics(page + 1, true);
    }
  }

  function handleDeepDive(source: TopicCandidate) {
    fetchDeepDive(source, 1, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Opens briefing modal instead of immediately selecting
  function handleOpenBriefing(topic: TopicCandidate) {
    setBriefingTopic(topic);
  }

  function handleBriefingConfirm(modified: TopicCandidate) {
    setBriefingTopic(null);
    // Mark as used
    const updated = [
      { title: modified.title, usedAt: new Date().toISOString() },
      ...usedTopics.filter((u) => u.title !== modified.title),
    ];
    setUsedTopics(updated);
    saveUsedTopics(updated);
    onTopicSelected(modified);
  }

  function handleBriefingCancel() {
    setBriefingTopic(null);
  }

  function handleRestoreTopic(ut: UsedTopic) {
    const existing = topics.find((t) => t.title === ut.title);
    if (existing) {
      onTopicSelected(existing);
    }
  }

  function handleRemoveUsed(title: string) {
    const updated = usedTopics.filter((u) => u.title !== title);
    setUsedTopics(updated);
    saveUsedTopics(updated);
  }

  function handleClearAllUsed() {
    setUsedTopics([]);
    saveUsedTopics([]);
    setShowUsedList(false);
  }

  // ── Render ──

  return (
    <div className="flex flex-col gap-6">

      {/* ── Briefing modal (portal-less, fixed overlay) ── */}
      {briefingTopic && (
        <BriefingModal
          topic={briefingTopic}
          onConfirm={handleBriefingConfirm}
          onCancel={handleBriefingCancel}
        />
      )}

      {/* ── Search bar ── */}
      <div
        className="card flex flex-col gap-4"
        style={{ background: 'var(--bg-card)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          🔎 소재 발굴
        </h2>

        <div className="flex gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
            placeholder="키워드 입력 (예: 반도체, K-방산, 한식)"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-primary)',
            }}
            disabled={isLoading}
          />
          <button
            type="button"
            className="btn-primary px-5 py-2.5 text-sm rounded-lg whitespace-nowrap"
            onClick={handleSearch}
            disabled={isLoading}
          >
            소재 발굴
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 hover:opacity-80"
            style={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.04)',
            }}
            onClick={handleRandom}
            disabled={isLoading}
          >
            🎲 랜덤 탐색
          </button>

          {/* Used topics badge */}
          {usedTopics.length > 0 && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 hover:opacity-80 ml-auto"
              style={{
                borderColor: 'rgba(233,69,96,0.3)',
                color: 'var(--accent)',
                background: 'rgba(233,69,96,0.06)',
              }}
              onClick={() => setShowUsedList((p) => !p)}
            >
              📋 사용한 소재
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {usedTopics.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Used topics list ── */}
      {showUsedList && usedTopics.length > 0 && (
        <div className="card" style={{ background: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              사용한 소재 목록
            </h3>
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-lg border transition-opacity hover:opacity-80"
              style={{
                borderColor: 'rgba(255,100,100,0.4)',
                color: '#ff6b81',
                background: 'rgba(255,100,100,0.08)',
              }}
              onClick={handleClearAllUsed}
            >
              전체 초기화
            </button>
          </div>
          <ul className="space-y-2">
            {usedTopics.map((ut) => {
              const canRestore = topics.some((t) => t.title === ut.title);
              return (
                <li
                  key={ut.title}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {ut.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(ut.usedAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canRestore && (
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border transition-opacity hover:opacity-80"
                        style={{
                          borderColor: 'rgba(233,69,96,0.4)',
                          color: 'var(--accent)',
                        }}
                        onClick={() => handleRestoreTopic(ut)}
                      >
                        복원
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded border transition-opacity hover:opacity-80"
                      style={{
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: 'var(--text-secondary)',
                      }}
                      onClick={() => handleRemoveUsed(ut.title)}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Deep dive banner ── */}
      {deepDiveSource && !isLoading && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'rgba(233,69,96,0.12)',
            border: '1px solid rgba(233,69,96,0.3)',
          }}
        >
          <div style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Deep Dive: </span>
            {deepDiveSource.title} 유사 소재
          </div>
          <button
            type="button"
            className="text-xs underline underline-offset-2 shrink-0 hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => fetchTopics(1, false)}
          >
            전체 목록으로
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'rgba(233,69,96,0.15)',
            border: '1px solid rgba(233,69,96,0.4)',
            color: '#ff6b81',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && <LoadingBar message={loadingMsg} />}

      {/* ── Topic grid ── */}
      {!isLoading && topics.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topics.map((topic, idx) => (
              <TopicCard
                key={`${topic.title}-${idx}`}
                topic={topic}
                isUsed={isUsedTitle(topic.title)}
                onSelect={handleOpenBriefing}
                onDeepDive={handleDeepDive}
              />
            ))}
          </div>

          {/* Sentinel div for IntersectionObserver */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />

          {/* Fallback manual load-more button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="btn-primary px-8 py-3 rounded-xl text-sm"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                더 불러오기 ↓
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!isLoading && topics.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <span className="text-5xl">🌍</span>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            소재를 발굴해보세요
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            키워드를 입력하거나 랜덤 탐색으로 국뽕 소재를 찾아보세요
          </p>
          <button
            type="button"
            className="btn-primary px-6 py-2.5 text-sm rounded-xl"
            onClick={handleRandom}
          >
            🎲 랜덤으로 시작하기
          </button>
        </div>
      )}
    </div>
  );
}
