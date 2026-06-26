---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 `app.vue` 在开发热更新期间被直接写入未完成打包脚本的问题，避免入口产物残留 `@/` 等业务别名 import，导致微信开发者工具报模块未定义。
