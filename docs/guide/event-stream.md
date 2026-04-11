# Event Stream

The Event Stream is a real-time timeline showing everything happening across all terminals. It captures agent tool calls, file modifications, terminal lifecycle events, test results, errors, and more.

![Event Stream](/screenshots/event-stream.png)

## Opening the Event Stream

- Press <kbd>Ctrl+E</kbd> to toggle the Event Stream view
- Or click the events icon in the sidebar

## Event Types

The stream captures the following event categories:

| Event | Icon | Description |
|-------|------|-------------|
| Terminal Created | add_circle | A new terminal was opened |
| Terminal Exited | cancel | A terminal process ended |
| Terminal Status | swap_horiz | Terminal status changed (running/idle) |
| Tool Call | build | An agent invoked a tool |
| File Modified | description | An agent created or edited a file |
| Test Result | science | A test suite produced results |
| Agent Detected | smart_toy | A new AI agent was detected |
| Agent Named | badge | An agent's name was identified |
| Agent Status | pending | An agent's status changed |
| Error | error | An error occurred |
| Chain Triggered | link | A terminal chain was activated |

## Filtering

The filter bar at the top of the event stream lets you show/hide events by category:

- **Tools** -- tool calls and file modifications
- **Errors** -- error events
- **Status** -- agent and terminal status changes
- **Lifecycle** -- terminal creation/exit, chains, test results

Click a filter button to toggle that category on or off. Active filters are highlighted.

## Searching

The search box at the top of the event stream performs full-text search across all event descriptions and details. Results are highlighted as you type.

## Event Details

Click any event to expand it and see full details:

- **Tool calls** show the tool name, arguments, and timing
- **File modifications** show the file path and modification type
- **Errors** show the full error message and stack trace
- **Test results** show pass/fail counts and failure details

## Persistence

Events are persisted in localStorage so they survive page reloads. The stream retains up to 1,000 events with paginated display (50 at a time). Older events are automatically pruned when the limit is reached.

## Export

Click the export button to download the current event log as a JSON file. This is useful for debugging agent behavior or sharing session activity with team members.

## Severity Levels

Events are color-coded by severity:

| Severity | Color | Examples |
|----------|-------|----------|
| Info | Gray | Terminal created, status changes |
| Success | Green | File modifications |
| Warning | Orange | Test results, terminal exits |
| Error | Red | Errors, failures |

## Related

- [Agent Comm](/guide/dashboards) -- Card-based agent overview
- [Search](/guide/search) -- Search terminal content (not events)
- [Cost Tracking](/guide/cost-tracking) -- Track agent API costs
