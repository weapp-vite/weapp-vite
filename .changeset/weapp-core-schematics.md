---
"@weapp-core/schematics": major
---

## unify-json-schema-source

统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

### @weapp-core/schematics

- 导出 `JSON_SCHEMA_DEFINITIONS`，供其他包使用
- JSON Schema 现在只通过 Zod 在 `scripts/json.ts` 中维护单一数据源
