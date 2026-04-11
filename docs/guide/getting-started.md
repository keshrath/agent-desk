# Introduction

Agent Desk is a desktop application built with Electron that serves as a unified control center for AI coding agents. It combines a powerful terminal emulator, agent monitoring, task management, and multi-agent orchestration into a single window.

![Agent Desk Overview](/screenshots/overview.png)

## What is Agent Desk?

If you work with AI coding agents like Claude Code, you know the pain of managing multiple terminal windows, tracking what each agent is doing, and coordinating parallel work. Agent Desk solves this by giving you:

- **A tabbed, grid-based terminal** with splits, drag-drop, and pop-out support
- **Automatic agent detection** that recognizes when a terminal is running an AI agent and tracks its status, tool calls, file modifications, and costs
- **Batch launch** to spin up multiple agents at once with naming patterns, templates, and stagger delays
- **Cross-terminal search** that searches all terminal buffers simultaneously
- **Integrated dashboards** for agent-comm, agent-tasks, and agent-knowledge services
- **An agent monitor view** with live cards showing every running agent at a glance
- **Workspaces** to save and restore your entire terminal layout
- **8 built-in themes** plus a custom theme editor

## Who is it for?

Agent Desk is designed for developers who:

- Run multiple AI coding agents in parallel
- Need visibility into what agents are doing across terminals
- Want to coordinate multi-agent workflows (code review teams, parallel tasks, build pipelines)
- Prefer a dedicated terminal app with agent-aware features over generic terminal emulators

## Key Concepts

### Terminals and Profiles

Every terminal in Agent Desk is created from a **profile**. Profiles define the shell or command to run, working directory, and icon. Three built-in profiles are included:

- **Default Shell** -- your system shell (PowerShell, bash, zsh)
- **Claude** -- launches `claude` (Claude Code CLI)
- **OpenCode** -- launches `opencode`

You can create custom profiles for any command or agent.

### Agent Detection

When a terminal is running an AI agent, Agent Desk automatically detects it and begins tracking:

- **Status** -- whether the agent is idle, thinking, or executing tools
- **Tool calls** -- every tool invocation with name, arguments, and timing
- **File modifications** -- files the agent creates or edits
- **Cost and tokens** -- running totals of API usage

This happens transparently by parsing terminal output -- no agent modifications needed.

### Views

Agent Desk has six main views, accessible from the sidebar or keyboard shortcuts:

| View | Shortcut | Description |
|------|----------|-------------|
| Terminals | <kbd>Ctrl+1</kbd> | Terminal grid with tabs |
| Agent Comm | <kbd>Ctrl+2</kbd> | Agent communication dashboard |
| Agent Tasks | <kbd>Ctrl+3</kbd> | Task pipeline dashboard |
| Agent Knowledge | <kbd>Ctrl+4</kbd> | Knowledge base dashboard |
| Agent Discover | <kbd>Ctrl+5</kbd> | MCP server registry / marketplace |
| Event Stream | <kbd>Ctrl+6</kbd> | Filterable event timeline |
| Settings | <kbd>Ctrl+7</kbd> | App configuration |

### Event Stream

The event stream (<kbd>Ctrl+6</kbd> or <kbd>Ctrl+E</kbd>) is a real-time timeline of everything happening across all terminals -- agent tool calls, file modifications, terminal lifecycle events, errors, and more. It supports filtering by category and full-text search.

## Next Steps

- [Install Agent Desk](/guide/installation) on your system
- Follow the [Quick Start](/guide/quick-start) to launch your first agents
- Explore [Terminals](/guide/terminals) and [Workspaces](/guide/workspaces) in depth
