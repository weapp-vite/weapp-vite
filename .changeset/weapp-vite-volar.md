---
"@weapp-vite/volar": major
---

## unify-json-schema-source

统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

### @weapp-vite/volar

- 删除手写的 JSON Schema 定义（约 230 行）
- 改为从 `@weapp-core/schematics` 导入 `JSON_SCHEMA_DEFINITIONS`
- 确保与 schematics 包的 schema 定义始终同步

## volar-config-enhancements

增强 Volar 插件配置块支持，完整实现 JSONC/JS/TS 配置模式

### @weapp-vite/volar

- **新增 jsonc 支持**：`lang="jsonc"` 支持 JSON with Comments，可在配置中添加注释
- **新增 js/ts 支持**：`lang="js"` 和 `lang="ts"` 支持使用 JavaScript/TypeScript 编写配置
- **异步配置支持**：支持 `async` 函数动态生成配置，可使用 `await` 调用异步 API
- **完整类型检查**：JS/TS 配置提供完整的 TypeScript 类型检查和智能提示
- **类型推断**：根据文件路径自动推断配置类型（App/Page/Component）
- **Schema 注入**：JSON/JSONC 模式下自动注入 `$schema` 字段

### 配置模式对比

| 模式 | 语法 | 智能提示 | 异步支持 | 适用场景 |
| ---- | ---- | -------- | -------- | -------- |
| `lang="json"` | JSON | ✅ Schema | ❌ | 简单静态配置 |
| `lang="jsonc"` | JSON + 注释 | ✅ Schema | ❌ | 带注释的静态配置 |
| `lang="js"` | JavaScript | ✅ 类型 | ✅ | 动态配置、简单逻辑 |
| `lang="ts"` | TypeScript | ✅ 类型 + 检查 | ✅ | 复杂动态配置、需要类型检查 |
| 无 lang | TypeScript | ✅ 类型 + 检查 | ✅ | 默认模式，完整类型检查 |

## vue-key-fix-and-volar-enhance

修复 Vue 模板编译与 Volar 配置提示

- 修正 v-for 场景下 :key 生成逻辑：当 :key 绑定循环项对象属性（如 item.id）时输出 `wx:key="id"`，当 :key 绑定 item 或 key 别名时输出 `wx:key="*this"`，避免小程序端 key 语义错误
- 为 Vue 配置块（<json>）补充完整 TS/JS 智能提示：解析 default export 并注入带类型的辅助函数，规范语言解析（含 json/jsonc 降级），提升写配置时的补全与类型检查体验
- 更新综合示例及构建输出，确保 demo 使用最新编译/提示行为
