---
"weapp-vite": patch
"create-weapp-vite": patch
---

增强了 `weapp-vite prepare` 在安装阶段的容错能力：现在会兼容 `pnpm exec` / `postinstall` 场景下可能出现的异常位置参数解析，显式传入 `weapp-vite prepare .` 也不会再被误判为未使用参数。同时，当项目尚未准备好 `project.config.json` 或多平台参数尚未补全时，命令会输出警告并跳过预生成，而不是直接导致 `pnpm install` 失败。
