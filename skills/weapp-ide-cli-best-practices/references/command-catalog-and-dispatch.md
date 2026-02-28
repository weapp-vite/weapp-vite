# weapp-ide-cli Command Catalog And Dispatch

## Objective

Use one source of truth for CLI command support and expose it for upstream delegators.

## Recommended structure

In `packages/weapp-ide-cli/src/cli/command-catalog.ts`:

- `WECHAT_CLI_COMMAND_NAMES`
- `AUTOMATOR_COMMAND_NAMES` (imported from automator module)
- `MINIDEV_NAMESPACE_COMMAND_NAMES`
- `CONFIG_COMMAND_NAME`
- `WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES` (merged list)
- `isWeappIdeTopLevelCommand(command)`

## Dispatch sequence in weapp-ide-cli

1. Parse locale option and configure locale.
2. Route minidev namespace commands.
3. Route automator commands.
4. Handle `help` for automator commands.
5. Handle `config` commands.
6. Run official WeChat CLI passthrough with validation.

## Dispatch sequence in upstream CLIs

For `weapp-vite` or other wrappers:

1. Run wrapper-native commands first.
2. Delegate only if command hits `isWeappIdeTopLevelCommand`.
3. Do not delegate unknown commands blindly.

## Test matrix

- Catalog contains all command groups.
- `isWeappIdeTopLevelCommand` returns true for known commands.
- Upstream wrapper does not delegate native commands.
- Upstream wrapper delegates cataloged commands.
- Upstream wrapper rejects unknown commands.
