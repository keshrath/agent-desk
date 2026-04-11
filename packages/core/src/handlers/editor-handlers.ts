// External-editor handoff — vscode://file handoff to VS Code / Cursor / etc.
// (task #93d).
//
// Real implementation replacing the Phase-1 bootstrap stub. Detection and
// spawning live in ../external-editor.ts so the tests can exercise them
// directly without a router round-trip.

import type { RequestHandlers } from '../transport/router.js';
import { detectEditors, openFile } from '../external-editor.js';

export function buildEditorHandlers(): Pick<RequestHandlers, 'editor:detect' | 'editor:open'> {
  return {
    'editor:detect': () => detectEditors(),
    'editor:open': (editorId, filePath, line, col) => openFile(editorId, filePath, line, col),
  };
}
