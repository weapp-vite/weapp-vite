---
title: JSON：Script Setup 宏优先
---

# JSON：Script Setup 宏优先

## 本章你会学到什么

- 在 SFC 中如何定义 `app/page/component` 的 JSON 配置
- 为什么推荐宏指令而不是 `<json>` 块
- `usingComponents` 在新项目中的定位

## 推荐：使用 JSON 宏

优先使用以下宏完成配置：

- `defineAppJson`
- `definePageJson`
- `defineComponentJson`

这样做的优势：

- 类型提示更完整
- 与 `<script setup>` 作用域一致
- 更适合组合与复用（尤其在 TypeScript 项目中）

## `app.vue` 配置示例

```vue
<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/issue-289/index',
  ],
})

onLaunch(() => {})
</script>
```

## 页面配置示例

```vue
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '示例页',
})
</script>
```

## 关于 `usingComponents`

- 新项目里，**SFC 子组件优先 `import .vue`**，通常不需要手写 `usingComponents`。
- 只有在引入非 `.vue` 原生小程序组件路径时，再使用 `definePageJson/defineComponentJson` 补充 `usingComponents`。

## 兼容说明

`<json>` 块仍可兼容历史代码，但不建议作为新项目默认方案。
