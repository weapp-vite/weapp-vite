---
"@weapp-core/schematics": major
---

- 重构生成器实现：拆分 App/Page/Component 等 JSON、WXML、JS 模板逻辑到独立模块，公开 API 保持不变
- Schema 构建脚本改为内存生成，统一输出网站 JSON Schema 与 type.auto.ts，减少重复 I/O 并便于扩展
