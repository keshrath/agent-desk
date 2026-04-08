// Server handlers — the defaults from @agent-desk/core are sufficient for the
// web target. When AGENT_DESK_SERVER_READONLY=1 (or --readonly) we wrap the
// default request map and reject every channel that mutates state, so the PWA
// v1 read-only contract is enforced server-side rather than relying on the
// client to behave.

import {
  buildDefaultRequestHandlers,
  buildDefaultCommandHandlers,
  type BuildHandlersDeps,
  type RequestHandlers,
  type CommandHandlers,
  type RequestChannel,
} from '@agent-desk/core';

export type { BuildHandlersDeps };

export const READONLY_BLOCKED_CHANNELS: ReadonlySet<RequestChannel> = new Set([
  'terminal:create',
  'terminal:write',
  'terminal:kill',
  'terminal:signal',
  'terminal:restart',
  'session:save',
  'session:autoSave',
  'session:setAgentInfo',
  'session:saveLayout',
  'file:write',
  'config:write',
  'keybindings:write',
  'history:clear',
  'discover:activate',
  'discover:deactivate',
  'discover:delete',
  'mcp:auto-configure',
] as const);

const READONLY_BLOCKED_COMMANDS = new Set<string>(['terminal:subscribe', 'terminal:unsubscribe']);

function readOnlyError(channel: string): Error {
  const err = new Error(`server is read-only — channel ${channel} is blocked`);
  (err as Error & { code?: string }).code = 'AGENT_DESK_READONLY';
  return err;
}

export interface BuildOptions {
  readOnly?: boolean;
}

export function buildRequestHandlers(deps: BuildHandlersDeps, opts: BuildOptions = {}): RequestHandlers {
  const defaults = buildDefaultRequestHandlers(deps);
  if (!opts.readOnly) return defaults;

  const wrapped: RequestHandlers = { ...defaults };
  for (const ch of READONLY_BLOCKED_CHANNELS) {
    if (ch in wrapped) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wrapped as any)[ch] = () => {
        throw readOnlyError(ch);
      };
    }
  }
  return wrapped;
}

export function buildCommandHandlers(deps: BuildHandlersDeps, opts: BuildOptions = {}): CommandHandlers {
  const defaults = buildDefaultCommandHandlers(deps);
  if (!opts.readOnly) return defaults;

  const wrapped: CommandHandlers = { ...defaults };
  for (const ch of READONLY_BLOCKED_COMMANDS) {
    if (ch in wrapped) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wrapped as any)[ch] = () => {
        /* read-only: silently drop */
      };
    }
  }
  return wrapped;
}
