# Multi-Agent Orchestration

Agent Desk provides tools for launching, managing, and coordinating multiple AI agents working in parallel.

## Batch Launcher

Launch multiple agent terminals at once with:

- **Agent count** -- 1 to 20 agents
- **Profile selection** -- which agent profile to use
- **Naming pattern** -- `{n}` placeholder for sequential numbering
- **Working directory** -- override for all agents
- **Initial command** -- typed into each terminal after launch
- **Stagger delay** -- milliseconds between launches
- **Max concurrency** -- limit simultaneous launches
- **CPU-aware throttling** -- automatic delay when system load is high

## Templates

Saved multi-agent configurations with per-agent customization:

- **Per-agent profiles** -- different commands for each agent slot
- **Per-agent names** -- custom name for each agent
- **Per-agent initial input** -- different prompts for each agent
- **2 built-in templates** -- Quick Review (3 agents) and Parallel Tasks (5 agents)
- **Custom templates** -- create and save your own
- **Command palette integration** -- launch templates by name

## Terminal Chains

Chain terminals together so that one agent's completion triggers another:

- **Chain picker** -- select which terminal to chain to
- **Chain indicators** -- visual indication of chain relationships
- **Automatic triggering** -- next agent starts when previous completes

## Agent Monitor

A dedicated view for monitoring all running agents:

- **Card-based layout** -- one card per detected agent
- **Live status** -- 2-second refresh cycle
- **Task integration** -- shows assigned pipeline tasks
- **Terminal linking** -- click to jump to the agent's terminal
- **Activity summary** -- recent tool calls and file changes

## Communication Graph

Visual network graph of agent-to-agent communication:

- **Canvas rendering** -- smooth, animated graph
- **Node layout** -- agents as interactive nodes
- **Edge weighting** -- thicker edges for more communication
- **Hover interaction** -- highlight connections on hover

## Pipeline Integration

When agent-tasks is running, Agent Desk provides:

- **Task badges on tabs** -- show the task assigned to each agent
- **Task cards in monitor** -- task title and stage on agent cards
- **Pipeline visibility** -- see the full pipeline via the Tasks dashboard

For detailed guides, see:
- [Batch Launch & Templates](/guide/batch-launch)
- [Agent Monitor](/guide/agent-monitor)
- [Communication Graph](/guide/comm-graph)
