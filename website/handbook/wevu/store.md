---
title: Store：模式与工程落地
---

# Store：模式与工程落地

## 本章你会学到什么

- 什么时候该用 store，什么时候用局部 state 就够了
- store 的目录组织、初始化与持久化思路

## 典型使用形态

```ts
import { defineStore, ref } from 'wevu'

export const useUser = defineStore('user', () => {
  const token = ref<string | null>(null)
  const setToken = (t: string | null) => (token.value = t)
  return { token, setToken }
})
```

## 工程建议

- 按业务域拆 store：`stores/user.ts`、`stores/cart.ts`
- 把“请求 + 缓存 + 业务状态”集中到 store/service，页面只做编排

## 深入参考

- [Store API](/wevu/store)
