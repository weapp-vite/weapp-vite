---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 `dev -o`、`open`、`build -o` 和 `ide --open` 增加微信开发者工具自动恢复：当打开后项目索引刷新或自动化会话准备失败时，默认自动关闭并重开一次目标项目，并提供 `--no-open-recovery` 与 `WEAPP_VITE_DISABLE_IDE_OPEN_RECOVERY=1` 用于禁用该行为。
