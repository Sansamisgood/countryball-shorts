'use client';

import { useState, useCallback, useRef } from 'react';
import { EpisodePlan, ScriptScene, YouTubeSEO } from '@/lib/types';

// ── Props ────────────────────────────────────────────────────────────────────

interface YouTubeSEOPanelProps {
  episodePlan: EpisodePlan | null;
  finalizedScenes: ScriptScene[];
  onBack?: () => void;
  onError?: (message: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({
  text,
  label,
  className = '',
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
      style={{
        backgroundColor: copied
          ? 'rgba(16,185,129,0.2)'
          : 'rgba(255,255,255,0.08)',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)'}`,
        color: copied ? '#6ee7b7' : 'var(--text-secondary)',
      }}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 11V3a1.5 1.5 0 0 1 1.5-1.5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {copied ? '복사됨' : '복사'}
    </button>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
  copyText,
  copyLabel,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  copyText?: string;
  copyLabel?: string;
}) {
  return (
    <section
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-bold flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <span aria-hidden="true">{icon}</span>
          {title}
        </h3>
        {copyText && copyLabel && (
          <CopyButton text={copyText} label={copyLabel} />
        )}
      </div>
      {children}
    </section>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function YouTubeSEOPanel({
  episodePlan,
  finalizedScenes,
  onBack,
  onError,
}: YouTubeSEOPanelProps) {
  const [seoData, setSeoData] = useState<YouTubeSEO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    if (!episodePlan || finalizedScenes.length === 0) {
      onError?.('에피소드 기획서와 대본이 필요합니다.');
      return;
    }

    setIsLoading(true);
    setSeoData(null);

    try {
      const apiKey = localStorage.getItem('gemini_api_key') ?? undefined;

      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          plan: episodePlan,
          scenes: finalizedScenes,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: '서버 오류' }));
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data: YouTubeSEO = await res.json();
      setSeoData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SEO 생성 중 오류가 발생했습니다.';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  }, [episodePlan, finalizedScenes, onError]);

  const canGenerate = Boolean(episodePlan) && finalizedScenes.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Live region for screen readers */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isLoading
          ? 'SEO 데이터를 생성하고 있습니다.'
          : seoData
            ? 'SEO 데이터 생성이 완료되었습니다.'
            : ''}
      </div>

      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            YouTube SEO
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            완성된 에피소드의 YouTube 최적화 데이터를 생성합니다
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M8.5 2.5L4 7L8.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              이전 단계
            </button>
          )}
        </div>
      </header>

      {/* Generate button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isLoading}
          className="flex items-center gap-2 text-sm font-bold px-8 py-3 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            backgroundColor: canGenerate && !isLoading
              ? 'var(--accent)'
              : 'rgba(255,255,255,0.08)',
            color: canGenerate && !isLoading
              ? 'white'
              : 'var(--text-secondary)',
            opacity: !canGenerate ? 0.5 : 1,
            cursor: !canGenerate || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? (
            <>
              <SpinnerIcon size={16} />
              SEO 생성 중...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              SEO 생성
            </>
          )}
        </button>
      </div>

      {!canGenerate && !seoData && (
        <p
          className="text-center text-sm"
          style={{ color: 'var(--text-secondary)', opacity: 0.7 }}
        >
          에피소드 기획서와 대본을 먼저 완성해주세요.
        </p>
      )}

      {/* Results */}
      {seoData && (
        <div className="flex flex-col gap-4">

          {/* Titles */}
          <Section icon="🏷" title="제목 후보">
            <ol className="flex flex-col gap-2 list-none p-0 m-0">
              {seoData.titles.map((title, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="shrink-0 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(233,69,96,0.2)',
                        color: 'var(--accent)',
                      }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {title}
                    </span>
                  </span>
                  <CopyButton text={title} label={`제목 ${i + 1} 복사`} />
                </li>
              ))}
            </ol>
          </Section>

          {/* Hook line */}
          <Section
            icon="🎣"
            title="훅 멘트"
            copyText={seoData.hookLine}
            copyLabel="훅 멘트 복사"
          >
            <p
              className="text-base font-bold"
              style={{ color: 'var(--accent)' }}
            >
              {seoData.hookLine}
            </p>
          </Section>

          {/* Description */}
          <Section
            icon="📝"
            title="설명"
            copyText={seoData.description}
            copyLabel="설명 전체 복사"
          >
            <pre
              className="text-sm whitespace-pre-wrap break-words leading-relaxed"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            >
              {seoData.description}
            </pre>
          </Section>

          {/* Tags */}
          <Section
            icon="🔖"
            title="태그"
            copyText={seoData.tags.join(', ')}
            copyLabel="태그 전체 복사"
          >
            <div className="flex flex-wrap gap-1.5" role="list" aria-label="태그 목록">
              {seoData.tags.map((tag, i) => (
                <span
                  key={i}
                  role="listitem"
                  className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full cursor-default"
                  style={{
                    backgroundColor: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.25)',
                    color: '#93c5fd',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </Section>

          {/* Thumbnail texts */}
          <Section icon="🖼" title="썸네일 텍스트">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {seoData.thumbnailTexts.map((text, i) => (
                <div
                  key={i}
                  className="relative flex flex-col items-center justify-center rounded-xl p-5 min-h-[100px]"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '2px solid rgba(233,69,96,0.3)',
                  }}
                >
                  <span
                    className="absolute top-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(233,69,96,0.25)',
                      color: 'var(--accent)',
                    }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <p
                    className="text-center text-base font-black leading-snug"
                    style={{
                      color: 'white',
                      textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                    }}
                  >
                    {text}
                  </p>
                  <div className="mt-2">
                    <CopyButton text={text} label={`썸네일 텍스트 ${i + 1} 복사`} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Hashtags */}
          <Section
            icon="#"
            title="해시태그"
            copyText={seoData.hashtags.join(' ')}
            copyLabel="해시태그 전체 복사"
          >
            <div className="flex flex-wrap gap-2" role="list" aria-label="해시태그 목록">
              {seoData.hashtags.map((hashtag, i) => (
                <span
                  key={i}
                  role="listitem"
                  className="inline-flex items-center text-sm font-bold px-3 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(168,85,247,0.12)',
                    border: '1px solid rgba(168,85,247,0.25)',
                    color: '#d8b4fe',
                  }}
                >
                  {hashtag}
                </span>
              ))}
            </div>
          </Section>

          {/* Category */}
          <Section icon="📂" title="카테고리">
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {seoData.category}
            </p>
          </Section>

        </div>
      )}
    </div>
  );
}
