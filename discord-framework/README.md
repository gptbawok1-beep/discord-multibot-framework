# Discord Multi-Bot Framework

A clean, scalable Discord Multi-Bot Framework built with **Node.js 22 LTS**, **JavaScript ESM**, and **discord.js v14**.

Supports **2 Discord bots** running from a single project with fully isolated commands and events, while sharing one set of core infrastructure.

---

## Features

- ✅ **2 independent bots** — each with its own token, prefix, commands, and events
- ✅ **Shared core** — logger, config, handlers, utils, structures, services (written once, used by both)
- ✅ **Auto-load commands** — drop a file in the commands folder, it loads automatically
- ✅ **Auto-load events** — same for events
- ✅ **Slash command handler** — with cooldown, permissions, and error handling
- ✅ **Prefix command handler** — with cooldown, permissions, and error handling
- ✅ **Cooldown system** — per-user, per-command, auto-cleans memory
- ✅ **Permission checker** — user and bot permission validation
- ✅ **Embed helper** — success, error, warning, info presets
- ✅ **Error handler** — centralized, replies to user on command failure
- ✅ **Colored logger** — clearly shows BOT1 / BOT2 source with timestamps
- ✅ **Clean Code** — ESM, async/await, SOLID, DRY, KISS

---

## Project Structure

```
discord-framework/
├── bots/
│   ├── bot1/
│   │   ├── commands/
│   │   │   ├── slash/          # Bot 1 slash commands
│   │   │   └── prefix/         # Bot 1 prefix commands
│   │   ├── events/             # Bot 1 events
│   │   ├── config/             # Bot 1 config (reads from .env)
│   │   ├── deploy-commands.js  # Register slash commands for Bot 1
│   │   └── index.js            # Bot 1 entry point
│   └── bot2/
│       ├── commands/
│       │   ├── slash/          # Bot 2 slash commands
│       │   └── prefix/         # Bot 2 prefix commands
│       ├── events/             # Bot 2 events
│       ├── config/             # Bot 2 config (reads from .env)
│       ├── deploy-commands.js  # Register slash commands for Bot 2
│       └── index.js            # Bot 2 entry point
│
├── shared/
│   ├── handlers/
│   │   ├── commandHandler.js   # Auto-load commands
│   │   ├── eventHandler.js     # Auto-load events
│   │   ├── slashHandler.js     # Slash command routing
│   │   └── prefixHandler.js    # Prefix command routing
│   ├── services/               # Shared services (add as needed)
│   ├── utils/
│   │   ├── cooldown.js         # Per-user cooldown management
│   │   ├── dynamicImport.js    # Runtime file import utility
│   │   ├── embed.js            # Embed builder helpers
│   │   ├── errorHandler.js     # Centralized error handling
│   │   └── permission.js       # User & bot permission checks
│   ├── structures/
│   │   ├── BaseCommand.js      # All commands extend this
│   │   └── BaseEvent.js        # All events extend this
│   ├── logger/
│   │   └── index.js            # Shared colored logger
│   └── config/
│       └── index.js            # Shared env config loader
│
├── assets/                     # Static assets (images, etc.)
├── logs/                       # Log files (auto-created)
├── index.js                    # Runs both bots simultaneously
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── LICENSE
```

---

## Setup

### 1. Install Dependencies

```bash
cd discord-framework
npm install
# or with pnpm (if running inside this project):
# pnpm install (run from discord-framework/)
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your bot tokens:

```bash
cp .env.example .env
```

```env
BOT1_TOKEN=your_bot1_token_here
BOT1_CLIENT_ID=your_bot1_client_id_here
BOT1_PREFIX=!

BOT2_TOKEN=your_bot2_token_here
BOT2_CLIENT_ID=your_bot2_client_id_here
BOT2_PREFIX=?
```

### 3. Register Slash Commands

```bash
# Register Bot 1 slash commands (guild, instant):
GUILD_ID=your_guild_id node bots/bot1/deploy-commands.js

# Register Bot 2 slash commands (guild, instant):
GUILD_ID=your_guild_id node bots/bot2/deploy-commands.js

# Or register globally (takes ~1 hour to propagate):
node bots/bot1/deploy-commands.js
node bots/bot2/deploy-commands.js
```

### 4. Start the Bots

```bash
# Run both bots at once:
node index.js

# Run only Bot 1:
node bots/bot1/index.js

# Run only Bot 2:
node bots/bot2/index.js
```

---

## Adding Commands

### Slash Command

Create a new file in `bots/bot1/commands/slash/` (or `bot2`):

```js
import { SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';

export default class HelloCommand extends BaseCommand {
  constructor() {
    super({
      name: 'hello',
      description: 'Says hello.',
      type: 'slash',
      cooldown: 5,
      data: new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Says hello.'),
    });
  }

  async execute(client, interaction) {
    await interaction.reply('Hello, world!');
  }
}
```

### Prefix Command

Create a new file in `bots/bot1/commands/prefix/` (or `bot2`):

```js
import { BaseCommand } from '../../../../shared/structures/index.js';

export default class HelloCommand extends BaseCommand {
  constructor() {
    super({
      name: 'hello',
      description: 'Says hello.',
      type: 'prefix',
      cooldown: 5,
    });
  }

  async execute(client, message, args) {
    await message.reply('Hello, world!');
  }
}
```

---

## Adding Events

Create a new file in `bots/bot1/events/` (or `bot2`):

```js
import { BaseEvent } from '../../../shared/structures/index.js';

export default class GuildMemberAddEvent extends BaseEvent {
  constructor() {
    super({ name: 'guildMemberAdd', once: false });
  }

  async execute(client, member) {
    // Handle new member
  }
}
```

---

## Logger

The shared logger shows which bot a log came from:

```js
import { createLogger } from '../../shared/logger/index.js';

const logger = createLogger('BOT1'); // or 'BOT2' or null for system

logger.info('Bot is starting...');
logger.success('Logged in!');
logger.warn('Something looks off.');
logger.error('Something broke.');
logger.debug('Detailed debug info.');
```

Output:
```
[12:34:56] [INFO   ] [BOT1] Bot is starting...
[12:34:57] [SUCCESS] [BOT1] Logged in as MyBot#1234 (ID: 123456789)
```

---

## License

MIT
