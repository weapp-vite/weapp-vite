---
"create-weapp-vite": patch
---

继续统一 `create-weapp-vite` 产出的模板 API 调用方式：把模板中的 `wx` API 收口到 `@wevu/api` 导出的 `wpi`，并将可 Promise 化的调用改为 `async/await` 写法，同时保留同步 API 与上下文 API 的正确语义，减少跨端模板里直接依赖宿主全局对象的分散写法。
