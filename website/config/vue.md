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
    formatWxml?: boolean | 'auto'
    htmlTagToWxml?: boolean | Record<string, string>
    htmlTagToWxmlTagClass?: boolean
    scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
    scopedSlotsRequireProps?: boolean
    slotMultipleInstance?: boolean
    classStyleRuntime?: 'auto' | 'wxs' | 'js'
    objectLiteralBindMode?: 'runtime' | 'inline'
    mustacheInterpolation?: 'compact' | 'spaced'
    classStyleWxsShared?: boolean
    functionPropNames?: Array<string | RegExp>
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
        formatWxml: 'auto',
        scopedSlotsCompiler: 'auto',
        scopedSlotsRequireProps: false,
        slotMultipleInstance: true,
        classStyleRuntime: 'js',
        objectLiteralBindMode: 'runtime',
        mustacheInterpolation: 'compact',
        classStyleWxsShared: true,
        functionPropNames: ['handler', /^on[A-Z]/],
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
- `formatWxml`：是否格式化 `.vue` / JSX 编译生成的 WXML。
  - `auto` 或省略：开发态默认开启，生产构建默认关闭。
  - `true`：始终输出带缩进和换行的 WXML，便于在开发者工具中调试。
  - `false`：始终保持紧凑输出，适合对包体更敏感的场景。
  - 当前只做标签层级缩进；含文本内容的元素会保持单行，避免重排文本空白语义。
- `scopedSlotsCompiler`：作用域插槽编译策略。
  - `auto`：自动选择最小可用方案（默认）。
  - `augmented`：强制使用增强方案。
  - `off`：关闭 scoped slot（仅保留原生 slot，不支持 slot props）。
- `scopedSlotsRequireProps`：仅在 slot 传递作用域参数时才生成 scoped slot 组件。默认 `false`，普通插槽内容也会走增强 scoped slot 组件，以便 slot 投影下的运行时父子关系可被 `provide()` / `inject()` 正确解析；设为 `true` 可保留普通插槽的原生 slot 输出。
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
- `functionPropNames`：显式声明需要按函数 prop 传递的组件 prop 名称。
  - 默认值为空，不内置 `callback`、`handler`、`on-*`、`change` 等名称猜测。
  - 字符串按 prop 名称精确匹配；正则表达式按 prop 名称测试。
  - 例如 `functionPropNames: ['handler', /^on[A-Z]/]` 会让 `&lt;Comp :handler="callbacks[id]" /&gt;` 生成运行时绑定；普通值绑定如 `&lt;Comp :selected="data.userId" /&gt;` 仍直接输出 `selected` 对 `data.userId` 的 Mustache 绑定，不会生成 `__wv_bind_*`。

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
