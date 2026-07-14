/**
 * Storage abstraction — the v2 seam.
 *
 * v1 ships LocalStorageAdapter. v2 adds an ApiStorageAdapter that talks to a
 * per-client backend + database with the same contract; nothing else changes.
 */
import type { ValuationInputs } from '@pencil/engine';

export interface ValuationSummary {
  id: string;
  name: string;
  updatedAt: string; // ISO datetime
}

export interface ValuationDocument {
  id: string;
  name: string;
  updatedAt: string;
  inputs: ValuationInputs;
}

export interface StorageAdapter {
  list(): Promise<ValuationSummary[]>;
  load(id: string): Promise<ValuationDocument | null>;
  save(doc: ValuationDocument): Promise<void>;
  remove(id: string): Promise<void>;
}

const INDEX_KEY = 'pencil.valuations.index';
const DOC_KEY = (id: string) => `pencil.valuations.doc.${id}`;

export class LocalStorageAdapter implements StorageAdapter {
  async list(): Promise<ValuationSummary[]> {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      const idx = raw ? (JSON.parse(raw) as ValuationSummary[]) : [];
      return idx.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return [];
    }
  }

  async load(id: string): Promise<ValuationDocument | null> {
    try {
      const raw = localStorage.getItem(DOC_KEY(id));
      return raw ? (JSON.parse(raw) as ValuationDocument) : null;
    } catch {
      return null;
    }
  }

  async save(doc: ValuationDocument): Promise<void> {
    localStorage.setItem(DOC_KEY(doc.id), JSON.stringify(doc));
    const idx = await this.list();
    const rest = idx.filter((s) => s.id !== doc.id);
    rest.unshift({ id: doc.id, name: doc.name, updatedAt: doc.updatedAt });
    localStorage.setItem(INDEX_KEY, JSON.stringify(rest));
  }

  async remove(id: string): Promise<void> {
    localStorage.removeItem(DOC_KEY(id));
    const idx = await this.list();
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx.filter((s) => s.id !== id)));
  }
}

/** Swap point: v2 replaces this with an ApiStorageAdapter(baseUrl, auth). */
export const storage: StorageAdapter = new LocalStorageAdapter();

export function newId(): string {
  return `val_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
