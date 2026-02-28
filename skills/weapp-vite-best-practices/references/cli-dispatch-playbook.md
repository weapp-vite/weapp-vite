# weapp-vite CLI Dispatch Playbook

## Goal

Unify command routing between `weapp-vite` and `weapp-ide-cli` with deterministic ownership:

1. `weapp-vite` native commands run first.
2. Only unregistered commands that exist in `weapp-ide-cli` catalog are delegated.
3. Unknown commands are not blindly delegated.

## Source of truth

- Keep top-level command catalog in `packages/weapp-ide-cli`.
- Export:
  - command arrays (official CLI, automator, config, minidev namespace)
  - `isWeappIdeTopLevelCommand(command)`
- Consume this API in `packages/weapp-vite/src/cli/ide.ts`.

## Recommended implementation pattern

```ts
// pseudo-code
if (command in weappViteNativeCommands) {
  runWeappVite()
}
else if (isWeappIdeTopLevelCommand(command)) {
  runWeappIdeCliParse()
}
else {
  showUnknownCommandError()
}
```

### Notes

- Keep `weapp-vite ide <args...>` as forced passthrough namespace.
- For `help <cmd>`:
  - native command => keep native help behavior
  - cataloged ide command => forward to `weapp-ide-cli` help

## Validation checklist

- Add unit tests for:
  - native command not forwarded
  - cataloged ide command forwarded
  - unknown command not forwarded
  - `help` dispatch for native vs ide command
- Update docs in both package README and website command docs.
- Add changeset when behavior or public command routing changes.
