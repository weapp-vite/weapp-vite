---
"wevu-comprehensive-demo": patch
---

## volar-config-enhancements

增强 Volar 插件配置块支持，完整实现 JSONC/JS/TS 配置模式

### wevu-comprehensive-demo

- **添加配置示例**：更新 demo 页面展示各种配置模式的使用
  - `pages/basic` - jsonc 配置（带注释）
  - `pages/computed` - jsonc 配置（带 schema）
  - `pages/component` - jsonc 配置
  - `pages/watch` - js 配置
  - `pages/lifecycle` - ts 配置（带类型）
  - `pages/advanced` - 异步 ts 配置
- **VSCode 配置**：添加 `.vscode/settings.json` 和 `.vscode/extensions.json`

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
