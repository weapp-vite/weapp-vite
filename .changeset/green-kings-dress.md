---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite prepare` 在安装阶段通过 Vite `runner` 加载配置时遗留大量原生句柄、导致宿主环境里的 `pnpm install` 在末尾长时间卡住的问题。现在 `prepare` 会改用更轻量的 `native` 配置加载模式，并局部抑制 Node 针对无 `type` 的临时 TS 配置告警，避免安装收尾阶段无响应。
