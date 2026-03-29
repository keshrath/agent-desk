# Agent Monitor

The Agent Monitor is a dedicated view that shows all detected AI agents at a glance. It provides a card-based dashboard with live status updates, task assignments, tool call history, and quick actions.

![Agent Monitor](/screenshots/agent-monitor.png)

## Opening the Monitor

- Press <kbd>Ctrl+5</kbd>
- Or click the monitor icon in the sidebar

## How Agents are Detected

Agent Desk automatically detects AI agents by parsing terminal output. When a terminal runs a known agent command (like `claude`), the parser watches for patterns that indicate:

- **Agent name** -- extracted from the session output
- **Status** -- idle, thinking, executing tools, or waiting for input
- **Tool calls** -- each tool invocation with name and arguments
- **File modifications** -- files the agent creates, edits, or deletes
- **Test results** -- pass/fail outcomes from test runs
- **Errors** -- error messages and stack traces
- **Cost and tokens** -- API usage metrics from agent output

No agent modifications are required -- detection works by analyzing the terminal's text output.

## Agent Cards

Each detected agent gets a card in the monitor view showing:

- **Name** -- the agent's self-reported name or assigned terminal title
- **Status indicator** -- color-coded dot showing current state
- **Terminal link** -- click to jump directly to that agent's terminal
- **Task assignment** -- if the agent has a task in the pipeline (via agent-tasks), it's shown on the card
- **Activity summary** -- recent tool calls, file changes, and events
- **Cost tracking** -- running total of tokens and estimated cost

Cards refresh every 2 seconds to show live status, and task data is polled every 10 seconds from the agent-tasks API.

## Status Colors

| Status | Color | Meaning |
|--------|-------|---------|
| Running | Green | Agent is actively executing |
| Thinking | Blue/accent | Agent is processing (LLM call in progress) |
| Idle | Gray | Agent is waiting for input |
| Exited | Red | Agent process has terminated |

## Task Integration

If the [agent-tasks](/guide/dashboards) service is running, the monitor enriches each agent card with:

- The **task title** currently assigned to that agent
- The **pipeline stage** (backlog, spec, plan, implement, test, review, done)
- A link to the task in the Tasks dashboard

Task matching works by comparing the agent's registered name to the `assigned_to` field on tasks.

## Quick Actions

From each agent card, you can:

- **Jump to terminal** -- click the card to switch to the Terminals view and focus that agent's terminal
- **View details** -- expand the card to see full tool call history and file modification log

## Refresh Behavior

The monitor uses two polling intervals:

- **Agent status**: refreshed every 2 seconds from the in-memory terminal state
- **Task data**: polled every 10 seconds from the agent-tasks HTTP API

Polling is only active while the monitor view is visible to avoid unnecessary resource usage.

## Related

- [Batch Launch](/guide/batch-launch) -- Launch multiple agents to populate the monitor
- [Event Stream](/guide/event-stream) -- Timeline view of all agent events
- [Cost Tracking](/guide/cost-tracking) -- Detailed cost and token metrics
- [Dashboard Services](/guide/dashboards) -- Set up agent-tasks for task integration
