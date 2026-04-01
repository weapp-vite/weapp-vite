---
'wevu': patch
'@wevu/compiler': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `app.vue` 中 `defineAppSetup()` 需要手动从 `wevu` 导入的问题。现在 `defineAppSetup` 会像其他 SFC 宏一样自动注入运行时导入，并同步补齐全局类型声明与编译测试，允许在 `<script setup lang="ts">` 中直接编写 `defineAppSetup((app) => app.use(...))`。
