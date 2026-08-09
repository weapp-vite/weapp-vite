---
title: React 配置
description: 在微信小程序中使用 React 19、react-reconciler 与可选 React Compiler 的 weapp-vite 配置。
noindex: true
keywords:
  - React
  - React Compiler
  - react-reconciler
  - 微信小程序
---

# React 配置

`weapp-vite` 的 React 支持是项目级能力。启用后，项目内所有 `.jsx` / `.tsx` 由 React 编译链处理；同一构建不能按文件混用 Wevu JSX。

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    react: {
      renderMode: 'auto',
      compiler: false,
      devWarnings: true,
    },
  },
})
```

## 配置字段

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `react` | `boolean | WeappReactConfig` | `false` | `true` 或对象时启用 React owner。 |
| `compiler` | `boolean | { compilationMode?, engine? }` | `false` | 显式启用 SWC React Compiler；失败时回退 Oxc 并警告。 |
| `renderMode` | `'auto' | 'dynamic' | 'static'` | `'auto'` | 静态 slots、完整 reconciler tree，或静态模式强校验。 |
| `devWarnings` | `boolean` | `true` | 是否输出 dynamic island 与 Compiler fallback 诊断。 |

运行时包为 `@weapp-vite/react`，固定验证组合为 React `19.2.x` 与 `react-reconciler` `0.33.x`，不依赖 `react-dom`。首版仅支持微信小程序。

`renderMode: 'auto'` 会将稳定的 host shape、静态属性和可绑定字段生成原生 WXML；不含 bridge 的动态条件、列表、render prop 与动态组件进入 reconciler dynamic island。`renderMode: 'static'` 无法证明结构时会直接失败，避免静默丢失语义。

## 自定义组件 bridge

`@weapp-vite/react` 导出 `createNativeComponent<Props>(tagName)`，用于引用已在当前 JSON `usingComponents` 注册的原生或 Wevu 组件；`Slot` 用于 React-backed 小程序组件声明默认插槽。

```tsx
import { createNativeComponent, Slot } from '@weapp-vite/react'

const WevuCard = createNativeComponent<{ label: string }>('wevu-card')
```

- `onValueChange` 编译为 `bind:value-change`，Capture 后缀编译为 `capture-bind:*`。
- bridge 支持动态 props、自定义事件与默认 children。
- bridge 必须在当前 TSX 顶层使用字符串字面量声明，并与 JSON 注册同名。
- bridge 暂不支持条件/列表动态结构、跨文件声明、作用域插槽或双向 model；`auto` 模式会直接报告可操作的静态编译错误。
- React + Wevu SFC 项目需要显式依赖 `wevu`；TSX 仍归 React，`.vue` 归 Wevu compiler。

更多页面、Hooks、Context 和事件示例见 [React 小程序接入](/integration/react)。
