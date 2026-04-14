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

> [!TIP]
> 如果你在找页面级 `layout` 能力，请优先看 [Route Rules 与 Layout](/config/route-rules)。`layout` 本身不属于 `weapp.vue` 字段，而是通过 `definePageMeta()`、`weapp.routeRules` 与 `srcRoot/layouts/` 目录协同工作。

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
    htmlTagToWxml?: boolean | Record<string, string>
    htmlTagToWxmlTagClass?: boolean
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
        htmlTagToWxml: true,
        htmlTagToWxmlTagClass: true,
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
- `htmlTagToWxml`：是否将 `.vue` 模板中的常见 HTML 标签映射为小程序内置标签。
  - `true` 或省略：启用默认映射表（例如 `div -> view`、`span -> text`、`img -> image`、`a -> navigator`、`br -> view`、`hr -> view`）。
  - `false`：关闭该能力，保留模板中的原始标签名。
  - `Record<string, string>`：在默认映射表基础上追加或覆盖自定义映射。
- `htmlTagToWxmlTagClass`：是否在发生 HTML 标签映射时，同时给转换后的节点追加“原标签名 class”。
  - 默认 `true`。
  - 启用后，`<h3 class="title" :class="dynamicCls" />` 会编译为带有稳定语义 class 的节点，静态 class 会拼合成 `h3 title`，动态 `:class` 保持原样。
  - 适合低成本还原 `h1/h2/h3/ul/ol/li/p/br/hr` 等 HTML 标签的默认外观。
  - 设为 `false` 时，只做标签名映射，不追加这层 class。
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

示例：关闭默认映射

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        htmlTagToWxml: false,
      },
    },
  },
})
```

示例：覆盖部分标签映射

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        htmlTagToWxml: {
          section: 'view',
          article: 'view',
          a: 'navigator',
        },
      },
    },
  },
})
```

示例：关闭自动追加原标签 class

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        htmlTagToWxml: true,
        htmlTagToWxmlTagClass: false,
      },
    },
  },
})
```

示例：默认开启时的模板效果

```vue
<template>
  <div class="wrap">
    <h3 :class="titleClass">标题</h3>
    <hr />
    <br />
  </div>
</template>
```

会编译出类似结果：

```wxml
<view class="div wrap">
  <view class="h3" :class="titleClass">标题</view>
  <view class="hr" />
  <view class="br" />
</view>
```

> [!NOTE]
> `htmlTagToWxml` 只作用于 Vue SFC 模板编译，不影响原生 `.wxml` 文件。
>
> `htmlTagToWxmlTagClass` 只在“标签名确实发生了 HTML -> WXML 映射”时生效；像 `button -> button` 这类未改名场景，不会额外注入 `.button`。
>
> `removeComments` / `simplifyWhitespace` 当前仍是兼容性预留位，尚未接入实际编译流程；其余字段已经参与模板编译输出。

## `weapp.vue.autoImport` {#weapp-vue-autoimport}
- **类型**：`boolean`
- **默认值**：`undefined`
- **说明**：保留字段，当前不影响构建行为。

> 组件自动导入请使用 [`weapp.autoImportComponents`](/config/auto-import-components.md)。
> 如果你在使用 Wevu 的 `<script setup>` / JSON 宏，请继续阅读 [/wevu/vue-sfc/config](/wevu/vue-sfc/config)。
