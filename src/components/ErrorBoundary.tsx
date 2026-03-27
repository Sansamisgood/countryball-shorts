'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/**
 * React Error Boundary that catches rendering errors
 * and provides recovery options (retry / reload).
 *
 * Specifically detects chunk load failures (from Vercel redeployments)
 * and offers a page reload as the primary recovery.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const msg = error.message || '';
    const isChunkError =
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading CSS chunk') ||
      msg.includes("Cannot find module") ||
      (error.name === 'TypeError' && msg.includes('fetch'));

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
    console.error('[ErrorBoundary]', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { error, isChunkError } = this.state;

      return (
        <div
          role="alert"
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#fff',
            fontFamily: 'monospace',
          }}
        >
          <div
            style={{
              background: 'rgba(233,69,96,0.1)',
              border: '1px solid rgba(233,69,96,0.3)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '500px',
              margin: '0 auto',
            }}
          >
            <h2 style={{ color: '#e94560', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              {isChunkError ? '앱이 업데이트되었습니다' : '오류가 발생했습니다'}
            </h2>
            <p style={{ color: '#ccc', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {isChunkError
                ? '새 버전이 배포되었습니다. 페이지를 새로고침해주세요.'
                : error?.message || '알 수 없는 오류'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {!isChunkError && (
                <button
                  type="button"
                  onClick={this.handleRetry}
                  style={{
                    padding: '0.5rem 1.5rem',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  다시 시도
                </button>
              )}
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#e94560',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                }}
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
