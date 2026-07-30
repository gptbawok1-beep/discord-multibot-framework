/**
 * Shared Setup Engine — Recovery Manager
 *
 * createRecovery({ configManager, getPlugins, logger })
 *
 * Runs the full startup/recovery sequence on bot ready:
 *
 *   1. Load Environment       (handled before this is called)
 *   2. Load Shared Core       (handled before this is called)
 *   3. Auto Load Plugins      (handled before this is called)
 *   4. Load Guild Config      ← recoverGuild()
 *   5. Validate Config        ← recoverGuild()
 *   6. Restore Runtime        ← plugin.onRecover() if defined
 *   7. Bot Ready log          ← recoverAll()
 *
 * If one guild or one plugin fails recovery, the rest continue.
 * A single plugin failure never prevents the bot from starting.
 */

/**
 * @param {object}   options
 * @param {object}   options.configManager  - from createConfigManager()
 * @param {Function} options.getPlugins     - () => Plugin[]
 * @param {object}   options.logger         - logger with .info() / .warn() / .error()
 */
export function createRecovery({ configManager, getPlugins, logger }) {
  const { loadGuildConfig } = configManager;

  // ── Single guild recovery ────────────────────────────────────────────────

  /**
   * Recover all plugin state for a single guild.
   *
   * @param {import('discord.js').Guild} guild
   */
  async function recoverGuild(guild) {
    const guildId = guild.id;

    // Step 4: Load Guild Config (auto-migrates on load)
    const config = await loadGuildConfig(guildId);

    // Step 5-6: Notify each plugin (validate + restore runtime)
    const plugins = getPlugins();
    for (const plugin of plugins) {
      if (typeof plugin.onRecover !== 'function') continue;
      try {
        await plugin.onRecover(guild, config);
      } catch (err) {
        logger.warn(
          `[Recovery] Plugin "${plugin.id}" failed for guild ${guildId}: ${err.message}`
        );
        // Continue — one plugin failure must not stop the rest
      }
    }
  }

  // ── All guilds recovery ──────────────────────────────────────────────────

  /**
   * Run recovery for every guild the bot is currently in.
   * Called from the 'ready' event.
   *
   * @param {import('discord.js').Client} client
   */
  async function recoverAll(client) {
    logger.info(`[Recovery] Starting recovery for ${client.guilds.cache.size} guild(s)...`);

    let succeeded = 0;
    let failed = 0;

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        await recoverGuild(guild);
        succeeded++;
      } catch (err) {
        failed++;
        logger.warn(`[Recovery] Guild ${guildId} failed: ${err.message}`);
      }
    }

    const status = failed === 0
      ? `✅ all ${succeeded} guild(s) recovered successfully`
      : `⚠️ ${succeeded} succeeded, ${failed} failed`;

    logger.info(`[Recovery] Complete — ${status}.`);
  }

  return { recoverGuild, recoverAll };
}
