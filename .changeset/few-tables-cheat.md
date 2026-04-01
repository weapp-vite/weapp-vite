---
'wevu': patch
'create-weapp-vite': patch
---

为 `app.vue` 的 `<script setup>` 新增 `use(plugin, ...options)` 运行时辅助 API，用于在 app 级 setup 上下文中表达 `app.use(...)` 风格的插件安装。这样像 `@tanstack/vue-query` 这类依赖 `install(app)` 的插件可以直接在 `wevu` 的 app SFC 入口中完成注册，同时保留现有 `provide()` 作为 `app.provide(...)` 的等价写法。
