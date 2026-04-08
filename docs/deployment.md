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
Open: http://127.0.0.1:8787/#t=<token>
```

The token is persisted to `~/.agent-desk/server-token`. Delete that file to rotate.

### Flags

| Flag          | Default     | Purpose                                                         |
| ------------- | ----------- | --------------------------------------------------------------- |
| `--bind`      | `127.0.0.1` | Bind address. Non-loopback requires a token file.               |
| `--port`      | `8787`      | HTTP port.                                                      |
| `--readonly`  | off         | Refuse mutating channels (see threat model).                    |
| `--insecure`  | off         | Required to bind non-loopback without a reverse proxy / TLS.    |
| `--origin`    | —           | Public origin (e.g. `https://desk.example.com`) for CORS / WS.  |

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

## PWA

The PWA is served by the web server at the same origin. No separate deployment.

### Install on a phone

1. Visit `https://desk.example.com/#t=<token>` in mobile Chrome or Safari.
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
