---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu` 响应式/只读包装对 `Date`、`Map`、`Set`、`WeakMap` 与 `WeakSet` 等内置对象的错误代理行为。现在 `reactive()`、`shallowReactive()`、`readonly()` 与 `shallowReadonly()` 会直接返回这些内置对象本身，不再生成不可靠的 Proxy；同时为集合类型保留后续引入专用 collection handlers 的扩展注释，避免当前出现“被代理但方法绑定异常”的半可用状态。
