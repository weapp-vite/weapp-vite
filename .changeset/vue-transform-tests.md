---
"weapp-vite": patch
---

为 Vue transform 模块添加完整的单元测试覆盖

- 新增 57 个单元测试用例，覆盖 transform.ts 的所有核心函数
- 测试内容包括：
  - transformScript：TypeScript 类型注解剥离、export default 转换
  - compileVueFile：完整 Vue SFC 编译（template、script、style、config）
  - compileConfigBlocks：JSON/JSONC/JSON5 配置块解析和合并
  - generateScopedId：Scoped ID 一致性和唯一性生成
  - 配置语言辅助函数：normalizeConfigLang、isJsonLikeLang、resolveJsLikeLang
- 导出核心函数以支持单元测试
- 添加边界值和错误场景测试（空文件、多个块、复杂类型等）
- 所有测试均通过，核心函数代码覆盖率显著提升
