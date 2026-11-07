---
name: weapp-vite-vue-sfc-best-practices
description: 面向使用 weapp-vite 的小程序项目的 Vue SFC 实践手册，覆盖 script setup、纯模板 SFC、JSON 宏、`definePageMeta`/layout、`defineModel`、`usingComponents`、内置 i18n Behavior、JSX/TSX script block、模板指令兼容、多平台 SFC、`.weapp-vite` 类型支持文件与受管 `prepare` 工作流。
---

# weapp-vite-vue-sfc-best-practices

## 用途

在小程序项目里用 Vue SFC 写出“编译可预测、运行时可验证、类型可跟上”的页面和组件。

## 包与资料边界

- 本 skill 随 `weapp-vite` 提供，负责 SFC 编译、宏、模板和类型支持；本地资料为 `node_modules/weapp-vite/dist/docs/vue-sfc.md`，本文 `references/` 相对本 skill。无需框架源码仓库或其他 skill。
- 纯模板 SFC 可先检查编译与声明；使用 `<script setup>` 中的响应式、生命周期、事件、store、router、`useCssModule()` 等 Wevu runtime API 时，项目须显式安装 `wevu`，这些运行时能力不由 `weapp-vite` 包替代。
- React 项目需要显式安装 `@weapp-vite/react` 及其 peer dependencies；Wot UI、uview-plus、原生 UI 库和 Web runtime 只在相应工作流中安装。其他 skill 仅在已安装时作为可选分流。
- 验证先读消费项目的 `package.json`，使用其已有 typecheck、build 和相关测试 scripts；CLI 示例中的 `wv` 指本地 `weapp-vite`（可用 `pnpm exec wv`）。不要求框架包构建、仓库 E2E 或发布流程。

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

1. 先确定只读诊断或实施范围，读取目标 SFC、同文件 JSON、组件注册、相关配置与项目 scripts；记录已安装 `weapp-vite`、实际使用的 runtime/组件库、Node、包管理器和构建工具版本。选定单一平台；需要运行观察时再记录实际 IDE、基础库与 renderer，缺失项不猜测。按问题阶段进入：
   - 模板/JSON/宏：先确认 App/Page/Component 角色及现有写法，按 `references/macro-config-checklist.md`、`references/template-compat-matrix.md` 修改；纯模板不因将来可能用 `ref` 就安装 runtime。检查同文件配置生成的 JSON、目标模板与路由归属。
   - 组件/插槽/多平台：带上真实 `usingComponents`、resolver 结果和目标配置，对照模板兼容规则；依赖未安装或目标能力未确认时停止对应接入。检查注册路径、slot 产物，再在该目标观察内容、事件与样式，不由其他平台外推。
   - 类型/prepare/HMR：带上 `.weapp-vite`、Volar/TypeScript 版本及诊断，进入 `references/tooling-and-hmr-matrix.md`；检查 prepare 声明和已有 typecheck，JSON-only 与完整 SFC 更新分开观察，声明成功不代表页面更新。
   - 响应式/生命周期/事件：先核对实际 `wevu` 依赖与同步 setup；缺 runtime 仍可依据源码和可读公开资料作静态诊断，注明 API 版本限制，只停止需要该依赖的执行与宿主验证。不要为只读诊断安装依赖，也不把编译器当作 runtime。
2. 默认使用 `<script setup lang="ts">`。
   - 纯模板 SFC 允许没有 script block；`wv prepare` 必须按 SFC 模板扫描，不能把模板文本误交给 JSX parser。
   - Wevu JSX/TSX 与 SFC 内 JSX/TSX 归 Wevu compiler；项目级 `weapp.react` 启用后，独立 `.jsx/.tsx` 归 React owner。
3. 有脚本时 JSON 优先走宏：`defineAppJson`、`definePageJson`、`defineComponentJson`；页面元信息走 `definePageMeta`。已有纯模板 SFC 可保留同文件 `<json>`，不只为配置强加 runtime 或脚本。
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
6. 项目已有 `AGENTS.md` 时遵循它；版本相关 SFC 写法对照 `node_modules/weapp-vite/dist/docs/vue-sfc.md`，不把项目根 `dist/docs` 或框架仓库文件当作前提。
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
- 不要只配置 Wot UI 或 uview-plus resolver 而遗漏 `weapp.uniApp.include`，也不要把 npm 依赖自动加入转换范围。使用这些库须显式安装对应依赖；uview-plus 应调用 `mount$u()` 并同步 `$u`，不要走 Web 全局组件注册流程。
- 不要把 `t-*`、`van-*` 等 kebab-case 第三方原生组件的普通默认插槽误判为增强作用域插槽。
- 不要忽略 `prepare` 和 `.weapp-vite` 产物。
- 不要在修 SFC 语法时顺手做无关运行时重构。
- 不要把内置 i18n 当作 ICU/MessageFormat runtime；v1 只支持简单 key 查询和 `{name}` / `{user.name}` 插值。

## 输出

只输出本次问题阶段、实际版本/平台、SFC 级改动或只读建议、相关模板限制与最小检查。先确认 scripts/工具存在，再给出适合项目包管理器的命令；没有测试 script 就列覆盖缺口，不编造测试命令。未涉及 runtime、组件库或 HMR 时不展开其接入。

每项结论用短记录关联：`对象/版本 → 实际命令或动作 → 观察/产物 → 方法、结果、限制`；同一结论可并列记录多种方法，各自结果互不覆盖，建议与已执行分开。缺前提仅阻塞依赖它的操作/验证，继续可达的只读诊断：
- 自动验证 `passed`：实际命令/断言通过，仅证明所检查的模板、JSON、类型或运行行为。
- AI 评估 `passed`：列评估者、判据和材料，不称自动验证；只有实际隔离过才可称独立。
- 人工确认 `passed`：确认须针对该结果及版本，不能用计划获批代替结果/示例获批。
- 未验证 `not-run`：未运行或前提不足，写明原因；已执行失败按实际方法保留 `failed` 与证据。构建、声明和 callback 不单独证明实际显示，静态结构检查不证明证据真实或任务执行。

## 完成标记

只判断本次涉及的宏、模板、注册路径与类型同步；未涉及项不适用，失败/未验证项不得写成完成。运行时内容、事件和样式需另有目标 IDE/真机观察，不因编译成功而一并通过。
- 反馈保留期望/实际、复现前提、证据与限定范围的提议；确定性编译/类型错误优先进入工具或检查，语义/风格先作候选示例交人工审阅。一次偏好只留本次记录，确有复发及具体人工规则决定后才提议长期规则，不自动改源码/全局规则或上传业务数据。
- Skill 永久修订只在获授权的作者检出目录进行，不编辑包管理器受管的安装副本（如 `node_modules` 内 Skill 或 `.agents/skills` 指向它的链接）；维护用例留在作者仓库，不随消费包提供，也不是使用前提。

## 参考资料

- `references/macro-config-checklist.md`
- `references/template-compat-matrix.md`
- `references/troubleshooting-playbook.md`
- `references/tooling-and-hmr-matrix.md`
