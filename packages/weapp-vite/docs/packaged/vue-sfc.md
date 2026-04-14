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

## 何时继续看其他文档

- 需要更完整的编辑器提示说明：[`../volar.md`](../volar.md)
- 需要运行时页面/组件/store 约束：[`wevu-authoring.md`](./wevu-authoring.md)
- 需要项目级 `weapp` 配置：[`weapp-config.md`](./weapp-config.md)
