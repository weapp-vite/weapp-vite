# weapp-ide-cli i18n And Config Playbook

## 语言策略

- 默认中文：`zh`
- 英文兜底：`en`
- 支持 `--lang` 做临时覆盖
- 支持配置文件做持久覆盖

## 配置落盘

- macOS/Linux：`~/.weapp-ide-cli/config.json`
- Windows：`C:\Users\<username>\.weapp-ide-cli\config.json`

常见字段：

- `cliPath`
- `locale`

## `config` 命令预期

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

## 校验要点

- 严格校验 locale 值：`zh|en`
- 严格校验导入配置结构
- 用户提示保持中文优先，英文兜底
