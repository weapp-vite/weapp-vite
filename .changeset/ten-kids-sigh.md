---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 优化 CLI 高优先级输出一致性与机器可读性。

- `weapp-vite analyze --json` 在 JSON 输出模式下默认静默平台提示，避免污染标准输出。
- `weapp-vite open` 登录失效重试提示改为复用 `weapp-ide-cli` 的统一格式化 helper。
- `create-weapp-vite` CLI 错误输出改为统一 logger，并区分“取消创建”和“创建失败”。
