---
"@weapp-core/schematics": patch
"@weapp-vite/volar": patch
"weapp-vite": patch
---

统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

### @weapp-core/schematics

- 导出 `JSON_SCHEMA_DEFINITIONS`，供其他包使用
- JSON Schema 现在只通过 Zod 在 `scripts/json.ts` 中维护单一数据源

### @weapp-vite/volar

- 删除手写的 JSON Schema 定义（约 230 行）
- 改为从 `@weapp-core/schematics` 导入 `JSON_SCHEMA_DEFINITIONS`
- 确保与 schematics 包的 schema 定义始终同步

### weapp-vite

- Vue SFC `<config>` 块编译时自动移除 `$schema` 字段
- `$schema` 字段仅用于编辑器智能提示，不应出现在编译产物中
- 修复 TypeScript `as` 类型断言移除逻辑
- 修复正则表达式错误删除属性值的问题
- 修复运行时模块解析问题：将 `createWevuComponent` 代码内联到每个页面文件
