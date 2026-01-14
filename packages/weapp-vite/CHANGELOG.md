# weapp-vite

## 6.1.10

### Patch Changes

- 🐛 **统一 weapp-vite 内用户可见的警告、错误与注释为中文。** [`4f571bb`](https://github.com/weapp-vite/weapp-vite/commit/4f571bbab6707905497c7d370c0b562eb0e51af1) by @sonofmagic
- 📦 **Dependencies** [`dc9fcc0`](https://github.com/weapp-vite/weapp-vite/commit/dc9fcc044af51c4d39439064717864f51a1f7aad)
  → `wevu@1.0.6`

## 6.1.9

### Patch Changes

- 🐛 **补齐 class/style 绑定对象/数组在小程序中的 WXS/JS 运行时支持，JS 侧改为编译期 AST 注入以避免 eval/with，并新增相关单测覆盖。** [`4d53674`](https://github.com/weapp-vite/weapp-vite/commit/4d536749f1dfb6c4d54093df78f643057c4deb74) by @sonofmagic

- 🐛 **新增 `vue.template.classStyleWxsShared` 配置，用于控制 class/style WXS 运行时是否按包根复用（默认开启），降低重复产物。** [`c0297d2`](https://github.com/weapp-vite/weapp-vite/commit/c0297d2c0d4bafc9f17d22cd61e47e6a366aa43f) by @sonofmagic

- 🐛 **修复 dev 下模板/样式/配置侧车文件变更未触发热更新的问题，补齐 wxml/wxss/scss/json/js/ts 的增量构建单测覆盖。** [`69d6483`](https://github.com/weapp-vite/weapp-vite/commit/69d6483a236769a4b22ffce117f0a8e63139b6e7) by @sonofmagic
- 📦 **Dependencies** [`4d53674`](https://github.com/weapp-vite/weapp-vite/commit/4d536749f1dfb6c4d54093df78f643057c4deb74)
  → `wevu@1.0.5`

## 6.1.8

### Patch Changes

- 🐛 **chore(deps): upgrade** [`b6d5f0e`](https://github.com/weapp-vite/weapp-vite/commit/b6d5f0e6e26c76b78462d0a335d4da7341b8d969) by @sonofmagic

- 🐛 **修复 autoImportComponents 生成的导航路径优先指向 `.d.ts`，避免组件类型在 Volar 中退化为 `any`。** [`fe23c0e`](https://github.com/weapp-vite/weapp-vite/commit/fe23c0e2f191f3b7b2043cd3e30afe07c0b7df69) by @sonofmagic
  - 补充 wevu 宏指令的中文说明与示例，完善类型提示使用说明。 调整 wevu `jsx-runtime` 的 `IntrinsicElements` 以继承 `GlobalComponents`，让小程序组件标签能正确推断属性类型。

- 🐛 **chore: 升级 rolldown 和 vite 的版本** [`2d01415`](https://github.com/weapp-vite/weapp-vite/commit/2d014157b409d3a854d89957602fa5a541736077) by @sonofmagic
- 📦 **Dependencies** [`fcb8d6a`](https://github.com/weapp-vite/weapp-vite/commit/fcb8d6a13e501880cc976409f372518002f3229e)
  → `wevu@1.0.4`

## 6.1.7

### Patch Changes

- 🐛 **优化 dev/watch 构建性能：** [`6a098f7`](https://github.com/weapp-vite/weapp-vite/commit/6a098f74307a2da524599c22fe29fcbad0e72058) by @sonofmagic
  - dev 默认关闭 `sourcemap`（需要时可在 `vite.config.ts` 显式开启）
  - 缓存 Vue SFC 解析结果，减少热更新时重复解析
  - `pathExists` 查询加入 TTL 缓存，并在文件 create/delete 时失效，提升 sidecar 样式处理效率
  - dev watch 时收到文件变更事件会主动失效文件读取缓存，避免极端情况下 mtime/size 未变化导致的“变更不生效”
  - 无 `baseUrl/paths` 时默认不注入 `vite-tsconfig-paths`（或可 `weapp.tsconfigPaths=false` 强制关闭）
  - watch 场景下避免每次 rebuild 主动 `load` 所有入口模块（仅首次预热），减少全量重编译倾向
- 📦 **Dependencies** [`4f5b4d4`](https://github.com/weapp-vite/weapp-vite/commit/4f5b4d43b0a604f901b27eb143b2a63ed7049f11)
  → `wevu@1.0.3`

## 6.1.6

### Patch Changes

- 🐛 **chore(deps): upgrade** [`9260af8`](https://github.com/weapp-vite/weapp-vite/commit/9260af8561ad47b55f2b6084be7f2b039c5d523c) by @sonofmagic

- 🐛 **修复：支持在 Vue 模板中使用 PascalCase（如 `TButton`）触发小程序组件 `usingComponents` 自动导入。** [`40e51e4`](https://github.com/weapp-vite/weapp-vite/commit/40e51e401be28c0057c8fe23a334b0546d2c8151) by @sonofmagic
- 📦 **Dependencies** [`29d8996`](https://github.com/weapp-vite/weapp-vite/commit/29d899694f0166ffce5d93b8c278ab53d86ced1e)
  → `wevu@1.0.2`

## 6.1.5

### Patch Changes

- 📦 **Dependencies** [`e1e1db3`](https://github.com/weapp-vite/weapp-vite/commit/e1e1db36bcbd7f450473825a999a5976bc8015b8)
  → `@weapp-core/init@5.0.1`

## 6.1.4

### Patch Changes

- 🐛 **## 变更说明** [`efa28eb`](https://github.com/weapp-vite/weapp-vite/commit/efa28ebddba79c054f98f594181b5844a0042eaa) by @sonofmagic
  - `weapp-vite` CLI 移除 `create` 命令；新项目创建请使用 `create-weapp-vite`（例如 `pnpm create weapp-vite`）。
  - `@weapp-core/init` 仅保留“初始化配置文件”相关能力（如 `initConfig`），不再包含模板项目创建能力。
  - 模板同步与模板创建逻辑迁移到 `create-weapp-vite`，并对外导出 `createProject` / `TemplateName`。
- 📦 **Dependencies** [`efa28eb`](https://github.com/weapp-vite/weapp-vite/commit/efa28ebddba79c054f98f594181b5844a0042eaa)
  → `@weapp-core/init@5.0.0`

## 6.1.3

### Patch Changes

- 🐛 **修复 Vue SFC 模板中 kebab-case 组件标签（如 `t-cell-group`/`t-cell`）未能通过 `autoImportComponents` 自动写入 `usingComponents` 的问题；同时修复模板表达式生成时中文被转为 `\\uXXXX` 导致 WXML 直接显示转义序列的问题。** [`75a9e1f`](https://github.com/weapp-vite/weapp-vite/commit/75a9e1fc14234bc2f0df265e1a1ed822c74170d8) by @sonofmagic
- 📦 **Dependencies** [`c02b412`](https://github.com/weapp-vite/weapp-vite/commit/c02b41283cb4862891e85750b72c9937a339f4fe)
  → `@weapp-core/init@4.1.1`

## 6.1.2

### Patch Changes

- 🐛 **修复 Vue SFC 的 `<style lang="scss">` 等样式块未交给 Vite CSS 流水线处理的问题：现在会正确走 Sass 预处理与 PostCSS（含 Tailwind）等插件链，并输出对应 `.wxss`。** [`0350a93`](https://github.com/weapp-vite/weapp-vite/commit/0350a936481e9f3a743b3366c1f5b433f37ecd3e) by @sonofmagic
- 📦 **Dependencies** [`802a189`](https://github.com/weapp-vite/weapp-vite/commit/802a1891a555b95d0efc4f0e6393758d536aad76)
  → `@weapp-core/init@4.1.0`

## 6.1.1

### Patch Changes

- 🐛 **优化 `autoImportComponents` 生成的 `components.d.ts`：支持在 VSCode 中对第三方组件（如 `@vant/weapp`、`tdesign-miniprogram`）`Cmd/Ctrl+Click` 直接跳转到源码，同时保留 props 智能提示。** [`8205860`](https://github.com/weapp-vite/weapp-vite/commit/8205860fe29e2dd7bb8f7bad8c4fc7a31aca751b) by @sonofmagic

## 6.1.0

### Minor Changes

- ✨ **### weapp-vite** [`78e8ab8`](https://github.com/weapp-vite/weapp-vite/commit/78e8ab8c4f923a138c4216933186853fd8b81f63) by @sonofmagic
  - `autoImportComponents.resolvers` 新增支持 **对象写法**（推荐），同时保持对历史 **函数写法** 的兼容。
  - 内置 `VantResolver` / `TDesignResolver` / `WeuiResolver` 已切换为对象 resolver：优先走 `resolve()` / `components`，再回退到函数 resolver。
  - 第三方组件库 props 元数据解析从硬编码迁移为 resolver 自描述（`resolveExternalMetadataCandidates`），并加入候选路径的启发式兜底。

  > 注意：如果你此前在业务代码里直接调用内置 resolver（例如 `VantResolver()('van-button', ...)`），现在应改为交给 weapp-vite 处理，或自行调用 `resolver.resolve(...)`。

  ### @weapp-core/init
  - 修复单测依赖：在测试启动阶段同步生成 `templates/`，并加入锁防止并发同步导致的偶发失败。

### Patch Changes

- 🐛 **### weapp-vite** [`4bce0d4`](https://github.com/weapp-vite/weapp-vite/commit/4bce0d4374b1419bd05b710428db968898a6cae9) by @sonofmagic
  - dev 模式默认排除 `.wevu-config`，避免临时文件触发无意义的重编译。
  - `.wevu-config` 临时文件改为写入 `node_modules/.cache/weapp-vite/wevu-config`（可用 `WEAPP_VITE_WEVU_CONFIG_DIR` 覆盖），减少源码目录噪音。
  - 入口依赖的 `resolve()` 结果做跨次构建缓存，并在 create/delete 事件时自动失效，加快热更新耗时。
- 📦 **Dependencies** [`78e8ab8`](https://github.com/weapp-vite/weapp-vite/commit/78e8ab8c4f923a138c4216933186853fd8b81f63)
  → `@weapp-core/init@4.0.1`

## 6.0.1

### Patch Changes

- 📦 **Dependencies** [`6f1c4ca`](https://github.com/weapp-vite/weapp-vite/commit/6f1c4cabb30a03f0dc51b11c3aff6fdcbf0e09c9)
  → `wevu@1.0.1`

## 6.0.0

### Major Changes

- 🚀 **## disable-auto-routes-when-off** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
  修复在未开启 `weapp.autoRoutes` 时仍注册 auto-routes 插件导致的性能占比统计，并补充示例页的 `<json>` JS 写法使编译通过。

  ## ensure-build-exits

  修复构建完成后进程仍然驻留的问题：显式关闭编译上下文的 watcher，并在退出时终止遗留的 sass-embedded 子进程，避免 pnpm build 卡住。

  ## fix-define-expose-transform

  修复 `<script setup>` 中 `defineExpose` 的编译产物处理：不再错误移除 `__expose({ ... })`，并将其对齐为 wevu `setup(_, { expose })` 的 `expose(...)` 调用，确保公开成员可被正确暴露。

  ## fix-setup-ref-ui-update

  修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

  ## fix-vmodel-and-props-sync-zh

  修复 weapp-vite + wevu 在微信小程序中的两类常见问题：
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

  ## fix-vue-json-macro-hmr-zh

  修复 Vue SFC `<script setup>` JSON 宏（`definePageJson/defineComponentJson/defineAppJson`）在 dev 下热更新不稳定、以及把配置从 `xxx1` 改回 `xxx` 时产物 `.json` 字段偶发丢失的问题：
  - 避免直接修改 `@vue/compiler-sfc` 的 `descriptor`（其内部存在 `parseCache`），防止缓存对象被污染导致宏被“永久剥离”。
  - 让宏内容变化能够稳定影响最终 JS 产物，从而触发增量构建与微信开发者工具刷新。

  ## remove-plugin-wevu

  ## 重构 Vue 支持架构

  将 Vue SFC 支持完全集成到 `weapp-vite` 内部。

  ### 主要变更
  - ✅ **删除外置的 Vue 编译插件包**
    - 核心功能已完全迁移到 weapp-vite
    - 不再需要单独的 Vue 插件

  - ✅ **weapp-vite 内置 Vue 支持**
    - 自动处理 `.vue` 文件
    - 支持完整的 Vue SFC 编译
    - 支持 JS/TS 配置块
    - 更健壮的 Babel AST 转换

  - ✅ **Runtime API 导出**
    - `createWevuComponent` 可从 `weapp-vite` 和 `weapp-vite/runtime` 导入
    - 完整的 TypeScript 类型支持

  ### 迁移指南

  **之前（使用外置插件）：**

  ```typescript
  export default defineConfig({
    plugins: [
      /* 旧 Vue 插件 */
    ],
  });
  ```

  **现在（内置支持）：**

  ```typescript
  import { defineConfig } from "weapp-vite/config";

  export default defineConfig({
    weapp: {
      srcRoot: "src",
    },
    // Vue 文件自动处理，无需额外配置
  });
  ```

  ### Breaking Changes
  - 移除了外置 Vue 编译插件
  - demo 项目不再需要 pre 脚本来构建依赖
  - 依赖简化：`demo → weapp-vite → wevu`

  ### 测试

  所有 81 个测试通过 ✅

  ## remove-take-query-plugin

  移除未使用的 `weapp-vite:pre:take-query` 插件（及 `take:` 前缀解析）以降低构建插件开销，并同步示例特性文案。

  ## six-eyes-tan

  chore: 升级 rolldown -> 1.0.0-beta.57 , vite -> 8.0.0-beta.5

  ## support-script-setup-model-slots

  补齐 Vue `<script setup>` 宏与运行时兼容能力：
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。

  ## unify-json-schema-source

  统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

  ### weapp-vite
  - Vue SFC `<json>` 块编译时自动移除 `$schema` 字段
  - `$schema` 字段仅用于编辑器智能提示，不应出现在编译产物中
  - 修复 TypeScript `as` 类型断言移除逻辑
  - 修复正则表达式错误删除属性值的问题
  - 修复运行时模块解析问题：将 `createWevuComponent` 代码内联到每个页面文件

  ## volar-config-enhancements

  增强 Volar 插件配置块支持，完整实现 JSONC/JS/TS 配置模式

  ### weapp-vite
  - **集成 volar 插件**：通过 `weapp-vite/volar` 重新导出 volar 插件，无需单独安装
  - **自动依赖管理**：安装 weapp-vite 时自动获取 volar 智能提示功能
  - **构建时执行**：使用 rolldown-require 执行 JS/TS 配置块，支持异步函数

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

  ## vue-sfc-support

  完整的 Vue SFC 单文件组件支持
  - 模板编译：使用 Vue compiler-core 替代正则表达式解析，支持完整的 Vue 3 模板语法
  - v-model 增强：支持所有输入类型（text、checkbox、radio、textarea、select、switch、slider、picker）
  - 样式处理：实现 CSS 到 WXSS 的转换，支持 Scoped CSS 和 CSS Modules
  - 插槽系统：支持默认插槽、具名插槽、作用域插槽和 fallback 内容
  - 高级特性：支持动态组件 `<component :is>`、过渡动画 `<transition>`、KeepAlive
  - 测试覆盖：新增 73 个测试用例，代码覆盖率达到 85%

  ## vue-transform-tests

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

  ## zh-auto-wevu-page-features

  weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

  ## zh-fix-template-cache-types

  修复 Vue 模板编译器的 TS 类型问题：调整 `lru-cache` 缓存的值类型以兼容 `lru-cache@11` 的泛型约束（不再使用 `null` 作为缓存值）。

  ## zh-perf-cache-wxml-and-asset

  优化编译阶段的性能与内存占用：
  - 修复 `FileCache` 在 LRU 淘汰/手动删除时未同步清理元数据导致的潜在内存增长。
  - `wxmlService.scan` 优先基于 `stat` 信息判断是否需要重新扫描，命中缓存时避免无意义的文件读取。
  - 静态资源收集改为延迟读取并增加并发上限，降低 `buildStart` 阶段的峰值内存与 I/O 压力。

  ## zh-perf-plugins-cache

  优化编译阶段插件性能：为文件读取/存在性检查增加轻量缓存，减少重复 I/O；同时修复带 query 的模块 id 在核心插件中导致部分页面模板未正确扫描的问题。
  - 补充 `plugins/utils/cache` 的单元测试与性能基准测试（`bench/cache.bench.ts`）。

  ## zh-slot-template-blocks-and-multiple-slots

  优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

  ## zh-wevu-component-only-pages

  wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

### Patch Changes

- 📦 Updated 4 dependencies [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7)

## 6.0.0-alpha.7

### Patch Changes

- 🐛 **修复 weapp-vite + wevu 在微信小程序中的两类常见问题：** [`a855a60`](https://github.com/weapp-vite/weapp-vite/commit/a855a601f40f4ae369ba35e2a1ec7ee78516f6f9) by @sonofmagic
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

- 🐛 **修复 Vue SFC `<script setup>` JSON 宏（`definePageJson/defineComponentJson/defineAppJson`）在 dev 下热更新不稳定、以及把配置从 `xxx1` 改回 `xxx` 时产物 `.json` 字段偶发丢失的问题：** [`8f6d11c`](https://github.com/weapp-vite/weapp-vite/commit/8f6d11cdd39011cac8008489238384b3480e330d) by @sonofmagic
  - 避免直接修改 `@vue/compiler-sfc` 的 `descriptor`（其内部存在 `parseCache`），防止缓存对象被污染导致宏被“永久剥离”。
  - 让宏内容变化能够稳定影响最终 JS 产物，从而触发增量构建与微信开发者工具刷新。

- 🐛 **优化编译阶段的性能与内存占用：** [`cfe2ca8`](https://github.com/weapp-vite/weapp-vite/commit/cfe2ca81dc7e5ba163a96ec6bc75bd0d08a7c1d3) by @sonofmagic
  - 修复 `FileCache` 在 LRU 淘汰/手动删除时未同步清理元数据导致的潜在内存增长。
  - `wxmlService.scan` 优先基于 `stat` 信息判断是否需要重新扫描，命中缓存时避免无意义的文件读取。
  - 静态资源收集改为延迟读取并增加并发上限，降低 `buildStart` 阶段的峰值内存与 I/O 压力。
- 📦 **Dependencies** [`a855a60`](https://github.com/weapp-vite/weapp-vite/commit/a855a601f40f4ae369ba35e2a1ec7ee78516f6f9)
  → `wevu@1.0.0-alpha.5`, `@weapp-core/init@3.0.8-alpha.1`

## 6.0.0-alpha.6

### Patch Changes

- 🐛 **修复 `<script setup>` 中 `defineExpose` 的编译产物处理：不再错误移除 `__expose({ ... })`，并将其对齐为 wevu `setup(_, { expose })` 的 `expose(...)` 调用，确保公开成员可被正确暴露。** [`e484974`](https://github.com/weapp-vite/weapp-vite/commit/e4849749f7a9d809f2740f120d5831990ec8482f) by @sonofmagic

- 🐛 **补齐 Vue `<script setup>` 宏与运行时兼容能力：** [`58bfb77`](https://github.com/weapp-vite/weapp-vite/commit/58bfb7703683f7908c81b6ee463a58075afe5472) by @sonofmagic
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。
- 📦 **Dependencies** [`58bfb77`](https://github.com/weapp-vite/weapp-vite/commit/58bfb7703683f7908c81b6ee463a58075afe5472)
  → `wevu@1.0.0-alpha.4`

## 6.0.0-alpha.5

### Patch Changes

- 🐛 **优化编译阶段插件性能：为文件读取/存在性检查增加轻量缓存，减少重复 I/O；同时修复带 query 的模块 id 在核心插件中导致部分页面模板未正确扫描的问题。** [`7cd5d89`](https://github.com/weapp-vite/weapp-vite/commit/7cd5d894b161839db97b02956e24bfdbef502200) by @sonofmagic
  - 补充 `plugins/utils/cache` 的单元测试与性能基准测试（`bench/cache.bench.ts`）。

## 6.0.0-alpha.4

### Minor Changes

- [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

### Patch Changes

- [`c89c1cf`](https://github.com/weapp-vite/weapp-vite/commit/c89c1cfd65bf1c3f886305a4ff73a172e52dcc56) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 Vue 模板编译器的 TS 类型问题：调整 `lru-cache` 缓存的值类型以兼容 `lru-cache@11` 的泛型约束（不再使用 `null` 作为缓存值）。

- Updated dependencies [[`32b44ae`](https://github.com/weapp-vite/weapp-vite/commit/32b44aef543b981f74389ee23e8ae2b7d4ecd2af), [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b), [`7af6104`](https://github.com/weapp-vite/weapp-vite/commit/7af6104c5a4ddec0808f7336766adadae3c3801e)]:
  - wevu@1.0.0-alpha.3

## 6.0.0-alpha.3

### Patch Changes

- [`23bcc73`](https://github.com/weapp-vite/weapp-vite/commit/23bcc73282976463754f87ab1436481bbebb32c1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

- Updated dependencies [[`e2fdc64`](https://github.com/weapp-vite/weapp-vite/commit/e2fdc643dc7224f398b4a21e2d3f55dec310dd8a), [`23bcc73`](https://github.com/weapp-vite/weapp-vite/commit/23bcc73282976463754f87ab1436481bbebb32c1), [`96a5161`](https://github.com/weapp-vite/weapp-vite/commit/96a516176d98344b4c1d5d9b70504b0032d138c9)]:
  - wevu@1.0.0-alpha.2

## 6.0.0-alpha.2

### Patch Changes

- [`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

- [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

- Updated dependencies [[`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb), [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51)]:
  - wevu@1.0.0-alpha.1

## 6.0.0-alpha.1

### Patch Changes

- Updated dependencies [[`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26), [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26)]:
  - wevu@0.0.2-alpha.0

## 6.0.0-alpha.0

### Major Changes

- [`dcf920d`](https://github.com/weapp-vite/weapp-vite/commit/dcf920dda85bd4c74a7216bea81956126050f7b2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ## 重构 Vue 支持架构

  将 Vue SFC 支持完全集成到 `weapp-vite` 内部。

  ### 主要变更
  - ✅ **删除外置的 Vue 编译插件包**
    - 核心功能已完全迁移到 weapp-vite
    - 不再需要单独的 Vue 插件
  - ✅ **weapp-vite 内置 Vue 支持**
    - 自动处理 `.vue` 文件
    - 支持完整的 Vue SFC 编译
    - 支持 JS/TS 配置块
    - 更健壮的 Babel AST 转换
  - ✅ **Runtime API 导出**
    - `createWevuComponent` 可从 `weapp-vite` 和 `weapp-vite/runtime` 导入
    - 完整的 TypeScript 类型支持

  ### 迁移指南

  **之前（使用外置插件）：**

  ```typescript
  export default defineConfig({
    plugins: [
      /* 旧 Vue 插件 */
    ],
  });
  ```

  **现在（内置支持）：**

  ```typescript
  import { defineConfig } from "weapp-vite/config";

  export default defineConfig({
    weapp: {
      srcRoot: "src",
    },
    // Vue 文件自动处理，无需额外配置
  });
  ```

  ### Breaking Changes
  - 移除了外置 Vue 编译插件
  - demo 项目不再需要 pre 脚本来构建依赖
  - 依赖简化：`demo → weapp-vite → wevu`

  ### 测试

  所有 81 个测试通过 ✅

### Minor Changes

- [`91525a4`](https://github.com/weapp-vite/weapp-vite/commit/91525a42fd90c7813745ca4db04121fc2e7866cd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完整的 Vue SFC 单文件组件支持
  - 模板编译：使用 Vue compiler-core 替代正则表达式解析，支持完整的 Vue 3 模板语法
  - v-model 增强：支持所有输入类型（text、checkbox、radio、textarea、select、switch、slider、picker）
  - 样式处理：实现 CSS 到 WXSS 的转换，支持 Scoped CSS 和 CSS Modules
  - 插槽系统：支持默认插槽、具名插槽、作用域插槽和 fallback 内容
  - 高级特性：支持动态组件 `<component :is>`、过渡动画 `<transition>`、KeepAlive
  - 测试覆盖：新增 73 个测试用例，代码覆盖率达到 85%

### Patch Changes

- [`a2cbcc1`](https://github.com/weapp-vite/weapp-vite/commit/a2cbcc1f9e2360687a7ae585134882f9bd5d5265) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复在未开启 `weapp.autoRoutes` 时仍注册 auto-routes 插件导致的性能占比统计，并补充示例页的 `<json>` JS 写法使编译通过。

- [`ed25507`](https://github.com/weapp-vite/weapp-vite/commit/ed25507b3e97fcd2e0d7041dbaa3c3fb702847a0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复构建完成后进程仍然驻留的问题：显式关闭编译上下文的 watcher，并在退出时终止遗留的 sass-embedded 子进程，避免 pnpm build 卡住。

- [`b0863a5`](https://github.com/weapp-vite/weapp-vite/commit/b0863a581d87a6b77b87e3f82cac47af829e8002) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 移除未使用的 `weapp-vite:pre:take-query` 插件（及 `take:` 前缀解析）以降低构建插件开销，并同步示例特性文案。

- [`3919f14`](https://github.com/weapp-vite/weapp-vite/commit/3919f146b17b131ab25f3f18002324db2f6ba85e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown -> 1.0.0-beta.57 , vite -> 8.0.0-beta.5

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

- [`abcd08a`](https://github.com/weapp-vite/weapp-vite/commit/abcd08ab146bd374e6aded8c7775f52dcc7d75de) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为 Vue transform 模块添加完整的单元测试覆盖
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

- Updated dependencies [[`01d0ded`](https://github.com/weapp-vite/weapp-vite/commit/01d0dedec1ab85c0b7e5db0e87e82884f035ca15), [`d64e8ff`](https://github.com/weapp-vite/weapp-vite/commit/d64e8ff8f717bf1d51a918b1154218f589b217da), [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59), [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59)]:
  - @weapp-core/schematics@4.0.1-alpha.0
  - @weapp-vite/volar@0.1.0-alpha.0
  - @weapp-core/init@3.0.8-alpha.0

## 5.12.0

### Minor Changes

- [`84ec536`](https://github.com/weapp-vite/weapp-vite/commit/84ec536b29498a2b64d0c5a75a5f3d233b121279) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 重构 npm 构建：改用 Vite 库模式替代 tsdown，移除相关依赖并同步配置类型/文档说明。

### Patch Changes

- [`ba9496f`](https://github.com/weapp-vite/weapp-vite/commit/ba9496fd274b9a70468f83830373c7e7abd04332) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 5.11.4

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44)]:
  - weapp-ide-cli@4.1.2
  - @weapp-core/init@3.0.7
  - @weapp-vite/web@0.0.3

## 5.11.3

### Patch Changes

- [`fe93e13`](https://github.com/weapp-vite/weapp-vite/commit/fe93e13467c8a0db1fc7a24f438bcf7777862c82) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade deps

- [`6e4dd84`](https://github.com/weapp-vite/weapp-vite/commit/6e4dd8483e6ec7b42cbcd9c8ea067fbc07969506) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`fe93e13`](https://github.com/weapp-vite/weapp-vite/commit/fe93e13467c8a0db1fc7a24f438bcf7777862c82)]:
  - @weapp-core/init@3.0.6

## 5.11.2

### Patch Changes

- [`9a0fc27`](https://github.com/weapp-vite/weapp-vite/commit/9a0fc27488d46fab165d6bb8a6a75071224921e3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: use OIDC for ci publish

## 5.11.1

### Patch Changes

- [`98f7d7e`](https://github.com/weapp-vite/weapp-vite/commit/98f7d7e94766cdd05a08168c6f91c1e5bf059bba) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修正分包共享模块提升到主包时的日志，使用源码路径展示被提炼的模块，避免输出虚拟目录名，精简 `node_modules` 依赖显示。

- [`2c1b5d2`](https://github.com/weapp-vite/weapp-vite/commit/2c1b5d236992877a9efc2794585db236c74cf442) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown to 0.17.1 and vite to 8.0.0-beta.1

## 5.11.0

### Minor Changes

- [`43d79cc`](https://github.com/weapp-vite/weapp-vite/commit/43d79ccb9645fed733be9a034bd3e1d40832491b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade to vite@8.0.0-beta and tsdown 0.17.0

### Patch Changes

- [`3e379e4`](https://github.com/weapp-vite/weapp-vite/commit/3e379e4cedc1e6ae4a63850da4231534b2928367) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`1a71186`](https://github.com/weapp-vite/weapp-vite/commit/1a711865b415a0197e1b7017b98fb22a573bb8a6), [`3e379e4`](https://github.com/weapp-vite/weapp-vite/commit/3e379e4cedc1e6ae4a63850da4231534b2928367), [`adec557`](https://github.com/weapp-vite/weapp-vite/commit/adec557eaf08d9d0c05e55e5be20f05d4b3a8941), [`fa4bce0`](https://github.com/weapp-vite/weapp-vite/commit/fa4bce0dfd628a791f49f9249e0e05f54f76b6d7), [`fa4bce0`](https://github.com/weapp-vite/weapp-vite/commit/fa4bce0dfd628a791f49f9249e0e05f54f76b6d7), [`a560261`](https://github.com/weapp-vite/weapp-vite/commit/a5602611084a55c09ada38c7b5eafd8e376a44b5)]:
  - rolldown-require@1.0.6
  - weapp-ide-cli@4.1.1

## 5.10.0

### Minor Changes

- [`7a9b2e8`](https://github.com/weapp-vite/weapp-vite/commit/7a9b2e868bd06a7acb929ca0167fd3ae472e55ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 构建插件时自动读取 `project.config.json.pluginRoot`，并为插件与主小程序分别启动独立的 rolldown-vite 构建上下文，确保产物写入各自目录且互不干扰。

### Patch Changes

- [`835d07a`](https://github.com/weapp-vite/weapp-vite/commit/835d07a2a0bbd26a968ef11658977cbfed576354) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`ec736cd`](https://github.com/weapp-vite/weapp-vite/commit/ec736cd433fa344c7d10a96efe8af4ee899ba36b)]:
  - @weapp-core/init@3.0.5

## 5.9.5

### Patch Changes

- [`547f380`](https://github.com/weapp-vite/weapp-vite/commit/547f380a10af46a3c693957fd12878c76e2afb2b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为自动导入新增 WeUI 解析器，默认生成 `mp-` 前缀映射（如 `mp-form` -> `weui-miniprogram/form/form`），并在生成脚本中忽略非组件目录。

- [`5932476`](https://github.com/weapp-vite/weapp-vite/commit/59324763fe05e99182b43614c947fb349d4179a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为侧车 watcher 增加默认忽略目录并补充测试，减少无意义的文件监听负担。

## 5.9.4

### Patch Changes

- [`d3811f5`](https://github.com/weapp-vite/weapp-vite/commit/d3811f55016d8acef11a28b3515486ee9036d9b8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复共享 chunk 在降级回主包或被保留在主包时，入口脚本仍引用已删除的 `weapp_shared_virtual/*` 路径的问题，确保导入被重写为实际落盘的 `common.js` 文件。

- [`965f0c8`](https://github.com/weapp-vite/weapp-vite/commit/965f0c899e42af7fab45a6f5e3a6a64c946d72ec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- [`274bdfe`](https://github.com/weapp-vite/weapp-vite/commit/274bdfeaa5f9b727cccce65adc016eaa8fd4d800) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 增强 `useExtendedLib.weui` 的处理逻辑，使全局启用后会默认允许 `weui-miniprogram` 组件并抑制无效的入口警告。

  link: https://github.com/weapp-vite/weapp-vite/issues/204

- Updated dependencies [[`965f0c8`](https://github.com/weapp-vite/weapp-vite/commit/965f0c899e42af7fab45a6f5e3a6a64c946d72ec)]:
  - @weapp-core/init@3.0.4

## 5.9.3

### Patch Changes

- [`fbc1e43`](https://github.com/weapp-vite/weapp-vite/commit/fbc1e438add0e230b439de38d9aa71a133c74321) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: refresh auto-import-components/builtin.auto.ts

- [`0259a17`](https://github.com/weapp-vite/weapp-vite/commit/0259a17018527d52df727c098045e208c048f476) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

- [`6c0cbe2`](https://github.com/weapp-vite/weapp-vite/commit/6c0cbe2facf0a5537b8e0fcf23a1ae14b3b131df) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade rolldown-vite

- Updated dependencies [[`8bdcc85`](https://github.com/weapp-vite/weapp-vite/commit/8bdcc858b2f967c4b96ec997536c0ad5c8157aa7)]:
  - @weapp-core/init@3.0.3

## 5.9.2

### Patch Changes

- [`9ccf688`](https://github.com/weapp-vite/weapp-vite/commit/9ccf68806b487f1c1fbe30f3659b73c40fe774d8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 rolldown 在 CJS 输出里对页面入口的隐式 `require()` 注入，确保 `app.js` 不会抢先执行页面脚本。

## 5.9.1

### Patch Changes

- [`4e4972f`](https://github.com/weapp-vite/weapp-vite/commit/4e4972f7531270c02b30a5032b1f7e1ce33b9daf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 5.9.0

### Minor Changes

- [`1a96aed`](https://github.com/weapp-vite/weapp-vite/commit/1a96aed4c4eb0f9224cf5e1a058805d4bcb97aa7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 自动导入组件改为默认开启，自动扫描主包与各分包的 `components/` 目录，同时支持通过 `autoImportComponents: false` 或 `subPackages.<root>.autoImportComponents = false` 完全禁用该能力；同步更新示例与文档，方便分包独立维护自动导入策略。

### Patch Changes

- Updated dependencies [[`6a289f3`](https://github.com/weapp-vite/weapp-vite/commit/6a289f3d4ebe3dbc874f3f2650cfab1f330b5626)]:
  - weapp-ide-cli@4.1.0

## 5.8.0

### Minor Changes

- [`cdfe7a6`](https://github.com/weapp-vite/weapp-vite/commit/cdfe7a68bdd2a2c06fa5015cb88796af6bd7b8e1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 到 0.16 升级 rolldown-vite 到 7.2.0

## 5.7.2

### Patch Changes

- [`9be5689`](https://github.com/weapp-vite/weapp-vite/commit/9be5689befeda4935296ebe58e2fcbfbf801fdec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 `take:` 指令：在分包中通过 `import 'take:xxx'` 使用模块时，会强制将该模块复制到对应分包的 `weapp-shared/common.js`，即便全局共享策略为 `hoist`；若仍存在普通导入，构建日志会提示该模块同时保留在主包与相关分包中，便于后续重构。旧版 `?take` 语法仍兼容但会提示迁移。

## 5.7.1

### Patch Changes

- 默认将 `weapp.chunks.sharedStrategy` 切回 `hoist`，保持跨分包共享模块统一落到主包；若需要按分包复制，请在配置中显式设置 `sharedStrategy: 'duplicate'`。
- `hoist` 策略会根据源码所在目录决定共享产物位置：位于主包根目录的模块统一落到主包 `common.js`，位于分包目录的模块固定在对应分包，若被其它分包引用会直接报错，提示将共享代码移动到主包/公共目录。
<!--
- 支持在导入语句前加上 `take:` 指令强制将模块复制到当前分包：只要分包使用 `import 'take:foo'`，`foo` 就会复制到该分包的 `weapp-shared/common.js`，允许 `hoist` 策略下的按需复制；若同时存在普通导入，构建日志会提示代码既保留在主包也会复制到使用 `take:` 的分包。
- 模板项目默认在 `tsconfig.json` 中新增 `paths.take:@/*`，TypeScript 会自动把 `import 'take:foo'` 映射回原始模块，恢复类型提示。
  -->

- [`2ece3b4`](https://github.com/weapp-vite/weapp-vite/commit/2ece3b4cefce0f4e8e9af5ad16ad56328d71c6ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复共享 chunk duplicate 后仍指向 `weapp_shared_virtual` 的路径问题，确保入口脚本与 sourcemap 一并重写到各自分包的 `weapp-shared/common.js`。

## 5.7.0

### Minor Changes

- [`229a095`](https://github.com/weapp-vite/weapp-vite/commit/229a095a833f5118d81bb5b0ece17c89411690a5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化共享 chunk 拆分：当模块仅被分包间接引用时不再强制回退主包，并新增 `weapp.chunks.forceDuplicatePatterns` 配置，支持以 glob/正则声明可复制到分包的共享目录，同时在构建日志中提示已忽略的伪主包引用；复制完成后会移除主包的虚拟共享产物，避免额外的 `weapp_shared_virtual/*` 文件膨胀主包体积。

- [`24975d8`](https://github.com/weapp-vite/weapp-vite/commit/24975d829cc39e524978c301253670d5ff1539b1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 `weapp-vite analyze` 命令，读取当前配置构建主包与各分包的产物映射，可输出 JSON 或写入指定文件，便于排查跨包复用的源码。

### Patch Changes

- [`c339914`](https://github.com/weapp-vite/weapp-vite/commit/c3399141671bdd34cc873a4aed7a85f47a9dc32b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构 CLI 结构，拆分子命令与工具模块，提升可维护性与可读性。

- Updated dependencies [[`40c5dec`](https://github.com/weapp-vite/weapp-vite/commit/40c5dec63f8d1320d56849c7b1132fc33b788e98)]:
  - @weapp-vite/volar@0.0.2

## 5.6.3

### Patch Changes

- [`0e29cdd`](https://github.com/weapp-vite/weapp-vite/commit/0e29cdd3429eb222c0de764f2820b58028862845) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`352554a`](https://github.com/weapp-vite/weapp-vite/commit/352554ad802d1e5a1f4802a55dd257a9b32d1d18)]:
  - rolldown-require@1.0.5

## 5.6.2

### Patch Changes

- [`e001ba3`](https://github.com/weapp-vite/weapp-vite/commit/e001ba319ff954d9ca32dfca3145c1ade0f8e544) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

## 5.6.1

### Patch Changes

- [`5e5497a`](https://github.com/weapp-vite/weapp-vite/commit/5e5497ac9cd4ba7aa659dc018c8fb87c498a5a2c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade rolldown-vite

- [`492fb95`](https://github.com/weapp-vite/weapp-vite/commit/492fb95e758872fce17beb318c2935114fec8bac) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复侧车样式新增/导入无法触发热更新的问题，补充 @import/@wv-keep-import 依赖追踪与日志输出。

- [`e138483`](https://github.com/weapp-vite/weapp-vite/commit/e138483964a5288517abe98d77d02b7a56ea4d0c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

## 5.6.0

### Minor Changes

- [`e902fae`](https://github.com/weapp-vite/weapp-vite/commit/e902faefd4da777dc80a38619163d893d0b6e9cf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 优化 weapp-vite 构建与 npm 流程

- [`51a403a`](https://github.com/weapp-vite/weapp-vite/commit/51a403a40f7346c2c52349f6c249cc31fe2c8e3f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 允许 `weapp.subPackages[*].styles` 支持 Sass/Less/Stylus 等多种格式，并落到共享样式注入流程。
  - 新增 include/exclude 精准控制分包共享样式范围，可脱离 `scope` 单独配置。
  - 若分包根目录存在 `index.*`、`pages.*`、`components.*` 样式文件，自动推导共享样式的作用范围（默认扫描 `.wxss`/`.css`）。
  - 在 bundle 阶段自动为页面 chunk 注入共享样式 import，确保生成的 `.wxss` 与 `.js` 同步落盘。
  - Sass 预处理默认使用 `sass`，迁移到 Vite `preprocessCSS` 管线，可选安装 `sass-embedded` 获得原生性能，避免构建环境缺少依赖时抛错。
  - 自动路由服务复用候选缓存与增量更新，监听性能更好，并兼容 `rename` 事件的同步。
  - 演示项目新增 Tailwind 分包案例，覆盖共享样式与多格式混合的实战场景。
  - 文档补充完整签名与复杂示例，说明多格式及 `sass-embedded` 支持。

### Patch Changes

- [`38b486d`](https://github.com/weapp-vite/weapp-vite/commit/38b486d05d81fc5635a449f611fa2e6131af7823) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 使用 `fdir` 扫描自动路由候选并缓存共享样式结果，减少多余 IO 和重复预处理。
  - 优化模板创建时的文件读写路径检测，避免额外的文件状态查询。

- [`0cafd50`](https://github.com/weapp-vite/weapp-vite/commit/0cafd500ac4fed4d88b337d597441bf1bd2d4533) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 修复 macOS Finder / VS Code 删除样式文件后不触发热更新的问题，侧车监听会及时触发入口刷新。
  - 即便样式文件暂时缺失，入口加载器也会持续监听对应路径，恢复文件时能重新注入样式并触发 HMR。

- [`a9f7df9`](https://github.com/weapp-vite/weapp-vite/commit/a9f7df95603d7919d946ce5989b56d43d0e9540e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复独立分包在 IDE 中被误判为保留目录的问题，统一将共享目录重命名为 `weapp-shared`，确保 rolldown 独立构建与微信开发者工具兼容。

  新增分包配置 `watchSharedStyles`（默认开启），在 TailwindCSS 等按需生成样式的场景下，独立分包改动可立即刷新共享样式产物，无需重新全量构建。

  重置 Tailwind JIT 缓存以兼容 v3/v4，在共享样式热更新时自动清除 `sharedState` 上下文，确保新增原子类即时生效。

- Updated dependencies [[`38b486d`](https://github.com/weapp-vite/weapp-vite/commit/38b486d05d81fc5635a449f611fa2e6131af7823)]:
  - @weapp-core/init@3.0.2

## 5.5.1

### Patch Changes

- [`f9355da`](https://github.com/weapp-vite/weapp-vite/commit/f9355dabc3696fe27db3e0b12e061b4c9f7018ac) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 拆分配置服务的实现，将 `configPlugin` 内部逻辑移动到 `createConfigService` 与多文件协作并补充文档说明新的模块职责。

- [`3674faf`](https://github.com/weapp-vite/weapp-vite/commit/3674faf03a40f140603b4c0fd64eb30637fad7f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 默认在构建日志里提示分包共享代码的复制与回退情况，并提供 `weapp.chunks.logOptimization` 开关以便按需关闭。

- [`989ce80`](https://github.com/weapp-vite/weapp-vite/commit/989ce807f1985050491024badba207c9eb287786) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 支持通过 `weapp.pluginRoot` 启用微信小程序插件编译链路，修复插件 WXSS 路径导致的源目录污染，并补充插件开发示例与中文指引。\*\*\*

## 5.5.0

### Minor Changes

- [`7e208dd`](https://github.com/weapp-vite/weapp-vite/commit/7e208dd613583e02bd740480979888e72e862287) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 默认分包共享模块的拆分策略由提炼到主包(`hoist`) 调整为按分包复制(`duplicate`)，跨分包复用的 `common.js` 将输出到各自分包的 `__shared__` 目录。若需要保持旧行为，请在 `vite.config.ts` 中设置 `weapp.chunks.sharedStrategy = 'hoist'`。

### Patch Changes

- [`ebd4035`](https://github.com/weapp-vite/weapp-vite/commit/ebd40358e2b5738b93fb70349d442f5853de9ede) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复开发与生产构建中透传到 Rolldown 的配置类型，使其保持与新版类型系统兼容。

## 5.4.0

### Minor Changes

- [`64f1955`](https://github.com/weapp-vite/weapp-vite/commit/64f19550b0cfcda9d2acb530e8345a98a891404a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 `typed-components.d.ts` 生成能力（需配置 `weapp.autoImportComponents.typedComponents`），并完善 `typed-router.d.ts` 输出，便于 WXML 补全与路由智能提示。

- [`18c8c66`](https://github.com/weapp-vite/weapp-vite/commit/18c8c66db5f49dbc1f413209c1bbca90e0777545) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 新增 `weapp.wxml`、`weapp.wxs` 与 `weapp.autoImportComponents` 顶层配置，并保留 `weapp.enhance` 作为兼容用法，发出废弃提示
  - 更新自动导入与 WXML 运行时代码，以优先读取新字段并兼容旧配置，确保增强能力行为一致
  - 修正相关测试与工具脚本的日志和排序规则，使 ESLint 与 TypeScript 校验在当前变更上通过

- [`252b807`](https://github.com/weapp-vite/weapp-vite/commit/252b80772508ef57a0dc533febddc1a1e69aa4c2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 autoImportComponents.htmlCustomData 选项，支持在 VS Code 等编辑器中生成小程序组件的 HTML Custom Data；同时扩展 H5 运行时对多种模板后缀的识别能力，使 `.html` 等模板与小程序组件共用自动导入机制。

### Patch Changes

- [`84fc3cc`](https://github.com/weapp-vite/weapp-vite/commit/84fc3cc1e04169e49878f85825a3c02c057337fb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- Updated dependencies [[`32949af`](https://github.com/weapp-vite/weapp-vite/commit/32949afff0c5cd4f410062209e504fef4cc56a4a), [`252b807`](https://github.com/weapp-vite/weapp-vite/commit/252b80772508ef57a0dc533febddc1a1e69aa4c2)]:
  - rolldown-require@1.0.4
  - @weapp-vite/web@0.0.2

## 5.3.0

### Minor Changes

- [`3d5c3bc`](https://github.com/weapp-vite/weapp-vite/commit/3d5c3bcbd1607afe0454c382e483810b8df05415) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持在项目中提供 `weapp-vite.config.ts`（等同扩展名）并与现有 `vite.config.*` 的 `weapp` 配置自动合并，同时导出 `WeappViteConfig` 类型

### Patch Changes

- [`465f5c1`](https://github.com/weapp-vite/weapp-vite/commit/465f5c155199049fb5033cc94b583d0a4e3aba2a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为 `weapp.enhance.autoImportComponents` 新增自动生成 `auto-import-components.json` 清单功能，支持通过 `output` 字段配置输出路径或关闭生成，同时内置解析器会将所有可自动导入的第三方组件写入清单，便于 IDE 补全及调试。

## 5.2.3

### Patch Changes

- [`5e8afee`](https://github.com/weapp-vite/weapp-vite/commit/5e8afee94c681c18efd2faeb5320713a5849b9b0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化 weapp-vite 的构建缓存与 WXML 处理路径，降低重复 I/O 与解析成本。

## 5.2.2

### Patch Changes

- [`ff57f89`](https://github.com/weapp-vite/weapp-vite/commit/ff57f89fc7de90aad2c7429d0be19d5044bb2b76) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 整理 `configPlugin` 的内置别名逻辑，提取 @oxc-project/runtime 与 class-variance-authority 的处理，修复类型声明并避免外部构建解析报错。

## 5.2.1

### Patch Changes

- [`2d86964`](https://github.com/weapp-vite/weapp-vite/commit/2d869640ad9775c48e07e905b92088bc7c7e1a2f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复在新增或删除 JSON/JSON.ts/JSONC 以及 WXSS 等 sidecar 文件时热更新失效的问题，通过触发所属脚本的重新构建，并补充相关单元测试覆盖 watcher 行为。

- Updated dependencies [[`2d86964`](https://github.com/weapp-vite/weapp-vite/commit/2d869640ad9775c48e07e905b92088bc7c7e1a2f)]:
  - @weapp-core/init@3.0.1

## 5.2.0

### Minor Changes

- [`6e18aff`](https://github.com/weapp-vite/weapp-vite/commit/6e18aff6143db9f604589c76b9ad511be070b669) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat(weapp-vite): 新增可配置的 generate 模板，支持内联字符串、外部文件以及工厂函数；同步导出相关类型，并在文档站补充使用说明，同时扩充脚手架测试覆盖共享与按类型自定义的模板场景。

  https://github.com/weapp-vite/weapp-vite/discussions/178

- [`12ae777`](https://github.com/weapp-vite/weapp-vite/commit/12ae777ecc390f0a3f16d055a2a83e3e79e3ccf8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构：移除 Inversify 容器，改由运行时 Vite 插件在编译上下文中注册共享服务
  - 新增：从 `@weapp-vite/context` 导出新的运行时服务接口，并在 CLI 与上下文初始化流程中接入
  - 清理：删除依赖装饰器与 Inversify 的旧版 IoC/Chokidar 测试与样例

- [`5998367`](https://github.com/weapp-vite/weapp-vite/commit/599836741acc1a30dda9f67ba6a0868cb8c77b0b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat(weapp-vite): 在解析 `app.json` 时将 `plugins.export` 识别为构建入口，主包与分包插件均生效，复用统一的入口收集逻辑并适配 `.ts`/`.js` 查找
  - test(weapp-vite): 增补 analyze 与 scan 服务的插件导出用例，覆盖子包场景
  - chore(weapp-vite): CSS 插件使用 rolldown 导出的 Output 类型，保持运行时与类型来源一致

### Patch Changes

- [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- [`96c205d`](https://github.com/weapp-vite/weapp-vite/commit/96c205dd463b3e3c7190c386bf06211a473c32ae) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 导出 vite 相关类型

  https://github.com/weapp-vite/weapp-vite/discussions/179

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`eda9720`](https://github.com/weapp-vite/weapp-vite/commit/eda97203171f116783181483600cc82dd27ae102), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547), [`284e0a2`](https://github.com/weapp-vite/weapp-vite/commit/284e0a29ea3fa3e66b8c2659eba40aea6ee893e0), [`896e5b9`](https://github.com/weapp-vite/weapp-vite/commit/896e5b95069c8f430467a8b5bd4f9d50a26517e2)]:
  - @weapp-core/init@3.0.0
  - weapp-ide-cli@4.0.0
  - @weapp-core/schematics@4.0.0
  - vite-plugin-performance@1.0.0

## 5.2.0-alpha.0

### Minor Changes

- [`6e18aff`](https://github.com/weapp-vite/weapp-vite/commit/6e18aff6143db9f604589c76b9ad511be070b669) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat(weapp-vite): 新增可配置的 generate 模板，支持内联字符串、外部文件以及工厂函数；同步导出相关类型，并在文档站补充使用说明，同时扩充脚手架测试覆盖共享与按类型自定义的模板场景。

  https://github.com/weapp-vite/weapp-vite/discussions/178

- [`12ae777`](https://github.com/weapp-vite/weapp-vite/commit/12ae777ecc390f0a3f16d055a2a83e3e79e3ccf8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构：移除 Inversify 容器，改由运行时 Vite 插件在编译上下文中注册共享服务
  - 新增：从 `@weapp-vite/context` 导出新的运行时服务接口，并在 CLI 与上下文初始化流程中接入
  - 清理：删除依赖装饰器与 Inversify 的旧版 IoC/Chokidar 测试与样例

- [`5998367`](https://github.com/weapp-vite/weapp-vite/commit/599836741acc1a30dda9f67ba6a0868cb8c77b0b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat(weapp-vite): 在解析 `app.json` 时将 `plugins.export` 识别为构建入口，主包与分包插件均生效，复用统一的入口收集逻辑并适配 `.ts`/`.js` 查找
  - test(weapp-vite): 增补 analyze 与 scan 服务的插件导出用例，覆盖子包场景
  - chore(weapp-vite): CSS 插件使用 rolldown 导出的 Output 类型，保持运行时与类型来源一致

### Patch Changes

- [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- [`96c205d`](https://github.com/weapp-vite/weapp-vite/commit/96c205dd463b3e3c7190c386bf06211a473c32ae) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 导出 vite 相关类型

  https://github.com/weapp-vite/weapp-vite/discussions/179

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`eda9720`](https://github.com/weapp-vite/weapp-vite/commit/eda97203171f116783181483600cc82dd27ae102), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547), [`284e0a2`](https://github.com/weapp-vite/weapp-vite/commit/284e0a29ea3fa3e66b8c2659eba40aea6ee893e0), [`896e5b9`](https://github.com/weapp-vite/weapp-vite/commit/896e5b95069c8f430467a8b5bd4f9d50a26517e2)]:
  - @weapp-core/init@3.0.0-alpha.0
  - weapp-ide-cli@4.0.0-alpha.0
  - @weapp-core/schematics@4.0.0-alpha.0
  - vite-plugin-performance@1.0.0-alpha.0

## 5.1.8

### Patch Changes

- [`18cc326`](https://github.com/weapp-vite/weapp-vite/commit/18cc3267edc73919ebccfd6d48ef6255481c0342) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- [`9f14216`](https://github.com/weapp-vite/weapp-vite/commit/9f142162dd7dc28a576e7f9617e4b57adfa59048) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown to 0.15.3

- Updated dependencies [[`576c8e1`](https://github.com/weapp-vite/weapp-vite/commit/576c8e1f5a143031ed3c321bf25a8e66a0d8c043), [`9f14216`](https://github.com/weapp-vite/weapp-vite/commit/9f142162dd7dc28a576e7f9617e4b57adfa59048)]:
  - @weapp-core/init@2.1.5

## 5.1.7

### Patch Changes

- [#175](https://github.com/weapp-vite/weapp-vite/pull/175) [`700e5ef`](https://github.com/weapp-vite/weapp-vite/commit/700e5ef0e44a680ff08d94a91680fb30588821fc) Thanks [@mayphus](https://github.com/mayphus)! - fix: support --config/-c option for custom config files

- [`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745)]:
  - weapp-ide-cli@3.1.1
  - @weapp-core/init@2.1.4

## 5.1.6

### Patch Changes

- [`0e52d23`](https://github.com/weapp-vite/weapp-vite/commit/0e52d236e666753c76b8fb23cc65173b46d0cb8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 的版本

- [`4a816f4`](https://github.com/weapp-vite/weapp-vite/commit/4a816f4c42084ef301f4c5b64f20595d7be8f62f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更新 rolldown-vite 版本到 `7.1.9`

- Updated dependencies [[`0e52d23`](https://github.com/weapp-vite/weapp-vite/commit/0e52d236e666753c76b8fb23cc65173b46d0cb8a), [`4a816f4`](https://github.com/weapp-vite/weapp-vite/commit/4a816f4c42084ef301f4c5b64f20595d7be8f62f)]:
  - @weapp-core/init@2.1.3

## 5.1.5

### Patch Changes

- [`fc25982`](https://github.com/weapp-vite/weapp-vite/commit/fc25982655cf40e16b3403a3d5102b5715dfbe7b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

## 5.1.4

### Patch Changes

- [`b82e7c1`](https://github.com/weapp-vite/weapp-vite/commit/b82e7c1cec14e53ffba0edab8bccf70062fbfc86) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: dev 开发模式下默认开启 sourcemap

- [`83b7aeb`](https://github.com/weapp-vite/weapp-vite/commit/83b7aeb54df698b9314f6e702093fdb378bf2a4c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持独立分包使用单独的 vite inlineConfig

- Updated dependencies [[`3f0b3a2`](https://github.com/weapp-vite/weapp-vite/commit/3f0b3a2fb8dfbb83cd83e3b005ab3e9ccd2d4480)]:
  - @weapp-core/init@2.1.2

## 5.1.3

### Patch Changes

- [`5e344b5`](https://github.com/weapp-vite/weapp-vite/commit/5e344b56d6d5039270ba63876fbebd364fbcb106) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 优化分包 chunk 的策略

  当一个模块全部被分包中的代码引入的场景下，这个模块会被打入到分包中。

  当同时被分包，主包，或者其他分包使用的时候，这个会被打入到主包中去。

  https://github.com/weapp-vite/weapp-vite/discussions/150

## 5.1.2

### Patch Changes

- [`d8523bb`](https://github.com/weapp-vite/weapp-vite/commit/d8523bbf20a22abe5399808060da8854d0cfe68e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 默认提炼多次引入的 import 到 common.js 中

- Updated dependencies [[`d8523bb`](https://github.com/weapp-vite/weapp-vite/commit/d8523bbf20a22abe5399808060da8854d0cfe68e)]:
  - @weapp-core/init@2.1.1

## 5.1.1

### Patch Changes

- Updated dependencies [[`1d9952b`](https://github.com/weapp-vite/weapp-vite/commit/1d9952b8968dbd0c84b2d481383b6de8b3e701b5), [`2bda01c`](https://github.com/weapp-vite/weapp-vite/commit/2bda01c969c33c858e3dd30f617de232ba149857)]:
  - weapp-ide-cli@3.1.0
  - rolldown-require@1.0.3

## 5.1.0

### Minor Changes

- [`ef98c7d`](https://github.com/weapp-vite/weapp-vite/commit/ef98c7d5f4e7e9836f4e4c21ae80fae4581deb7a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 使用 `rolldown` 的 `advancedChunks` 优化代码块的拆分

  feat: 取消 `chunk` `hash` 的生成，避免开发者工具频繁清除缓存

  [#142](https://github.com/weapp-vite/weapp-vite/issues/142)

### Patch Changes

- Updated dependencies [[`ef98c7d`](https://github.com/weapp-vite/weapp-vite/commit/ef98c7d5f4e7e9836f4e4c21ae80fae4581deb7a)]:
  - @weapp-core/init@2.1.0

## 5.0.17

### Patch Changes

- [`9f1fc1b`](https://github.com/weapp-vite/weapp-vite/commit/9f1fc1b3f8e967b7c8fdfb2ae30b192290e2afca) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本到 7.1.4

## 5.0.16

### Patch Changes

- [`0cbd148`](https://github.com/weapp-vite/weapp-vite/commit/0cbd14877233fefd86720a818e1b9e79a7c3eb68) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持配置使用 jsonc 格式

## 5.0.15

### Patch Changes

- [`ca54a61`](https://github.com/weapp-vite/weapp-vite/commit/ca54a61b631a95b9ac4d220ccbf034a6d4dd4607) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 到 7.1.0

- [`bd1f447`](https://github.com/weapp-vite/weapp-vite/commit/bd1f447a7ad7a3cf3d1a038346d59e1c3a965854) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - chore: 升级 tsdown 到 0.13.4
  - feat: `vite.config.ts` 在 `dev/build` 模式下默认的 `mode` 各自为 `development` 和 `production`

## 5.0.14

### Patch Changes

- [`c4bf379`](https://github.com/weapp-vite/weapp-vite/commit/c4bf3796f07e2e93720601aee339bec5e8bd5038) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- [`66a2df2`](https://github.com/weapp-vite/weapp-vite/commit/66a2df2c484666f4d715b0d450a7e0925e10a273) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 版本

- [`26e25bb`](https://github.com/weapp-vite/weapp-vite/commit/26e25bbcd71e834ad0d3791816cb90bd3deca122) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- [`6f4096e`](https://github.com/weapp-vite/weapp-vite/commit/6f4096e2a9fa0d7b287b2d07b42b58999d7caa7f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- [`911940f`](https://github.com/weapp-vite/weapp-vite/commit/911940f8560c9243e652ad301b43c32e8039f97a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复在 generateBundle 阶段直接给 bundle 赋值的问题

  fix: dist 目录清理问题 [weapp-vite/weapp-vite/pull/152](https://github.com/weapp-vite/weapp-vite/pull/152)

- Updated dependencies [[`66a2df2`](https://github.com/weapp-vite/weapp-vite/commit/66a2df2c484666f4d715b0d450a7e0925e10a273), [`26e25bb`](https://github.com/weapp-vite/weapp-vite/commit/26e25bbcd71e834ad0d3791816cb90bd3deca122), [`6f4096e`](https://github.com/weapp-vite/weapp-vite/commit/6f4096e2a9fa0d7b287b2d07b42b58999d7caa7f)]:
  - @weapp-core/init@2.0.9

## 5.0.13

### Patch Changes

- [`c0137f1`](https://github.com/weapp-vite/weapp-vite/commit/c0137f1009b96a6d68555a54f5b64a843bfad431) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: use target: ['es2015']

- [`40aa53d`](https://github.com/weapp-vite/weapp-vite/commit/40aa53dada7bf03096f6382964bf66253e2bd839) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: support es6 new class 语法

  https://github.com/weapp-vite/weapp-vite/issues/147

- Updated dependencies [[`c0137f1`](https://github.com/weapp-vite/weapp-vite/commit/c0137f1009b96a6d68555a54f5b64a843bfad431), [`40aa53d`](https://github.com/weapp-vite/weapp-vite/commit/40aa53dada7bf03096f6382964bf66253e2bd839)]:
  - @weapp-core/init@2.0.8

## 5.0.12

### Patch Changes

- [`6f921e7`](https://github.com/weapp-vite/weapp-vite/commit/6f921e7c4483afbb665db7c385f1ada8d0f23d17) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add miss dep oxc-parser

## 5.0.11

### Patch Changes

- [`9a2a21f`](https://github.com/weapp-vite/weapp-vite/commit/9a2a21f8c472aeb95a0192983275eddc85f5f37b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 5.0.10

### Patch Changes

- [`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1)]:
  - @weapp-core/init@2.0.7

## 5.0.9

### Patch Changes

- [`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown 和 rolldown vite 版本

- Updated dependencies [[`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821), [`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821)]:
  - @weapp-core/init@2.0.6
  - @weapp-core/schematics@3.0.0

## 5.0.8

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

- [`975ef00`](https://github.com/weapp-vite/weapp-vite/commit/975ef001277f596012ee115eb154140e41c19e72) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- Updated dependencies [[`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2), [`975ef00`](https://github.com/weapp-vite/weapp-vite/commit/975ef001277f596012ee115eb154140e41c19e72)]:
  - @weapp-core/init@2.0.5

## 5.0.7

### Patch Changes

- [`a057ad7`](https://github.com/weapp-vite/weapp-vite/commit/a057ad77107f757aa7dd185b18ff05635d945f54) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: JsonService 添加基于 mtime 的 FileCache 加快热更新速度

- [`3af287e`](https://github.com/weapp-vite/weapp-vite/commit/3af287ea2d35b309d9891d02242d551ef14f3a2e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump `rolldown-vite` and `rolldown` version

- Updated dependencies [[`3af287e`](https://github.com/weapp-vite/weapp-vite/commit/3af287ea2d35b309d9891d02242d551ef14f3a2e)]:
  - @weapp-core/init@2.0.4

## 5.0.6

### Patch Changes

- [`2c5a063`](https://github.com/weapp-vite/weapp-vite/commit/2c5a063fce61ab7248fe5cf4d42414c8c6fa8c36) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade rolldown version

## 5.0.5

### Patch Changes

- [`4ef7c3d`](https://github.com/weapp-vite/weapp-vite/commit/4ef7c3d3480fce8f8c241f3e1e1238628313350d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#136](https://github.com/weapp-vite/weapp-vite/issues/136)

- Updated dependencies [[`4ef7c3d`](https://github.com/weapp-vite/weapp-vite/commit/4ef7c3d3480fce8f8c241f3e1e1238628313350d)]:
  - @weapp-core/init@2.0.3

## 5.0.4

### Patch Changes

- [`a59845c`](https://github.com/weapp-vite/weapp-vite/commit/a59845c085a2484a29dd19d51ebef5f48e875dc1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade rolldown-vite

- [`9201535`](https://github.com/weapp-vite/weapp-vite/commit/92015355afe816d4ce2fa3925fb1f04aa0b8211b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade to rolldown 1.0.0-beta.16

- [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change website url

- Updated dependencies [[`a59845c`](https://github.com/weapp-vite/weapp-vite/commit/a59845c085a2484a29dd19d51ebef5f48e875dc1), [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51)]:
  - @weapp-core/init@2.0.2
  - @weapp-core/schematics@2.0.1

## 5.0.3

### Patch Changes

- [`7a8a130`](https://github.com/weapp-vite/weapp-vite/commit/7a8a130aff74304bb59ca9d2783783c81850c3f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#129](https://github.com/weapp-vite/weapp-vite/issues/129)

  修复 `autoImportComponents` 功能并未按预期自动导入并编译问题

- Updated dependencies [[`7a8a130`](https://github.com/weapp-vite/weapp-vite/commit/7a8a130aff74304bb59ca9d2783783c81850c3f0)]:
  - @weapp-core/shared@2.0.1
  - @weapp-core/init@2.0.1

## 5.0.2

### Patch Changes

- [`1ad45c3`](https://github.com/weapp-vite/weapp-vite/commit/1ad45c3f36e8e23a54b15afc81a0b81a94c7acb7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat(rolldown-require): add `rolldownOptions` `input` and `output` options
  - chore: set `rolldown` `outputOptions.exports` default value as `named`
- Updated dependencies [[`1ad45c3`](https://github.com/weapp-vite/weapp-vite/commit/1ad45c3f36e8e23a54b15afc81a0b81a94c7acb7)]:
  - rolldown-require@1.0.2

## 5.0.1

### Patch Changes

- Updated dependencies [[`e2cd39d`](https://github.com/weapp-vite/weapp-vite/commit/e2cd39def4b893c8f06be955fafe55744365b810)]:
  - rolldown-require@1.0.1

## 5.0.0

### Major Changes

- [`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 使用 tsdown 全面替换 tsup , 去除 esbuild 依赖
  feat!: use `rolldown-require` instead of `bundle-require` and remove `esbuild`

- [`8fcd092`](https://github.com/weapp-vite/weapp-vite/commit/8fcd092e06ab8807e2734016ec003ddab071e6e8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 全量切换到 rolldown-vite

  # weapp-vite 切换到 rolldown-vite

  迁移过程非常平滑，只改了部分 watcher 相关的使用代码的实现 (因为 rolldown watcher 没有 onCurrentRun 方法了)

  然后我以我一个复杂的测试案例进行性能测试，主包有 726 个模块，独立分包有 643 个模块，测试结果如下：

  整体平均构建时间提升：约 1.86 倍

  热更新平均构建时间提升：约 2.50 倍

  vite 的整体平均构建时间为 4302.26 ms, 构建热更新平均构建时间为 2216.58 ms

  切换到 rolldown-vite 后，整体平均构建时间为 2317.75 ms, 构建热更新平均构建时间为 887.56 ms

- [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 更多详情见:

  https://vite.icebreaker.top/migration/v5.htm

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef), [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4)]:
  - @weapp-core/init@2.0.0
  - @weapp-core/logger@2.0.0
  - @weapp-core/schematics@2.0.0
  - @weapp-core/shared@2.0.0
  - weapp-ide-cli@3.0.0

## 5.0.0-beta.0

### Major Changes

- [`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 使用 tsdown 全面替换 tsup , 去除 esbuild 依赖
  feat!: use `rolldown-require` instead of `bundle-require` and remove `esbuild`

- [`8fcd092`](https://github.com/weapp-vite/weapp-vite/commit/8fcd092e06ab8807e2734016ec003ddab071e6e8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 全量切换到 rolldown-vite

  # weapp-vite 切换到 rolldown-vite

  迁移过程非常平滑，只改了部分 watcher 相关的使用代码的实现 (因为 rolldown watcher 没有 onCurrentRun 方法了)

  然后我以我一个复杂的测试案例进行性能测试，主包有 726 个模块，独立分包有 643 个模块，测试结果如下：

  整体平均构建时间提升：约 1.86 倍

  热更新平均构建时间提升：约 2.50 倍

  vite 的整体平均构建时间为 4302.26 ms, 构建热更新平均构建时间为 2216.58 ms

  切换到 rolldown-vite 后，整体平均构建时间为 2317.75 ms, 构建热更新平均构建时间为 887.56 ms

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef)]:
  - @weapp-core/init@2.0.0-beta.0

## 4.1.2

### Patch Changes

- Updated dependencies [[`8c61a0f`](https://github.com/weapp-vite/weapp-vite/commit/8c61a0fb12298b90cf0f0aeebcea8d42aa2afd3a)]:
  - @weapp-core/init@1.2.2

## 4.1.1

### Patch Changes

- [`a9c1c9e`](https://github.com/weapp-vite/weapp-vite/commit/a9c1c9e3ff5e7312effa85c3be92eb6647b07fcc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 增加插件开发的 `export` 作为打包入口，同时编译到产物中去

- Updated dependencies [[`a9c1c9e`](https://github.com/weapp-vite/weapp-vite/commit/a9c1c9e3ff5e7312effa85c3be92eb6647b07fcc), [`953b105`](https://github.com/weapp-vite/weapp-vite/commit/953b105562fc559ddd811f8dfffcd71c19eedfde)]:
  - @weapp-core/init@1.2.1
  - @weapp-core/schematics@1.1.0

## 4.1.0

### Minor Changes

- [`512d3c7`](https://github.com/weapp-vite/weapp-vite/commit/512d3c76def28c90ec6d2f9f9e182595be39867b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 重构微信小程序 `worker` 的处理策略

  现在需要在 `vite.config.js` 中配置 `worker` 的路径，如：

  ```ts
  import { defineConfig } from "weapp-vite/config";

  export default defineConfig({
    weapp: {
      // ...
      worker: {
        entry: [
          // 不指定后缀，会去自动找 ts -> js
          "hello",
          // 指定后缀
          "index.ts",
          "other.js",
          // 此时 weapp-vite 会从你在 app.json 中设置的 workers.path 路径中去寻找打包入口
        ],
      },
    },
  });
  ```

  原先的策略是，直接默认以 app.json 中设置的 `workers.path` 所有的入口作为打包入口，发现存在问题，见 [#120](https://github.com/weapp-vite/weapp-vite/issues/120)

### Patch Changes

- Updated dependencies [[`1401bed`](https://github.com/weapp-vite/weapp-vite/commit/1401bedf00f722b1f03917b02481aafa456ac129)]:
  - @weapp-core/init@1.2.0

## 4.0.5

### Patch Changes

- [`23d8546`](https://github.com/weapp-vite/weapp-vite/commit/23d85469abe1f9ef9b1109e7e5f42e644e7e2580) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 设置 hashCharacters 为 base36

- [`b0fd143`](https://github.com/weapp-vite/weapp-vite/commit/b0fd1431a5d15d334159657cc40ac2ebe588b7bd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 独立的 worker 打包上下文

- [`f28335f`](https://github.com/weapp-vite/weapp-vite/commit/f28335fbeb7c82d5dedca739084031b4d3bbccc3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 额外添加监听器为了 worker 的 add 的情况

- [`c7622d0`](https://github.com/weapp-vite/weapp-vite/commit/c7622d05ca1d8c82be882793513b333896c34d96) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 强制所有系统使用 posix 操作符

- Updated dependencies [[`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a)]:
  - weapp-ide-cli@2.0.12

## 4.0.5-alpha.2

### Patch Changes

- [`f28335f`](https://github.com/weapp-vite/weapp-vite/commit/f28335fbeb7c82d5dedca739084031b4d3bbccc3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 额外添加监听器为了 worker 的 add 的情况

## 4.0.5-alpha.1

### Patch Changes

- [`23d8546`](https://github.com/weapp-vite/weapp-vite/commit/23d85469abe1f9ef9b1109e7e5f42e644e7e2580) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 设置 hashCharacters 为 base36

- [`c7622d0`](https://github.com/weapp-vite/weapp-vite/commit/c7622d05ca1d8c82be882793513b333896c34d96) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 强制所有系统使用 posix 操作符

- Updated dependencies [[`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a)]:
  - weapp-ide-cli@2.0.12-alpha.0

## 4.0.5-alpha.0

### Patch Changes

- [`b0fd143`](https://github.com/weapp-vite/weapp-vite/commit/b0fd1431a5d15d334159657cc40ac2ebe588b7bd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 独立的 worker 打包上下文

## 4.0.4

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b)]:
  - vite-plugin-performance@0.0.1
  - @weapp-vite/volar@0.0.1
  - @weapp-core/init@1.1.18
  - @weapp-core/logger@1.0.4
  - @weapp-core/schematics@1.0.13
  - @weapp-core/shared@1.0.8
  - weapp-ide-cli@2.0.11

## 4.0.3

### Patch Changes

- [`7488075`](https://github.com/weapp-vite/weapp-vite/commit/748807565cab801c031212f5663e243a05ee707f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 在 dist 中的静态资源被重复加载

## 4.0.2

### Patch Changes

- [`3b129f4`](https://github.com/weapp-vite/weapp-vite/commit/3b129f404f7b487e59e8c12e5e351061ec818ec3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加 `require.async` 支持

## 4.0.1

### Patch Changes

- [`93df132`](https://github.com/weapp-vite/weapp-vite/commit/93df1328e1e7e08a9e58a5e4dc614017cbc61928) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化热更新以及宽松不合法格式的判定

- [`8dde98a`](https://github.com/weapp-vite/weapp-vite/commit/8dde98a1f29ed53d6eb13a52279917dff9853184) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 优化 weapp-vite 的文件watch更新机制

## 4.0.0

### Major Changes

- [`bbd3334`](https://github.com/weapp-vite/weapp-vite/commit/bbd3334758fa3b6fb8fc0571957d2a4a51ab1a1c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 重构整个编译核心

### Patch Changes

- [`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更换 json $schema 引用地址以应对 dns 劫持污染

- [`d07eb7f`](https://github.com/weapp-vite/weapp-vite/commit/d07eb7fe4aea38e47b44d2851a2ad237dc206116) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化 npm service 的构建逻辑

- [`5702919`](https://github.com/weapp-vite/weapp-vite/commit/5702919ce463a096eb1ff5a72a100310f5af0de8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加 PQueue 队列处理 npm 构建，为了更好的性能

- [`e6facf1`](https://github.com/weapp-vite/weapp-vite/commit/e6facf18aa85ad9e66d4a41667688aeeb31b3a41) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 重构 ScanService

- [`3983ea5`](https://github.com/weapp-vite/weapp-vite/commit/3983ea552aa9b36ff4aea642aebc3f567d6e0a3d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 去除 subpackage service 改为编译时插件递归处理

- Updated dependencies [[`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0), [`bbd3334`](https://github.com/weapp-vite/weapp-vite/commit/bbd3334758fa3b6fb8fc0571957d2a4a51ab1a1c), [`3983ea5`](https://github.com/weapp-vite/weapp-vite/commit/3983ea552aa9b36ff4aea642aebc3f567d6e0a3d)]:
  - @weapp-core/schematics@1.0.12
  - @weapp-core/init@1.1.17
  - @weapp-core/shared@1.0.7

## 3.1.1

### Patch Changes

- [`eda1d33`](https://github.com/weapp-vite/weapp-vite/commit/eda1d332fdcc7c99930dff77d9af031d7b3a86f8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 命令行传入 -m,--mode 失效的问题

- Updated dependencies [[`e583052`](https://github.com/weapp-vite/weapp-vite/commit/e5830522ba086959ca5632a58e1d077a99ee0c56)]:
  - @weapp-core/schematics@1.0.11

## 3.1.0

### Minor Changes

- [`41eef22`](https://github.com/weapp-vite/weapp-vite/commit/41eef2287a91884e0869e6af33e5e4c34df1e4dc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 加入 vite-plugin-commonjs 专门处理 require, 其余默认走 import

## 3.0.2

### Patch Changes

- [`56f13e7`](https://github.com/weapp-vite/weapp-vite/commit/56f13e79f6ac2190ab7c2fa89aacda8ea106bb2f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add WeappVitePluginApi

## 3.0.1

### Patch Changes

- [`64ff2ed`](https://github.com/weapp-vite/weapp-vite/commit/64ff2edeef9c1361efb625e825abb187189de565) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: improve npm build

- [`759b29a`](https://github.com/weapp-vite/weapp-vite/commit/759b29a911e8679b40b64a75b2e285c54aeb9acc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: node builtin module as dep

## 3.0.0

### Major Changes

- [`08d2aa7`](https://github.com/weapp-vite/weapp-vite/commit/08d2aa7abf183dd13488feb5f93a3f36c3bae762) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade inversify from 6 to 7

- [`1943c86`](https://github.com/weapp-vite/weapp-vite/commit/1943c8634602a8a023d970e38895e6ae938656d6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade vite from 5 -> 6

### Patch Changes

- [`4c6ee88`](https://github.com/weapp-vite/weapp-vite/commit/4c6ee88b7952e31b3cd45d1f59b3275f52e42de3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: del remove subpackage miniprogram_npm

## 3.0.0-alpha.1

### Patch Changes

- [`4c6ee88`](https://github.com/weapp-vite/weapp-vite/commit/4c6ee88b7952e31b3cd45d1f59b3275f52e42de3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: del remove subpackage miniprogram_npm

## 3.0.0-alpha.0

### Major Changes

- [`08d2aa7`](https://github.com/weapp-vite/weapp-vite/commit/08d2aa7abf183dd13488feb5f93a3f36c3bae762) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade inversify from 6 to 7

- [`1943c86`](https://github.com/weapp-vite/weapp-vite/commit/1943c8634602a8a023d970e38895e6ae938656d6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade vite from 5 -> 6

## 2.1.6

### Patch Changes

- [`fca7a65`](https://github.com/weapp-vite/weapp-vite/commit/fca7a65144a8f9b10719e5de90ef0bdf61cddb9f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: weapp-vite 错误的把 workers 作为 asset 资源而不是 chunk

## 2.1.5

### Patch Changes

- [`b1b6ade`](https://github.com/weapp-vite/weapp-vite/commit/b1b6ade59768bbdcfc5dd571f16f66be8bc98423) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: worker source mess

## 2.1.4

### Patch Changes

- [`f374376`](https://github.com/weapp-vite/weapp-vite/commit/f3743761e393cc051e5fcc8b5eaa3e3b3a04ff4a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support /xx/xx and xx/xx import (js/wxml)

## 2.1.3

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`4907eae`](https://github.com/weapp-vite/weapp-vite/commit/4907eae52e0c5f3399c1468a0688f69a99f61f95), [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81)]:
  - @weapp-core/init@1.1.16
  - @weapp-core/logger@1.0.3
  - @weapp-core/schematics@1.0.10
  - @weapp-core/shared@1.0.6
  - weapp-ide-cli@2.0.10

## 2.1.2

### Patch Changes

- [`a688c38`](https://github.com/weapp-vite/weapp-vite/commit/a688c38ef90d668adecffc7be1efcb3601d30eff) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add css as supportedCssLangs

## 2.1.1

### Patch Changes

- [`5de179c`](https://github.com/weapp-vite/weapp-vite/commit/5de179cca0a57bc43b702cd5737e978c92f96c72) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 取消构建 npm 生成 sourcemap 同时降低语法版本，进行压缩

- Updated dependencies [[`f307755`](https://github.com/weapp-vite/weapp-vite/commit/f307755039eea6b316fe6918e9acf654f7e5c6b3)]:
  - @weapp-core/schematics@1.0.9

## 2.1.0

### Minor Changes

- [`fc3afe3`](https://github.com/weapp-vite/weapp-vite/commit/fc3afe361e404e6eabfe587edf073cfad1024e10) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support workers for bundle

### Patch Changes

- Updated dependencies [[`fc3afe3`](https://github.com/weapp-vite/weapp-vite/commit/fc3afe361e404e6eabfe587edf073cfad1024e10)]:
  - @weapp-core/schematics@1.0.8

## 2.0.2

### Patch Changes

- [`b32c939`](https://github.com/weapp-vite/weapp-vite/commit/b32c9395ba592a1ea176a553b693ac9c3bee89bf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: update deps
  fix: [#87](https://github.com/weapp-vite/weapp-vite/issues/87)
  fix: [#86](https://github.com/weapp-vite/weapp-vite/issues/86)
- Updated dependencies [[`b32c939`](https://github.com/weapp-vite/weapp-vite/commit/b32c9395ba592a1ea176a553b693ac9c3bee89bf)]:
  - weapp-ide-cli@2.0.9

## 2.0.1

### Patch Changes

- [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ---
  - chore: 更改模板组件行为
  - chore: weapp-vite 依赖项 resolve

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04), [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204), [`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2), [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020), [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35), [`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15
  - @weapp-core/shared@1.0.5

## 2.0.1-alpha.5

### Patch Changes

- Updated dependencies [[`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2)]:
  - @weapp-core/init@1.1.15-alpha.5

## 2.0.1-alpha.4

### Patch Changes

- Updated dependencies [[`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15-alpha.4

## 2.0.1-alpha.3

### Patch Changes

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04)]:
  - @weapp-core/init@1.1.15-alpha.3

## 2.0.1-alpha.2

### Patch Changes

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

- Updated dependencies [[`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35)]:
  - @weapp-core/shared@1.0.5-alpha.0
  - @weapp-core/init@1.1.15-alpha.2

## 2.0.1-alpha.1

### Patch Changes

- Updated dependencies [[`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020)]:
  - @weapp-core/init@1.1.15-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ---
  - chore: 更改模板组件行为
  - chore: weapp-vite 依赖项 resolve

- Updated dependencies [[`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204)]:
  - @weapp-core/init@1.1.15-alpha.0

## 2.0.0

### Major Changes

- [`1335093`](https://github.com/weapp-vite/weapp-vite/commit/13350939181bf2b289b1954b00c608cd5013be66) Thanks [@sonofmagic](https://github.com/sonofmagic)! - # Breaking Changes
  - 现在添加了静态的 `wxml` 分析引擎，会自动分析所有引入的组件，页面, 以及 `<import/>`, `<include/>` 标签等等，所以现在不会默认复制所有的 `wxml` 文件到编译目录 `dist` 目录下

### Patch Changes

- Updated dependencies [[`8ddfc97`](https://github.com/weapp-vite/weapp-vite/commit/8ddfc97a5706a25fa146b10fa43b7dc626a9f893)]:
  - @weapp-core/init@1.1.14

## 1.9.3

### Patch Changes

- [`7a40299`](https://github.com/weapp-vite/weapp-vite/commit/7a402997b471a3ce31584121c25fcd6f7a2f7b9d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 使用 JSON.TS 生成 JSON 时存在的问题

- Updated dependencies [[`0af89c5`](https://github.com/weapp-vite/weapp-vite/commit/0af89c5837046dfca548d62427adba9b4afc2d6a)]:
  - @weapp-core/logger@1.0.2
  - @weapp-core/init@1.1.13
  - weapp-ide-cli@2.0.8

## 1.9.2

### Patch Changes

- [`4bfc306`](https://github.com/weapp-vite/weapp-vite/commit/4bfc306706a6e187c40487a2b4b0be6f47def031) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: auto import glob issue

## 1.9.1

### Patch Changes

- [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support multi-platform software

- [`258d915`](https://github.com/weapp-vite/weapp-vite/commit/258d915b2fb044df4884d69260d76bed5217de6a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自定义 wxss 指令来跳过 scss,less,postcss-import 的编译

- [`3e55905`](https://github.com/weapp-vite/weapp-vite/commit/3e559054258cd607746b319a5f271650020fe3b9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support wxml #ifdef and #endif

- [`0cd9365`](https://github.com/weapp-vite/weapp-vite/commit/0cd936514022d3ce5464f588a126f37f9a0372f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加条件编译样式的插件

- Updated dependencies [[`c2f29a1`](https://github.com/weapp-vite/weapp-vite/commit/c2f29a15a651389175fbe7cb5c6e1644bcaafd1c), [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af)]:
  - @weapp-core/init@1.1.12
  - weapp-ide-cli@2.0.7

## 1.9.0

### Minor Changes

- [`c05dc77`](https://github.com/weapp-vite/weapp-vite/commit/c05dc7720cc8cd7c921a5ba7a97221941c91cadb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: release auto import components

## 1.8.4

### Patch Changes

- [`27fe9bb`](https://github.com/weapp-vite/weapp-vite/commit/27fe9bb31dffdb43387326f7a2d5db004e825622) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自动导入 vant 和 tdesign 组件

## 1.8.3

### Patch Changes

- [`d62c59b`](https://github.com/weapp-vite/weapp-vite/commit/d62c59b415b73a31a6c99369d460bfd80b11b596) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add TDesignResolver for auto-import

## 1.8.2

### Patch Changes

- [`a7f1f21`](https://github.com/weapp-vite/weapp-vite/commit/a7f1f21c2952b4b2f5c1fa822cba32671fe8af80) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 开放 auto import 组件功能

- [`145e036`](https://github.com/weapp-vite/weapp-vite/commit/145e03624e6e205f8bd314ec4220e289d9a526f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add entry type

- Updated dependencies [[`145e036`](https://github.com/weapp-vite/weapp-vite/commit/145e03624e6e205f8bd314ec4220e289d9a526f4)]:
  - @weapp-core/schematics@1.0.7

## 1.8.1

### Patch Changes

- [`239b5f0`](https://github.com/weapp-vite/weapp-vite/commit/239b5f0e3f2b8905fba86ca8c754174c82f5c1c4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build npm env default 'production'

## 1.8.0

### Minor Changes

- [`9bb7be0`](https://github.com/weapp-vite/weapp-vite/commit/9bb7be0acd28381404cfd06b3f44472d8dd17b90) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 更改 wxml,wxs 以及静态资源文件的构建时序

### Patch Changes

- [`cc9d70f`](https://github.com/weapp-vite/weapp-vite/commit/cc9d70fa8b359fe0202cac32eb36d20cf6b065bc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 生成脚手架支持 dirs 和 filenames 配置

- [`53739f1`](https://github.com/weapp-vite/weapp-vite/commit/53739f1f5c298572f2d7bcde49140041b87f9c54) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#64](https://github.com/weapp-vite/weapp-vite/issues/64)

- Updated dependencies [[`cc9d70f`](https://github.com/weapp-vite/weapp-vite/commit/cc9d70fa8b359fe0202cac32eb36d20cf6b065bc), [`5735e56`](https://github.com/weapp-vite/weapp-vite/commit/5735e5651a793611489afbbd7982241b6792f8fc)]:
  - @weapp-core/schematics@1.0.6
  - @weapp-core/init@1.1.11

## 1.7.8

### Patch Changes

- [`7afc501`](https://github.com/weapp-vite/weapp-vite/commit/7afc501752c3f1a6ab839502233801bb7cd26c60) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 尝试修复热更新文件无限递归调用导致栈溢出的问题

## 1.7.7

### Patch Changes

- [`b794a55`](https://github.com/weapp-vite/weapp-vite/commit/b794a5562095c4f058e35c62928eec4f6c0fe55e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#59](https://github.com/weapp-vite/weapp-vite/issues/59)
  feat: 优化清空目录的方式

## 1.7.6

### Patch Changes

- [`9daa971`](https://github.com/weapp-vite/weapp-vite/commit/9daa971ffb8a2ffec3e26e7e186b8d75708a8cf0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 支持内联 wxs 引入其他的 wxs 文件

- Updated dependencies [[`9daa971`](https://github.com/weapp-vite/weapp-vite/commit/9daa971ffb8a2ffec3e26e7e186b8d75708a8cf0)]:
  - @weapp-core/init@1.1.10

## 1.7.5

### Patch Changes

- [`795cdef`](https://github.com/weapp-vite/weapp-vite/commit/795cdef24c3edf08441b38832cd1305ed2a69e63) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持文件夹index文件自动寻址

## 1.7.4

### Patch Changes

- [`1a7d4c0`](https://github.com/weapp-vite/weapp-vite/commit/1a7d4c0e6406626317bb76a095d6759ae94d9d3e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add vite as dependencies

- Updated dependencies [[`53d5903`](https://github.com/weapp-vite/weapp-vite/commit/53d5903cf60e7b2316bdbc6d9dcadac16a7517bf)]:
  - @weapp-core/init@1.1.9

## 1.7.3

### Patch Changes

- [`29d4c63`](https://github.com/weapp-vite/weapp-vite/commit/29d4c63ec26fb061a20e70bb698c8df90e7308c5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化日志和构建hook的显示

## 1.7.2

### Patch Changes

- [`7fe8291`](https://github.com/weapp-vite/weapp-vite/commit/7fe829157b6609f0801338e6ac165271644ccc04) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 watch 热更新问题

## 1.7.1

### Patch Changes

- [`4bc81a1`](https://github.com/weapp-vite/weapp-vite/commit/4bc81a13712769de7662f216700c5c67592711c6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: wxs 增强支持分析与提取

- Updated dependencies [[`7f9c36a`](https://github.com/weapp-vite/weapp-vite/commit/7f9c36a30e41b4a2b95e61080f645b7c169fe847), [`c11d076`](https://github.com/weapp-vite/weapp-vite/commit/c11d07684c4592700a1141f2dc83dc3ce08c6676)]:
  - @weapp-core/init@1.1.8
  - @weapp-core/shared@1.0.4

## 1.7.0

### Minor Changes

- [`ace78e9`](https://github.com/weapp-vite/weapp-vite/commit/ace78e9c9d8ec82942f14d41bed293484bba765f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 增加 wxml 增强模式,支持 @ 加修饰符写法

### Patch Changes

- [`57f2d21`](https://github.com/weapp-vite/weapp-vite/commit/57f2d217e95b48815cd8293ac35de354ffb69d1b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持独立分包拥有自己的构建依赖配置

## 1.6.9

### Patch Changes

- [`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持 Skyline 全局工具栏 appBar

- Updated dependencies [[`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52)]:
  - @weapp-core/schematics@1.0.5
  - @weapp-core/init@1.1.7

## 1.6.8

### Patch Changes

- [`33933ad`](https://github.com/weapp-vite/weapp-vite/commit/33933ad2059a142a28df488bffbf6939d2f6ad1b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 独立分包支持构建 npm

- Updated dependencies [[`33933ad`](https://github.com/weapp-vite/weapp-vite/commit/33933ad2059a142a28df488bffbf6939d2f6ad1b)]:
  - @weapp-core/schematics@1.0.4

## 1.6.7

### Patch Changes

- [`4b7b64a`](https://github.com/weapp-vite/weapp-vite/commit/4b7b64a692e5cb700160452f0f1b3b021408d507) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持在 json.[jt]s 中传入上下文和编译变量

## 1.6.6

### Patch Changes

- [`4f95b16`](https://github.com/weapp-vite/weapp-vite/commit/4f95b16923d5e9646aec6cf8d726316e2d5ab0ec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat: 支持 html 作为 wxml 的后缀，以便复用 html 相关的插件和工具链
  - chore: 更新相关依赖包

## 1.6.5

### Patch Changes

- [`d818041`](https://github.com/weapp-vite/weapp-vite/commit/d8180411fb76102c6a0f792e90246715880993ad) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: dts 中对于 vite/client 的继承和智能提示

- Updated dependencies [[`d818041`](https://github.com/weapp-vite/weapp-vite/commit/d8180411fb76102c6a0f792e90246715880993ad)]:
  - @weapp-core/init@1.1.6

## 1.6.4

### Patch Changes

- [`5488a42`](https://github.com/weapp-vite/weapp-vite/commit/5488a42dcd9b6848f29c9f0ac5797d3330165901) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持使用 ts/js 来配置 json 文件 index.json.ts/js

- [`1170293`](https://github.com/weapp-vite/weapp-vite/commit/117029308b4740e84b3efbf0413f8dda7abea796) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加 copy 配置项

- Updated dependencies [[`5488a42`](https://github.com/weapp-vite/weapp-vite/commit/5488a42dcd9b6848f29c9f0ac5797d3330165901), [`1825f02`](https://github.com/weapp-vite/weapp-vite/commit/1825f024172dfeb357536c0aaeba6c4d53d97196)]:
  - @weapp-core/schematics@1.0.3
  - @weapp-core/init@1.1.5

## 1.6.3

### Patch Changes

- [`e7a95cd`](https://github.com/weapp-vite/weapp-vite/commit/e7a95cd26f5c94e3ef95c82dfd8e8fe11e356c85) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复多个分包提前返回的场景

## 1.6.2

### Patch Changes

- [`583b913`](https://github.com/weapp-vite/weapp-vite/commit/583b913212c5e5b080975a5e946f8d0ea6828aa7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add weapp.tsconfigPaths for tsconfigPaths plugin

- Updated dependencies [[`583b913`](https://github.com/weapp-vite/weapp-vite/commit/583b913212c5e5b080975a5e946f8d0ea6828aa7)]:
  - @weapp-core/init@1.1.4

## 1.6.1

### Patch Changes

- [`f0523bc`](https://github.com/weapp-vite/weapp-vite/commit/f0523bc120655282fa411380c8fc227632f1460e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 支持自定义 custom-tab-bar, 需要设置 tabBar.custom 为 true 来开启

- Updated dependencies [[`f0523bc`](https://github.com/weapp-vite/weapp-vite/commit/f0523bc120655282fa411380c8fc227632f1460e), [`228e4d2`](https://github.com/weapp-vite/weapp-vite/commit/228e4d2a9f780c018b13e91e15d1057d3c1360e0)]:
  - @weapp-core/schematics@1.0.2
  - @weapp-core/init@1.1.3

## 1.6.0

### Minor Changes

- [`5326cfc`](https://github.com/weapp-vite/weapp-vite/commit/5326cfc8a2d55d50414d557b15cf376cf36449d0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 去除 chokidar 和 watch 选项，改用 vite 内置的 watcher

## 1.5.6

### Patch Changes

- Updated dependencies [[`401fc58`](https://github.com/weapp-vite/weapp-vite/commit/401fc584fad1c884ac8f276f3dc4daccde9fe659)]:
  - @weapp-core/init@1.1.2

## 1.5.5

### Patch Changes

- [`df1303b`](https://github.com/weapp-vite/weapp-vite/commit/df1303bfbeef5613524b07142d1493aeb3c471f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 打包产物消失的问题

## 1.5.4

### Patch Changes

- [`2e6baf1`](https://github.com/weapp-vite/weapp-vite/commit/2e6baf1e0001477ca1d3df7ea67a5327533da196) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 删除不正确的依赖项

## 1.5.3

### Patch Changes

- Updated dependencies [[`bc9f19d`](https://github.com/weapp-vite/weapp-vite/commit/bc9f19dcf73e38b6b8a835a3e4660980eb1d9a7b)]:
  - @weapp-core/init@1.1.1

## 1.5.2

### Patch Changes

- [`8804452`](https://github.com/weapp-vite/weapp-vite/commit/8804452270184c7eb48d409ca2ec49e5b4d7599f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 分包 json 文件 copy 与 build 清空逻辑修复

## 1.5.1

### Patch Changes

- [`29dbbdc`](https://github.com/weapp-vite/weapp-vite/commit/29dbbdc356915e4778baccf6ec2f5ba67dd01781) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 添加 sitemap.json 和 theme.json 支持

- Updated dependencies [[`e0f4c38`](https://github.com/weapp-vite/weapp-vite/commit/e0f4c386823ec99c653ad2b5e1cbf4344ac632b4), [`e428516`](https://github.com/weapp-vite/weapp-vite/commit/e428516fd993bd9b4081c12773d614bf30fd48cd)]:
  - @weapp-core/schematics@1.0.1
  - @weapp-core/init@1.1.0

## 1.5.0

### Minor Changes

- [`95e195c`](https://github.com/weapp-vite/weapp-vite/commit/95e195c0400438833e63417c90030f5e296b5d29) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加生成脚手架功能

### Patch Changes

- Updated dependencies [[`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e), [`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e)]:
  - @weapp-core/init@1.0.9
  - @weapp-core/schematics@1.0.0

## 1.4.5

### Patch Changes

- [`518046e`](https://github.com/weapp-vite/weapp-vite/commit/518046ec1cd9e6bc132f8a7dea03d73962c20f31) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 直接执行 `npx weapp init` 会报出 `typescript` 找不到错误的问题

## 1.4.4

### Patch Changes

- Updated dependencies [[`1596334`](https://github.com/weapp-vite/weapp-vite/commit/159633422903bf3b5a5a3015bc0c495ec672c308)]:
  - @weapp-core/shared@1.0.3
  - @weapp-core/init@1.0.8

## 1.4.3

### Patch Changes

- [`90ecbab`](https://github.com/weapp-vite/weapp-vite/commit/90ecbabb3b5d0c6b276670c26bc10de60ac5c237) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自动处理分包 `entry` 文件后缀

## 1.4.2

### Patch Changes

- [`9831c09`](https://github.com/weapp-vite/weapp-vite/commit/9831c097e0344a7313a6185f3672ce28ed645d42) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 允许在 json 里的 usingComponents 使用别名

- Updated dependencies [[`e15adce`](https://github.com/weapp-vite/weapp-vite/commit/e15adce483e9b47ef836680df49321db5431ac31)]:
  - @weapp-core/shared@1.0.2
  - @weapp-core/init@1.0.7

## 1.4.1

### Patch Changes

- [`c6d3b43`](https://github.com/weapp-vite/weapp-vite/commit/c6d3b43aba1d465f8353cde04d21113e0766ed8d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix:

- Updated dependencies [[`c6d3b43`](https://github.com/weapp-vite/weapp-vite/commit/c6d3b43aba1d465f8353cde04d21113e0766ed8d)]:
  - @weapp-core/init@1.0.6

## 1.4.0

### Minor Changes

- [`a5e2cbe`](https://github.com/weapp-vite/weapp-vite/commit/a5e2cbe3e811e89accc5932cb8e0a5d3ad3322b7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - <br/>
  - feat: 独立分包单独进行构建
  - feat: 配置 `json` 支持注释

## 1.3.4

### Patch Changes

- [`7a249e7`](https://github.com/weapp-vite/weapp-vite/commit/7a249e7903cbf27e28aa3583e035707f1e433bcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加 watcher 输出日志

## 1.3.3

### Patch Changes

- [`b480be8`](https://github.com/weapp-vite/weapp-vite/commit/b480be86bd1ece7f6eec2e873d44f4883a62ea50) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 envDir 配置选项

## 1.3.2

### Patch Changes

- [`f905c14`](https://github.com/weapp-vite/weapp-vite/commit/f905c140f20b22583c8a2b713f73c46bdf927b1f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: json 文件重复 emit 问题

## 1.3.1

### Patch Changes

- [`dae031f`](https://github.com/weapp-vite/weapp-vite/commit/dae031f2e2c6aa319c1fb6d4537182495433c722) Thanks [@sonofmagic](https://github.com/sonofmagic)! - refactor: 整理依赖项提交

## 1.3.0

### Minor Changes

- [`b52d53a`](https://github.com/weapp-vite/weapp-vite/commit/b52d53ac848823b51e293c2e9318d82cc7d003f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 改进现有的依赖分析算法

## 1.2.5

### Patch Changes

- Updated dependencies [[`374bd9d`](https://github.com/weapp-vite/weapp-vite/commit/374bd9d22ad9df1aac65338f741b6fcc70bd342c)]:
  - @weapp-core/init@1.0.5

## 1.2.4

### Patch Changes

- [`8fe26ae`](https://github.com/weapp-vite/weapp-vite/commit/8fe26ae86f1365f46a2242e616441c7cfd7c7926) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 build 构建后不停止的问题

- Updated dependencies [[`8fe26ae`](https://github.com/weapp-vite/weapp-vite/commit/8fe26ae86f1365f46a2242e616441c7cfd7c7926)]:
  - weapp-ide-cli@2.0.6

## 1.2.3

### Patch Changes

- [`3499363`](https://github.com/weapp-vite/weapp-vite/commit/34993636a593f95b349007befbf228c4449551a9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: npm 包构建报错问题

## 1.2.2

### Patch Changes

- [`a0b7eb9`](https://github.com/weapp-vite/weapp-vite/commit/a0b7eb98a54ba80ebe3da439908be521a1121a75) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 build 会 watch 和依赖死循环问题

## 1.2.1

### Patch Changes

- [`db848f9`](https://github.com/weapp-vite/weapp-vite/commit/db848f929ba144ec82a87d37c7195d98c93b92d8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 使用 fdir 替换 klaw for better performance

## 1.2.0

### Minor Changes

- [`aa14554`](https://github.com/weapp-vite/weapp-vite/commit/aa14554bc6c5dec7ca56f0a70368e6b612dc9cca) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加自动构建 npm 算法

## 1.1.7

### Patch Changes

- [`1df6bab`](https://github.com/weapp-vite/weapp-vite/commit/1df6baba4419816260ae4e144e32331edba08ee8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复不正确的 wxss 产物路径问题

## 1.1.6

### Patch Changes

- [`de1b0f2`](https://github.com/weapp-vite/weapp-vite/commit/de1b0f2f88a37f0ea04f10787100ab5f3a36c192) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#6](https://github.com/weapp-vite/weapp-vite/issues/6) 由于 `typescript` 文件作为入口的时候，`css` 样式文件没有被正确的处理 导致的这个问题

## 1.1.5

### Patch Changes

- [`5cc86a5`](https://github.com/weapp-vite/weapp-vite/commit/5cc86a5be6eb7caa6bedbf586f04489ad90d0411) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: dist watch 目录无限死循环问题

## 1.1.4

### Patch Changes

- [`584fe62`](https://github.com/weapp-vite/weapp-vite/commit/584fe6211f14d88779a711edba72e682b24ac59f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: css preprocessCSS error

## 1.1.3

### Patch Changes

- Updated dependencies [[`c0146d3`](https://github.com/weapp-vite/weapp-vite/commit/c0146d31304f35db5b3a03aa9f9497ed46688730)]:
  - @weapp-core/init@1.0.4
  - weapp-ide-cli@2.0.5

## 1.1.2

### Patch Changes

- [`598753c`](https://github.com/weapp-vite/weapp-vite/commit/598753ced4f0c40ec971b28a4e98e4a18b35525a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: deps upgrade

- Updated dependencies [[`598753c`](https://github.com/weapp-vite/weapp-vite/commit/598753ced4f0c40ec971b28a4e98e4a18b35525a)]:
  - weapp-ide-cli@2.0.4

## 1.1.1

### Patch Changes

- [`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Date: 2024-09-01
  - 重构 `vite` 上下文的实现
  - 优化自定义的路径的显示效果

- Updated dependencies [[`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8)]:
  - weapp-ide-cli@2.0.3
  - @weapp-core/init@1.0.3

## 1.1.0

### Minor Changes

- [`5507cd8`](https://github.com/sonofmagic/weapp-tailwindcss/commit/5507cd8c38fc0f0821548cb1f8382ae8e9d5fbf9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - support cli mode param

  releated: https://github.com/sonofmagic/weapp-tailwindcss/discussions/369

## 1.0.6

### Patch Changes

- Updated dependencies [6f469c3]
  - weapp-ide-cli@2.0.2

## 1.0.3

### Patch Changes

- fbb1ed7: 修复 `@weapp-core/init` 和 `weapp-vite` 的一些问题
- Updated dependencies [fbb1ed7]
  - @weapp-core/init@1.0.2

## 1.0.2

### Patch Changes

- f7a2d5d: fix: watcher do not close error
- Updated dependencies [f7a2d5d]
  - @weapp-core/init@1.0.1
  - @weapp-core/logger@1.0.1
  - @weapp-core/shared@1.0.1
  - weapp-ide-cli@2.0.1

## 1.0.1

### Patch Changes

- 2e458bb: fix: Cannot find module `weapp-vite/config` error

## 1.0.0

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- 80ce9ca: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- 0fc5083: release alpha
- f22c535: chore: compact for `weapp-vite`
- 2b7be6d: feat: add serve watch files
- Updated dependencies [80ce9ca]
- Updated dependencies [0fc5083]
- Updated dependencies [f22c535]
- Updated dependencies [36f5a7c]
- Updated dependencies [2b7be6d]
  - weapp-ide-cli@2.0.0
  - @weapp-core/shared@1.0.0
  - @weapp-core/init@1.0.0
  - @weapp-core/logger@1.0.0

## 1.0.0-alpha.4

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- Updated dependencies [36f5a7c]
  - @weapp-core/logger@1.0.0-alpha.1
  - @weapp-core/shared@1.0.0-alpha.4
  - @weapp-core/init@1.0.0-alpha.4
  - weapp-ide-cli@2.0.0-alpha.2

## 0.0.2-alpha.3

### Patch Changes

- 792f50c: chore: compact for `weapp-vite`
- Updated dependencies [792f50c]
  - weapp-ide-cli@2.0.0-alpha.1
  - @weapp-core/logger@0.0.1-alpha.0
  - @weapp-core/shared@0.0.2-alpha.3
  - @weapp-core/init@0.0.2-alpha.3

## 0.0.2-alpha.2

### Patch Changes

- ffa21da: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- Updated dependencies [ffa21da]
  - weapp-ide-cli@2.0.0-alpha.0
  - @weapp-core/shared@0.0.2-alpha.2
  - @weapp-core/init@0.0.2-alpha.2

## 0.0.2-alpha.1

### Patch Changes

- a4adb3f: feat: add serve watch files
- Updated dependencies [a4adb3f]
  - @weapp-core/shared@0.0.2-alpha.1
  - @weapp-core/init@0.0.2-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- f28a193: release alpha
- Updated dependencies [f28a193]
  - @weapp-core/shared@0.0.2-alpha.0
  - @weapp-core/init@0.0.2-alpha.0

## 0.0.1

### Patch Changes

- f01681a: release version
- Updated dependencies [f01681a]
  - @weapp-core/shared@0.0.1
  - @weapp-core/init@0.0.1
