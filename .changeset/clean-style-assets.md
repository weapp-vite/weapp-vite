---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复预处理样式产物在 `generateBundle` 阶段重命名时直接写入 `bundle` 导致 Rolldown 输出兼容性警告的问题，改为通过插件 `emitFile` 重新发射目标样式资产。
