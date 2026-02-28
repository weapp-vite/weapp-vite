---
'weapp-vite': patch
'create-weapp-vite': patch
---

增强 `weapp-vite` CLI 对 `weapp-ide-cli` 的能力复用：现在可直接在 `weapp-vite` 中调用 `preview`、`upload`、`config`、automator 等命令，并新增 `weapp-vite ide <args...>` 命名空间透传入口，方便在脚本与 CI 中统一命令入口。
