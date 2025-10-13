---
"weapp-vite": minor
---

- 新增 `weapp.wxml`、`weapp.wxs` 与 `weapp.autoImportComponents` 顶层配置，并保留 `weapp.enhance` 作为兼容用法，发出废弃提示
- 更新自动导入与 WXML 运行时代码，以优先读取新字段并兼容旧配置，确保增强能力行为一致
- 修正相关测试与工具脚本的日志和排序规则，使 ESLint 与 TypeScript 校验在当前变更上通过
