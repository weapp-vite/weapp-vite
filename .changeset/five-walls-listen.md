---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `wv dev` 开发快捷键在部分终端与 `pnpm` TTY 代理场景下按键无响应的问题。现在会同时监听 `keypress` 与原始 `data` 输入，并对同一按键的重复事件做最小范围去重，使 `h`、`s`、`m`、`q` 及 `Ctrl+C` / `Ctrl+Z` 在更多终端环境下都能稳定生效。
