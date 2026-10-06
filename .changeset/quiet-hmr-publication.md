---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `hmr.sharedChunks: 'off'` 下重复发布未变化产物的问题。开发构建现在维护完整的发布依赖关系，在仅更新变更入口时保留新增共享模块及其传递依赖，并确保这些依赖完成平台 API 重写；仍不通过共享 chunk 扩散其他入口的重建。
