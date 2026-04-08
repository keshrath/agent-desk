// Command history persistence (F13): ~/.agent-desk/history.json
// Capped at HISTORY_MAX entries with debounced disk writes.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { userData } from './platform/paths.js';
import type { HistoryEntry } from './terminal-manager.js';

export const HISTORY_FILE = userData('history.json');
const HISTORY_MAX = 10_000;

function ensureDir(): void {
  const dir = dirname(HISTORY_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  load(): void {
    if (!existsSync(HISTORY_FILE)) return;
    try {
      const parsed = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
      this.entries = Array.isArray(parsed) ? parsed : [];
      if (this.entries.length > HISTORY_MAX) {
        this.entries = this.entries.slice(-HISTORY_MAX);
      }
    } catch {
      this.entries = [];
    }
  }

  save(): void {
    ensureDir();
    try {
      writeFileSync(HISTORY_FILE, JSON.stringify(this.entries), 'utf-8');
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  }

  private debouncedSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 2000);
  }

  add(entry: HistoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > HISTORY_MAX) {
      this.entries = this.entries.slice(-HISTORY_MAX);
    }
    this.debouncedSave();
  }

  clear(): boolean {
    this.entries = [];
    this.save();
    return true;
  }

  get(limit?: number, search?: string): HistoryEntry[] {
    let results = this.entries;
    if (search) {
      const q = search.toLowerCase();
      results = results.filter((e) => e.command.toLowerCase().includes(q));
    }
    const reversed = results.slice().reverse();
    if (limit && limit > 0) {
      return reversed.slice(0, limit);
    }
    return reversed;
  }
}
