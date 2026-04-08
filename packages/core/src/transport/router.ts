// Transport-agnostic dispatcher. Both @agent-desk/desktop (Electron IPC)
// and @agent-desk/server (WebSocket) build their transport on top of this.
//
// The router holds a handler for every channel in the contract, plus an
// EventEmitter that pushes server→client events. It does NOT know about
// `ipcMain`, `BrowserWindow`, `ws`, or any specific transport.
//
// As stores are extracted from src/main/index.ts in subsequent commits,
// CoreDeps and createRouter() get filled in. For now this is the skeleton
// that proves the channels contract type-checks against a real handler map.

import { EventEmitter } from 'events';
import type {
  RequestChannel,
  RequestArgs,
  RequestResult,
  CommandChannel,
  CommandArgs,
  PushChannel,
  PushArgs,
} from './channels.js';

export type RequestHandler<K extends RequestChannel> = (
  ...args: RequestArgs<K>
) => RequestResult<K> | Promise<RequestResult<K>>;

export type RequestHandlers = {
  [K in RequestChannel]?: RequestHandler<K>;
};

export type CommandHandler<K extends CommandChannel> = (...args: CommandArgs<K>) => void;

export type CommandHandlers = {
  [K in CommandChannel]?: CommandHandler<K>;
};

export interface Router {
  request<K extends RequestChannel>(channel: K, ...args: RequestArgs<K>): Promise<RequestResult<K>>;
  command<K extends CommandChannel>(channel: K, ...args: CommandArgs<K>): void;
  on<K extends PushChannel>(channel: K, listener: (...args: PushArgs<K>) => void): () => void;
  emit<K extends PushChannel>(channel: K, ...args: PushArgs<K>): void;
  requestChannels: RequestChannel[];
  commandChannels: CommandChannel[];
}

export interface CreateRouterOptions {
  requestHandlers: RequestHandlers;
  commandHandlers: CommandHandlers;
}

export function createRouter(opts: CreateRouterOptions): Router {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);

  return {
    async request(channel, ...args) {
      const handler = opts.requestHandlers[channel] as RequestHandler<typeof channel> | undefined;
      if (!handler) throw new Error(`No handler for request channel: ${channel}`);
      return handler(...args);
    },
    command(channel, ...args) {
      const handler = opts.commandHandlers[channel] as CommandHandler<typeof channel> | undefined;
      if (!handler) throw new Error(`No handler for command channel: ${channel}`);
      handler(...args);
    },
    on(channel, listener) {
      bus.on(channel, listener as (...a: unknown[]) => void);
      return () => bus.off(channel, listener as (...a: unknown[]) => void);
    },
    emit(channel, ...args) {
      bus.emit(channel, ...args);
    },
    requestChannels: Object.keys(opts.requestHandlers) as RequestChannel[],
    commandChannels: Object.keys(opts.commandHandlers) as CommandChannel[],
  };
}
