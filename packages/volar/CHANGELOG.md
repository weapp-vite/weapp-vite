# @weapp-vite/volar

## 2.0.1

### Patch Changes

- 🐛 **补充 volar 插件的 CJS 产物与 require 导出，修复 vue-tsc 解析 weapp-vite/volar 的报错。** [`8ff60aa`](https://github.com/weapp-vite/weapp-vite/commit/8ff60aab1097a28c7218b8b18624ac9deca9206d) by @sonofmagic

## 2.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

### Patch Changes

- 📦 **Dependencies** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda)
  → `@weapp-core/schematics@6.0.0`

## 1.0.0

### Major Changes

- 🚀 **## unify-json-schema-source** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
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

  | 模式           | 语法        | 智能提示       | 异步支持 | 适用场景                   |
  | -------------- | ----------- | -------------- | -------- | -------------------------- |
  | `lang="json"`  | JSON        | ✅ Schema      | ❌       | 简单静态配置               |
  | `lang="jsonc"` | JSON + 注释 | ✅ Schema      | ❌       | 带注释的静态配置           |
  | `lang="js"`    | JavaScript  | ✅ 类型        | ✅       | 动态配置、简单逻辑         |
  | `lang="ts"`    | TypeScript  | ✅ 类型 + 检查 | ✅       | 复杂动态配置、需要类型检查 |
  | 无 lang        | TypeScript  | ✅ 类型 + 检查 | ✅       | 默认模式，完整类型检查     |

  ## vue-key-fix-and-volar-enhance

  修复 Vue 模板编译与 Volar 配置提示
  - 修正 v-for 场景下 :key 生成逻辑：当 :key 绑定循环项对象属性（如 item.id）时输出 `wx:key="id"`，当 :key 绑定 item 或 key 别名时输出 `wx:key="*this"`，避免小程序端 key 语义错误
  - 为 Vue 配置块（<json>）补充完整 TS/JS 智能提示：解析 default export 并注入带类型的辅助函数，规范语言解析（含 json/jsonc 降级），提升写配置时的补全与类型检查体验
  - 更新综合示例及构建输出，确保 demo 使用最新编译/提示行为

### Patch Changes

- 📦 **Dependencies** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7)
  → `@weapp-core/schematics@5.0.0`

## 0.1.0-alpha.0

### Minor Changes

- [`d64e8ff`](https://github.com/weapp-vite/weapp-vite/commit/d64e8ff8f717bf1d51a918b1154218f589b217da) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 增强 Volar 插件配置块支持，完整实现 JSONC/JS/TS 配置模式

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

  | 模式           | 语法        | 智能提示       | 异步支持 | 适用场景                   |
  | -------------- | ----------- | -------------- | -------- | -------------------------- |
  | `lang="json"`  | JSON        | ✅ Schema      | ❌       | 简单静态配置               |
  | `lang="jsonc"` | JSON + 注释 | ✅ Schema      | ❌       | 带注释的静态配置           |
  | `lang="js"`    | JavaScript  | ✅ 类型        | ✅       | 动态配置、简单逻辑         |
  | `lang="ts"`    | TypeScript  | ✅ 类型 + 检查 | ✅       | 复杂动态配置、需要类型检查 |
  | 无 lang        | TypeScript  | ✅ 类型 + 检查 | ✅       | 默认模式，完整类型检查     |

### Patch Changes

- [`01d0ded`](https://github.com/weapp-vite/weapp-vite/commit/01d0dedec1ab85c0b7e5db0e87e82884f035ca15) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

  ### @weapp-core/schematics
  - 导出 `JSON_SCHEMA_DEFINITIONS`，供其他包使用
  - JSON Schema 现在只通过 Zod 在 `scripts/json.ts` 中维护单一数据源

  ### @weapp-vite/volar
  - 删除手写的 JSON Schema 定义（约 230 行）
  - 改为从 `@weapp-core/schematics` 导入 `JSON_SCHEMA_DEFINITIONS`
  - 确保与 schematics 包的 schema 定义始终同步

  ### weapp-vite
  - Vue SFC `<json>` 块编译时自动移除 `$schema` 字段
  - `$schema` 字段仅用于编辑器智能提示，不应出现在编译产物中
  - 修复 TypeScript `as` 类型断言移除逻辑
  - 修复正则表达式错误删除属性值的问题
  - 修复运行时模块解析问题：将 `createWevuComponent` 代码内联到每个页面文件

- [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 Vue 模板编译与 Volar 配置提示
  - 修正 v-for 场景下 :key 生成逻辑：当 :key 绑定循环项对象属性（如 item.id）时输出 `wx:key="id"`，当 :key 绑定 item 或 key 别名时输出 `wx:key="*this"`，避免小程序端 key 语义错误
  - 为 Vue 配置块（<json>）补充完整 TS/JS 智能提示：解析 default export 并注入带类型的辅助函数，规范语言解析（含 json/jsonc 降级），提升写配置时的补全与类型检查体验
  - 更新综合示例及构建输出，确保 demo 使用最新编译/提示行为

- Updated dependencies [[`01d0ded`](https://github.com/weapp-vite/weapp-vite/commit/01d0dedec1ab85c0b7e5db0e87e82884f035ca15)]:
  - @weapp-core/schematics@4.0.1-alpha.0

## 0.0.2

### Patch Changes

- [`40c5dec`](https://github.com/weapp-vite/weapp-vite/commit/40c5dec63f8d1320d56849c7b1132fc33b788e98) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 增强 `<json>` 区块体验：插件在开发与构建结束时清理生成文件，支持将编译产物输出到自定义目录（如 `.wevu/`），并为 Volar 提供基于 `@weapp-core/schematics` 的类型提示支持。

  新增示例展示 `<json>` / `<json>`，并在编译阶段自动解析 TS/JS 导出的配置对象。

  执行 TS/JS `<json>` 时改用 `rolldown-require`，与 rolldown 构建保持一致。

## 0.0.1

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade
