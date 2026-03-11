---
title: Vue SFC 配置
description: Weapp-vite 内置 Vue SFC（.vue → WXML/WXSS/JS/JSON）编译链路。这里聚焦编译期可配置项。
keywords:
  - Vue SFC
  - 配置
  - config
  - vue
  - sfc
  - Weapp-vite
  - 内置
---

# Vue SFC 配置 {#vue-config}

`weapp-vite` 内置 Vue SFC（`.vue` → WXML/WXSS/JS/JSON）编译链路。这里聚焦编译期可配置项。

[[toc]]

## `weapp.vue.enable` {#weapp-vue-enable}
- **类型**：`boolean`
- **默认值**：`true`
- **说明**：保留字段。当前版本会在检测到 `.vue` 时自动启用 SFC 支持，该字段不影响行为。

## `weapp.vue.template` {#weapp-vue-template}
- **类型**：
  ```ts
  {
    removeComments?: boolean
    simplifyWhitespace?: boolean
    scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
    scopedSlotsRequireProps?: boolean
    slotMultipleInstance?: boolean
    classStyleRuntime?: 'auto' | 'wxs' | 'js'
    objectLiteralBindMode?: 'runtime' | 'inline'
    mustacheInterpolation?: 'compact' | 'spaced'
    classStyleWxsShared?: boolean
  }
  ```

示例：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        scopedSlotsCompiler: 'auto',
        scopedSlotsRequireProps: true,
        slotMultipleInstance: true,
        classStyleRuntime: 'js',
        objectLiteralBindMode: 'runtime',
        mustacheInterpolation: 'compact',
        classStyleWxsShared: true,
      },
    },
  },
})
```

字段说明：
- `scopedSlotsCompiler`：作用域插槽编译策略。
  - `auto`：自动选择最小可用方案（默认）。
  - `augmented`：强制使用增强方案。
  - `off`：关闭 scoped slot（仅保留原生 slot，不支持 slot props）。
- `scopedSlotsRequireProps`：仅在 slot 传递作用域参数时才生成 scoped slot 组件。默认值随 `scopedSlotsCompiler` 自动推导。
- `slotMultipleInstance`：`v-for` 下 scoped slot 多实例模式（默认 `true`）。
- `classStyleRuntime`：class/style 绑定运行时。
  - `js`：强制 JS（默认）。
  - `auto`：平台支持 WXS 时优先 WXS，否则回退 JS。
  - `wxs`：强制 WXS，不支持时回退 JS 并告警。
- `objectLiteralBindMode`：对象字面量 `v-bind` 的输出方式。
  - `runtime`：默认，借助运行时中间变量输出。
  - `inline`：直接内联对象字面量到模板插值。
- `mustacheInterpolation`：Mustache 输出风格。
  - `compact`：默认，输出 `{{expr}}`。
  - `spaced`：输出 `{{ expr }}`，更便于调试阅读。
- `classStyleWxsShared`：是否复用 class/style 的 WXS helper（主包与非独立分包共享，独立分包各自生成）。

> [!NOTE]
> `removeComments` / `simplifyWhitespace` 当前仍是兼容性预留位，尚未接入实际编译流程；其余字段已经参与模板编译输出。

## `weapp.vue.autoImport` {#weapp-vue-autoimport}
- **类型**：`boolean`
- **默认值**：`undefined`
- **说明**：保留字段，当前不影响构建行为。

> 组件自动导入请使用 [`weapp.autoImportComponents`](/config/auto-import-components.md)。
> 如果你在使用 Wevu 的 `<script setup>` / JSON 宏，请继续阅读 [/wevu/vue-sfc/config](/wevu/vue-sfc/config)。
