// Agent SDK bridges — wraps the in-process agent-comm / agent-tasks /
// agent-knowledge / agent-discover SDKs and exposes:
//   1. Lazy-initialized context refs (.comm, .tasks, .discover) and the
//      knowledge static helpers, used by request-handler bodies in the host
//   2. A polling loop that emits push events through a host-provided emitter
//
// Each host (Electron desktop OR HTTP server) wires the emit callback into
// its push transport. Core never knows about webContents.send or ws.
//
// The full SDK surfaces (proxy.activate, registry.unregister, marketplace
// .browse, secrets.list, metrics.getOverview, health.getHealth, etc.) are
// not re-exposed here on purpose — encoding them in core would make this
// module brittle against SDK upgrades. Handler bodies in the host call the
// methods they need directly via bridges.commCtx / .tasksCtx / .discoverCtx.

import { createContext as createCommContext, type AppContext as CommContext } from 'agent-comm/dist/lib.js';
import { createContext as createTasksContext, type AppContext as TasksContext } from 'agent-tasks/dist/lib.js';
import { createContext as createDiscoverContext, type AppContext as DiscoverContext } from 'agent-discover/dist/lib.js';
import {
  getConfig as getKnowledgeConfig,
  listEntries,
  readEntry,
  searchKnowledge,
  listSessions,
  getSessionSummary,
} from 'agent-knowledge/dist/lib.js';

export type EmitFn = (channel: string, payload: unknown) => void;

export type BridgeStatus = 'ok' | 'failed' | 'uninitialized';
export interface BridgesStatus {
  comm: BridgeStatus;
  tasks: BridgeStatus;
  discover: BridgeStatus;
}

export const knowledge = {
  getConfig: getKnowledgeConfig,
  listEntries,
  readEntry,
  search: searchKnowledge,
  listSessions,
  getSessionSummary,
};

export class AgentBridges {
  // Backing fields are private; readonly accessors below give callers
  // immutable references to the live contexts. This prevents handler code
  // from accidentally nulling them out (which a real bug from v1.1.0
  // demonstrated was easy to do).
  #commCtx: CommContext | null = null;
  #tasksCtx: TasksContext | null = null;
  #discoverCtx: DiscoverContext | null = null;
  #intervals: ReturnType<typeof setInterval>[] = [];
  #commFailed = false;
  #tasksFailed = false;
  #discoverFailed = false;

  get commCtx(): CommContext | null {
    return this.#commCtx;
  }
  get tasksCtx(): TasksContext | null {
    return this.#tasksCtx;
  }
  get discoverCtx(): DiscoverContext | null {
    return this.#discoverCtx;
  }

  init(): void {
    try {
      this.#commCtx = createCommContext();
      process.stderr.write('[agent-desk] native comm context initialized\n');
    } catch (err) {
      this.#commFailed = true;
      process.stderr.write(`[agent-desk] comm context failed: ${err}\n`);
    }
    try {
      this.#tasksCtx = createTasksContext();
      process.stderr.write('[agent-desk] native tasks context initialized\n');
    } catch (err) {
      this.#tasksFailed = true;
      process.stderr.write(`[agent-desk] tasks context failed: ${err}\n`);
    }
    try {
      this.#discoverCtx = createDiscoverContext();
      process.stderr.write('[agent-desk] native discover context initialized\n');
    } catch (err) {
      this.#discoverFailed = true;
      process.stderr.write(`[agent-desk] discover context failed: ${err}\n`);
    }
  }

  /** Count of contexts that failed to initialize. */
  get failed(): number {
    return (this.#commFailed ? 1 : 0) + (this.#tasksFailed ? 1 : 0) + (this.#discoverFailed ? 1 : 0);
  }

  /** Per-bridge initialization status for health reporting. */
  status(): BridgesStatus {
    const resolve = (ctx: unknown, failed: boolean): BridgeStatus => (ctx ? 'ok' : failed ? 'failed' : 'uninitialized');
    return {
      comm: resolve(this.#commCtx, this.#commFailed),
      tasks: resolve(this.#tasksCtx, this.#tasksFailed),
      discover: resolve(this.#discoverCtx, this.#discoverFailed),
    };
  }

  close(): void {
    for (const iv of this.#intervals) clearInterval(iv);
    this.#intervals = [];
    this.#commCtx?.close();
    this.#commCtx = null;
    this.#tasksCtx?.close();
    this.#tasksCtx = null;
    this.#discoverCtx?.close();
    this.#discoverCtx = null;
  }

  /** Start polling loops that push update events through `emit`. */
  startPolling(emit: EmitFn): void {
    this.#intervals.push(
      setInterval(() => {
        if (!this.commCtx) return;
        try {
          emit('comm:update', {
            agents: this.commCtx.agents.list(),
            channels: this.commCtx.channels.list(),
            messages: this.commCtx.messages.list({ limit: 100 }),
            state: this.commCtx.state.list(),
            feed: this.commCtx.feed.recent(100),
          });
        } catch {
          /* context may be closing */
        }
      }, 2000),
    );

    this.#intervals.push(
      setInterval(() => {
        if (!this.tasksCtx) return;
        try {
          emit('tasks:update', { tasks: this.tasksCtx.tasks.list({}) });
        } catch {
          /* context may be closing */
        }
      }, 2000),
    );

    this.#intervals.push(
      setInterval(() => {
        try {
          const config = getKnowledgeConfig();
          const entries = listEntries(config.memoryDir);
          emit('knowledge:update', { entries });
        } catch {
          /* knowledge dir may not exist */
        }
      }, 5000),
    );

    this.#intervals.push(
      setInterval(() => {
        if (!this.discoverCtx) return;
        try {
          emit('discover:update', { servers: this.discoverCtx.registry.list() });
        } catch {
          /* context may be closing */
        }
      }, 2000),
    );
  }
}
