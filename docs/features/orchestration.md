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

## Agent Detection Surfaces

Detected agents appear on several surfaces (the standalone Agent Monitor view was removed in v1.6.0):

- **Terminal tab indicators** -- agent name, live status, attention pulse
- **Agent Comm dashboard** (Ctrl+2) -- cross-session roster + activity feed
- **Status bar** -- per-terminal token/cost readout
- **Batch launcher** -- names spawned agents `agent-{n}` and tracks their lifecycle

## Communication Graph

Visual network graph of agent-to-agent communication:

- **Canvas rendering** -- smooth, animated graph
- **Node layout** -- agents as interactive nodes
- **Edge weighting** -- thicker edges for more communication
- **Hover interaction** -- highlight connections on hover

## Pipeline Integration

When agent-tasks is running, Agent Desk provides:

- **Task badges on tabs** -- show the task assigned to each agent
- **Pipeline visibility** -- see the full pipeline via the Agent Tasks dashboard (Ctrl+3)

For detailed guides, see:
- [Batch Launch & Templates](/guide/batch-launch)
- [Agent Comm](/guide/dashboards)
- [Communication Graph](/guide/comm-graph)
