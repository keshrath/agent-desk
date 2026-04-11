// Diff renderer — produces RenderedDiff payloads with pre-highlighted HTML
// hunks for the read-only diff viewer (task #93c).
//
// Strategy:
// 1. Detect binary content (any NUL byte in either side → binary: true,
//    hunks: []).
// 2. If either side exceeds MAX_HIGHLIGHT_BYTES we still compute a structural
//    diff but skip Shiki highlighting — hunks carry empty html strings and
//    truncated: true. The UI renders plain text via textContent in that case.
// 3. Otherwise lazy-init a Shiki singleton, highlight the old and new sides
//    line-by-line (one <span>-wrapped line per source line), then walk the
//    `diffLines` structured result and zip in the pre-highlighted HTML to
//    build DiffHunk records with context / add / del kinds.
//
// Shiki is loaded via dynamic import so test environments can mock it via
// vi.mock('shiki', ...) without paying the real grammar cost.

import type { DiffHunk, DiffHunkLine, DiffLineKind, RenderedDiff } from './transport/channels.js';

const MAX_HIGHLIGHT_BYTES = 500 * 1024;
const CONTEXT_LINES = 3;

/**
 * Languages loaded on first highlighter init. Anything else falls back to
 * 'plaintext'. Keep this list modest — every extra grammar adds ~50-200 KB.
 */
const BUNDLED_LANGS = [
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'shellscript',
  'bash',
  'json',
  'yaml',
  'toml',
  'markdown',
  'html',
  'css',
  'sql',
] as const;

const THEMES = ['github-dark', 'github-light'] as const;
const DEFAULT_THEME = 'github-dark';

// Matches Shiki's public Highlighter interface — we only use codeToHtml.
interface ShikiHighlighter {
  codeToHtml(code: string, options: { lang: string; theme: string }): string;
  getLoadedLanguages?: () => string[];
}

let highlighterPromise: Promise<ShikiHighlighter | null> | null = null;

/**
 * Eagerly initialize the Shiki singleton. Called at most once per process;
 * subsequent calls reuse the same promise. Resolves to `null` if Shiki fails
 * to load (tests/environments without it) — callers fall back to plain text.
 */
export function initHighlighter(): Promise<ShikiHighlighter | null> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      try {
        const shiki = (await import('shiki')) as unknown as {
          createHighlighter: (opts: {
            themes: readonly string[];
            langs: readonly string[];
          }) => Promise<ShikiHighlighter>;
        };
        return await shiki.createHighlighter({
          themes: THEMES,
          langs: BUNDLED_LANGS as unknown as readonly string[],
        });
      } catch {
        return null;
      }
    })();
  }
  return highlighterPromise;
}

/** Test helper — resets the singleton between test cases. */
export function __resetHighlighterForTests(): void {
  highlighterPromise = null;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXT_MAP: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  pyi: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'shellscript',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  sql: 'sql',
};

/**
 * Map a file path to a Shiki language id. Falls back to 'plaintext' for
 * unknown extensions. Exported so the UI and handlers can share the same
 * table.
 */
export function detectLanguage(filePath: string): string {
  if (!filePath) return 'plaintext';
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_MAP[ext] ?? 'plaintext';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function isBinary(s: string): boolean {
  // UTF-16 strings in JS; we only look for U+0000, which never appears in
  // well-formed text files and is the canonical binary sentinel.
  if (!s) return false;
  const sample = s.length > 8192 ? s.slice(0, 8192) : s;
  return sample.indexOf('\0') !== -1;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Split a Shiki-rendered HTML blob into one HTML fragment per source line.
 * Shiki wraps the whole file in `<pre ...><code>...<span class="line">...</span>...</code></pre>`;
 * we want just the inner `<span class="line">...</span>` fragments so the
 * diff viewer can compose them into hunks with its own gutter markup.
 *
 * If Shiki's output shape ever changes, this falls back to a plain textContent
 * split so the caller still sees N lines.
 */
function extractShikiLines(html: string, lineCount: number): string[] {
  const lineRe = /<span class="line">([\s\S]*?)<\/span>(?=\n|<\/code>)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(html)) !== null) {
    out.push(m[1] ?? '');
  }
  if (out.length >= lineCount) return out.slice(0, lineCount);
  // Fallback: pad with blanks so indices stay aligned with the source.
  while (out.length < lineCount) out.push('');
  return out;
}

/**
 * Highlight a whole file side with Shiki once, then split by source line.
 * Returns one pre-highlighted HTML fragment per line. If Shiki is unavailable
 * or the language is unknown, returns escaped plain text per line.
 */
async function highlightLines(content: string, lang: string, highlighter: ShikiHighlighter | null): Promise<string[]> {
  const sourceLines = content.split('\n');
  // `split('\n')` yields an extra empty element when the content ends in a
  // newline — drop it to match how `diffLines` reports line counts.
  if (sourceLines.length > 0 && sourceLines[sourceLines.length - 1] === '' && content.endsWith('\n')) {
    sourceLines.pop();
  }
  const lineCount = sourceLines.length;

  if (!highlighter || lang === 'plaintext') {
    return sourceLines.map(escapeHtml);
  }

  const loaded = highlighter.getLoadedLanguages?.() ?? [];
  const resolvedLang = loaded.length === 0 || loaded.includes(lang) ? lang : 'plaintext';
  try {
    const html = highlighter.codeToHtml(content, { lang: resolvedLang, theme: DEFAULT_THEME });
    const extracted = extractShikiLines(html, lineCount);
    if (extracted.length === lineCount) return extracted;
    return sourceLines.map(escapeHtml);
  } catch {
    return sourceLines.map(escapeHtml);
  }
}

interface TaggedLine {
  kind: DiffLineKind;
  oldLine: number | null;
  newLine: number | null;
  html: string;
  text: string;
}

/**
 * Walk both sides line-by-line using a simple equal/insert/delete LCS-style
 * algorithm derived from the `diff` package's `diffLines` output. Returns a
 * flat list of tagged lines carrying their pre-highlighted HTML and 1-based
 * source line numbers.
 */
function buildTaggedLines(
  oldLines: string[],
  newLines: string[],
  oldHtml: string[],
  newHtml: string[],
  parts: Array<{ added?: boolean; removed?: boolean; value: string; count?: number }>,
): TaggedLine[] {
  const tagged: TaggedLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  for (const part of parts) {
    const raw = part.value;
    const chunkLines = raw.split('\n');
    // A trailing newline produces an empty tail; drop it so line counts match.
    if (chunkLines.length > 0 && chunkLines[chunkLines.length - 1] === '' && raw.endsWith('\n')) {
      chunkLines.pop();
    }
    if (chunkLines.length === 0) continue;

    if (part.added) {
      for (const text of chunkLines) {
        tagged.push({
          kind: 'add',
          oldLine: null,
          newLine: newIdx + 1,
          html: newHtml[newIdx] ?? escapeHtml(text),
          text,
        });
        newIdx++;
      }
    } else if (part.removed) {
      for (const text of chunkLines) {
        tagged.push({
          kind: 'del',
          oldLine: oldIdx + 1,
          newLine: null,
          html: oldHtml[oldIdx] ?? escapeHtml(text),
          text,
        });
        oldIdx++;
      }
    } else {
      for (const text of chunkLines) {
        tagged.push({
          kind: 'ctx',
          oldLine: oldIdx + 1,
          newLine: newIdx + 1,
          html: newHtml[newIdx] ?? oldHtml[oldIdx] ?? escapeHtml(text),
          text,
        });
        oldIdx++;
        newIdx++;
      }
    }
  }

  // Reference oldLines/newLines to silence unused-var linting — they anchor
  // the algorithm conceptually even when not indexed directly.
  void oldLines;
  void newLines;

  return tagged;
}

/**
 * Collapse a tagged-line sequence into unified-diff hunks, keeping up to
 * CONTEXT_LINES of context around each change. Pure context runs longer than
 * 2 * CONTEXT_LINES are split into separate hunks (classic unified-diff
 * behavior).
 */
function collapseToHunks(tagged: TaggedLine[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const n = tagged.length;
  let i = 0;

  // Precompute indices of changed lines for fast scanning.
  const changed: number[] = [];
  for (let j = 0; j < n; j++) {
    if (tagged[j].kind !== 'ctx') changed.push(j);
  }
  if (changed.length === 0) return hunks;

  while (i < changed.length) {
    // Seed the hunk at changed[i], greedily extend while the next change is
    // within 2 * CONTEXT_LINES context lines away.
    const start = changed[i];
    let end = changed[i];
    let k = i;
    while (k + 1 < changed.length && changed[k + 1] - end <= 2 * CONTEXT_LINES + 1) {
      k++;
      end = changed[k];
    }

    const hunkStart = Math.max(0, start - CONTEXT_LINES);
    const hunkEnd = Math.min(n - 1, end + CONTEXT_LINES);

    const lines: DiffHunkLine[] = [];
    let oldStart = 0;
    let newStart = 0;
    let oldCount = 0;
    let newCount = 0;

    for (let j = hunkStart; j <= hunkEnd; j++) {
      const tl = tagged[j];
      lines.push({
        kind: tl.kind,
        oldLine: tl.oldLine,
        newLine: tl.newLine,
        html: tl.html,
      });
      if (tl.oldLine !== null) {
        if (oldStart === 0) oldStart = tl.oldLine;
        oldCount++;
      }
      if (tl.newLine !== null) {
        if (newStart === 0) newStart = tl.newLine;
        newCount++;
      }
    }

    hunks.push({
      oldStart: oldStart || 1,
      oldLines: oldCount,
      newStart: newStart || 1,
      newLines: newCount,
      lines,
    });

    i = k + 1;
  }

  return hunks;
}

/**
 * Render a two-side diff into a RenderedDiff payload with pre-highlighted
 * HTML hunks. The UI injects the `html` strings verbatim via innerHTML, so
 * nothing in this function is allowed to produce untrusted markup — Shiki's
 * output is trusted; every plain-text fallback runs through escapeHtml first.
 */
export async function renderDiff(
  oldContent: string,
  newContent: string,
  language: string = 'plaintext',
): Promise<RenderedDiff> {
  const lang = language || 'plaintext';

  if (isBinary(oldContent) || isBinary(newContent)) {
    return { language: lang, hunks: [], truncated: false, binary: true };
  }

  const oldSize = Buffer.byteLength(oldContent, 'utf8');
  const newSize = Buffer.byteLength(newContent, 'utf8');
  const truncated = oldSize > MAX_HIGHLIGHT_BYTES || newSize > MAX_HIGHLIGHT_BYTES;

  // Dynamic import of `diff` — same ESM pattern we use for shiki so tests can
  // stub it if they need to.
  const diffPkg = (await import('diff')) as unknown as {
    diffLines: (a: string, b: string) => Array<{ added?: boolean; removed?: boolean; value: string; count?: number }>;
  };

  const parts = diffPkg.diffLines(oldContent, newContent);

  const oldLines = oldContent.split('\n');
  if (oldLines.length > 0 && oldLines[oldLines.length - 1] === '' && oldContent.endsWith('\n')) oldLines.pop();
  const newLines = newContent.split('\n');
  if (newLines.length > 0 && newLines[newLines.length - 1] === '' && newContent.endsWith('\n')) newLines.pop();

  let oldHtml: string[];
  let newHtml: string[];

  if (truncated) {
    // Skip shiki entirely — produce hunks with empty html so the UI renders
    // plain text via textContent. This keeps memory bounded on huge files.
    oldHtml = new Array<string>(oldLines.length).fill('');
    newHtml = new Array<string>(newLines.length).fill('');
  } else {
    const highlighter = await initHighlighter();
    [oldHtml, newHtml] = await Promise.all([
      highlightLines(oldContent, lang, highlighter),
      highlightLines(newContent, lang, highlighter),
    ]);
  }

  const tagged = buildTaggedLines(oldLines, newLines, oldHtml, newHtml, parts);
  const hunks = collapseToHunks(tagged);

  return { language: lang, hunks, truncated, binary: false };
}
