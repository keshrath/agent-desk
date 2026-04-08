# Deployment

agent-desk ships three deployable targets: the Electron desktop app, the Node web server, and the PWA (which is just the mobile entry served by the web server).

## Desktop

Packaged with `electron-builder` from `packages/desktop`.

### Build

```bash
npm run build              # compile all workspaces
npm run package --workspace @agent-desk/desktop
```

Artifacts land in `packages/desktop/dist/`.

### Targets

| OS      | Format             | Notes                                                   |
| ------- | ------------------ | ------------------------------------------------------- |
| Windows | NSIS installer     | signed with code-signing cert (env `CSC_LINK`)          |
| macOS   | dmg + zip          | notarized (env `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`) |
| Linux   | AppImage + deb     | AppImage preferred; deb for Debian/Ubuntu package repos |

Auto-update channel is wired through `electron-updater` against the GitHub Releases feed for the `keshrath/agent-desk` repo. Releases tagged `vX.Y.Z` trigger publish via GitHub Actions.

### First-run

- Creates `~/.agent-desk/` if missing.
- Detects installed MCP tools (Claude Code, Cursor, Codex CLI, Aider, Continue) and offers to auto-configure their MCP servers.
- Registers the tray icon and boot-at-login entry (if opted in).

## Web server

The `@agent-desk/server` package is a standalone Node process. It depends on `@agent-desk/core` (for all business logic) and serves the `@agent-desk/ui` static files.

### Run directly

```bash
npm run build
node packages/server/dist/index.js --bind 127.0.0.1 --port 8787
```

First start prints:

```
agent-desk server listening on http://127.0.0.1:8787
Open: http://127.0.0.1:8787/?t=<token>
```

The token is persisted to `~/.agent-desk/server-token`. Delete that file to rotate.

### Flags / env vars

| Flag / env var                  | Default     | Purpose                                                          |
| ------------------------------- | ----------- | ---------------------------------------------------------------- |
| `AGENT_DESK_BIND` / `--bind`    | `127.0.0.1` | Bind address. Non-loopback requires a token file.                |
| `AGENT_DESK_PORT` / `--port`    | `3420`      | HTTP port.                                                       |
| `AGENT_DESK_TOKEN`              | random hex  | Auth token. Override to make it stable across restarts.          |
| `AGENT_DESK_SERVER_READONLY=1` / `--readonly` | off | Refuse mutating channels (see threat model).         |
| `AGENT_DESK_RATE_LIMIT_RPS`     | `50`        | Per-connection token-bucket refill rate (msgs / second).         |
| `AGENT_DESK_RATE_LIMIT_BURST`   | `100`       | Per-connection token-bucket capacity (max burst size).           |
| `AGENT_DESK_TERMINAL_CAP`       | `64`        | Hard cap on concurrent ptys per process. `terminal:create` 429s. |
| `AGENT_DESK_VERSION`            | `0.0.0-server` | Version string surfaced via `/healthz` and crash logs.        |

### systemd unit

`/etc/systemd/system/agent-desk.service`:

```ini
[Unit]
Description=agent-desk server
After=network.target

[Service]
Type=simple
User=agent-desk
Group=agent-desk
WorkingDirectory=/opt/agent-desk
Environment=NODE_ENV=production
Environment=HOME=/var/lib/agent-desk
ExecStart=/usr/bin/node /opt/agent-desk/packages/server/dist/index.js --bind 127.0.0.1 --port 8787 --origin https://desk.example.com
Restart=on-failure
RestartSec=5
# hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/agent-desk
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Enable & start:

```bash
sudo useradd -r -m -d /var/lib/agent-desk agent-desk
sudo systemctl daemon-reload
sudo systemctl enable --now agent-desk
sudo journalctl -u agent-desk -f
```

Read the token once the service starts:

```bash
sudo cat /var/lib/agent-desk/.agent-desk/server-token
```

### Caddy reverse proxy

`/etc/caddy/Caddyfile`:

```caddy
desk.example.com {
    encode gzip zstd

    # forward WebSocket + HTTP to the local server
    reverse_proxy 127.0.0.1:8787 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }

    # security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
    }
}
```

Caddy auto-provisions TLS via Let's Encrypt on first request — no extra config needed beyond a public DNS record pointing at the host and ports 80/443 open.

```bash
sudo systemctl reload caddy
```

### TLS without Caddy (nginx + certbot)

If you prefer nginx:

```bash
sudo certbot certonly --nginx -d desk.example.com
```

Then add a standard `proxy_pass http://127.0.0.1:8787` location block with `Upgrade` / `Connection` headers set for the WS upgrade. Caddy is strongly recommended — it gets TLS right by default.

### Native module ABI

`@agent-desk/server` depends transitively on `better-sqlite3` (via the
`agent-comm`, `agent-tasks`, `agent-knowledge`, `agent-discover` SDKs) and
`node-pty`. Both are native modules and need to be built against the
**system Node** ABI when running the server (not against the Electron ABI).

After `npm install`:

```bash
npm run rebuild:server   # rebuilds better-sqlite3 + node-pty for system Node
```

If you also build the Electron desktop on the same machine, run
`npm run rebuild:desktop` before launching it (`electron-rebuild` builds the
modules against Electron's bundled Node version).

If the server logs `[agent-desk] comm context failed: NODE_MODULE_VERSION
mismatch`, the rebuild step was skipped. The server still boots and serves
the UI, but the comm/tasks/knowledge/discover bridges return empty results.

### Threat model

- **Default-bind `127.0.0.1`** — only the local user can hit the server. Safe
  for single-user dev.
- **Non-loopback bind** — anyone who reaches the port can use the API if they
  have the token. Always front with TLS (Caddy) and rotate the token if it
  leaks.
- **Token in URL** — the token rides on the WebSocket handshake's query string
  and on every HTTP request's `?t=` param. It's logged in browser history and
  reverse-proxy access logs by default. Configure Caddy / nginx to scrub the
  `t` query param from the access log if you care.
- **Terminal exposure** — every authenticated client can spawn shell processes
  with the server user's privileges. **Never run the server as root**. The
  systemd unit above creates a dedicated `agent-desk` user.
- **Rate limiting** — the per-connection token bucket and terminal cap protect
  against runaway clients but NOT against a malicious authenticated user. If
  you can't trust your token holders, disable mutating channels with
  `--readonly` and use the desktop app for write workflows.
- **CORS / WS origin** — the WS upgrade rejects connections without a valid
  token but does NOT check `Origin`. If you front with Caddy, the reverse
  proxy is your CSRF boundary; the server itself trusts every authenticated
  WS upgrade regardless of origin.

## PWA

The PWA is served by the web server at the same origin. No separate deployment.

### Install on a phone

1. Visit `https://desk.example.com/?t=<token>` in mobile Chrome or Safari.
2. Use the browser menu "Add to Home Screen" (iOS) or "Install app" (Android).
3. Launch from the home screen — the token is stored in `localStorage`, so subsequent launches skip the token prompt.

### v1 capabilities (read-only)

- View all terminals (replay buffers), live streaming of the focused terminal.
- Agent monitor, task pipeline, comm feed, knowledge search, discover registry.
- System stats.

Mutating channels (`terminal:write`, `terminal:create`, `file:write`, etc.) are refused by the server when `--readonly` is set. PWA v1 assumes readonly mode.

### v2 capabilities (planned)

- Full terminal driving from mobile with an on-screen keyboard.
- Requires the server to run without `--readonly` — only do this on trusted networks / behind TLS with a strong token.
