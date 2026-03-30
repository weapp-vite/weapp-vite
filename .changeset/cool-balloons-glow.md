---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 中 setup store 首次在页面 `setup()` 作用域内创建后，会在 `reLaunch` 卸载旧页面时连同 store 内部的响应式 effect / computed 一起被停止的问题。现在 store 创建过程会使用独立的 detached effect scope，不再附着到页面实例生命周期，从而保证跨页面共享 store 在 `reLaunch` 后更新状态时，`computed` 结果仍能继续正确响应。同时补充 `github-issues` 中 issue #373 的复现页面，以及对应的单测与 e2e 回归覆盖。
