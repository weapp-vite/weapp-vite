---
title: 响应式和生命周期
description: 理解 wevu 的 setup 上下文、响应式系统和页面更新机制。
keywords:
  - handbook
  - wevu
  - runtime
  - 响应式
  - 生命周期
---

# 响应式和生命周期

上一章讲了 wevu 是什么。这一章讲它到底是怎么工作的。

## setup 是怎么回事

不管你用 `<script setup>` 还是 `defineComponent`，核心都是一个 `setup` 函数。wevu 在这个函数里做三件事：

1. 同步创建响应式状态
2. 同步注册生命周期 hooks
3. 把状态暴露给模板消费

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

    return { count, increase }
  },
})
```

用 `<script setup>` 的话更简洁，但本质是一样的：

```vue
<script setup lang="ts">
import { onShow, ref } from 'wevu'

const count = ref(0)

function increase() {
  count.value += 1
}

onShow(() => {
  console.log('page show')
})
</script>
```

## 响应式系统

wevu 的响应式 API 和 Vue 3 基本一致：

```ts
import { computed, reactive, ref, watch, watchEffect } from 'wevu'

// ref：基础响应式值
const count = ref(0)
count.value += 1

// reactive：响应式对象
const state = reactive({ name: '', age: 0 })
state.name = '张三'

// computed：派生状态
const doubled = computed(() => count.value * 2)

// watch：监听变化
watch(count, (newVal, oldVal) => {
  console.log(`count changed: ${oldVal} → ${newVal}`)
})

// watchEffect：自动追踪依赖
watchEffect(() => {
  console.log('count is', count.value)
})
```

### 状态更新怎么反映到页面

你改了 `ref` 的值，页面就会更新。中间发生的事情大概是：

1. 你修改了响应式值
2. wevu 检测到变化
3. 把当前状态做一次快照
4. 和上一次快照做 diff
5. 只把变化的部分传给小程序的 `setData`

你不需要手动调 `setData`，这是 wevu 帮你做的。

### 常见的响应式陷阱

从 store 解构会丢失响应性：

```ts
const store = useCartStore()

// ❌ 解构后 count 不再是响应式的
const { count } = store

// ✅ 用 storeToRefs
const { count } = storeToRefs(store)
```

在 computed 外面取值会断掉依赖追踪：

```ts
// ❌ 依赖追踪断了
const currentList = list.value
const total = computed(() => {
  return currentList.reduce((sum, item) => sum + item.price, 0)
})

// ✅ 在 computed 内部访问
const total = computed(() => {
  return list.value.reduce((sum, item) => sum + item.price, 0)
})
```

## 生命周期的完整图景

### 页面 hooks

| hook                          | 什么时候触发           | 适合做什么             |
| ----------------------------- | ---------------------- | ---------------------- |
| `onLoad(query)`               | 页面首次加载（只一次） | 读路由参数、发首次请求 |
| `onShow()`                    | 每次页面可见           | 刷新数据、恢复定时器   |
| `onReady()`                   | 首次渲染完成           | DOM 查询               |
| `onHide()`                    | 页面隐藏               | 暂停定时器             |
| `onUnload()`                  | 页面销毁               | 清理资源               |
| `onPullDownRefresh()`         | 下拉刷新               | 重新加载数据           |
| `onReachBottom()`             | 滚动到底部             | 加载下一页             |
| `onPageScroll({ scrollTop })` | 页面滚动               | 吸顶效果等             |
| `onShareAppMessage()`         | 用户点分享             | 返回分享配置           |
| `onShareTimeline()`           | 分享到朋友圈           | 返回分享配置           |
| `onTabItemTap()`              | 点击 tab               | tab 切换逻辑           |

### 组件 hooks

| hook           | 对应页面的      |
| -------------- | --------------- |
| `onAttached()` | 类似 `onLoad`   |
| `onReady()`    | 同名            |
| `onDetached()` | 类似 `onUnload` |

组件没有 `onShow` / `onHide`。

### App hooks

```ts
import { onLaunch, onShow } from 'wevu'

onLaunch((options) => {
  // 小程序启动
})

onShow((options) => {
  // 小程序从后台切回前台
})
```

还有 `onHide`、`onError`、`onPageNotFound`、`onUnhandledRejection`、`onThemeChange`、`onMemoryWarning`。

### hooks 必须同步注册

这个规则前面说过，但值得再强调：所有 hooks 都要在 setup 的顶层同步注册。回调里面可以是异步的，但注册本身不能在 `await` 后面。

```ts
// ✅
onLoad(async (query) => {
  const data = await fetchData(query.id)
})

// ❌
await someWork()
onLoad(() => {}) // 可能失效
```

## 一个完整的页面示例

```vue
<script setup lang="ts">
import { onHide, onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShow, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '商品列表',
  enablePullDownRefresh: true,
}))

const list = ref<GoodsItem[]>([])
const page = ref(1)
const loading = ref(false)
const hasMore = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadList(pageNum: number) {
  loading.value = true
  try {
    const result = await getGoodsList({ page: pageNum })
    list.value = pageNum === 1 ? result.items : [...list.value, ...result.items]
    hasMore.value = result.hasMore
    page.value = pageNum
  }
  finally {
    loading.value = false
  }
}

onLoad(() => loadList(1))

onShow(() => {
  // 每次回到页面可以选择性刷新
  pollTimer = setInterval(() => {
    /* 轮询逻辑 */
  }, 10000)
})

onHide(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

onPullDownRefresh(async () => {
  await loadList(1)
  wx.stopPullDownRefresh()
})

onReachBottom(() => {
  if (!loading.value && hasMore.value) {
    loadList(page.value + 1)
  }
})

onShareAppMessage(() => ({
  title: '好物推荐',
  path: '/pages/goods-list/index',
}))
</script>
```

## 接下来

- [组件通信](/handbook/wevu/component) — props、emit、slots 在小程序里怎么用
- [状态管理](/handbook/wevu/store) — 什么时候该上 store
