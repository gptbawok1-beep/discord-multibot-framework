/**
 * Boombox — Monitoring (Placeholder)
 *
 * Tracks real-time health state of each subsystem.
 * Phase 2: hook into actual queue/worker/uploader events and surface
 *          via /bawok → Boombox → Status panel.
 */

/**
 * @typedef {'ok'|'degraded'|'error'|'idle'} HealthStatus
 */

class MonitoringManager {
  constructor() {
    /** @type {Record<string, { status: HealthStatus, detail: string, updatedAt: number }>} */
    this._state = {
      queue:    { status: 'idle', detail: 'Not started',       updatedAt: Date.now() },
      worker:   { status: 'idle', detail: 'Not started',       updatedAt: Date.now() },
      cache:    { status: 'ok',   detail: 'In-memory ready',   updatedAt: Date.now() },
      uploader: { status: 'idle', detail: 'Not implemented',   updatedAt: Date.now() },
      database: { status: 'ok',   detail: 'JSON store ready',  updatedAt: Date.now() },
      retry:    { status: 'idle', detail: 'Awaiting requests', updatedAt: Date.now() },
      error:    { status: 'ok',   detail: 'No recent errors',  updatedAt: Date.now() },
    };
  }

  /**
   * Update the status of a subsystem.
   * @param {string} subsystem
   * @param {HealthStatus} status
   * @param {string} [detail]
   */
  update(subsystem, status, detail = '') {
    if (!(subsystem in this._state)) return;
    this._state[subsystem] = { status, detail, updatedAt: Date.now() };
  }

  /**
   * Get the current health state.
   * @returns {object}
   */
  getSnapshot() {
    return Object.fromEntries(
      Object.entries(this._state).map(([k, v]) => [k, { ...v }])
    );
  }

  /**
   * Overall health: 'ok' if all subsystems are ok/idle, else 'degraded'/'error'.
   * @returns {HealthStatus}
   */
  getOverallHealth() {
    const statuses = Object.values(this._state).map((s) => s.status);
    if (statuses.includes('error'))    return 'error';
    if (statuses.includes('degraded')) return 'degraded';
    return 'ok';
  }
}

export const monitoringManager = new MonitoringManager();
