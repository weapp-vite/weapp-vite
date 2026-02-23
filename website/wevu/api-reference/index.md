---
title: API 参考总览
---

# wevu API 参考总览

这套文档是 `wevu` 的人工整理版 API 参考，目标是解决两个问题：

- 先按场景理解「该用哪组 API」
- 再跳到 Typedoc 看完整签名、泛型和重载

如果你需要完整自动生成索引，可直接看：

- 运行时 API（Typedoc）：[/wevu/api/index/index](/wevu/api/index/index)
- 编译侧常量（Typedoc）：[/wevu/api/compiler/index](/wevu/api/compiler/index)

## 阅读顺序

1. `Core`：先建立 `defineComponent/createApp` 和 `<script setup>` 宏的心智。
2. `Reactivity`：状态、派生状态、监听与调度。
3. `Lifecycle`：页面/组件/App 生命周期与返回值型 hook。
4. `Setup Context`：`setup(props, ctx)`、`instance`、`emit`、`bindModel`、`provide/inject`。
5. `Store`：`defineStore/createStore/storeToRefs`。
6. `Runtime Bridge`：与小程序实例桥接、`setData` 控制、调试能力。
7. `Types`：关键类型与完整类型索引入口。

## 分页目录

- [Core API（入口、组件、宏）](/wevu/api-reference/core)
- [Reactivity API（响应式与调度）](/wevu/api-reference/reactivity)
- [Lifecycle API（生命周期）](/wevu/api-reference/lifecycle)
- [Setup Context API（setup 上下文）](/wevu/api-reference/setup-context)
- [Store API（状态管理）](/wevu/api-reference/store)
- [Runtime Bridge API（桥接与调试）](/wevu/api-reference/runtime-bridge)
- [Type Reference（类型总览）](/wevu/api-reference/types)

## API 稳定性说明

- 主入口导入：业务代码统一从 `wevu` 导入。
- `wevu/compiler`：用于编译工具（如 weapp-vite），不属于业务稳定运行时 API。
- 本文档会标注“业务常用”与“调试/底层能力”，底层能力不建议在常规业务里直接依赖。

## TS-only 写法约定

以下语法仅可在 `<script setup lang="ts">` 下使用：

- `interface` / `type` 类型声明
- 宏泛型参数（例如 `defineProps<Props>()`、`defineEmits<{ ... }>()`、`defineModel<number>()`）
- 参数/变量类型注解（例如 `(value: string)`、`const fn: SomeType = ...`）

在后续 TypeScript 示例里会用 `// [TS-only]` 注释标记这些语法点。

## 最小示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { onLoad, ref } from 'wevu'

// [TS-only] 此示例无专属语法，TS/JS 写法一致。
const count = ref(0)

onLoad(() => {
  count.value = 1
})
</script>

<template>
  <view>count: {{ count }}</view>
</template>
```

```vue [JavaScript]
<script setup>
import { onLoad, ref } from 'wevu'

const count = ref(0)

onLoad(() => {
  count.value = 1
})
</script>

<template>
  <view>count: {{ count }}</view>
</template>
```

:::

上面的示例会串起 `core + lifecycle + reactivity` 三类 API。接下来按场景查具体页面即可。
