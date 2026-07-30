/**
 * BaseCommand Structure
 *
 * All slash and prefix commands extend this class.
 */

export class BaseCommand {
  /**
   * @param {CommandOptions} options
   */
  constructor(options = {}) {
    /** @type {string} - Command name */
    this.name = options.name ?? 'unnamed';

    /** @type {string} - Human-readable description */
    this.description = options.description ?? 'No description provided.';

    /** @type {'slash'|'prefix'} - Command type */
    this.type = options.type ?? 'prefix';

    /** @type {string[]} - Required user permissions */
    this.userPermissions = options.userPermissions ?? [];

    /** @type {string[]} - Required bot permissions */
    this.botPermissions = options.botPermissions ?? [];

    /** @type {number} - Cooldown in seconds */
    this.cooldown = options.cooldown ?? 3;

    /** @type {boolean} - Whether the command is owner-only */
    this.ownerOnly = options.ownerOnly ?? false;

    /** @type {boolean} - Whether the command is guild-only */
    this.guildOnly = options.guildOnly ?? true;

    /** @type {Object|null} - discord.js SlashCommandBuilder data (for slash commands) */
    this.data = options.data ?? null;
  }

  /**
   * Execute the command.
   * @param {import('discord.js').Client} client
   * @param {import('discord.js').Message|import('discord.js').ChatInputCommandInteraction} ctx
   * @param {string[]} [args]
   * @returns {Promise<void>}
   */
  async execute(client, ctx, args) {
    throw new Error(`Command "${this.name}" does not implement execute().`);
  }
}
