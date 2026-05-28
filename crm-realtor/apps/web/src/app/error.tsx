'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Root-level error boundary. Catches errors that bubble out of /login or the
 * very root layout. Stripped to bare minimum because the shell may have failed
 * to render — don't depend on theme provider, next-intl, or anything else.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0a0a0a',
          color: '#e4e4e7',
          padding: '1rem',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#27272a',
              color: '#fbbf24',
              marginBottom: 16,
            }}
          >
            <AlertTriangle width={28} height={28} strokeWidth={1.75} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#a1a1aa', margin: '0 0 20px' }}>
            An unexpected error occurred. Try refreshing the page.
            {error.digest ? (
              <>
                <br />
                <code
                  style={{
                    fontSize: 12,
                    background: '#18181b',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {error.digest}
                </code>
              </>
            ) : null}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
