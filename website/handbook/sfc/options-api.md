---
title: Options API：兼容写法
---

# Options API：兼容写法

## 本章你会学到什么

- 在不使用 `<script setup>` 时如何写（例如更贴近原生/便于迁移）

## 建议场景

- 从原生小程序迁移：先保持“一个文件一个页面”，逐步提取 composables
- 团队已有 Options API 代码风格：短期内降低迁移成本

## 基本示例

```ts
import { defineComponent, ref } from 'wevu'

export default defineComponent({
  setup() {
    const count = ref(0)
    return { count, inc: () => count.value++ }
  },
})
```

## 相关链接

- wevu 组件与选项：`/wevu/component`
