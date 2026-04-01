---
'wevu': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

新增 `wevu/vue-demi` 兼容入口，并让 `weapp-vite` 默认将 `vue-demi` 解析到该入口，降低 `@tanstack/vue-query` 等 Vue 生态库在小程序项目中的接入成本。
