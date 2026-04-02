# wevu

> Pinia 风格的状态管理库，专为微信小程序设计

wevu 提供了与 Pinia 完全一致的 API 设计，支持 **Setup Store** 和 **Options Store** 两种模式，完美适配微信小程序环境。

## 特性

- 🎯 **完全兼容 Pinia API** - 零学习成本，Pinia 开发者即可上手
- 🚀 **开箱即用** - **无需全局注册插件**，直接使用
- 💪 **TypeScript 完整支持** - 完整的类型推导，无需泛型
- 🔄 **响应式状态管理** - 基于 wevu 的 reactivity 系统
- 📦 **模块化设计** - 按功能域组织 stores
- 🔌 **可选插件系统** - 支持扩展 store 功能
- 📦 **轻量级** - 专为小程序优化，体积小巧

## 与 Pinia 的主要区别

| 特性           | Pinia                                 | wevu                        |
| -------------- | ------------------------------------- | --------------------------- |
| **全局注册**   | 必须调用 `createPinia()` 并注册到 app | **不需要**，开箱即用        |
| **Vue 依赖**   | 依赖 Vue 3                            | **独立**，基于 wevu runtime |
| **环境**       | Web 应用                              | **微信小程序**              |
| **API 设计**   | Setup Store + Options Store           | ✅ 完全一致                 |
| **TypeScript** | 完整支持                              | ✅ 完整支持                 |

### 关键优势：无需全局注册

**Pinia 需要：**

```typescript
// ❌ Pinia 必须这样
import { createPinia } from 'pinia'
import { createApp } from 'vue'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia) // 必须注册才能使用
```

**wevu 开箱即用：**

```typescript
// ✅ wevu 直接使用
import { defineStore } from 'wevu'

// 无需任何全局注册，直接定义 store
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  return { count }
})

// 在组件中直接使用
const store = useCounterStore() // 即刻可用
```

## 快速开始

### 安装

```bash
npm install -D wevu
```

### 定义 Store

#### Setup Store (推荐)

Setup Store 使用函数式写法，类似 Vue 3 Composition API：

```typescript
import { computed, defineStore, ref } from 'wevu'

export const useCounterStore = defineStore('counter', () => {
  // 状态（State）- 使用 ref
  const count = ref(0)
  const name = ref('Counter')

  // 计算属性（Getters）- 使用 computed
  const doubleCount = computed(() => count.value * 2)
  const displayName = computed(() => `${name.value}: ${count.value}`)

  // 方法（Actions）- 普通函数
  function increment() {
    count.value++
  }

  function reset() {
    count.value = 0
  }

  async function fetchCount() {
    const response = await wx.request({
      url: '/api/count',
      method: 'GET'
    })
    count.value = response.data
  }

  // 返回需要暴露的内容
  return {
    count,
    name,
    doubleCount,
    displayName,
    increment,
    reset,
    fetchCount
  }
})
```

#### Options Store

Options Store 使用对象写法，类似 Vue 2 Options API：

```typescript
import { defineStore } from 'wevu'

interface UserState {
  name: string
  age: number
}

export const useUserStore = defineStore('user', {
  // 状态（State）
  state: (): UserState => ({
    name: '',
    age: 0
  }),

  // 计算属性（Getters）
  getters: {
    // 简单 getter
    label(state): string {
      return `${state.name}:${this.age}`
    },

    // 说明：getter 可以访问 this (store 实例)
    canVote(): boolean {
      return this.age >= 18
    }
  },

  // 方法（Actions）
  actions: {
    grow() {
      this.age++
    },

    async fetchUser(id: string) {
      const response = await wx.request({
        url: `/api/users/${id}`,
        method: 'GET'
      })
      this.name = response.data.name
      this.age = response.data.age
    }
  }
})
```

## 在组件中使用

### 使用 Setup Store

```typescript
import { storeToRefs } from 'wevu'
import { useCounterStore } from './stores/counter'

export default {
  setup() {
    // 获取 store 实例
    const counterStore = useCounterStore()

    // 使用 storeToRefs 解构保持响应式
    const { count, doubleCount } = storeToRefs(counterStore)

    // 说明：actions 可以直接解构（函数不需要响应式）
    const { increment } = counterStore

    return {
      count,
      doubleCount,
      increment
    }
  }
}
```

### 使用 Options Store

```typescript
import { useUserStore } from './stores/user'

export default {
  setup() {
    const userStore = useUserStore()

    // 直接访问 state 和 getters
    const { name, age, label } = storeToRefs(userStore)

    // 调用 actions
    function handleGrow() {
      userStore.grow()
    }

    return {
      name,
      age,
      label,
      handleGrow
    }
  }
}
```

### 在模板中使用

```vue
<script>
import { storeToRefs } from 'wevu'
import { useCounterStore } from './stores/counter'

export default {
  setup() {
    const counterStore = useCounterStore()
    const { count, doubleCount } = storeToRefs(counterStore)
    const { increment, reset } = counterStore

    return {
      count,
      doubleCount,
      increment,
      reset
    }
  }
}
</script>

<template>
  <view class="counter">
    <text>Count: {{ count }}</text>
    <text>Double: {{ doubleCount }}</text>
    <button bindtap="increment">
      +1
    </button>
    <button bindtap="reset">
      Reset
    </button>
  </view>
</template>
```

## Store API

每个 store 实例都包含以下内置属性和方法：

### `$id`

Store 的唯一标识符：

```typescript
const counterStore = useCounterStore()
console.log(counterStore.$id) // 'counter'
```

### `$state`

访问或替换整个状态（仅 Options Store）：

```typescript
const userStore = useUserStore()

// 读取整个状态
console.log(userStore.$state)

// 替换整个状态
userStore.$state = {
  name: 'Alice',
  age: 25
}
```

### `$patch`

批量更新状态：

```typescript
const counterStore = useCounterStore()

// 使用对象 patch
counterStore.$patch({
  count: 10,
  name: 'Updated'
})

// 使用函数 patch
counterStore.$patch((state) => {
  state.count += 5
  state.name = 'Patched'
})
```

### `$reset`

重置状态到初始值（Setup / Options Store 均支持）：

```typescript
const userStore = useUserStore()

// 修改状态
userStore.name = 'Changed'
userStore.age = 100

// 重置
userStore.$reset()
console.log(userStore.name) // ''
console.log(userStore.age) // 0
```

### `$subscribe`

订阅状态变化：

```typescript
const counterStore = useCounterStore()

// 订阅状态变化
const unsubscribe = counterStore.$subscribe((mutation, state) => {
  console.log('Mutation type:', mutation.type)
  console.log('Store ID:', mutation.storeId)
  console.log('Current state:', state)
})

// 取消订阅
unsubscribe()
```

### `$onAction`

订阅 action 调用：

```typescript
const counterStore = useCounterStore()

const unsubscribe = counterStore.$onAction(({ name, store, args, after, onError }) => {
  console.log(`Action ${name} called with`, args)

  // 在 action 成功后执行
  after((result) => {
    console.log(`Action ${name} succeeded with`, result)
  })

  // 在 action 失败时执行
  onError((error) => {
    console.error(`Action ${name} failed with`, error)
  })
})

// 取消订阅
unsubscribe()
```

## `storeToRefs`

从 store 中提取响应式属性：

```typescript
import { storeToRefs } from 'wevu'

const counterStore = useCounterStore()

// ✅ 正确：使用 storeToRefs 保持响应式
const { count, doubleCount } = storeToRefs(counterStore)

// ❌ 错误：直接解构会丢失响应式
const { count, doubleCount } = counterStore

// ✅ 正确：actions 可以直接解构
const { increment, reset } = counterStore
```

## 组合式 Stores

### 在一个 Store 中使用另一个 Store

```typescript
import { defineStore, ref } from 'wevu'

// 认证 Store（Auth Store）
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)

  function setToken(newToken: string) {
    token.value = newToken
  }

  function clearToken() {
    token.value = null
  }

  return { token, isAuthenticated, setToken, clearToken }
})

// 用户 Store（使用 Auth Store）
export const useUserStore = defineStore('user', () => {
  const authStore = useAuthStore()

  const profile = ref<User | null>(null)

  async function fetchProfile() {
    if (!authStore.token) {
      throw new Error('Not authenticated')
    }

    const response = await wx.request({
      url: '/api/user/profile',
      header: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    profile.value = response.data
  }

  function logout() {
    authStore.clearToken()
    profile.value = null
  }

  return { profile, fetchProfile, logout }
})
```

### 提取可复用逻辑

**useAsyncState.ts**:

```typescript
import { ref } from 'wevu'

export function useAsyncState<T>(fetcher: () => Promise<T>) {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  async function execute() {
    loading.value = true
    error.value = null

    try {
      data.value = await fetcher()
    }
    catch (e) {
      error.value = e as Error
    }
    finally {
      loading.value = false
    }
  }

  return { data, error, loading, execute }
}
```

**user.ts**:

```typescript
import { defineStore } from 'wevu'
import { useAsyncState } from './useAsyncState'

export const useUserStore = defineStore('user', () => {
  const fetchUserFn = () => {
    return wx.request({ url: '/api/user', method: 'GET' }).then(r => r.data)
  }
  const { data: user, loading, execute } = useAsyncState(fetchUserFn)

  return { user, loading, fetchUser: execute }
})
```

## 插件系统（可选）

wevu 的插件系统是**可选的**，不像 Pinia 那样必须全局注册。你可以在需要时才使用插件扩展功能。

### 何时需要插件

大多数情况下，你**不需要**使用插件系统。wevu 开箱即用，只有以下场景才需要插件：

- 为所有 store 添加全局功能
- 集成第三方服务（如日志、持久化）
- 跨 store 共享逻辑

### 创建插件

```typescript
import { createStore } from 'wevu'

// 创建 store manager（可选）
const storeManager = createStore()

// 添加插件（可选）
storeManager.use(({ store }) => {
  // 为所有 store 添加自定义属性
  if (store.$id === 'user') {
    ;(store as any).$customMethod = () => {
      console.log('Custom method')
    }
  }
})
```

> **注意**: 与 Pinia 不同，wevu 的插件系统是**完全可选的**。不使用插件的情况下，所有功能都能正常工作。

### 日志插件示例

```typescript
import { createStore } from 'wevu'

const storeManager = createStore()

storeManager.use(({ store }) => {
  // 订阅状态变化
  store.$subscribe((mutation, state) => {
    console.log(`[${store.$id}]`, mutation.type, state)
  })

  // 订阅 action 调用
  store.$onAction(({ name, args }) => {
    console.log(`[${store.$id}] Action: ${name}`, args)
  })
})
```

## TypeScript 支持

### Setup Store - 完整类型推导

```typescript
import { computed, defineStore, ref } from 'wevu'

interface User {
  id: number
  name: string
  email: string
}

export const useUserStore = defineStore('user', () => {
  // 自动推导类型
  const user = ref<User | null>(null)
  const loading = ref(false)

  const isAdmin = computed(() => user.value?.email?.endsWith('@admin.com') ?? false)

  async function fetchUser(id: number): Promise<User> {
    loading.value = true
    const response = await wx.request({
      url: `/api/users/${id}`,
      method: 'GET'
    })
    user.value = response.data
    loading.value = false
    return response.data
  }

  return {
    user,
    loading,
    isAdmin,
    fetchUser
  }
})

// 使用时完全类型安全
const userStore = useUserStore()
userStore.user?.name // string | undefined
userStore.isAdmin // boolean
await userStore.fetchUser(1) // User
```

### Options Store - 类型定义

```typescript
import { defineStore } from 'wevu'

interface UserState {
  name: string
  age: number
}

interface UserGetters {
  label: string
  canVote: boolean
}

interface UserActions {
  grow: () => void
  setName: (name: string) => void
}

export const useUserStore = defineStore<
  UserState,
  UserGetters,
  UserActions
>('user', {
  state: () => ({
    name: '',
    age: 0
  }),

  getters: {
    label(state): string {
      return `${state.name}:${this.age}`
    },

    canVote(): boolean {
      return this.age >= 18
    }
  },

  actions: {
    grow() {
      this.age++ // this 自动推导类型
    },

    setName(name: string) {
      this.name = name
    }
  }
})
```

## 最佳实践

### 1. 命名规范

```typescript
// ✅ Store 定义：PascalCase + 'use' 前缀
export const useUserStore = defineStore('user', () => {
  // setup 逻辑
})
export const useCartStore = defineStore('cart', () => {
  // setup 逻辑
})

// ✅ Store ID：小写、单数
defineStore('user', () => {}) // ✅
defineStore('User', () => {}) // ❌
defineStore('users', () => {}) // ❌

// ✅ Store 文件：按功能域组织
// 文件：stores/user.ts
// 文件：stores/cart.ts
// 文件：stores/products.ts
```

### 2. 状态组织

```typescript
// ✅ 推荐：按功能域组织 stores
// 文件：stores/auth.ts
// 文件：stores/user.ts
// 文件：stores/cart.ts

// ❌ 避免：按技术关注点组织
// 文件：stores/state.ts
// 文件：stores/getters.ts
// 文件：stores/actions.ts
```

### 3. 使用 Setup Store

Setup Store 提供更好的类型推导和灵活性：

```typescript
// ✅ 推荐：Setup Store
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)

  function increment() {
    count.value++
  }

  return { count, double, increment }
})

// ⚠️ 可选：Options Store
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    double: state => state.count * 2
  },
  actions: {
    increment() {
      this.count++
    }
  }
})
```

### 4. 解构 Store

```typescript
const store = useCounterStore()

// ✅ State/Getters 使用 storeToRefs
const { count, double } = storeToRefs(store)

// ✅ Actions 可以直接解构
const { increment } = store

// ❌ 不要直接解构 state
const { count } = store // 失去响应式
```

### 5. 异步 Actions

```typescript
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  async function fetchUser(id: number) {
    loading.value = true
    error.value = null

    try {
      const response = await wx.request({
        url: `/api/users/${id}`,
        method: 'GET'
      })
      user.value = response.data
    }
    catch (e) {
      error.value = e as Error
    }
    finally {
      loading.value = false
    }
  }

  return { user, error, loading, fetchUser }
})
```

## 与 Pinia 的兼容性

wevu 提供与 Pinia 完全一致的 API：

| Pinia API       | wevu    | 状态     |
| --------------- | ------- | -------- |
| `defineStore()` | ✅ 支持 | 完全兼容 |
| `storeToRefs()` | ✅ 支持 | 完全兼容 |
| Setup Store     | ✅ 支持 | 完全兼容 |
| Options Store   | ✅ 支持 | 完全兼容 |
| `$patch`        | ✅ 支持 | 完全兼容 |
| `$reset`        | ✅ 支持 | 完全兼容 |
| `$subscribe`    | ✅ 支持 | 完全兼容 |
| `$onAction`     | ✅ 支持 | 完全兼容 |
| Plugins         | ✅ 支持 | 完全兼容 |

## 示例项目

查看完整示例：

- **综合示例**: `apps/wevu-comprehensive-demo/src/pages/store/`
- **单元测试**: `packages-runtime/wevu/test/store.test.ts`

## License

MIT
