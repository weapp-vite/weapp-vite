---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite dev` 交互热键模式对终端默认控制的兼容性，在接管 TTY 后支持 `Ctrl+Z` 暂时挂起当前进程并恢复终端控制，且在前台恢复后重新启用快捷键提示，避免 dev 模式吞掉常见的 shell 挂起行为。
