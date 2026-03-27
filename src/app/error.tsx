'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1a1a2e',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'monospace',
      }}
    >
      <h1 style={{ color: '#e94560', fontSize: '1.5rem', marginBottom: '1rem' }}>
        오류 발생
      </h1>
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(233,69,96,0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '600px',
          width: '100%',
          wordBreak: 'break-all',
        }}
      >
        <p style={{ color: '#fda4af', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {error.name}: {error.message}
        </p>
        <pre
          style={{
            fontSize: '0.75rem',
            color: '#aaa',
            whiteSpace: 'pre-wrap',
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          {error.stack}
        </pre>
        {error.digest && (
          <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Digest: {error.digest}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: '1.5rem',
          padding: '0.75rem 2rem',
          background: '#e94560',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 'bold',
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
