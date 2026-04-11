# Batch Launch & Templates

Agent Desk provides two complementary features for launching multiple agents: the **Batch Launcher** for quick ad-hoc launches, and **Templates** for saved, reusable agent configurations.

## Batch Launcher

The Batch Launcher is a modal dialog for spinning up multiple agent terminals at once.

![Batch Launcher](/screenshots/batch-launcher.png)

### Opening the Launcher

- Press <kbd>Ctrl+Shift+B</kbd>
- Or use the Command Palette (<kbd>Ctrl+Shift+P</kbd>) and search "Batch Launch"

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| **Agent Count** | Number of terminals to create (1-20) | 3 |
| **Profile** | Which profile to use for all agents | Default profile |
| **Naming Pattern** | Template for terminal names. `{n}` is replaced with the index | `agent-{n}` |
| **Working Directory** | Override the profile's default directory | Profile default |
| **Initial Command** | Command to type into each terminal after launch | *(none)* |
| **Stagger Delay** | Milliseconds to wait between each launch | 0 |
| **Max Concurrency** | Maximum simultaneous agent launches | *(unlimited)* |

### Naming Patterns

The `{n}` placeholder is replaced with the agent's sequence number (1, 2, 3, ...). Examples:

- `agent-{n}` produces: agent-1, agent-2, agent-3
- `review-{n}` produces: review-1, review-2, review-3
- `task-{n}-impl` produces: task-1-impl, task-2-impl, task-3-impl

### Stagger Delay

When launching many agents, you can set a stagger delay to avoid overwhelming your system. For example, a 2000ms delay means each agent launches 2 seconds after the previous one.

::: tip CPU-Aware Throttling
The batch launcher includes CPU-aware throttling. When system CPU usage is high, additional launches may be automatically delayed to maintain system responsiveness.
:::

## Templates

Templates are saved multi-agent configurations with per-agent customization. Unlike batch launch (which creates N identical terminals), templates let you define different profiles and commands for each agent slot.

### Built-in Templates

Agent Desk includes two default templates:

#### Quick Review
Launches 3 Claude agents for parallel code review:
- `arch-review` -- architecture review
- `security-review` -- security review
- `quality-review` -- code quality review

#### Parallel Tasks
Launches 5 generic Claude agents for parallel work:
- `task-1` through `task-5`

### Creating a Template

1. Open Settings (<kbd>Ctrl+7</kbd>)
2. Scroll to the **Templates** section
3. Click **Add Template**
4. Configure the template:
   - **Name** -- descriptive name (e.g., "Frontend Team")
   - **Icon** -- Material Symbol icon
   - **Description** -- what this template is for
   - **Agents** -- add/remove agent slots, each with:
     - Name
     - Profile
     - Command override
     - Initial input

### Launching a Template

Templates appear in the Command Palette (<kbd>Ctrl+Shift+P</kbd>). Search for the template name and select it to launch all its agents.

Templates can also be selected from the Batch Launcher's template picker.

### Template Variables

Template commands support variable placeholders that are prompted at launch time. This allows you to reuse templates with different inputs each time (for example, providing a different branch name or review scope).

## Related

- [Profiles](/guide/profiles) -- Profiles that templates reference
- [Agent Comm](/guide/dashboards) -- Monitor all launched agents
- [Workspaces](/guide/workspaces) -- Save and restore terminal layouts
