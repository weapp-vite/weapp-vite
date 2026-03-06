---
"wevu": patch
"create-weapp-vite": patch
---

对齐 `wevu/router` 的导航钩子调用心智：`beforeEach` / `beforeResolve` 统一支持 `(to, from, context?)`，`afterEach` 支持 `(to, from, failure?, context?)`，让默认使用方式与 Vue Router 更一致，同时保留 `context` 作为高级扩展参数。
