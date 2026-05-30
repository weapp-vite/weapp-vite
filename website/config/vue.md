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
    slotSingleRootNoWrapper?: boolean
    slotFallbackWrapperStrategy?: 'view' | 'virtual-host'
    slotFallbackWrapper?: string | {
      tag?: string
      attrs?: Record<string, string>
      singleRootNoWrapper?: boolean
      rules?: Array<{
        component?: string | RegExp | Array<string | RegExp>
        componentName?: string | RegExp | Array<string | RegExp>
        slot?: string | RegExp | Array<string | RegExp>
        tag?: string
        attrs?: Record<string, string>
        singleRootNoWrapper?: boolean
      }>
    }
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
        slotSingleRootNoWrapper: false,
        slotFallbackWrapperStrategy: 'virtual-host',
        slotFallbackWrapper: {
          tag: 'view',
          attrs: {
            class: 'slot-wrapper',
          },
          rules: [
            { component: 'IssueCard', slot: 'header', tag: 'cover-view' },
            { componentName: 'HelloWorld', slot: 'header', tag: 'cover-view' },
            {
              component: 'IssueCard',
              slot: 'footer',
              attrs: {
                class: 'slot-footer',
              },
            },
            { component: /^Van/, slot: ['title', 'label'], tag: 'view' },
          ],
        },
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
- `slotSingleRootNoWrapper`：普通具名插槽内容只有一个可投影根节点时，是否把 `slot="..."` 直接下推到该根节点，避免额外生成 wrapper。
  - 默认 `false`，保持稳定的真实节点 wrapper。
  - 开启后只影响“单个可投影根节点”；多节点、空内容、转发 `<slot />` 等场景仍会保留真实 wrapper。
- `slotFallbackWrapperStrategy`：配置普通具名插槽 fallback wrapper 的默认策略。
  - 微信平台默认 `virtual-host`，会自动生成内部 `virtualHost` 组件作为 wrapper，减少 `view` 带来的布局影响。
  - 其他平台默认 `view`。
  - 如果需要回到旧行为，可显式配置为 `view`，或继续显式配置 `slotFallbackWrapper: 'view'`。
- `slotFallbackWrapper`：配置普通具名插槽 fallback wrapper 的真实标签。
  - 微信平台默认由 `slotFallbackWrapperStrategy: 'virtual-host'` 生成内部 `virtualHost` wrapper；其他平台默认 `view`。
  - 字符串形式等价于 `{ tag: '...' }`。
  - 显式配置该字段后，会优先使用这里指定的真实标签，并保持旧版 `view` / 自定义标签行为。
  - 对象形式支持全局默认 `tag`、全局默认 `attrs`、全局默认 `singleRootNoWrapper`，以及按组件 / 插槽匹配的 `rules`。
  - `rules[].component` 匹配模板里的组件标签名，例如 `<IssueCard>` 对应 `IssueCard`，`<issue-card>` 对应 `issue-card`。
  - `rules[].componentName` 匹配被引用 Vue SFC 的组件名，也就是子组件里静态 `defineOptions({ name: 'HelloWorld' })` 的 `name`。这个字段需要编译器能解析到该子组件的 `.vue` 文件；原生组件或第三方小程序组件通常没有这个信息，应继续用 `component`。
  - `rules[].component`、`rules[].componentName` 与 `rules[].slot` 都支持字符串、正则或数组；同一条规则里写了多个匹配条件时需要同时命中。规则按顺序匹配，后匹配到的字段可覆盖前面的字段。
  - `attrs` 是追加到 fallback wrapper 上的静态属性，适合项目级 class、style 或 `data-*`；组件使用处可用 `slot-wrapper-class` / `slot-wrapper-style` 继续覆盖。
  - `block` 不能作为 wrapper。`<block slot="header"><slot /></block>` 在转发 slot 场景会在真实 DevTools 运行时丢内容；如果配置成 `block`，编译器会回退到 `view` 并输出 warning。
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

### 自定义具名插槽 wrapper {#slot-fallback-wrapper}

当普通具名插槽内容是转发的 `<slot />` 时，小程序不能直接接收 `<slot slot="header" />`，也不能稳定接收 `<block slot="header"><slot /></block>`。微信平台默认会生成一个内部 `virtualHost` 组件作为 wrapper：

```wxml
<weapp-slot-wrapper slot="header">
  <slot />
</weapp-slot-wrapper>
```

同时会在当前入口 JSON 中自动注入内部组件引用。若需要回到旧版 `view` 行为，可配置 `slotFallbackWrapperStrategy: 'view'`，或显式配置 `slotFallbackWrapper: 'view'`。

如果某些组件的某些具名插槽需要用其他真实节点承载，可以用 `slotFallbackWrapper` 全局配置：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        slotFallbackWrapper: {
          tag: 'view',
          attrs: {
            class: 'slot-wrapper',
          },
          rules: [
            { component: 'IssueCard', slot: 'header', tag: 'cover-view' },
            { componentName: 'HelloWorld', slot: 'header', tag: 'cover-view' },
            {
              component: 'IssueCard',
              slot: 'footer',
              attrs: {
                class: 'slot-footer-global',
              },
            },
            { component: /^Van/, slot: ['title', 'label'], tag: 'view' },
          ],
        },
      },
    },
  },
})
```

`component` 匹配的是使用处模板标签名，不是子组件声明名。比如下面这个模板里，`component: 'issue-card'` 会命中，`component: 'HelloWorld'` 不会命中：

```vue
<template>
  <issue-card>
    <template #header>
      <slot />
    </template>
  </issue-card>
</template>

<script setup lang="ts">
import IssueCard from '@/components/IssueCard.vue'
</script>
```

如果你希望按子组件自己的名字匹配，需要让子组件声明静态 `defineOptions({ name })`，然后在规则里使用 `componentName`：

```vue
<!-- components/IssueCard.vue -->
<script setup lang="ts">
defineOptions({
  name: 'HelloWorld',
})
</script>
```

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        slotFallbackWrapper: {
          rules: [
            { componentName: 'HelloWorld', slot: 'header', tag: 'cover-view' },
          ],
        },
      },
    },
  },
})
```

`componentName` 只在编译器能解析到被引用的 Vue SFC 时可用，包括 `<script setup>` 直接 import 的组件和自动导入 resolver 标记为 `wevu-sfc` 的组件。原生小程序组件、没有静态 `defineOptions({ name: '...' })` 的组件，继续使用 `component` 匹配模板标签名更明确。

也可以直接在组件使用处用静态属性覆盖当前组件的 wrapper。组件内配置推荐使用普通 kebab-case 静态属性，避免和 Vue 指令参数语法混淆。

#### `slot-wrapper`：当前组件所有普通具名插槽的默认 wrapper {#slot-wrapper-default}

`slot-wrapper` 会作为当前组件所有普通具名插槽的默认 wrapper。下面的 `header` 和 `footer` 都会使用 `cover-view`：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header>
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <cover-view slot="header">
    <slot />
  </cover-view>
  <cover-view slot="footer">
    <slot name="footer" />
  </cover-view>
</IssueCard>
```

#### `slot-wrapper-<slotName>`：覆盖指定具名插槽 {#slot-wrapper-named}

如果同一个组件的不同具名插槽需要不同 wrapper，可以继续保留 `slot-wrapper` 作为默认值；单个 slot 的覆盖更推荐直接写在对应的 `<template #xxx>` 上：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header>
      <slot />
    </template>
    <template #footer slot-wrapper="view">
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <cover-view slot="header">
    <slot />
  </cover-view>
  <view slot="footer">
    <slot name="footer" />
  </view>
</IssueCard>
```

这里 `header` 继承 `slot-wrapper="cover-view"`，`footer` 在对应的 `<template #footer>` 上覆盖。

如果只想覆盖某一个 `<template #xxx>`，更推荐把配置直接写在对应的 slot template 上。这个写法最贴近 slot 内容，优先级也高于父组件标签上的默认值和 `slot-wrapper-<slotName>`：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header slot-wrapper="text" slot-wrapper-class="slot-header">
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <text slot="header" class="slot-header" style="margin-top: 12px">
    <slot />
  </text>
  <cover-view slot="footer">
    <slot name="footer" />
  </cover-view>
</IssueCard>
```

在 `<template #header>` 上写时，已经知道目标 slot 名，属性仍写 `slot-wrapper` / `slot-wrapper-class` / `slot-wrapper-style` / `slot-single-root-no-wrapper`，不需要再写 `slot-wrapper-header`。如果只是改单个 slot，优先把配置写在 `<template #header>` 上。

#### `slot-wrapper-class/style`：给生成的 wrapper 加属性 {#slot-wrapper-attrs}

普通 `class` / `style` 仍然属于组件本身，不会被转移到编译器生成的 slot wrapper 上。如果要给 wrapper 加样式，需要使用 wrapper 虚拟属性：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header slot-wrapper="cover-view" slot-wrapper-class="slot-default" slot-wrapper-style="padding: 8px">
      <slot />
    </template>
    <template
      #footer
      slot-wrapper="view"
      slot-wrapper-class="slot-footer"
      slot-wrapper-style="margin-top: 12px"
    >
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <cover-view slot="header" class="slot-default" style="padding: 8px">
    <slot />
  </cover-view>
  <view slot="footer" class="slot-footer" style="margin-top: 12px">
    <slot name="footer" />
  </view>
</IssueCard>
```

也支持动态绑定，仍然使用静态参数名：

```vue
<IssueCard
  :slot-wrapper-class="headerClass"
  :slot-wrapper-style="headerStyle"
>
  <template #header>
    <slot />
  </template>
  <template #footer :slot-wrapper-class="footerClass">
    <slot name="footer" />
  </template>
</IssueCard>
```

指定插槽的 class/style 只覆盖对应属性。上例中 `footer` 在 `<template #footer>` 上覆盖了 class，但仍会继承默认的 `slot-wrapper-style`。

局部配置优先级高于全局配置。整体优先级为：`<template #slot>` 上的 `slot-wrapper` / `slot-wrapper-class/style` / `slot-single-root-no-wrapper` > 父组件标签上的 `slot-wrapper-<slotName>` / `slot-wrapper-<slotName>-class/style` / `slot-single-root-no-wrapper-<slotName>` > 父组件标签上的 `slot-wrapper` / `slot-wrapper-class/style` / `slot-single-root-no-wrapper` > `slotFallbackWrapper.rules` > `slotFallbackWrapper.tag` / `slotFallbackWrapper.attrs` > `slotFallbackWrapperStrategy` 默认策略。

#### `slot-single-root-no-wrapper-<slotName>`：单根真实节点下推 `slot` {#slot-single-root-no-wrapper-named}

如果要按插槽开启单根下推，也可以用全局规则：

```ts
export default defineConfig({
  weapp: {
    vue: {
      template: {
        slotFallbackWrapper: {
          tag: 'view',
          rules: [
            { component: 'IssueCard', slot: 'icon', singleRootNoWrapper: true },
          ],
        },
      },
    },
  },
})
```

或在组件使用处写静态属性：

```vue
<template>
  <IssueCard slot-single-root-no-wrapper-icon>
    <template #icon>
      <image src="/assets/icon.png" />
    </template>
  </IssueCard>
</template>
```

当 `icon` 插槽内容是单个真实节点时，会尽量把 `slot="icon"` 下推到这个节点：

```wxml
<IssueCard>
  <image slot="icon" src="/assets/icon.png" />
</IssueCard>
```

这个策略只适用于“单根真实节点”。如果插槽内容是转发 `<slot />`、多个根节点、空内容，编译器仍会保留 wrapper：

```vue
<template>
  <IssueCard slot-single-root-no-wrapper-header>
    <template #header>
      <slot />
    </template>
  </IssueCard>
</template>
```

产物仍是：

```wxml
<IssueCard>
  <weapp-slot-wrapper slot="header">
    <slot />
  </weapp-slot-wrapper>
</IssueCard>
```

#### `block`：显式配置后按原样输出 {#slot-wrapper-block}

默认策略不会把 `block` 作为 fallback wrapper。你可以显式配置 `block`，编译器会按原样输出，但这需要自行承担宿主运行时兼容性风险：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        slotFallbackWrapper: 'block',
      },
    },
  },
})
```

下面的 Vue 写法：

```vue
<template>
  <IssueCard>
    <template #header>
      <slot />
    </template>
  </IssueCard>
</template>
```

会生成 `<block slot="header"><slot /></block>`：

```wxml
<IssueCard>
  <block slot="header">
    <slot />
  </block>
</IssueCard>
```

注意：issue #613 的真实 WeChat DevTools e2e 已验证，`<block slot="header"><slot></slot></block>` 在转发 `<slot />` 的部分场景会丢失内容。因此 `block` 不作为默认值，只建议在你确认目标运行时和具体插槽内容可用时显式启用。

#### wrapper 必须能承载实际内容 {#slot-wrapper-content}

编译器只负责按配置生成标签，目标小程序运行时是否允许该标签承载子节点，仍取决于宿主规则和实际内容。比如下面的配置会让 `header` 使用 `text`：

```vue
<template>
  <IssueCard>
    <template #header slot-wrapper="text">
      <view>Header</view>
    </template>
  </IssueCard>
</template>
```

产物会是：

```wxml
<IssueCard>
  <text slot="header">
    <view>Header</view>
  </text>
</IssueCard>
```

> [!WARNING]
> `text` 不适合包裹 `<view>` 子内容。需要包裹视图节点时，使用 `view`、`cover-view` 或经过目标小程序运行时验证的自定义组件；`block` 不是可渲染 wrapper，不能用于转发 `<slot />` 的命名插槽容器。

## `weapp.vue.autoImport` {#weapp-vue-autoimport}
- **类型**：`boolean`
- **默认值**：`undefined`
- **说明**：保留字段，当前不影响构建行为。

> 组件自动导入请使用 [`weapp.autoImportComponents`](/config/auto-import-components.md)。
> 如果你在使用 Wevu 的 `<script setup>` / JSON 宏，请继续阅读 [/wevu/vue-sfc/config](/wevu/vue-sfc/config)。
