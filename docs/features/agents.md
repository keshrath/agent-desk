# Agent Intelligence

Agent Desk automatically detects AI coding agents running in terminals and provides rich monitoring capabilities -- no agent modifications required.

## Automatic Detection

The agent parser watches terminal output for patterns that indicate an AI agent is running. Detection happens transparently for:

- **Claude Code** -- full parsing of tool calls, file modifications, test results, errors
- **Other agents** -- basic detection via output patterns

When an agent is detected, the terminal tab updates to show the agent's name and status.

## Status Tracking

Agent status is derived from output patterns:

| Status | Meaning |
|--------|---------|
| **Thinking** | Agent is processing (waiting for LLM response) |
| **Executing** | Agent is running a tool or command |
| **Idle** | Agent is waiting for user input |
| **Exited** | Agent process has terminated |

Status is shown as a color-coded dot on the terminal tab and in the Agent Comm dashboard.

## Tool Call Monitoring

Every tool invocation is captured and logged:

- **Tool name** -- which tool the agent called
- **Arguments** -- the parameters passed to the tool
- **Timing** -- when the tool was called
- **Result** -- success or failure indication

Tool calls appear in the [Event Stream](/guide/event-stream) and on [Agent Comm](/guide/dashboards) cards.

## File Modification Tracking

When an agent creates, edits, or deletes files, these operations are captured:

- **File path** -- which file was affected
- **Operation type** -- create, modify, or delete
- **Timing** -- when the modification occurred

This gives you a complete audit trail of what each agent changed during its session.

## Test Result Parsing

The parser detects test execution output and captures:

- Pass/fail counts
- Failure details
- Test suite identification

Test results appear as events in the Event Stream with warning severity.

## Error Detection

Errors in agent output are captured and surfaced:

- Error messages and stack traces
- Displayed with error severity in the Event Stream
- Desktop notifications for errors (when enabled)

## Cost and Token Tracking

When agents report API usage in their output, Agent Desk captures:

- Token counts (input and output)
- Estimated costs
- Running totals per agent and globally

See [Cost Tracking](/guide/cost-tracking) for details.

## Agent Naming

Agents are automatically named based on their output. When the parser detects a name assignment (e.g., from agent-comm registration), the terminal tab is updated to show the agent's chosen name instead of the profile name.

## Event Bus Integration

All agent events flow through a central event bus that powers:

- The [Event Stream](/guide/event-stream) timeline
- The [Agent Comm](/guide/dashboards) cards
- Terminal tab status indicators
- Desktop notifications

For the full guide, see [Agent Comm](/guide/dashboards).
