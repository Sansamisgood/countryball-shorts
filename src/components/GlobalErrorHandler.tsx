'use client';

import { useEffect } from 'react';

/**
 * Catches unhandled errors and promise rejections at the window level.
 * Specifically handles chunk load failures by auto-reloading.
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    let reloadScheduled = false;

    function isChunkLoadError(error: unknown): boolean {
      if (!(error instanceof Error)) return false;
      const msg = error.message || '';
      return (
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading CSS chunk') ||
        (error.name === 'ChunkLoadError')
      );
    }

    function handleChunkError() {
      if (reloadScheduled) return;
      reloadScheduled = true;
      // Auto-reload after a brief delay for chunk load errors
      console.warn('[GlobalErrorHandler] Chunk load error detected, reloading...');
      setTimeout(() => window.location.reload(), 500);
    }

    function onError(event: ErrorEvent) {
      if (isChunkLoadError(event.error)) {
        event.preventDefault();
        handleChunkError();
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        handleChunkError();
      }
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
