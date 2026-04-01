---
'wevu': patch
'create-weapp-vite': patch
---

补全 wevu 的 Vue 兼容 API，新增 `watchPostEffect()`、`watchSyncEffect()`、`isProxy()`、`isReadonly()` 与 `app.provide()`，便于 `app.use()` 安装依赖这些能力的生态插件。
