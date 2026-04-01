---
'wevu': patch
'create-weapp-vite': patch
---

为 `app.vue` 的 `<script setup>` 补充 `defineAppSetup((app) => { ... })` API，让应用入口可以显式拿到 `app` 并执行 `app.use(...)`、`app.provide(...)` 这类 app 级注册逻辑，更贴近 Vue 的 `createApp(...).use(...)` 心智，同时保持小程序运行时的受控边界。
