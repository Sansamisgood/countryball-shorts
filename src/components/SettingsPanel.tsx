'use client';

import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY_API = 'gemini_api_key';
const STORAGE_KEY_TTS = 'tts_enabled';
const STORAGE_KEY_TTS_ENGINE = 'ttsEngine';
const STORAGE_KEY_SUPERTONE_API = 'supertoneApiKey';

export type TtsEngine = 'edge' | 'gemini' | 'supertone';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [supertoneApiKey, setSupertoneApiKey] = useState('');
  const [showSupertoneKey, setShowSupertoneKey] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>('edge');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supertoneInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load saved values on open
  useEffect(() => {
    if (!isOpen) return;
    const storedKey = localStorage.getItem(STORAGE_KEY_API) ?? '';
    const storedTts = localStorage.getItem(STORAGE_KEY_TTS) === 'true';
    const storedEngine = (localStorage.getItem(STORAGE_KEY_TTS_ENGINE) ?? 'edge') as TtsEngine;
    const storedSupertoneKey = localStorage.getItem(STORAGE_KEY_SUPERTONE_API) ?? '';
    setApiKey(storedKey);
    setTtsEnabled(storedTts);
    setTtsEngine(storedEngine);
    setSupertoneApiKey(storedSupertoneKey);
    setSaved(false);
    setShowKey(false);
    setShowSupertoneKey(false);
    // Focus the input after the modal is rendered
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  function handleSave() {
    localStorage.setItem(STORAGE_KEY_API, apiKey.trim());
    localStorage.setItem(STORAGE_KEY_TTS, String(ttsEnabled));
    localStorage.setItem(STORAGE_KEY_TTS_ENGINE, ttsEngine);
    localStorage.setItem(STORAGE_KEY_SUPERTONE_API, supertoneApiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearKey() {
    setApiKey('');
  }

  function handleClearSupertoneKey() {
    setSupertoneApiKey('');
  }

  const hasStoredKey = typeof window !== 'undefined'
    ? Boolean(localStorage.getItem(STORAGE_KEY_API))
    : false;

  const currentKeyIsSet = apiKey.trim().length > 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={modalRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="w-full max-w-md rounded-2xl flex flex-col gap-6 p-6 shadow-2xl"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(233,69,96,0.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2
              id="settings-title"
              className="text-lg font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              설정
            </h2>
            <button
              type="button"
              aria-label="설정 닫기"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
              style={{
                background: 'rgba(255,255,255,0.07)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* API Key Section */}
          <section aria-labelledby="api-key-section-title">
            <div className="flex items-center justify-between mb-2">
              <label
                id="api-key-section-title"
                htmlFor="gemini-api-key"
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Gemini API 키
              </label>
              {/* Status badge */}
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={
                  currentKeyIsSet
                    ? {
                        background: 'rgba(34,197,94,0.15)',
                        border: '1px solid rgba(34,197,94,0.35)',
                        color: '#86efac',
                      }
                    : {
                        background: 'rgba(233,69,96,0.15)',
                        border: '1px solid rgba(233,69,96,0.35)',
                        color: 'var(--accent)',
                      }
                }
              >
                {currentKeyIsSet ? '설정됨' : '미설정'}
              </span>
            </div>

            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Gemini API를 사용하려면 API 키가 필요합니다.{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
                style={{ color: 'var(--accent)' }}
              >
                API 키 발급받기
              </a>
            </p>

            {/* Input with show/hide toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  id="gemini-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all pr-10"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(233,69,96,0.5)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  }}
                />
                {/* Show/hide toggle */}
                <button
                  type="button"
                  aria-label={showKey ? 'API 키 숨기기' : 'API 키 보이기'}
                  onClick={() => setShowKey((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                  style={{ color: 'var(--text-secondary)' }}
                  tabIndex={0}
                >
                  {showKey ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                  )}
                </button>
              </div>
              {apiKey && (
                <button
                  type="button"
                  aria-label="API 키 지우기"
                  onClick={handleClearKey}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  지우기
                </button>
              )}
            </div>
          </section>

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)' }} />

          {/* TTS Section */}
          <section aria-labelledby="tts-section-title">
            <div className="flex items-center justify-between">
              <div>
                <p
                  id="tts-section-title"
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  TTS 활성화
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  대사를 자동으로 음성으로 변환합니다
                </p>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={ttsEnabled}
                aria-labelledby="tts-section-title"
                onClick={() => setTtsEnabled((p) => !p)}
                className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
                style={{
                  background: ttsEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: ttsEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {/* TTS Engine Selector */}
            {ttsEnabled && (
              <div className="mt-4">
                <p
                  id="tts-engine-label"
                  className="text-xs font-semibold mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  TTS 엔진 선택
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="tts-engine-label"
                  className="flex gap-2 flex-wrap"
                >
                  {/* Edge TTS 옵션 */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ttsEngine === 'edge'}
                    onClick={() => setTtsEngine('edge')}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all duration-150 text-left"
                    style={{
                      background: ttsEngine === 'edge'
                        ? 'rgba(233,69,96,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: ttsEngine === 'edge'
                        ? '1px solid rgba(233,69,96,0.4)'
                        : '1px solid rgba(255,255,255,0.09)',
                      color: ttsEngine === 'edge' ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <span className="block font-semibold mb-0.5">Edge TTS</span>
                    <span className="block opacity-70">무료 · 기본</span>
                  </button>

                  {/* Gemini TTS 옵션 */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ttsEngine === 'gemini'}
                    onClick={() => setTtsEngine('gemini')}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all duration-150 text-left"
                    style={{
                      background: ttsEngine === 'gemini'
                        ? 'rgba(233,69,96,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: ttsEngine === 'gemini'
                        ? '1px solid rgba(233,69,96,0.4)'
                        : '1px solid rgba(255,255,255,0.09)',
                      color: ttsEngine === 'gemini' ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <span className="block font-semibold mb-0.5">Gemini TTS</span>
                    <span className="block opacity-70">고품질 · Gemini 키</span>
                  </button>

                  {/* Supertone TTS 옵션 */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ttsEngine === 'supertone'}
                    onClick={() => setTtsEngine('supertone')}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all duration-150 text-left"
                    style={{
                      background: ttsEngine === 'supertone'
                        ? 'rgba(233,69,96,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: ttsEngine === 'supertone'
                        ? '1px solid rgba(233,69,96,0.4)'
                        : '1px solid rgba(255,255,255,0.09)',
                      color: ttsEngine === 'supertone' ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <span className="block font-semibold mb-0.5">Supertone</span>
                    <span className="block opacity-70">최고품질 · 별도 키</span>
                  </button>
                </div>

                {/* Gemini API 키 경고 */}
                {ttsEngine === 'gemini' && !apiKey.trim() && (
                  <p
                    className="text-xs mt-2"
                    style={{ color: 'var(--accent)' }}
                    role="alert"
                    aria-live="polite"
                  >
                    Gemini TTS를 사용하려면 위에서 API 키를 입력하세요.
                  </p>
                )}

                {/* Supertone API 키 입력 */}
                {ttsEngine === 'supertone' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="supertone-api-key"
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Supertone API 키
                      </label>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={
                          supertoneApiKey.trim().length > 0
                            ? {
                                background: 'rgba(34,197,94,0.15)',
                                border: '1px solid rgba(34,197,94,0.35)',
                                color: '#86efac',
                              }
                            : {
                                background: 'rgba(233,69,96,0.15)',
                                border: '1px solid rgba(233,69,96,0.35)',
                                color: 'var(--accent)',
                              }
                        }
                      >
                        {supertoneApiKey.trim().length > 0 ? '설정됨' : '미설정'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          ref={supertoneInputRef}
                          id="supertone-api-key"
                          type={showSupertoneKey ? 'text' : 'password'}
                          value={supertoneApiKey}
                          onChange={(e) => setSupertoneApiKey(e.target.value)}
                          placeholder="supertone_..."
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all pr-10"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'var(--text-primary)',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(233,69,96,0.5)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                          }}
                        />
                        <button
                          type="button"
                          aria-label={showSupertoneKey ? 'Supertone API 키 숨기기' : 'Supertone API 키 보이기'}
                          onClick={() => setShowSupertoneKey((p) => !p)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                          style={{ color: 'var(--text-secondary)' }}
                          tabIndex={0}
                        >
                          {showSupertoneKey ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                              <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
                              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {supertoneApiKey && (
                        <button
                          type="button"
                          aria-label="Supertone API 키 지우기"
                          onClick={handleClearSupertoneKey}
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          지우기
                        </button>
                      )}
                    </div>
                    {!supertoneApiKey.trim() && (
                      <p
                        className="text-xs mt-1.5"
                        style={{ color: 'var(--accent)' }}
                        role="alert"
                        aria-live="polite"
                      >
                        Supertone TTS를 사용하려면 API 키를 입력하세요.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: saved
                ? 'rgba(34,197,94,0.2)'
                : 'var(--accent)',
              color: 'white',
              border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none',
            }}
          >
            {saved ? '저장됨' : '저장'}
          </button>
        </div>
      </div>
    </>
  );
}
