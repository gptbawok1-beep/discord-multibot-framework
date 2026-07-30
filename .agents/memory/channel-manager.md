---
name: Channel Manager Plugin Implementation
description: Notes on the Channel Manager plugin for Bot 1's setup wizard, including modal flow constraints and data storage decisions.
---

## Plugin location
`discord-framework/bots/bot1/setup/plugins/channelManager.js`

## Data storage
Channel structure backups are stored inside `cfg.channelManager.backups` (array, max 5 entries) using `updateSection(guildId, 'channelManager', { backups })`. Each entry: `{ id, date, structure[] }`. Structure entries are categories (with nested channels) + orphan channels.

## Modal flow constraint
`ModalSubmitInteraction.update()` only works when `isFromMessage() === true` (i.e., modal was triggered by a button or select menu, not a slash command). Both `generate` (triggered by button) and `rename` (triggered by ChannelSelectMenu) satisfy this. If a modal were ever triggered from a slash command, `reply()` must be used instead.

**Why:** discord.js v14 only exposes `update()` on modal submits that originated from a message component.

## Custom ID pattern
All Channel Manager interactions use `setup1:channelmanager:{action}`.
Modal IDs: `setup1:modal:channelmanager:generate` and `setup1:modal:channelmanager:rename`.
The generic back button uses `setup1:channelmanager:cm_back` (cleans up all session.wizardData keys).

## Conflict resolution (Generate)
Three modes: skip (default), rename (appends -copy), replace (delete existing then create).
Parsed structure stored in `session.wizardData.generateStructure`; conflict mode in `session.wizardData.generateConflictMode`.

## Parser flexibility
Handles emoji-prefix (📂, 🔊), keyword-prefix (CATEGORY:, VOICE:, TEXT:), ALL-CAPS heuristic for categories, and plain `#channel` text. Strips bullets, numbers, extra spaces. Use `sanitizeChannelName()` only for text channels (lowercase + dashes); voice/stage names kept as-is.
