---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

将当前发布分支的运行时代码回滚到 6.16.7 稳定基线，仅保留 issue #553、#554、#555 与 #563 的修复，避免 6.16.8 中 scoped slot 运行时同步改动继续影响页面运行。
