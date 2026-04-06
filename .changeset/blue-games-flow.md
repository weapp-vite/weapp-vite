---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `wv dev` 在未启用 UI 分析面板时提前结束命令主流程的问题。此前开发态热键会话会在首屏提示后立即被关闭，只剩下构建 watcher 持续运行，导致 `h`、`q` 等快捷键看起来存在但实际无效。现在 `serve` 会持续等待退出信号，并在退出时再统一清理热键与 watcher。
