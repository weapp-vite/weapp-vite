---
'weapp-vite': patch
---

修复构建完成后进程仍然驻留的问题：显式关闭编译上下文的 watcher，并在退出时终止遗留的 sass-embedded 子进程，避免 pnpm build 卡住。
