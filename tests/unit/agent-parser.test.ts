/**
 * agent-parser.test.ts -- Unit tests for agent parser patterns
 *
 * Tests tool call detection, cost parsing, token parsing, and agent
 * name detection patterns that were previously tested via E2E evaluate.
 */

import { describe, it, expect } from 'vitest';

const TOOL_PATTERN = /^\s{0,4}(Read|Edit|Bash|Write|Glob|Grep|Agent|WebFetch|WebSearch|ToolSearch)\((.+?)\)\s*$/;
const COST_PATTERN = /Cost:\s*\$([0-9.]+)\s*\(session total:\s*\$([0-9.]+)\)/;
const TOKEN_PATTERN = /(\d+(?:\.\d+)?)[kK]\s*input.*?(\d+(?:\.\d+)?)[kK]\s*output/;
const AGENT_NAME_PATTERN = /Registered as:\s*"([^"]+)"/;
const ERROR_PATTERN = /^(Error|TypeError|ReferenceError|SyntaxError):/m;
const TEST_RESULT_PATTERN = /(\d+)\s*(?:test|spec)s?\s*(?:passed|failed)/i;

describe('tool call detection', () => {
  it.each([
    ['  Read(src/main/index.ts)', 'Read', 'src/main/index.ts'],
    ['  Edit(src/main/index.ts)', 'Edit', 'src/main/index.ts'],
    ['  Bash(npm test)', 'Bash', 'npm test'],
    ['  Write(src/utils/helper.ts)', 'Write', 'src/utils/helper.ts'],
    ['  Glob(**/*.test.ts)', 'Glob', '**/*.test.ts'],
    ['  Grep(TODO)', 'Grep', 'TODO'],
    ['  Agent(sub-task)', 'Agent', 'sub-task'],
    ['  WebFetch(https://api.example.com)', 'WebFetch', 'https://api.example.com'],
    ['  WebSearch(electron playwright testing)', 'WebSearch', 'electron playwright testing'],
    ['  ToolSearch(browser tools)', 'ToolSearch', 'browser tools'],
  ])('detects "%s" as %s tool call', (line, tool, arg) => {
    const match = TOOL_PATTERN.exec(line);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(tool);
    expect(match![2]).toBe(arg);
  });

  it.each(['npm install express', 'ls -la', 'git status', 'normal text output'])(
    'does not match non-tool line "%s"',
    (line) => {
      expect(TOOL_PATTERN.test(line)).toBe(false);
    },
  );
});

describe('cost parsing', () => {
  it('parses message cost and session total', () => {
    const line = 'Cost: $0.48 (session total: $2.15)';
    const match = COST_PATTERN.exec(line);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeCloseTo(0.48);
    expect(parseFloat(match![2])).toBeCloseTo(2.15);
  });

  it('parses from box-formatted output', () => {
    const line = '│   Cost: $0.48 (session total: $2.15) │';
    const match = COST_PATTERN.exec(line);
    expect(match).not.toBeNull();
    expect(parseFloat(match![2])).toBeCloseTo(2.15);
  });
});

describe('token parsing', () => {
  it('parses "Xk input, Yk output" format', () => {
    const line = '✻ Usage: 15.2k input, 3.4k output';
    const match = TOKEN_PATTERN.exec(line);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1]) * 1000).toBeGreaterThanOrEqual(15000);
    expect(parseFloat(match![2]) * 1000).toBeGreaterThanOrEqual(3000);
  });
});

describe('agent name detection', () => {
  it('parses agent name from registration output', () => {
    const line = 'Registered as: "build-agent"';
    const match = AGENT_NAME_PATTERN.exec(line);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('build-agent');
  });

  it('handles different agent names', () => {
    const line = 'Registered as: "odoo-dev"';
    const match = AGENT_NAME_PATTERN.exec(line);
    expect(match![1]).toBe('odoo-dev');
  });
});

describe('error detection', () => {
  it.each([
    'Error: Cannot find module "missing-dep"',
    'TypeError: undefined is not a function',
    'ReferenceError: x is not defined',
    'SyntaxError: Unexpected token',
  ])('detects error in "%s"', (line) => {
    expect(ERROR_PATTERN.test(line)).toBe(true);
  });

  it('does not match normal output', () => {
    expect(ERROR_PATTERN.test('All tests passed')).toBe(false);
  });
});

describe('test result detection', () => {
  it.each([
    ['85 tests passed', 85],
    ['42 tests passed', 42],
    ['3 specs failed', 3],
  ])('detects test results in "%s"', (line, count) => {
    const match = TEST_RESULT_PATTERN.exec(line);
    expect(match).not.toBeNull();
    expect(parseInt(match![1])).toBe(count);
  });
});
