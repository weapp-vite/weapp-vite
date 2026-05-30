# Vue SFC

这个文档只覆盖 `weapp-vite` 下小程序 Vue SFC 的高频规则。

## 推荐基线

- 优先使用 `<script setup lang="ts">`
- 页面用 `definePageJson`
- 组件用 `defineComponentJson`
- 页面元信息用 `definePageMeta`

## 宏的职责划分

- `defineAppJson`：应用级 JSON
- `definePageJson`：页面级 JSON
- `defineComponentJson`：组件级 JSON
- `definePageMeta`：页面元信息，例如 layout

`definePageJson` 和 `definePageMeta` 可以同时存在，但职责不同。

## `v-model`

小程序编译场景下，`v-model` 目标应是可赋值表达式。

可行：

```vue
<input v-model="form.name" />
```

不可行：

```vue
<input v-model="x + y" />
```

## `usingComponents`

当你在页面或组件里需要显式注册原生小程序组件时，优先明确当前文件使用的 JSON 宏与配置来源，避免多个入口互相覆盖。

## HTML 标签迁移辅助

如果你把偏 Web 风格的模板迁到 `.vue`，可以优先关注这两个配置：

- `weapp.vue.template.htmlTagToWxml`
  把常见 HTML 标签映射为小程序内置标签。
- `weapp.vue.template.htmlTagToWxmlTagClass`
  默认开启。映射发生时，会再补一个原标签名 class，方便你自己用 CSS 恢复默认外观。
- `weapp.vue.template.formatWxml`
  默认 `auto`。开发态会格式化生成的 WXML，生产构建保持紧凑输出；也可以显式设置 `true` 或 `false`。

例如：

```vue
<template>
  <h3 class="title">
    标题
  </h3>
  <br>
</template>
```

启用默认行为后，会得到类似：

```wxml
<view class="h3 title">标题</view>
<view class="br" />
```

## 具名插槽透传 wrapper

当你把当前组件的 `<slot />` 转发到子组件的具名插槽时：

```vue
<IssueCard>
  <template #header>
    <slot />
  </template>
</IssueCard>
```

编译器会使用真实节点 wrapper，默认类似：

```wxml
<view slot="header">
  <slot />
</view>
```

不要改成 `<block slot="header"><slot /></block>`。真实 WeChat DevTools 运行时里，这种写法会出现宿主 header，但转发内容不会渲染。

如果需要自定义 wrapper，可以在组件使用处写静态属性。组件内配置推荐使用普通 kebab-case 静态属性，避免和 Vue 指令参数语法混淆。

`slot-wrapper` 是当前组件所有普通具名插槽的默认 wrapper：

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

`slot-wrapper-<slotName>` 只覆盖指定具名插槽；单个 slot 的覆盖更推荐直接写在对应的 `<template #xxx>` 上：

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

产物中 `header` 使用 `slot-wrapper="cover-view"`，`footer` 在对应的 `<template #footer>` 上覆盖：

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

只覆盖单个 slot 时，更推荐把配置写在对应的 `<template #xxx>` 上。这个写法最靠近 slot 内容，优先级高于父组件标签上的默认值和 `slot-wrapper-<slotName>`：

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
  <text slot="header" class="slot-header">
    <slot />
  </text>
  <cover-view slot="footer">
    <slot name="footer" />
  </cover-view>
</IssueCard>
```

在 `<template #header>` 上配置时，属性仍写 `slot-wrapper` / `slot-wrapper-class` / `slot-wrapper-style` / `slot-single-root-no-wrapper`，不需要再带 `header` 后缀。

也可以把 class/style 加到生成的 wrapper 上，而不是加到组件本身：

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

动态绑定也支持，例如父组件标签上的 `:slot-wrapper-class="headerClass"` / `:slot-wrapper-style="headerStyle"`，以及 `<template #footer :slot-wrapper-class="footerClass">` 这种单 slot 就近覆盖。

`slot-single-root-no-wrapper-<slotName>` 可以让指定插槽在单根真实节点场景下尽量下推 `slot="..."`：

```vue
<template>
  <IssueCard slot-single-root-no-wrapper-icon>
    <template #icon>
      <image src="/assets/icon.png" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <image slot="icon" src="/assets/icon.png" />
</IssueCard>
```

这个下推策略不适用于转发 `<slot />`。微信平台默认会使用内部 `virtualHost` wrapper：

```vue
<template>
  <IssueCard slot-single-root-no-wrapper-header>
    <template #header>
      <slot />
    </template>
  </IssueCard>
</template>
```

```wxml
<IssueCard>
  <weapp-slot-wrapper slot="header">
    <slot />
  </weapp-slot-wrapper>
</IssueCard>
```

如果需要回到旧版 `view` wrapper，可配置 `weapp.vue.template.slotFallbackWrapperStrategy: 'view'`，或显式配置 `slotFallbackWrapper: 'view'`。

默认策略不会使用 `block`。如果显式配置 `slotFallbackWrapper: 'block'`，编译器会按原样输出：

```wxml
<IssueCard>
  <block slot="header">
    <slot />
  </block>
</IssueCard>
```

注意：`block` 在转发 `<slot />` 的部分 WeChat DevTools 运行时场景中会丢失内容，因此不作为默认值。显式启用时需要自行确认目标运行时和具体插槽内容可用。

你选择的 wrapper 必须能承载实际内容。比如下面的写法会让 `text` 包裹 `view`，这不适合真实运行时：

```vue
<template>
  <IssueCard>
    <template #header slot-wrapper="text">
      <view>Header</view>
    </template>
  </IssueCard>
</template>
```

```wxml
<IssueCard>
  <text slot="header">
    <view>Header</view>
  </text>
</IssueCard>
```

也可以通过 `weapp.vue.template.slotFallbackWrapper` 全局配置，按组件和具名插槽匹配。显式配置 `slotFallbackWrapper` 后会优先于默认 `virtualHost` 策略。`rules[].component` 匹配使用处模板标签名；`rules[].componentName` 匹配子组件里的静态 `defineOptions({ name: 'HelloWorld' })`。`componentName` 需要编译器能解析到被引用的 Vue SFC，原生小程序组件继续用 `component`。

## 何时继续看其他文档

- 需要更完整的编辑器提示说明：[`../volar.md`](../volar.md)
- 需要运行时页面/组件/store 约束：[`wevu-authoring.md`](./wevu-authoring.md)
- 需要项目级 `weapp` 配置：[`weapp-config.md`](./weapp-config.md)
