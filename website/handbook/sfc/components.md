---
title: 组件：script setup import 与拆分
---

# 组件：`script setup` import 与拆分

## 本章你会学到什么

- 为什么推荐在 `<script setup lang="ts">` 中直接 `import` 子组件
- 如何在页面里拆分组件，同时获得更好的 IDE 智能提示
- `usingComponents` 在什么场景下仍然需要

## 推荐范式（默认）

在 weapp-vite + Vue SFC 项目中，推荐直接在脚本里导入 `.vue` 组件：

- 编辑器（Volar/TS）能直接识别组件类型与跳转
- 重构（改名、移动文件）更稳定
- 与 Vue 插件生态（lint、类型检查、自动导入）无缝协同

```vue
<script setup lang="ts">
import ComputedClassExample from '../../components/issue-289/ComputedClassExample/index.vue'
import MapClassExample from '../../components/issue-289/MapClassExample/index.vue'
import ObjectLiteralExample from '../../components/issue-289/ObjectLiteralExample/index.vue'
import RootClassExample from '../../components/issue-289/RootClassExample/index.vue'
</script>

<template>
  <view class="issue289-page">
    <ObjectLiteralExample />
    <MapClassExample />
    <RootClassExample />
    <ComputedClassExample />
  </view>
</template>
```

## `usingComponents` 何时使用

以下场景仍然建议使用 `definePageJson/defineComponentJson` 配置 `usingComponents`：

- 需要引入非 `.vue` 的原生小程序组件路径（如外部小程序组件包）
- 必须用 JSON 层能力声明的组件映射
- 兼容历史工程中无法快速迁移到 `import` 的模块

结论：**业务 SFC 组件优先 `import`，`usingComponents` 作为补充而不是默认。**
