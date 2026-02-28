# weapp-ide-cli i18n And Config Playbook

## Language policy

- Default language: Chinese (`zh`).
- Optional English (`en`) fallback.
- Allow temporary command-level override via `--lang`.
- Allow persistent override via config file and config command.

## Config persistence

Persist to:

- macOS/Linux: `~/.weapp-ide-cli/config.json`
- Windows: `C:\Users\<username>\.weapp-ide-cli\config.json`

Typical keys:

- `cliPath`
- `locale`

## Config command expectations

Supported operations should remain stable:

- `config`
- `config lang <zh|en>`
- `config set-lang <zh|en>`
- `config show`
- `config get <cliPath|locale>`
- `config set <cliPath|locale> <value>`
- `config unset <cliPath|locale>`
- `config doctor`
- `config export [path]`
- `config import <path>`

## Validation guidance

- Validate locale values strictly (`zh|en`).
- Validate imported config payload shape.
- Return Chinese-first user-facing errors with i18n fallback.
