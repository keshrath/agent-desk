# Cost Tracking

Agent Desk tracks API token usage and estimated costs for each agent terminal. This helps you monitor spending when running multiple AI agents in parallel.

## Status Bar Widget

The cost tracking widget appears in the status bar at the bottom of the app. It shows:

- **Total tokens** -- combined token count across all active agent terminals
- **Estimated cost** -- running cost estimate based on token usage

The widget updates in real-time as agents make API calls.

## Per-Agent Costs

Each agent terminal maintains its own cost counters. You can see per-agent costs in:

- **Agent Monitor cards** -- each card shows the agent's individual token count and cost
- **Terminal status** -- agent-detected terminals display cost info in their status area

## How Costs are Tracked

Cost data is extracted from agent terminal output by the agent parser. When an agent reports token usage or cost information in its output, Agent Desk captures and aggregates it.

The tracking works automatically with agents that report their API usage, such as Claude Code which displays token counts in its output.

## System Resource Monitoring

In addition to API costs, the status bar shows system resource usage:

| Metric | Description | Color Coding |
|--------|-------------|--------------|
| CPU | Current CPU utilization | Green < 60%, Yellow 60-85%, Red > 85% |
| RAM | Memory usage percentage | Green < 60%, Yellow 60-85%, Red > 85% |
| Disk | Disk usage percentage | Green < 60%, Yellow 60-85%, Red > 85% |

System stats are polled periodically from the main process and displayed in the status bar.

::: tip
When running many agents in parallel, keep an eye on the CPU and RAM indicators. High resource usage can slow down agent performance. Consider using stagger delays in the [Batch Launcher](/guide/batch-launch) to avoid overwhelming your system.
:::

## Cost Warnings

Agent Desk can display notifications when cost thresholds are reached, helping you stay aware of spending during long agent sessions.

## Related

- [Agent Monitor](/guide/agent-monitor) -- Per-agent cost display
- [Event Stream](/guide/event-stream) -- Track agent activity
- [Batch Launch](/guide/batch-launch) -- Resource-aware agent launching
