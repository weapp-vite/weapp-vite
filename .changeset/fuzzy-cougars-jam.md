---
"weapp-vite": patch
"create-weapp-vite": patch
---

增强了 `weapp-vite prepare` 在安装阶段的容错能力：现在会兼容 `pnpm exec` / `postinstall` 场景下可能出现的异常位置参数解析，显式传入 `weapp-vite prepare .` 也不会再被误判为未使用参数。即使 `packages/weapp-vite` 的 `dist/cli.mjs` 尚未构建，或项目配置、自动生成流程内部出现异常，`prepare` 也会统一降级为警告并跳过预生成，不再打断 `pnpm install`、`postinstall` 或其他串联命令。
