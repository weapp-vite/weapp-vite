---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式启用 Web Runtime 后使用自定义组件时运行时共享模块导出缺失的问题，避免微信开发者工具加载组件时报 `resolveMiniProgramPlatform is not a function`。
