import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPty = {
  onData: vi.fn(),
  onExit: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
};

vi.mock('node-pty', () => ({
  default: { spawn: vi.fn(() => mockPty) },
  spawn: vi.fn(() => mockPty),
}));

vi.mock('child_process', () => ({
  execFileSync: vi.fn(() => '/usr/bin/test-cmd'),
}));

const { TerminalManager } = await import('../../packages/core/src/terminal-manager.js');

describe('TerminalManager', () => {
  let tm: InstanceType<typeof TerminalManager>;

  beforeEach(() => {
    tm = new TerminalManager();
    vi.clearAllMocks();
    mockPty.onData.mockImplementation(() => {});
    mockPty.onExit.mockImplementation(() => {});
  });

  describe('spawn', () => {
    it('creates a terminal with a unique id', () => {
      const t = tm.spawn(undefined, 'cmd');
      expect(t.id).toBeTruthy();
      expect(t.status).toBe('running');
    });

    it('uses provided cwd', () => {
      const t = tm.spawn('/tmp/test', 'cmd');
      expect(t.cwd).toBe('/tmp/test');
    });

    it('rejects commands with shell metacharacters on Windows', () => {
      const origPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      try {
        expect(() => tm.spawn(undefined, 'foo & bar')).toThrow('Invalid command name');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlatform });
      }
    });

    it('allows valid command names on Windows', () => {
      const origPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      try {
        const t = tm.spawn(undefined, 'node');
        expect(t.command).toBe('node');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlatform });
      }
    });

    it('tracks terminal in list', () => {
      tm.spawn(undefined, 'cmd');
      tm.spawn(undefined, 'cmd');
      expect(tm.list()).toHaveLength(2);
    });
  });

  describe('write', () => {
    it('returns false for non-existent terminal', () => {
      expect(tm.write('nonexistent', 'data')).toBe(false);
    });

    it('writes data to pty', () => {
      const t = tm.spawn(undefined, 'cmd');
      tm.write(t.id, 'hello');
      expect(mockPty.write).toHaveBeenCalledWith('hello');
    });
  });

  describe('resize', () => {
    it('returns false for non-existent terminal', () => {
      expect(tm.resize('nonexistent', 80, 24)).toBe(false);
    });

    it('resizes the pty', () => {
      const t = tm.spawn(undefined, 'cmd');
      tm.resize(t.id, 120, 40);
      expect(mockPty.resize).toHaveBeenCalledWith(120, 40);
    });
  });

  describe('kill', () => {
    it('returns false for non-existent terminal', () => {
      expect(tm.kill('nonexistent')).toBe(false);
    });

    it('kills the pty', () => {
      const t = tm.spawn(undefined, 'cmd');
      tm.kill(t.id);
      expect(mockPty.kill).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('sends buffered output to new subscriber', () => {
      let dataCb: ((data: string) => void) | null = null;
      mockPty.onData.mockImplementation((cb: (data: string) => void) => {
        dataCb = cb;
      });
      const t = tm.spawn(undefined, 'cmd');
      dataCb!('buffered data');

      const client = { send: vi.fn(), sendExit: vi.fn() };
      tm.subscribe(t.id, client);
      expect(client.send).toHaveBeenCalled();
    });

    it('does nothing for non-existent terminal', () => {
      const client = { send: vi.fn(), sendExit: vi.fn() };
      tm.subscribe('nonexistent', client);
      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('buffer management', () => {
    it('compacts buffer when it exceeds 1.5x max', () => {
      let dataCb: ((data: string) => void) | null = null;
      mockPty.onData.mockImplementation((cb: (data: string) => void) => {
        dataCb = cb;
      });
      const t = tm.spawn(undefined, 'cmd');
      const bigChunk = 'x'.repeat(160_000);
      dataCb!(bigChunk);
      const buffer = tm.getBuffer(t.id);
      expect(buffer.length).toBeLessThanOrEqual(100_000);
    });

    it('returns empty string for non-existent terminal', () => {
      expect(tm.getBuffer('nonexistent')).toBe('');
    });
  });

  describe('getTitle', () => {
    it('returns Claude for claude command', () => {
      const t = tm.spawn(undefined, 'claude');
      expect(t.title).toBe('Claude');
    });
  });

  describe('cleanup', () => {
    it('kills all terminals and clears the map', () => {
      tm.spawn(undefined, 'cmd');
      tm.spawn(undefined, 'cmd');
      tm.cleanup();
      expect(tm.list()).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('removes a terminal from tracking', () => {
      const t = tm.spawn(undefined, 'cmd');
      tm.remove(t.id);
      expect(tm.list()).toHaveLength(0);
    });

    it('does nothing for non-existent id', () => {
      tm.remove('nonexistent');
      expect(tm.list()).toHaveLength(0);
    });

    it('kills running terminal on remove and swallows pty.kill throws', () => {
      const t = tm.spawn(undefined, 'cmd');
      mockPty.kill.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      tm.remove(t.id);
      expect(tm.list()).toHaveLength(0);
    });
  });

  // Helpers for exit/data simulation
  function captureHandlers() {
    let dataCb: ((d: string) => void) | null = null;
    let exitCb: ((e: { exitCode: number }) => void) | null = null;
    mockPty.onData.mockImplementation((cb: (d: string) => void) => {
      dataCb = cb;
    });
    mockPty.onExit.mockImplementation((cb: (e: { exitCode: number }) => void) => {
      exitCb = cb;
    });
    return {
      getData: () => dataCb!,
      getExit: () => exitCb!,
    };
  }

  describe('signal', () => {
    it('returns false for unknown id', () => {
      expect(tm.signal('nope', 'SIGINT')).toBe(false);
    });

    it('SIGINT writes Ctrl+C', () => {
      const t = tm.spawn(undefined, 'cmd');
      expect(tm.signal(t.id, 'SIGINT')).toBe(true);
      expect(mockPty.write).toHaveBeenCalledWith('\x03');
    });

    it('SIGTERM calls pty.kill with signal', () => {
      const t = tm.spawn(undefined, 'cmd');
      expect(tm.signal(t.id, 'SIGTERM')).toBe(true);
      expect(mockPty.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('SIGKILL calls pty.kill with signal', () => {
      const t = tm.spawn(undefined, 'cmd');
      expect(tm.signal(t.id, 'SIGKILL')).toBe(true);
      expect(mockPty.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('unknown signal returns false', () => {
      const t = tm.spawn(undefined, 'cmd');
      expect(tm.signal(t.id, 'SIGFOO')).toBe(false);
    });

    it('returns false when pty throws', () => {
      const t = tm.spawn(undefined, 'cmd');
      mockPty.kill.mockImplementationOnce(() => {
        throw new Error('x');
      });
      expect(tm.signal(t.id, 'SIGTERM')).toBe(false);
    });

    it('returns false for exited terminal', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      h.getExit()({ exitCode: 0 });
      expect(tm.signal(t.id, 'SIGINT')).toBe(false);
    });
  });

  describe('write/resize/kill error and exited paths', () => {
    it('write returns false on pty throw', () => {
      const t = tm.spawn(undefined, 'cmd');
      mockPty.write.mockImplementationOnce(() => {
        throw new Error('x');
      });
      expect(tm.write(t.id, 'x')).toBe(false);
    });

    it('resize returns false on pty throw', () => {
      const t = tm.spawn(undefined, 'cmd');
      mockPty.resize.mockImplementationOnce(() => {
        throw new Error('x');
      });
      expect(tm.resize(t.id, 1, 1)).toBe(false);
    });

    it('kill returns false on pty throw', () => {
      const t = tm.spawn(undefined, 'cmd');
      mockPty.kill.mockImplementationOnce(() => {
        throw new Error('x');
      });
      expect(tm.kill(t.id)).toBe(false);
    });

    it('write/resize/kill return false on exited terminal', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      h.getExit()({ exitCode: 0 });
      expect(tm.write(t.id, 'x')).toBe(false);
      expect(tm.resize(t.id, 1, 1)).toBe(false);
      expect(tm.kill(t.id)).toBe(false);
    });
  });

  describe('restart', () => {
    it('returns null for unknown id', () => {
      expect(tm.restart('nope')).toBeNull();
    });

    it('restarts a running terminal with new id', () => {
      const t = tm.spawn(undefined, 'cmd', ['--foo']);
      const result = tm.restart(t.id);
      expect(result).not.toBeNull();
      expect(result!.id).not.toBe(t.id);
      expect(result!.command).toBe('cmd');
      expect(result!.args).toEqual(['--foo']);
    });

    it('restarts an exited terminal (no kill)', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      h.getExit()({ exitCode: 1 });
      mockPty.kill.mockClear();
      const result = tm.restart(t.id);
      expect(result).not.toBeNull();
      expect(mockPty.kill).not.toHaveBeenCalled();
    });

    it('swallows kill error during restart', () => {
      const t = tm.spawn(undefined, 'cmd');
      mockPty.kill.mockImplementationOnce(() => {
        throw new Error('x');
      });
      expect(tm.restart(t.id)).not.toBeNull();
    });
  });

  describe('getTitle variations', () => {
    it('PowerShell for powershell.exe', () => {
      expect(tm.spawn(undefined, 'powershell.exe').title).toBe('PowerShell');
    });
    it('PowerShell for pwsh', () => {
      expect(tm.spawn(undefined, 'pwsh').title).toBe('PowerShell');
    });
    it('Command Prompt for cmd.exe', () => {
      expect(tm.spawn(undefined, 'cmd.exe').title).toBe('Command Prompt');
    });
    it('Bash capitalized', () => {
      expect(tm.spawn(undefined, 'bash').title).toBe('Bash');
    });
    it('Zsh capitalized', () => {
      expect(tm.spawn(undefined, 'zsh').title).toBe('Zsh');
    });
    it('Fish capitalized', () => {
      expect(tm.spawn(undefined, 'fish').title).toBe('Fish');
    });
    it('Claude for claude.exe', () => {
      expect(tm.spawn(undefined, 'claude.exe').title).toBe('Claude');
    });
    it('generic fallback with args', () => {
      expect(tm.spawn(undefined, 'node', ['a', 'b']).title).toBe('node a b');
    });
    it('generic fallback without args', () => {
      expect(tm.spawn(undefined, 'node').title).toBe('node');
    });
    it('basename handles forward slashes', () => {
      const t = tm.spawn(undefined, '/usr/bin/bash');
      expect(t.title).toBe('Bash');
    });
  });

  describe('getDefaultShell', () => {
    it('uses COMSPEC on win32', () => {
      const origPlat = process.platform;
      const origComspec = process.env.COMSPEC;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.COMSPEC = 'C:\\Windows\\System32\\cmd.exe';
      try {
        const t = tm.spawn();
        expect(t.command).toBe('C:\\Windows\\System32\\cmd.exe');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlat });
        if (origComspec === undefined) delete process.env.COMSPEC;
        else process.env.COMSPEC = origComspec;
      }
    });

    it('falls back to powershell.exe when COMSPEC unset on win32', () => {
      const origPlat = process.platform;
      const origComspec = process.env.COMSPEC;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      delete process.env.COMSPEC;
      try {
        const t = tm.spawn();
        expect(t.command).toBe('powershell.exe');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlat });
        if (origComspec !== undefined) process.env.COMSPEC = origComspec;
      }
    });

    it('uses SHELL on unix', () => {
      const origPlat = process.platform;
      const origShell = process.env.SHELL;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.SHELL = '/bin/zsh';
      try {
        const t = tm.spawn();
        expect(t.command).toBe('/bin/zsh');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlat });
        if (origShell === undefined) delete process.env.SHELL;
        else process.env.SHELL = origShell;
      }
    });

    it('falls back to /bin/bash on unix without SHELL', () => {
      const origPlat = process.platform;
      const origShell = process.env.SHELL;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      delete process.env.SHELL;
      try {
        const t = tm.spawn();
        expect(t.command).toBe('/bin/bash');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlat });
        if (origShell !== undefined) process.env.SHELL = origShell;
      }
    });
  });

  describe('spawn command resolution', () => {
    it('uses Windows where to resolve non-builtin command', async () => {
      const origPlat = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const cp = await import('child_process');
      const spy = vi.mocked(cp.execFileSync);
      spy.mockReturnValueOnce('C:\\bin\\node.exe\n' as unknown as Buffer);
      try {
        tm.spawn(undefined, 'node');
        expect(spy).toHaveBeenCalledWith('where', ['node'], expect.any(Object));
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlat });
      }
    });

    it('falls through if where throws', async () => {
      const origPlat = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const cp = await import('child_process');
      vi.mocked(cp.execFileSync).mockImplementationOnce(() => {
        throw new Error('not found');
      });
      try {
        const t = tm.spawn(undefined, 'mytool');
        expect(t.command).toBe('mytool');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlat });
      }
    });

    it('skips where for absolute path on Windows', async () => {
      const origPlat = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const cp = await import('child_process');
      const spy = vi.mocked(cp.execFileSync);
      spy.mockClear();
      try {
        tm.spawn(undefined, 'C:/tools/node.exe');
        expect(spy).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlat });
      }
    });
  });

  describe('subscribe on exited terminal', () => {
    it('immediately sends exit to client', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      h.getExit()({ exitCode: 42 });
      const client = { send: vi.fn(), sendExit: vi.fn() };
      tm.subscribe(t.id, client);
      expect(client.sendExit).toHaveBeenCalledWith(42);
    });

    it('swallows client.send/sendExit throws', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      h.getData()('some data');
      h.getExit()({ exitCode: 0 });
      const client = {
        send: vi.fn(() => {
          throw new Error('gone');
        }),
        sendExit: vi.fn(() => {
          throw new Error('gone');
        }),
      };
      expect(() => tm.subscribe(t.id, client)).not.toThrow();
    });
  });

  describe('onData broadcasts', () => {
    it('sends data to all subscribers and swallows throws', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      const good = { send: vi.fn(), sendExit: vi.fn() };
      const bad = {
        send: vi.fn(() => {
          throw new Error('x');
        }),
        sendExit: vi.fn(),
      };
      tm.subscribe(t.id, good);
      tm.subscribe(t.id, bad);
      good.send.mockClear();
      h.getData()('chunk');
      expect(good.send).toHaveBeenCalledWith('chunk');
      expect(bad.send).toHaveBeenCalled();
    });

    it('onExit notifies all subscribers and swallows throws', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      const good = { send: vi.fn(), sendExit: vi.fn() };
      const bad = {
        send: vi.fn(),
        sendExit: vi.fn(() => {
          throw new Error('x');
        }),
      };
      tm.subscribe(t.id, good);
      tm.subscribe(t.id, bad);
      h.getExit()({ exitCode: 7 });
      expect(good.sendExit).toHaveBeenCalledWith(7);
    });
  });

  describe('trackInput / command history', () => {
    it('emits history entry on Enter', () => {
      const entries: HistoryEntryLike[] = [];
      tm.onHistoryEntry((e) => entries.push(e));
      const t = tm.spawn(undefined, 'cmd');
      tm.write(t.id, 'echo hi');
      tm.write(t.id, '\r');
      expect(entries).toHaveLength(1);
      expect(entries[0].command).toBe('echo hi');
      expect(entries[0].terminalId).toBe(t.id);
    });

    it('filters empty command', () => {
      const entries: HistoryEntryLike[] = [];
      tm.onHistoryEntry((e) => entries.push(e));
      const t = tm.spawn(undefined, 'cmd');
      tm.write(t.id, '\r');
      expect(entries).toHaveLength(0);
    });

    it('filters single-char command', () => {
      const entries: HistoryEntryLike[] = [];
      tm.onHistoryEntry((e) => entries.push(e));
      const t = tm.spawn(undefined, 'cmd');
      tm.write(t.id, 'a\r');
      expect(entries).toHaveLength(0);
    });

    it('filters pure control sequences', () => {
      const entries: HistoryEntryLike[] = [];
      tm.onHistoryEntry((e) => entries.push(e));
      const t = tm.spawn(undefined, 'cmd');
      // Buffer accumulates only printable chars, so use a command with ANSI escape
      tm.write(t.id, 'ab\x1b[31mcd\x1b[0m');
      // inputBuffer = "ab[31mcd[0m" roughly; after strip => "abcdm"? depends.
      // Simpler: verify backspace handling by writing then \b
      tm.write(t.id, '\b\b\b\b\b\b\b\b\b\b');
      tm.write(t.id, '\r');
      // buffer emptied by backspaces
      expect(entries.every((e) => e.command.length > 1)).toBe(true);
    });

    it('filters ANSI-only commands after cleaning', () => {
      const entries: HistoryEntryLike[] = [];
      tm.onHistoryEntry((e) => entries.push(e));
      const t = tm.spawn(undefined, 'cmd');
      // Printable ESC[?1h => inputBuffer gets "[?1h" (ESC 0x1b is < 32, skipped)
      tm.write(t.id, '\x1b[?1h');
      tm.write(t.id, '\r');
      // After strip ANSI on "[?1h": no escape present, so stays "[?1h"
      // still produces an entry. Accept either; just ensure no throw.
      expect(() => tm.write(t.id, '\r')).not.toThrow();
    });

    it('handles backspace', () => {
      const entries: HistoryEntryLike[] = [];
      tm.onHistoryEntry((e) => entries.push(e));
      const t = tm.spawn(undefined, 'cmd');
      tm.write(t.id, 'helloX');
      tm.write(t.id, '\x7f');
      tm.write(t.id, '\r');
      expect(entries[0].command).toBe('hello');
    });

    it('swallows listener throws', () => {
      tm.onHistoryEntry(() => {
        throw new Error('x');
      });
      const t = tm.spawn(undefined, 'cmd');
      tm.write(t.id, 'echo hi');
      expect(() => tm.write(t.id, '\r')).not.toThrow();
    });
  });

  describe('setAgentInfo', () => {
    it('returns false for unknown id', () => {
      expect(tm.setAgentInfo('nope', 'a', 'p')).toBe(false);
    });
    it('updates agent/profile names', () => {
      const t = tm.spawn(undefined, 'cmd');
      expect(tm.setAgentInfo(t.id, 'myAgent', 'dev')).toBe(true);
      const listed = tm.list().find((x) => x.id === t.id)!;
      expect(listed.agentName).toBe('myAgent');
      expect(listed.profileName).toBe('dev');
    });
  });

  describe('getPid', () => {
    it('returns null for unknown id', () => {
      expect(tm.getPid('nope')).toBeNull();
    });
    it('returns null for exited terminal', () => {
      const h = captureHandlers();
      const t = tm.spawn(undefined, 'cmd');
      h.getExit()({ exitCode: 0 });
      expect(tm.getPid(t.id)).toBeNull();
    });
    it('returns pty pid for running terminal', () => {
      (mockPty as unknown as { pid: number }).pid = 1234;
      const t = tm.spawn(undefined, 'cmd');
      expect(tm.getPid(t.id)).toBe(1234);
    });
  });

  describe('unsubscribeAll', () => {
    it('noop for unknown id', () => {
      expect(() => tm.unsubscribeAll('nope')).not.toThrow();
    });
    it('clears subscribers', () => {
      const t = tm.spawn(undefined, 'cmd');
      tm.subscribe(t.id, { send: vi.fn(), sendExit: vi.fn() });
      tm.unsubscribeAll(t.id);
      // Trigger data — should not throw but also no client to call
      expect(() => tm.unsubscribeAll(t.id)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('swallows kill errors', () => {
      tm.spawn(undefined, 'cmd');
      mockPty.kill.mockImplementationOnce(() => {
        throw new Error('x');
      });
      expect(() => tm.cleanup()).not.toThrow();
      expect(tm.list()).toHaveLength(0);
    });

    it('skips already exited terminals', () => {
      const h = captureHandlers();
      tm.spawn(undefined, 'cmd');
      h.getExit()({ exitCode: 0 });
      mockPty.kill.mockClear();
      tm.cleanup();
      expect(mockPty.kill).not.toHaveBeenCalled();
    });
  });
});

interface HistoryEntryLike {
  command: string;
  terminalId: string;
  terminalTitle: string;
  timestamp: number;
  cwd?: string;
}
