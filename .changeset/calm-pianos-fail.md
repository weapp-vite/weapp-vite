---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu` runtime 在小程序环境缺失 `AbortController` / `AbortSignal` 时，`@tanstack/vue-query` 查询会一直停留在 `pending` 的问题，并补齐 setup 返回普通对象内嵌响应式值时的更新跟踪。
