# @weapp-vite/volar

## 2.1.0

### Minor Changes

- ✨ **增强 Volar 插件对 `defineOptions` 模板上下文的类型推断，补齐 `properties`、`data`、`computed` 与 `methods` 的常见声明写法支持，包括原生小程序风格的 `data: { ... }`、常见 getter/函数式 `computed`，以及保留参数与返回类型的方法签名，让 `.vue` 模板中的字段补全、事件处理器与方法调用获得更准确的类型体验。** [`cd33619`](https://github.com/weapp-vite/weapp-vite/commit/cd336193b4cd6c7002e574d1eeb9031c14755484) by @sonofmagic

## 2.0.8

### Patch Changes

- 🐛 **增强 `defineOptions` 的类型能力与 Volar 模板绑定识别：`wevu` 现在支持更完整的工厂签名与原生 `properties/data/methods` 类型推导，Volar 插件会把 `defineOptions` 中声明的模板绑定注入到模板类型检查上下文里。同时补齐 retail 模板中相关订单按钮组件的本地类型与交互缺陷，降低脚本侧类型噪音并修复遗漏的方法调用问题。** [`aef4a30`](https://github.com/weapp-vite/weapp-vite/commit/aef4a30c974c566dc181cc7152e04c96d0f6e41e) by @sonofmagic

## 2.0.7

### Patch Changes

- 📦 **Dependencies** [`43a68e2`](https://github.com/weapp-vite/weapp-vite/commit/43a68e28e7ffcc9c6e40fa033d2f346452157140)
  → `@weapp-core/schematics@6.0.4`

## 2.0.6

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic
- 📦 **Dependencies** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8)
  → `@weapp-core/schematics@6.0.3`

## 2.0.5

### Patch Changes

- 🐛 **修复 `weapp-vite/volar` 在 Vue SFC 模板中对 `<wxs module="...">` 的类型识别问题。现在当模板通过 `phoneReg.xxx()` 这类方式访问 WXS 模块时，IDE 不再错误提示 “属性不存在于模板上下文”，从而让小程序合法写法与编辑器类型体验保持一致。** [`f9d685f`](https://github.com/weapp-vite/weapp-vite/commit/f9d685f58a6747b39e18da98a20de46e07e04f25) by @sonofmagic

## 2.0.4

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@weapp-core/schematics@6.0.2`

## 2.0.3

### Patch Changes

- 📦 **Dependencies** [`d6bd490`](https://github.com/weapp-vite/weapp-vite/commit/d6bd490eb22cbc97614e7f0343c520b288ddc27c)
  → `@weapp-core/schematics@6.0.1`

## 2.0.2

### Patch Changes

- 🐛 **chore: remove cjs `module` 判断** [`90f4bf4`](https://github.com/weapp-vite/weapp-vite/commit/90f4bf4e99abedb6b4c4f99e473cca0cebbd242e) by @sonofmagic

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
