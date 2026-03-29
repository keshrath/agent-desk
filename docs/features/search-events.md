# Search & Events

Agent Desk provides two powerful tools for finding information: cross-terminal search and the event stream timeline.

## Cross-Terminal Search

Global Search (<kbd>Ctrl+Shift+F</kbd>) searches all terminal buffers simultaneously:

- **Async chunked searching** -- remains responsive with large buffers
- **Case sensitivity toggle** -- exact case or case-insensitive matching
- **Regex support** -- full regular expression patterns
- **Debounced input** -- 300ms debounce to avoid excessive searching
- **Result limit** -- up to 500 matches for performance
- **Keyboard navigation** -- arrow keys to move between results
- **Jump-to-line** -- press Enter to switch to the matching terminal and line
- **Abort support** -- modifying the query cancels the previous search

## In-Terminal Search

Terminal Search (<kbd>Ctrl+F</kbd>) finds text within a single terminal:

- Native terminal search for fast performance
- Navigate with Enter/Shift+Enter
- Highlighted matches in the terminal buffer

## Event Stream

The Event Stream (<kbd>Ctrl+E</kbd>) is a real-time timeline of all activity:

- **11 event types** -- terminal lifecycle, tool calls, file modifications, test results, errors, chains, agent detection/naming/status
- **Category filtering** -- toggle Tools, Errors, Status, Lifecycle groups
- **Full-text search** -- search across event descriptions
- **Expandable details** -- click events to see full information
- **Severity coloring** -- info (gray), success (green), warning (orange), error (red)
- **1,000 event buffer** -- with paginated display (50 per page)
- **localStorage persistence** -- events survive page reloads
- **JSON export** -- download the event log

For detailed guides, see:
- [Search](/guide/search)
- [Event Stream](/guide/event-stream)
