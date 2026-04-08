# @agent-desk/pwa

Progressive Web App entry for **Agent Desk**. This package is the mobile-first,
read-only counterpart to the Electron desktop build: it's a thin shell around
`@agent-desk/ui` that talks to `@agent-desk/server` over WebSocket.

v1 is intentionally **read-only** — write attempts in the UI surface a
"read-only on PWA" toast. The goal is monitoring agents, tasks, and knowledge
from your phone.

## Layout

```
packages/pwa/
  public/
    manifest.webmanifest   # installable PWA manifest
    service-worker.ts      # offline shell + network-first API cache
  src/
    main.ts                # entry: SW registration + UI boot
    mobile.css             # touch-friendly overrides (44px tabs, bottom nav)
  tsconfig.json
  package.json             # uses Vite
```

## Build

```bash
npm install                # from repo root (workspaces)
npm run build -w @agent-desk/pwa
```

Output lands in `packages/pwa/dist/` and is served by `@agent-desk/server`
under its static root.

## Install on your phone

1. Start the server (Phase E) — it prints a URL like
   `https://<lan-ip>:PORT/?t=<TOKEN>` at startup.
2. Open that URL in Safari (iOS) or Chrome (Android) on your phone.
3. Use **Share → Add to Home Screen** (iOS) or **⋮ → Install app** (Android).
4. Launch from the home screen. The token is stored per-origin; clearing site
   data requires re-pasting the token URL.

## Notes

- The global `window.__AGENT_DESK_READ_ONLY__ = true` flag is set before the
  UI module graph evaluates, so the UI can gate write paths from first render.
- Icons at `/icons/192.png` and `/icons/512.png` are placeholders — the real
  assets are served by `@agent-desk/server`.
- The service worker never caches `/ws` (WebSocket upgrades) and is
  network-first for `/api/*`, cache-first for static assets.
