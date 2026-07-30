/**
 * Shared Setup Engine — Config Migration
 *
 * Handles automatic migration of persisted guild configs when configVersion
 * changes across updates.  Each migration is a pure function that receives
 * the old config and returns the updated one; the version stamp is applied
 * automatically by `migrate()`.
 *
 * To add a migration from vN-1 → vN:
 *   MIGRATIONS.set(N, (cfg) => { /* return new shape *\/ });
 *   Update CURRENT_VERSION.
 */

/** @type {number} Bump this when adding a new migration step. */
export const CURRENT_VERSION = 1;

/**
 * Map<targetVersion, migrationFn>
 * Key = version the migration produces.
 * Value = (cfg: object) => object — must return a new object (pure).
 */
const MIGRATIONS = new Map([
  // v0 → v1: initial schema — nothing to migrate, just stamp the version.
  [1, (cfg) => cfg],
]);

/**
 * Apply all pending migrations to a config object.
 *
 * @param {object} config   - Raw parsed JSON from disk (may lack configVersion)
 * @returns {object}         - Migrated config (configVersion = CURRENT_VERSION)
 */
export function migrate(config) {
  const from = config.configVersion ?? 0;

  if (from >= CURRENT_VERSION) return config; // already up to date

  let current = { ...config };

  for (let v = from + 1; v <= CURRENT_VERSION; v++) {
    const fn = MIGRATIONS.get(v);
    if (fn) {
      current = fn(current);
    }
    current = { ...current, configVersion: v };
  }

  return current;
}
