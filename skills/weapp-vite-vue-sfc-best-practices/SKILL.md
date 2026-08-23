---
name: weapp-vite-vue-sfc-best-practices
description: 面向使用 weapp-vite 的小程序项目的 Vue SFC 实践手册，覆盖 script setup、纯模板 SFC、JSON 宏、`definePageMeta`/layout、`defineModel`、`usingComponents`、内置 i18n Behavior、JSX/TSX script block、模板指令兼容、多平台 SFC、`.weapp-vite` 类型支持文件与受管 `prepare` 工作流。
---

# weapp-vite-vue-sfc-best-practices

## 用途

在小程序项目里用 Vue SFC 写出“编译可预测、运行时可验证、类型可跟上”的页面和组件。

## 何时使用

- 用户问 `.vue` 文件应该怎么写。
- 用户问 JSON 宏和 `<json>` 怎么选。
- 用户问 `definePageMeta` / layout 怎么配。
- 用户遇到模板兼容或编译错误。
- 用户遇到 `.weapp-vite` 类型输出、组件声明或 route type 漂移。
- 用户要在微信小程序与 Web 中使用 Wot UI、uview-plus 等 uni-app Vue SFC 组件库。
- 用户要使用纯模板 `.vue`、`<script lang="jsx">` / `<script setup lang="tsx">`，或处理多平台 SFC 编译差异。

## 不适用场景

本 skill 聚焦 SFC 编写和编译期兼容。

- 项目级构建配置：使用 `weapp-vite-best-practices`。
- `wevu` 生命周期和 store：使用 `wevu-best-practices`。
- 迁移规划：使用 `native-to-weapp-vite-wevu-migration`。
- 项目启用 `weapp.react` 后的 React JSX/TSX：使用 `weapp-vite-react-best-practices`。

## 核心流程

1. 先判定问题阶段：
   - 编译期：宏、模板、`usingComponents`
   - 运行期：事件、hooks、响应式
   - 工具层：Volar、`.weapp-vite`、typed outputs
2. 默认使用 `<script setup lang="ts">`。
   - 纯模板 SFC 允许没有 script block；`wv prepare` 必须按 SFC 模板扫描，不能把模板文本误交给 JSX parser。
   - Wevu JSX/TSX 与 SFC 内 JSX/TSX 归 Wevu compiler；项目级 `weapp.react` 启用后，独立 `.jsx/.tsx` 归 React owner。
3. JSON 优先走宏：`defineAppJson`、`definePageJson`、`defineComponentJson`；页面元信息走 `definePageMeta`。
4. 套用模板兼容规则：
   - `v-model` 只能作用于可赋值左值
   - 不要假设 Web Vue 的所有模板特性都可用
   - `usingComponents` 走 JSON 宏 / 自动导入，不走 Web Vue 注册思路
   - 第三方小程序 UI 库（如 TDesign Mini Program、Vant Weapp）文档中的 `TNode`、`slot`、自定义内容通常是小程序原生 slot 或属性渲染，不要默认按 Vue scoped slot 处理
   - 第三方 uni-app Vue SFC 组件库与原生小程序 UI 库不是同一路径：前者需要 resolver 返回 `sourceType: 'wevu-sfc'` / 真实 `resolvedId`，并通过 `weapp.uniApp.include` 显式允许依赖转换
   - 只有存在明确 slot props（如 `<template #item="{ item }">`）或显式增强作用域插槽场景时，才应生成 `generic:scoped-slots-*`
   - 转发 `<slot />` 到子组件具名插槽时不要生成或建议 `<block slot="..."><slot /></block>`；真实 DevTools 运行时会丢失转发内容。微信平台默认使用内部 `virtualHost` wrapper，需要回到旧版真实节点行为时配置 `weapp.vue.template.slotFallbackWrapperStrategy: 'view'`，需要自定义时优先用组件内静态属性 `slot-wrapper="cover-view"`、`slot-wrapper-footer="view"`、`slot-wrapper-class="..."`、`slot-wrapper-footer-class="..."` 或项目配置 `weapp.vue.template.slotFallbackWrapper`；全局规则里 `component` 匹配模板标签名，`componentName` 匹配子组件静态 `defineOptions({ name })`
   - 自定义 slot wrapper 必须能承载实际子内容；例如 `text` 不适合包裹 `<view>`，`block` 会被编译器回退为 `view`
   - Vue/Wevu 组件标签输出保持 kebab-case；可选链与空值合并必须转换成目标小程序模板可执行的表达式
   - 启用 `weapp.i18n` 时，从 `weapp-vite/i18n` 导入构建实例 `i18n`，并用 `defineOptions({ behaviors: [i18n.behavior] })` 显式接入；逻辑层通过 `i18n.global` 访问翻译和 locale，模板可直接调用配置的 `t(...)`
   - i18n 只放行配置函数的直接模板调用；`t(resolveKey())` 或其他嵌套调用仍回退逻辑线程，不要依赖任意函数在 WXML 中执行
   - 微信目标支持 scoped CSS、默认/命名 CSS Modules、同步 setup 中的 `useCssModule()` 与 CSS `v-bind()`；CSS vars 会合并到每个模板根节点已有 style
   - `:deep()` / `:global()` / `:slotted()` 只使用可映射到小程序选择器的形式；其他平台在对应 IDE/真机验证前按实验性处理
5. 若 `typed-router.d.ts`、`typed-components.d.ts`、`components.d.ts` 漂移，先跑 `wv prepare`。
6. 若项目有根 `AGENTS.md` 或本地 `dist/docs/vue-sfc.md`，SFC 写法要与其约束一致。
7. 多平台 SFC 每次只验证一个 `-p <platform>` 目标；Web runtime 用于浏览器兼容联调，不替代目标小程序 IDE/真机。

## 工具链与热更新边界

- Volar 类型问题先检查 `.weapp-vite/tsconfig.app.json`、solution references 和 `vueCompilerOptions.plugins`；不要用根目录隐式包含替代受管配置。
- `skipTemplateCodegen` 会让模板绑定和 WXS 类型离开模板上下文，出现“属性不存在”时先排除该配置。
- 只有 JSON 宏或配置发生变化时才依赖 JSON-only HMR；行为、模板和运行时变化仍按完整 SFC 编译链验证。
- `defineConfig` 推荐从 `weapp-vite/config` 导入，以保留 `weapp.*` 的上下文类型和 Hover 文档。

详细矩阵见 `references/tooling-and-hmr-matrix.md`。

## 约束

- 不要在一个 SFC 里混多套 JSON 宏。
- 不要把小程序组件注册当成 Web Vue 组件注册。
- 不要只配置 Wot UI 或 uview-plus resolver 而遗漏 `weapp.uniApp.include`，也不要把 npm 依赖自动加入转换范围。uview-plus 应调用 `mount$u()` 并同步 `$u`，不要走 Web 全局组件注册流程。
- 不要把 `t-*`、`van-*` 等 kebab-case 第三方原生组件的普通默认插槽误判为增强作用域插槽。
- 不要忽略 `prepare` 和 `.weapp-vite` 产物。
- 不要在修 SFC 语法时顺手做无关运行时重构。
- 不要把内置 i18n 当作 ICU/MessageFormat runtime；v1 只支持简单 key 查询和 `{name}` / `{user.name}` 插值。

## 输出

应用本 skill 时，输出必须包含：

- 问题阶段诊断。
- SFC 级改动建议。
- 模板兼容注意点。
- 最小验证命令。

## 完成标记

- 宏使用清晰且单一。
- 模板没有踩不支持语法。
- `usingComponents` 路径安全、来源明确。
- `.weapp-vite` 支持文件和类型输出已同步。

## 参考资料

- `references/macro-config-checklist.md`
- `references/template-compat-matrix.md`
- `references/troubleshooting-playbook.md`
- `references/tooling-and-hmr-matrix.md`
