---
title: wevu 常用案例
---

# wevu 案例大全

以下示例覆盖常见的页面、组件与 Store 场景，均基于主入口导出的 API（不再使用 `wevu` 子路径）。

## 1) 计数器 + 生命周期 + watch

```vue
<!-- pages/counter/index.vue -->
<script lang="ts">
import { computed, definePage, onPageScroll, onShow, ref, watch } from 'wevu'

export default definePage({
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)
    const reachedTop = ref(true)

    onShow(() => console.log('page show'))
    onPageScroll(({ scrollTop }) => {
      reachedTop.value = scrollTop < 20
    })

    watch(count, (val, prev) => {
      console.log(`count: ${prev} -> ${val}`)
    })

    const add = () => count.value++
    const reset = () => (count.value = 0)

    return { count, doubled, reachedTop, add, reset }
  },
})
</script>

<template>
  <view class="page">
    <text>count: {{ count }} / doubled: {{ doubled }}</text>
    <text v-if="!reachedTop">
      正在滚动
    </text>
    <button @tap="add">
      加一
    </button>
    <button @tap="reset">
      重置
    </button>
  </view>
</template>
```

## 2) Todo 列表：computed 过滤 + watchEffect 持久化

```vue
<!-- pages/todo/index.vue -->
<script lang="ts">
import { computed, definePage, reactive, watchEffect } from 'wevu'

interface Todo { id: number, text: string, done: boolean }

export default definePage({
  setup() {
    const state = reactive({
      todos: [] as Todo[],
      filter: 'all' as 'all' | 'active' | 'done',
      draft: '',
    })

    const filtered = computed(() => {
      if (state.filter === 'done') {
        return state.todos.filter(t => t.done)
      }
      if (state.filter === 'active') {
        return state.todos.filter(t => !t.done)
      }
      return state.todos
    })

    watchEffect(() => {
      // 简单持久化到 storage
      wx.setStorageSync?.('todos', state.todos)
    })

    const addTodo = () => {
      if (!state.draft.trim()) {
        return
      }
      state.todos.push({ id: Date.now(), text: state.draft.trim(), done: false })
      state.draft = ''
    }

    const toggle = (todo: Todo) => {
      todo.done = !todo.done
    }
    const remove = (todo: Todo) => {
      state.todos = state.todos.filter(t => t.id !== todo.id)
    }

    return { state, filtered, addTodo, toggle, remove }
  },
})
</script>

<template>
  <view class="page">
    <input v-model="state.draft" placeholder="记录一下...">
    <button @tap="addTodo">
      新增
    </button>

    <view class="filter">
      <button @tap="state.filter = 'all'">
        全部
      </button>
      <button @tap="state.filter = 'active'">
        未完成
      </button>
      <button @tap="state.filter = 'done'">
        已完成
      </button>
    </view>

    <view v-for="todo in filtered" :key="todo.id" class="todo">
      <checkbox :checked="todo.done" @tap="toggle(todo)" />
      <text :class="{ done: todo.done }">
        {{ todo.text }}
      </text>
      <button @tap="remove(todo)">
        删除
      </button>
    </view>
  </view>
</template>
```

## 3) 跨页面共享：defineStore + storeToRefs

```ts
// stores/user.ts
import { createStore, defineStore } from 'wevu'

createStore()

export const useUserStore = defineStore('user', {
  state: () => ({ name: 'Ada', loggedIn: false }),
  getters: {
    welcome(state) {
      return state.loggedIn ? `欢迎回来，${state.name}` : '请先登录'
    },
  },
  actions: {
    login(name: string) {
      this.name = name
      this.loggedIn = true
    },
    logout() {
      this.loggedIn = false
    },
  },
})
```

```ts
// pages/profile/index.ts
import { definePage, storeToRefs } from 'wevu'
import { useUserStore } from '@/stores/user'

export default definePage({
  setup() {
    const user = useUserStore()
    const { welcome, loggedIn, name } = storeToRefs(user)
    return { welcome, loggedIn, name, login: user.login, logout: user.logout }
  },
})
```

```vue
<!-- pages/profile/index.vue template -->
<view class="page">
  <text>{{ welcome }}</text>
  <block v-if="loggedIn">
    <text>当前用户：{{ name }}</text>
    <button @tap="logout">退出</button>
  </block>
  <block v-else>
    <input v-model="name" placeholder="输入昵称" />
    <button @tap="login(name)">登录</button>
  </block>
</view>
```

## 4) 组件事件与双向绑定（可写 computed）

```ts
// components/Stepper/index.ts
import { computed, defineComponent, ref } from 'wevu'

export default defineComponent({
  properties: {
    modelValue: { type: Number, value: 0 },
    min: { type: Number, value: 0 },
    max: { type: Number, value: 10 },
  },
  setup(ctx) {
    const internal = ref(ctx.props.modelValue ?? 0)

    const value = computed({
      get: () => internal.value,
      set: (v: number) => {
        internal.value = v
        ctx.emit?.('update:modelValue', v)
      },
    })

    const inc = () => {
      if (value.value < (ctx.props.max ?? Infinity)) {
        value.value++
      }
    }
    const dec = () => {
      if (value.value > (ctx.props.min ?? -Infinity)) {
        value.value--
      }
    }

    return { value, inc, dec }
  },
})
```

```vue
<!-- 使用组件 -->
<Stepper v-model="state.amount" :min="1" :max="5" @update:modelValue="val => state.amount = val" />
```

## 5) 分享 / 收藏 & 页面特性

```ts
// pages/article/index.ts
import { definePage, onShareAppMessage, onShareTimeline } from 'wevu'

export default definePage(
  {
    data: () => ({ title: 'wevu 指南', id: '123' }),
    setup(ctx) {
      onShareAppMessage(() => ({
        title: ctx.proxy?.title ?? '文章',
        path: `/pages/article/index?id=${ctx.proxy?.id}`,
      }))

      onShareTimeline(() => ({
        title: '收藏好文：wevu 指南',
      }))
    },
  },
  {
    enableShareAppMessage: true,
    enableShareTimeline: true,
    enableAddToFavorites: true,
  },
)
```

## 6) Action 订阅与插件

```ts
// stores/cart.ts
import { createStore, defineStore } from 'wevu'

const manager = createStore()
manager.use(({ store }) => {
  store.$onAction?.((ctx) => {
    ctx.after(res => console.log('[after]', ctx.name, res))
    ctx.onError(err => console.error('[error]', ctx.name, err))
  })
})

export const useCartStore = defineStore('cart', {
  state: () => ({ items: [] as Array<{ id: string, count: number }> }),
  actions: {
    add(id: string, count = 1) {
      const found = this.items.find(i => i.id === id)
      if (found) {
        found.count += count
      }
      else { this.items.push({ id, count }) }
    },
  },
})
```

> 通过插件能统一注入埋点、持久化或日志，所有 `defineStore` 创建的实例都会被调用。

## 7) 表单校验与异步提交

```vue
<!-- pages/form/index.vue -->
<script lang="ts">
import { definePage, reactive } from 'wevu'

export default definePage({
  setup() {
    const state = reactive({
      username: '',
      email: '',
      submitting: false,
      errors: [] as string[],
    })

    const validate = () => {
      state.errors = []
      if (!state.username.trim()) {
        state.errors.push('请输入用户名')
      }
      if (!/^[\\w.-]+@\\w+/.test(state.email)) {
        state.errors.push('邮箱格式不正确')
      }
      return state.errors.length === 0
    }

    const submit = async () => {
      if (!validate()) {
        return
      }
      state.submitting = true
      try {
        await new Promise(resolve => setTimeout(resolve, 500)) // mock 请求
        wx.showToast?.({ title: '提交成功', icon: 'success' })
      }
      finally {
        state.submitting = false
      }
    }

    return { state, submit }
  },
})
</script>

<template>
  <view class="form">
    <input v-model="state.username" placeholder="用户名">
    <input v-model="state.email" placeholder="邮箱">
    <view v-if="state.errors.length" class="errors">
      <text v-for="err in state.errors" :key="err">
        {{ err }}
      </text>
    </view>
    <button :disabled="state.submitting" @tap="submit">
      {{ state.submitting ? '提交中...' : '提交' }}
    </button>
  </view>
</template>
```

## 8) 组合组件 + Store + 页面配置

```vue
<!-- pages/dashboard/index.vue -->
<script lang="ts">
import { computed, definePage, onReady } from 'wevu'
import StatsCard from '@/components/StatsCard/index.vue'
import { useUserStore } from '@/stores/user'

export default definePage({
  setup() {
    const user = useUserStore()
    const welcome = computed(() => (user.loggedIn ? `Hi, ${user.name}` : '未登录'))

    onReady(() => {
      user.login?.('Alice')
    })

    return { welcome, user }
  },
})
</script>

<template>
  <view class="dashboard">
    <text class="title">
      {{ welcome }}
    </text>
    <StatsCard title="收藏" :value="12" />
    <StatsCard title="消息" :value="3" />
  </view>
</template>

<config lang="jsonc">
{
  "$schema": "https://vite.icebreaker.top/page.json",
  "navigationBarTitleText": "仪表盘",
  "enablePullDownRefresh": true
}
</config>
```

---

以上示例可直接迁移到 weapp-vite 模板项目中使用。如需更多细节，可参考仓库内的 `wevu-*` 示例应用与 `packages/wevu/src` 源码。
