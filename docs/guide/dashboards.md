# Dashboard Services

Agent Desk embeds three web-based dashboards as views, providing direct access to the agent coordination services without leaving the app.

## Overview

| Dashboard | Default URL | View | Shortcut |
|-----------|-------------|------|----------|
| Agent Comm | `http://localhost:3421` | Comm | <kbd>Ctrl+2</kbd> |
| Agent Tasks | `http://localhost:3422` | Tasks | <kbd>Ctrl+3</kbd> |
| Agent Knowledge | `http://localhost:3423` | Knowledge | <kbd>Ctrl+4</kbd> |

Each dashboard is loaded in an Electron webview with bidirectional state sync -- the app can send theme updates to the dashboard, and the dashboard can communicate back.

## Agent Comm Dashboard

The Agent Comm dashboard shows:

- **Online agents** -- all registered agents with name, status, and heartbeat
- **Channels** -- message channels for team coordination
- **Messages** -- direct messages and broadcast history
- **Shared state** -- locks, progress tracking, and configuration

This is the communication hub for multi-agent workflows. Agents register here when they start, post status updates, and coordinate through channels.

## Agent Tasks Dashboard

The Agent Tasks dashboard provides a visual pipeline for task management:

- **Pipeline view** -- tasks flowing through stages (backlog, spec, plan, implement, test, review, done)
- **Task cards** -- with title, assignee, priority, and artifacts
- **Dependency tracking** -- visual dependency graph between tasks
- **Progress monitoring** -- see what each agent is working on

Tasks created here appear on agent cards in the [Agent Monitor](/guide/agent-monitor).

## Agent Knowledge Dashboard

The Agent Knowledge dashboard is a searchable knowledge base:

- **Entries** -- organized by category (projects, decisions, workflows, notes)
- **Search** -- hybrid semantic + TF-IDF search across all entries
- **Sessions** -- browse past session summaries and insights
- **Git sync** -- entries are version-controlled and synced across machines

## Configuration

Configure dashboard URLs in Settings (<kbd>Ctrl+6</kbd>) under the Dashboard URLs section:

| Setting | Default |
|---------|---------|
| Agent Comm URL | `http://localhost:3421` |
| Agent Tasks URL | `http://localhost:3422` |
| Agent Knowledge URL | `http://localhost:3423` |

Change these if your services run on different ports or remote hosts.

## Health Monitoring

Agent Desk continuously monitors dashboard service health. The sidebar icons show connection status:

- **Green dot** -- service is healthy and responding
- **Red dot** -- service is unreachable or returning errors
- **No dot** -- health check not yet completed

Health checks run periodically in the main process and results are broadcast to the renderer via IPC.

## Theme Sync

When you change the app theme, dashboard webviews are automatically updated to match. The dashboard injectors:

1. Detect the current theme's CSS custom properties
2. Inject them into the webview's document
3. The dashboard picks up the new colors and re-renders

This ensures a consistent visual experience across the app and all embedded dashboards.

## Dashboard Toolbars

Each dashboard view has an injected toolbar with quick actions specific to that service. The toolbar integrates with the dashboard's API to provide Agent Desk-native controls.

## Without Services

Agent Desk works perfectly without any dashboard services running. The Comm, Tasks, and Knowledge views will show a connection error state, but all terminal and agent monitoring features work independently.

## Related

- [Agent Monitor](/guide/agent-monitor) -- Uses agent-tasks API for task badges
- [Communication Graph](/guide/comm-graph) -- Visual graph of agent communication
- [Cost Tracking](/guide/cost-tracking) -- Token and cost metrics
