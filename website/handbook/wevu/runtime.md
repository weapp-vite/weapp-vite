---
title: 运行时：setup 上下文与更新
---

# 运行时：setup 上下文与更新

## 本章你会学到什么

- `defineComponent` 的运行模型
- `setup(props, ctx)` 的上下文里有什么
- 为什么 wevu 能最小化 `setData`

## 基本用法（页面/组件统一）

```ts
import { defineComponent, onShow, ref } from 'wevu'

export default defineComponent({
  setup(props, ctx) {
    const count = ref(0)
    onShow(() => console.log('show'))
    return { count, inc: () => count.value++ }
  },
})
```

## 关键约束：hooks 必须同步注册

所有 `onXXX()` 必须在 `setup()` 的同步阶段调用；不要写在 `await` 或回调之后。

## 深入参考

- 运行时与生命周期（权威页）：`/wevu/runtime`
