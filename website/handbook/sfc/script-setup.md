---
title: 脚本逻辑怎么组织
description: 用 script setup 写页面和组件的推荐范式，包括代码组织顺序、生命周期用法、Options API 兼容写法。
keywords:
  - handbook
  - sfc
  - script setup
  - 生命周期
  - Options API
---

# 脚本逻辑怎么组织

新项目默认用 `<script setup lang="ts">`。不是因为它时髦，而是因为它和 wevu 的 hooks、响应式写法配合得最自然。

## 一个页面的推荐写法

```vue
<script setup lang="ts">
import { computed, onLoad, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '商品列表',
}))

const keyword = ref('')
const goodsList = ref<{ id: string, title: string }[]>([])
const loading = ref(false)

const hasData = computed(() => goodsList.value.length > 0)

onLoad(() => {
  console.log('page loaded')
})
</script>
```

这里面有几个值得固定下来的习惯：

- 响应式 API 和 hooks 都从 `wevu` 导入
- 页面配置用 `definePageJson()` 宏
- 代码按"状态 → 派生状态 → 方法 → 生命周期"的顺序排

## 推荐的代码组织顺序

```ts
// 1. import
import { computed, onLoad, onShow, ref } from 'wevu'
import { getOrderList } from '../../services/order'

// 2. 页面配置
definePageJson(() => ({
  navigationBarTitleText: '购物车',
}))

// 3. 状态
const list = ref<CartItem[]>([])
const loading = ref(false)

// 4. 派生状态
const totalPrice = computed(() =>
  list.value.reduce((sum, item) => sum + item.price * item.count, 0),
)

// 5. 方法
function clearCart() {
  list.value = []
}

// 6. 生命周期
onLoad(() => {
  // 首次加载
})

onShow(() => {
  // 每次页面可见
})
```

不用死记，写几个页面就习惯了。关键是团队统一，不要每个页面都换一种组织方式。

## 生命周期怎么用

### 页面常用的 hooks

```ts
import { onHide, onLoad, onReady, onShow, onUnload } from 'wevu'

onLoad((query) => {
  // 页面首次加载，能拿到路由参数
  // 适合：读参数、发首次请求
})

onShow(() => {
  // 每次页面可见都会触发（包括从其他页面返回）
  // 适合：刷新数据、恢复定时器
})

onReady(() => {
  // 首次渲染完成
  // 适合：DOM 查询（createSelectorQuery）
})

onHide(() => {
  // 页面隐藏
  // 适合：暂停定时器
})

onUnload(() => {
  // 页面销毁
  // 适合：清理资源
})
```

触发顺序：`onLoad → onShow → onReady → ... → onHide → onShow → ... → onUnload`

### 交互类 hooks

```ts
import { onPullDownRefresh, onReachBottom, onShareAppMessage } from 'wevu'

// 下拉刷新（需要在 definePageJson 里开启 enablePullDownRefresh）
onPullDownRefresh(async () => {
  await refreshData()
  wx.stopPullDownRefresh()
})

// 触底加载更多
onReachBottom(() => {
  if (hasMore.value) {
    loadNextPage()
  }
})

// 分享
onShareAppMessage(() => ({
  title: '推荐给你',
  path: '/pages/goods/index?id=sku-1',
}))
```

### 组件的 hooks

组件和页面的生命周期不完全一样：

```ts
import { onAttached, onDetached, onReady } from 'wevu'

onAttached(() => {
  // 组件挂载到页面
})

onReady(() => {
  // 组件渲染完成
})

onDetached(() => {
  // 组件从页面移除
})
```

组件没有 `onShow` / `onHide`，这两个是页面专属的。

### 最重要的规则：hooks 必须同步注册

所有 hooks 都要在 `setup()` 的顶层同步注册，不能放在 `await` 后面：

```ts
// ✅ 对的：hook 同步注册，回调里面可以异步
onLoad(async (query) => {
  const data = await fetchData(query.id)
})

// ❌ 错的：在 await 之后注册
await someAsyncWork()
onShow(() => {}) // 这时候可能已经失效了
```

原因是 wevu 需要在同步阶段把 hook 绑定到当前实例上。一旦进入异步，实例上下文可能已经丢了。

## 组件导入

直接 `import .vue` 就能用：

```vue
<script setup lang="ts">
import EmptyState from '../../components/empty-state/index.vue'
import GoodsCard from '../../components/goods-card/index.vue'
</script>

<template>
  <GoodsCard />
  <EmptyState />
</template>
```

这比手写 `usingComponents` 更直观，IDE 跳转也更稳。

## app.vue 入口

全局逻辑、全局样式、全局配置都可以收到 `app.vue` 里：

```vue
<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/home/index',
    'pages/profile/index',
  ],
})

onLaunch(() => {
  console.log('app launched')
})
</script>

<style>
page {
  font-size: 28rpx;
  color: #333;
}
</style>
```

## 如果你更习惯 Options API

从原生小程序迁移过来的话，可以先用 `defineComponent`：

```vue
<script lang="ts">
import { defineComponent, onLoad, ref } from 'wevu'

export default defineComponent({
  setup() {
    const count = ref(0)

    onLoad(() => {
      console.log('loaded')
    })

    return { count }
  },
})
</script>
```

核心逻辑还是写在 `setup()` 里。等团队熟悉了，再逐步切到 `<script setup>`。

迁移路径：先把 `data` 集中到 `setup` 里的 `ref` → 再把 `defineComponent` 换成 `<script setup>`。

## 三个最常见的错误

### 1. 从 vue 导入响应式 API

```ts
// ❌
import { ref } from 'vue'
// ✅
import { ref } from 'wevu'
```

### 2. 在异步回调里注册 hooks

```ts
// ❌
await fetchSomething()
onShow(() => {})
```

### 3. 忘了清理定时器

```ts
let timer: ReturnType<typeof setInterval> | null = null

onShow(() => {
  timer = setInterval(pollStatus, 5000)
})

onHide(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
```

## 接下来

- [样式和资源怎么处理](/handbook/sfc/style)
- [组件怎么拆](/handbook/sfc/components)
