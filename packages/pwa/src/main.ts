// Agent Desk PWA entry.
//
// Responsibilities:
//  1. Flip the global read-only flag BEFORE importing the UI so that the UI
//     boot code can gate write-capable controls from the very first render.
//  2. Register the service worker for offline shell + background updates.
//  3. Hand off to the shared @agent-desk/ui web entry.

import './mobile.css';

declare global {
  interface Window {
    __AGENT_DESK_READ_ONLY__?: boolean;
  }
}

// Must be set before the UI module graph evaluates.
window.__AGENT_DESK_READ_ONLY__ = true;

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  } catch (err) {
    // Non-fatal: PWA still works online without SW.
    console.warn('[pwa] service worker registration failed', err);
  }
}

async function boot(): Promise<void> {
  await registerServiceWorker();
  // The UI package (populated in Phase D) exposes a web entry that wires up
  // the WebSocket transport against the @agent-desk/core channel contract.
  // Until Phase D lands this import will resolve to the placeholder web.html
  // shim — the real JS entry will replace it.
  // @ts-expect-error — module is provided by @agent-desk/ui at build time.
  await import('@agent-desk/ui/web');
}

void boot();
