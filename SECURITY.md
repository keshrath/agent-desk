# Security policy

## Supported versions

Active support is for the most recent minor release. Older 1.x versions
receive critical security fixes only when feasible.

| Version | Supported          |
| ------- | ------------------ |
| 1.4.x   | yes                |
| 1.3.x   | critical only      |
| < 1.3   | no                 |

## Reporting a vulnerability

Report security issues privately by email to **security@mukit.at** rather
than opening a public issue or pull request.

Please include:

- a clear description of the vulnerability
- steps to reproduce (sample code, configuration, environment versions)
- the affected component (`@agent-desk/desktop`, `@agent-desk/server`,
  `@agent-desk/core`, `@agent-desk/ui`, `@agent-desk/pwa`)
- your assessment of impact and severity
- any proposed mitigation if you have one

You can expect:

- acknowledgement within 3 working days
- a triage update within 7 working days
- a coordinated disclosure timeline if the report is accepted

## Threat model

agent-desk is a dual-target app — Electron desktop and Node web server +
PWA. The threat model differs by target.

### Desktop (`@agent-desk/desktop`)

- **Trust boundary**: the OS user. Anything the OS user can run,
  agent-desk can run.
- **Renderer isolation**: contextIsolation is enabled. The renderer cannot
  reach Node.js APIs except through the contextBridge in the preload.
- **IPC surface**: every channel goes through `createRouter()` from
  `@agent-desk/core`. There are no ad-hoc `ipcMain.handle` registrations
  outside the contract except for the documented Electron-only set
  (window controls, dialogs, popout, autoUpdater, shell, notification).
- **File writes**: the `file:write` channel rejects any path that wasn't
  approved through `dialog:saveFile` first. The approval is one-shot per
  path.
- **Plugin sandbox**: plugins load via the `plugin://` protocol handler
  inside shadow DOMs. The protocol handler refuses paths that escape the
  plugin's `dist/ui` directory.
- **Auto-updates**: signed by the maintainer's GitHub release credentials.
  electron-updater verifies the signature before installing.
- **Crash logs**: written to `~/.agent-desk/crash-logs/` as plain text.
  Treat them as user-readable; they contain stack traces and may include
  fragments of recently-edited config or terminal output.

### Web server (`@agent-desk/server`)

- **Default bind**: `127.0.0.1`. Not reachable from the network without
  an explicit `AGENT_DESK_BIND` override.
- **Authentication**: a single bearer token is required on the WS
  handshake (`?t=<token>`) and on every HTTP request to non-/healthz
  routes. The token is generated at startup unless `AGENT_DESK_TOKEN` is
  set.
- **Token transport**: the token rides on the URL query string. It is
  visible in browser history and reverse-proxy access logs by default.
  Configure your reverse proxy (e.g. Caddy) to scrub the `t` query
  parameter from access logs.
- **Rate limiting**: per-connection token bucket
  (`AGENT_DESK_RATE_LIMIT_RPS` / `AGENT_DESK_RATE_LIMIT_BURST`) and a
  hard pty cap per server (`AGENT_DESK_TERMINAL_CAP`). These protect
  against runaway clients but **not** against a malicious authenticated
  user — the token holder is fully trusted.
- **Read-only mode**: `--readonly` (or
  `AGENT_DESK_SERVER_READONLY=1`) blocks 17 mutating channels at the
  router. Use this for any deployment that hands the token to untrusted
  viewers.
- **TLS**: the server speaks plain HTTP. Always front it with a reverse
  proxy that terminates TLS (Caddy with auto Let's Encrypt is the
  recommended setup; see `docs/deployment.md`).
- **CORS / WS origin**: the WS upgrade rejects connections without a
  valid token but does **not** check `Origin`. The reverse proxy is your
  CSRF boundary.
- **Process privileges**: never run the server as root. The systemd unit
  in `docs/deployment.md` creates a dedicated `agent-desk` system user
  with `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`,
  `ProtectHome=true`, and a narrow `ReadWritePaths` allowlist.
- **Terminal exposure**: every authenticated client can spawn shell
  processes with the server user's privileges. Constrain the server
  user's filesystem and network reach via systemd or container limits.

### PWA (`@agent-desk/pwa`)

- **Read-only by default in v1**. The PWA sets
  `window.__AGENT_DESK_READ_ONLY__ = true` before importing the renderer,
  and the WS shim refuses to send any mutating channel even if the
  server permits it. v2 will allow opt-in writes.
- **Service worker**: caches the UI shell only. WebSocket and `/api/*`
  requests bypass the cache. The cache is invalidated on every release
  via the `CACHE_VERSION` constant.

## Hardening checklist for a production deployment

- [ ] Front the server with TLS (Caddy / nginx + certbot)
- [ ] Run the server as a dedicated non-root user
- [ ] Set a strong `AGENT_DESK_TOKEN` and rotate it on suspected compromise
- [ ] Enable `--readonly` if any token holder is not fully trusted
- [ ] Set `AGENT_DESK_TERMINAL_CAP` to a value matching your concurrency
- [ ] Scrub the `t` query parameter from reverse-proxy access logs
- [ ] Restrict the server's filesystem reach via systemd `ReadWritePaths`
      or a container mount allowlist
- [ ] Monitor `~/.agent-desk/crash-logs/` for unexpected entries
- [ ] Pin Node to the version in `.nvmrc` (currently 22) so native module
      ABIs stay consistent with the bundled `better-sqlite3`
- [ ] Subscribe to the GitHub Releases feed for security advisories

## Out of scope

- **Multi-user authentication / authorization**. v1.x is strictly single
  user. Multi-user is on the long-term roadmap (see recommendations
  R9 / R10 in the architecture audit). Until then, do not share a token
  with users you do not trust.
- **Sandboxing of agent-launched commands**. agent-desk spawns ptys with
  the server user's privileges. Sandboxing is the OS / container's job.
