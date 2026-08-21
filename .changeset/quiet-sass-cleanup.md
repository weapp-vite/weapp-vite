---
"weapp-vite": patch
---

修复 Sass Embedded 子进程在构建和分析命令结束后未被清理、导致 CLI 无法自然退出的问题，并确保目标样式扩展为 CSS 时仍会注入共享样式入口。
