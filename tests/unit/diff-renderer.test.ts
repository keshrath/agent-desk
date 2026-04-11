// Unit tests for @agent-desk/core/diff-renderer.
// Covers: small JS diff, Python diff, binary sentinel, oversize truncation,
// unknown extension → plaintext fallback, pure addition, pure deletion, and
// the extension-to-language mapping helper.
//
// Shiki is mocked via vi.mock so tests don't pay the real grammar cost and
// run in ~20 ms each. The mock emits a deterministic `<span class="line">`
// shape so extractShikiLines can split it back into lines.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('shiki', () => {
  return {
    createHighlighter: vi.fn(async () => ({
      codeToHtml: (code: string) => {
        const lines = code.split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '' && code.endsWith('\n')) lines.pop();
        const body = lines
          .map(
            (l) =>
              `<span class="line"><span style="color:#abc">${l
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</span></span>`,
          )
          .join('\n');
        return `<pre class="shiki"><code>${body}</code></pre>`;
      },
      getLoadedLanguages: () => ['javascript', 'typescript', 'python', 'plaintext', 'json', 'markdown'],
    })),
  };
});

import { renderDiff, detectLanguage, __resetHighlighterForTests } from '../../packages/core/src/diff-renderer.js';

beforeEach(() => {
  __resetHighlighterForTests();
});

describe('detectLanguage', () => {
  it('maps common extensions', () => {
    expect(detectLanguage('foo.js')).toBe('javascript');
    expect(detectLanguage('foo.ts')).toBe('typescript');
    expect(detectLanguage('foo.tsx')).toBe('tsx');
    expect(detectLanguage('foo.py')).toBe('python');
    expect(detectLanguage('foo.go')).toBe('go');
    expect(detectLanguage('foo.rs')).toBe('rust');
    expect(detectLanguage('foo.json')).toBe('json');
    expect(detectLanguage('foo.md')).toBe('markdown');
  });

  it('handles windows paths', () => {
    expect(detectLanguage('C:\\src\\main.ts')).toBe('typescript');
  });

  it('returns plaintext for unknown extensions', () => {
    expect(detectLanguage('foo.xyz')).toBe('plaintext');
    expect(detectLanguage('README')).toBe('plaintext');
    expect(detectLanguage('')).toBe('plaintext');
  });

  it('is case-insensitive on extension', () => {
    expect(detectLanguage('foo.JS')).toBe('javascript');
    expect(detectLanguage('foo.TSX')).toBe('tsx');
  });
});

describe('renderDiff — small JavaScript file', () => {
  it('produces a hunk with ctx / add / del lines', async () => {
    const oldCode = "function hi() {\n  console.log('hello');\n}\n";
    const newCode = "function hi() {\n  console.log('hello, world');\n}\n";
    const rd = await renderDiff(oldCode, newCode, 'javascript');

    expect(rd.language).toBe('javascript');
    expect(rd.binary).toBe(false);
    expect(rd.truncated).toBe(false);
    expect(rd.hunks.length).toBeGreaterThan(0);

    const kinds = rd.hunks[0].lines.map((l) => l.kind);
    expect(kinds).toContain('add');
    expect(kinds).toContain('del');
    expect(kinds).toContain('ctx');

    // Every non-empty line should carry some html payload (from the shiki mock).
    const addLine = rd.hunks[0].lines.find((l) => l.kind === 'add');
    expect(addLine).toBeDefined();
    expect(addLine!.html.length).toBeGreaterThan(0);
  });
});

describe('renderDiff — Python file', () => {
  it('highlights and diffs python source', async () => {
    const oldCode = "def greet(name):\n    return f'Hi {name}'\n";
    const newCode = "def greet(name: str) -> str:\n    return f'Hello, {name}!'\n";
    const rd = await renderDiff(oldCode, newCode, 'python');

    expect(rd.language).toBe('python');
    expect(rd.binary).toBe(false);
    expect(rd.hunks.length).toBe(1);
    // Both lines changed → 2 del + 2 add
    const addCount = rd.hunks[0].lines.filter((l) => l.kind === 'add').length;
    const delCount = rd.hunks[0].lines.filter((l) => l.kind === 'del').length;
    expect(addCount).toBe(2);
    expect(delCount).toBe(2);
  });
});

describe('renderDiff — binary detection', () => {
  it('flags binary content when a NUL byte is present', async () => {
    const rd = await renderDiff('hello\0world', 'hi', 'plaintext');
    expect(rd.binary).toBe(true);
    expect(rd.hunks).toEqual([]);
  });

  it('flags binary on the new side too', async () => {
    const rd = await renderDiff('hi', 'hi\0there', 'plaintext');
    expect(rd.binary).toBe(true);
  });
});

describe('renderDiff — oversize truncation', () => {
  it('sets truncated: true and emits empty html for >500KB content', async () => {
    // 600 KB of repeating text. We only vary one line so the diff stays tiny.
    const bigOld = 'line\n'.repeat(120000);
    const bigNew = bigOld.replace('line\nline\nline\n', 'line\nchanged\nline\n');
    const rd = await renderDiff(bigOld, bigNew, 'plaintext');

    expect(rd.truncated).toBe(true);
    expect(rd.binary).toBe(false);
    expect(rd.hunks.length).toBeGreaterThan(0);
    // Every line's html should be empty when truncated.
    for (const hunk of rd.hunks) {
      for (const line of hunk.lines) {
        expect(line.html).toBe('');
      }
    }
  }, 15000);
});

describe('renderDiff — unknown language falls back to plaintext', () => {
  it('still produces a valid diff', async () => {
    const oldCode = 'a\nb\nc\n';
    const newCode = 'a\nb2\nc\n';
    const rd = await renderDiff(oldCode, newCode, 'plaintext');
    expect(rd.language).toBe('plaintext');
    expect(rd.hunks.length).toBe(1);
    const del = rd.hunks[0].lines.find((l) => l.kind === 'del');
    const add = rd.hunks[0].lines.find((l) => l.kind === 'add');
    expect(del).toBeDefined();
    expect(add).toBeDefined();
  });
});

describe('renderDiff — pure addition (empty old)', () => {
  it('produces a single hunk with only add lines', async () => {
    const rd = await renderDiff('', 'line1\nline2\nline3\n', 'plaintext');
    expect(rd.hunks.length).toBe(1);
    const kinds = new Set(rd.hunks[0].lines.map((l) => l.kind));
    expect(kinds.has('add')).toBe(true);
    expect(kinds.has('del')).toBe(false);
    expect(rd.hunks[0].lines.filter((l) => l.kind === 'add').length).toBe(3);
  });
});

describe('renderDiff — pure deletion (empty new)', () => {
  it('produces a single hunk with only del lines', async () => {
    const rd = await renderDiff('line1\nline2\nline3\n', '', 'plaintext');
    expect(rd.hunks.length).toBe(1);
    const kinds = new Set(rd.hunks[0].lines.map((l) => l.kind));
    expect(kinds.has('del')).toBe(true);
    expect(kinds.has('add')).toBe(false);
    expect(rd.hunks[0].lines.filter((l) => l.kind === 'del').length).toBe(3);
  });
});

describe('renderDiff — identical content', () => {
  it('produces zero hunks', async () => {
    const rd = await renderDiff('same\ntext\n', 'same\ntext\n', 'plaintext');
    expect(rd.hunks).toEqual([]);
    expect(rd.binary).toBe(false);
    expect(rd.truncated).toBe(false);
  });
});

describe('renderDiff — line numbering', () => {
  it('assigns sequential 1-based line numbers', async () => {
    const oldCode = 'a\nb\nc\nd\ne\n';
    const newCode = 'a\nB\nc\nd\ne\n';
    const rd = await renderDiff(oldCode, newCode, 'plaintext');
    const firstCtx = rd.hunks[0].lines.find((l) => l.kind === 'ctx');
    expect(firstCtx?.oldLine).toBe(1);
    expect(firstCtx?.newLine).toBe(1);

    const del = rd.hunks[0].lines.find((l) => l.kind === 'del');
    expect(del?.oldLine).toBe(2);
    expect(del?.newLine).toBeNull();

    const add = rd.hunks[0].lines.find((l) => l.kind === 'add');
    expect(add?.newLine).toBe(2);
    expect(add?.oldLine).toBeNull();
  });
});
