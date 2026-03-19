---
"wevu": patch
"create-weapp-vite": patch
---

补齐并优化了 `wevu` 的一组 Vue 兼容 API。现在根入口正式导出 `shallowReadonly()` 与 `hasInjectionContext()`，其中 `shallowReadonly()` 复用现有浅只读语义，便于直接迁移依赖 Vue 兼容接口的组合式逻辑；`hasInjectionContext()` 则可用于在 `setup()` 同步阶段安全探测当前是否存在注入上下文。

同时，`wevu` 运行时会在组件/页面的 `setup()` 阶段建立实例级 `effectScope`，使 `getCurrentScope()`、`onScopeDispose()`、以及 setup 内创建的 `watch`/`watchEffect` 与 Vue 3 行为更一致，并在实例卸载时自动停止这些作用域副作用，避免残留监听泄漏到卸载后。
