# IDE I18n And Config Playbook

## 语言策略

- 默认中文：`zh`
- 英文兜底：`en`
- 支持 `--lang` 临时覆盖
- 支持配置文件持久化

## 常见配置字段

- `cliPath`
- `locale`

## `config` 子命令稳定面

- `config show`
- `config get <key>`
- `config set <key> <value>`
- `config unset <key>`
- `config doctor`
- `config export [path]`
- `config import <path>`

## 校验

- locale 严格限定在 `zh|en`
- 导入 payload 严格校验结构
- 用户提示保持中文优先
