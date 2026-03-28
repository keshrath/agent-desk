import { describe, it, expect } from 'vitest';

const WAITING_PATTERNS = [
  /\?\s*$/,
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /Allow\?/i,
  /Approve\?/i,
  /Continue\?/i,
  /Press.*to continue/i,
  /Password:/i,
  /\(yes\/no\)/i,
  /^>\s*$/,
  /❯\s*$/,
  /❯\s+\d+\./,
  /Enter to confirm/i,
  /Esc to cancel/i,
  /\d+\.\s+Yes,/i,
  /\d+\.\s+No,/i,
  /trust this/i,
  /Do you want to/i,
  /\(y\)es/i,
  /approve|deny|reject/i,
];

const IDLE_PATTERNS = [/\$$/, /[A-Z]:\\[^>]*>$/, /PS [A-Z]:\\.*>$/, /#$/];

const WORKING_PATTERNS = [
  /Honking/i,
  /Thinking/i,
  /Running/i,
  /agents?\.\.\./i,
  /\u280[0-9a-f]/,
  /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
  /\.\.\.$/,
];

function matchStatus(line: string): string {
  for (const p of WAITING_PATTERNS) {
    if (p.test(line)) return 'waiting';
  }
  for (const p of IDLE_PATTERNS) {
    if (p.test(line)) return 'idle';
  }
  for (const p of WORKING_PATTERNS) {
    if (p.test(line)) return 'running';
  }
  return 'running';
}

describe('WAITING_PATTERNS', () => {
  it.each([
    ['Proceed? [Y/n]', 'Y/n prompt'],
    ['Continue? [y/N]', 'y/N prompt'],
    ['Allow? ', 'Allow prompt'],
    ['Approve?', 'Approve prompt'],
    ['Password:', 'Password prompt'],
    ['(yes/no)', 'yes/no prompt'],
    ['> ', 'Claude Code input prompt'],
    ['❯ ', 'fancy prompt'],
    ['❯ 1. Yes, allow', 'Claude selection prompt'],
    ['Enter to confirm', 'confirm prompt'],
    ['Esc to cancel', 'cancel prompt'],
    ['1. Yes, I trust', 'trust prompt yes'],
    ['2. No, exit', 'trust prompt no'],
    ['Do you trust this folder?', 'trust this'],
    ['Do you want to continue?', 'do you want to'],
    ['(y)es / (n)o', 'yes shorthand'],
    ['approve this action', 'approve keyword'],
    ['deny access', 'deny keyword'],
  ])('detects "%s" as waiting (%s)', (line) => {
    expect(matchStatus(line)).toBe('waiting');
  });
});

describe('IDLE_PATTERNS', () => {
  it.each([
    ['user@host:~$', 'bash prompt'],
    ['C:\\Users\\test>', 'Windows cmd prompt'],
    ['PS C:\\Users\\test>', 'PowerShell prompt'],
    ['root@host:#', 'root prompt'],
  ])('detects "%s" as idle (%s)', (line) => {
    expect(matchStatus(line)).toBe('idle');
  });
});

describe('WORKING_PATTERNS', () => {
  it.each([
    ['⠋ Honking...', 'Claude thinking'],
    ['Thinking about your question', 'thinking'],
    ['Running 3 agents...', 'running agents'],
    ['Loading...', 'trailing ellipsis'],
    ['⠙', 'spinner frame'],
  ])('detects "%s" as running (%s)', (line) => {
    expect(matchStatus(line)).toBe('running');
  });
});

describe('no false positives', () => {
  it.each([
    ['hello world', 'normal text'],
    ['npm install completed', 'command output'],
    ['Error: file not found', 'error message'],
    ['  return value;', 'code line'],
  ])('"%s" defaults to running (%s)', (line) => {
    expect(matchStatus(line)).toBe('running');
  });
});

describe('stripAnsi', () => {
  function stripAnsi(str: string): string {
    return str
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\x1b[()][0-9A-B]/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }

  it('strips SGR sequences', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
  });

  it('strips OSC sequences', () => {
    expect(stripAnsi('\x1b]0;title\x07text')).toBe('text');
  });

  it('strips cursor movement', () => {
    expect(stripAnsi('\x1b[2Ahello')).toBe('hello');
  });

  it('strips control characters', () => {
    expect(stripAnsi('hello\x01\x02world')).toBe('helloworld');
  });

  it('preserves normal text', () => {
    expect(stripAnsi('just normal text')).toBe('just normal text');
  });

  it('handles mixed content', () => {
    expect(stripAnsi('\x1b[1m\x1b[32m$\x1b[0m ')).toBe('$ ');
  });
});

describe('argument parsing', () => {
  function parseArgs(str: string): string[] {
    if (!str) return [];
    const args: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inQuote) {
        if (ch === inQuote) {
          inQuote = null;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ' ' || ch === '\t') {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }
    if (current) args.push(current);
    return args;
  }

  it('splits simple args', () => {
    expect(parseArgs('--flag1 --flag2')).toEqual(['--flag1', '--flag2']);
  });

  it('handles double-quoted args', () => {
    expect(parseArgs('--message "hello world" --verbose')).toEqual(['--message', 'hello world', '--verbose']);
  });

  it('handles single-quoted args', () => {
    expect(parseArgs("--name 'John Doe'")).toEqual(['--name', 'John Doe']);
  });

  it('handles empty string', () => {
    expect(parseArgs('')).toEqual([]);
  });

  it('handles multiple spaces', () => {
    expect(parseArgs('a   b   c')).toEqual(['a', 'b', 'c']);
  });
});
