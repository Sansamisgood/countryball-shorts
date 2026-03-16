'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Step, TopicCandidate, EpisodePlan, ScriptScene, YouTubeSEO, ProjectData } from '@/lib/types';
import StepIndicator from '@/components/StepIndicator';
import TopicDiscoveryPanel from '@/components/TopicDiscoveryPanel';
import PlanningCastingPanel from '@/components/PlanningCastingPanel';
import ScriptWritingPanel from '@/components/ScriptWritingPanel';
import StoryboardPanel from '@/components/StoryboardPanel';
import YouTubeSEOPanel from '@/components/YouTubeSEOPanel';
import SettingsPanel from '@/components/SettingsPanel';

// ─── Initial / reset values ──────────────────────────────────────────────────
const INITIAL_STEP = Step.TOPIC_DISCOVERY;

export default function HomePage() {
  // ── Core workflow state ────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<number>(INITIAL_STEP);
  const [selectedTopic, setSelectedTopic] = useState<TopicCandidate | null>(null);
  const [episodePlan, setEpisodePlan]     = useState<EpisodePlan | null>(null);
  const [finalizedScenes, setFinalizedScenes] = useState<ScriptScene[]>([]);
  const [seoData, setSeoData]            = useState<YouTubeSEO | null>(null);
  const [error, setError]                = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-open settings on first load if API key is missing
  useEffect(() => {
    const hasKey = Boolean(localStorage.getItem('gemini_api_key'));
    if (!hasKey) {
      setIsSettingsOpen(true);
    }
  }, []);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const goToStep = useCallback((step: number) => {
    setError(null);
    setCurrentStep(step);
  }, []);

  /** Allow clicking back to already-completed steps, or forward to SEO from storyboard */
  const handleStepClick = useCallback(
    (step: number) => {
      if (step < currentStep) {
        goToStep(step);
      } else if (
        step === Step.SEO &&
        currentStep === Step.STORYBOARD &&
        finalizedScenes.length > 0
      ) {
        goToStep(step);
      }
    },
    [currentStep, finalizedScenes.length, goToStep],
  );

  // ── Step-completion callbacks ──────────────────────────────────────────────
  const handleTopicSelected = useCallback((topic: TopicCandidate) => {
    setSelectedTopic(topic);
    setError(null);
    setCurrentStep(Step.PLANNING_CASTING);
  }, []);

  const handlePlanComplete = useCallback((plan: EpisodePlan) => {
    setEpisodePlan(plan);
    setError(null);
    setCurrentStep(Step.SCRIPT_WRITING);
  }, []);

  const handleScriptFinalized = useCallback((scenes: ScriptScene[]) => {
    setFinalizedScenes(scenes);
    setError(null);
    setCurrentStep(Step.STORYBOARD);
  }, []);

  // ── Full reset ─────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCurrentStep(INITIAL_STEP);
    setSelectedTopic(null);
    setEpisodePlan(null);
    setFinalizedScenes([]);
    setSeoData(null);
    setError(null);
  }, []);

  // ── Project load ───────────────────────────────────────────────────────────
  const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected later
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const saved = JSON.parse(ev.target?.result as string) as ProjectData;

        const restoredTopic  = saved.topic  ?? null;
        const restoredPlan   = saved.plan   ?? null;
        const restoredScenes = Array.isArray(saved.script) ? saved.script : [];

        setSelectedTopic(restoredTopic);
        setEpisodePlan(restoredPlan);
        setFinalizedScenes(restoredScenes);
        setError(null);

        // Jump to the furthest completed step
        if (restoredScenes.length > 0) {
          setCurrentStep(Step.STORYBOARD);
        } else if (restoredPlan) {
          setCurrentStep(Step.SCRIPT_WRITING);
        } else if (restoredTopic) {
          setCurrentStep(Step.PLANNING_CASTING);
        } else {
          setCurrentStep(Step.TOPIC_DISCOVERY);
        }
      } catch {
        setError('프로젝트 파일을 불러오는 데 실패했습니다. 올바른 JSON 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
  }, []);

  // ── Panel renderer ─────────────────────────────────────────────────────────
  const renderPanel = () => {
    switch (currentStep) {
      case Step.TOPIC_DISCOVERY:
        return (
          <TopicDiscoveryPanel
            onTopicSelected={handleTopicSelected}
            onError={setError}
          />
        );

      case Step.PLANNING_CASTING:
        return (
          <PlanningCastingPanel
            selectedTopic={selectedTopic}
            onPlanComplete={handlePlanComplete}
            onBack={() => goToStep(Step.TOPIC_DISCOVERY)}
            onError={setError}
          />
        );

      case Step.SCRIPT_WRITING:
        return (
          <ScriptWritingPanel
            selectedTopic={selectedTopic}
            episodePlan={episodePlan}
            onScriptFinalized={handleScriptFinalized}
            onBack={() => goToStep(Step.PLANNING_CASTING)}
            onError={setError}
          />
        );

      case Step.STORYBOARD:
        return (
          <StoryboardPanel
            selectedTopic={selectedTopic}
            episodePlan={episodePlan}
            finalizedScenes={finalizedScenes}
            onBack={() => goToStep(Step.SCRIPT_WRITING)}
            onError={setError}
          />
        );

      case Step.SEO:
        return (
          <YouTubeSEOPanel
            episodePlan={episodePlan}
            finalizedScenes={finalizedScenes}
            onBack={() => goToStep(Step.STORYBOARD)}
            onError={setError}
          />
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="gradient-bg min-h-screen flex flex-col">

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div
          className="w-full px-4 py-3 flex items-center justify-between gap-4 text-sm font-medium"
          style={{
            backgroundColor: 'rgba(233,69,96,0.15)',
            borderBottom: '1px solid rgba(233,69,96,0.4)',
            color: 'var(--accent-hover)',
          }}
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11" r="0.75" fill="currentColor" />
            </svg>
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="오류 닫기"
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="w-full px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(233,69,96,0.15)' }}
      >
        {/* Left: title + subtitle */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <h1
              className="text-xl font-extrabold leading-tight tracking-tight"
              style={{
                background: 'linear-gradient(90deg, var(--accent) 0%, #ff8fa3 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              효주댁 컨트리볼 쇼츠 자동화 생성기
            </h1>
            {/* Version badge */}
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full leading-none"
              style={{
                backgroundColor: 'rgba(233,69,96,0.15)',
                border: '1px solid rgba(233,69,96,0.35)',
                color: 'var(--accent)',
              }}
            >
              v1.0
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            뉴스 기반 컨트리볼 쇼츠 자동 생성기
          </p>
        </div>

        {/* Right: settings + load + reset buttons */}
        <div className="flex items-center gap-2">

        {/* Hidden file input for project load */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleLoadProject}
        />

        {/* Load project button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="프로젝트 불러오기"
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'rgba(233,69,96,0.15)';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'rgba(233,69,96,0.4)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color =
              'var(--text-secondary)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path
              d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.5 2H12a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 13H3.5A1.5 1.5 0 0 1 2 11.5v-7z"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
            />
          </svg>
          프로젝트 불러오기
        </button>

        {/* Settings button */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="설정 열기"
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'rgba(233,69,96,0.15)';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'rgba(233,69,96,0.4)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color =
              'var(--text-secondary)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path
              d="M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M12.2 7.5a4.7 4.7 0 0 0-.04-.6l1.3-1a.5.5 0 0 0 .12-.65l-1.23-2.13a.5.5 0 0 0-.61-.22l-1.54.62a4.7 4.7 0 0 0-1.03-.6L8.9 1.36A.5.5 0 0 0 8.4 1H6.6a.5.5 0 0 0-.5.36l-.37 1.56a4.7 4.7 0 0 0-1.03.6l-1.54-.62a.5.5 0 0 0-.61.22L1.42 5.25a.5.5 0 0 0 .12.65l1.3 1A4.7 4.7 0 0 0 2.8 7.5a4.7 4.7 0 0 0 .04.6l-1.3 1a.5.5 0 0 0-.12.65l1.23 2.13c.13.22.39.3.61.22l1.54-.62c.32.22.66.41 1.03.6l.37 1.56c.09.21.28.36.5.36h1.8c.22 0 .41-.15.5-.36l.37-1.56c.37-.19.71-.38 1.03-.6l1.54.62c.22.08.48 0 .61-.22l1.23-2.13a.5.5 0 0 0-.12-.65l-1.3-1a4.7 4.7 0 0 0 .04-.6z"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
          설정
        </button>

        {/* Reset button */}
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'rgba(233,69,96,0.15)';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'rgba(233,69,96,0.4)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color =
              'var(--text-secondary)';
          }}
        >
          {/* Refresh icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1.5 7A5.5 5.5 0 0 1 12 4.5M12.5 7A5.5 5.5 0 0 1 2 9.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M10.5 2.5L12 4.5L14 3.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3.5 11.5L2 9.5L0 10.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          새로 시작
        </button>

        </div>{/* end button group */}
      </header>

      {/* ── Step indicator ──────────────────────────────────────────────────── */}
      <div
        className="w-full"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <StepIndicator
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        {renderPanel()}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        className="w-full text-center py-4 text-xs"
        style={{
          color: 'var(--text-secondary)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          opacity: 0.6,
        }}
      >
        효주댁 컨트리볼 쇼츠 자동화 생성기 v1.0 &mdash; AI 기반 쇼츠 자동 생성 도구
      </footer>

      {/* ── Settings modal ──────────────────────────────────────────────────── */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

    </div>
  );
}
