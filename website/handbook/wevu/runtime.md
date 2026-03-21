---
title: 运行时：setup、hooks 与更新
description: 从页面和组件的真实运行时序出发，解释 Wevu 的 setup 上下文、hooks 注册规则和页面更新机制，帮助新用户真正理解“为什么这样写会生效”。
keywords:
  - handbook
  - wevu
  - runtime
  - setup
  - hooks
---

# 运行时：setup、hooks 与更新

如果说上一章是在回答“为什么要用 Wevu”，这一章就是在回答：

> 它到底是怎么工作的？

## 先看一个最小运行时例子

```ts
import { defineComponent, onShow, ref } from 'wevu'

export default defineComponent({
  setup() {
    const count = ref(0)

    function increase() {
      count.value += 1
    }

    onShow(() => {
      console.log('page show')
    })

    return {
      count,
      increase,
    }
  },
})
```

这段代码里最重要的不是语法，而是它反映的运行时顺序：

1. 进入 `setup()`
2. 同步创建状态
3. 同步注册 hooks
4. 暴露给模板和页面实例消费

## 为什么 hooks 必须同步注册

这是新用户最容易踩的规则之一。

推荐：

```ts
defineComponent({
  setup() {
    onShow(() => {})
  },
})
```

不推荐：

```ts
defineComponent({
  setup() {
    setTimeout(() => {
      onShow(() => {})
    })
  },
})
```

也不推荐：

```ts
defineComponent({
  async setup() {
    await fetchSomething()
    onShow(() => {})
  },
})
```

原因很简单：运行时需要在建立当前实例上下文的那一小段同步阶段里，把 hook 绑定到正确实例上。

## `setup()` 里适合放什么

最推荐放这些内容：

- 本地状态
- computed
- 纯方法
- composable 调用
- hooks 注册

例如：

```ts
defineComponent({
  setup() {
    const loading = ref(false)
    const list = ref([])

    async function fetchList() {
      loading.value = true
      try {
        list.value = await getList()
      }
      finally {
        loading.value = false
      }
    }

    onLoad(fetchList)

    return {
      loading,
      list,
      fetchList,
    }
  },
})
```

## 状态更新为什么能反映到页面

从使用者视角，你可以把它理解成：

- 模板消费了 `setup()` 返回值
- `wevu` 跟踪这些响应式状态
- 当状态变化时，运行时把必要变更同步到小程序视图层

你不需要在日常开发里手动管理一堆 `setData`，这正是 Wevu 提供的价值之一。

## 页面 hooks 和业务流程怎么结合

例如一个详情页：

```ts
defineComponent({
  setup() {
    const detail = ref(null)

    onLoad(async (query) => {
      detail.value = await getDetail(query.id)
    })

    onShow(() => {
      console.log('visible again')
    })

    return { detail }
  },
})
```

这里就很清楚：

- `onLoad` 用来拉取首次数据
- `onShow` 用来处理页面再次可见的逻辑

## 一条非常重要的开发习惯

不要把“状态创建”和“hook 注册”分散到太多异步分叉里。
尽量让页面主逻辑在 `setup()` 顶层就能一眼看清楚。

## 一句话总结

把 `setup()` 当成当前页面或组件的“同步初始化窗口”：
状态在这里创建，hooks 在这里注册，模板从这里拿数据。

接下来建议继续看：

- [组件：props、emit、slots](/handbook/wevu/component)
- [Store：状态怎么放更合理](/handbook/wevu/store)
