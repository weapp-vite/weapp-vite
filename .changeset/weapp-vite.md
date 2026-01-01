---
"weapp-vite": major
---

## disable-auto-routes-when-off

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
  plugins: [/* 旧 Vue 插件 */],
})
```

**现在（内置支持）：**
```typescript
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
  },
  // Vue 文件自动处理，无需额外配置
})
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
