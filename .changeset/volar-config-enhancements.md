---
"@weapp-vite/volar": minor
"weapp-vite": patch
"wevu-comprehensive-demo": patch
---

增强 Volar 插件配置块支持，完整实现 JSONC/JS/TS 配置模式

### @weapp-vite/volar

- **新增 jsonc 支持**：`lang="jsonc"` 支持 JSON with Comments，可在配置中添加注释
- **新增 js/ts 支持**：`lang="js"` 和 `lang="ts"` 支持使用 JavaScript/TypeScript 编写配置
- **异步配置支持**：支持 `async` 函数动态生成配置，可使用 `await` 调用异步 API
- **完整类型检查**：JS/TS 配置提供完整的 TypeScript 类型检查和智能提示
- **类型推断**：根据文件路径自动推断配置类型（App/Page/Component）
- **Schema 注入**：JSON/JSONC 模式下自动注入 `$schema` 字段

### weapp-vite

- **集成 volar 插件**：通过 `weapp-vite/volar` 重新导出 volar 插件，无需单独安装
- **自动依赖管理**：安装 weapp-vite 时自动获取 volar 智能提示功能
- **构建时执行**：使用 rolldown-require 执行 JS/TS 配置块，支持异步函数

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
