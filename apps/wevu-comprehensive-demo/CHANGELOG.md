# wevu-comprehensive-demo

## 0.0.13

### Patch Changes

- 📦 **Dependencies** [`10ae1ea`](https://github.com/weapp-vite/weapp-vite/commit/10ae1eaa25d4b64f028a0c2eccb8487d19aed5ef)
  → `wevu@1.1.3`

## 0.0.12

### Patch Changes

- 📦 **Dependencies** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f)
  → `wevu@1.1.2`

## 0.0.11

### Patch Changes

- 📦 **Dependencies** [`60f19f8`](https://github.com/weapp-vite/weapp-vite/commit/60f19f8bceff0ffdd8668e54b00f6864999e4c5a)
  → `wevu@1.1.1`

## 0.0.10

### Patch Changes

- 📦 **Dependencies** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda)
  → `wevu@1.1.0`

## 0.0.9

### Patch Changes

- 📦 **Dependencies** [`be9cdec`](https://github.com/weapp-vite/weapp-vite/commit/be9cdece9b680178b8f1e57d0b945251c9c4fe82)
  → `wevu@1.0.7`

## 0.0.8

### Patch Changes

- 📦 **Dependencies** [`dc9fcc0`](https://github.com/weapp-vite/weapp-vite/commit/dc9fcc044af51c4d39439064717864f51a1f7aad)
  → `wevu@1.0.6`

## 0.0.7

### Patch Changes

- 📦 **Dependencies** [`4d53674`](https://github.com/weapp-vite/weapp-vite/commit/4d536749f1dfb6c4d54093df78f643057c4deb74)
  → `wevu@1.0.5`

## 0.0.6

### Patch Changes

- 📦 **Dependencies** [`fcb8d6a`](https://github.com/weapp-vite/weapp-vite/commit/fcb8d6a13e501880cc976409f372518002f3229e)
  → `wevu@1.0.4`

## 0.0.5

### Patch Changes

- 📦 **Dependencies** [`4f5b4d4`](https://github.com/weapp-vite/weapp-vite/commit/4f5b4d43b0a604f901b27eb143b2a63ed7049f11)
  → `wevu@1.0.3`

## 0.0.4

### Patch Changes

- 📦 **Dependencies** [`29d8996`](https://github.com/weapp-vite/weapp-vite/commit/29d899694f0166ffce5d93b8c278ab53d86ced1e)
  → `wevu@1.0.2`

## 0.0.3

### Patch Changes

- 📦 **Dependencies** [`6f1c4ca`](https://github.com/weapp-vite/weapp-vite/commit/6f1c4cabb30a03f0dc51b11c3aff6fdcbf0e09c9)
  → `wevu@1.0.1`

## 0.0.2

### Patch Changes

- 🐛 **## volar-config-enhancements** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
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

- 📦 **Dependencies** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7)
  → `wevu@1.0.0`

## 0.0.2-alpha.6

### Patch Changes

- 📦 **Dependencies** [`a855a60`](https://github.com/weapp-vite/weapp-vite/commit/a855a601f40f4ae369ba35e2a1ec7ee78516f6f9)
  → `wevu@1.0.0-alpha.5`

## 0.0.2-alpha.5

### Patch Changes

- 📦 **Dependencies** [`58bfb77`](https://github.com/weapp-vite/weapp-vite/commit/58bfb7703683f7908c81b6ee463a58075afe5472)
  → `wevu@1.0.0-alpha.4`

## 0.0.2-alpha.4

### Patch Changes

- Updated dependencies [[`32b44ae`](https://github.com/weapp-vite/weapp-vite/commit/32b44aef543b981f74389ee23e8ae2b7d4ecd2af), [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b), [`7af6104`](https://github.com/weapp-vite/weapp-vite/commit/7af6104c5a4ddec0808f7336766adadae3c3801e)]:
  - wevu@1.0.0-alpha.3

## 0.0.2-alpha.3

### Patch Changes

- Updated dependencies [[`e2fdc64`](https://github.com/weapp-vite/weapp-vite/commit/e2fdc643dc7224f398b4a21e2d3f55dec310dd8a), [`23bcc73`](https://github.com/weapp-vite/weapp-vite/commit/23bcc73282976463754f87ab1436481bbebb32c1), [`96a5161`](https://github.com/weapp-vite/weapp-vite/commit/96a516176d98344b4c1d5d9b70504b0032d138c9)]:
  - wevu@1.0.0-alpha.2

## 0.0.2-alpha.2

### Patch Changes

- Updated dependencies [[`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb), [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51)]:
  - wevu@1.0.0-alpha.1

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies [[`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26), [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26)]:
  - wevu@0.0.2-alpha.0

## 0.0.2-alpha.0

### Patch Changes

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

- [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 Vue 模板编译与 Volar 配置提示
  - 修正 v-for 场景下 :key 生成逻辑：当 :key 绑定循环项对象属性（如 item.id）时输出 `wx:key="id"`，当 :key 绑定 item 或 key 别名时输出 `wx:key="*this"`，避免小程序端 key 语义错误
  - 为 Vue 配置块（<json>）补充完整 TS/JS 智能提示：解析 default export 并注入带类型的辅助函数，规范语言解析（含 json/jsonc 降级），提升写配置时的补全与类型检查体验
  - 更新综合示例及构建输出，确保 demo 使用最新编译/提示行为
