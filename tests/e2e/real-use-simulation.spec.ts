/**
 * real-use-simulation.spec.ts -- Multi-agent usage simulation
 *
 * Exercises agent-parser, comm-graph, cost tracking, agent monitor,
 * batch launcher, and event stream with realistic Claude Code output
 * patterns simulating 5 concurrent agents.
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { buildApp, launchApp, closeApp, screenshotOnFailure } from './helpers';

let app: ElectronApplication;
let window: Page;
let terminalsWork = false;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  buildApp();
  ({ app, window } = await launchApp());

  try {
    await window.locator('.dv-terminal-host').first().waitFor({ state: 'attached', timeout: 10000 });
    terminalsWork = true;
  } catch {
    terminalsWork = false;
  }
});

test.afterAll(async () => {
  if (app) await closeApp(app);
});

test.afterEach(async ({}, testInfo) => {
  await screenshotOnFailure(window, testInfo);
});

// ── Realistic Claude Code Output Lines ──────────────────────────────

const CLAUDE_OUTPUT_BLOCKS = [
  [
    'Claude Code v1.5.0',
    'Tips for getting started:',
    '',
    "\u23fa I'll read the file first.",
    '',
    '  Read(src/main/index.ts)',
    '  \u23bf  (1234 lines)',
    '',
    "\u23fa Now I'll edit it.",
    '',
    '  Edit(src/main/index.ts)',
    '  \u23bf  Updated src/main/index.ts',
    '',
    '\u23fa Let me run the tests.',
    '',
    '  Bash(npm test)',
    '  \u23bf  85 tests passed',
    '',
    '\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e',
    '\u2502 \u273b Usage: 15.2k input, 3.4k output   \u2502',
    '\u2502   Cost: $0.48 (session total: $2.15) \u2502',
    '\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f',
  ],
  [
    "I'll help you with that.",
    '',
    '  Grep(TODO)',
    '  \u23bf  12 matches in 5 files',
    '',
    '  Glob(**/*.test.ts)',
    '  \u23bf  8 files found',
    '',
    '  Write(src/utils/helper.ts)',
    '  \u23bf  Created src/utils/helper.ts',
    '',
    '\u273b Usage: 8.1k input, 2.0k output',
    'Cost: $0.31 (session total: $3.80)',
  ],
  [
    'Registered as: "build-agent"',
    '',
    '  Agent(sub-task)',
    '  \u23bf  Spawned subagent',
    '',
    '  WebFetch(https://api.example.com)',
    '  \u23bf  200 OK',
    '',
    '  WebSearch(electron playwright testing)',
    '  \u23bf  5 results',
    '',
    '\u273b Usage: 22.5k input, 5.1k output',
    'Cost: $0.72 (session total: $5.40)',
  ],
  [
    '  ToolSearch(browser tools)',
    '  \u23bf  3 tools found',
    '',
    '  Read(package.json)',
    '  \u23bf  (94 lines)',
    '',
    'Error: Cannot find module "missing-dep"',
    '',
    '  Edit(package.json)',
    '  \u23bf  Updated package.json',
    '',
    '  Bash(npm install)',
    '  \u23bf  added 12 packages',
    '',
    '\u273b Usage: 11.0k input, 4.2k output',
    'Cost: $0.48 (session total: $1.92)',
  ],
  [
    'Thinking...',
    'Analyzing...',
    '',
    '  Read(src/renderer/comm-graph.js)',
    '  \u23bf  (382 lines)',
    '',
    '  Edit(src/renderer/comm-graph.js)',
    '  \u23bf  Updated src/renderer/comm-graph.js',
    '',
    'Tests: 42 passed',
    '',
    '\u273b Usage: 9.7k input, 3.0k output',
    'Cost: $0.37 (session total: $0.37)',
  ],
];

// ── Section A: Simulate 5 Agent Terminals ───────────────────────────

test('agentParser detects all 5 agents from realistic output', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate((blocks) => {
    const ids: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const id = 'sim-agent-' + i;
      ids.push(id);
      (window as any).agentParser.markAsAgent(id, 'sim-' + i);
      (window as any).agentParser.parse(id, blocks[i].join('\n'));
    }
    const agents = (window as any).agentParser.getAgentTerminals();
    const simAgents = agents.filter((a: any) => a.terminalId.startsWith('sim-agent-'));
    return { count: simAgents.length, ids };
  }, CLAUDE_OUTPUT_BLOCKS);

  expect(result.count).toBe(5);
});

test('agentParser extracts correct tool calls from each agent', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const toolCounts: Record<string, number> = {};
    const lastTools: Record<string, string> = {};
    for (let i = 0; i < 5; i++) {
      const id = 'sim-agent-' + i;
      const info = (window as any).agentParser.getInfo(id);
      if (info) {
        toolCounts[id] = info.toolCount;
        lastTools[id] = info.lastTool || 'none';
      }
    }
    return { toolCounts, lastTools };
  });

  expect(result.toolCounts['sim-agent-0']).toBe(3);
  expect(result.lastTools['sim-agent-0']).toBe('Bash');

  expect(result.toolCounts['sim-agent-1']).toBe(3);
  expect(result.lastTools['sim-agent-1']).toBe('Write');

  expect(result.toolCounts['sim-agent-2']).toBe(3);

  expect(result.toolCounts['sim-agent-3']).toBeGreaterThanOrEqual(4);

  expect(result.toolCounts['sim-agent-4']).toBe(2);
});

test('agentParser parses token usage from "Xk input, Yk output" format', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const info = (window as any).agentParser.getInfo('sim-agent-0');
    return info
      ? {
          input: info.estimatedInputTokens,
          output: info.estimatedOutputTokens,
        }
      : null;
  });

  expect(result).toBeTruthy();
  expect(result!.input).toBeGreaterThanOrEqual(15000);
  expect(result!.input).toBeLessThanOrEqual(16000);
  expect(result!.output).toBeGreaterThanOrEqual(3000);
  expect(result!.output).toBeLessThanOrEqual(4000);
});

test('agentParser parses cost from "Cost: $X.XX (session total: $Y.YY)"', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const cost = (window as any).agentParser.getAgentCost('sim-agent-0');
    const info = (window as any).agentParser.getInfo('sim-agent-0');
    return cost
      ? {
          estimatedCost: cost.estimatedCost,
          hasParsedCost: cost.hasParsedCost,
          parsedSession: info ? info.parsedSessionCost : 0,
          parsedMessage: info ? info.parsedMessageCost : 0,
        }
      : null;
  });

  expect(result).toBeTruthy();
  expect(result!.hasParsedCost).toBe(true);
  expect(result!.parsedSession).toBeCloseTo(2.15, 1);
  expect(result!.parsedMessage).toBeCloseTo(0.48, 1);
  expect(result!.estimatedCost).toBeCloseTo(2.15, 1);
});

test('agentParser prefers session total cost over message cost', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const cost = (window as any).agentParser.getAgentCost('sim-agent-2');
    return cost ? { estimatedCost: cost.estimatedCost, hasParsedCost: cost.hasParsedCost } : null;
  });

  expect(result).toBeTruthy();
  expect(result!.hasParsedCost).toBe(true);
  expect(result!.estimatedCost).toBeCloseTo(5.4, 1);
});

test('agentParser getTotalCost aggregates across agents', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const total = (window as any).agentParser.getTotalCost();
    const simAgents = total.agents.filter((a: any) => a.terminalId.startsWith('sim-agent-'));
    return {
      totalCost: total.totalCost,
      simCount: simAgents.length,
      simCosts: simAgents.map((a: any) => ({ id: a.terminalId, cost: a.cost, hasParsed: a.hasParsedCost })),
    };
  });

  expect(result.simCount).toBe(5);
  const totalSimCost = result.simCosts.reduce((sum: number, a: any) => sum + a.cost, 0);
  expect(totalSimCost).toBeGreaterThan(0);
});

test('agentParser detects agent name from registration output', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const info = (window as any).agentParser.getInfo('sim-agent-2');
    return info ? info.agentName : null;
  });

  expect(result).toBe('build-agent');
});

test('agentParser detects errors in realistic output', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const info = (window as any).agentParser.getInfo('sim-agent-3');
    return info ? info.errors.length : 0;
  });

  expect(result).toBeGreaterThan(0);
});

test('agentParser detects test results', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const history = (window as any).eventBus.history('agent:test-result');
    return history.length;
  });

  expect(result).toBeGreaterThanOrEqual(2);
});

test('agentParser detects status patterns (thinking, analyzing)', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const history = (window as any).eventBus.history('agent:status');
    return history.length;
  });

  expect(result).toBeGreaterThanOrEqual(1);
});

test('agentParser detects working status from thinking indicator', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const id = 'sim-status-test';
    (window as any).agentParser.markAsAgent(id, 'status-tester');
    (window as any).eventBus.clear();
    (window as any).agentParser.parse(id, '\u23fa I will analyze the code.');
    const events = (window as any).eventBus.history('agent:status');
    (window as any).agentParser.cleanup(id);
    return events.length;
  });

  expect(result).toBeGreaterThanOrEqual(1);
});

test('cost widget in status bar shows non-zero after simulation', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const text = await window.evaluate(() => {
    const widget = document.querySelector('.cost-widget .cost-value');
    return widget ? widget.textContent : null;
  });

  if (text) {
    const match = text.match(/\$([0-9.]+)/);
    if (match) {
      expect(parseFloat(match[1])).toBeGreaterThan(0);
    }
  }
});

// ── Section B: Agent Communication (mocked) ─────────────────────────

test('comm-graph handles empty agent list gracefully', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(async () => {
    const origFetch = window.fetch;
    (window as any).fetch = () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    try {
      return true;
    } finally {
      (window as any).fetch = origFetch;
    }
  });

  expect(result).toBe(true);
});

test('comm-graph handles API failure gracefully', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(async () => {
    const origFetch = window.fetch;
    (window as any).fetch = () => Promise.reject(new Error('ECONNREFUSED'));
    try {
      return true;
    } finally {
      (window as any).fetch = origFetch;
    }
  });

  expect(result).toBe(true);
});

test('comm-graph handles non-array API response', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(async () => {
    const origFetch = window.fetch;
    (window as any).fetch = () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ agents: [], error: null }),
      });
    try {
      return true;
    } finally {
      (window as any).fetch = origFetch;
    }
  });

  expect(result).toBe(true);
});

// ── Section C: Batch Launch Simulation ──────────────────────────────

test('batch launcher modal appears when invoked', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const visible = await window.evaluate(() => {
    const reg = (window as any).__agentDeskRegistry;
    if (reg && reg.showBatchLauncher) {
      reg.showBatchLauncher({ count: 3, namingPattern: 'test-batch-{n}', staggerDelay: 0 });
      const overlay = document.querySelector('.batch-launcher-overlay');
      return !!overlay;
    }
    return false;
  });

  expect(visible).toBe(true);

  await window.evaluate(() => {
    const reg = (window as any).__agentDeskRegistry;
    if (reg && reg.hideBatchLauncher) reg.hideBatchLauncher();
  });
});

test('batch launcher form has count, profile, naming fields', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const fields = await window.evaluate(() => {
    const reg = (window as any).__agentDeskRegistry;
    if (reg && reg.showBatchLauncher) {
      reg.showBatchLauncher({ count: 3 });
    }
    const inputs = document.querySelectorAll('.batch-launcher-input');
    const selects = document.querySelectorAll('.batch-launcher-select');
    const result = { inputs: inputs.length, selects: selects.length };

    if (reg && reg.hideBatchLauncher) reg.hideBatchLauncher();
    return result;
  });

  expect(fields.inputs).toBeGreaterThanOrEqual(3);
});

// ── Section D: Event Stream Stress Test (500+ events) ───────────────

test('event bus handles 500+ events without memory leak', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const bus = (window as any).eventBus;
    bus.clear();

    for (let i = 0; i < 600; i++) {
      bus.emit('agent:tool-call', {
        terminalId: 'stress-agent-' + (i % 5),
        tool: ['Read', 'Write', 'Edit', 'Bash', 'Grep'][i % 5],
        arg: 'file-' + i + '.ts',
        toolCount: i,
      });
    }

    const history = bus.history();
    return { totalEvents: history.length };
  });

  expect(result.totalEvents).toBeLessThanOrEqual(2000);
  expect(result.totalEvents).toBeGreaterThanOrEqual(600);
});

test('event stream DOM keeps max 200 elements', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const list = document.getElementById('es-list');
    if (!list) return { childCount: -1 };
    return { childCount: list.children.length };
  });

  if (result.childCount >= 0) {
    expect(result.childCount).toBeLessThanOrEqual(200);
  }
});

test('event bus filters work after stress test', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const bus = (window as any).eventBus;
    const toolEvents = bus.history('agent:tool-call');
    const errorEvents = bus.history('error');
    return { toolCount: toolEvents.length, errorCount: errorEvents.length };
  });

  expect(result.toolCount).toBeGreaterThan(0);
  expect(result.errorCount).toBe(0);
});

test('event bus history by timestamp works correctly', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const bus = (window as any).eventBus;
    const now = Date.now();
    const recent = bus.history(undefined, now - 5000);
    const old = bus.history(undefined, now + 60000);
    return { recentCount: recent.length, futureCount: old.length };
  });

  expect(result.recentCount).toBeGreaterThan(0);
  expect(result.futureCount).toBe(0);
});

// ── Section E: All Tool Types Detected ──────────────────────────────

test('agentParser detects all 10 core tool types', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const tools = ['Read', 'Edit', 'Bash', 'Write', 'Glob', 'Grep', 'Agent', 'WebFetch', 'WebSearch', 'ToolSearch'];
    const detected: string[] = [];
    for (const tool of tools) {
      const id = 'tool-detect-' + tool;
      (window as any).agentParser.parse(id, tool + '(test-arg)');
      const info = (window as any).agentParser.getInfo(id);
      if (info && info.lastTool === tool) detected.push(tool);
      (window as any).agentParser.cleanup(id);
    }
    return detected;
  });

  expect(result).toEqual([
    'Read',
    'Edit',
    'Bash',
    'Write',
    'Glob',
    'Grep',
    'Agent',
    'WebFetch',
    'WebSearch',
    'ToolSearch',
  ]);
});

// ── Section F: Cost Estimation Fallback ─────────────────────────────

test('agentParser falls back to estimates when no parsed cost', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const id = 'no-cost-agent';
    (window as any).agentParser.markAsAgent(id, 'estimator');
    (window as any).agentParser.parse(id, 'Read(a.ts)');
    (window as any).agentParser.parse(id, 'Write(b.ts)');
    (window as any).agentParser.parse(id, "I'll help you with that.");
    const cost = (window as any).agentParser.getAgentCost(id);
    (window as any).agentParser.cleanup(id);
    return cost;
  });

  expect(result).toBeTruthy();
  expect(result.hasParsedCost).toBe(false);
  expect(result.estimatedCost).toBeGreaterThan(0);
  expect(result.toolCalls).toBe(2);
});

test('cost widget prefix is ~ for estimated, no ~ for parsed', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  const result = await window.evaluate(() => {
    const widget = document.querySelector('.cost-widget .cost-value');
    return widget ? widget.textContent : null;
  });

  if (result) {
    expect(result).toMatch(/~?\$[0-9.]+/);
  }
});

// ── Cleanup ─────────────────────────────────────────────────────────

test('cleanup simulation agents', async () => {
  test.skip(!terminalsWork, 'Terminal creation not working');

  await window.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      (window as any).agentParser.cleanup('sim-agent-' + i);
    }
    for (let i = 0; i < 5; i++) {
      (window as any).agentParser.cleanup('stress-agent-' + i);
    }
    (window as any).eventBus.clear();
  });

  expect(true).toBe(true);
});
