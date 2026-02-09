---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

refactor: 提炼微信 IDE 登录失效重试逻辑，减少跨包重复实现。

- `weapp-ide-cli` 对外导出登录失效识别与按键重试 helper。
- `weapp-vite` 的 `open/dev -o` 逻辑改为复用 `weapp-ide-cli` helper，不再维护重复副本。
- 清理 `weapp-vite` 本地重复重试模块，并更新单测 mock 到统一导出入口。
