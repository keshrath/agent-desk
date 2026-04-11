# Communication Graph

The Communication Graph is a visual representation of agent-to-agent communication. It renders a canvas-based network graph showing agents as nodes and messages as edges, providing an intuitive view of how your agents interact.

## How It Works

The graph fetches data from the agent-comm service:

1. **Agents** are loaded from the `/api/agents` endpoint and rendered as nodes
2. **Messages** from the "general" channel are analyzed to build communication edges
3. The graph updates periodically to show live activity

## Node Layout

Agents are displayed as circular nodes arranged in the canvas. Each node shows:

- The agent's name
- A status indicator
- A pulse animation for active agents

Hover over a node to see additional details about that agent.

## Edge Drawing

Edges between nodes represent message flow. The weight (thickness) of an edge indicates the volume of communication between two agents. More messages between two agents result in a thicker, more prominent edge.

## Interaction

- **Hover** over a node to highlight it and its connections
- The graph auto-refreshes to show current agent state
- Nodes are laid out automatically based on the number of agents

## Prerequisites

The Communication Graph requires the agent-comm service to be running at the configured URL (default: `http://localhost:3421`). Without it, the graph area will be empty.

## Use Cases

- **Visualize team coordination** -- see which agents are communicating most
- **Identify isolated agents** -- spot agents that aren't participating in team channels
- **Debug communication patterns** -- understand message flow in multi-agent workflows

## Related

- [Dashboard Services](/guide/dashboards) -- Agent-comm service setup
- [Agent Comm](/guide/dashboards) -- Card-based agent overview
- [Batch Launch](/guide/batch-launch) -- Launch agent teams
