/**
 * BaseEvent Structure
 *
 * All event handlers extend this class.
 */

export class BaseEvent {
  /**
   * @param {EventOptions} options
   */
  constructor(options = {}) {
    /** @type {string} - discord.js event name (e.g. 'ready', 'messageCreate') */
    this.name = options.name ?? 'unnamed';

    /** @type {boolean} - Whether this handler fires only once */
    this.once = options.once ?? false;
  }

  /**
   * Handle the event.
   * @param {import('discord.js').Client} client
   * @param {...any} args - Event arguments passed by discord.js
   * @returns {Promise<void>}
   */
  async execute(client, ...args) {
    throw new Error(`Event "${this.name}" does not implement execute().`);
  }
}
