'use client';

import { Step } from '@/lib/types';

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const STEPS: { label: string; step: Step }[] = [
  { label: '소재 발굴',      step: Step.TOPIC_DISCOVERY  },
  { label: '기획 & 캐스팅', step: Step.PLANNING_CASTING },
  { label: '대본 작성',      step: Step.SCRIPT_WRITING   },
  { label: '스토리보드',     step: Step.STORYBOARD       },
  { label: 'YouTube SEO',   step: Step.SEO              },
];

export default function StepIndicator({
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="w-full px-4 py-6">
      <div className="relative flex items-center justify-between max-w-2xl mx-auto">

        {/* ── Connecting lines (drawn behind circles) ── */}
        <div
          className="absolute inset-0 flex items-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="w-full flex">
            {STEPS.slice(0, -1).map((_, i) => {
              const isCompleted = i < currentStep;
              return (
                <div key={i} className="flex-1 h-0.5 mx-1" style={{ marginLeft: i === 0 ? '1.25rem' : undefined, marginRight: '0' }}>
                  <div
                    className="h-full transition-colors duration-300"
                    style={{
                      backgroundColor: isCompleted
                        ? 'var(--accent)'
                        : 'rgba(255,255,255,0.15)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step circles + labels ── */}
        {STEPS.map(({ label, step }) => {
          const isCompleted = step < currentStep;
          const isCurrent   = step === currentStep;
          const isFuture    = step > currentStep;
          const isSeoFromStoryboard =
            step === Step.SEO && currentStep === Step.STORYBOARD;
          const isClickable = !!onStepClick && (isCompleted || isSeoFromStoryboard);

          return (
            <div
              key={step}
              className="relative z-10 flex flex-col items-center gap-2 select-none"
            >
              {/* Circle */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(step)}
                aria-label={label}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  backgroundColor: isCompleted
                    ? 'var(--accent)'
                    : isCurrent
                    ? 'var(--bg-secondary)'
                    : 'var(--bg-primary)',
                  borderColor: isCompleted || isCurrent
                    ? 'var(--accent)'
                    : 'rgba(255,255,255,0.2)',
                  cursor: isClickable ? 'pointer' : 'default',
                  boxShadow: isCurrent
                    ? '0 0 0 4px rgba(233,69,96,0.25)'
                    : 'none',
                }}
              >
                {isCompleted ? (
                  /* Checkmark */
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8.5L6.5 12L13 5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  /* Step number */
                  <span
                    className="text-sm font-bold leading-none"
                    style={{
                      color: isCurrent
                        ? 'var(--accent)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {step + 1}
                  </span>
                )}
              </button>

              {/* Label */}
              <span
                className="text-xs font-medium whitespace-nowrap transition-colors duration-300"
                style={{
                  color: isFuture
                    ? 'var(--text-secondary)'
                    : isCurrent
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
                  opacity: isFuture ? 0.5 : 1,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
