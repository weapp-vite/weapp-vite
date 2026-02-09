---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: weapp-vite open 场景在微信登录失效时增加友好提示与按键重试。

- `weapp-vite dev -o` / `weapp-vite open` 调用 IDE 时，命中 `code: 10` 或 `需要重新登录` 会给出明确提示。
- 支持按 `r` 重试，按 `q`、`Esc` 或 `Ctrl+C` 取消。
- 补充 `openIde` 与重试辅助函数单元测试，覆盖重试成功、取消和非登录错误分支。
