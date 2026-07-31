# Discord Multi-Bot Framework

A scalable Discord Multi-Bot Framework using Node.js 22 LTS, JavaScript ESM, and discord.js v14. Supports 2 independent Discord bots sharing one core infrastructure, with a full **Setup Wizard** system for BOT 1.

## Run & Operate

```bash
# Install dependencies
cd discord-framework && npm install

# Run both bots simultaneously
cd discord-framework && node index.js

# Run only BOT 1
cd discord-framework && node bots/bot1/index.js

# Run only BOT 2
cd discord-framework && node bots/bot2/index.js

# Register slash commands (requires GUILD_ID env var for instant guild deployment)
cd discord-framework && GUILD_ID=your_guild_id node bots/bot1/deploy-commands.js
```

## Required Environment Variables

Copy `discord-framework/.env.example` to `discord-framework/.env` and fill in:

| Variable | Description |
|---|---|
| `BOT1_TOKEN` | Discord bot token for BOT 1 |
| `BOT1_CLIENT_ID` | Discord application client ID for BOT 1 |
| `BOT1_PREFIX` | Prefix for BOT 1 (default: `!`) |
| `BOT2_TOKEN` | Discord bot token for BOT 2 |
| `BOT2_CLIENT_ID` | Discord application client ID for BOT 2 |
| `BOT2_PREFIX` | Prefix for BOT 2 (default: `?`) |

## Stack

- Node.js 22 LTS, JavaScript ESM, discord.js v14, dotenv

## Where things live

```
discord-framework/
  bots/
    bot1/
      commands/slash/setup.js     — /setup bot1 command
      events/ready.js             — startup + auto recovery
      events/interactionCreate.js — routes setup1:* interactions
      setup/
        index.js                  — BOT 1 engine instance (entry point for setup)
        config.js                 — guild config manager (persistent JSON)
        ui.js                     — UI builders pre-wired to 'setup1' prefix
        wizard.js                 — re-exports from index.js (backwards compat)
        plugins/
          index.js                — AUTO plugin loader (no manual registry)
          server.js               — Server Settings plugin
          welcome.js              — Welcome & Goodbye plugin
          takeRole.js             — Take Role wizard plugin (full feature)
          invite.js               — Invite Tracker plugin
          channelManager.js       — Channel Manager plugin
          logs.js                 — Logs plugin
          backup.js               — Backup plugin (with config backup/restore)
      features/
        takeRole/
          panelBuilder.js         — builds panel embed + components (tr1: prefix)
          handler.js              — runtime handler: button clicks, dropdown selects
      data/guilds/                — persistent guild config JSON files
                                    guilds/<guildId>.json
                                    guilds/backups/<guildId>/<timestamp>.json
  shared/
    setup/                        — SHARED SETUP ENGINE (reusable by any bot)
      index.js                    — public exports
      engine.js                   — createSetupEngine() factory
      config.js                   — createConfigManager() factory
      ui.js                       — createUIBuilders(prefix) factory
      wizard.js                   — createWizard() factory
      validation.js               — validateTextChannel, validateRole, etc.
      migration.js                — config schema migration
      recovery.js                 — createRecovery() factory (startup sequence)
```

## Architecture decisions

- **Shared Setup Engine**: `shared/setup/engine.js` exports `createSetupEngine()`. BOT 1 creates its engine in `bots/bot1/setup/index.js`. BOT 2 will create its own in `bots/bot2/setup/index.js` — no engine code duplication.
- **Auto Plugin Loader**: `bots/bot1/setup/plugins/index.js` uses `readdirSync` + dynamic `import()` with top-level await. Drop a `.js` file in the folder and it loads automatically.
- **Persistent Config**: Guild configs are JSON files in `bots/bot1/data/guilds/`. They survive restarts, re-deploys, and updates. `deepMerge(defaults, saved)` ensures new keys appear without a reset.
- **Config Versioning + Migration**: Every config has a `configVersion` field. `shared/setup/migration.js` migrates older schemas on load automatically.
- **Backup Before Reset**: `resetGuildConfig()` always creates a timestamped backup first. The Backup plugin lets owners restore any previous config.
- **Permission System**: Each plugin declares `requiredPermission: PermissionFlagsBits.X`. The wizard checks this before showing the plugin page.
- **Validation Before Save**: Channel and role saves call `validateTextChannel` / `validateRole` from `shared/setup/validation.js` before persisting, showing a clear error if validation fails.

## Giveaway System (Bot 1)

Full giveaway system built on the existing Shared Setup Engine and Persistent Config.

### Setup
`/setup bot1` → **🎉 Giveaway** to configure:
- Giveaway Manager Role (who can run giveaway commands)
- Default Giveaway Channel
- Log Channel (optional)
- Mention Role (optional — pinged when a giveaway starts)
- Auto Recovery ON/OFF
- Auto Delete ON/OFF

### Commands
| Prefix | Slash | Action |
|---|---|---|
| `!gcreate <durasi> <pemenang> <hadiah>` | `/giveaway create` | Buat giveaway |
| `!gend <id>` | `/giveaway end` | Akhiri lebih awal |
| `!greroll <id>` | `/giveaway reroll` | Pilih ulang pemenang |
| `!gcancel <id>` | `/giveaway cancel` | Batalkan |
| `!glist` | `/giveaway list` | Lihat giveaway aktif |

Valid durations: `10m` `30m` `1h` `2h` `6h` `12h` `1d` `2d` `7d`

### Files
```
bots/bot1/
  features/giveaway/
    store.js     — persistent JSON per guild  (data/giveaways/<guildId>.json)
    embed.js     — all Discord embed & component builders
    perm.js      — permission check (owner OR manager role)
    manager.js   — core logic: create/end/cancel/reroll, timers, recovery, button handlers
  setup/plugins/giveaway.js   — /setup bot1 wizard plugin (auto-loaded)
  commands/prefix/
    gcreate.js | gend.js | greroll.js | gcancel.js | glist.js
  commands/slash/giveaway.js  — /giveaway subcommand group
```

### Panel Interaction Routing
All giveaway panel buttons use `gw1:<messageId>:<action>` custom IDs.
Routed in `bots/bot1/events/interactionCreate.js` → `handleGiveawayInteraction()`.

### Persistence & Recovery
- Giveaway data: `bots/bot1/data/giveaways/<guildId>.json`
- On bot restart: `recoverGiveaways()` is called via plugin's `onRecover` hook.
- Timers are rescheduled from persistent `endsAt` timestamps.
- Giveaways past their end time are ended automatically on recovery.

## User preferences

- Language: Bahasa Indonesia for UI strings in Discord embeds, English for code comments.
- Keep existing project structure — don't restructure or migrate to different tooling.
- Setup Engine must be a reusable Shared Engine so BOT 2 can use it later without rewriting.

## Gotchas

- Discord tokens go in `discord-framework/.env` (NOT the root `.env`). Never commit real tokens.
- BOT 1 data dir: `discord-framework/bots/bot1/data/guilds/`. Create this manually or let the bot create it on first save.
- Plugin `order` field controls dropdown sort order (lower = shown first).
- The `setup1:` custom ID prefix is what identifies BOT 1's interactions. BOT 2 should use `setup2:`.
- Top-level `await` is used in `bots/bot1/setup/plugins/index.js` for dynamic imports — valid in ESM modules.
