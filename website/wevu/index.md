---
title: Wevu 概览
description: Wevu 是面向小程序的轻量运行时，为 weapp-vite 的 Vue SFC 与组合式开发提供响应式、生命周期、Store 与最小化 setData 更新能力。
keywords:
  - Wevu
  - 概览
  - vue
  - 响应式
  - setData
  - store
---

# Wevu 概览

`wevu` 是一个面向小程序（以微信小程序为主）的轻量运行时。可以把它看作“把 Vue 3 的响应式心智模型带到小程序里”，但不引入 Virtual DOM，而是用快照 diff 来尽量减少 `setData` 的更新量。

:::warning 安装方式
`wevu` 在 `weapp-vite` 项目里通常建议安装在 `devDependencies` 中：

```sh
pnpm add -D wevu
```

这样更符合当前 `weapp-vite` 的产物策略与模板默认值。若你是在非 `weapp-vite` 场景单独消费 `wevu`，再根据自己的发布方式决定依赖落位。
:::

## 1. Wevu 主要提供什么

它主要提供：

- Vue 3 风格的响应式（`ref` / `reactive` / `computed` / `watch`）
- 基于快照 diff 的最小化 `setData` 更新
- 类 Pinia 的 Store（状态管理）

Wevu 不改变小程序“数据驱动 + 模板渲染”的基本模型：你仍然写 WXML/WXSS（或配合 Weapp-vite 用 Vue SFC 编写模板/样式/配置），但业务逻辑可以用熟悉的 Composition API 组织起来。

## 2. Wevu 在整套体系里的位置

如果你同时使用 `weapp-vite` 的 Vue SFC：

- **Weapp-vite（编译期）**：把 `.vue` 编译成 WXML/WXSS/JS/JSON，并做模板语法转换。
- **Wevu（运行期）**：负责响应式、生命周期 hooks、快照 diff 与最小化 `setData`。

因此遇到问题时可以快速分层定位：

- “模板/指令/usingComponents/v-model 怎么编译？” → 先看 `/wevu/vue-sfc`
- “状态为什么不更新 / hooks 为什么不触发？” → 先看 `/wevu/runtime` 与 `/wevu/compatibility`
- “项目应该先看哪一层文档？” → 先看 `/guide/` 和 `/config/`；那里解决的是编译与工程问题，不是运行时问题。

如果你是在 `weapp-vite` 项目里让 AI 协助修改 Wevu 代码，建议再加一个前置顺序：

1. 先读项目根目录 `AGENTS.md`
2. 再读 `node_modules/weapp-vite/dist/docs/wevu-authoring.md`
3. 最后才进入具体的 `pages/components/stores`

这样 AI 更容易先遵守小程序运行时约束，而不是直接套用 Vue Web 的默认写法。

## 3. Wevu 不是什么

- 它不是浏览器 DOM 运行时，也不是把 Vue 3 完整搬进小程序。
- 它不依赖 Virtual DOM，而是围绕小程序的 `setData` 模型做响应式与快照 diff。
- 它也不替代 `weapp-vite` 的编译能力。SFC、WXML、JSON、WXSS 的转换仍然由编译侧负责。

## 4. 诞生的小故事

这段背景不影响你上手，但能帮助你理解 Wevu 为什么会长成现在这样：

- 最初想叫 `wevue`，但 npm 包名已被占用，后来才收敛成现在的 `wevu`。
- 在给 `weapp-vite` 补齐 Vue SFC 支持时，调研过社区现有方案，但无论编译链还是运行时语义，都很难直接贴合小程序场景。
- 最后选择围绕小程序本身的运行模型重新组织这套能力：借鉴 Vue 3 的响应式心智，但不照搬浏览器渲染栈，而是把重点放在 `setData`、页面生命周期和小程序平台约束上。

如果你把 Wevu 理解成“面向小程序约束重新取舍过的一套 Vue 风格运行时”，通常会比把它理解成“Vue 3 的缩小版”更准确。

## 5. 你会用到的能力

- **响应式与调度**：与 Vue 3 相同心智的 `ref` / `reactive` / `computed` / `watch` / `watchEffect`，更新通过微任务批量调度（`nextTick`）。
- **页面/组件注册**：`defineComponent()` 统一通过小程序 `Component()` 注册；`createApp()` 可在存在全局 `App()` 时自动注册应用；`createWevuComponent()` 供 Weapp-vite 编译产物调用。
- **最小化 setData**：运行时把 state + computed 转为 plain snapshot，diff 后只把变化路径传给 `setData`。
- **双向绑定辅助**：`bindModel(path)` 生成适配小程序事件的数据/事件绑定对象。
- **Store（状态管理）**：`defineStore` / `storeToRefs` / `createStore`（可选插件入口）。

:::tip 导入约定
运行时基础 API 默认从 `wevu` 主入口导入；高阶导航从 `wevu/router` 导入；`wevu/compiler` 仅供 Weapp-vite 等编译侧工具使用（非稳定业务 API）。
:::

## 6. 其他子路径导出

除了 `wevu` 主入口外，当前还提供几组按能力拆分的子路径导出：

- [wevu/api](/wevu/api-package)：透传 `@wevu/api`，用于统一多端小程序 API 调用
- [wevu/fetch](/wevu/fetch)：基于 `wpi.request` 的 Fetch 风格接口
- [wevu/router](/wevu/router)：更接近 Vue Router 心智的路由入口
- [wevu/jsx-runtime](/wevu/jsx-runtime)：给 TSX / JSX 类型系统使用的入口

## 7. 开发产物与源码调试

`wevu` 默认入口指向压缩后的生产产物，用来降低小程序包体积。发布包里也会同时包含一份未压缩并带 sourcemap 的开发产物：

- 支持 `development` export condition 的构建器会在开发模式下优先解析到 `dist/dev/*`。
- 需要手动切换时，可以把 `wevu` alias 到 `wevu/dev`，也可以把 `wevu/router` alias 到 `wevu/dev/router` 等同名开发入口。
- 生产构建应继续使用默认入口，避免 `dist/dev/*` 进入正式小程序包。

例如只在本地排查 Wevu 运行时源码时，可以临时改成：

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      'wevu/router': 'wevu/dev/router',
      'wevu/store': 'wevu/dev/store',
      'wevu': 'wevu/dev',
    },
  },
})
```

排查结束后移除 alias，让正式构建回到默认压缩产物。

## 8. 已弃用 API 提示

当前源码里已明确标记为弃用、但仍保留导出的公开 API 主要是：

- `provideGlobal()` / `injectGlobal()`

它们仅为兼容旧代码保留。新代码请优先使用：

- `provide()` / `inject()`：局部依赖注入
- `defineStore()` / `createStore()`：稳定全局共享状态

> **注意**：`useRouter()` 不属于 `wevu` 根入口；如果你要使用高阶导航，请从 [`wevu/router`](/wevu/router) 导入。

## 9. 编译侧桥接（wevu/compiler）

`wevu/compiler` 用来承载 Wevu 与编译工具之间的共享常量，避免在多个项目里重复写字符串：

- `WE_VU_MODULE_ID`：运行时入口模块名（`wevu`）。
- `WE_VU_RUNTIME_APIS`：运行时 API 名称集合（如 `createApp` / `defineComponent` / `createWevuComponent`）。
- `WE_VU_PAGE_HOOK_TO_FEATURE`：页面 hook 与 features 的映射表。

这些导出面向编译工具（例如 Weapp-vite），应用代码不要依赖它们作为稳定 API。

## 10. 推荐学习顺序（按“最短上手 → 深入理解”）

1. [快速上手](/wevu/quick-start)：先跑通一个页面/组件（含 store）
2. [运行时与生命周期](/wevu/runtime)：理解 `setup(props, ctx)`、生命周期 hooks、`bindModel`、watch 策略
3. [defineComponent（组件）](/wevu/component)：掌握组件字段透传、`properties/props`、`emit/expose` 等细节
4. [Store](/wevu/store)：落地状态管理（订阅、补丁、插件）
5. [兼容性与注意事项](/wevu/compatibility)：了解限制与边界（尤其是 provide/inject、页面事件按需派发）

接下来可以按顺序阅读：

- [快速上手](/wevu/quick-start)
- [运行时与生命周期](/wevu/runtime)
- [defineComponent（组件）](/wevu/component)
- [Store](/wevu/store)
- [API 参考总览](/wevu/api/)
- [wevu/api](/wevu/api-package)
- [wevu/fetch](/wevu/fetch)
- [wevu/router](/wevu/router)
- [wevu/jsx-runtime](/wevu/jsx-runtime)
- [兼容性与注意事项](/wevu/compatibility)
- [Vue 3 兼容性说明（完整）](/wevu/vue3-compat)
- [Wevu vs Vue 3（核心差异）](/wevu/vue3-vs-wevu)

## 10. 速查表

| 主题            | 结论                                         |
| --------------- | -------------------------------------------- |
| `wevu` 是什么   | 小程序运行时层                               |
| `wevu` 不是什么 | 浏览器 DOM Runtime / 完整 Vue Web Runtime    |
| API 从哪导入    | 基础 API 从 `wevu`，高阶路由从 `wevu/router` |
| 当前已弃用 API  | `provideGlobal()` / `injectGlobal()`         |

## 11. 扩展阅读

- [为什么没有使用 @vue/runtime-core 的 createRenderer 来实现](/wevu/why-not-runtime-core-create-renderer)
- [Wevu 中的 setData 什么时候触发？](/wevu/when-setdata-triggers)

## 12. 参考资源

| 主题       | 推荐入口                                  |
| ---------- | ----------------------------------------- |
| API 首页   | [Wevu API](/wevu/api/)                    |
| 高阶导航   | [wevu/router](/wevu/router)               |
| Vue SFC    | [wevu/vue-sfc](/wevu/vue-sfc/)            |
| 兼容性说明 | [wevu/compatibility](/wevu/compatibility) |
