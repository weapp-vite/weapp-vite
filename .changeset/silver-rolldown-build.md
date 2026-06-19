---
"weapp-vite": patch
"@weapp-vite/ast": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

修复升级 rolldown 后因全局覆盖 Vite 内部 rolldown 版本导致的构建失败；现在保留 Vite 声明的内部 rolldown 版本，同时继续校验工作区直接使用的 rolldown 版本保持一致。
