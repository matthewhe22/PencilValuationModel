/**
 * Schema migrations. Every stored valuation document carries schemaVersion;
 * loaders pass documents through migrateInputs() so older documents keep
 * working as the schema evolves (and so the v2 backend can share the exact
 * same migration path).
 */
import { SCHEMA_VERSION, defaultInputs } from './defaults';
import type { ValuationInputs } from './types';

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** Registry keyed by the version the migration upgrades FROM. */
const MIGRATIONS: Record<number, Migration> = {
  // Example for v2 development:
  // 1: (doc) => ({ ...doc, schemaVersion: 2, newField: defaultValue }),
};

export function migrateInputs(raw: unknown): ValuationInputs {
  if (raw == null || typeof raw !== 'object') return defaultInputs();
  let doc = raw as Record<string, unknown>;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    doc = step(doc);
    version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : version + 1;
  }
  // Merge over defaults so newly-added optional fields are always present.
  const defaults = defaultInputs();
  return deepMerge(defaults as unknown as Record<string, unknown>, doc) as unknown as ValuationInputs;
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const b = out[k];
    if (Array.isArray(v)) out[k] = v;
    else if (v && typeof v === 'object' && b && typeof b === 'object' && !Array.isArray(b))
      out[k] = deepMerge(b as Record<string, unknown>, v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}
