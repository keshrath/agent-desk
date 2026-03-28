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

const { TerminalManager } = await import('../../src/main/terminal-manager.js');

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
  });
});
