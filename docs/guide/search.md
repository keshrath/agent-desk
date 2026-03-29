# Search

Agent Desk provides two levels of search: **in-terminal search** for finding text within a single terminal, and **cross-terminal global search** for searching all terminal buffers simultaneously.

## In-Terminal Search

Press <kbd>Ctrl+F</kbd> to open the search bar in the active terminal.

This uses the built-in search to find text within the terminal's scrollback buffer.

### Controls

- Type your query in the search input
- Press <kbd>Enter</kbd> to find the next match
- Press <kbd>Shift+Enter</kbd> to find the previous match
- Press <kbd>Escape</kbd> to close the search bar

Matches are highlighted directly in the terminal output.

## Cross-Terminal Global Search

Press <kbd>Ctrl+Shift+F</kbd> to open the Global Search overlay.

![Global Search](/screenshots/global-search.png)

Global Search searches across **all terminal buffers simultaneously**. This is particularly useful when running multiple agents and you need to find where a specific file was mentioned, an error occurred, or a particular tool was called.

### How It Works

1. Open Global Search with <kbd>Ctrl+Shift+F</kbd>
2. Type your query -- results appear after a brief debounce (300ms)
3. Results are grouped by terminal, showing the matching line and surrounding context
4. Use <kbd>Up</kbd>/<kbd>Down</kbd> arrow keys to navigate between results
5. Press <kbd>Enter</kbd> to jump to the matching terminal and scroll to that line
6. Press <kbd>Escape</kbd> to close

### Options

The search bar includes toggle buttons for:

- **Case Sensitive** -- match exact case (off by default)
- **Regex** -- use regular expressions (off by default)

### Performance

Global Search uses async chunked searching to remain responsive even with large terminal buffers. Results are capped at 500 matches to keep the UI fast. The search is debounced at 300ms to avoid excessive searching while you type.

A running search can be aborted by modifying the query -- the previous search is cancelled automatically.

::: tip
Use regex mode for powerful pattern matching. For example, search for `error.*file` to find error messages that mention files, or `\d{3,}ms` to find slow operations.
:::

## Related

- [Terminals](/guide/terminals) -- Terminal buffer and scrollback settings
- [Event Stream](/guide/event-stream) -- Search events (not terminal content)
- [Keyboard Shortcuts](/reference/shortcuts) -- Full shortcut reference
