---
title: 组件：usingComponents 与拆分
---

# 组件：`usingComponents` 与拆分

## 本章你会学到什么

- 为什么“组件引入”必须走 `usingComponents`
- 页面/组件怎么拆才不容易踩坑

## 关键规则：小程序组件不是 Vue 组件

在小程序体系里，组件注册是 **JSON 声明式** 的：

- 组件路径由 `usingComponents` 决定
- 模板里直接使用组件标签

因此在 weapp-vite + SFC 的体系里，通常不在脚本里 `import` 子组件来“注册”。

## 推荐写法：用宏声明 usingComponents

```vue
<script setup lang="ts">
definePageJson(() => ({
  usingComponents: {
    'my-card': '/components/MyCard/index',
  },
}))
</script>

<template>
  <my-card />
</template>
```

## 常见坑

- `usingComponents` 路径写错（尤其是分包路径、大小写）
- 同名组件覆盖：统一组件命名规范（建议 `kebab-case`）
