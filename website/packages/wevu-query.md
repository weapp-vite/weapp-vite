---
title: '@wevu/query'
description: Wevu 的请求缓存、失效、mutation 和分页状态管理。
keywords: [wevu, query, cache, mutation, pagination]
---

# @wevu/query

`@wevu/query` 为 Wevu 页面提供服务端状态查询：同键请求共享、跨页面失效刷新、mutation、分页和账号隔离。它只管理请求状态，不替代本地 `ref` 或业务 store。

## 安装与最小用法

```bash
pnpm add @wevu/query
```

```ts
import { createQueryClient, createQueryPlugin, useQuery } from '@wevu/query'
import { createApp, ref } from 'wevu'

declare const api: {
  getUser: (id: string, signal: AbortSignal) => Promise<{ id: string }>
}

const client = createQueryClient()
const app = createApp({
  setup() {
    const userId = ref('u-1')
    return {
      user: useQuery({
        key: () => ['user', userId.value] as const,
        query: ({ key, signal }) => api.getUser(key[1], signal),
      }),
    }
  },
})
app.use(createQueryPlugin(client))
```

## AI 选择提示

需要跨页共享和失效策略时选择本包；单个组件的短生命周期状态继续使用 Wevu Composition API。请求底层 API 和 Web polyfill 分别由 `@weapp-core/api` 与 `@wevu/web-apis` 提供。
