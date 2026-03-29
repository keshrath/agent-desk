# Installation

Agent Desk is available as pre-built binaries for Windows, macOS, and Linux, or you can build from source.

## Download

Download the latest release from [GitHub Releases](https://github.com/keshrath/agent-desk/releases).

| Platform | Format | File |
|----------|--------|------|
| Windows | Installer | `Agent-Desk-Setup-x.x.x.exe` |
| Windows | Portable | `Agent-Desk-x.x.x.exe` |
| macOS | DMG | `Agent-Desk-x.x.x.dmg` |
| Linux | AppImage | `Agent-Desk-x.x.x.AppImage` |
| Linux | Debian | `agent-desk_x.x.x_amd64.deb` |

## Windows

### Installer
1. Download the `.exe` installer
2. Run it and follow the setup wizard
3. Choose your installation directory (optional)
4. Agent Desk will appear in your Start menu

### Portable
1. Download the portable `.exe`
2. Place it anywhere on your system
3. Double-click to run -- no installation needed

## macOS

1. Download the `.dmg` file
2. Open it and drag Agent Desk to your Applications folder
3. On first launch, you may need to right-click and select "Open" to bypass Gatekeeper

## Linux

### AppImage
```bash
chmod +x Agent-Desk-*.AppImage
./Agent-Desk-*.AppImage
```

### Debian/Ubuntu
```bash
sudo dpkg -i agent-desk_*.deb
```

## Build from Source

If you want to run the latest development version or contribute:

### Prerequisites
- [Node.js](https://nodejs.org/) 22 or later
- npm (included with Node.js)
- Git

### Steps

```bash
git clone https://github.com/keshrath/agent-desk.git
cd agent-desk
npm install
npm run build
npm start
```

To package a distributable:

```bash
# Current platform
npm run package

# Specific platform
npm run package:win
npm run package:mac
npm run package:linux
```

The packaged output will be in the `release/` directory.

## Prerequisites for Agent Features

Agent Desk's agent monitoring features work with any terminal command, but to get the most out of it you'll want:

- **Claude Code** (`claude`) -- install via `npm install -g @anthropic-ai/claude-code`
- **agent-comm** -- agent communication server (optional, for the Comm dashboard)
- **agent-tasks** -- task pipeline server (optional, for the Tasks dashboard)
- **agent-knowledge** -- knowledge base server (optional, for the Knowledge dashboard)

These services are not required -- Agent Desk works perfectly as a standalone terminal with agent detection. The dashboards simply provide additional coordination features when the services are running.

## Auto-Updates

Agent Desk includes automatic update checking. When a new version is available, you'll see a notification in the app with the option to download and install it.

## Next Steps

- Follow the [Quick Start](/guide/quick-start) guide to set up your first workspace
