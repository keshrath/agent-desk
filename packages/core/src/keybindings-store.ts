// Keybinding overrides: ~/.agent-desk/keybindings.json
// Plain JSON map of action name → key binding string (or null to disable).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { userData } from './platform/paths.js';

export const KEYBINDINGS_FILE = userData('keybindings.json');

function ensureDir(): void {
  const dir = dirname(KEYBINDINGS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readKeybindings(): Record<string, string | null> {
  ensureDir();
  if (!existsSync(KEYBINDINGS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(KEYBINDINGS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeKeybindings(data: Record<string, string | null>): boolean {
  ensureDir();
  writeFileSync(KEYBINDINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}
