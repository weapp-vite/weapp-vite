---
"wevu": patch
"create-weapp-vite": patch
---

导出 `customRef` 及其相关类型声明，完善 `wevu` 对 Vue 3 响应式 API 的可用性。同步扩展 `wevu-vue-demo` 的 `vue-compat` 响应式对照页，新增多源 watch cleanup、watchEffect 句柄控制、effectScope 生命周期、customRef 去抖、shallowReactive/markRaw/toRef 等复杂案例，并补齐能力矩阵与说明文档，确保 typecheck、eslint、stylelint 与 build 全量通过。
