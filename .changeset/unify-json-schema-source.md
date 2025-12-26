---
"@weapp-core/schematics": patch
"@weapp-vite/volar": patch
---

统一 JSON Schema 定义来源，消除重复维护

### @weapp-core/schematics

- 导出 `JSON_SCHEMA_DEFINITIONS`，供其他包使用
- JSON Schema 现在只通过 Zod 在 `scripts/json.ts` 中维护单一数据源

### @weapp-vite/volar

- 删除手写的 JSON Schema 定义（约 230 行）
- 改为从 `@weapp-core/schematics` 导入 `JSON_SCHEMA_DEFINITIONS`
- 确保与 schematics 包的 schema 定义始终同步
