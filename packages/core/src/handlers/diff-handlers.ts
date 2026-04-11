// Diff handlers — Shiki-highlighted read-only diff renderer (task #93c).
//
// Implemented by the #93c subagent. The actual rendering logic lives in
// ../diff-renderer.ts so it can be unit-tested without spinning up a router.

import type { RequestHandlers } from '../transport/router.js';
import { renderDiff } from '../diff-renderer.js';

export function buildDiffHandlers(): Pick<RequestHandlers, 'diff:render'> {
  return {
    'diff:render': (oldContent, newContent, language) =>
      renderDiff(oldContent ?? '', newContent ?? '', language ?? 'plaintext'),
  };
}
